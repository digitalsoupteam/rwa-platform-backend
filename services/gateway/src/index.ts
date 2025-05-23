import { Elysia } from 'elysia';
import { createSchema, createYoga } from 'graphql-yoga';
import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse';
import { setTimeout as setTimeout$ } from 'node:timers/promises';
import { yogaServer } from './graphql/server';


// const yogaServer = createYoga({
//   schema: createSchema({
//     typeDefs: `
//       type Query {
//         hello: String
//       }

//       type Subscription {
//         countdown(from: Int!): Int!
//       }
//     `,
//     resolvers: {
//       Query: {
//         hello: () => 'world'
//       },
//       Subscription: {
//         countdown: {
//           // @ts-ignore
//           subscribe: async function* (_, { from }) {
//             for (let i = from; i >= 0; i--) {
//               await setTimeout$(1000)
//               yield { countdown: i }
//             }
//           }
//         }
//       }
//     }
//   }),
//   plugins: [
//     useGraphQLSSE({
//       endpoint: '/graphql/stream'
//     })
//   ],
//   graphiql: {
//     subscriptionsProtocol: 'SSE'
//   }
// });
import { cors } from '@elysiajs/cors'

const app = new Elysia({
  serve: {
    idleTimeout: 30
  }
})
  .all('/graphql', (context) => yogaServer.handle(context.request))
  .all('/graphql/stream', (context) => yogaServer.handle(context.request))
  .listen(3000);

console.info('Server is running on http://localhost:3000/graphql');