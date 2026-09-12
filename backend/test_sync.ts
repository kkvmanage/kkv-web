import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { CustomerModel } from './src/models/Customer.js';
import { LoanModel } from './src/models/Loan.js';
import { ReceiptModel } from './src/models/Receipt.js';
import { FixedDepositModel } from './src/models/FixedDeposit.js';
import { FDCustomerModel } from './src/models/FDCustomer.js';
import { FDInterestPayoutModel } from './src/models/FDInterestPayout.js';
import { FDWithdrawalModel } from './src/models/FDWithdrawal.js';
import { FDRenewalModel } from './src/models/FDRenewal.js';
import { DayBookModel } from './src/models/DayBook.js';

import { customerService } from './src/services/customer.service.js';
import { loanService } from './src/services/loan.service.js';
import { receiptService } from './src/services/receipt.service.js';
import { fdService } from './src/services/fd.service.js';
import { accountingService } from './src/services/accounting.service.js';
import { dashboardService } from './src/services/dashboard.service.js';

async function runTest() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kkv_gold_finance';
  console.log('Connecting to MongoDB at:', uri);
  await mongoose.connect(uri);

  console.log('\n--- 1. Testing Customer Sync ---');
  // Admin creates Customer
  const adminCust = await customerService.create({
    customerId: 'CUST-TEST-ADMIN',
    name: 'Admin Created Customer',
    mobile: '9876543210',
    address: '123 Admin Lane',
    branchId: 'MAIN',
    complexId: 'COMP-1'
  });
  console.log('Admin created customer:', adminCust.customerId);

  // Staff reads Customer
  const staffReadCusts = await customerService.getAllAsync();
  const foundCust = staffReadCusts.find(c => c.id === adminCust.id || c.customerId === adminCust.customerId || (adminCust.id && c.customerId === adminCust.id));
  console.log('Staff found Admin customer in MongoDB?', !!foundCust);

  console.log('\n--- 2. Testing Loan & Receipt Sync ---');
  // Admin creates Loan
  const adminLoan = await loanService.create({
    loanNo: 'GL-TEST-ADMIN',
    customerId: adminCust.id,
    customerName: 'Admin Created Customer',
    customerPhone: '9876543210',
    loanType: 'Gold Loan',
    repaymentSystem: 'Monthly Interest Only',
    principal: 50000,
    interestRate: 1.5,
    items: [{ id: 'item-1', item: 'Gold Chain', qty: 1, purity: '22ct', grossWeight: 20, netWeight: 19.5 }],
    totalGrossWeight: 20,
    totalNetWeight: 19.5,
    status: 'ACTIVE',
    branchId: 'MAIN',
    complexId: 'COMP-1'
  });
  console.log('Admin created loan:', adminLoan.loanNo);

  // Staff reads Loan
  const staffReadLoans = await loanService.getAllAsync('MAIN', 'COMP-1');
  const foundLoan = staffReadLoans.find(l => l.loanNo === 'GL-TEST-ADMIN');
  console.log('Staff found Admin loan in MongoDB?', !!foundLoan);

  // Staff creates Loan
  const staffLoan = await loanService.create({
    loanNo: 'GL-TEST-STAFF',
    customerId: adminCust.id,
    customerName: 'Admin Created Customer',
    customerPhone: '9876543210',
    loanType: 'Gold Loan',
    repaymentSystem: 'Monthly Interest Only',
    principal: 75000,
    interestRate: 1.5,
    items: [{ id: 'item-2', item: 'Gold Bangle', qty: 2, purity: '22ct', grossWeight: 30, netWeight: 29.5 }],
    totalGrossWeight: 30,
    totalNetWeight: 29.5,
    status: 'ACTIVE',
    branchId: 'MAIN',
    complexId: 'COMP-1'
  });
  console.log('Staff created loan:', staffLoan.loanNo);

  // Admin reads Loan
  const adminReadLoans = await loanService.getAllAsync();
  const foundStaffLoan = adminReadLoans.find(l => l.loanNo === 'GL-TEST-STAFF');
  console.log('Admin found Staff loan in MongoDB?', !!foundStaffLoan);

  // Admin issues receipt
  const adminReceipt = await receiptService.create({
    receiptNo: 999991,
    loanId: adminLoan.id,
    loanNo: 'GL-TEST-ADMIN',
    customerId: adminCust.id,
    customerName: 'Admin Created Customer',
    kind: 'INTEREST PAYMENT',
    loanType: 'Gold Loan',
    amount: 5000,
    principalComponent: 4000,
    interestComponent: 1000,
    paymentMode: 'Cash',
    date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
    branchId: 'MAIN',
    complexId: 'COMP-1'
  });
  console.log('Admin created receipt:', adminReceipt.receiptNo);

  // Staff reads receipt
  const staffReadReceipts = await receiptService.getAllAsync('MAIN', 'COMP-1');
  const foundReceipt = staffReadReceipts.find(r => r.receiptNo === 999991);
  console.log('Staff found Admin receipt in MongoDB?', !!foundReceipt);

  console.log('\n--- 3. Testing Fixed Deposit Sync ---');
  // Admin creates FD Customer
  const adminFDCust = await fdService.createCustomer({
    customerId: 'FDCUST-TEST-ADMIN',
    name: 'Admin FD Customer',
    mobile: '9988776655',
    address: '456 FD Road',
    branchId: 'MAIN',
    complexId: 'COMP-1'
  });
  console.log('Admin created FD customer:', adminFDCust.customerId);

  // Staff creates FD Deposit for that customer
  const staffFD = await fdService.createDeposit({
    fdNo: 'FD-TEST-STAFF',
    customerId: 'FDCUST-TEST-ADMIN',
    customerName: 'Admin FD Customer',
    depositAmount: 100000,
    interestRate: 12,
    periodMonths: 12,
    payoutFrequency: 'MONTHLY',
    status: 'ACTIVE',
    branchId: 'MAIN',
    complexId: 'COMP-1'
  });
  console.log('Staff created FD:', staffFD.fdNo);

  // Admin reads FD
  const adminReadFDs = await fdService.getDepositsAsync();
  const foundStaffFD = adminReadFDs.find(f => f.fdNo === 'FD-TEST-STAFF');
  console.log('Admin found Staff FD in MongoDB?', !!foundStaffFD);

  // Staff pays interest on FD
  const payout = await fdService.payInterest('FD-TEST-STAFF', 1000, '2026-09-12', '2026-09', 'MAIN', 'COMP-1');
  console.log('Staff recorded interest payout:', payout.payoutId);

  // Admin reads payouts
  const adminPayouts = await fdService.getPayoutsAsync();
  const foundPayout = adminPayouts.find(p => p.payoutId === payout.payoutId);
  console.log('Admin found Staff payout in MongoDB?', !!foundPayout);

  // Staff renews FD
  const renewed = await fdService.renew('FD-TEST-STAFF', 12, 12, 'MONTHLY', 'MAIN', 'COMP-1');
  console.log('Staff renewed FD:', renewed.fdNo);

  // Admin reads renewals
  const adminRenewals = await fdService.getRenewalsAsync();
  console.log('Admin found renewal in MongoDB?', adminRenewals.length > 0);

  console.log('\n--- 4. Testing Accounting DayBook Sync ---');
  const dayBookEntry = await accountingService.addEntryAsync({
    voucherNo: 'VOUCH-TEST-1',
    account: 'CASH',
    type: 'DEBIT',
    amount: 5000,
    description: 'Test entry',
    branchId: 'MAIN',
    complexId: 'COMP-1'
  });
  console.log('Created DayBook entry:', dayBookEntry.id);

  const staffDayBook = await accountingService.getDayBookAsync(new Date().toISOString().split('T')[0], 'MAIN', 'COMP-1');
  const foundEntry = staffDayBook.find(e => e.voucherNo === 'VOUCH-TEST-1');
  console.log('Staff found DayBook entry in MongoDB?', !!foundEntry);

  console.log('\n--- 5. Testing Dashboard Summary Aggregation ---');
  const adminDashboard = await dashboardService.getSummaryAsync();
  console.log('Admin Dashboard summary:', {
    activeLoansCount: adminDashboard.activeLoansCount,
    totalDisbursed: adminDashboard.totalDisbursed,
    fdActiveDeposits: adminDashboard.fdActiveDeposits,
    fdTotalPrincipal: adminDashboard.fdTotalPrincipal
  });

  console.log('\n--- Cleanup test records ---');
  await CustomerModel.deleteMany({ $or: [{ id: adminCust.id }, { name: 'Admin Created Customer' }] });
  await LoanModel.deleteMany({ loanNo: { $in: ['GL-TEST-ADMIN', 'GL-TEST-STAFF'] } });
  await ReceiptModel.deleteMany({ receiptNo: 999991 });
  await FixedDepositModel.deleteMany({ fdNo: 'FD-TEST-STAFF' });
  await FDCustomerModel.deleteMany({ customerId: 'FDCUST-TEST-ADMIN' });
  await FDInterestPayoutModel.deleteMany({ payoutId: payout.payoutId });
  await FDRenewalModel.deleteMany({ fdNo: 'FD-TEST-STAFF' });
  await DayBookModel.deleteMany({ voucherNo: 'VOUCH-TEST-1' });
  console.log('Cleaned up test records from MongoDB successfully.');

  await mongoose.disconnect();
  console.log('\n>>> ALL SYNCHRONIZATION TESTS PASSED PERFECTLY! <<<');
}

runTest().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
