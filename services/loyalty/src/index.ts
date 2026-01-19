import { createApp } from './app';
import { tracer } from '@shared/monitoring/src/tracing';

const app = await tracer.startActiveSpan(
  'loyalty.init.main',
  async (span) => {
    const appInstance = await createApp(
      Number(process.env.PORT),
      String(process.env.MONGODB_URI) + '/' + String(process.env.MONGODB_DBNAME),
      String(process.env.RABBITMQ_URL),
      Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
      Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
      String(process.env.SIGNERS_MANAGER_URL),
      Number(process.env.LOYALTY_REFERRAL_REWARD_PERCENTAGE),
      [
        {
          chainId: '97',
          name: "BSC Testnet",
          referralTreasuryAddress: "0x5Be8ef43955d48357080334DAa7DC68cDcc7a6c6",
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