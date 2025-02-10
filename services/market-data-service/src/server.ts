import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import mongoose from 'mongoose'
import { logger } from '@rwa-platform/shared/src'

const app = new Elysia()
  .use(cors())
  .use(swagger())

  .get('/', () => ({ 
    message: 'Welcome to market-data-service',
    version: '1.0.0'
  }))  

  .get('/health', () => ({ 
    status: 'ok',
    service: 'market-data-service',
    timestamp: new Date().toISOString()
  }))
  
  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  }))

  .listen({
    hostname: '0.0.0.0', 
    port: 3004
  })

console.log(`🚀 market-data-service is running at ${app.server?.hostname}:${app.server?.port}`)

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => logger.info('📦 MongoDB connected'))
  .catch(err => logger.error('MongoDB connection error:', err))
