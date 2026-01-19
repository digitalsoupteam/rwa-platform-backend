import { createApp } from './app';
import { tracer } from '@shared/monitoring/src/tracing';

const app = await tracer.startActiveSpan(
  'auth.init.main',
  async (span) => {
    const appInstance = await createApp(
      Number(process.env.PORT),
      String(process.env.MONGODB_URI) + '/' + String(process.env.MONGODB_DBNAME),
      String(process.env.JWT_SECRET),
      String(process.env.ACCESS_TOKEN_EXPIRY),
      String(process.env.REFRESH_TOKEN_EXPIRY),
      String(process.env.DOMAIN_NAME),
      String(process.env.DOMAIN_VERSION)
    );
    
    span.end();
    return appInstance;
  }
)

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