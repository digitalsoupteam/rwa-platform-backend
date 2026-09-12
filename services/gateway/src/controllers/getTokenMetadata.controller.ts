import { Elysia, t } from 'elysia';
import { AppError } from '@shared/errors/app-errors';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { rwaClient } from '../clients/eden.clients';

const businessPropertiesSchema = t.Object({
  id: t.String(),
  name: t.String(),
  riskScore: t.Optional(t.Number()),
});

const poolPropertiesSchema = t.Object({
  address: t.Optional(t.String()),
  holdToken: t.Optional(t.String()),
  expectedHoldAmount: t.Optional(t.String()),
  expectedRwaAmount: t.Optional(t.String()),
  rewardPercent: t.Optional(t.String()),
  entryFeePercent: t.Optional(t.String()),
  exitFeePercent: t.Optional(t.String()),
  riskScore: t.Optional(t.Number()),
});

const statusPropertiesSchema = t.Object({
  isTargetReached: t.Boolean(),
  isFullyReturned: t.Boolean(),
  paused: t.Boolean(),
});

const tokenMetadataResponseSchema = t.Object({
  name: t.String(),
  description: t.String(),
  image: t.Optional(t.String()),
  decimals: t.Number(),
  properties: t.Object({
    business: businessPropertiesSchema,
    pool: poolPropertiesSchema,
    status: statusPropertiesSchema,
    tags: t.Array(t.String()),
  }),
});

export const getTokenMetadataController = new Elysia({ name: 'GetTokenMetadataController' })
  .onError(ErrorHandlerPlugin)
  .get(
    '/storage/rwa/metadata/:tokenAddress/:tokenId',
    async ({ params: { tokenAddress, tokenId } }) => {
      const response = await rwaClient.getTokenMetadata.post({ rwaAddress: tokenAddress, tokenId });

      if (response.error) {
        throw new AppError({
          message: 'Failed to get token metadata',
          statusCode: 502,
          code: 'BAD_GATEWAY',
        });
      }

      return response.data;
    },
    {
      response: tokenMetadataResponseSchema,
    },
  );
