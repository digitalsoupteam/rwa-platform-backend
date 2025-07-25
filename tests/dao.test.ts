import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider, ContractFactory } from "ethers";
import { TESTNET_RPC, PLATFORM_TOKEN_ADDRESS, DAO_STAKING_ADDRESS, GOVERNANCE_ADDRESS } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import { requestGas } from "./utils/requestTokens";
import {
  GET_PROPOSALS,
  GET_STAKING,
  GET_STAKING_HISTORY,
  GET_TIMELOCK_TASKS,
  GET_TREASURY_WITHDRAWS,
  GET_VOTES,
} from "./utils/graphql/schema/dao";

// ABIs based on the provided contracts
const PlatformTokenABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) public returns (bool)"
];

const DaoStakingABI = [
  "function stake(uint256 amount) external",
  "function unstake(uint256 amount) external",
  "function getVotingPower(address user) view returns (uint256)"
];

const GovernanceABI = [
  "function propose(address target, bytes memory data, string memory description) external returns (uint256 proposalId)",
  "function vote(uint256 proposalId, bool support, string memory reason) external"
];

describe("DAO Flow", () => {
    let chainId: string;
    let provider: JsonRpcProvider;
    let deployer: HDNodeWallet;
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
        deployer = ethers.Wallet.createRandom().connect(provider);
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
        
        // Distribute Platform Tokens to users for staking
        // This would typically be done by a deployer/minter role
        // For this test, we assume user1 has tokens and sends them to user2
        const tokenDeployerSigner = new ethers.Contract(PLATFORM_TOKEN_ADDRESS, PlatformTokenABI, deployer);
        // Assuming deployer has initial supply
        await (await tokenDeployerSigner.transfer(user1.address, ethers.parseEther("2000"))).wait();
        await (await tokenDeployerSigner.transfer(user2.address, ethers.parseEther("1000"))).wait();

        // User 1 stakes 2000 tokens
        const user1Staking = new ethers.Contract(DAO_STAKING_ADDRESS, DaoStakingABI, user1);
        const user1Token = new ethers.Contract(PLATFORM_TOKEN_ADDRESS, PlatformTokenABI, user1);
        await (await user1Token.approve(DAO_STAKING_ADDRESS, ethers.parseEther("2000"))).wait();
        await (await user1Staking.stake(ethers.parseEther("2000"))).wait();

        // User 2 stakes 1000 tokens
        const user2Staking = new ethers.Contract(DAO_STAKING_ADDRESS, DaoStakingABI, user2);
        const user2Token = new ethers.Contract(PLATFORM_TOKEN_ADDRESS, PlatformTokenABI, user2);
        await (await user2Token.approve(DAO_STAKING_ADDRESS, ethers.parseEther("1000"))).wait();
        await (await user2Staking.stake(ethers.parseEther("1000"))).wait();

        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait for events to be indexed

        // User 1 creates a proposal
        const user1Governance = new ethers.Contract(GOVERNANCE_ADDRESS, GovernanceABI, user1);
        const proposeTx = await user1Governance.propose(ethers.ZeroAddress, "0x", "Test Proposal");
        const receipt = await proposeTx.wait();
        
        // This is a naive way to get proposalId, proper way is to parse logs
        proposalId = "1"; 

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

        expect(user1Stake.amount).toBe(ethers.parseEther("2000").toString());
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
        expect(vote1.weight).toBe(ethers.parseEther("2000").toString());
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
});