import { Elysia } from 'elysia';
import { yogaServer } from '../graphql/server';


export const GraphQLController = new Elysia()
  .all('/graphql', (context) => yogaServer.handle(context.request))
  .all('/graphql/stream', (context) => yogaServer.handle(context.request));
