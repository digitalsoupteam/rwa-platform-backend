import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { EvaluationRequestsDaemon } from '../daemons/evaluationRequests.daemon';
import type { ClientsPlugin } from './clients.plugin';
import type { ServicesPlugin } from './services.plugin';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export const createDaemonsPlugin = async (clientsPlugin: ClientsPlugin, servicesPlugin: ServicesPlugin) => {
  const evaluationRequestsDaemon = withTraceSync(
    'ai-evaluator.init.daemons.evaluation_requests',
    () =>
      new EvaluationRequestsDaemon(
        clientsPlugin.decorator.evaluationRequestsClient,
        servicesPlugin.decorator.riskEvaluationService,
      ),
  );

  await withTraceAsync('ai-evaluator.init.daemons.initialize', async () => {
    logger.debug('Initializing daemons');
    await evaluationRequestsDaemon.initialize();
    logger.info('Evaluation requests daemon initialized');
  });

  const plugin = withTraceSync('ai-evaluator.init.daemons.plugin', () =>
    new Elysia({ name: 'Daemons' })
      .use(clientsPlugin)
      .use(servicesPlugin)
      .decorate('evaluationRequestsDaemon', evaluationRequestsDaemon)
      .onStop(async () => {
        logger.info('Daemons stopped');
      }),
  );

  return plugin;
};

export type DaemonsPlugin = Awaited<ReturnType<typeof createDaemonsPlugin>>;
