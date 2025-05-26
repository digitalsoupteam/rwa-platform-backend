import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const tokenBalanceSchemaDefinition = {
    owner: {
        type: String,
        required: true,
        trim: true
    },
    tokenAddress: {
        type: String,
        required: true,
        trim: true
    },
    tokenId: {
        type: String,
        required: true,
        trim: true
    },
    pool: {
        type: String,
        required: true,
        trim: true
    },
    chainId: {
        type: String,
        required: true,
        trim: true
    },
    balance: {
        type: Number,
        required: true,
        default: 0
    },
    lastUpdateBlock: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Number,
        default: Math.floor(Date.now() / 1000)
    },
    updatedAt: {
        type: Number,
        default: Math.floor(Date.now() / 1000)
    },
} as const;

const tokenBalanceSchema = new Schema(tokenBalanceSchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});


tokenBalanceSchema.index({ owner: 1 });


tokenBalanceSchema.index({ pool: 1 });

tokenBalanceSchema.index({ owner: 1, pool: 1, chainId: 1 }, { unique: true });


export type ITokenBalanceEntity = InferRawDocType<typeof tokenBalanceSchemaDefinition> & { _id: Types.ObjectId };
export const TokenBalanceEntity = mongoose.model("TokenBalance", tokenBalanceSchema);