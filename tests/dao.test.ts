import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider, ContractFactory } from "ethers";
import { TESTNET_RPC, PLATFORM_TOKEN_ADDRESS, DAO_STAKING_ADDRESS, GOVERNANCE_ADDRESS, DEPLOYER_ADDRESS } from "./utils/config";
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

/**
 * TEST STAND REQUIREMENTS:
 * - Platform tokens for user1/user2/mass voters come from the stand deployer account
 *   (wired into the local `node` network via env keys). The test funds the deployer
 *   itself at start by writing 15M directly into the token's ERC-7201 balance slot
 *   (no mint — totalSupply stays 21M); no external bootstrap is needed. The faucet
 *   serves gas only.
 * - No cleanup by design: the test does NOT warp the chain clock and does NOT return
 *   tokens. Stakes stay in DaoStaking, voting-locked until the proposal endTime (~7 days).
 *   For a rerun, reset the stand: restart the node (the test re-funds the deployer).
 * - Mass voting: node accounts #1..#8 receive platform tokens from the stand deployer,
 *   stake them and vote FOR; the proposal auto-executes inside the 8th mass vote.
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
  "function vote(uint256 proposalId, bool support, string memory reason) external",
  "function proposals(uint256) view returns (address proposer, address target, bytes data, string description, uint256 votesFor, uint256 votesAgainst, uint256 creationTime, uint256 endTime, bool executed, bool cancelled)"
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
    let massVoters: ethers.JsonRpcSigner[] = [];

    beforeAll(async () => {
        chainId = "97";
        // cacheTimeout -1 disables the ethers 250ms request cache: it serves a stale nonce
        // when txs from the same wallet are sent back-to-back on an automine node.
        provider = new ethers.JsonRpcProvider(TESTNET_RPC, undefined, { cacheTimeout: -1 });

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
        
        // Fund users with platform tokens from the stand deployer account (wired into the
        // `node` network accounts via env keys; it holds the forked testnet token supply).
        // The faucet keeps serving gas requests only.
        const deployer = await provider.getSigner(DEPLOYER_ADDRESS);
        const deployerToken = new ethers.Contract(PLATFORM_TOKEN_ADDRESS, PlatformTokenABI, deployer);

        // Fund the deployer for the whole run by writing its PLATFORM balance directly
        // into the ERC-7201 namespaced ERC20 storage slot of the token (no mint and no
        // transfer — totalSupply stays 21M). The write overwrites any leftover balance
        // with an exact 15M, so reruns on the same node start clean. Slot math is
        // verified against the live balanceOf() before the write.
        const DEPLOYER_FUND_AMOUNT = ethers.parseEther("15000000");
        const erc7201Base = (namespace: string): bigint => {
            const inner = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256"],
                [BigInt(ethers.keccak256(ethers.toUtf8Bytes(namespace))) - 1n],
            );
            const hash = ethers.keccak256(inner).slice(2);
            return BigInt("0x" + hash.slice(0, 62) + "00");
        };
        const deployerBalanceSlot = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256"],
                [deployer.address, erc7201Base("openzeppelin.storage.ERC20")],
            ),
        );
        const liveDeployerBalance = await deployerToken.balanceOf(deployer.address);
        const rawSlotValue = BigInt(
            await provider.getStorage(PLATFORM_TOKEN_ADDRESS, deployerBalanceSlot),
        );
        if (rawSlotValue !== liveDeployerBalance) {
            throw new Error(
                `PLATFORM balance slot mismatch (slot=${rawSlotValue}, balanceOf=${liveDeployerBalance})`,
            );
        }
        await provider.send("hardhat_setStorageAt", [
            PLATFORM_TOKEN_ADDRESS,
            deployerBalanceSlot,
            "0x" + DEPLOYER_FUND_AMOUNT.toString(16).padStart(64, "0"),
        ]);
        const fundedDeployerBalance = await deployerToken.balanceOf(deployer.address);
        if (fundedDeployerBalance !== DEPLOYER_FUND_AMOUNT) {
            throw new Error(
                `deployer funding failed (got ${fundedDeployerBalance}, expected ${DEPLOYER_FUND_AMOUNT})`,
            );
        }
        console.log(`deployer funded: ${ethers.formatEther(fundedDeployerBalance)} PLATFORM`);

        await (await deployerToken.transfer(user1.address, ethers.parseEther("1000000"))).wait();

        await (await deployerToken.transfer(user2.address, ethers.parseEther("1000"))).wait();

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

        // Mass voting: reach the quorum — node accounts #1..#8 get 1M platform tokens
        // each from the same deployer, stake them and vote FOR; the proposal
        // auto-executes inside the 8th mass vote.
        const funderToken = deployerToken;
        for (let i = 1; i <= 8; i++) {
            const massSigner = await provider.getSigner(i);
            const massAddress = await massSigner.getAddress();
            massVoters.push(massSigner);

            await (await funderToken.transfer(massAddress, ethers.parseEther("1000000"))).wait();

            const massToken = new ethers.Contract(PLATFORM_TOKEN_ADDRESS, PlatformTokenABI, massSigner);
            await (await massToken.approve(DAO_STAKING_ADDRESS, ethers.parseEther("1000000"))).wait();

            const massStaking = new ethers.Contract(DAO_STAKING_ADDRESS, DaoStakingABI, massSigner);
            await (await massStaking.stake(ethers.parseEther("1000000"))).wait();

            const massGovernance = new ethers.Contract(GOVERNANCE_ADDRESS, GovernanceABI, massSigner);
            await (await massGovernance.vote(proposalId, true, `Mass support vote #${i}`)).wait();
        }

        await new Promise(resolve => setTimeout(resolve, 15000));
    }); // the full happy path (faucet + ~50 txs + indexing waits) needs minutes

    test("should get staking records", async () => {
        const massAddresses = await Promise.all(massVoters.map((voter) => voter.getAddress()));
        const allStakers = [user1.address, user2.address, ...massAddresses]; // dao stores checksummed addresses
        const result = await makeGraphQLRequest(GET_STAKING, {
            input: { filter: { staker: { $in: allStakers } } }
        }, accessTokenUser1);
        
        expect(result.errors).toBeUndefined();
        expect(result.data.getStaking).toBeArray();
        expect(result.data.getStaking.length).toBe(10);

        const user1Stake = result.data.getStaking.find((s:any) => s.staker.toLowerCase() === user1.address.toLowerCase());
        const user2Stake = result.data.getStaking.find((s:any) => s.staker.toLowerCase() === user2.address.toLowerCase());

        expect(user1Stake.amount).toBe(ethers.parseEther("1000000").toString());
        expect(user1Stake.chainId).toBe(chainId);
        expect(user2Stake.amount).toBe(ethers.parseEther("1000").toString());
        expect(user2Stake.chainId).toBe(chainId);

        for (const massAddress of massAddresses) {
            const massStake = result.data.getStaking.find((s:any) => s.staker.toLowerCase() === massAddress.toLowerCase());
            expect(massStake.amount).toBe(ethers.parseEther("1000000").toString());
            expect(massStake.chainId).toBe(chainId);
        }
    });

    test("should get staking history", async () => {
        const massAddresses = await Promise.all(massVoters.map((voter) => voter.getAddress()));
        const allStakers = [user1.address, user2.address, ...massAddresses]; // dao stores checksummed addresses
        const result = await makeGraphQLRequest(GET_STAKING_HISTORY, {
            input: { filter: { staker: { $in: allStakers } } }
        }, accessTokenUser1);

        expect(result.errors).toBeUndefined();
        expect(result.data.getStakingHistory).toBeArray();
        expect(result.data.getStakingHistory.length).toBe(10);
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
        expect(proposal.state).toBe("executed");
        expect(proposal.chainId).toBe(chainId);
    });

    test("should get votes for the proposal", async () => {
        const massAddresses = await Promise.all(massVoters.map((voter) => voter.getAddress()));
        const result = await makeGraphQLRequest(GET_VOTES, {
            input: { filter: { proposalId: { $eq: proposalId } } }
        }, accessTokenUser1);

        expect(result.errors).toBeUndefined();
        expect(result.data.getVotes).toBeArray();
        expect(result.data.getVotes.length).toBe(10);

        const vote1 = result.data.getVotes.find((v: any) => v.voterWallet.toLowerCase() === user1.address.toLowerCase());
        const vote2 = result.data.getVotes.find((v: any) => v.voterWallet.toLowerCase() === user2.address.toLowerCase());

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

        for (const massAddress of massAddresses) {
            const massVote = result.data.getVotes.find((v: any) => v.voterWallet.toLowerCase() === massAddress.toLowerCase());
            expect(massVote.support).toBe(true);
            expect(massVote.weight).toBe(ethers.parseEther("1000000").toString());
            expect(massVote.chainId).toBe(chainId);
        }
    });
    
    test("should reach the 40% quorum and auto-execute the proposal", async () => {
        const proposal = await governance.proposals(proposalId);

        // 40% of the 21M total supply = 8.4M; votesFor must clear the quorum
        expect(proposal.votesFor).toBeGreaterThanOrEqual(ethers.parseEther("8400000"));
        expect(proposal.votesFor).toBeGreaterThan(proposal.votesAgainst);
        expect(proposal.executed).toBe(true);
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