import { createApp } from './app';
import { tracer } from '@shared/monitoring/src/tracing';

const app = await tracer.startActiveSpan(
  'blockchain-scanner.init.main',
  async (span) => {
    const appInstance = await createApp(
      Number(process.env.PORT),
      String(process.env.MONGODB_URI),
      String(process.env.RABBITMQ_URI),
      Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
      Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
      String(process.env.RPC_URL),
      String(process.env.EVENT_EMITTER_ADDRESS),
      Number(process.env.BLOCK_CONFIRMATIONS),
      Number(process.env.SCAN_INTERVAL),
      Number(process.env.BATCH_SIZE),
      Number(process.env.CHAIN_ID)
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
