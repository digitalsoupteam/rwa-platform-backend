import type { Resolvers } from '../../../generated/types';
import { evaluatePoolRisk } from './mutations/evaluatePoolRisk';
import { evaluateBusinessRisk } from './mutations/evaluateBusinessRisk';
import { getEvaluation } from './queries/getEvaluation';
import { getEvaluations } from './queries/getEvaluations';

export const aiEvaluatorResolvers: Resolvers = {
  Query: {
    getEvaluation,
    getEvaluations,
  },
  Mutation: {
    evaluatePoolRisk,
    evaluateBusinessRisk,
  },
};
