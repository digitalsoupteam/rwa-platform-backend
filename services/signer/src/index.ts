import { createApp } from './app';
import { tracer } from '@shared/monitoring/src/tracing';

const app = await tracer.startActiveSpan(
  'signer.init.main',
  async (span) => {
    const appInstance = await createApp(
      Number(process.env.PORT),
      String(process.env.RABBITMQ_URI),
      Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
      Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
      String(process.env.SIGNER_PRIVATE_KEY)
    );

    span.end();
    return appInstance;
  }
);

const shutdown = async () => {
  try {
    await app.stop();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export type App = typeof app;