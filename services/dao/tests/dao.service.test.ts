/**
 * Unit tests for DaoService.
 *
 * Scope: the service layer only. Repositories are replaced with in-memory
 * fakes (tests/fakes/*.fake.ts), so these tests need no database, no broker
 * and no network. Run with `bun test` from services/dao.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';
import { DaoService } from '../src/services/dao.service';
import type { ProposalRepository } from '../src/repositories/proposal.repository';
import type { StakingRepository } from '../src/repositories/staking.repository';
import type { StakingHistoryRepository } from '../src/repositories/stakingHistory.repository';
import type { TimelockTaskRepository } from '../src/repositories/timelockTask.repository';
import type { TreasuryWithdrawRepository } from '../src/repositories/treasuryWithdraw.repository';
import type { VoteRepository } from '../src/repositories/vote.repository';
import {
  createFakeProposalRepository,
  type FakeProposalDoc,
  type FakeProposalRepository,
} from './fakes/proposal.repository.fake';
import { createFakeVoteRepository, type FakeVoteRepository } from './fakes/vote.repository.fake';
import { createFakeStakingRepository, type FakeStakingRepository } from './fakes/staking.repository.fake';
import {
  createFakeStakingHistoryRepository,
  type FakeStakingHistoryRepository,
} from './fakes/stakingHistory.repository.fake';
import {
  createFakeTimelockTaskRepository,
  type FakeTimelockTaskRepository,
} from './fakes/timelockTask.repository.fake';
import {
  createFakeTreasuryWithdrawRepository,
  type FakeTreasuryWithdrawRepository,
} from './fakes/treasuryWithdraw.repository.fake';

const PROPOSAL = {
  proposalId: '7',
  proposer: '0xAlice',
  target: '0xTreasury',
  data: '0xdeadbeef',
  description: 'Raise the staking cap',
  startTime: 1_700_000_000,
  endTime: 1_700_086_400,
  chainId: '1',
  transactionHash: '0xtx1',
  logIndex: 4,
};

const PROPOSAL_CREATED_EVENT = {
  emittedFrom: '0xGovernance',
  proposalId: '7',
  proposer: '0xAlice',
  target: '0xTreasury',
  data: '0xdeadbeef',
  description: 'Raise the staking cap',
  startTime: 1_700_000_000,
  endTime: 1_700_086_400,
  chainId: '1',
  transactionHash: '0xtx1',
  logIndex: 4,
};

const STAKING_EVENT = {
  emittedFrom: '0xStaking',
  staker: '0xBob',
  amount: '250',
  newVotingPower: '250',
  chainId: '1',
  transactionHash: '0xtx4',
  logIndex: 1,
};

const TIMELOCK_EVENT = {
  emittedFrom: '0xTimelock',
  txHash: '0xtimelock1',
  target: '0xTreasury',
  data: '0xdeadbeef',
  eta: 1_700_090_000,
  chainId: '1',
  transactionHash: '0xtx6',
  logIndex: 3,
};

describe('DaoService (unit, fake repositories)', () => {
  let proposals: FakeProposalRepository;
  let votes: FakeVoteRepository;
  let staking: FakeStakingRepository;
  let stakingHistory: FakeStakingHistoryRepository;
  let timelockTasks: FakeTimelockTaskRepository;
  let treasuryWithdrawals: FakeTreasuryWithdrawRepository;
  let service: DaoService;

  beforeEach(() => {
    proposals = createFakeProposalRepository();
    votes = createFakeVoteRepository();
    staking = createFakeStakingRepository();
    stakingHistory = createFakeStakingHistoryRepository();
    timelockTasks = createFakeTimelockTaskRepository();
    treasuryWithdrawals = createFakeTreasuryWithdrawRepository();
    service = new DaoService(
      proposals as unknown as ProposalRepository,
      staking as unknown as StakingRepository,
      stakingHistory as unknown as StakingHistoryRepository,
      timelockTasks as unknown as TimelockTaskRepository,
      treasuryWithdrawals as unknown as TreasuryWithdrawRepository,
      votes as unknown as VoteRepository,
    );
  });

  test('processProposalCreated: forwards the payload and stores a pending proposal', async () => {
    await expect(service.processProposalCreated(PROPOSAL_CREATED_EVENT)).resolves.toBeUndefined();

    expect(proposals.create).toHaveBeenCalledTimes(1);
    expect(proposals.create).toHaveBeenCalledWith({
      proposalId: '7',
      proposer: '0xAlice',
      target: '0xTreasury',
      data: '0xdeadbeef',
      description: 'Raise the staking cap',
      startTime: 1_700_000_000,
      endTime: 1_700_086_400,
      chainId: '1',
      transactionHash: '0xtx1',
      logIndex: 4,
    });

    // emittedFrom is event metadata: it is not stored on the proposal document.
    const stored = Array.from(proposals.store.values());
    expect(stored).toHaveLength(1);
    expect(stored[0].state).toBe('pending'); // schema default, same as ProposalEntity
  });

  test('processProposalExecuted: marks the proposal executed', async () => {
    await service.processProposalCreated(PROPOSAL_CREATED_EVENT);

    await expect(
      service.processProposalExecuted({
        emittedFrom: '0xGovernance',
        proposalId: '7',
        executor: '0xAlice',
        chainId: '1',
        transactionHash: '0xtx2',
        logIndex: 1,
      }),
    ).resolves.toBeUndefined();

    expect(proposals.updateState).toHaveBeenCalledTimes(1);
    expect(proposals.updateState).toHaveBeenCalledWith('7', 'executed');
    expect(Array.from(proposals.store.values())[0].state).toBe('executed');
  });

  test('processProposalExecuted: an unknown proposal is ignored (current behavior)', async () => {
    // findOneAndUpdate without upsert resolves to null for an unknown proposalId;
    // the service ignores the return value, so nothing is thrown and nothing is written.
    await expect(
      service.processProposalExecuted({
        emittedFrom: '0xGovernance',
        proposalId: 'unknown',
        executor: '0xAlice',
        chainId: '1',
        transactionHash: '0xtx2',
        logIndex: 1,
      }),
    ).resolves.toBeUndefined();

    expect(proposals.updateState).toHaveBeenCalledWith('unknown', 'executed');
    expect(proposals.store.size).toBe(0);
  });

  test('processProposalCancelled: marks the proposal canceled', async () => {
    await service.processProposalCreated(PROPOSAL_CREATED_EVENT);

    await service.processProposalCancelled({
      emittedFrom: '0xGovernance',
      proposalId: '7',
      canceller: '0xAlice',
      chainId: '1',
      transactionHash: '0xtx3',
      logIndex: 2,
    });

    // 'canceled' (single l) is the value pinned in ProposalStateList.
    expect(proposals.updateState).toHaveBeenCalledWith('7', 'canceled');
    expect(Array.from(proposals.store.values())[0].state).toBe('canceled');
  });

  test('processVoteCast: stores the vote with governanceAddress mapped from emittedFrom', async () => {
    await expect(
      service.processVoteCast({
        emittedFrom: '0xGovernance',
        proposalId: '7',
        voter: '0xCarol',
        support: true,
        weight: '123.45',
        reason: 'Good proposal',
        chainId: '1',
        transactionHash: '0xtx3',
        logIndex: 0,
        blockNumber: 42,
      }),
    ).resolves.toBeUndefined();

    expect(votes.create).toHaveBeenCalledTimes(1);
    expect(votes.create).toHaveBeenCalledWith({
      proposalId: '7',
      chainId: '1',
      governanceAddress: '0xGovernance',
      voterWallet: '0xCarol',
      support: true,
      weight: '123.45',
      reason: 'Good proposal',
      transactionHash: '0xtx3',
      logIndex: 0,
      blockNumber: 42,
    });

    const [storedVote] = Array.from(votes.store.values());
    expect(storedVote.support).toBe(true);
    expect(storedVote.weight).toBe('123.45');
  });

  test('processTokensStaked: adds the stake and records the staking history', async () => {
    const before = Math.floor(Date.now() / 1000);

    await service.processTokensStaked(STAKING_EVENT);

    const after = Math.floor(Date.now() / 1000);

    expect(staking.addStake).toHaveBeenCalledTimes(1);
    const [staker, chainId, amount, lastStakeTimestamp] = staking.addStake.mock.calls[0];
    expect({ staker, chainId, amount }).toEqual({ staker: '0xBob', chainId: '1', amount: '250' });
    // The service stamps the write with the current time, not with the event timestamp.
    expect(lastStakeTimestamp).toBeGreaterThanOrEqual(before);
    expect(lastStakeTimestamp).toBeLessThanOrEqual(after);

    expect(stakingHistory.create).toHaveBeenCalledTimes(1);
    expect(stakingHistory.create).toHaveBeenCalledWith({
      staker: '0xBob',
      amount: '250',
      operation: 'staked',
      chainId: '1',
      transactionHash: '0xtx4',
      logIndex: 1,
    });

    // newVotingPower is part of the event but the service does not persist it.
    const stake = staking.store.get('0xBob|1');
    expect(stake?.amount).toBe('250');
    expect(stake).not.toHaveProperty('newVotingPower');
  });

  test('processTokensStaked: repeated stakes accumulate per staker and chain', async () => {
    await service.processTokensStaked({ ...STAKING_EVENT, amount: '100' });
    await service.processTokensStaked({ ...STAKING_EVENT, amount: '50.5', transactionHash: '0xtx5' });
    await service.processTokensStaked({ ...STAKING_EVENT, amount: '7', chainId: '137' });

    expect(staking.addStake).toHaveBeenCalledTimes(3);
    expect(staking.store.get('0xBob|1')?.amount).toBe('150.5');
    expect(staking.store.get('0xBob|137')?.amount).toBe('7');
  });

  test('processTokensUnstaked: subtracts the stake and records the staking history', async () => {
    await service.processTokensStaked({ ...STAKING_EVENT, amount: '100' });

    await service.processTokensUnstaked({ ...STAKING_EVENT, amount: '40', transactionHash: '0xtx5', logIndex: 2 });

    // The service forwards the raw decimal string; the sign is added inside the repository.
    expect(staking.subStake).toHaveBeenCalledTimes(1);
    expect(staking.subStake).toHaveBeenCalledWith('0xBob', '1', '40');
    expect(stakingHistory.create).toHaveBeenLastCalledWith({
      staker: '0xBob',
      amount: '40',
      operation: 'unstaked',
      chainId: '1',
      transactionHash: '0xtx5',
      logIndex: 2,
    });
    expect(staking.store.get('0xBob|1')?.amount).toBe('60');
  });

  test('processTransactionQueued: stores the timelock task as not executed', async () => {
    await expect(service.processTransactionQueued(TIMELOCK_EVENT)).resolves.toBeUndefined();

    expect(timelockTasks.create).toHaveBeenCalledTimes(1);
    // Only the task fields are persisted: the queuing transaction hash/logIndex
    // are not part of TimelockTaskEntity.
    expect(timelockTasks.create).toHaveBeenCalledWith({
      txHash: '0xtimelock1',
      target: '0xTreasury',
      data: '0xdeadbeef',
      eta: 1_700_090_000,
      chainId: '1',
    });

    const [storedTask] = Array.from(timelockTasks.store.values());
    expect(storedTask.executed).toBe(false);
  });

  test('processTransactionExecuted: flips executed on the queued task', async () => {
    const queued = await timelockTasks.create({
      txHash: '0xtimelock1',
      target: '0xTreasury',
      data: '0xdeadbeef',
      eta: 1_700_090_000,
      chainId: '1',
    });
    expect(queued.executed).toBe(false);

    await service.processTransactionExecuted({ ...TIMELOCK_EVENT, transactionHash: '0xtx7', logIndex: 5 });

    expect(timelockTasks.updateExecuted).toHaveBeenCalledTimes(1);
    expect(timelockTasks.updateExecuted).toHaveBeenCalledWith('0xtimelock1', true);
    expect(queued.executed).toBe(false); // the stored copy is replaced, not mutated
    expect(timelockTasks.store.get('0xtimelock1')?.executed).toBe(true);
  });

  test('processTransactionCancelled: performs no repository writes (current behavior)', async () => {
    // TimelockTaskEntity has no cancelled state: the handler only emits
    // span/log entries and leaves every repository untouched.
    await expect(service.processTransactionCancelled(TIMELOCK_EVENT)).resolves.toBeUndefined();

    expect(proposals.updateState).not.toHaveBeenCalled();
    expect(votes.create).not.toHaveBeenCalled();
    expect(staking.addStake).not.toHaveBeenCalled();
    expect(stakingHistory.create).not.toHaveBeenCalled();
    expect(timelockTasks.create).not.toHaveBeenCalled();
    expect(timelockTasks.updateExecuted).not.toHaveBeenCalled();
    expect(treasuryWithdrawals.create).not.toHaveBeenCalled();
  });

  test('processTreasuryWithdrawal: maps `to` to recipient and stores the withdrawal', async () => {
    await expect(
      service.processTreasuryWithdrawal({
        emittedFrom: '0xTreasury',
        to: '0xBob',
        token: '0xToken',
        amount: '500',
        chainId: '1',
        transactionHash: '0xtx8',
        logIndex: 5,
      }),
    ).resolves.toBeUndefined();

    expect(treasuryWithdrawals.create).toHaveBeenCalledTimes(1);
    expect(treasuryWithdrawals.create).toHaveBeenCalledWith({
      recipient: '0xBob',
      token: '0xToken',
      amount: '500',
      chainId: '1',
      transactionHash: '0xtx8',
      logIndex: 5,
    });
  });

  test('getProposals: forwards filter/sort/pagination and maps every proposal to plain JSON', async () => {
    const created = await proposals.create(PROPOSAL);
    await proposals.create({ ...PROPOSAL, proposalId: '8', chainId: '137', transactionHash: '0xtx9' });

    const result = await service.getProposals({ filter: { chainId: '1' }, sort: { createdAt: 'desc' }, limit: 10, offset: 0 });

    expect(proposals.findAll).toHaveBeenCalledWith({ chainId: '1' }, { createdAt: 'desc' }, 10, 0);
    expect(result).toHaveLength(1);

    const [proposal] = result;
    expect(proposal.id).toBe(created._id.toString());
    expect(proposal.id).toHaveLength(24); // Mongo ObjectId hex
    expect(proposal).toMatchObject({
      proposalId: '7',
      proposer: '0xAlice',
      target: '0xTreasury',
      state: 'pending',
      chainId: '1',
      logIndex: 4,
    });
    expect(proposal).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(proposal))).toEqual(proposal);
  });

  test('getProposals: passes undefined filter/sort/limit/offset through when omitted', async () => {
    const result = await service.getProposals({});

    expect(proposals.findAll).toHaveBeenCalledWith(undefined, undefined, undefined, undefined);
    expect(result).toEqual([]);
  });

  test('getProposals: a stored proposal without a state maps state to undefined', async () => {
    // mapProposal uses `proposal.state ?? undefined`; the entity default is
    // 'pending', so this branch only shows up for legacy documents.
    const id = new Types.ObjectId();
    const timestamp = Math.floor(Date.now() / 1000);
    proposals.store.set(id.toString(), {
      _id: id,
      ...PROPOSAL,
      state: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as unknown as FakeProposalDoc);

    const [proposal] = await service.getProposals({});

    expect(proposal.state).toBeUndefined();
  });

  test('getVotes: maps ids and weight to strings', async () => {
    const created = await votes.create({
      proposalId: '7',
      chainId: '1',
      governanceAddress: '0xGovernance',
      voterWallet: '0xCarol',
      support: true,
      weight: '123.45',
      reason: 'Good proposal',
      transactionHash: '0xtx3',
      logIndex: 0,
      blockNumber: 42,
    });

    const result = await service.getVotes({ filter: { proposalId: '7' } });

    expect(votes.findAll).toHaveBeenCalledWith({ proposalId: '7' }, undefined, undefined, undefined);
    expect(result).toHaveLength(1);

    const [vote] = result;
    expect(vote).toMatchObject({
      id: created._id.toString(),
      proposalId: '7',
      voterWallet: '0xCarol',
      support: true,
      weight: '123.45',
      blockNumber: 42,
    });
    expect(typeof vote.weight).toBe('string');
    expect(vote).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(vote))).toEqual(vote);
  });

  test('getStakingHistory: maps amount to a string and keeps the operation', async () => {
    const created = await stakingHistory.create({
      staker: '0xBob',
      amount: '75.5',
      operation: 'staked',
      chainId: '1',
      transactionHash: '0xtx10',
      logIndex: 0,
    });

    const result = await service.getStakingHistory({ filter: { staker: '0xBob' } });

    expect(stakingHistory.findAll).toHaveBeenCalledWith({ staker: '0xBob' }, undefined, undefined, undefined);
    expect(result).toHaveLength(1);

    const [history] = result;
    expect(history).toMatchObject({
      id: created._id.toString(),
      staker: '0xBob',
      amount: '75.5',
      operation: 'staked',
      chainId: '1',
      transactionHash: '0xtx10',
      logIndex: 0,
    });
    expect(typeof history.amount).toBe('string');
    expect(history).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(history))).toEqual(history);
  });

  test('getTimelockTasks: maps the executed flag and timestamps', async () => {
    const created = await timelockTasks.create({
      txHash: '0xtimelock1',
      target: '0xTreasury',
      data: '0xdeadbeef',
      eta: 1_700_090_000,
      chainId: '1',
    });

    const [task] = await service.getTimelockTasks({ filter: { chainId: '1' } });

    expect(task).toMatchObject({
      id: created._id.toString(),
      txHash: '0xtimelock1',
      target: '0xTreasury',
      data: '0xdeadbeef',
      eta: 1_700_090_000,
      executed: false,
      chainId: '1',
    });
    expect(task).not.toHaveProperty('_id');

    await timelockTasks.updateExecuted('0xtimelock1', true);

    const [executedTask] = await service.getTimelockTasks({});
    expect(executedTask.executed).toBe(true);
  });

  test('getTreasuryWithdrawals: maps recipient, token and amount', async () => {
    const created = await treasuryWithdrawals.create({
      recipient: '0xBob',
      token: '0xToken',
      amount: '500',
      chainId: '1',
      transactionHash: '0xtx8',
      logIndex: 5,
    });

    const result = await service.getTreasuryWithdrawals({ filter: { recipient: '0xBob' } });

    expect(result).toHaveLength(1);

    const [withdrawal] = result;
    expect(withdrawal).toMatchObject({
      id: created._id.toString(),
      recipient: '0xBob',
      token: '0xToken',
      amount: '500',
      chainId: '1',
      transactionHash: '0xtx8',
      logIndex: 5,
    });
    expect(typeof withdrawal.amount).toBe('string');
    expect(withdrawal).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(withdrawal))).toEqual(withdrawal);
  });

  test('getStaking: maps the aggregated amount and lastStakeTimestamp', async () => {
    await staking.addStake('0xBob', '1', '999.5', 1_700_000_000);

    const result = await service.getStaking({ filter: { staker: '0xBob' } });

    expect(staking.findAll).toHaveBeenCalledWith({ staker: '0xBob' }, undefined, undefined, undefined);
    expect(result).toHaveLength(1);

    const [record] = result;
    expect(record).toMatchObject({
      staker: '0xBob',
      amount: '999.5',
      lastStakeTimestamp: 1_700_000_000,
      chainId: '1',
    });
    expect(typeof record.amount).toBe('string');
    expect(record).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(record))).toEqual(record);
  });

  test('processProposalCreated: propagates an AppError thrown by the repository', async () => {
    proposals.create.mockImplementationOnce(async () => {
      throw new AppError({ message: 'Proposal 7 already exists', statusCode: 409, code: 'CONFLICT' });
    });

    await expect(service.processProposalCreated(PROPOSAL_CREATED_EVENT)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Proposal 7 already exists',
    });
  });

  test('getProposals: propagates an AppError thrown by the repository', async () => {
    proposals.findAll.mockImplementationOnce(async () => {
      throw new AppError({ message: 'Proposal collection unavailable', statusCode: 503, code: 'SERVICE_UNAVAILABLE' });
    });

    await expect(service.getProposals({})).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Proposal collection unavailable',
    });
  });
});
