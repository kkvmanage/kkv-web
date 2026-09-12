import mongoose, { Schema, Document } from 'mongoose';
import { FDCustomer } from '../types/index.js';

export interface IFDCustomerDocument extends Document, Omit<FDCustomer, 'id'> {
  id: string;
}

const FDCustomerSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    email: { type: String },
    dob: { type: String },
    occupation: { type: String },
    notes: { type: String },
    idProofType: { type: String, default: 'Aadhaar' },
    address: { type: String },
    documents: [{ type: String }],
    photoUrl: { type: String },
    profilePhotoDriveId: { type: String },
    kycDocumentDriveIds: [{ type: String }],
    driveFolderId: { type: String },
    branchId: { type: String, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: String },
    deletedBy: { type: String },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() }
  },
  {
    timestamps: true,
    collection: 'fd_customers'
  }
);

export const FDCustomerModel = mongoose.models.FDCustomer || mongoose.model<IFDCustomerDocument>('FDCustomer', FDCustomerSchema);
