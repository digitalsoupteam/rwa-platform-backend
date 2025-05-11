import { Resolvers } from '../../../generated/types';
import { getBusiness } from './queries/getBusiness';
import { getBusinesses } from './queries/getBusinesses';
import { getPool } from './queries/getPool';
import { getPools } from './queries/getPools';

import { createBusiness } from './mutations/business/createBusiness';
import { editBusiness } from './mutations/business/editBusiness';
import { updateRiskScore } from './mutations/business/updateRiskScore';
import { requestApprovalSignatures } from './mutations/business/requestApprovalSignatures';
import { rejectApprovalSignatures } from './mutations/business/rejectApprovalSignatures';

import { createPool } from './mutations/pool/createPool';
import { editPool } from './mutations/pool/editPool';
import { updatePoolRiskScore } from './mutations/pool/updatePoolRiskScore';
import { requestPoolApprovalSignatures } from './mutations/pool/requestPoolApprovalSignatures';
import { rejectPoolApprovalSignatures } from './mutations/pool/rejectPoolApprovalSignatures';

export const rwaResolvers: Resolvers = {
  Query: {
    getBusiness,
    getBusinesses,
    getPool,
    getPools,
  },
  Mutation: {
    createBusiness,
    editBusiness,
    updateRiskScore,
    requestApprovalSignatures,
    rejectApprovalSignatures,
    createPool,
    editPool,
    updatePoolRiskScore,
    requestPoolApprovalSignatures,
    rejectPoolApprovalSignatures,
  },
};