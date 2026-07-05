import { Elysia } from 'elysia';
import { monitoringPlugin } from '@shared/monitoring/src/monitoring.plugin';
import { healthPlugin } from '@shared/monitoring/src/health.plugin';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createRepositoriesPlugin } from './plugins/repositories.plugin';
import { createServicesPlugin } from './plugins/services.plugin';
import { createControllersPlugin } from './plugins/controllers.plugin';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export async function createApp(
  port: number,
  mongoUri: string,
  serviceName: string = '<service-name>',
  logLevel: string = 'info',
) {
  const repositoriesPlugin = await withTraceAsync(
    '<service-name>.init.repositories_plugin',
    async () => await createRepositoriesPlugin(mongoUri),
  );

  const servicesPlugin = withTraceSync('<service-name>.init.services_plugin', () =>
    createServicesPlugin(repositoriesPlugin),
  );

  const controllersPlugin = withTraceSync('<service-name>.init.controllers', () =>
    createControllersPlugin(servicesPlugin),
  );

  const app = withTraceSync('<service-name>.init.elysia', (ctx) => {
    const result = new Elysia({ name: serviceName })
      .use(monitoringPlugin)
      .use(healthPlugin)
      .onError(ErrorHandlerPlugin)
      .use(repositoriesPlugin)
      .use(servicesPlugin)
      .use(controllersPlugin)
      .listen(port, () => {
        ctx.end();
      });
    return result;
  });

  return app;
}
