import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import pdf from 'pdf-parse';
import fs from 'fs';
import path from 'path';

// PDF Schema
const pdfSchema = new mongoose.Schema({
  filename: String,
  content: String,
  uploadDate: { type: Date, default: Date.now }
});

const PDF = mongoose.model('PDF', pdfSchema);

const app = new Elysia()
  .use(cors())
  .use(swagger())

  .post('/upload-pdf', async ({ body }) => {
    try {
      // Create uploads directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
      }

      const file = body as any;
      const filePath = path.join(uploadDir, file.name);
      
      // Save file
      await fs.promises.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

      // Read PDF file
      const dataBuffer = fs.readFileSync(filePath);
      
      // Parse PDF
      const data = await pdf(dataBuffer);
      
      // Save to MongoDB
      const pdfDoc = new PDF({
        filename: file.name,
        content: data.text
      });
      await pdfDoc.save();

      // Clean up - delete file after processing
      fs.unlinkSync(filePath);

      return {
        success: true,
        message: 'PDF processed successfully',
        text: data.text,
        info: {
          pages: data.numpages,
          metadata: data.metadata,
          version: data.version
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error processing PDF',
        error: error.message
      };
    }
  })

  .get('/pdfs', async () => {
    try {
      const pdfs = await PDF.find();
      return {
        success: true,
        data: pdfs
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error fetching PDFs',
        error: error.message
      };
    }
  })

  .get('/', () => ({
    message: 'Welcome to enterprise-service',
    version: '1.0.0',
  }))
  
  .get('/health', () => ({
    status: 'ok',
    service: 'enterprise-service',
    timestamp: new Date().toISOString(),
  }))

  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  }))

  .listen({
    hostname: '0.0.0.0',
    port: 3003,
  });

console.log(`🚀 enterprise-service is running at ${app.server?.hostname}:${app.server?.port}`);

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => console.log('📦 MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));
