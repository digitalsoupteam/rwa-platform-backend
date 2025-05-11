import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'src/graphql/modules/**/*.graphql',
  generates: {
    './src/graphql/generated/types.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../context/types#GraphQLContext',
        scalars: {
          DateTime: 'Date',
          JSON: '{ [key: string]: any }',
        },
        namingConvention: {
          enumValues: 'keep',
        },
        maybeValue: 'T | undefined',
        useIndexSignature: true,
        enumsAsTypes: true,
        // avoidOptionals: true,
      },
    },
  },
};

export default config;