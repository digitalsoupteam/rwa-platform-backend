import { JWTPayload } from './jwt';
import 'fastify';
import '@fastify/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    version: string;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (role: UserRole) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    version: string;
    user: JWTPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}
