import mongoose, { Schema, Document } from 'mongoose';
import type { ILoopSubscription } from '../types';

export interface ILoopSubscriptionDocument extends Omit<ILoopSubscription, '_id'>, Document {}

const LoopSubscriptionSchema = new Schema<ILoopSubscriptionDocument>(
  {
    userId: {
      type: String, // Wallet address mapping to User
      required: true,
      index: true,
    },
    loopSubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'unpaid', 'paused'],
      default: 'active',
    },
    plan: {
      type: String,
      default: 'pro',
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    gracePeriodEnd: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const LoopSubscriptionModel =
  (mongoose.models.LoopSubscription as mongoose.Model<ILoopSubscriptionDocument>) || 
  mongoose.model<ILoopSubscriptionDocument>('LoopSubscription', LoopSubscriptionSchema);
