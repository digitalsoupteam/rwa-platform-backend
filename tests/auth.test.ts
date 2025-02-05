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
    it('should authenticate with valid EIP-712 signature', async () => {
      // Создаем тестового пользователя
      const nonce = 'test-nonce-123';
      await User.create({
        address: wallet.address.toLowerCase(),
        nonce,
        role: UserRole.INVESTOR,
        kycStatus: KYCStatus.NONE,
      });

      // Определяем типы для EIP-712
      const domain = {
        name: 'RWA Protocol',
        version: '1',
        chainId: 1, // используйте нужный chainId
        verifyingContract: '0x0000000000000000000000000000000000000000',
      };

      const types = {
        Authentication: [
          { name: 'wallet', type: 'address' },
          { name: 'nonce', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      };

      // Создаем данные для подписи
      const timestamp = Math.floor(Date.now() / 1000);
      const value = {
        wallet: wallet.address,
        nonce: nonce,
        timestamp: timestamp,
      };

      // Создаем EIP-712 подпись
      const signature = await wallet.signTypedData(domain, types, value);

      // Отправляем запрос на верификацию
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify',
        payload: {
          address: wallet.address,
          signature,
          nonce,
          timestamp,
          version: '1',
          chainId: 1,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);

      // Проверяем структуру ответа
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('address', wallet.address.toLowerCase());
      expect(result.user).toHaveProperty('role', UserRole.INVESTOR);
      expect(result.user).toHaveProperty('kycStatus', KYCStatus.NONE);

      // Проверяем, что nonce обновился
      const updatedUser = await User.findOne({ address: wallet.address.toLowerCase() });
      expect(updatedUser?.nonce).not.toBe(nonce);
    });

    // Тест на проверку устаревшего timestamp
    it('should reject if timestamp is expired', async () => {
      const nonce = 'test-nonce-123';
      await User.create({
        address: wallet.address.toLowerCase(),
        nonce,
        role: UserRole.INVESTOR,
        kycStatus: KYCStatus.NONE,
      });

      const domain = {
        name: 'RWA Protocol',
        version: '1',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000',
      };

      const types = {
        Authentication: [
          { name: 'wallet', type: 'address' },
          { name: 'nonce', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      };

      // Используем старый timestamp (30 минут назад)
      const timestamp = Math.floor(Date.now() / 1000) - 1800;
      const value = {
        wallet: wallet.address,
        nonce: nonce,
        timestamp: timestamp,
      };

      const signature = await wallet.signTypedData(domain, types, value);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify',
        payload: {
          address: wallet.address,
          signature,
          nonce,
          timestamp,
          version: '1',
          chainId: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const error = JSON.parse(response.payload);
      expect(error.error.message).toBe('Signature timestamp expired');
    });

    it('should reject invalid signature', async () => {
        // Получаем nonce
        const getNonceResponse = await app.inject({
          method: 'GET',
          url: `/api/v1/auth/nonce/${wallet.address}`
        });
    
        const { nonce } = JSON.parse(getNonceResponse.payload);
        const timestamp = Math.floor(Date.now() / 1000);
    
        // Используем некорректную подпись
        const invalidSignature = '0x1234567890';
    
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/verify',
          payload: {
            address: wallet.address,
            signature: invalidSignature,
            nonce,
            timestamp,
            version: '1',
            chainId: 1
          }
        });
    
        expect(response.statusCode).toBe(400);
        const error = JSON.parse(response.payload);
        expect(error).toHaveProperty('error');
        expect(error.error.message).toBe('Invalid signature format');
      });
    
      it('should reject if nonce does not match', async () => {
        const correctNonce = 'correct-nonce';
        const timestamp = Math.floor(Date.now() / 1000);
    
        // Создаем пользователя с известным nonce
        await User.create({
          address: wallet.address.toLowerCase(),
          nonce: correctNonce,
          role: UserRole.INVESTOR,
          kycStatus: KYCStatus.NONE
        });
    
        // Создаем EIP-712 подпись с неправильным nonce
        const wrongNonce = 'wrong-nonce';
        
        const domain = {
          name: 'RWA Protocol',
          version: '1',
          chainId: 1,
          verifyingContract: '0x0000000000000000000000000000000000000000'
        };
    
        const types = {
          Authentication: [
            { name: 'wallet', type: 'address' },
            { name: 'nonce', type: 'string' },
            { name: 'timestamp', type: 'uint256' }
          ]
        };
    
        const value = {
          wallet: wallet.address,
          nonce: wrongNonce,
          timestamp
        };
    
        const signature = await wallet.signTypedData(
          domain,
          types,
          value
        );
    
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/verify',
          payload: {
            address: wallet.address,
            signature,
            nonce: wrongNonce,
            timestamp,
            version: '1',
            chainId: 1
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
        url: `/api/v1/auth/nonce/${wallet.address}`,
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
        url: `/api/v1/auth/nonce/${wallet.address}`,
      });

      const response2 = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/nonce/${wallet.address}`,
      });

      const nonce1 = JSON.parse(response1.payload).nonce;
      const nonce2 = JSON.parse(response2.payload).nonce;

      expect(nonce1).not.toBe(nonce2);
    });
  });
});
