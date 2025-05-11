import mongoose, { Schema, InferRawDocType } from "mongoose";

const signatureSchemaDefinition = {
    taskId: {
        type: String,
        required: true
    },
    signer: {
        type: String,
        required: true,
        trim: true
    },
    signature: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: Number,
    updatedAt: Number,
} as const;

const signatureSchema = new Schema(signatureSchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});

signatureSchema.index({ taskId: 1 });
signatureSchema.index({ taskId: 1, signer: 1 }, { unique: true });
signatureSchema.index({ createdAt: -1 });

export type ISignature = InferRawDocType<typeof signatureSchemaDefinition>;
export const SignatureEntity = mongoose.model("Signature", signatureSchema);