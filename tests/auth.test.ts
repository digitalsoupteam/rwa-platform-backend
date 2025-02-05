// auth.test.ts
import { FastifyInstance } from 'fastify';
import { ethers } from 'ethers';
import { createServer } from '../src/server';
import { User } from '../src/models';
import mongoose from 'mongoose';
import { KYCStatus, UserRole } from '../src/types/enums';

describe('Authentication Tests', () => {
  let app: FastifyInstance;
  const wallet = ethers.Wallet.createRandom();
  
  beforeAll(async () => {
    app = await createServer();
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test-db');
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
    await app.close();
  });

  beforeEach(async () => {
    await User.deleteMany({}); // Очищаем БД перед каждым тестом
  });

  describe('POST /api/v1/auth/verify', () => {
    it('should reject invalid signature', async () => {
      // Получаем nonce
      const getNonceResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/nonce/${wallet.address}`
      });
  
      const { nonce } = JSON.parse(getNonceResponse.payload);
  
      // Используем некорректную подпись (неправильной длины)
      const invalidSignature = '0x1234567890';
  
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify',
        payload: {
          address: wallet.address,
          signature: invalidSignature,
          nonce
        }
      });
  
      expect(response.statusCode).toBe(400);
      const error = JSON.parse(response.payload);
      expect(error).toHaveProperty('error');
      expect(error.error.message).toBe('Invalid signature format');
    });
  
    it('should reject if nonce does not match', async () => {
      // Сначала создаем пользователя с известным nonce
      const correctNonce = 'correct-nonce';
      await User.create({
        address: wallet.address.toLowerCase(),
        nonce: correctNonce,
        role: UserRole.INVESTOR,
        kycStatus: KYCStatus.NONE
      });
  
      // Пытаемся аутентифицироваться с неправильным nonce
      const wrongNonce = 'wrong-nonce';
      const message = `Welcome to RWA Protocol!\nNonce: ${wrongNonce}`;
      const signature = await wallet.signMessage(message);
  
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify',
        payload: {
          address: wallet.address,
          signature,
          nonce: wrongNonce
        }
      });
  
      expect(response.statusCode).toBe(400);
      const error = JSON.parse(response.payload);
      expect(error.error.message).toBe('Invalid nonce');
    });
  });
  describe('GET /api/v1/auth/nonce/:address', () => {
    it('should generate new nonce for address', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/nonce/${wallet.address}`
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('nonce');
      expect(typeof result.nonce).toBe('string');
      expect(result.nonce.length).toBeGreaterThan(0);
    });

    it('should return different nonce for same address on subsequent calls', async () => {
      const response1 = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/nonce/${wallet.address}`
      });

      const response2 = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/nonce/${wallet.address}`
      });

      const nonce1 = JSON.parse(response1.payload).nonce;
      const nonce2 = JSON.parse(response2.payload).nonce;

      expect(nonce1).not.toBe(nonce2);
    });
  });
});
