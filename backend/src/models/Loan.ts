import mongoose, { Schema, Document } from 'mongoose';
import { Loan } from '../types/index.js';

export interface ILoanDocument extends Document, Omit<Loan, 'id'> {
  id: string;
}

const OrnamentItemSchema = new Schema(
  {
    id: { type: String, required: true },
    item: { type: String, required: true },
    qty: { type: Number, required: true, default: 1 },
    purity: { type: String, required: true, default: '22ct' },
    grossWeight: { type: Number, required: true, default: 0 },
    deductionWeight: { type: Number, default: 0 },
    netWeight: { type: Number, required: true, default: 0 }
  },
  { _id: false }
);

const LoanSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    receiptBillNo: { type: Number, index: true },
    loanNo: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerGender: { type: String, default: 'Male' },
    customerAge: { type: Number },
    customerOccupation: { type: String },
    customerEmail: { type: String },
    customerPhotoUrl: { type: String },
    customerCurrentAddress: { type: String },
    customerPermanentAddress: { type: String },
    customerLocation: { type: Schema.Types.Mixed },

    nominee: { type: Schema.Types.Mixed },
    guarantor: { type: Schema.Types.Mixed },

    nomineeName: { type: String },
    nomineeRelation: { type: String },
    nomineePhone: { type: String },
    nomineeAadhaar: { type: String },
    nomineePan: { type: String },
    guarantorName: { type: String },
    guarantorRelation: { type: String },
    guarantorPhone: { type: String },
    guarantorAadhaar: { type: String },
    guarantorPan: { type: String },
    kycDocuments: [{ type: String }],

    date: { type: String, required: true, index: true },
    loanType: { type: String, required: true },
    repaymentSystem: { type: String, default: 'Monthly Interest Only' },
    loanTypeId: { type: String },
    loanTypeName: { type: String },
    loanTypeNameSnapshot: { type: String },
    interestRateSnapshot: { type: Number },
    interestProfileSnapshot: { type: String },
    cardFeeSnapshot: { type: Number },
    interestProfileIdSnapshot: { type: String },
    interestProfileNameSnapshot: { type: String },
    interestConfigurationSnapshot: { type: Schema.Types.Mixed },
    configurationVersion: { type: Schema.Types.Mixed, default: 1 },
    configurationSource: { type: String },
    rateEffectiveAt: { type: String },
    loanConfigVersion: { type: String },
    amountBandId: { type: String },
    amountBandCondition: { type: String },
    amountBandThreshold: { type: Number },
    penaltyAfterMonths: { type: Number },
    penaltyStepUpMonthly: { type: Number },
    penaltyCalculation: { type: String },
    repaymentSystemId: { type: String },
    repaymentSystemName: { type: String },
    calculationStrategy: { type: String },
    area: { type: String },
    showroom: { type: String },

    principal: { type: Number, required: true, default: 0 },
    interestRate: { type: Number, required: true, default: 2.0 },
    bankMode: { type: String, default: 'Cash' },
    splitBankMode: { type: String },
    cashAmount: { type: Number, default: 0 },
    bankAmount: { type: Number, default: 0 },
    deductAdvanceInterest: { type: Boolean, default: false },
    advanceDays: { type: Number, default: 0 },
    advanceInterestAmount: { type: Number, default: 0 },
    advanceInterestReceivingMethod: { type: String },
    cardFee: { type: Number, default: 25 },
    cardFeeEnabled: { type: Boolean, default: true },
    cardFeePaymentMode: { type: String, default: 'Cash' },
    cardFeeBankMode: { type: String },

    items: [OrnamentItemSchema],
    totalGrossWeight: { type: Number, default: 0 },
    totalDeductionWeight: { type: Number, default: 0 },
    totalNetWeight: { type: Number, default: 0 },
    marketValue: { type: Number, default: 0 },
    ltv: { type: Number, default: 0 },
    monthlyInterest: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    photos: [{ type: String }],
    status: {
      type: String,
      enum: ['ACTIVE', 'CLOSED', 'PENDING', 'OVERDUE'],
      default: 'ACTIVE',
      index: true
    },
    disbursedAmount: { type: Number, default: 0 },
    netDisbursed: { type: Number, default: 0 },
    outstandingPrincipal: { type: Number, default: 0 },
    accruedInterest: { type: Number, default: 0 },
    renewalDate: { type: String },
    lastInterestPaidDate: { type: String },
    nextDueDate: { type: String },
    documentDriveIds: [{ type: String }],
    receiptDriveIds: [{ type: String }],
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
    collection: 'loans'
  }
);

// Compound indexes for high-speed queries
LoanSchema.index({ loanNo: 1, isDeleted: 1 });
LoanSchema.index({ customerId: 1, isDeleted: 1 });
LoanSchema.index({ status: 1, isDeleted: 1 });

export const LoanModel = mongoose.models.Loan || mongoose.model<ILoanDocument>('Loan', LoanSchema);
