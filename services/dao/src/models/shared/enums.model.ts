import { t } from 'elysia';

/*
 * Proposal state enum
 */
export const ProposalStateList = ['pending', 'executed', 'canceled'] as const;

export const proposalStateSchema = t.Union([t.Literal('pending'), t.Literal('executed'), t.Literal('canceled')]);

export type ProposalState = typeof proposalStateSchema.static;

/*
 * Staking operation enum
 */
export const StakingOperationList = ['staked', 'unstaked'] as const;

export const stakingOperationSchema = t.Union([t.Literal('staked'), t.Literal('unstaked')]);

export type StakingOperation = typeof stakingOperationSchema.static;
