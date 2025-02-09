export interface ModuleConfig {
    ethereum: {
      rpcUrl: string;
      networkId: number;
      confirmations: number;
    };
    sync: {
      batchSize: number;
      maxRetries: number;
      retryDelay: number;
    };
    mongodb: {
      uri: string;
      collection: string;
    };
    rabbitmq: {
      url: string;
      exchange: string;
    };
  }
  
  export interface BlockchainEvent {
    address: string;
    topics: string[];
    data: string;
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
  }
  
  export interface SyncState {
    _id: string;
    blockNumber: number;
    lastUpdate: Date;
  }
  
  export interface IEventHandler {
    handle(event: BlockchainEvent): Promise<void>;
  }