import type { Resolvers } from '../../../generated/types';
import { createWebhookEndpoint } from './mutations/createWebhookEndpoint';
import { updateWebhookEndpoint } from './mutations/updateWebhookEndpoint';
import { deleteWebhookEndpoint } from './mutations/deleteWebhookEndpoint';
import { getWebhookEndpoints } from './queries/getWebhookEndpoints';
import { getWebhookEndpoint } from './queries/getWebhookEndpoint';

export const webhooksResolvers: Resolvers = {
  Query: {
    getWebhookEndpoints,
    getWebhookEndpoint,
  },
  Mutation: {
    createWebhookEndpoint,
    updateWebhookEndpoint,
    deleteWebhookEndpoint,
  },
};
