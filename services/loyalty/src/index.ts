import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';
import { CONFIG } from './config';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { RepositoriesPlugin } from './plugins/repositories.plugin';
import { ServicesPlugin } from './plugins/services.plugin';
import { ControllersPlugin } from './plugins/controllers.plugin';


const app = new Elysia()
  .onError(ErrorHandlerPlugin)
  
  .use(RepositoriesPlugin)
  .use(ServicesPlugin)
  .use(ControllersPlugin)
  
  .listen(CONFIG.PORT, () => {
    logger.info(`🚀 Loyalty Service ready at http://127.0.0.1:${CONFIG.PORT}`);
  });


const shutdown = async () => {
  logger.info('Shutting down...');
  
  try {
    await app.stop();
    logger.info('Server stopped');
    
    logger.info('Shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export type App = typeof app;