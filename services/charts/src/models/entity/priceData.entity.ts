import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const priceDataSchemaDefinition = {
    poolAddress: {
        type: String,
        required: true,
        trim: true,
    },
    timestamp: {
        type: Number, // Unix timestamp
        required: true,
    },
    blockNumber: {
        type: Number,
        required: true,
    },
    realHoldReserve: {
        type: String, // Stored as string to maintain precision
        required: true,
    },
    virtualHoldReserve: {
        type: String, // Stored as string to maintain precision
        required: true,
    },
    virtualRwaReserve: {
        type: String, // Stored as string to maintain precision
        required: true,
    },
    price: {
        type: String, // Calculated price, stored as string to maintain precision
        required: true,
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

const priceDataSchema = new Schema(priceDataSchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});

priceDataSchema.index({ poolAddress: 1, timestamp: -1 }); // Compound index for querying by pool and time
priceDataSchema.index({ timestamp: -1 }); // Index for general time-based queries

export type IPriceDataEntity = InferRawDocType<typeof priceDataSchemaDefinition> & { _id: Types.ObjectId };
export const PriceDataEntity = mongoose.model("PriceData", priceDataSchema);