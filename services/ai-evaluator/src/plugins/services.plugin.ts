import { Elysia } from 'elysia';
import { RiskEvaluationService } from '../services/riskEvaluation.service';
import type { RepositoriesPlugin } from './repositories.plugin';
import type { ClientsPlugin } from './clients.plugin';
import { withTraceSync } from '@shared/monitoring/src/tracing';

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin,
  openRouterModel: string,
  maxFilesPerRequest: number,
) => {
  const riskEvaluationService = withTraceSync(
    'ai-evaluator.init.services.risk_evaluation',
    () =>
      new RiskEvaluationService(
        repositoriesPlugin.decorator.evaluationRepository,
        clientsPlugin.decorator.openRouterClient,
        clientsPlugin.decorator.rwaClient,
        clientsPlugin.decorator.documentsClient,
        clientsPlugin.decorator.galleryClient,
        clientsPlugin.decorator.reactionsClient,
        clientsPlugin.decorator.questionsClient,
        clientsPlugin.decorator.portfolioClient,
        clientsPlugin.decorator.evaluationResultsClient,
        openRouterModel,
        maxFilesPerRequest,
      ),
  );

  const plugin = withTraceSync('ai-evaluator.init.services.plugin', () =>
    new Elysia({ name: 'Services' })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate('riskEvaluationService', riskEvaluationService),
  );

  return plugin;
};

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>;
