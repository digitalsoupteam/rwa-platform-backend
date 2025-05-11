import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';
import { CONFIG } from './config';
import { GraphQLController } from './controllers/graphql.controller';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';


const app = new Elysia()
  
  .use(GraphQLController)
  .use(HealthController)
  .use(MetricsController)
  
  
  .onError(({ error, set }) => {
    logger.error('Application Error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    set.status = 500;
    return {
      success: false,
      error: 'Internal Server Error',
    };
  })
  
  
  .listen(CONFIG.PORT, () => {
    logger.info(`🚀 Gateway service is running at http://localhost:${CONFIG.PORT}`);
    logger.info('Available endpoints:');
    logger.info(`- GraphQL: http://localhost:${CONFIG.PORT}/graphql`);
    logger.info(`- GraphQL Playground: http://localhost:${CONFIG.PORT}/graphql`);
    logger.info(`- Health: http://localhost:${CONFIG.PORT}/health`);
    logger.info(`- Metrics: http://localhost:${CONFIG.PORT}/metrics`);
  });


process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});