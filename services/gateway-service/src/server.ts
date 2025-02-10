import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { yoga } from '@elysiajs/graphql-yoga';
import { createSchema } from 'graphql-yoga'
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { loadSchemaSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import path from 'path';
import { mergeResolvers } from '@graphql-tools/merge';
import { loadFilesSync } from '@graphql-tools/load-files';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { authResolver } from './resolvers/auth.resolver';
import { healthResolver } from './resolvers/health.resolver';

// Загрузка схемы
const typeDefs = loadSchemaSync(path.join(__dirname, './schemas/**/*.graphql'), {
  loaders: [new GraphQLFileLoader()]
});

// Объединение резолверов
const resolvers = {
  Query: {
    ...authResolver.Query,
    ...healthResolver.Query,
  },
  Mutation: {
    ...authResolver.Mutation
  }
};

// Создание исполняемой схемы
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .use(
    yoga({
      schema
    })
  )

  .get('/health', () => ({
    status: 'ok', 
    service: 'gateway-service',
    timestamp: new Date().toISOString(),
  }))

  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  }))

  .listen({
    hostname: '0.0.0.0',
    port: 3000,
  });

console.log(`🚀 gateway-service is running at ${app.server?.hostname}:${app.server?.port}`);

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => console.log('📦 MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));