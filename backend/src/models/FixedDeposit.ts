import mongoose, { Schema, Document } from 'mongoose';
import { FixedDeposit } from '../types/index.js';

export interface IFixedDepositDocument extends Document, Omit<FixedDeposit, 'id'> {
  id: string;
}

const FixedDepositSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    fdNo: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    depositorName: { type: String, required: true },
    phone: { type: String, required: true },
    idProofType: { type: String, default: 'Aadhaar' },
    idProofNumber: { type: String, default: '' },
    idNumber: { type: String },
    address: { type: String, default: '' },
    depositDate: { type: String, required: true, index: true },
    maturityDate: { type: String, required: true },
    principal: { type: Number, required: true, default: 0 },
    remainingPrincipal: { type: Number },
    totalWithdrawnPrincipal: { type: Number, default: 0 },
    tenureMonths: { type: Number, default: 12 },
    interestRatePA: { type: Number, required: true, default: 12 },
    receivingMethod: {
      type: String,
      enum: ['Cash', 'Bank', 'UPI'],
      default: 'Cash'
    },
    monthlyPayout: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'MATURED', 'WITHDRAWN'],
      default: 'ACTIVE',
      index: true
    },
    parentCustomerName: { type: String },
    nomineeName: { type: String },
    nomineeRelation: { type: String },
    remarks: { type: String, default: '' },

    fdInterestRateSnapshot: { type: Number },
    fdTenureSnapshot: { type: Number },
    calculationMethodSnapshot: { type: String },
    minimumAmountSnapshot: { type: Number },
    configurationVersion: { type: Number, default: 1 },

    branchId: { type: String, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: String },
    deletedBy: { type: String },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() }
  },
  {
    timestamps: true,
    collection: 'fixed_deposits'
  }
);

FixedDepositSchema.index({ fdNo: 1, isDeleted: 1 });
FixedDepositSchema.index({ customerId: 1, isDeleted: 1 });
FixedDepositSchema.index({ status: 1, isDeleted: 1 });

export const FixedDepositModel = mongoose.models.FixedDeposit || mongoose.model<IFixedDepositDocument>('FixedDeposit', FixedDepositSchema);
