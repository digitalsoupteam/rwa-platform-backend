import { Elysia } from 'elysia';
import { monitoringPlugin } from '@shared/monitoring/src/monitoring.plugin';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createRepositoriesPlugin } from './plugins/repositories.plugin';
import { createClientsPlugin } from './plugins/clients.plugin';
import { createServicesPlugin } from './plugins/services.plugin';
import { createControllersPlugin } from './plugins/controllers.plugin';
import { createDaemonsPlugin } from './plugins/daemons.plugin';
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export async function createApp(
  port: number,
  mongoUri: string,
  redisUrl: string,
  serviceName: string,
  rabbitMqUri: string,
  rabbitMqMaxReconnectAttempts: number,
  rabbitMqReconnectInterval: number
) {
  const repositoriesPlugin = await withTraceAsync(
    'charts.init.repositories_plugin',
    async () => await createRepositoriesPlugin(mongoUri)
  );

  const clientsPlugin = await withTraceAsync(
    'charts.init.clients_plugin',
    async () => await createClientsPlugin(redisUrl, serviceName, rabbitMqUri, rabbitMqMaxReconnectAttempts, rabbitMqReconnectInterval)
  );

  const servicesPlugin = withTraceSync(
    'charts.init.services_plugin',
    () => createServicesPlugin(repositoriesPlugin, clientsPlugin)
  );

  const controllersPlugin = withTraceSync(
    'charts.init.controllers_plugin',
    () => createControllersPlugin(servicesPlugin)
  );

  const daemonsPlugin = await withTraceAsync(
    'charts.init.daemons_plugin',
    async () => await createDaemonsPlugin(clientsPlugin, servicesPlugin)
  );

  const app = withTraceSync(
    'charts.init.elysia',
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