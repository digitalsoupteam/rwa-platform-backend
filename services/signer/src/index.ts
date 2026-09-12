import { createApp } from './app';
import { withTraceAsync } from '@shared/monitoring/src/tracing';

const app = await withTraceAsync('signer.init.main', async () => {
  return await createApp(
    Number(process.env.PORT),
    String(process.env.RABBITMQ_URL),
    Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
    Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
    String(process.env.SIGNER_PRIVATE_KEY),
  );

});

app.listen(Number(process.env.PORT));

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
