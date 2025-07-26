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


interface NetworkConfig {
    chainId: string;
    name: string;
    referralTreasuryAddress: string;
}

export class LoyaltyService {
    constructor(
        private readonly feesRepository: FeesRepository,
        private readonly referralRepository: ReferralRepository,
        private readonly referrerWithdrawRepository: ReferrerWithdrawRepository,
        private readonly referrerClaimHistoryRepository: ReferrerClaimHistoryRepository,
        private readonly referralRewardPercentage: number,
        private readonly signersManagerClient: SignersManagerClient,
        private readonly supportedNetworks: NetworkConfig[]
    ) { }

    private isChainIdSupported(chainId: string): boolean {
        return this.supportedNetworks.some((network) => network.chainId === chainId);
    }
    
    private getNetworkConfig(chainId: string): NetworkConfig {
        const network = this.supportedNetworks.find((network) => network.chainId === chainId);
        if (!network) {
            throw new NotAllowedError(`Chain ID ${chainId} is not supported`);
        }
        return network;
    }

    /**
     * Process Factory_CreateRWAFeeCollected event
     */
    async processCreateRWAFeeCollected(event: {
        data: {
            sender: string;
            amount: string;
            token: string;
        },
        chainId: number;
    }) {
        const { sender, amount, token } = event.data;
        logger.info(`Processing RWA creation fee collected: ${amount} for ${sender}`);
        
        const userReferral = await this.referralRepository.findByUserWallet(sender.toLowerCase());
        if (!userReferral) {
            logger.warn(`User with wallet ${sender} not found. Skipping fee processing.`);
            return;
        }

        await this.feesRepository.addTokenCreationCommission(
            sender,
            userReferral.userId,
            String(event.chainId),
            token,
            amount
        );

        // Process referral reward if user has referrer
        await this.processReferralReward(sender, userReferral.userId, String(event.chainId), token, amount);
    }

    /**
     * Process Factory_CreatePoolFeeCollected event
     */
    async processCreatePoolFeeCollected(event: {
        data: {
            sender: string;
            amount: string;
            token: string;
        },
        chainId: number;
    }) {
        const { sender, amount, token } = event.data;
        logger.info(`Processing pool creation fee collected: ${amount} for ${sender}`);
        
        const userReferral = await this.referralRepository.findByUserWallet(sender.toLowerCase());
        if (!userReferral) {
            logger.warn(`User with wallet ${sender} not found. Skipping fee processing.`);
            return;
        }

        await this.feesRepository.addPoolCreationCommission(
            sender,
            userReferral.userId,
            String(event.chainId),
            token,
            amount
        );

        // Process referral reward if user has referrer
        await this.processReferralReward(sender, userReferral.userId, String(event.chainId), token, amount);
    }

    /**
     * Process Pool_RwaMinted event (buy commission)
     */
    async processRwaMinted(event: {
        data: {
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
        },
        chainId: number;
    }) {
        const { minter, feePaid, holdToken } = event.data;
        logger.info(`Processing RWA minted: ${feePaid} fee for ${minter}`);
        
        const userReferral = await this.referralRepository.findByUserWallet(minter.toLowerCase());
        if (!userReferral) {
            logger.warn(`User with wallet ${minter} not found. Skipping fee processing.`);
            return;
        }

        await this.feesRepository.addBuyCommission(
            minter,
            userReferral.userId,
            String(event.chainId),
            holdToken,
            feePaid
        );

        // Process referral reward if user has referrer
        await this.processReferralReward(minter, userReferral.userId, String(event.chainId), holdToken, feePaid);
    }

    /**
     * Process Pool_RwaBurned event (sell commission)
     */
    async processRwaBurned(event: {
        data: {
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
        },
        chainId: number;
    }) {
        const { burner, holdFeePaid, bonusFeePaid, holdToken } = event.data;
        logger.info(`Processing RWA burned: ${holdFeePaid} + ${bonusFeePaid} fees for ${burner}`);

        const userReferral = await this.referralRepository.findByUserWallet(burner.toLowerCase());
        if (!userReferral) {
            logger.warn(`User with wallet ${burner} not found. Skipping fee processing.`);
            return;
        }

        // Total fee is hold fee + bonus fee using BigInt for precision
        const holdFee = BigInt(holdFeePaid);
        const bonusFee = BigInt(bonusFeePaid);
        const totalFee = (holdFee + bonusFee).toString();

        await this.feesRepository.addSellCommission(
            burner,
            userReferral.userId,
            String(event.chainId),
            holdToken,
            totalFee
        );

        // Process referral reward if user has referrer
        await this.processReferralReward(burner, userReferral.userId, String(event.chainId), holdToken, totalFee);
    }

    /**
     * Process ReferralTreasury_Withdrawn event
     */
    async processReferralTreasuryWithdrawn(event: {
        data: {
            user: string;
            token: string;
            amount: string;
        },
        chainId: number;
    }) {
        const { user, token, amount } = event.data;
        logger.info(`Processing referral treasury withdrawn: ${amount} for user: ${user}`);
console.log('aw1')
        const referrerUser = await this.referralRepository.findByReferrerWallet(user.toLowerCase());
        
console.log('aw121', JSON.stringify(referrerUser, null, 4))
if (!referrerUser) {
            logger.warn(`Referrer with wallet ${user} not found. Skipping withdraw processing.`);
            return;
        }
console.log('aw12')
console.log(user, referrerUser.userId, String(event.chainId), token, amount)
        // Add withdrawn amount to referrer's withdraw record
        await this.referrerWithdrawRepository.addWithdrawnAmount(
            user,
            referrerUser.userId,
            String(event.chainId),
            token,
            amount
        );
console.log('aw13')
        logger.debug(`Referrer ${user} withdrew ${amount} of token ${token} on chain ${event.chainId}`);
    }

    /**
     * Register referral relationship
     */
    async registerReferral(params: { userWallet: string, userId: string, referrerWallet?: string, referrerId?: string }) {
        logger.info(`Registering referral for user: ${params.userId}`);

        // Check if user already has a referrer
        const existingReferral = await this.referralRepository.findByUserId(params.userId);
        if (existingReferral) {
            throw new Error("User already has a referrer");
        }

        // Validate that user is not trying to refer themselves
        if (params.referrerId && params.userId === params.referrerId) {
            throw new Error("User cannot refer themselves");
        }
        if (params.referrerWallet && params.userWallet.toLowerCase() === params.referrerWallet.toLowerCase()) {
            throw new Error("User cannot refer themselves");
        }

        const referral = await this.referralRepository.create({
            userWallet: params.userWallet,
            userId: params.userId,
            referrerWallet: params.referrerWallet,
            referrerId: params.referrerId
        });
        return this.mapReferral(referral);
    }

    /**
     * Process referral reward for a commission
     */
    private async processReferralReward(userWallet: string, userId: string, chainId: string, tokenAddress: string, commissionAmount: string) {
        const referral = await this.referralRepository.findByUserId(userId);
       
        if (!referral || !referral.referrerWallet || !referral.referrerId) {
            logger.debug(`No active referrer found for user: ${userId}`);
            return;
        }

        // Calculate referral reward using BigInt for precision
        const commission = BigInt(commissionAmount);
        const rewardBasisPoints = BigInt(Math.floor(this.referralRewardPercentage * 10000));
        const rewardAmount = (commission * rewardBasisPoints / BigInt(10000)).toString();

        logger.info(`Processing referral reward: ${rewardAmount} for referrer: ${referral.referrerWallet}`);

        await this.feesRepository.addReferralReward(
            referral.referrerWallet,
            referral.referrerId,
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
            userId: fees.userId,
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
            userId: referral.userId,
            referrerWallet: referral.referrerWallet,
            referrerId: referral.referrerId,
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
        referrerId: string;
        chainId: string;
        tokenAddress: string;
        amount: string;
    }) {
        logger.debug("Requesting claim signatures", params);

        if (!this.isChainIdSupported(params.chainId)) {
            throw new NotAllowedError(`Chain ID ${params.chainId} is not supported`);
        }

        const now = Math.floor(Date.now() / 1000);

        // Get current fees for this referrer and token
        const fees = await this.feesRepository.findAll({
            userWallet: params.referrerWallet,
            userId: params.referrerId,
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
            params.referrerId,
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

        const expired = now + 60 * 10; // 10 minutes
        const cooldown = now + 60 * 60 * 24 * 30; // 1 month

        const network = this.getNetworkConfig(params.chainId);

        const messageHash = this.generateWithdrawMessageHash(
            params.chainId,
            network.referralTreasuryAddress,
            params.referrerWallet,
            params.tokenAddress,
            params.amount
        );

        const taskResponse = await this.signersManagerClient.createSignatureTask.post({
            ownerId: params.referrerId,
            ownerType: "user",
            hash: messageHash,
            expired,
            requiredSignatures: 3
        });

        if (taskResponse.error) throw taskResponse.error;

        // Update withdraw record with new task info
        const withdraws = await this.referrerWithdrawRepository.createOrUpdate({
            referrerWallet: params.referrerWallet,
            referrerId: params.referrerId,
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
    private generateWithdrawMessageHash(
        chainId: string,
        referralTreasuryAddress: string,
        referrerWallet: string,
        tokenAddress: string,
        amount: string
    ): string {
        const innerHash = ethers.solidityPackedKeccak256(
            [
                "uint256",
                "address",
                "address",
                "string",
                "address",
                "uint256",
            ],
            [
                BigInt(chainId),
                ethers.getAddress(referralTreasuryAddress),
                ethers.getAddress(referrerWallet),
                "withdraw",
                ethers.getAddress(tokenAddress),
                BigInt(amount),
            ]
        );

        return innerHash;
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
            referrerId: withdraw.referrerId,
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
            referrerId: claim.referrerId,
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