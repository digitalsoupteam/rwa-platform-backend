import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import mongoose from 'mongoose'

const app = new Elysia()
  .use(cors())
  .use(swagger())

  .get('/', () => ({ 
    message: 'Welcome to ai-service',
    version: '1.0.0'
  }))

  .get('/health', () => ({ 
    status: 'ok',
    service: 'ai-service',
    timestamp: new Date().toISOString()
  }))
  
  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  }))

  .listen({
    hostname: '0.0.0.0', 
    port: 3008
  })

console.log(`🚀 ai-service is running at ${app.server?.hostname}:${app.server?.port}`)

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => console.log('📦 MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err))
