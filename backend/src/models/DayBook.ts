import mongoose, { Schema, Document } from 'mongoose';
import { DayBookEntry } from '../types/index.js';

export interface IDayBookDocument extends Document, Omit<DayBookEntry, 'id'> {
  id: string;
}

const DayBookSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    time: { type: String, required: true },
    billNo: { type: String, required: true, index: true },
    particulars: { type: String, required: true },
    accountHead: { type: String, required: true },
    mode: {
      type: String,
      enum: ['Cash', 'Bank', 'UPI'],
      default: 'Cash'
    },
    cashIn: { type: Number, default: 0 },
    cashOut: { type: Number, default: 0 },
    bankIn: { type: Number, default: 0 },
    bankOut: { type: Number, default: 0 },
    cashBal: { type: Number, default: 0 },
    bankBal: { type: Number, default: 0 },
    tdsAmount: { type: Number, default: 0 },
    customerName: { type: String },
    loanNo: { type: String, index: true },
    date: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    createdAt: { type: String, default: () => new Date().toISOString() }
  },
  {
    timestamps: true,
    collection: 'day_book_entries'
  }
);

DayBookSchema.index({ date: 1, createdAt: -1 });

export const DayBookModel =
  mongoose.models.DayBook || mongoose.model<IDayBookDocument>('DayBook', DayBookSchema);
