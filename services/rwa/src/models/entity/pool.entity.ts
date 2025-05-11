import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const stableSpecificFields = {
    fixedMintPrice: {
        type: String,
        trim: true
    }
} as const;

const speculativeSpecificFields = {
    rwaMultiplierIndex: {
        type: Number,
        default: 0,
        required: false
    },
    rwaMultiplier: {
        type: Number,
        required: false
    },
    realHoldReserve: {
        type: String,
        trim: true
    },
    virtualHoldReserve: {
        type: String,
        trim: true
    },
    virtualRwaReserve: {
        type: String,
        trim: true
    },
    k: {
        type: String,
        trim: true
    },
    availableBonusAmount: {
        type: String,
        trim: true
    },
    expectedBonusAmount: {
        type: String,
        trim: true
    }
} as const;

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
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        trim: true,
        enum: ['stable', 'speculation']
    },
    businessId: {
        type: String,
        required: true,
        trim: true
    },
    rwaAddress: {
        type: String,
        required: true,
        trim: true
    },
    poolAddress: {
        type: String,
        required: true,
        trim: true
    },
    tokenId: {
        type: String,
        required: true,
        trim: true
    },
    holdToken: {
        type: String,
        required: true,
        trim: true
    },
    entryFeePercent: {
        type: String,
        required: true,
        trim: true
    },
    exitFeePercent: {
        type: String,
        required: true,
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
    rewardPercent: {
        type: String,
        required: true,
        trim: true
    },
    entryPeriodExpired: {
        type: Number,
        required: true
    },
    completionPeriodExpired: {
        type: Number,
        required: true
    },
    expectedReturnAmount: {
        type: String,
        required: true,
        trim: true
    },
    accumulatedHoldAmount: {
        type: String,
        required: true,
        trim: true,
        default: "0"
    },
    accumulatedRwaAmount: {
        type: String,
        required: true,
        trim: true,
        default: "0"
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
    returnedAmount: {
        type: String,
        required: true,
        trim: true,
        default: "0"
    },
    paused: {
        type: Boolean,
        required: true,
        default: false
    },
    allocatedHoldAmount: {
        type: String,
        required: true,
        trim: true,
        default: "0"
    },
    availableReturnBalance: {
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
    approvalSignaturesTaskId: {
        type: String,
        required: false
    },
    approvalSignaturesTaskExpired: {
        type: Number,
        required: false
    },
    entryPeriodDuration: {
        type: Number,
        required: true,
        default: 0
    },
    completionPeriodDuration: {
        type: Number,
        required: true,
        default: 0
    },
    stableSpecificFields: {
        type: stableSpecificFields,
        required: false
    },
    speculativeSpecificFields: {
        type: speculativeSpecificFields,
        required: false
    },
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

poolSchema.pre('validate', function(next) {
    if (this.stableSpecificFields && this.type !== 'stable') {
        this.invalidate('stableSpecificFields', 'stableSpecificFields can only be set when type is stable');
    }
    if (this.speculativeSpecificFields && this.type !== 'speculation') {
        this.invalidate('speculativeSpecificFields', 'speculativeSpecificFields can only be set when type is speculative');
    }
    next();
});

poolSchema.index({ businessId: 1 });
poolSchema.index({ rwaAddress: 1 });
poolSchema.index({ poolAddress: 1 });
poolSchema.index({ tokenId: 1 });
poolSchema.index({ isTargetReached: 1 });
poolSchema.index({ isFullyReturned: 1 });
poolSchema.index({ type: 1 });
poolSchema.index({ ownerId: 1 });
poolSchema.index({ chainId: 1 });
poolSchema.index({ tags: 1 });
poolSchema.index({ riskScore: 1 });

export type IPoolEntity = InferRawDocType<typeof poolSchemaDefinition> & { _id: Types.ObjectId };
export const PoolEntity = mongoose.model("Pool", poolSchema);