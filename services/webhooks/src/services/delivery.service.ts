import crypto from 'crypto';
import { isIP } from 'node:net';
import { isPrivateAddress, normalizeHostname, resolveHostnameAddresses } from '../utils/ssrf';
import { DeliveryLogRepository } from '../repositories/deliveryLog.repository';
import { EndpointRepository } from '../repositories/endpoint.repository';
import { RedisWithTracing } from '@shared/monitoring/src/redis';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';
import { metrics } from '@shared/monitoring/src/metrics';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

const CIRCUIT_BREAKER_TTL = 3600;
const MAX_PAYLOAD_SIZE = 256 * 1024;

export class DeliveryService {
  private encryptionKey: Buffer;

  constructor(
    private readonly deliveryLogRepository: DeliveryLogRepository,
    private readonly endpointRepository: EndpointRepository,
    private readonly redisClient: RedisWithTracing,
    encryptionKeyBase64: string,
  ) {
    this.encryptionKey = Buffer.from(encryptionKeyBase64, 'base64');
  }

  @TraceDecorator()
  async createDeliveryLog(data: { endpointId: string; eventType: string; eventId: string; payload: unknown }) {
    const doc = await this.deliveryLogRepository.createDeliveryLog({
      endpointId: data.endpointId as any,
      eventType: data.eventType,
      eventId: data.eventId,
      payload: data.payload,
      status: 'pending',
    });
    return doc._id.toString();
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ endpointId: a[0].endpointId, eventId: a[0].eventId }),
  })
  async deliverWebhook(data: {
    endpointId: string;
    eventId: string;
    eventType: string;
    payload: unknown;
    attempt: number;
    maxAttempts: number;
    url: string;
    secret: string;
    deliveryLogId: string;
  }) {
    setSpanAttributes({ endpointId: data.endpointId, eventId: data.eventId });

    const startTime = performance.now();

    try {
      const decryptedSecret = this.decryptSecret(data.secret);

      const body = JSON.stringify(data.payload);
      if (Buffer.byteLength(body, 'utf8') > MAX_PAYLOAD_SIZE) {
        logger.warn('Payload exceeds max size, dead-lettering', { eventId: data.eventId });
        await this.recordFailure(data.deliveryLogId, data.attempt, 413, '', 'Payload too large');
        await this.markDeadLetter(data.deliveryLogId);
        metrics.counter('webhook_delivery_total', { status: 'dead_letter' });
        return { success: false, deadLetter: true };
      }

      // Standard Webhooks scheme: the signature covers `<id>.<timestamp>.<body>`
      // so receivers can reject replays. `webhook-id` stays the same across
      // retries of the same message and is the receiver's deduplication key.
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', this.secretKeyBytes(decryptedSecret))
        .update(`${data.eventId}.${timestamp}.${body}`)
        .digest('base64');

      // SSRF guard at delivery time: the destination is resolved and checked
      // again right before the request — a hostname validated at subscription
      // time must not be allowed to flip to a private address later (DNS
      // rebinding). A confirmed private destination is dead-lettered and the
      // endpoint deactivated; a temporary resolver failure stays a normal,
      // retryable delivery failure.
      const target = normalizeHostname(new URL(data.url).hostname);
      const addresses = isIP(target) ? [target] : await resolveHostnameAddresses(target);

      if (addresses.some(isPrivateAddress)) {
        logger.warn('Refusing webhook delivery: hostname resolves to a private address', {
          endpointId: data.endpointId,
          eventId: data.eventId,
        });
        await this.recordFailure(
          data.deliveryLogId,
          data.attempt,
          undefined,
          '',
          'Hostname resolves to a private address (SSRF protection)',
        );
        await this.markDeadLetter(data.deliveryLogId);
        await this.deactivateEndpoint(data.endpointId);
        metrics.counter('webhook_delivery_total', { status: 'dead_letter' });
        return { success: false, deadLetter: true };
      }

      if (addresses.length === 0) {
        throw new Error('Failed to resolve hostname for delivery');
      }

      const response = await fetch(data.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'webhook-id': data.eventId,
          'webhook-timestamp': String(timestamp),
          'webhook-signature': `v1,${signature}`,
          'webhook-event': data.eventType,
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });

      const duration = performance.now() - startTime;
      metrics.histogram('webhook_delivery_latency_seconds', duration / 1000);

      if (response.ok) {
        await this.recordSuccess(data.deliveryLogId, data.attempt, response.status);
        metrics.counter('webhook_delivery_total', { status: 'success' });
        return { success: true };
      }

      // Redirects are never followed (redirect: 'manual'): a webhook endpoint must answer 2xx directly.
      // A 3xx response (or an opaque redirect with status 0) means the endpoint is misconfigured —
      // treat it like 400/404/410: record a failure, dead letter and deactivate.
      if (response.status === 0 || (response.status >= 300 && response.status < 400)) {
        await this.recordFailure(data.deliveryLogId, data.attempt, response.status, '', 'Redirects are not followed');
        await this.markDeadLetter(data.deliveryLogId);
        await this.deactivateEndpoint(data.endpointId);
        metrics.counter('webhook_delivery_total', { status: 'dead_letter' });
        return { success: false, deadLetter: true };
      }

      if (response.status === 400 || response.status === 404 || response.status === 410) {
        const responseBody = await response.text().catch(() => '');
        await this.recordFailure(
          data.deliveryLogId,
          data.attempt,
          response.status,
          responseBody,
          `HTTP ${response.status}`,
        );
        await this.markDeadLetter(data.deliveryLogId);
        await this.deactivateEndpoint(data.endpointId);
        metrics.counter('webhook_delivery_total', { status: 'dead_letter' });
        return { success: false, deadLetter: true };
      }

      const responseBody = await response.text().catch(() => '');
      await this.recordFailure(
        data.deliveryLogId,
        data.attempt,
        response.status,
        responseBody,
        `HTTP ${response.status}`,
      );

      if (data.attempt >= data.maxAttempts) {
        await this.markDeadLetter(data.deliveryLogId);
        await this.deactivateEndpoint(data.endpointId);
        metrics.counter('webhook_delivery_total', { status: 'dead_letter' });
        return { success: false, deadLetter: true };
      }

      metrics.counter('webhook_delivery_total', { status: 'retry' });
      return { success: false, retry: true };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      metrics.histogram('webhook_delivery_latency_seconds', duration / 1000);

      const errorMsg = error.name === 'AbortError' ? 'Request timeout (10s)' : error.message;
      await this.recordFailure(data.deliveryLogId, data.attempt, undefined, '', errorMsg);

      if (data.attempt >= data.maxAttempts) {
        await this.markDeadLetter(data.deliveryLogId);
        await this.deactivateEndpoint(data.endpointId);
        metrics.counter('webhook_delivery_total', { status: 'dead_letter' });
        return { success: false, deadLetter: true };
      }

      metrics.counter('webhook_delivery_total', { status: 'retry' });
      return { success: false, retry: true };
    }
  }

  private async recordSuccess(deliveryLogId: string, attempt: number, statusCode: number) {
    await this.deliveryLogRepository.pushAttempt(deliveryLogId, {
      timestamp: Math.floor(Date.now() / 1000),
      statusCode,
    });
    await this.deliveryLogRepository.updateStatus(deliveryLogId, { status: 'delivered' });
  }

  private async recordFailure(
    deliveryLogId: string,
    attempt: number,
    statusCode?: number,
    responseBody?: string,
    error?: string,
  ) {
    await this.deliveryLogRepository.pushAttempt(deliveryLogId, {
      timestamp: Math.floor(Date.now() / 1000),
      statusCode,
      responseBody: responseBody || '',
      error: error || '',
    });
  }

  private async markDeadLetter(deliveryLogId: string) {
    await this.deliveryLogRepository.updateStatus(deliveryLogId, { status: 'dead_letter' });
  }

  private async deactivateEndpoint(endpointId: string) {
    try {
      await this.endpointRepository.updateEndpoint(endpointId, { active: false });
      await this.redisClient.set(`webhook:endpoint:${endpointId}:active`, '0', 'EX', CIRCUIT_BREAKER_TTL);
      metrics.counter('webhook_circuit_breaker_trips_total');
    } catch (error) {
      logger.error('Failed to deactivate endpoint', { endpointId, error });
    }
  }

  /**
   * Standard Webhooks secrets arrive as `whsec_<base64>`; anything else
   * (legacy secrets) is used verbatim as UTF-8 key material.
   */
  private secretKeyBytes(secret: string): Buffer {
    if (secret.startsWith('whsec_')) {
      return Buffer.from(secret.slice('whsec_'.length), 'base64');
    }
    return Buffer.from(secret, 'utf8');
  }

  private decryptSecret(encrypted: string): string {
    const buf = Buffer.from(encrypted, 'base64');
    const iv = buf.subarray(0, 16);
    const authTag = buf.subarray(16, 32);
    const encryptedData = buf.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8');
  }
}
