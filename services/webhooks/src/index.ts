import { createApp } from './app';
import { tracer } from '@shared/monitoring/src/tracing';

const app = await tracer.startActiveSpan('webhooks.init.main', async (span) => {
  const appInstance = await createApp(
    Number(process.env.PORT),
    String(process.env.MONGODB_URI) + '/' + String(process.env.MONGODB_DBNAME),
    String(process.env.RABBITMQ_URL),
    Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
    Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
    String(process.env.REDIS_URL),
    String(process.env.WEBHOOKS_ENCRYPTION_KEY),
  );

  span.end();
  return appInstance;
});

const shutdown = async () => {
  try {
    await app.stop();
    process.exit(0);
  } catch {
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export type App = typeof app;
