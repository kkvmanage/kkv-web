import mongoose, { Schema, Document } from 'mongoose';
import { FDRenewal } from '../types/index.js';

export interface IFDRenewalDocument extends Document, Omit<FDRenewal, 'id'> {
  id: string;
}

const FDRenewalSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    renewalId: { type: String, index: true },
    fdId: { type: String, index: true },
    fdNo: { type: String, required: true, index: true },
    customerId: { type: String, index: true },
    depositorName: { type: String, required: true },
    previousMaturityDate: { type: String, required: true },
    newMaturityDate: { type: String, required: true },
    renewalPeriodMonths: { type: Number, required: true },
    renewalDate: { type: String, required: true },
    interestRateAtRenewal: { type: Number, required: true },
    notes: { type: String, default: '' },
    status: { type: String, default: 'COMPLETED' },
    branchId: { type: String, index: true },
    createdAt: { type: String, default: () => new Date().toISOString() }
  },
  {
    timestamps: true,
    collection: 'fd_renewals'
  }
);

export const FDRenewalModel =
  mongoose.models.FDRenewal || mongoose.model<IFDRenewalDocument>('FDRenewal', FDRenewalSchema);
