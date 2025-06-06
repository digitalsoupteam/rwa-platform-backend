import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const productOwnerTokenMetricsSchemaDefinition = {
    userWallet: {
        type: String,
        required: true,
        trim: true,
    },
    chainId: {
        type: Number,
        required: true,
    },
    holdTokenAddress: {
        type: String,
        required: true,
        trim: true,
    },
    ownerTotalFundsReturned: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
    },
    managerTotalFundsReturned: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
    },
    totalFundsWithdrawn: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
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

const productOwnerTokenMetricsSchema = new Schema(productOwnerTokenMetricsSchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});


productOwnerTokenMetricsSchema.index({ userWallet: 1, chainId: 1, holdTokenAddress: 1 }, { unique: true });

export type IProductOwnerTokenMetricsEntity = InferRawDocType<typeof productOwnerTokenMetricsSchemaDefinition> & { _id: Types.ObjectId };
export const ProductOwnerTokenMetricsEntity = mongoose.model("ProductOwnerTokenMetrics", productOwnerTokenMetricsSchema);