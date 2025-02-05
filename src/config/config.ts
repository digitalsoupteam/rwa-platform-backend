export default {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hello-world',
  },
  rabbit: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    defaultVersion: 'v1',
    supportedVersions: ['v1'],
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
  },
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
};
