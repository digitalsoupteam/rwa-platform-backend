import { createSchema, createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { join } from 'path';
import { resolvers } from '../modules';
import { extractFromToken } from '../../utils/jwt.utils';
import {
  authClient,
  aiAssistantClient,
  testnetFaucetClient,
  rwaClient,
  filesClient,
  signersManagerClient,
  documentsClient,
  galleryClient,
  questionsClient,
  faqClient,
  blogClient,
  companyClient,
  portfolioClient,
  chartsClient,
  reactionsClient,
  loyaltyClient,
  daoClient
} from '../../clients/eden.clients';
import type { GraphQLContext, User } from '../context/types';
import { cacheService, ownershipService, parentService } from '../../services/services.init';
import { pubSub } from '../../clients/events.client';

import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse';
import { propagation, context, trace } from '@opentelemetry/api';
import { useOpenTelemetry } from '@envelop/opentelemetry';

import { tracer } from '@shared/monitoring/src/tracing';

const typesArray = loadFilesSync(join(__dirname, '../modules/**/*.graphql'));
const typeDefs = mergeTypeDefs(typesArray);
const schema = makeExecutableSchema({ typeDefs, resolvers });


export const yogaServer = createYoga({
  schema,
  plugins: [
    useOpenTelemetry({
      resolvers: false,
      variables: false,
      result: false,
    }, trace.getTracerProvider()),
    useGraphQLSSE({
      endpoint: '/graphql/stream'
    }),
  ],
  cors: false,
  graphiql: {
    subscriptionsProtocol: 'SSE'
  },
  logging: true,
  maskedErrors: false,
  context({ request }) {
    const traceparent = request.headers.get("traceparent");
      const tracestate = request.headers.get("tracestate");
      console.log('[GATEWAY TRACING] Headers from nginx:', {
        traceparent,
        tracestate,
        allHeaders: Object.fromEntries(request.headers.entries())
      });

      // Extract trace context from headers
      const headers: Record<string, string> = {};
      if (traceparent) headers.traceparent = traceparent;
      if (tracestate) headers.tracestate = tracestate;

      // Extract the parent context from headers
      const parentContext = propagation.extract(context.active(), headers);
      console.log('[GATEWAY TRACING] Extracted parent context:', parentContext);

      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.split(" ")[1] ?? null;

      let user: User | null = null;
      if (token) {
        const userData = extractFromToken(token);
        if (userData) {
          user = {
            id: userData.userId,
            wallet: userData.wallet
          };
        }
      }
      
      return {
        clients: {
          aiAssistantClient,
          authClient,
          testnetFaucetClient,
          rwaClient,
          filesClient,
          signersManagerClient,
          documentsClient,
          galleryClient,
          questionsClient,
          faqClient,
          blogClient,
          portfolioClient,
          companyClient,
          chartsClient,
          reactionsClient,
          loyaltyClient,
          daoClient
        },
        services: {
          cache: cacheService,
          ownership: ownershipService,
          parent: parentService
        },
        user,
        token,
        pubSub,
        // Add the extracted trace context for use in resolvers
        traceContext: parentContext,
      } as GraphQLContext;
  },
  landingPage: false,
  batching: true,
});

