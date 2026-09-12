import { createApp } from './app';
import { withTraceAsync } from '@shared/monitoring/src/tracing';

const app = await withTraceAsync('dao.init.main', async () => {
  return await createApp(
    Number(process.env.PORT),
    String(process.env.MONGODB_URI) + '/' + String(process.env.MONGODB_DBNAME),
    String(process.env.RABBITMQ_URL),
    Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
    Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
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
