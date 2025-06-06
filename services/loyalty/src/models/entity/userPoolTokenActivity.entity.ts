import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const userPoolTokenActivitySchemaDefinition = {
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
    holdTokenAddress: {
        type: String,
        required: true,
        trim: true,
    },
    earlyMintVolume: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
    },
    earlyBurnVolume: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
    },
    middleMintVolume: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
    },
    middleBurnVolume: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
    },
    lateMintVolume: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
    },
    lateBurnVolume: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
    },
    postMintVolume: {
        type: Schema.Types.Decimal128,
        default: () => Types.Decimal128.fromString("0"),
    },
    postBurnVolume: {
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

const userPoolTokenActivitySchema = new Schema(userPoolTokenActivitySchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});


userPoolTokenActivitySchema.index({ userWallet: 1, poolId: 1, chainId: 1, holdTokenAddress: 1 }, { unique: true });

userPoolTokenActivitySchema.index({ businessId: 1 });

export type IUserPoolTokenActivityEntity = InferRawDocType<typeof userPoolTokenActivitySchemaDefinition> & { _id: Types.ObjectId };
export const UserPoolTokenActivityEntity = mongoose.model("UserPoolTokenActivity", userPoolTokenActivitySchema);