import { Contract } from 'ethers';

export interface EventConfig {
  name: string;
  // Queue name for routing specific event messages
  queueName: string;
  // Custom parser for event data if needed
  parseData?: (log: any) => any;
}

export interface ContractConfig {
  address: string;
  abi: any[];
  // Map of event names to their specific configurations
  events: Record<string, EventConfig>;
  startBlock?: number;
}

// Example contract configurations
export const contracts: Record<string, ContractConfig> = {
  TokenContract: {
    address: '0x...',
    abi: [],
    events: {
      Transfer: {
        name: 'Transfer',
        queueName: 'token_transfers',
        parseData: (log: any) => ({
          from: log.args[0],
          to: log.args[1],
          amount: log.args[2].toString()
        })
      },
      Approval: {
        name: 'Approval',
        queueName: 'token_approvals',
        parseData: (log: any) => ({
          owner: log.args[0],
          spender: log.args[1],
          amount: log.args[2].toString()
        })
      }
    },
    startBlock: 1000000
  },
  // Add more contracts here
};

// Helper to get all unique queue names
export const getUniqueQueueNames = (): string[] => {
  const queueNames = new Set<string>();
  
  Object.values(contracts).forEach(contract => {
    Object.values(contract.events).forEach(event => {
      queueNames.add(event.queueName);
    });
  });
  
  return Array.from(queueNames);
};
