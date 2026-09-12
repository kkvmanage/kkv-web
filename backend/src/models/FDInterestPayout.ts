import mongoose, { Schema, Document } from 'mongoose';
import { FDInterestPayout } from '../types/index.js';

export interface IFDInterestPayoutDocument extends Document, Omit<FDInterestPayout, 'id'> {
  id: string;
}

const FDInterestPayoutSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    fdId: { type: String, index: true },
    fdNo: { type: String, required: true, index: true },
    customerId: { type: String, index: true },
    depositorName: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 },
    date: { type: String, required: true, index: true },
    dueDate: { type: String },
    periodKey: { type: String, index: true },
    mode: {
      type: String,
      enum: ['Cash', 'Bank', 'UPI'],
      default: 'Cash'
    },
    status: {
      type: String,
      enum: ['PAID', 'PENDING'],
      default: 'PAID'
    },
    branchId: { type: String, index: true },
    createdAt: { type: String, default: () => new Date().toISOString() }
  },
  {
    timestamps: true,
    collection: 'fd_interest_payouts'
  }
);

export const FDInterestPayoutModel =
  mongoose.models.FDInterestPayout || mongoose.model<IFDInterestPayoutDocument>('FDInterestPayout', FDInterestPayoutSchema);
