import { Elysia } from 'elysia';
import { yoga } from '@elysiajs/graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { join } from 'path';
import { logger } from '@shared/monitoring/src/logger';
import { resolvers } from '../graphql/modules';
import { extractFromToken } from '../utils/jwt.utils';
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
  chartsClient
} from '../clients/eden.clients';
import type { GraphQLContext, User } from '../graphql/context/types';
import { cacheService, ownershipService, parentService } from '../services/services.init';

// Load schema only once at startup
const typesArray = loadFilesSync(join(__dirname, '../graphql/modules/**/*.graphql'));
const typeDefs = mergeTypeDefs(typesArray);
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create GraphQL controller with optimized settings
export const GraphQLController = new Elysia()
  .use(yoga({
    maskedErrors: false,
    schema,
    context({ request }) {
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
          chartsClient
        },
        services: {
          cache: cacheService,
          ownership: ownershipService,
          parent: parentService
        },
        user,
        token,
      } as GraphQLContext;
    },
    graphiql: true,
    landingPage: false,
    // Performance optimizations
    batching: true,
  }));
