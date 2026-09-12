import mongoose, { Schema, Document } from 'mongoose';
import { FDWithdrawal } from '../types/index.js';

export interface IFDWithdrawalDocument extends Document, Omit<FDWithdrawal, 'id'> {
  id: string;
}

const FDWithdrawalSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    withdrawalId: { type: String, index: true },
    receiptNo: { type: String },
    receiptId: { type: String },
    withdrawalType: { type: String, default: 'FULL' },
    fdId: { type: String, index: true },
    fdNo: { type: String, required: true, index: true },
    customerId: { type: String, index: true },
    customerPhone: { type: String },
    depositorName: { type: String, required: true },
    originalPrincipal: { type: Number, default: 0 },
    balanceBefore: { type: Number, default: 0 },
    principalAmount: { type: Number, required: true, default: 0 },
    remainingBalance: { type: Number, default: 0 },
    interestPaid: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    withdrawalDate: { type: String, required: true, index: true },
    mode: {
      type: String,
      enum: ['Cash', 'Bank', 'UPI'],
      default: 'Cash'
    },
    transactionReference: { type: String },
    bankName: { type: String },
    notes: { type: String, default: '' },
    status: { type: String, default: 'COMPLETED' },
    processedBy: { type: String, default: 'Admin' },
    branchId: { type: String, index: true },
    createdAt: { type: String, default: () => new Date().toISOString() }
  },
  {
    timestamps: true,
    collection: 'fd_withdrawals'
  }
);

export const FDWithdrawalModel =
  mongoose.models.FDWithdrawal || mongoose.model<IFDWithdrawalDocument>('FDWithdrawal', FDWithdrawalSchema);
