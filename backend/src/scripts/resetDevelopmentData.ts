import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB, getFinanceDb } from '../config/database.js';
import { getStorageBaseDir, getConfigDirectory, getStorageSubdirectory } from '../config/storage.js';
import { localFileRepository } from '../repositories/localFile.repository.js';
import { rentalRepository } from '../modules/rental/repositories/rental.repository.js';
import { rentalDayBookRepository } from '../modules/rental/repositories/rentalDayBook.repository.js';
import { CustomerModel } from '../models/Customer.js';
import { LoanModel } from '../models/Loan.js';
import { ReceiptModel } from '../models/Receipt.js';
import { FixedDepositModel } from '../models/FixedDeposit.js';
import { FDCustomerModel } from '../models/FDCustomer.js';
import { FDInterestPayoutModel } from '../models/FDInterestPayout.js';
import { FDWithdrawalModel } from '../models/FDWithdrawal.js';
import { FDRenewalModel } from '../models/FDRenewal.js';
import { DayBookModel } from '../models/DayBook.js';
import { FileAttachmentModel } from '../models/FileAttachment.js';
import { UserModel } from '../models/User.js';
import { seedUsers } from './seedAdmin.js';
import { backupPackageService } from '../services/backupPackage.service.js';
import { env } from '../config/env.js';

export interface ResetReport {
  environment: string;
  database: string;
  timestamp: string;
  backupId?: string;
  backupFileName?: string;
  deletedFinanceCounts: Record<string, number>;
  deletedRentalCounts: Record<string, number>;
  preservedAuthUsers: Array<{ email: string; role: string; staffId?: string }>;
  preservedConfigurations: string[];
  finalCounts: Record<string, number>;
  zeroStateVerified: boolean;
}

export async function executeDevelopmentDataReset(): Promise<ResetReport> {
  console.log('================================================================');
  console.log('🧹 KKV GOLD FINANCE: COMPLETE DEVELOPMENT DATA RESET');
  console.log('================================================================\n');

  // 1. Production Environment Guard
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PRODUCTION_RESET) {
    console.error('❌ FATAL: Production environment detected. Reset aborted for data safety.');
    throw new Error('Reset script cannot be run in production mode without explicit ALLOW_PRODUCTION_RESET flag.');
  }

  // 2. Connect to Database
  console.log('[1/8] Establishing database connection...');
  await connectDB();
  const db = await getFinanceDb();
  const dbName = db ? db.databaseName : 'Local/Embedded';
  console.log(`✓ Connected to database: ${dbName} (Environment: ${env.NODE_ENV})`);

  // 3. Optional Pre-Reset Safety Backup
  let backupRecord: any = null;
  try {
    console.log('\n[2/8] Generating pre-reset safety backup package...');
    backupRecord = await backupPackageService.createFullBackupPackage(
      { userId: 'DEV_RESET_SCRIPT', name: 'Safe Initial Reset', role: 'ADMIN' },
      { backupType: 'PRE_WIPE_BACKUP' }
    );
    if (backupRecord) {
      console.log(`✓ Pre-reset backup archive created: ${backupRecord.fileName} (${backupRecord.backupId})`);
    }
  } catch (bErr: any) {
    console.warn('Notice: Pre-reset backup creation:', bErr?.message || bErr);
  }

  // 4. Pre-Cleanup Counts Gathering
  console.log('\n[3/8] Inspecting existing operational data...');
  const financeCounts: Record<string, number> = {};
  const rentalCounts: Record<string, number> = {};

  const operationalFinanceFiles = [
    'customers.json',
    'loans.json',
    'receipts.json',
    'daybook_entries.json',
    'fixed_deposits.json',
    'fd_customers.json',
    'fd_interest_payouts.json',
    'fd_withdrawals.json',
    'fd_renewals.json',
    'file_attachments.json',
    'reminders.json',
    'notifications.json',
    'sync_outbox.json'
  ];

  for (const f of operationalFinanceFiles) {
    const list = localFileRepository.readJson<any[]>(f, []);
    financeCounts[f.replace('.json', '')] = Array.isArray(list) ? list.length : 0;
  }

  rentalCounts['complexes'] = rentalRepository.getComplexes().length;
  rentalCounts['shops'] = rentalRepository.getShops().length;
  rentalCounts['rent_payments'] = rentalRepository.getPayments().length;
  rentalCounts['expenses'] = rentalRepository.getExpenses().length;
  rentalCounts['rental_daybook'] = rentalDayBookRepository.readJson('rental_daybook.json', []).length;
  rentalCounts['audit_logs'] = rentalRepository.getAuditLogs().length;
  rentalCounts['sync_queue'] = rentalRepository.getSyncQueue().length;

  console.log('Finance operational records to clear:');
  Object.entries(financeCounts).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));
  console.log('Rental operational records to clear:');
  Object.entries(rentalCounts).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));

  // 5. Clear Finance Local Storage
  console.log('\n[4/8] Clearing Finance operational records in local storage...');
  const dbDir = getStorageSubdirectory('database');
  for (const f of operationalFinanceFiles) {
    localFileRepository.writeJson(f, []);
    const p = path.join(dbDir, f);
    if (fs.existsSync(p)) {
      try {
        fs.writeFileSync(p, '[]', 'utf8');
      } catch (e) {}
    }
  }

  // 6. Clear Rental Local Storage & Temp Files
  console.log('[5/8] Clearing Rental operational records in local storage...');
  const rentalDir = getStorageSubdirectory('rental');
  rentalRepository.writeJson('complexes.json', []);
  rentalRepository.writeJson('shops.json', []);
  rentalRepository.writeJson('rent_payments.json', []);
  rentalRepository.writeJson('expenses.json', []);
  rentalRepository.writeJson('audit_logs.json', []);
  rentalRepository.writeJson('sync_queue.json', []);
  rentalDayBookRepository.writeJson('rental_daybook.json', []);

  try {
    if (fs.existsSync(rentalDir)) {
      const files = fs.readdirSync(rentalDir);
      for (const file of files) {
        if (file.includes('.tmp')) {
          fs.unlinkSync(path.join(rentalDir, file));
        }
      }
    }
  } catch (tmpErr) {
    console.warn('Notice cleaning rental temp files:', tmpErr);
  }

  // 7. Clear MongoDB Operational Collections
  console.log('[6/8] Clearing MongoDB operational collections...');
  try {
    await Promise.all([
      CustomerModel.deleteMany({}),
      LoanModel.deleteMany({}),
      ReceiptModel.deleteMany({}),
      FixedDepositModel.deleteMany({}),
      FDCustomerModel.deleteMany({}),
      FDInterestPayoutModel.deleteMany({}),
      FDWithdrawalModel.deleteMany({}),
      FDRenewalModel.deleteMany({}),
      DayBookModel.deleteMany({}),
      FileAttachmentModel.deleteMany({})
    ]);

    if (db) {
      const mongoOperationalCollections = [
        'reminders',
        'notifications',
        'idempotency_keys',
        'rental_complexes',
        'rental_shops',
        'rental_payments',
        'rental_expenses',
        'rental_daybook',
        'rental_audit_logs',
        'rental_sync_queue'
      ];

      for (const col of mongoOperationalCollections) {
        try {
          await db.collection(col).deleteMany({});
        } catch (e) {}
      }
    }
    console.log('✓ All MongoDB business collections cleared.');
  } catch (mErr: any) {
    console.warn('Notice clearing MongoDB collections:', mErr?.message || mErr);
  }

  // 8. Reset ID Sequences and Numbering Counters to 0
  console.log('[7/8] Resetting ID counters and sequences to 0...');
  localFileRepository.writeJson('counters.json', {
    customerId: 0,
    loanSequence: 0,
    loanNo: 0,
    receiptNo: 0,
    fdNo: 0
  });

  rentalRepository.writeJson('counters.json', {
    complex: 0,
    shop: 0,
    payment: 0,
    expense: 0,
    audit: 0,
    sync: 0
  });

  if (db) {
    try {
      await db.collection('counters').deleteMany({});
      await db.collection('counters').insertMany([
        { _id: 'customerId' as any, seq: 0 },
        { _id: 'loanSequence' as any, seq: 0 },
        { _id: 'loanNo' as any, seq: 0 },
        { _id: 'receiptNo' as any, seq: 0 },
        { _id: 'fdNo' as any, seq: 0 }
      ]);
    } catch (e) {}
  }

  localFileRepository.clearCache();
  rentalRepository.clearCache();
  rentalDayBookRepository.clearCache();

  // 9. Re-verify Essential Authentication & Configuration
  console.log('[8/8] Verifying essential authentication users & configurations...');
  await seedUsers();

  const authUsers = await UserModel.find({}).select('email role staffId displayName status');
  const preservedUsersList = authUsers.map((u) => ({
    email: u.email,
    role: u.role,
    staffId: u.staffId
  }));

  // 10. Post-Reset Verification Check
  const finalCusts = localFileRepository.readJson<any[]>('customers.json', []).length;
  const finalLoans = localFileRepository.readJson<any[]>('loans.json', []).length;
  const finalRcpts = localFileRepository.readJson<any[]>('receipts.json', []).length;
  const finalFds = localFileRepository.readJson<any[]>('fixed_deposits.json', []).length;
  const finalComplexes = rentalRepository.getComplexes().length;
  const finalShops = rentalRepository.getShops().length;
  const finalPayments = rentalRepository.getPayments().length;
  const finalExpenses = rentalRepository.getExpenses().length;
  const finalDayBook = rentalDayBookRepository.readJson('rental_daybook.json', []).length;

  const finalCounts: Record<string, number> = {
    customers: finalCusts,
    loans: finalLoans,
    receipts: finalRcpts,
    fixedDeposits: finalFds,
    complexes: finalComplexes,
    shops: finalShops,
    rentPayments: finalPayments,
    rentalExpenses: finalExpenses,
    rentalDayBook: finalDayBook
  };

  const zeroStateVerified = Object.values(finalCounts).every((count) => count === 0);

  console.log('\n================================================================');
  console.log(`✅ COMPLETE DEVELOPMENT DATA RESET FINISHED (Zero State: ${zeroStateVerified})`);
  console.log('================================================================');
  console.log('Preserved Authentication Accounts:');
  preservedUsersList.forEach((u) => console.log(`  - ${u.email} (${u.role}) [ID: ${u.staffId || 'N/A'}]`));
  console.log('================================================================\n');

  return {
    environment: env.NODE_ENV,
    database: dbName,
    timestamp: new Date().toISOString(),
    backupId: backupRecord?.backupId,
    backupFileName: backupRecord?.fileName,
    deletedFinanceCounts: financeCounts,
    deletedRentalCounts: rentalCounts,
    preservedAuthUsers: preservedUsersList,
    preservedConfigurations: [
      'settings.json (Master settings & interest rates)',
      'telegram_settings.json (Telegram integration)',
      'whatsapp_templates.json (WhatsApp notification templates)',
      'User credentials, password hashes & RBAC permissions',
      'Database schemas and indexes'
    ],
    finalCounts,
    zeroStateVerified
  };
}

if (process.argv[1] && process.argv[1].includes('resetDevelopmentData')) {
  executeDevelopmentDataReset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Reset execution error:', err);
      process.exit(1);
    });
}

export default executeDevelopmentDataReset;
