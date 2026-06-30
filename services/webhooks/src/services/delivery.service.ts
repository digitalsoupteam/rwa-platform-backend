import crypto from 'crypto';
import { DeliveryLogRepository } from '../repositories/deliveryLog.repository';
import { EndpointRepository } from '../repositories/endpoint.repository';
import { RedisClient } from '../clients/redis.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';
import { metrics } from '@shared/monitoring/src/metrics';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TTL = 3600;
const MAX_PAYLOAD_SIZE = 256 * 1024;

export class DeliveryService {
  private encryptionKey: Buffer;

  constructor(
    private readonly deliveryLogRepository: DeliveryLogRepository,
    private readonly endpointRepository: EndpointRepository,
    private readonly redisClient: RedisClient,
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
        logger.warn('Payload exceeds max size, truncating', { eventId: data.eventId });
        await this.recordFailure(data.deliveryLogId, data.attempt, 413, '', 'Payload too large');
        return { success: false, deadLetter: true };
      }

      const signature = crypto.createHmac('sha256', decryptedSecret).update(body).digest('hex');

      const response = await fetch(data.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': data.eventId,
          'X-Webhook-Timestamp': String(Date.now()),
          'X-Webhook-Signature': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      const duration = performance.now() - startTime;
      metrics.histogram('webhook_delivery_latency_seconds', duration / 1000);

      if (response.ok) {
        await this.recordSuccess(data.deliveryLogId, data.attempt, response.status);
        await this.resetCircuitBreaker(data.endpointId);
        metrics.counter('webhook_delivery_total', { status: 'success' });
        return { success: true };
      }

      if (response.status >= 300 && response.status < 400) {
        await this.recordSuccess(data.deliveryLogId, data.attempt, response.status);
        metrics.counter('webhook_delivery_total', { status: 'redirect' });
        return { success: true };
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

      await this.incrementConsecutiveFailures(data.endpointId);
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

      await this.incrementConsecutiveFailures(data.endpointId);
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
      await this.redisClient.set(`webhook:endpoint:${endpointId}:active`, '0', CIRCUIT_BREAKER_TTL);
      metrics.counter('webhook_circuit_breaker_trips_total');
    } catch (error) {
      logger.error('Failed to deactivate endpoint', { endpointId, error });
    }
  }

  private async resetCircuitBreaker(endpointId: string) {
    try {
      await this.endpointRepository.updateEndpoint(endpointId, { consecutiveFailures: 0 });
    } catch {
      // Best effort
    }
  }

  private async incrementConsecutiveFailures(endpointId: string) {
    try {
      const doc = await this.endpointRepository.findById(endpointId).catch(() => null);
      if (doc) {
        const newCount = (doc.consecutiveFailures || 0) + 1;
        await this.endpointRepository.updateEndpoint(endpointId, { consecutiveFailures: newCount });

        if (newCount >= CIRCUIT_BREAKER_THRESHOLD) {
          await this.deactivateEndpoint(endpointId);
        }
      }
    } catch {
      // Best effort
    }
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
