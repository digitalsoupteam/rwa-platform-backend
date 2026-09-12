import { Elysia } from 'elysia';
import { ApiKeyService } from '../services/apiKey.service';
import type { RepositoriesPlugin } from './repositories.plugin';
import { withTraceSync } from '@shared/monitoring/src/tracing';

export const createServicesPlugin = (repositoriesPlugin: RepositoriesPlugin) => {
  const apiKeyService = withTraceSync(
    'api-keys.init.services.api_key',
    () => new ApiKeyService(repositoriesPlugin.decorator.apiKeyRepository),
  );

  const plugin = withTraceSync('api-keys.init.services.plugin', () =>
    new Elysia({ name: 'Services' }).use(repositoriesPlugin).decorate('apiKeyService', apiKeyService),
  );

  return plugin;
};

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>;
