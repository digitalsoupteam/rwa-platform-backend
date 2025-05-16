import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const poolSchemaDefinition = {
    ownerId: {
        type: String,
        required: true,
        trim: true
    },
    ownerType: {
        type: String,
        required: true,
        trim: true
    },
    ownerWallet: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    businessId: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    chainId: {
        type: String,
        required: true,
        trim: true
    },
    tags: {
        type: [String],
        required: true,
        default: []
    },
    riskScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 0
    },

    // Contract Addresses
    rwaAddress: {
        type: String,
        required: true,
        trim: true
    },
    poolAddress: {
        type: String,
        trim: true
    },
    holdToken: {
        type: String,
        trim: true
    },
    tokenId: {
        type: String,
        trim: true
    },

    // Pool Configuration
    entryFeePercent: {
        type: String,
        trim: true
    },
    exitFeePercent: {
        type: String,
        trim: true
    },
    expectedHoldAmount: {
        type: String,
        required: true,
        trim: true
    },
    expectedRwaAmount: {
        type: String,
        required: true,
        trim: true
    },
    expectedBonusAmount: {
        type: String,
        required: true,
        trim: true
    },
    rewardPercent: {
        type: String,
        required: true,
        trim: true
    },
    priceImpactPercent: {
        type: String,
        required: true,
        trim: true
    },
    liquidityCoefficient: {
        type: String,
        required: true,
        trim: true
    },

    // Pool Flags
    awaitCompletionExpired: {
        type: Boolean,
        required: true,
        default: false
    },
    floatingOutTranchesTimestamps: {
        type: Boolean,
        required: true,
        default: false
    },
    fixedSell: {
        type: Boolean,
        required: true,
        default: false
    },
    allowEntryBurn: {
        type: Boolean,
        required: true,
        default: false
    },
    paused: {
        type: Boolean,
        required: true,
        default: false
    },

    // Time Periods
    entryPeriodStart: {
        type: Number,
        required: true
    },
    entryPeriodExpired: {
        type: Number,
        required: true
    },
    completionPeriodExpired: {
        type: Number,
        required: true
    },
    floatingTimestampOffset: {
        type: Number,
        required: true,
        default: 0
    },
    fullReturnTimestamp: {
        type: Number
    },

    // Pool State
    k: {
        type: String,
        required: true,
        trim: true
    },
    realHoldReserve: {
        type: String,
        required: true,
        trim: true,
        default: "0"
    },
    virtualHoldReserve: {
        type: String,
        required: true,
        trim: true
    },
    virtualRwaReserve: {
        type: String,
        required: true,
        trim: true
    },
    isTargetReached: {
        type: Boolean,
        required: true,
        default: false
    },
    isFullyReturned: {
        type: Boolean,
        required: true,
        default: false
    },

    // Amounts
    totalClaimedAmount: {
        type: String,
        required: true,
        trim: true,
        default: "0"
    },
    totalReturnedAmount: {
        type: String,
        required: true,
        trim: true,
        default: "0"
    },
    awaitingBonusAmount: {
        type: String,
        required: true,
        trim: true,
        default: "0"
    },
    awaitingRwaAmount: {
        type: String,
        required: true,
        trim: true,
        default: "0"
    },
    outgoingTranchesBalance: {
        type: String,
        required: true,
        trim: true,
        default: "0"
    },

    // Tranches
    outgoingTranches: {
        type: [{
            amount: {
                type: String,
                required: true,
                trim: true
            },
            timestamp: {
                type: Number,
                required: true
            },
            executedAmount: {
                type: String,
                required: true,
                trim: true,
                default: "0"
            }
        }],
        required: true,
        default: []
    },
    incomingTranches: {
        type: [{
            amount: {
                type: String,
                required: true,
                trim: true
            },
            expiredAt: {
                type: Number,
                required: true
            },
            returnedAmount: {
                type: String,
                required: true,
                trim: true,
                default: "0"
            }
        }],
        required: true,
        default: []
    },
    lastCompletedIncomingTranche: {
        type: Number,
        required: true,
        default: 0
    },

    // Approval
    approvalSignaturesTaskId: {
        type: String
    },
    approvalSignaturesTaskExpired: {
        type: Number
    },

    // Timestamps
    createdAt: {
        type: Number,
        default: Math.floor(Date.now() / 1000)
    },
    updatedAt: {
        type: Number,
        default: Math.floor(Date.now() / 1000)
    }
} as const;

const poolSchema = new Schema(poolSchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});

poolSchema.index({ businessId: 1 });
poolSchema.index({ rwaAddress: 1 });
poolSchema.index({ poolAddress: 1 });
poolSchema.index({ tokenId: 1 });
poolSchema.index({ isTargetReached: 1 });
poolSchema.index({ isFullyReturned: 1 });
poolSchema.index({ ownerId: 1 });
poolSchema.index({ chainId: 1 });
poolSchema.index({ tags: 1 });
poolSchema.index({ riskScore: 1 });

export type IPoolEntity = InferRawDocType<typeof poolSchemaDefinition> & { _id: Types.ObjectId };
export const PoolEntity = mongoose.model("Pool", poolSchema);