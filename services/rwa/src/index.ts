import { createApp } from './app';
import { tracer } from '@shared/monitoring/src/tracing';

const app = await tracer.startActiveSpan(
  'rwa.init.main',
  async (span) => {
    const appInstance = await createApp(
      Number(process.env.PORT),
      String(process.env.MONGODB_URI),
      String(process.env.REDIS_URL),
      String(process.env.SERVICE_NAME),
      String(process.env.OPENROUTER_API_KEY),
      String(process.env.OPENROUTER_BASE_URL),
      String(process.env.RABBITMQ_URI),
      Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
      Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
      String(process.env.SIGNERS_MANAGER_URL),
      [
        {
          chainId: '97',
          name: "BSC Testnet",
          factoryAddress: "0xD1b0e186A2B0d602f27cE2e046Fa95BBe9FE6d84",
        }
      ]
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