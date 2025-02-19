/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_URL: string;
  readonly VITE_CHAIN_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@apollo/client' {
  export interface DefaultContext {
    headers?: Record<string, string>;
  }

  export interface MutationFunctionOptions<TData = any, TVariables = OperationVariables> {
    variables?: TVariables;
    optimisticResponse?: TData;
    refetchQueries?: Array<string | PureQueryOptions>;
    awaitRefetchQueries?: boolean;
    update?: MutationUpdaterFn<TData>;
    context?: DefaultContext;
    onCompleted?: (data: TData) => void;
    onError?: (error: ApolloError) => void;
  }
}

declare module 'wagmi' {
  interface Chain {
    id: number;
    name: string;
    network: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    rpcUrls: {
      default: string;
      public: string;
    };
    blockExplorers: {
      default: { name: string; url: string };
    };
    testnet: boolean;
  }
}
