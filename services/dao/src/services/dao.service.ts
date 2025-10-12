import { logger } from "@shared/monitoring/src/logger";
import { ProposalRepository } from "../repositories/proposal.repository";
import { StakingRepository } from "../repositories/staking.repository";
import { StakingHistoryRepository } from "../repositories/stakingHistory.repository";
import { TimelockTaskRepository } from "../repositories/timelockTask.repository";
import { TreasuryWithdrawRepository } from "../repositories/treasuryWithdraw.repository";
import { VoteRepository } from "../repositories/vote.repository";
import { Types, SortOrder } from "mongoose";
import { IProposalEntity } from "../models/entity/proposal.entity";
import { IVoteEntity } from "../models/entity/vote.entity";
import { IStakingHistoryEntity } from "../models/entity/stakingHistory.entity";
import { ITimelockTaskEntity } from "../models/entity/timelockTask.entity";
import { ITreasuryWithdrawEntity } from "../models/entity/treasuryWithdraw.entity";
import { IStakingEntity } from "../models/entity/staking.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class DaoService {
    constructor(
        private readonly proposalRepository: ProposalRepository,
        private readonly stakingRepository: StakingRepository,
        private readonly stakingHistoryRepository: StakingHistoryRepository,
        private readonly timelockTaskRepository: TimelockTaskRepository,
        private readonly treasuryWithdrawRepository: TreasuryWithdrawRepository,
        private readonly voteRepository: VoteRepository
    ) { }

    /**
     * Process Governance_ProposalCreated event
     */
    async processProposalCreated(event: {
        emittedFrom: string;
        proposalId: string;
        proposer: string;
        target: string;
        data: string;
        description: string;
        startTime: number;
        endTime: number;
        chainId: string;
        transactionHash: string;
        logIndex: number;
    }) {
        logger.info(`Processing proposal created: ${event.proposalId} by ${event.proposer}`);

        await this.proposalRepository.create({
            proposalId: event.proposalId,
            proposer: event.proposer,
            target: event.target,
            data: event.data,
            description: event.description,
            startTime: event.startTime,
            endTime: event.endTime,
            chainId: event.chainId,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex
        });
    }

    /**
     * Process Governance_ProposalExecuted event
     */
    async processProposalExecuted(event: {
        emittedFrom: string;
        proposalId: string;
        executor: string;
        chainId: string;
        transactionHash: string;
        logIndex: number;
    }) {
        logger.info(`Processing proposal executed: ${event.proposalId} by ${event.executor}`);

        await this.proposalRepository.updateState(event.proposalId, "executed");
    }

    /**
     * Process Governance_ProposalCancelled event
     */
    async processProposalCancelled(event: {
        emittedFrom: string;
        proposalId: string;
        canceller: string;
        chainId: string;
        transactionHash: string;
        logIndex: number;
    }) {
        logger.info(`Processing proposal cancelled: ${event.proposalId} by ${event.canceller}`);

        await this.proposalRepository.updateState(event.proposalId, "canceled");
    }

    /**
     * Process Governance_VoteCast event
     */
    async processVoteCast(event: {
        emittedFrom: string;
        proposalId: string;
        voter: string;
        support: boolean;
        weight: string;
        reason: string;
        chainId: string;
        transactionHash: string;
        logIndex: number;
        blockNumber: number;
    }) {
        logger.info(`Processing vote cast: ${event.proposalId} by ${event.voter}, support: ${event.support}`);

        await this.voteRepository.create({
            proposalId: event.proposalId,
            chainId: event.chainId,
            governanceAddress: event.emittedFrom,
            voterWallet: event.voter,
            support: event.support,
            weight: event.weight,
            reason: event.reason,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber
        });
    }

    /**
     * Process DaoStaking_TokensStaked event
     */
    async processTokensStaked(event: {
        emittedFrom: string;
        staker: string;
        amount: string;
        newVotingPower: string;
        chainId: string;
        transactionHash: string;
        logIndex: number;
    }) {
        logger.info(`Processing tokens staked: ${event.amount} by ${event.staker}`);

        // Add stake amount to user's total
        await this.stakingRepository.addStake(
            event.staker,
            event.chainId,
            event.amount,
            Math.floor(Date.now() / 1000)
        );

        // Record staking history
        await this.stakingHistoryRepository.create({
            staker: event.staker,
            amount: event.amount,
            operation: "staked",
            chainId: event.chainId,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex
        });
    }

    /**
     * Process DaoStaking_TokensUnstaked event
     */
    async processTokensUnstaked(event: {
        emittedFrom: string;
        staker: string;
        amount: string;
        newVotingPower: string;
        chainId: string;
        transactionHash: string;
        logIndex: number;
    }) {
        logger.info(`Processing tokens unstaked: ${event.amount} by ${event.staker}`);

        // Subtract stake amount from user's total
        await this.stakingRepository.subStake(
            event.staker,
            event.chainId,
            event.amount
        );

        // Record staking history
        await this.stakingHistoryRepository.create({
            staker: event.staker,
            amount: event.amount,
            operation: "unstaked",
            chainId: event.chainId,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex
        });
    }

    /**
     * Process Timelock_TransactionQueued event
     */
    async processTransactionQueued(event: {
        emittedFrom: string;
        txHash: string;
        target: string;
        data: string;
        eta: number;
        chainId: string;
        transactionHash: string;
        logIndex: number;
    }) {
        logger.info(`Processing transaction queued: ${event.txHash} for target ${event.target}`);

        await this.timelockTaskRepository.create({
            txHash: event.txHash,
            target: event.target,
            data: event.data,
            eta: event.eta,
            chainId: event.chainId
        });
    }

    /**
     * Process Timelock_TransactionExecuted event
     */
    async processTransactionExecuted(event: {
        emittedFrom: string;
        txHash: string;
        target: string;
        data: string;
        eta: number;
        chainId: string;
        transactionHash: string;
        logIndex: number;
    }) {
        logger.info(`Processing transaction executed: ${event.txHash}`);

        await this.timelockTaskRepository.updateExecuted(event.txHash, true);
    }

    /**
     * Process Timelock_TransactionCancelled event
     */
    async processTransactionCancelled(event: {
        emittedFrom: string;
        txHash: string;
        target: string;
        data: string;
        eta: number;
        chainId: string;
        transactionHash: string;
        logIndex: number;
    }) {
        logger.info(`Processing transaction cancelled: ${event.txHash}`);

        // For cancelled transactions, we might want to remove them or mark as cancelled
        // For now, we'll just log it since the entity doesn't have a cancelled state
    }

    /**
     * Process Treasury_Withdrawal event
     */
    async processTreasuryWithdrawal(event: {
        emittedFrom: string;
        to: string;
        token: string;
        amount: string;
        chainId: string;
        transactionHash: string;
        logIndex: number;
    }) {
        logger.info(`Processing treasury withdrawal: ${event.amount} ${event.token} to ${event.to}`);

        await this.treasuryWithdrawRepository.create({
            recipient: event.to,
            token: event.token,
            amount: event.amount,
            chainId: event.chainId,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex
        });
    }

    // Mapping methods
    private mapProposal(proposal: IProposalEntity) {
        return {
            id: proposal._id.toString(),
            proposalId: proposal.proposalId,
            proposer: proposal.proposer,
            target: proposal.target,
            data: proposal.data,
            description: proposal.description,
            startTime: proposal.startTime,
            endTime: proposal.endTime,
            state: proposal.state ?? undefined,
            chainId: proposal.chainId,
            transactionHash: proposal.transactionHash,
            logIndex: proposal.logIndex,
            createdAt: proposal.createdAt,
            updatedAt: proposal.updatedAt
        };
    }

    private mapVote(vote: IVoteEntity) {
        return {
            id: vote._id.toString(),
            proposalId: vote.proposalId,
            chainId: vote.chainId,
            governanceAddress: vote.governanceAddress,
            voterWallet: vote.voterWallet,
            support: vote.support,
            weight: vote.weight.toString(),
            reason: vote.reason,
            transactionHash: vote.transactionHash,
            logIndex: vote.logIndex,
            blockNumber: vote.blockNumber,
            createdAt: vote.createdAt,
            updatedAt: vote.updatedAt
        };
    }

    private mapStakingHistory(stakingHistory: IStakingHistoryEntity) {
        return {
            id: stakingHistory._id.toString(),
            staker: stakingHistory.staker,
            amount: stakingHistory.amount.toString(),
            operation: stakingHistory.operation,
            chainId: stakingHistory.chainId,
            transactionHash: stakingHistory.transactionHash,
            logIndex: stakingHistory.logIndex,
            createdAt: stakingHistory.createdAt,
            updatedAt: stakingHistory.updatedAt
        };
    }

    private mapTimelockTask(timelockTask: ITimelockTaskEntity) {
        return {
            id: timelockTask._id.toString(),
            txHash: timelockTask.txHash,
            target: timelockTask.target,
            data: timelockTask.data,
            eta: timelockTask.eta,
            executed: timelockTask.executed,
            chainId: timelockTask.chainId,
            createdAt: timelockTask.createdAt,
            updatedAt: timelockTask.updatedAt
        };
    }

    private mapTreasuryWithdraw(treasuryWithdraw: ITreasuryWithdrawEntity) {
        return {
            id: treasuryWithdraw._id.toString(),
            recipient: treasuryWithdraw.recipient,
            token: treasuryWithdraw.token,
            amount: treasuryWithdraw.amount.toString(),
            chainId: treasuryWithdraw.chainId,
            transactionHash: treasuryWithdraw.transactionHash,
            logIndex: treasuryWithdraw.logIndex,
            createdAt: treasuryWithdraw.createdAt,
            updatedAt: treasuryWithdraw.updatedAt
        };
    }

    private mapStaking(staking: IStakingEntity) {
        return {
            id: staking._id.toString(),
            staker: staking.staker,
            amount: staking.amount.toString(),
            lastStakeTimestamp: staking.lastStakeTimestamp,
            chainId: staking.chainId,
            createdAt: staking.createdAt,
            updatedAt: staking.updatedAt
        };
    }

    /**
     * Get all proposals with pagination
     */
    async getProposals(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting proposals list", params);
        
        const proposals = await this.proposalRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return proposals.map(proposal => this.mapProposal(proposal));
    }

    /**
     * Get all votes
     */
    async getVotes(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting votes list", params);
        
        const votes = await this.voteRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return votes.map(vote => this.mapVote(vote));
    }

    /**
     * Get staking history 
     */
    async getStakingHistory(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting staking history list", params);
        
        const stakingHistory = await this.stakingHistoryRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return stakingHistory.map(history => this.mapStakingHistory(history));
    }


    /**
     * Get timelock tasks
     */
    async getTimelockTasks(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting timelock tasks list", params);
        
        const timelockTasks = await this.timelockTaskRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return timelockTasks.map(task => this.mapTimelockTask(task));
    }

    /**
     * Get treasury withdrawals
     */
    async getTreasuryWithdrawals(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting treasury withdrawals list", params);
        
        const treasuryWithdrawals = await this.treasuryWithdrawRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return treasuryWithdrawals.map(withdrawal => this.mapTreasuryWithdraw(withdrawal));
    }

    /**
     * Get staking records
     */
    async getStaking(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting staking records list", params);
        
        const stakingRecords = await this.stakingRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return stakingRecords.map(staking => this.mapStaking(staking));
    }
}