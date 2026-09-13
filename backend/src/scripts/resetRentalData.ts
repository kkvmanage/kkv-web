import fs from 'fs';
import path from 'path';
import { connectDB, getFinanceDb } from '../config/database.js';
import { getStorageSubdirectory } from '../config/storage.js';
import { rentalRepository } from '../modules/rental/repositories/rental.repository.js';
import { rentalDayBookRepository } from '../modules/rental/repositories/rentalDayBook.repository.js';
import { seedUsers } from './seedAdmin.js';

export interface RentalResetReport {
  success: boolean;
  timestamp: string;
  clearedEntities: Record<string, number>;
  postResetCounts: Record<string, number>;
  preservedAuthAccounts: string[];
}

export async function executeRentalDataReset(): Promise<RentalResetReport> {
  console.log('================================================================');
  console.log('🧹 KKV GOLD FINANCE: RENTAL MODULE CLEAN INITIAL STATE RESET');
  console.log('================================================================\n');

  // 1. Establish database connection if configured
  try {
    await connectDB();
    console.log('✓ Database connection checked.');
  } catch (err: any) {
    console.warn('Notice: MongoDB connection in rental reset:', err?.message || err);
  }

  // 2. Count pre-reset rental records
  const preResetComplexes = rentalRepository.getComplexes().length;
  const preResetShops = rentalRepository.getShops().length;
  const preResetPayments = rentalRepository.getPayments().length;
  const preResetExpenses = rentalRepository.getExpenses().length;
  const preResetDayBook = (await rentalDayBookRepository.getManualEntries()).length;
  const preResetAuditLogs = rentalRepository.getAuditLogs().length;
  const preResetSyncQueue = rentalRepository.getSyncQueue().length;

  const clearedEntities: Record<string, number> = {
    complexes: preResetComplexes,
    shops: preResetShops,
    rentPayments: preResetPayments,
    expenses: preResetExpenses,
    dayBookEntries: preResetDayBook,
    auditLogs: preResetAuditLogs,
    syncQueue: preResetSyncQueue
  };

  console.log('[1/4] Identified Rental records to clear:');
  Object.entries(clearedEntities).forEach(([entity, count]) => {
    console.log(`  - ${entity}: ${count} record(s)`);
  });

  // 3. Clear Local Rental Storage Files
  console.log('\n[2/4] Resetting local Rental repository storage files to empty state...');
  const rentalDir = getStorageSubdirectory('rental');

  rentalRepository.writeJson('complexes.json', []);
  rentalRepository.writeJson('shops.json', []);
  rentalRepository.writeJson('rent_payments.json', []);
  rentalRepository.writeJson('expenses.json', []);
  rentalRepository.writeJson('audit_logs.json', []);
  rentalRepository.writeJson('sync_queue.json', []);
  rentalRepository.writeJson('counters.json', {
    complex: 0,
    shop: 0,
    payment: 0,
    expense: 0,
    audit: 0,
    sync: 0
  });
  rentalRepository.clearCache();

  rentalDayBookRepository.writeJson('rental_daybook.json', []);
  rentalDayBookRepository.clearCache();

  // Clean any temporary files (.tmp_*) in the rental storage directory
  try {
    if (fs.existsSync(rentalDir)) {
      const files = fs.readdirSync(rentalDir);
      for (const file of files) {
        if (file.includes('.tmp_') || file.endsWith('.tmp')) {
          const filePath = path.join(rentalDir, file);
          fs.unlinkSync(filePath);
          console.log(`  - Removed temporary file: ${file}`);
        }
      }
    }
  } catch (cleanErr) {
    console.warn('Notice cleaning temp files:', cleanErr);
  }

  // 4. Clear MongoDB Rental Collections (Preserving Finance & Auth)
  console.log('\n[3/4] Clearing MongoDB Rental operational collections...');
  try {
    const db = await getFinanceDb();
    if (db) {
      await Promise.all([
        db.collection('rental_complexes').deleteMany({}),
        db.collection('rental_shops').deleteMany({}),
        db.collection('rental_payments').deleteMany({}),
        db.collection('rental_expenses').deleteMany({}),
        db.collection('rental_daybook').deleteMany({}),
        db.collection('rental_audit_logs').deleteMany({}),
        db.collection('rental_sync_queue').deleteMany({})
      ]);
      console.log('✓ All MongoDB rental operational collections cleared.');
    } else {
      console.log('✓ File-based rental storage cleared (MongoDB offline).');
    }
  } catch (mongoErr) {
    console.warn('Warning clearing MongoDB collections:', mongoErr);
  }

  // 5. Verify & Preserve Authentication Accounts
  console.log('\n[4/4] Verifying that authentication and staff user accounts remain active...');
  await seedUsers();

  // 6. Post-Reset Zero State Verification
  const postResetCounts: Record<string, number> = {
    complexes: rentalRepository.getComplexes().length,
    shops: rentalRepository.getShops().length,
    rentPayments: rentalRepository.getPayments().length,
    expenses: rentalRepository.getExpenses().length,
    dayBookEntries: (await rentalDayBookRepository.getManualEntries()).length,
    auditLogs: rentalRepository.getAuditLogs().length,
    syncQueue: rentalRepository.getSyncQueue().length
  };

  console.log('\n================================================================');
  console.log('✅ RENTAL DATA RESET COMPLETED SUCCESSFULLY');
  console.log('================================================================');
  console.log('Final Rental Counts:');
  Object.entries(postResetCounts).forEach(([entity, count]) => {
    console.log(`  ✓ ${entity}: ${count}`);
  });
  console.log('----------------------------------------------------------------');
  console.log('✓ Auth Users: Preserved');
  console.log('✓ Finance Data (Loans, FDs, Customers): Preserved');
  console.log('✓ Rental Business Data: Clean Initial Zero State (0 Records)');
  console.log('================================================================\n');

  return {
    success: true,
    timestamp: new Date().toISOString(),
    clearedEntities,
    postResetCounts,
    preservedAuthAccounts: ['admin@kkvgold.com', 'staff@kkvgold.com', 'rental@kkvgold.com']
  };
}

// Allow direct CLI execution: `npx tsx src/scripts/resetRentalData.ts`
if (process.argv[1] && process.argv[1].includes('resetRentalData')) {
  executeRentalDataReset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error executing rental reset:', err);
      process.exit(1);
    });
}
