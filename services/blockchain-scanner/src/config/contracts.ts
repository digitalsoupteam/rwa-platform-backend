import { Contract } from 'ethers';

export interface ContractConfig {
  address: string;
  abi: any[];
  events: string[];
  startBlock?: number;
}

export const contracts: Record<string, ContractConfig> = {
  TokenContract: {
    address: '0x...',
    abi: [],
    events: ['Transfer', 'Approval'],
    startBlock: 1000000
  },
};