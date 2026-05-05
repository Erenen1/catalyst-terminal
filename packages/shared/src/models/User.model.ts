/**
 * @file packages/shared/src/models/User.model.ts
 * @description Mongoose schema for the User domain entity.
 *              DATA_SCHEME.md'deki `users` koleksiyonunu implement eder.
 *              Wallet Connect tabanlı kimlik doğrulama için tasarlanmıştır;
 *              walletAddress alanı unique index ile primary key işlevi görür.
 */

import mongoose, { Schema, Document } from 'mongoose';
import type { IUser, UserTier } from '../types';

export interface IUserDocument extends Omit<IUser, '_id'>, Document {}

const UserSchema = new Schema<IUserDocument>(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,   // Her cüzdan adresi sistemde yalnızca bir kez kayıtlı olabilir
      lowercase: true,
      trim: true,
      index: true,
    },
    tier: {
      type: String,
      enum: ['free', 'pro'] satisfies UserTier[],
      default: 'free',
    },
    activeRuleCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    telegramChatId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    telegramVerificationToken: {
      type: String,
      index: true,
    },
    telegramUsername: {
      type: String,
    },
    proUntil: {
      type: Date,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true, // Only for those who have it
      index: true,
    },
    referredBy: {
      type: String,
      index: true,
    },
    isReferralRewardClaimed: {
      type: Boolean,
      default: false,
    },
    referralCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // updatedAt gerekli değil
  }
);

export const UserModel =
  (mongoose.models.User as mongoose.Model<IUserDocument>) || 
  mongoose.model<IUserDocument>('User', UserSchema);
