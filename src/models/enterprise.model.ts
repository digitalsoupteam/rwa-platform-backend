import { Schema, model } from 'mongoose';
import { EnterpriseStatus } from '../types/enums';

interface IEnterprise {
  productOwner: string;
  name: string;
  description?: string;
  documents: {
    presentation?: string;
    summary?: string;
  };
  riskScore?: number;
  tokenAddress?: string;
  status: EnterpriseStatus;
  createdAt: Date;
  updatedAt: Date;
}

const enterpriseSchema = new Schema<IEnterprise>(
  {
    productOwner: {
      type: String,
      required: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: String,
    documents: {
      presentation: String,
      summary: String,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    tokenAddress: {
      type: String,
      lowercase: true,
    },
    status: {
      type: String,
      enum: Object.values(EnterpriseStatus),
      default: EnterpriseStatus.DRAFT,
    },
  },
  { timestamps: true }
);

export const Enterprise = model<IEnterprise>('Enterprise', enterpriseSchema);
export type EnterpriseDocument = ReturnType<typeof Enterprise.prototype.toObject>;
