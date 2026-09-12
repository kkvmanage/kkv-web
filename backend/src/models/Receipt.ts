import mongoose, { Schema, Document } from 'mongoose';
import { Receipt } from '../types/index.js';

export interface IReceiptDocument extends Document, Omit<Receipt, 'id'> {
  id: string;
}

const ReceiptSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    receiptNo: { type: Number, required: true, unique: true, index: true },
    loanId: { type: String, required: true, index: true },
    loanNo: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    kind: {
      type: String,
      required: true,
      enum: ['REPAYMENT', 'NEW LOAN', 'INTEREST PAYMENT', 'PART PAYMENT', 'LOAN CLOSURE'],
      default: 'REPAYMENT'
    },
    loanType: { type: String, default: 'Gold Loan' },
    amount: { type: Number, required: true, default: 0 },
    principalComponent: { type: Number, default: 0 },
    interestComponent: { type: Number, default: 0 },
    odCharges: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tdsAmount: { type: Number, default: 0 },
    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank'],
      default: 'Cash'
    },
    date: { type: String, required: true, index: true },
    currentDueDate: { type: String },
    nextDueDate: { type: String },
    daysLate: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    driveFileId: { type: String },
    outstandingBefore: { type: Number },
    outstandingAfter: { type: Number },
    processedBy: { type: String, default: 'Admin' },
    branchId: { type: String, index: true },
    createdAt: { type: String, default: () => new Date().toISOString() }
  },
  {
    timestamps: true,
    collection: 'receipts'
  }
);

ReceiptSchema.index({ loanNo: 1, createdAt: -1 });
ReceiptSchema.index({ customerId: 1, createdAt: -1 });

export const ReceiptModel = mongoose.models.Receipt || mongoose.model<IReceiptDocument>('Receipt', ReceiptSchema);
