import mongoose, { Schema, InferRawDocType } from "mongoose";
// TODO только количество, ограничение на ввод и вывод
const messageSchemaDefinition = {
  assistantId: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
} as const;

const messageSchema = new Schema(messageSchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

messageSchema.index({ assistantId: 1 });

export type IMessageEntity = InferRawDocType<typeof messageSchemaDefinition>;
export const MessageEntity = mongoose.model("Message", messageSchema);