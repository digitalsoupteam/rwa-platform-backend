import { logger } from "@shared/monitoring/src/logger";
import { FeesRepository } from "../repositories/fees.repository";
import { ReferralRepository } from "../repositories/referral.repository";
import { SortOrder, Types } from "mongoose";
import mongoose from "mongoose";
import { IReferralEntity } from "../models/entity/referral.entity";
import { IFeesEntity } from "../models/entity/fees.entity";
import { SignersManagerClient } from "../clients/eden.clients";
import { NotAllowedError } from "@shared/errors/app-errors";
import { ethers } from "ethers";
import { ReferrerWithdrawRepository } from "../repositories/referrerWithdraw.repository";
import { ReferrerClaimHistoryRepository } from "../repositories/referrerClaimHistory.repository";
import { IReferrerWithdrawEntity } from "../models/entity/referrerWithdraw.entity";
import { IReferrerClaimHistoryEntity } from "../models/entity/referrerClaimHistory.entity";


export class LoyaltyService {
    constructor(
        private readonly feesRepository: FeesRepository,
        private readonly referralRepository: ReferralRepository,
        private readonly referrerWithdrawRepository: ReferrerWithdrawRepository,
        private readonly referrerClaimHistoryRepository: ReferrerClaimHistoryRepository,
        private readonly referralRewardPercentage: number,
        private readonly signersManagerClient: SignersManagerClient
    ) { }

    /**
     * Process Factory_CreateRWAFeeCollected event
     */
    async processCreateRWAFeeCollected(event: {
        emittedFrom: string;
        sender: string;
        amount: string;
        token: string;
        chainId: string;
        transactionHash: string;
        blockNumber: number;
    }) {
        logger.info(`Processing RWA creation fee collected: ${event.amount} for ${event.sender}`);

        await this.feesRepository.addTokenCreationCommission(
            event.sender,
            event.chainId,
            event.token,
            event.amount
        );

        // Process referral reward if user has referrer
        await this.processReferralReward(event.sender, event.chainId, event.token, event.amount);
    }

    /**
     * Process Factory_CreatePoolFeeCollected event
     */
    async processCreatePoolFeeCollected(event: {
        emittedFrom: string;
        sender: string;
        amount: string;
        token: string;
        chainId: string;
        transactionHash: string;
        blockNumber: number;
    }) {
        logger.info(`Processing pool creation fee collected: ${event.amount} for ${event.sender}`);

        await this.feesRepository.addPoolCreationCommission(
            event.sender,
            event.chainId,
            event.token,
            event.amount
        );

        // Process referral reward if user has referrer
        await this.processReferralReward(event.sender, event.chainId, event.token, event.amount);
    }

    /**
     * Process Pool_RwaMinted event (buy commission)
     */
    async processRwaMinted(event: {
        emittedFrom: string;
        minter: string;
        rwaAmountMinted: string;
        holdAmountPaid: string;
        feePaid: string;
        percentBefore: string;
        userPercent: string;
        targetReached: boolean;
        businessId: string;
        poolId: string;
        holdToken: string;
        chainId: string;
        transactionHash: string;
        blockNumber: number;
    }) {
        logger.info(`Processing RWA minted: ${event.feePaid} fee for ${event.minter}`);

        await this.feesRepository.addBuyCommission(
            event.minter,
            event.chainId,
            event.holdToken,
            event.feePaid
        );

        // Process referral reward if user has referrer
        await this.processReferralReward(event.minter, event.chainId, event.holdToken, event.feePaid);
    }

    /**
     * Process Pool_RwaBurned event (sell commission)
     */
    async processRwaBurned(event: {
        emittedFrom: string;
        burner: string;
        rwaAmountBurned: string;
        holdAmountReceived: string;
        bonusAmountReceived: string;
        holdFeePaid: string;
        bonusFeePaid: string;
        percentBefore: string;
        userPercent: string;
        targetReached: boolean;
        businessId: string;
        poolId: string;
        holdToken: string;
        chainId: string;
        transactionHash: string;
        blockNumber: number;
    }) {
        logger.info(`Processing RWA burned: ${event.holdFeePaid} + ${event.bonusFeePaid} fees for ${event.burner}`);

        // Total fee is hold fee + bonus fee using BigInt for precision
        const holdFee = BigInt(event.holdFeePaid);
        const bonusFee = BigInt(event.bonusFeePaid);
        const totalFee = (holdFee + bonusFee).toString();

        await this.feesRepository.addSellCommission(
            event.burner,
            event.chainId,
            event.holdToken,
            totalFee
        );

        // Process referral reward if user has referrer
        await this.processReferralReward(event.burner, event.chainId, event.holdToken, totalFee);
    }

    /**
     * Process ReferralTreasury_Withdrawn event
     */
    async processReferralTreasuryWithdrawn(event: {
        emittedFrom: string;
        referrer: string;
        token: string;
        amount: string;
        chainId: string;
        transactionHash: string;
        blockNumber: number;
    }) {
        logger.info(`Processing referral treasury withdrawn: ${event.amount} for referrer: ${event.referrer}`);

        // Add withdrawn amount to referrer's withdraw record
        await this.referrerWithdrawRepository.addWithdrawnAmount(
            event.referrer,
            event.chainId,
            event.token,
            event.amount
        );

        logger.debug(`Referrer ${event.referrer} withdrew ${event.amount} of token ${event.token} on chain ${event.chainId}`);
    }

    /**
     * Register referral relationship
     */
    async registerReferral(params: {userWallet: string, referrerWallet: string}) {
        logger.info(`Registering referral: ${params.userWallet} -> ${params.referrerWallet}`);

        // Validate that user is not trying to refer themselves
        if (params.userWallet.toLowerCase() === params.referrerWallet.toLowerCase()) {
            throw new Error("User cannot refer themselves");
        }

        // Check if user already has a referrer on this chain
        const existingReferral = await this.referralRepository.findByUserWallet(params.userWallet);
        if (existingReferral) {
            throw new Error("User already has a referrer on this chain");
        }

        const referral = await this.referralRepository.create(params);
        return this.mapReferral(referral);
    }

    /**
     * Process referral reward for a commission
     */
    private async processReferralReward(userWallet: string, chainId: string, tokenAddress: string, commissionAmount: string) {
        const referral = await this.referralRepository.findByUserWallet(userWallet);

        if (!referral ) {
            logger.debug(`No active referral found for user: ${userWallet}`);
            return;
        }

        // Calculate referral reward using BigInt for precision
        const commission = BigInt(commissionAmount);
        const rewardBasisPoints = BigInt(Math.floor(this.referralRewardPercentage * 10000));
        const rewardAmount = (commission * rewardBasisPoints / BigInt(10000)).toString();

        logger.info(`Processing referral reward: ${rewardAmount} for referrer: ${referral.referrerWallet}`);

        await this.feesRepository.addReferralReward(
            referral.referrerWallet,
            chainId,
            tokenAddress,
            rewardAmount
        );
    }

    /**
     * Transform fees entity to DTO
     */
    private mapFees(fees: IFeesEntity) {
        return {
            id: fees._id.toString(),
            userWallet: fees.userWallet,
            chainId: fees.chainId,
            tokenAddress: fees.tokenAddress,
            buyCommissionAmount: fees.buyCommissionAmount?.toString() || "0",
            sellCommissionAmount: fees.sellCommissionAmount?.toString() || "0",
            tokenCreationCommissionAmount: fees.tokenCreationCommissionAmount?.toString() || "0",
            poolCreationCommissionAmount: fees.poolCreationCommissionAmount?.toString() || "0",
            referralRewardAmount: fees.referralRewardAmount?.toString() || "0",
            buyCommissionCount: fees.buyCommissionCount || 0,
            sellCommissionCount: fees.sellCommissionCount || 0,
            tokenCreationCommissionCount: fees.tokenCreationCommissionCount || 0,
            poolCreationCommissionCount: fees.poolCreationCommissionCount || 0,
            referralRewardCount: fees.referralRewardCount || 0,
            createdAt: fees.createdAt,
            updatedAt: fees.updatedAt
        };
    }

    /**
     * Transform referral entity to DTO
     */
    private mapReferral(referral: IReferralEntity) {
        return {
            id: referral._id.toString(),
            userWallet: referral.userWallet,
            referrerWallet: referral.referrerWallet,
            createdAt: referral.createdAt,
            updatedAt: referral.updatedAt
        };
    }

    /**
     * Gets fees list with filters, pagination and sorting
     */
    async getFees(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting fees list", params);
        
        const fees = await this.feesRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        console.log(JSON.stringify(fees.map(fee => this.mapFees(fee)), null, 4))

        return fees.map(fee => this.mapFees(fee));
    }

    /**
     * Gets referrals list with filters, pagination and sorting
     */
    async getReferrals(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting referrals list", params);
        
        const referrals = await this.referralRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return referrals.map(referral => this.mapReferral(referral));
    }

    /**
     * Request signatures for claiming referral rewards
     */
    async createReferrerWithdrawTask(params: {
        referrerWallet: string;
        chainId: string;
        tokenAddress: string;
        amount: string;
    }) {
        logger.debug("Requesting claim signatures", params);

        const now = Math.floor(Date.now() / 1000);

        // Get current fees for this referrer and token
        const fees = await this.feesRepository.findAll({
            userWallet: params.referrerWallet,
            chainId: params.chainId,
            tokenAddress: params.tokenAddress
        });

        if (!fees.length) {
            throw new NotAllowedError("No referral rewards found for this token");
        }

        const totalReferralReward = fees[0].referralRewardAmount?.toString() || "0";

        // Get current withdraw record
        const withdrawRecord = await this.referrerWithdrawRepository.findByReferrerAndToken(
            params.referrerWallet,
            params.chainId,
            params.tokenAddress
        );

        const totalWithdrawn = withdrawRecord?.totalWithdrawnAmount?.toString() || "0";

        // Calculate available amount
        const availableAmount = (BigInt(totalReferralReward) - BigInt(totalWithdrawn)).toString();

        if (BigInt(availableAmount) <= 0) {
            throw new NotAllowedError("No rewards available for withdrawal");
        }

        // Check if requested amount exceeds available
        if (BigInt(params.amount) > BigInt(availableAmount)) {
            throw new NotAllowedError(`Requested amount exceeds available rewards. Available: ${availableAmount}`);
        }

        // Check cooldown period
        if (withdrawRecord?.taskCooldown && now < withdrawRecord.taskCooldown) {
            const remainingCooldown = withdrawRecord.taskCooldown - now;
            throw new NotAllowedError(`Cooldown period active. Try again in ${remainingCooldown} seconds`);
        }

        const expired = now + 600; // 10 minutes
        const cooldown = now + 3600; // 1 hour cooldown

        const messageHash = this.generateClaimMessageHash(
            params.chainId,
            params.referrerWallet,
            params.tokenAddress,
            params.amount
        );

        const taskResponse = await this.signersManagerClient.createSignatureTask.post({
            ownerId: params.referrerWallet,
            ownerType: "user",
            hash: messageHash,
            expired,
            requiredSignatures: 3
        });

        if (taskResponse.error) throw taskResponse.error;

        // Update withdraw record with new task info
        const withdraws = await this.referrerWithdrawRepository.createOrUpdate({
            referrerWallet: params.referrerWallet,
            chainId: params.chainId,
            tokenAddress: params.tokenAddress,
            totalWithdrawnAmount: withdrawRecord?.totalWithdrawnAmount || mongoose.Types.Decimal128.fromString("0"),
            taskId: taskResponse.data.id,
            taskExpiredAt: expired,
            taskCooldown: cooldown
        });

        return this.mapReferrerWithdraw(withdraws);
    }

    /**
     * Generate message hash for claim operation
     */
    private generateClaimMessageHash(
        chainId: string,
        referrerWallet: string,
        tokenAddress: string,
        amount: string
    ): string {
        const paramsHash = ethers.solidityPackedKeccak256(
            [
                "uint256",
                "string",
                "address",
                "address",
                "uint256"
            ],
            [
                BigInt(chainId),
                "claimReferralRewards",
                ethers.getAddress(referrerWallet),
                ethers.getAddress(tokenAddress),
                BigInt(amount)
            ]
        );

        return paramsHash;
    }

    /**
     * Gets referrer withdraws list with filters, pagination and sorting
     */
    async getReferrerWithdraws(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting referrer withdraws list", params);
        
        const withdraws = await this.referrerWithdrawRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return withdraws.map(withdraw => this.mapReferrerWithdraw(withdraw));
    }

    /**
     * Gets referrer claim history list with filters, pagination and sorting
     */
    async getReferrerClaimHistory(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        logger.debug("Getting referrer claim history list", params);
        
        const claims = await this.referrerClaimHistoryRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return claims.map(claim => this.mapReferrerClaimHistory(claim));
    }

    /**
     * Transform referrer withdraw entity to DTO
     */
    private mapReferrerWithdraw(withdraw: IReferrerWithdrawEntity) {
        return {
            id: withdraw._id.toString(),
            referrerWallet: withdraw.referrerWallet,
            chainId: withdraw.chainId,
            tokenAddress: withdraw.tokenAddress,
            totalWithdrawnAmount: withdraw.totalWithdrawnAmount?.toString() || "0",
            taskId: withdraw.taskId ?? undefined,
            taskExpiredAt: withdraw.taskExpiredAt ?? undefined,
            taskCooldown: withdraw.taskCooldown ?? undefined,
            createdAt: withdraw.createdAt,
            updatedAt: withdraw.updatedAt
        };
    }

    /**
     * Transform referrer claim history entity to DTO
     */
    private mapReferrerClaimHistory(claim: IReferrerClaimHistoryEntity) {
        return {
            id: claim._id.toString(),
            referrerWallet: claim.referrerWallet,
            referralWallet: claim.referralWallet,
            chainId: claim.chainId,
            tokenAddress: claim.tokenAddress,
            amount: claim.amount?.toString() || "0",
            transactionHash: claim.transactionHash,
            logIndex: claim.logIndex,
            blockNumber: claim.blockNumber,
            createdAt: claim.createdAt,
            updatedAt: claim.updatedAt
        };
    }
}