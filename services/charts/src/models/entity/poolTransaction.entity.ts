import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

export enum PoolTransactionType {
  MINT = 'MINT',
  BURN = 'BURN'
}

const poolTransactionSchemaDefinition = {
    poolAddress: {
        type: String,
        required: true,
        trim: true,
    },
    transactionType: {
        type: String,
        enum: Object.values(PoolTransactionType),
        required: true,
    },
    userAddress: {
        type: String,
        required: true,
        trim: true,
    },
    timestamp: {
        type: Number,
        required: true,
    },
    rwaAmount: {
        type: String, 
        required: true,
    },
    holdAmount: {
        type: String,
        required: true,
    },
    bonusAmount: {
        type: String,
        default: "0",
    },
    holdFee: {
        type: String, 
        required: true,
    },
    bonusFee: {
        type: String,
        default: "0",
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

const poolTransactionSchema = new Schema(poolTransactionSchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});

poolTransactionSchema.index({ poolAddress: 1, timestamp: -1 }); // Compound index for querying by pool and time
poolTransactionSchema.index({ userAddress: 1, timestamp: -1 }); // Compound index for querying by user and time
poolTransactionSchema.index({ timestamp: -1 }); // Index for general time-based queries

export type IPoolTransactionEntity = InferRawDocType<typeof poolTransactionSchemaDefinition> & { _id: Types.ObjectId };
export const PoolTransactionEntity = mongoose.model("PoolTransaction", poolTransactionSchema);