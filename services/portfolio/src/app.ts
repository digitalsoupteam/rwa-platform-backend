import { Elysia } from 'elysia';
import { monitoringPlugin } from '@shared/monitoring/src/monitoring.plugin';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createRepositoriesPlugin } from './plugins/repositories.plugin';
import { createClientsPlugin } from './plugins/clients.plugin';
import { createServicesPlugin } from './plugins/services.plugin';
import { createDaemonsPlugin } from './plugins/daemons.plugin';
import { createControllersPlugin } from './plugins/controllers.plugin';
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export async function createApp(
  port: number,
  mongoUri: string,
  rabbitMQUri: string,
  reconnectAttempts: number,
  reconnectInterval: number
) {
  const repositoriesPlugin = await withTraceAsync(
    'portfolio.init.repositories_plugin',
    async () => await createRepositoriesPlugin(mongoUri)
  );

  const clientsPlugin = await withTraceAsync(
    'portfolio.init.clients_plugin',
    async () => await createClientsPlugin(rabbitMQUri, reconnectAttempts, reconnectInterval)
  );

  const servicesPlugin = withTraceSync(
    'portfolio.init.services_plugin',
    () => createServicesPlugin(repositoriesPlugin)
  );

  const daemonsPlugin = await withTraceAsync(
    'portfolio.init.daemons_plugin',
    async () => await createDaemonsPlugin(clientsPlugin, servicesPlugin)
  );

  const controllersPlugin = withTraceSync(
    'portfolio.init.controllers_plugin',
    () => createControllersPlugin(servicesPlugin)
  );

  const app = withTraceSync(
    'portfolio.init.elysia',
    (ctx) => {
      const result = new Elysia()
        .use(monitoringPlugin)
        .onError(ErrorHandlerPlugin)
        .use(repositoriesPlugin)
        .use(clientsPlugin)
        .use(servicesPlugin)
        .use(daemonsPlugin)
        .use(controllersPlugin)
        .listen(port, () => {
          ctx.end();
        });
      return result;
    }
  );

  return app;
}