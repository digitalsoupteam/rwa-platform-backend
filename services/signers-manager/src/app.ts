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
  rabbitMqUri: string,
  rabbitMqMaxReconnectAttempts: number,
  rabbitMqReconnectInterval: number
) {
  const repositoriesPlugin = await withTraceAsync(
    'signers-manager.init.repositories_plugin',
    async () => await createRepositoriesPlugin(mongoUri)
  );

  const clientsPlugin = await withTraceAsync(
    'signers-manager.init.clients_plugin',
    async () => await createClientsPlugin(rabbitMqUri, rabbitMqMaxReconnectAttempts, rabbitMqReconnectInterval)
  );

  const servicesPlugin = withTraceSync(
    'signers-manager.init.services_plugin',
    () => createServicesPlugin(repositoriesPlugin, clientsPlugin)
  );

  const controllersPlugin = withTraceSync(
    'signers-manager.init.controllers_plugin',
    () => createControllersPlugin(servicesPlugin)
  );

  const daemonsPlugin = await withTraceAsync(
    'signers-manager.init.daemons_plugin',
    async () => await createDaemonsPlugin(clientsPlugin, servicesPlugin)
  );

  const app = withTraceSync(
    'signers-manager.init.elysia',
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