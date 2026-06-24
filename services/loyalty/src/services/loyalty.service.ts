import { MetricsDecorator } from "@shared/monitoring/src/metricsDecorator";
import { LogDecorator } from "@shared/monitoring/src/logDecorator";
import { FeesRepository } from "../repositories/fees.repository";
import { ReferralRepository } from "../repositories/referral.repository";
import type { SortOrder } from "mongoose";
import mongoose from "mongoose";
import type { IReferralEntity } from "../models/entity/referral.entity";
import type { IFeesEntity } from "../models/entity/fees.entity";
import type { SignersManagerClient } from "../clients/eden.clients";
import { AppError } from "@shared/errors/app-errors";
import { ethers } from "ethers";
import { ReferrerWithdrawRepository } from "../repositories/referrerWithdraw.repository";
import { ReferrerClaimHistoryRepository } from "../repositories/referrerClaimHistory.repository";
import { CommissionHistoryRepository } from "../repositories/commissionHistory.repository";
import type { IReferrerWithdrawEntity } from "../models/entity/referrerWithdraw.entity";
import type { IReferrerClaimHistoryEntity } from "../models/entity/referrerClaimHistory.entity";
import type { ICommissionHistoryEntity } from "../models/entity/commissionHistory.entity";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";
import { setSpanAttributes } from "@shared/monitoring/src/tracing";


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
        private readonly commissionHistoryRepository: CommissionHistoryRepository,
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
            throw new AppError({ message: `Chain ID ${chainId} is not supported`, statusCode: 403, code: 'NOT_ALLOWED' });
        }
        return network;
    }

    /**
     * Process Factory_CreateRWAFeeCollected event
     */
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['event'] })
    async processCreateRWAFeeCollected(event: {
        data: {
            sender: string;
            amount: string;
            token: string;
        },
        chainId: number;
        transactionHash: string;
    }) {
        setSpanAttributes({
            wallet: event.data.sender,
            transactionHash: event.transactionHash,
            chainId: String(event.chainId)
        });
        const { sender, amount, token } = event.data;
        
        const userReferral = await this.referralRepository.findByUserWallet(sender.toLowerCase());
        if (!userReferral) {
            return;
        }

        await this.feesRepository.addTokenCreationCommission(
            sender,
            userReferral.userId,
            String(event.chainId),
            token,
            amount
        );

        // Record commission history
        await this.commissionHistoryRepository.create({
            userWallet: sender,
            userId: userReferral.userId,
            chainId: String(event.chainId),
            tokenAddress: token,
            amount: amount,
            actionType: 'token_creation_commission',
            transactionHash: event.transactionHash,
            relatedUserWallet: undefined,
            relatedUserId: undefined
        });

        // Process referral reward if user has referrer
        await this.processReferralReward(sender, userReferral.userId, String(event.chainId), token, amount, event.transactionHash);
    }

    /**
     * Process Factory_CreatePoolFeeCollected event
     */
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['event'] })
    async processCreatePoolFeeCollected(event: {
        data: {
            sender: string;
            amount: string;
            token: string;
        },
        chainId: number;
        transactionHash: string;
    }) {
        setSpanAttributes({
            wallet: event.data.sender,
            transactionHash: event.transactionHash,
            chainId: String(event.chainId)
        });
        const { sender, amount, token } = event.data;
        
        const userReferral = await this.referralRepository.findByUserWallet(sender.toLowerCase());
        if (!userReferral) {
            return;
        }

        await this.feesRepository.addPoolCreationCommission(
            sender,
            userReferral.userId,
            String(event.chainId),
            token,
            amount
        );

        // Record commission history
        await this.commissionHistoryRepository.create({
            userWallet: sender,
            userId: userReferral.userId,
            chainId: String(event.chainId),
            tokenAddress: token,
            amount: amount,
            actionType: 'pool_creation_commission',
            transactionHash: event.transactionHash,
            relatedUserWallet: undefined,
            relatedUserId: undefined
        });

        // Process referral reward if user has referrer
        await this.processReferralReward(sender, userReferral.userId, String(event.chainId), token, amount, event.transactionHash);
    }

    /**
     * Process Pool_RwaMinted event (buy commission)
     */
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['event'] })
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
        transactionHash: string;
    }) {
        setSpanAttributes({
            wallet: event.data.minter,
            transactionHash: event.transactionHash,
            chainId: String(event.chainId)
        });
        const { minter, feePaid, holdToken } = event.data;
        
        const userReferral = await this.referralRepository.findByUserWallet(minter.toLowerCase());
        if (!userReferral) {
            return;
        }

        await this.feesRepository.addBuyCommission(
            minter,
            userReferral.userId,
            String(event.chainId),
            holdToken,
            feePaid
        );

        // Record commission history
        await this.commissionHistoryRepository.create({
            userWallet: minter,
            userId: userReferral.userId,
            chainId: String(event.chainId),
            tokenAddress: holdToken,
            amount: feePaid,
            actionType: 'buy_commission',
            transactionHash: event.transactionHash,
            relatedUserWallet: undefined,
            relatedUserId: undefined
        });

        // Process referral reward if user has referrer
        await this.processReferralReward(minter, userReferral.userId, String(event.chainId), holdToken, feePaid, event.transactionHash);
    }

    /**
     * Process Pool_RwaBurned event (sell commission)
     */
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['event'] })
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
        transactionHash: string;
    }) {
        setSpanAttributes({
            wallet: event.data.burner,
            transactionHash: event.transactionHash,
            chainId: String(event.chainId)
        });
        const { burner, holdFeePaid, bonusFeePaid, holdToken } = event.data;

        const userReferral = await this.referralRepository.findByUserWallet(burner.toLowerCase());
        if (!userReferral) {
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

        // Record commission history
        await this.commissionHistoryRepository.create({
            userWallet: burner,
            userId: userReferral.userId,
            chainId: String(event.chainId),
            tokenAddress: holdToken,
            amount: totalFee,
            actionType: 'sell_commission',
            transactionHash: event.transactionHash,
            relatedUserWallet: undefined,
            relatedUserId: undefined
        });

        // Process referral reward if user has referrer
        await this.processReferralReward(burner, userReferral.userId, String(event.chainId), holdToken, totalFee, event.transactionHash);
    }

    /**
     * Process ReferralTreasury_Withdrawn event
     */
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['event'] })
    async processReferralTreasuryWithdrawn(event: {
        data: {
            user: string;
            token: string;
            amount: string;
        },
        chainId: number;
    }) {
        setSpanAttributes({
            wallet: event.data.user,
            chainId: String(event.chainId)
        });
        const { user, token, amount } = event.data;
        const referrerUser = await this.referralRepository.findByReferrerWallet(user.toLowerCase());
        
        if (!referrerUser) {
            return;
        }

        // Add withdrawn amount to referrer's withdraw record
        await this.referrerWithdrawRepository.addWithdrawnAmount(
            user,
            referrerUser.userId,
            String(event.chainId),
            token,
            amount
        );
    }

    /**
     * Register referral relationship
     */
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['params'] })
    async registerReferral(params: { userWallet: string, userId: string, referrerWallet?: string, referrerId?: string }) {
        setSpanAttributes({
            wallet: params.userWallet,
            userId: params.userId
        });

        // Check if user already has a referrer
        const existingReferral = await this.referralRepository.findByUserId(params.userId);
        if (existingReferral) {
            throw new AppError({ message: "User already has a referrer", statusCode: 409, code: 'NOT_ALLOWED' });
        }

        // Validate that user is not trying to refer themselves
        if (params.referrerId && params.userId === params.referrerId) {
            throw new AppError({ message: "User cannot refer themselves", statusCode: 409, code: 'NOT_ALLOWED' });
        }
        if (params.referrerWallet && params.userWallet.toLowerCase() === params.referrerWallet.toLowerCase()) {
            throw new AppError({ message: "User cannot refer themselves", statusCode: 409, code: 'NOT_ALLOWED' });
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
    private async processReferralReward(userWallet: string, userId: string, chainId: string, tokenAddress: string, commissionAmount: string, transactionHash: string) {
        const referral = await this.referralRepository.findByUserId(userId);
       
        if (!referral || !referral.referrerWallet || !referral.referrerId) {
            return;
        }

        // Calculate referral reward using BigInt for precision
        const commission = BigInt(commissionAmount);
        const rewardBasisPoints = BigInt(Math.floor(this.referralRewardPercentage * 10000));
        const rewardAmount = (commission * rewardBasisPoints / BigInt(10000)).toString();

        await this.feesRepository.addReferralReward(
            referral.referrerWallet,
            referral.referrerId,
            chainId,
            tokenAddress,
            rewardAmount
        );

        // Record commission history for referral reward
        await this.commissionHistoryRepository.create({
            userWallet: referral.referrerWallet,
            userId: referral.referrerId,
            chainId: chainId,
            tokenAddress: tokenAddress,
            amount: rewardAmount,
            actionType: 'referral_reward',
            transactionHash: transactionHash,
            relatedUserWallet: userWallet,
            relatedUserId: userId
        });
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
            referrerWallet: referral.referrerWallet ?? undefined,
            referrerId: referral.referrerId ?? undefined,
            createdAt: referral.createdAt,
            updatedAt: referral.updatedAt
        };
    }

    /**
     * Gets fees list with filters, pagination and sorting
     */
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['params'] })
    async getFees(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        setSpanAttributes({});

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
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['params'] })
    async getReferrals(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        setSpanAttributes({});

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
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['params'] })
    async createReferrerWithdrawTask(params: {
        referrerWallet: string;
        referrerId: string;
        chainId: string;
        tokenAddress: string;
        amount: string;
    }) {
        setSpanAttributes({
            wallet: params.referrerWallet,
            userId: params.referrerId,
            chainId: params.chainId
        });

        if (!this.isChainIdSupported(params.chainId)) {
            throw new AppError({ message: `Chain ID ${params.chainId} is not supported`, statusCode: 403, code: 'NOT_ALLOWED' });
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
            throw new AppError({ message: "No referral rewards found for this token", statusCode: 403, code: 'NOT_ALLOWED' });
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
            throw new AppError({ message: "No rewards available for withdrawal", statusCode: 403, code: 'NOT_ALLOWED' });
        }

        // Check if requested amount exceeds available
        if (BigInt(params.amount) > BigInt(availableAmount)) {
            throw new AppError({ message: `Requested amount exceeds available rewards. Available: ${availableAmount}`, statusCode: 403, code: 'NOT_ALLOWED' });
        }

        // Check cooldown period
        if (withdrawRecord?.taskCooldown && now < withdrawRecord.taskCooldown) {
            const remainingCooldown = withdrawRecord.taskCooldown - now;
            throw new AppError({ message: `Cooldown period active. Try again in ${remainingCooldown} seconds`, statusCode: 403, code: 'NOT_ALLOWED' });
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
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['params'] })
    async getReferrerWithdraws(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        setSpanAttributes({});

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
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['params'] })
    async getReferrerClaimHistory(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        setSpanAttributes({});

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

    /**
     * Transform commission history entity to DTO
     */
    private mapCommissionHistory(history: ICommissionHistoryEntity) {
        return {
            id: history._id.toString(),
            userWallet: history.userWallet,
            userId: history.userId,
            chainId: history.chainId,
            tokenAddress: history.tokenAddress,
            amount: history.amount?.toString() || "0",
            actionType: history.actionType,
            transactionHash: history.transactionHash,
            relatedUserWallet: history.relatedUserWallet ?? undefined,
            relatedUserId: history.relatedUserId ?? undefined,
            createdAt: history.createdAt,
            updatedAt: history.updatedAt
        };
    }

    /**
     * Gets commission history list with filters, pagination and sorting
     */
    @TraceDecorator()
    @MetricsDecorator()
    @LogDecorator({ args: ['params'] })
    async getCommissionHistory(params: {
        filter?: Record<string, any>,
        sort?: { [key: string]: SortOrder },
        limit?: number,
        offset?: number
    }) {
        setSpanAttributes({});

        const history = await this.commissionHistoryRepository.findAll(
            params.filter,
            params.sort,
            params.limit,
            params.offset
        );

        return history.map(item => this.mapCommissionHistory(item));
    }
}
