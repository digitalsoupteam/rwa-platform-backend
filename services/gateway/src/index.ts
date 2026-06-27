import { Elysia } from 'elysia';
import { yogaServer } from './graphql/server';
import { monitoringPlugin, logger } from '@shared/monitoring/src/monitoring.plugin';
import { healthPlugin } from '@shared/monitoring/src/health.plugin';
import { uploadDocumentController } from './controllers/uploadDocument.controller';
import { uploadImageController } from './controllers/uploadImage.controller';

new Elysia({
  serve: {
    idleTimeout: 30,
  },
})
  .use(monitoringPlugin)
  .use(healthPlugin)
  .state('startTime', 0 as number)
  .use(uploadDocumentController)
  .use(uploadImageController)
  .all('/graphql', (context) => yogaServer.handle(context.request))
  .all('/graphql/stream', (context) => yogaServer.handle(context.request))
  .listen(3000);

logger.info('Server is running on http://localhost:3000/graphql');
