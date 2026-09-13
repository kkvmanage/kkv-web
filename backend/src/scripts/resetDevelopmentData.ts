import fs from 'fs';
import path from 'path';
import { getStorageSubdirectory } from '../config/storage.js';
import { localFileRepository } from '../repositories/localFile.repository.js';
import { rentalRepository } from '../modules/rental/repositories/rental.repository.js';
import { rentalDayBookRepository } from '../modules/rental/repositories/rentalDayBook.repository.js';
import { seedUsers } from './seedAdmin.js';
import { backupPackageService } from '../services/backupPackage.service.js';
import { env } from '../config/env.js';
import { telegramRepository } from '../telegram/telegram.repository.js';
import { localAuthService } from '../services/localAuth.service.js';

export interface ResetReport {
  environment: string;
  storage: string;
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

  console.log('[1/7] Initializing Telegram storage manager...');
  await telegramRepository.initialize();
  console.log(`✓ Telegram storage ready (Environment: ${env.NODE_ENV})`);

  // 2. Pre-Reset Safety Backup
  let backupRecord: any = null;
  try {
    console.log('\n[2/7] Generating pre-reset safety backup package...');
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

  // 3. Pre-Cleanup Counts Gathering
  console.log('\n[3/7] Inspecting existing operational data...');
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

  // 4. Clear Local File Storage
  console.log('\n[4/7] Clearing operational records in local cache...');
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

  // 5. Reset Telegram Storage Records
  console.log('[5/7] Clearing Telegram persistent operational records...');
  try {
    await telegramRepository.resetApplicationData();
    console.log('✓ Telegram application storage reset.');
  } catch (mErr: any) {
    console.warn('Notice resetting Telegram storage:', mErr?.message || mErr);
  }

  // 6. Reset ID Sequences and Numbering Counters to 0
  console.log('[6/7] Resetting ID counters and sequences to 0...');
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

  localFileRepository.clearCache();
  rentalRepository.clearCache();
  rentalDayBookRepository.clearCache();

  // 7. Re-verify Essential Authentication & Configuration
  console.log('[7/7] Verifying essential authentication users & configurations...');
  await seedUsers();

  const authUsers = localAuthService.listUsers();
  const preservedUsersList = authUsers.map((u) => ({
    email: u.email,
    role: u.role,
    staffId: u.staffId
  }));

  // Post-Reset Verification Check
  const finalCusts = telegramRepository.getRecords('CUSTOMER').length;
  const finalLoans = telegramRepository.getRecords('LOAN').length;
  const finalRcpts = telegramRepository.getRecords('RECEIPT').length;
  const finalFds = telegramRepository.getRecords('FIXED_DEPOSIT').length;
  const finalComplexes = telegramRepository.getRecords('RENTAL_COMPLEX').length;
  const finalShops = telegramRepository.getRecords('RENTAL_SHOP').length;
  const finalPayments = telegramRepository.getRecords('RENTAL_PAYMENT').length;
  const finalExpenses = telegramRepository.getRecords('RENTAL_EXPENSE').length;
  const finalDayBook = telegramRepository.getRecords('RENTAL_DAYBOOK').length;

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
    storage: 'Telegram Remote Store',
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
      'User credentials, password hashes & RBAC permissions in localAuth store',
      'Telegram Record Envelope schemas and indexes'
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
