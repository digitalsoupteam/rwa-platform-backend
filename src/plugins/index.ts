import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyAuth from '@fastify/auth';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';
import fastifyFormBody from '@fastify/formbody';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyCaching from '@fastify/caching';
import path from 'path';
import { versionPlugin } from './version';
import { UserRole } from '../types/enums';

export async function registerPlugins(fastify: FastifyInstance) {
  try {
    // Security plugins
    await fastify.register(fastifyHelmet, {
      global: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        },
      },
    });

    await fastify.register(fastifyCors, {
      origin: true,
      methods: ['GET', 'POST', 'OPTIONS'],
    });

    await fastify.register(fastifyRateLimit, {
      max: process.env.NODE_ENV === 'test' ? 10 : 100,
      timeWindow: '1 minute',
    });

    // Authentication & Authorization
    await fastify.register(fastifyJwt, {
      secret: process.env.JWT_SECRET || 'your-secret-key',
      sign: {
        expiresIn: '24h',
      },
    });

    await fastify.register(fastifyAuth);

    // API Documentation
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'API Documentation',
          description: 'API Documentation',
          version: '1.0.0',
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });

    await fastify.register(fastifySwaggerUi, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });

    // Versioning
    await fastify.register(versionPlugin);

    // WebSocket Support
    await fastify.register(fastifyWebsocket, {
      options: {
        clientTracking: true,
      },
    });

    // Static Files
    await fastify.register(fastifyStatic, {
      root: path.join(__dirname, '../public'),
      prefix: '/public/',
    });

    // Response Compression
    await fastify.register(fastifyCompress, {
      threshold: 1024,
      encodings: ['gzip', 'deflate'],
    });

    // Form Handling
    await fastify.register(fastifyFormBody);

    // Cookie Handling
    await fastify.register(fastifyCookie, {
      secret: process.env.COOKIE_SECRET || 'cookie-secret',
      hook: 'onRequest',
    });

    // Caching
    await fastify.register(fastifyCaching, {
      privacy: 'private',
      expiresIn: 300, // 5 minutes
      cache: new Map(), // In-memory cache
    });

    // Декораторы для удобного доступа к функционалу плагинов
    fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    });

    fastify.decorate('authorize', (requiredRole: UserRole) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          // Проверяем, что пользователь аутентифицирован
          if (!request.user) {
            throw new Error('User not authenticated');
          }
          // Проверяем роль пользователя
          if (request.user.role !== requiredRole) {
            throw new Error('Insufficient permissions');
          }
        } catch (err: any) {
          reply.code(403).send({
            error: {
              message: 'Access forbidden',
              details: err.message,
            },
          });
        }
      };
    });

    // Хуки для глобальной обработки
    fastify.addHook('onRequest', (request, reply, done) => {
      // Глобальная обработка запросов
      done();
    });

    fastify.addHook('onResponse', (request, reply, done) => {
      // Глобальная обработка ответов
      done();
    });

    // Обработка ошибок
    fastify.setErrorHandler((error, request, reply) => {
      fastify.log.error(error);
      reply.status(error.statusCode || 500).send({
        error: {
          message: error.message,
          code: error.code,
        },
      });
    });

    fastify.log.info('All plugins registered successfully');
  } catch (error) {
    fastify.log.error('Error registering plugins:', error);
    throw error;
  }
}
