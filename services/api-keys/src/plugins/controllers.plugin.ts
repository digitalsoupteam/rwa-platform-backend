import { Elysia } from 'elysia';
import { createApiKeyController } from '../controllers/createApiKey.controller';
import { deleteApiKeyController } from '../controllers/deleteApiKey.controller';
import { getApiKeyController } from '../controllers/getApiKey.controller';
import { getApiKeysController } from '../controllers/getApiKeys.controller';
import { updateApiKeyController } from '../controllers/updateApiKey.controller';
import { validateApiKeyController } from '../controllers/validateApiKey.controller';
import { withTraceSync } from '@shared/monitoring/src/tracing';
import type { ServicesPlugin } from './services.plugin';

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createApiKeyCtrl = withTraceSync('api-keys.init.controllers.create', () =>
    createApiKeyController(servicesPlugin),
  );

  const deleteApiKeyCtrl = withTraceSync('api-keys.init.controllers.delete', () =>
    deleteApiKeyController(servicesPlugin),
  );

  const getApiKeyCtrl = withTraceSync('api-keys.init.controllers.get', () => getApiKeyController(servicesPlugin));

  const getApiKeysCtrl = withTraceSync('api-keys.init.controllers.list', () => getApiKeysController(servicesPlugin));

  const updateApiKeyCtrl = withTraceSync('api-keys.init.controllers.update', () =>
    updateApiKeyController(servicesPlugin),
  );

  const validateApiKeyCtrl = withTraceSync('api-keys.init.controllers.validate', () =>
    validateApiKeyController(servicesPlugin),
  );

  const plugin = withTraceSync('api-keys.init.controllers.plugin', () =>
    new Elysia({ name: 'Controllers' })
      .use(createApiKeyCtrl)
      .use(deleteApiKeyCtrl)
      .use(getApiKeyCtrl)
      .use(getApiKeysCtrl)
      .use(updateApiKeyCtrl)
      .use(validateApiKeyCtrl),
  );

  return plugin;
};
