import { Schema, model } from 'mongoose';
import { UserRole, KYCStatus } from '../types/enums';

interface IUser {
  address: string;
  nonce: string;
  role: UserRole;
  kycStatus?: KYCStatus;
  referrer?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.INVESTOR,
    },
    kycStatus: {
      type: String,
      enum: Object.values(KYCStatus),
      default: KYCStatus.NONE,
    },
    referrer: {
      type: String,
      lowercase: true,
    },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
export type UserDocument = ReturnType<typeof User.prototype.toObject>;
