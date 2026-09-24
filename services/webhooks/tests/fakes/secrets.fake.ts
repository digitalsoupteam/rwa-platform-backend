/**
 * Deterministic stand-in for the private secret helpers of the two services.
 *
 * WebhookService.encryptSecret stores endpoint secrets as
 * base64(iv | authTag | ciphertext) under AES-256-GCM, and
 * DeliveryService.decryptSecret reads that format back before signing a
 * delivery. Tests use this box to build secrets in the exact wire format the
 * services expect and to prove that a stored (encrypted) secret decrypts back
 * to the raw secret handed to the caller. Both helpers mirror the private
 * implementations and are wrapped in bun:test mock() for consistency with the
 * other fakes.
 */
import { mock } from 'bun:test';
import crypto from 'crypto';

export function createSecretBox(encryptionKeyBase64: string) {
  const key = Buffer.from(encryptionKeyBase64, 'base64');

  return {
    // Mirrors WebhookService.encryptSecret.
    encrypt: mock((text: string) => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
    }),

    // Mirrors DeliveryService.decryptSecret.
    decrypt: mock((encrypted: string) => {
      const buf = Buffer.from(encrypted, 'base64');
      const iv = buf.subarray(0, 16);
      const authTag = buf.subarray(16, 32);
      const encryptedData = buf.subarray(32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8');
    }),
  };
}

export type FakeSecretBox = ReturnType<typeof createSecretBox>;
