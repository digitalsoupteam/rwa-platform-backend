import { Elysia } from 'elysia';
import { monitoringPlugin } from '@shared/monitoring/src/monitoring.plugin';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createRepositoriesPlugin } from './plugins/repositories.plugin';
import { createClientsPlugin } from './plugins/clients.plugin';
import { createServicesPlugin } from './plugins/services.plugin';
import { createControllersPlugin } from './plugins/controllers.plugin';
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export async function createApp(
  port: number,
  mongoUri: string,
  rootDir: string,
  maxFileSize: number
) {
  const repositoriesPlugin = await withTraceAsync(
    'files.init.repositories_plugin',
    async () => await createRepositoriesPlugin(mongoUri)
  );

  const clientsPlugin = withTraceSync(
    'files.init.clients_plugin',
    () => createClientsPlugin(rootDir)
  );

  const servicesPlugin = withTraceSync(
    'files.init.services_plugin',
    () => createServicesPlugin(repositoriesPlugin, clientsPlugin)
  );

  const controllersPlugin = withTraceSync(
    'files.init.controllers_plugin',
    () => createControllersPlugin(servicesPlugin, maxFileSize)
  );

  const app = withTraceSync(
    'files.init.elysia',
    (ctx) => {
      const result = new Elysia()
        .use(monitoringPlugin)
        .onError(ErrorHandlerPlugin)
        .use(repositoriesPlugin)
        .use(clientsPlugin)
        .use(servicesPlugin)
        .use(controllersPlugin)
        .listen(port, () => {
          ctx.end();
        });
      return result;
    }
  );

  return app;
}