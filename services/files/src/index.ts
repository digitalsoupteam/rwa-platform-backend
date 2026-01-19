import { createApp } from './app';
import { tracer } from '@shared/monitoring/src/tracing';

const app = await tracer.startActiveSpan(
  'files.init.main',
  async (span) => {
    const appInstance = await createApp(
      Number(process.env.PORT),
      String(process.env.MONGODB_URI) + '/' + String(process.env.MONGODB_DBNAME),
      String(process.env.STORAGE_ROOT_DIR),
      Number(process.env.MAX_FILE_SIZE)
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
