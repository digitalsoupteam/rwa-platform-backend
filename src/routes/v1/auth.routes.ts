// src/routes/auth.routes.ts
import { FastifyInstance } from 'fastify';
import { ethers } from 'ethers';
import { User } from '../../models';
import { AuthService } from '../../services/auth.service';
import { KYCStatus, UserRole } from '../../types/enums';
import { APIError } from '../../errors/api.error';

interface IKYCRequest {
  address: string;
  documents: {
    type: string;
    hash: string;
  }[];
}

interface IAuthMessage {
  address: string;
  signature: string;
  nonce: string;
  timestamp: number;
  version?: string;
  chainId?: number;
}

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();

  fastify.post<{ Body: IAuthMessage }>('/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['address', 'signature', 'nonce', 'timestamp'],
        properties: {
          address: { type: 'string' },
          signature: { type: 'string' },
          nonce: { type: 'string' },
          timestamp: { type: 'number' },
          version: { type: 'string' },
          chainId: { type: 'number' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                role: { type: 'string' },
                kycStatus: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { address, signature, nonce, timestamp, version, chainId } = request.body;
        const authService = new AuthService();

        const user = await authService.verifyAuth(
          address,
          signature,
          nonce,
          timestamp,
          version,
          chainId
        );

        const token = await authService.generateToken(user);

        return {
          token,
          user: {
            address: user.address,
            role: user.role,
            kycStatus: user.kycStatus,
          },
        };
      } catch (error) {
        if (error instanceof APIError) {
          reply.code(error.statusCode).send({
            error: {
              message: error.message,
              code: error.code,
            },
          });
        } else {
          reply.code(500).send({
            error: {
              message: 'Internal server error',
            },
          });
        }
      }
    },
  });

  // Генерация нового nonce для подписи
  fastify.get('/nonce/:address', {
    schema: {
      params: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            nonce: { type: 'string' },
          },
        },
      },
    },
    handler: async (request) => {
      const nonce = authService.generateNonce();

      await User.findOneAndUpdate(
        {
          // @ts-ignore
          address: request.params.address.toLowerCase(),
        },
        { nonce },
        { upsert: true }
      );

      return { nonce };
    },
  });

  // Подача заявки на KYC верификацию
  fastify.post<{ Body: IKYCRequest }>('/kyc', {
    schema: {
      body: {
        type: 'object',
        required: ['address', 'documents'],
        properties: {
          address: { type: 'string' },
          documents: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'hash'],
              properties: {
                type: { type: 'string' },
                hash: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { address, documents } = request.body;

      const user = await User.findOne({ address: address.toLowerCase() });
      if (!user) {
        throw APIError.NotFound('User not found');
      }

      if (user.kycStatus === KYCStatus.PENDING || user.kycStatus === KYCStatus.APPROVED) {
        throw APIError.BadRequest(`KYC already ${user.kycStatus.toLowerCase()}`);
      }

      await authService.submitKYC(user, documents);

      return reply.code(202).send({
        message: 'KYC verification started',
        status: KYCStatus.PENDING,
      });
    },
  });

  // Получение статуса KYC
  fastify.get('/kyc/:address', {
    schema: {
      params: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string' },
        },
      },
    },
    handler: async (request) => {
      const user = await User.findOne({
        // @ts-ignore
        address: request.params.address.toLowerCase(),
      });
      if (!user) {
        throw APIError.NotFound('User not found');
      }

      return {
        status: user.kycStatus,
        updatedAt: user.updatedAt,
      };
    },
  });
}
