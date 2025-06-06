import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const userPoolActivitySchemaDefinition = {
    userWallet: {
        type: String,
        required: true,
        trim: true,
    },
    chainId: {
        type: Number,
        required: true,
    },
    poolId: {
        type: String,
        required: true,
        trim: true,
    },
    businessId: {
        type: String,
        required: true,
        trim: true,
    },
    earlyMintCount: {
        type: Number,
        default: 0,
    },
    earlyBurnCount: {
        type: Number,
        default: 0,
    },
    middleMintCount: {
        type: Number,
        default: 0,
    },
    middleBurnCount: {
        type: Number,
        default: 0,
    },
    lateMintCount: {
        type: Number,
        default: 0,
    },
    lateBurnCount: {
        type: Number,
        default: 0,
    },
    postMintCount: {
        type: Number,
        default: 0,
    },
    postBurnCount: {
        type: Number,
        default: 0,
    },
    targetsReachedCount: {
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

const userPoolActivitySchema = new Schema(userPoolActivitySchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});

userPoolActivitySchema.index({ userWallet: 1, poolId: 1, chainId: 1 }, { unique: true });
userPoolActivitySchema.index({ businessId: 1 });

export type IUserPoolActivityEntity = InferRawDocType<typeof userPoolActivitySchemaDefinition> & { _id: Types.ObjectId };
export const UserPoolActivityEntity = mongoose.model("UserPoolActivity", userPoolActivitySchema);