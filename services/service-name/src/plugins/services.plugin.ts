import { Elysia } from 'elysia';
import { SampleService } from '../services/sample.service';
import type { RepositoriesPlugin } from './repositories.plugin';
import { withTraceSync } from '@shared/monitoring/src/tracing';

export const createServicesPlugin = (repositoriesPlugin: RepositoriesPlugin) => {
  const sampleService = withTraceSync(
    '<service-name>.init.services.sample',
    () => new SampleService(repositoriesPlugin.decorator.sampleRepository),
  );

  const plugin = withTraceSync('<service-name>.init.services.plugin', () =>
    new Elysia({ name: 'Services' }).use(repositoriesPlugin).decorate('sampleService', sampleService),
  );

  return plugin;
};

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>;
