import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const companySchemaDefinition = {
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: "",
        trim: true
    },
    ownerId: {
        type: String,
        required: true,
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

const companySchema = new Schema(companySchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});

companySchema.index({ ownerId: 1 });
companySchema.index({ name: 1 });

export type ICompanyEntity = InferRawDocType<typeof companySchemaDefinition> & { _id: Types.ObjectId };
export const CompanyEntity = mongoose.model("Company", companySchema);