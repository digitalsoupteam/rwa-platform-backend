import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';
import { CONFIG } from './config';
import { RepositoriesPlugin } from './plugins/repositories.plugin';
import { ClientsPlugin } from './plugins/clients.plugin';
import { ServicesPlugin } from './plugins/services.plugin';
import { ControllersPlugin } from './plugins/controllers.plugin';

const app = new Elysia()
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)
  .use(ServicesPlugin)
  .use(ControllersPlugin)
  
  .listen(CONFIG.PORT, () => {
    logger.info(`🚀 Files Service ready at http://127.0.0.1:${CONFIG.PORT}`);
  });

const shutdown = async () => {
  logger.info('Shutting down Files Service...');
  
  try {
    await app.stop();
    logger.info('Server stopped');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export type App = typeof app;
