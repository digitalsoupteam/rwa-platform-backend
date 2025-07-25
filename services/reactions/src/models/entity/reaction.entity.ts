import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const reactionSchemaDefinition = {
    parentId: {
        type: String,
        required: true,
    },
    parentType: {
        type: String,
        required: true,
    },
    userId: {
        type: String,
        required: true,
    },
    reaction: {
        type: String,
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

const reactionSchema = new Schema(reactionSchemaDefinition, {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }
});

reactionSchema.index({ parentId: 1 });
reactionSchema.index({ parentType: 1 });
reactionSchema.index({ userId: 1 });
reactionSchema.index({ reaction: 1 });
reactionSchema.index({ parentId: 1, parentType: 1 });
reactionSchema.index({ parentId: 1, parentType: 1, userId: 1, reaction: 1 }, { unique: true });

export type IReactionEntity = InferRawDocType<typeof reactionSchemaDefinition> & { _id: Types.ObjectId };
export const ReactionEntity = mongoose.model("Reaction", reactionSchema);