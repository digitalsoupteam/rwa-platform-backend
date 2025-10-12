import { Elysia } from 'elysia';
import { monitoringPlugin } from '@shared/monitoring/src/monitoring.plugin';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createClientsPlugin } from './plugins/clients.plugin';
import { createServicesPlugin } from './plugins/services.plugin';
import { createDaemonsPlugin } from './plugins/daemons.plugin';
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export async function createApp(
  port: number,
  rabbitMqUri: string,
  maxReconnectAttempts: number,
  reconnectInterval: number,
  privateKey: string
) {
  const clientsPlugin = await withTraceAsync(
    'signer.init.clients_plugin',
    async () => await createClientsPlugin(rabbitMqUri, maxReconnectAttempts, reconnectInterval)
  );

  const servicesPlugin = withTraceSync(
    'signer.init.services_plugin',
    () => createServicesPlugin(clientsPlugin, privateKey)
  );

  const daemonsPlugin = await withTraceAsync(
    'signer.init.daemons_plugin',
    async () => await createDaemonsPlugin(servicesPlugin)
  );

  const app = withTraceSync(
    'signer.init.elysia',
    (ctx) => {
      const result = new Elysia()
        .use(monitoringPlugin)
        .onError(ErrorHandlerPlugin)
        .use(clientsPlugin)
        .use(servicesPlugin)
        .use(daemonsPlugin)
        .listen(port, () => {
          ctx.end();
        });
      return result;
    }
  );

  return app;
}