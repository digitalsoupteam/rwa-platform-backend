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
  chartsClient
} from '../../clients/eden.clients';
import type { GraphQLContext, User } from '../context/types';
import { cacheService, ownershipService, parentService } from '../../services/services.init';
import { pubSub } from '../../clients/events.client';

import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse';


const typesArray = loadFilesSync(join(__dirname, '../modules/**/*.graphql'));
const typeDefs = mergeTypeDefs(typesArray);
const schema = makeExecutableSchema({ typeDefs, resolvers });


export const yogaServer = createYoga({
  schema,
    plugins: [
    useGraphQLSSE({
      endpoint: '/graphql/stream'
    })
  ], 
  cors: false,
  graphiql: {
    subscriptionsProtocol: 'SSE'
  },
  logging: true,
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
      pubSub,
    } as GraphQLContext;
  },
  landingPage: false,
  batching: true,
});
