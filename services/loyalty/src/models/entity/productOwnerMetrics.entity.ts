import mongoose, { Schema, InferRawDocType, Types, Decimal128 } from "mongoose";

const productOwnerMetricsSchemaDefinition = {
    userWallet: {
        type: String,
        required: true,
        trim: true,
    },
    chainId: {
        type: Number,
        required: true,
    },
    businessesCreated: {
        type: Number,
        default: 0,
    },
    poolsCreated: {
        type: Number,
        default: 0,
    },
    businessesDeployed: {
        type: Number,
        default: 0,
    },
    poolsDeployed: {
        type: Number,
        default: 0,
    },
    targetReachedPools: {
        type: Number,
        default: 0,
    },
    fullyReturnedPools: {
        type: Number,
        default: 0,
    },
    poolsReturnCalled: {
        type: Number,
        default: 0,
    },
    poolsFullyReturnCalled: {
        type: Number,
        default: 0,
    },
    incomingTranchesCount: {
        type: Number,
        default: 0,
    },
    outgoingTranchesCount: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    updatedAt: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
} as const;

const productOwnerMetricsSchema = new Schema(productOwnerMetricsSchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});


productOwnerMetricsSchema.index({ userWallet: 1, chainId: 1 }, { unique: true });

export type IProductOwnerMetricsEntity = InferRawDocType<typeof productOwnerMetricsSchemaDefinition> & { _id: Types.ObjectId };
export const ProductOwnerMetricsEntity = mongoose.model("ProductOwnerMetrics", productOwnerMetricsSchema);