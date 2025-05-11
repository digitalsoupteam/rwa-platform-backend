import mongoose, { Schema, InferRawDocType } from "mongoose";

const signatureTaskSchemaDefinition = {
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
    hash: {
        type: String,
        required: true,
        trim: true
    },
    requiredSignatures: {
        type: Number,
        required: true,
        min: 1
    },
    expired:  {
        type: Number,
        required: true,
    },
    completed: {
        type: Boolean,
        required: true,
        default: false
    },
    createdAt: Number,
    updatedAt: Number,
} as const;

const signatureTaskSchema = new Schema(signatureTaskSchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});

signatureTaskSchema.index({ hash: 1 }, { unique: true });
signatureTaskSchema.index({ expired: 1 });
signatureTaskSchema.index({ createdAt: -1 });
signatureTaskSchema.index({ ownerId: 1 });

export type ISignatureTask = InferRawDocType<typeof signatureTaskSchemaDefinition>;
export const SignatureTask = mongoose.model("SignatureTask", signatureTaskSchema);