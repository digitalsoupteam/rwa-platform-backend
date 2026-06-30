import { Elysia } from 'elysia';
import { createEndpointController } from '../controllers/createEndpoint.controller';
import { getEndpointsController } from '../controllers/getEndpoints.controller';
import { getEndpointController } from '../controllers/getEndpoint.controller';
import { updateEndpointController } from '../controllers/updateEndpoint.controller';
import { deleteEndpointController } from '../controllers/deleteEndpoint.controller';
import { withTraceSync } from '@shared/monitoring/src/tracing';
import type { ServicesPlugin } from './services.plugin';

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createEndpointCtrl = withTraceSync('webhooks.init.controllers.create', () =>
    createEndpointController(servicesPlugin),
  );

  const getEndpointsCtrl = withTraceSync('webhooks.init.controllers.list', () =>
    getEndpointsController(servicesPlugin),
  );

  const getEndpointCtrl = withTraceSync('webhooks.init.controllers.get', () => getEndpointController(servicesPlugin));

  const updateEndpointCtrl = withTraceSync('webhooks.init.controllers.update', () =>
    updateEndpointController(servicesPlugin),
  );

  const deleteEndpointCtrl = withTraceSync('webhooks.init.controllers.delete', () =>
    deleteEndpointController(servicesPlugin),
  );

  const plugin = withTraceSync('webhooks.init.controllers.plugin', () =>
    new Elysia({ name: 'Controllers' })
      .use(createEndpointCtrl)
      .use(getEndpointsCtrl)
      .use(getEndpointCtrl)
      .use(updateEndpointCtrl)
      .use(deleteEndpointCtrl),
  );

  return plugin;
};

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>;
