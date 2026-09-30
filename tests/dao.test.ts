import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider, ContractFactory } from "ethers";
import { TESTNET_RPC, PLATFORM_TOKEN_ADDRESS, DAO_STAKING_ADDRESS, GOVERNANCE_ADDRESS, FAUCET_ADDRESS } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import { requestGas, requestPlatform } from "./utils/requestTokens";
import {
  GET_PROPOSALS,
  GET_STAKING,
  GET_STAKING_HISTORY,
  GET_TIMELOCK_TASKS,
  GET_TREASURY_WITHDRAWS,
  GET_VOTES,
} from "./utils/graphql/schema/dao";

/**
 * TEST STAND REQUIREMENTS:
 * - Raise the testnet-faucet platform-token request limit to ~10,000,000
 *   (env TESTNET_FAUCET_PLATFORM_TOKEN_AMOUNT). user1 requests 1,000,000 tokens
 *   because the live Governance proposalThreshold is 1,000,000; keep the faucet funded.
 * - "Return all" is at the bottom of this file (afterAll): it always returns the platform
 *   tokens to the faucet wallet, even if the test failed. NOTE: a stake that cast a vote
 *   is locked until the proposal endTime (~7 days, DaoStaking voting lock) and cannot be
 *   unstaked before that date.
 */

// ABIs based on the provided contracts
const PlatformTokenABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) public returns (bool)"
];

const DaoStakingABI = [
  "function stake(uint256 amount) external",
  "function unstake(uint256 amount) external",
  "function getVotingPower(address user) view returns (uint256)",
  "function votingLockTimestamp(address user) view returns (uint256)",
  "function stakedAmount(address user) view returns (uint256)"
];

const GovernanceABI = [
  "function propose(address target, bytes memory data, string memory description) external returns (uint256 proposalId)",
  "function vote(uint256 proposalId, bool support, string memory reason) external"
];

describe("DAO Flow", () => {
    let chainId: string;
    let provider: JsonRpcProvider;
    let user1: HDNodeWallet;
    let user2: HDNodeWallet;

    let accessTokenUser1: string;
    let accessTokenUser2: string;

    let platformToken: ethers.Contract;
    let daoStaking: ethers.Contract;
    let governance: ethers.Contract;

    let proposalId: string;

    beforeAll(async () => {
        chainId = "97";
        provider = new ethers.JsonRpcProvider(TESTNET_RPC);

        // Setup wallets
        user1 = ethers.Wallet.createRandom().connect(provider);
        user2 = ethers.Wallet.createRandom().connect(provider);

        // Authenticate users
        ({ accessToken: accessTokenUser1 } = await authenticate(user1));
        ({ accessToken: accessTokenUser2 } = await authenticate(user2));

        // Fund wallets with gas
        await requestGas(accessTokenUser1, 0.1);
        await requestGas(accessTokenUser2, 0.1);
        
        // NOTE: This test assumes contracts are pre-deployed and configured.
        // The addresses are imported from config.
        platformToken = new ethers.Contract(PLATFORM_TOKEN_ADDRESS, PlatformTokenABI, user1);
        daoStaking = new ethers.Contract(DAO_STAKING_ADDRESS, DaoStakingABI, user1);
        governance = new ethers.Contract(GOVERNANCE_ADDRESS, GovernanceABI, user1);
        
        // Fund users with platform tokens via the faucet (tokens land on each authenticated user's wallet)
        await requestPlatform(accessTokenUser1, 1000000); // live proposalThreshold is 1M
        await requestPlatform(accessTokenUser2, 1000);

        // User 1 stakes 1,000,000 tokens (>= live proposalThreshold, required to propose)
        const user1Staking = new ethers.Contract(DAO_STAKING_ADDRESS, DaoStakingABI, user1);
        const user1Token = new ethers.Contract(PLATFORM_TOKEN_ADDRESS, PlatformTokenABI, user1);
        await (await user1Token.approve(DAO_STAKING_ADDRESS, ethers.parseEther("1000000"))).wait();
        await (await user1Staking.stake(ethers.parseEther("1000000"))).wait();

        // User 2 stakes 1000 tokens
        const user2Staking = new ethers.Contract(DAO_STAKING_ADDRESS, DaoStakingABI, user2);
        const user2Token = new ethers.Contract(PLATFORM_TOKEN_ADDRESS, PlatformTokenABI, user2);
        await (await user2Token.approve(DAO_STAKING_ADDRESS, ethers.parseEther("1000"))).wait();
        await (await user2Staking.stake(ethers.parseEther("1000"))).wait();

        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait for events to be indexed

        // User 1 creates a proposal
        const user1Governance = new ethers.Contract(GOVERNANCE_ADDRESS, GovernanceABI, user1);
        // Non-zero target required ("Invalid target"); user1 is an EOA, so an auto-executed
        // target.call("0x") would be a harmless no-op
        const proposeTarget = user1.address;
        proposalId = (await user1Governance.propose.staticCall(proposeTarget, "0x", "Test Proposal")).toString();
        await (await user1Governance.propose(proposeTarget, "0x", "Test Proposal")).wait();

        await new Promise(resolve => setTimeout(resolve, 15000));

        // Users vote on the proposal
        await (await user1Governance.vote(proposalId, true, "I support this!")).wait();

        const user2Governance = new ethers.Contract(GOVERNANCE_ADDRESS, GovernanceABI, user2);
        await (await user2Governance.vote(proposalId, false, "I do not support this.")).wait();

        await new Promise(resolve => setTimeout(resolve, 15000));
    });

    test("should get staking records", async () => {
        const result = await makeGraphQLRequest(GET_STAKING, {
            input: { filter: { staker: { $in: [user1.address.toLowerCase(), user2.address.toLowerCase()] } } }
        }, accessTokenUser1);
        
        expect(result.errors).toBeUndefined();
        expect(result.data.getStaking).toBeArray();
        expect(result.data.getStaking.length).toBe(2);

        const user1Stake = result.data.getStaking.find((s:any) => s.staker === user1.address.toLowerCase());
        const user2Stake = result.data.getStaking.find((s:any) => s.staker === user2.address.toLowerCase());

        expect(user1Stake.amount).toBe(ethers.parseEther("1000000").toString());
        expect(user1Stake.chainId).toBe(chainId);
        expect(user2Stake.amount).toBe(ethers.parseEther("1000").toString());
        expect(user2Stake.chainId).toBe(chainId);
    });

    test("should get staking history", async () => {
        const result = await makeGraphQLRequest(GET_STAKING_HISTORY, {
            input: { filter: { staker: { $in: [user1.address.toLowerCase(), user2.address.toLowerCase()] } } }
        }, accessTokenUser1);

        expect(result.errors).toBeUndefined();
        expect(result.data.getStakingHistory).toBeArray();
        expect(result.data.getStakingHistory.length).toBe(2);
        expect(result.data.getStakingHistory.every((h: any) => h.operation === 'staked')).toBe(true);
        expect(result.data.getStakingHistory.every((h: any) => h.chainId === chainId)).toBe(true);
        expect(result.data.getStakingHistory.every((h: any) => typeof h.transactionHash === 'string')).toBe(true);
    });

    test("should get proposals", async () => {
        const result = await makeGraphQLRequest(GET_PROPOSALS, {
            input: { filter: { proposalId: { $eq: proposalId } } }
        }, accessTokenUser1);

        expect(result.errors).toBeUndefined();
        expect(result.data.getProposals).toBeArray();
        expect(result.data.getProposals.length).toBe(1);
        
        const proposal = result.data.getProposals[0];
        expect(proposal.proposalId).toBe(proposalId);
        expect(proposal.proposer.toLowerCase()).toBe(user1.address.toLowerCase());
        expect(proposal.description).toBe("Test Proposal");
        expect(proposal.state).toBeDefined();
        expect(proposal.chainId).toBe(chainId);
    });

    test("should get votes for the proposal", async () => {
        const result = await makeGraphQLRequest(GET_VOTES, {
            input: { filter: { proposalId: { $eq: proposalId } } }
        }, accessTokenUser1);

        expect(result.errors).toBeUndefined();
        expect(result.data.getVotes).toBeArray();
        expect(result.data.getVotes.length).toBe(2);

        const vote1 = result.data.getVotes.find((v: any) => v.voterWallet === user1.address.toLowerCase());
        const vote2 = result.data.getVotes.find((v: any) => v.voterWallet === user2.address.toLowerCase());

        expect(vote1.support).toBe(true);
        expect(vote1.weight).toBe(ethers.parseEther("1000000").toString());
        expect(vote1.reason).toBe("I support this!");
        expect(vote1.chainId).toBe(chainId);
        expect(vote1.governanceAddress.toLowerCase()).toBe(GOVERNANCE_ADDRESS.toLowerCase());
        expect(vote1.voterWallet.toLowerCase()).toBe(user1.address.toLowerCase());

        expect(vote2.support).toBe(false);
        expect(vote2.weight).toBe(ethers.parseEther("1000").toString());
        expect(vote2.reason).toBe("I do not support this.");
        expect(vote2.chainId).toBe(chainId);
        expect(vote2.governanceAddress.toLowerCase()).toBe(GOVERNANCE_ADDRESS.toLowerCase());
        expect(vote2.voterWallet.toLowerCase()).toBe(user2.address.toLowerCase());
    });
    
    test("should get empty array for timelock tasks", async () => {
        const result = await makeGraphQLRequest(GET_TIMELOCK_TASKS, {}, accessTokenUser1);
        expect(result.errors).toBeUndefined();
        expect(result.data.getTimelockTasks).toBeArray();
        expect(result.data.getTimelockTasks.length).toBe(0);
    });

    test("should get empty array for treasury withdraws", async () => {
        const result = await makeGraphQLRequest(GET_TREASURY_WITHDRAWS, {}, accessTokenUser1);
        expect(result.errors).toBeUndefined();
        expect(result.data.getTreasuryWithdraws).toBeArray();
        expect(result.data.getTreasuryWithdraws.length).toBe(0);
    });

    // «Return all»: всегда возвращает платформенные токены на кран — срабатывает и при упавшем тесте
    // (bun выполняет afterAll даже после падения beforeAll/тестов — проверено). Снимает стейк (если он
    // не залочен голосованием) и шлёт весь баланс кошелька на FAUCET_ADDRESS. Если по стейку голосовали —
    // он залочен до endTime предложения (~7 дней) и досрочно снять его нельзя: печатает дату разлока.
    async function returnAllTokensToFaucet() {
        for (const wallet of [user1, user2]) {
            try {
                const staking = new ethers.Contract(DAO_STAKING_ADDRESS, DaoStakingABI, wallet);
                const token = new ethers.Contract(PLATFORM_TOKEN_ADDRESS, PlatformTokenABI, wallet);

                const staked = await staking.stakedAmount(wallet.address);
                if (staked > BigInt(0)) {
                    const lockUntil = Number(await staking.votingLockTimestamp(wallet.address));
                    if (Date.now() / 1000 < lockUntil) {
                        console.log(`[return] ${wallet.address}: стейк залочен голосованием до ${new Date(lockUntil * 1000).toISOString()} — раньше снять нельзя`);
                        continue;
                    }
                    await (await staking.unstake(staked)).wait();
                }

                const balance = await token.balanceOf(wallet.address);
                if (balance > BigInt(0)) {
                    const tx = await token.transfer(FAUCET_ADDRESS, balance);
                    await tx.wait();
                    console.log(`[return] ${wallet.address}: вернул ${ethers.formatEther(balance)} токенов на кран ${FAUCET_ADDRESS} (${tx.hash})`);
                }
            } catch (error) {
                console.error(`[return] ${wallet.address}: не удалось вернуть:`, error instanceof Error ? error.message : error);
            }
        }
    }

    afterAll(returnAllTokensToFaucet);
});