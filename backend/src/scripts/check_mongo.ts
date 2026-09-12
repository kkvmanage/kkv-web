import mongoose from 'mongoose';
import { LoanModel } from '../models/Loan.js';
import { ReceiptModel } from '../models/Receipt.js';
import { CustomerModel } from '../models/Customer.js';
import { FixedDepositModel } from '../models/FixedDeposit.js';
import { DayBookModel } from '../models/DayBook.js';
import { getMongoUri } from '../config/database.js';

async function run() {
  await mongoose.connect(getMongoUri());
  console.log('Connected to:', mongoose.connection.name);

  const [loans, receipts, customers, fds, daybook] = await Promise.all([
    LoanModel.countDocuments({ isDeleted: { $ne: true } }),
    ReceiptModel.countDocuments({ isDeleted: { $ne: true } }),
    CustomerModel.countDocuments({ isDeleted: { $ne: true } }),
    FixedDepositModel.countDocuments({ isDeleted: { $ne: true } }),
    DayBookModel.countDocuments()
  ]);

  console.log({ loans, receipts, customers, fds, daybook });

  const activeLoans = await LoanModel.find({ isDeleted: { $ne: true } }).lean();
  console.log('Active loans in DB:', activeLoans.map((l: any) => ({ loanNo: l.loanNo, principal: l.principal, customerName: l.customerName, status: l.status })));

  await mongoose.disconnect();
}

run().catch(console.error);
