import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB, getFinanceDb } from '../config/database.js';
import { getStorageBaseDir, getConfigDirectory, getStorageSubdirectory } from '../config/storage.js';
import { localFileRepository } from '../repositories/localFile.repository.js';
import { rentalRepository } from '../modules/rental/repositories/rental.repository.js';
import { rentalDayBookRepository } from '../modules/rental/repositories/rentalDayBook.repository.js';
import { seedUsers } from './seedAdmin.js';
import { backupPackageService } from '../services/backupPackage.service.js';

export interface ProductionResetResult {
  success: boolean;
  timestamp: string;
  backupId?: string;
  backupFileName?: string;
  clearedCollections: Record<string, number>;
  preservedConfigurations: string[];
  resetCounters: Record<string, number>;
  verifiedZeroState: boolean;
}

export async function executeProductionDatabaseReset(): Promise<ProductionResetResult> {
  console.log('================================================================');
  console.log('🚀 KKV GOLD FINANCE: INITIATING PRODUCTION DATABASE RESET');
  console.log('================================================================\n');

  // 1. Ensure Database Connection
  try {
    await connectDB();
    console.log('✓ Database connection established.');
  } catch (err: any) {
    console.warn('Notice: MongoDB connection attempt in reset:', err?.message || err);
  }

  // 2. Pre-Reset Safety Backup
  let backupRecord: any = null;
  try {
    console.log('[1/6] Creating pre-reset safety backup package...');
    backupRecord = await backupPackageService.createFullBackupPackage(
      { userId: 'SYSTEM_RESET', name: 'Production Launch Reset', role: 'ADMIN' },
      { backupType: 'PRE_WIPE_BACKUP' }
    );
    console.log(`✓ Pre-reset backup archive created: ${backupRecord.fileName} (${backupRecord.backupId})`);
  } catch (backupErr: any) {
    console.warn('Warning creating pre-reset backup package:', backupErr?.message || backupErr);
  }

  // 3. Count records before clearing
  const configDir = getConfigDirectory();
  const rentalDir = getStorageSubdirectory('rental');
  const dbDir = getStorageSubdirectory('database');

  const counts: Record<string, number> = {};

  const operationalFinanceFiles = [
    'customers.json',
    'loans.json',
    'receipts.json',
    'daybook_entries.json',
    'fixed_deposits.json',
    'fd_customers.json',
    'fd_interest_payouts.json',
    'fd_withdrawals.json',
    'reminders.json',
    'notifications.json',
    'sync_outbox.json'
  ];

  for (const f of operationalFinanceFiles) {
    const list = localFileRepository.readJson<any[]>(f, []);
    counts[f.replace('.json', '')] = Array.isArray(list) ? list.length : 0;
  }

  counts['rental_complexes'] = rentalRepository.getComplexes().length;
  counts['rental_shops'] = rentalRepository.getShops().length;
  counts['rental_payments'] = rentalRepository.getPayments().length;
  counts['rental_expenses'] = rentalRepository.getExpenses().length;
  counts['rental_audit_logs'] = rentalRepository.getAuditLogs().length;
  counts['rental_sync_queue'] = rentalRepository.getSyncQueue().length;

  console.log('\n[2/6] Operational business records identified to clear:');
  Object.entries(counts).forEach(([k, v]) => {
    console.log(`  - ${k}: ${v} records`);
  });

  // 4. Clear Local Finance Storage
  console.log('\n[3/6] Clearing operational Finance files in local storage...');
  for (const f of operationalFinanceFiles) {
    localFileRepository.writeJson(f, []);
    // Also clear under database/ mirror if present
    const p = path.join(dbDir, f);
    if (fs.existsSync(p)) {
      try {
        fs.writeFileSync(p, '[]', 'utf8');
      } catch (e) {}
    }
  }

  // 5. Clear Local Rental Storage & Lingering .tmp files
  console.log('[4/6] Clearing operational Rental files in local storage...');
  rentalRepository.writeJson('complexes.json', []);
  rentalRepository.writeJson('shops.json', []);
  rentalRepository.writeJson('rent_payments.json', []);
  rentalRepository.writeJson('expenses.json', []);
  rentalRepository.writeJson('audit_logs.json', []);
  rentalRepository.writeJson('sync_queue.json', []);
  rentalDayBookRepository.writeJson('rental_daybook.json', []);

  // Clean up any stray .tmp files in rental folder
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
    console.warn('Warning cleaning temp files:', tmpErr);
  }

  // 6. Reset Numbering Sequences and Counters
  console.log('[5/6] Resetting all numbering sequences & ID counters to 0 (Next sequence = 1)...');
  const resetCounters = {
    customerId: 0,
    loanSequence: 0,
    loanNo: 0,
    receiptNo: 0,
    fdNo: 0
  };
  localFileRepository.writeJson('counters.json', resetCounters);

  const resetRentalCounters = {
    complex: 0,
    shop: 0,
    payment: 0,
    expense: 0,
    audit: 0,
    sync: 0
  };
  rentalRepository.writeJson('counters.json', resetRentalCounters);

  // 7. Clear MongoDB Operational Collections (if connected)
  const db = await getFinanceDb();
  if (db) {
    console.log('[6/6] Clearing MongoDB Atlas operational collections...');
    const mongoCollectionsToClear = [
      'customers',
      'loans',
      'receipts',
      'fixed_deposits',
      'fd_customers',
      'fd_interest_payouts',
      'fd_withdrawals',
      'daybook_entries',
      'reminders',
      'notifications',
      'idempotency_keys',
      'rental_daybook',
      'rental_complexes',
      'rental_shops',
      'rental_payments',
      'rental_expenses'
    ];

    for (const colName of mongoCollectionsToClear) {
      try {
        await db.collection(colName).deleteMany({});
      } catch (err: any) {
        // collection might not exist yet
      }
    }

    // Reset MongoDB counters collection
    try {
      await db.collection('counters').deleteMany({});
      await db.collection('counters').insertMany([
        { _id: 'customerId' as any, seq: 0 },
        { _id: 'loanSequence' as any, seq: 0 },
        { _id: 'loanNo' as any, seq: 0 },
        { _id: 'receiptNo' as any, seq: 0 },
        { _id: 'fdNo' as any, seq: 0 }
      ]);
    } catch (cntErr) {
      console.warn('Warning resetting MongoDB counters:', cntErr);
    }
  }

  // 8. Re-verify & Seed Required System Users (Admin, Staff, Rental Staff)
  console.log('\n[Verification] Verifying essential system accounts and roles...');
  await seedUsers();

  // 9. Verify Zero State
  const finalCustomers = localFileRepository.readJson<any[]>('customers.json', []).length;
  const finalLoans = localFileRepository.readJson<any[]>('loans.json', []).length;
  const finalReceipts = localFileRepository.readJson<any[]>('receipts.json', []).length;
  const finalComplexes = rentalRepository.getComplexes().length;
  const finalShops = rentalRepository.getShops().length;
  const finalPayments = rentalRepository.getPayments().length;
  const finalExpenses = rentalRepository.getExpenses().length;

  const verifiedZeroState =
    finalCustomers === 0 &&
    finalLoans === 0 &&
    finalReceipts === 0 &&
    finalComplexes === 0 &&
    finalShops === 0 &&
    finalPayments === 0 &&
    finalExpenses === 0;

  console.log('\n================================================================');
  console.log(`✅ PRODUCTION DATABASE RESET COMPLETE (Zero State Verified: ${verifiedZeroState})`);
  console.log('================================================================\n');

  return {
    success: true,
    timestamp: new Date().toISOString(),
    backupId: backupRecord?.backupId,
    backupFileName: backupRecord?.fileName,
    clearedCollections: counts,
    preservedConfigurations: [
      'admin_users / Staff authentication credentials',
      'User roles and granular RBAC permissions',
      'Master Control Interest & Loan Rates profile',
      'Branch Settings & Contact Profile',
      'WhatsApp Templates & Printer Configurations',
      'Database schemas, indexes, and models'
    ],
    resetCounters,
    verifiedZeroState
  };
}

if (process.argv[1] && process.argv[1].includes('productionReset')) {
  executeProductionDatabaseReset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Production reset failure:', err);
      process.exit(1);
    });
}
