import { Elysia } from 'elysia';
import { evaluatePoolRiskController } from '../controllers/evaluatePoolRisk.controller';
import { evaluateBusinessRiskController } from '../controllers/evaluateBusinessRisk.controller';
import { getEvaluationController } from '../controllers/getEvaluation.controller';
import { getEvaluationsController } from '../controllers/getEvaluations.controller';
import { withTraceSync } from '@shared/monitoring/src/tracing';
import type { ServicesPlugin } from './services.plugin';

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const evaluatePoolRiskCtrl = withTraceSync('ai-evaluator.init.controllers.evaluate_pool_risk', () =>
    evaluatePoolRiskController(servicesPlugin),
  );

  const evaluateBusinessRiskCtrl = withTraceSync('ai-evaluator.init.controllers.evaluate_business_risk', () =>
    evaluateBusinessRiskController(servicesPlugin),
  );

  const getEvaluationCtrl = withTraceSync('ai-evaluator.init.controllers.get_evaluation', () =>
    getEvaluationController(servicesPlugin),
  );

  const getEvaluationsCtrl = withTraceSync('ai-evaluator.init.controllers.get_evaluations', () =>
    getEvaluationsController(servicesPlugin),
  );

  const plugin = withTraceSync('ai-evaluator.init.controllers.plugin', () =>
    new Elysia({ name: 'Controllers' })
      .use(evaluatePoolRiskCtrl)
      .use(evaluateBusinessRiskCtrl)
      .use(getEvaluationCtrl)
      .use(getEvaluationsCtrl),
  );

  return plugin;
};

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>;
