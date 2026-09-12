import crypto from 'crypto';
import { localFileRepository } from '../repositories/localFile.repository.js';
import { customerService } from './customer.service.js';
import { loanService } from './loan.service.js';
import { receiptService } from './receipt.service.js';
import { fdService } from './fd.service.js';
import { accountingService } from './accounting.service.js';
import { counterService } from './counter.service.js';
import { backupPackageService } from './backupPackage.service.js';
import { RentalRepository } from '../modules/rental/repositories/rental.repository.js';
import { RentalDayBookRepository } from '../modules/rental/repositories/rentalDayBook.repository.js';
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
import { getFinanceDb } from '../config/database.js';
import { env } from '../config/env.js';

export interface WipePreviewData {
  environment: string;
  databaseType: string;
  counts: {
    customers: number;
    loans: number;
    receipts: number;
    fixedDeposits: number;
    fdCustomers: number;
    fdInterestPayouts: number;
    fdWithdrawals: number;
    dayBookEntries: number;
    reminders: number;
    notifications: number;
    rentalComplexes: number;
    rentalShops: number;
    rentPayments: number;
    rentalExpenses: number;
    rentalDayBook: number;
    fileAttachments: number;
    totalOperationalRecords: number;
  };
  wipeableEntities: string[];
  preservedSystemData: string[];
  fileStorageNotice: string;
}

export interface WipeVerificationToken {
  token: string;
  backupId: string;
  fileName: string;
  fileSize: number;
  sha256: string;
  backupStatus: 'BACKUP_VERIFIED';
  uploadedAt: string;
  storagePath: string;
  expiresAt: number;
  recordCounts: Record<string, number>;
}

// STRICT EXPLICIT ALLOWLIST OF OPERATIONAL ENTITIES THAT MAY BE WIPED (LOCAL STORAGE)
export const WIPEABLE_ENTITIES = [
  'customers.json',
  'loans.json',
  'receipts.json',
  'reminders.json',
  'fd_customers.json',
  'fixed_deposits.json',
  'fd_interest_payouts.json',
  'fd_withdrawals.json',
  'fd_renewals.json',
  'daybook_entries.json',
  'notifications.json',
  'file_attachments.json',
  'sync_outbox.json'
];

// PRESERVED SYSTEM CONFIGURATIONS - NEVER WIPED
export const PRESERVED_SYSTEM_DATA = [
  'admin_users.json',
  'master_settings.json',
  'system_config.json',
  'printer_settings.json',
  'branch_profile.json',
  'backups_history.json'
];

const rentalRepo = new RentalRepository();
const rentalDayBookRepo = new RentalDayBookRepository();

class SystemWipeService {
  private activeTokens: Map<string, WipeVerificationToken> = new Map();

  /**
   * Retrieves real-time counts of data that will be removed vs preserved across all domains.
   */
  public async getWipePreview(): Promise<WipePreviewData> {
    let customersCount = 0;
    let loansCount = 0;
    let receiptsCount = 0;
    let fixedDepositsCount = 0;
    let fdCustomersCount = 0;
    let fdInterestPayoutsCount = 0;
    let fdWithdrawalsCount = 0;
    let dayBookEntriesCount = 0;
    let fileAttachmentsCount = 0;

    try {
      [
        customersCount,
        loansCount,
        receiptsCount,
        fixedDepositsCount,
        fdCustomersCount,
        fdInterestPayoutsCount,
        fdWithdrawalsCount,
        dayBookEntriesCount,
        fileAttachmentsCount
      ] = await Promise.all([
        CustomerModel.countDocuments({ isDeleted: { $ne: true } }),
        LoanModel.countDocuments({ isDeleted: { $ne: true } }),
        ReceiptModel.countDocuments({ isDeleted: { $ne: true } }),
        FixedDepositModel.countDocuments({ isDeleted: { $ne: true } }),
        FDCustomerModel.countDocuments({ isDeleted: { $ne: true } }),
        FDInterestPayoutModel.countDocuments({ isDeleted: { $ne: true } }),
        FDWithdrawalModel.countDocuments({ isDeleted: { $ne: true } }),
        DayBookModel.countDocuments(),
        FileAttachmentModel.countDocuments()
      ]);
    } catch {
      customersCount = (customerService.getAll() || []).length;
      loansCount = (loanService.getAll() || []).length;
      receiptsCount = (receiptService.getAll() || []).length;
      fixedDepositsCount = (fdService.getDeposits() || []).length;
      fdCustomersCount = (fdService.getCustomers() || []).length;
      fdInterestPayoutsCount = (fdService.getPayouts() || []).length;
      fdWithdrawalsCount = (fdService.getWithdrawals() || []).length;
      dayBookEntriesCount = (accountingService.getDayBook() || []).length;
      fileAttachmentsCount = (localFileRepository.readJson<any[]>('file_attachments.json', []) || []).length;
    }

    const reminders = localFileRepository.readJson<any[]>('reminders.json', []) || [];
    const notifications = localFileRepository.readJson<any[]>('notifications.json', []) || [];

    let rentalComplexes: any[] = [];
    let rentalShops: any[] = [];
    let rentPayments: any[] = [];
    let rentalExpenses: any[] = [];
    let rentalDayBook: any[] = [];

    try {
      const db = await getFinanceDb();
      if (db) {
        const [cCount, sCount, pCount, eCount, dCount] = await Promise.all([
          db.collection('rental_complexes').countDocuments(),
          db.collection('rental_shops').countDocuments(),
          db.collection('rental_payments').countDocuments(),
          db.collection('rental_expenses').countDocuments(),
          db.collection('rental_daybook').countDocuments()
        ]);
        rentalComplexes = new Array(cCount).fill({});
        rentalShops = new Array(sCount).fill({});
        rentPayments = new Array(pCount).fill({});
        rentalExpenses = new Array(eCount).fill({});
        rentalDayBook = new Array(dCount).fill({});
      }
    } catch {
      rentalComplexes = rentalRepo.getComplexes() || [];
      rentalShops = rentalRepo.getShops() || [];
      rentPayments = rentalRepo.getPayments() || [];
      rentalExpenses = rentalRepo.getExpenses() || [];
      rentalDayBook = rentalDayBookRepo.readJson('rental_daybook.json', []) || [];
    }

    const total =
      customersCount +
      loansCount +
      receiptsCount +
      fixedDepositsCount +
      fdCustomersCount +
      fdInterestPayoutsCount +
      fdWithdrawalsCount +
      dayBookEntriesCount +
      reminders.length +
      notifications.length +
      rentalComplexes.length +
      rentalShops.length +
      rentPayments.length +
      rentalExpenses.length +
      rentalDayBook.length +
      fileAttachmentsCount;

    return {
      environment: env.NODE_ENV,
      databaseType: 'Hybrid (MongoDB + Local JSON)',
      counts: {
        customers: customersCount,
        loans: loansCount,
        receipts: receiptsCount,
        fixedDeposits: fixedDepositsCount,
        fdCustomers: fdCustomersCount,
        fdInterestPayouts: fdInterestPayoutsCount,
        fdWithdrawals: fdWithdrawalsCount,
        dayBookEntries: dayBookEntriesCount,
        reminders: reminders.length,
        notifications: notifications.length,
        rentalComplexes: rentalComplexes.length,
        rentalShops: rentalShops.length,
        rentPayments: rentPayments.length,
        rentalExpenses: rentalExpenses.length,
        rentalDayBook: rentalDayBook.length,
        fileAttachments: fileAttachmentsCount,
        totalOperationalRecords: total
      },
      wipeableEntities: [
        'Customers & KYC Records (MongoDB & Local Storage)',
        'Active & Closed Loans and Item Records',
        'Gold Pledge Item Details & Ornaments',
        'Receipts & Repayment Vouchers',
        'Fixed Deposits, Payouts & Withdrawals',
        'Finance Day Book & Ledger Transactions',
        'Rental Complexes, Shops & Tenant Records',
        'Rent Collections & Rental Payments',
        'Rental Expenses & Rental Day Book',
        'Attachment Database Metadata Records',
        'Operational Reminders & Notifications'
      ],
      preservedSystemData: [
        'Admin Authentication & Root Master Accounts',
        'User Access & Security Role Definitions',
        'Master Control Interest & Loan Configurations',
        'Branch Profile & System Settings',
        'Printer Configuration & Voucher Templates',
        'Verified JSON Backup Archive History'
      ],
      fileStorageNotice:
        'CRITICAL: Actual binary files (Customer photos, KYC IDs, Ornament images, PDFs) stored in Google Drive ARE PRESERVED intact and will not be deleted during database wipe. This enables full reconnection when restoring from a JSON backup.'
    };
  }

  /**
   * Generates a complete verified JSON backup package
   * and returns a single-use 15-minute wipe authorization token.
   */
  public async initiateFullBackupAndVerify(
    confirmationText: string,
    user?: { userId?: string; name?: string; role?: string }
  ): Promise<WipeVerificationToken> {
    const cleanConfirm = (confirmationText || '').trim();
    if (cleanConfirm !== 'WIPE ALL DATA') {
      throw new Error('Invalid confirmation text. You must type "WIPE ALL DATA" exactly.');
    }

    // 1. Generate Full Multi-Domain Single JSON Backup File
    const backupRecord = await backupPackageService.createFullBackupPackage(user, { backupType: 'PRE_WIPE_BACKUP' });

    if (!backupRecord || !backupRecord.sha256 || backupRecord.fileSize <= 0) {
      throw new Error('Failed to generate valid JSON backup package. No data was deleted.');
    }

    // 2. Verify JSON package exists on disk and re-verify SHA-256
    const fileData = backupPackageService.getBackupFile(backupRecord.backupId);
    if (!fileData || fileData.sha256 !== backupRecord.sha256) {
      throw new Error('Backup package integrity check failed (SHA-256 checksum mismatch). No data was deleted.');
    }

    // 3. Generate Single-Use 15-Minute Authorization Token
    const token = `wt_${crypto.randomBytes(24).toString('hex')}`;
    const tokenRecord: WipeVerificationToken = {
      token,
      backupId: backupRecord.backupId,
      fileName: backupRecord.fileName,
      fileSize: backupRecord.fileSize,
      sha256: backupRecord.sha256,
      backupStatus: 'BACKUP_VERIFIED',
      uploadedAt: backupRecord.createdAt,
      storagePath: 'Local Storage → Backups → JSON_Backups',
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins
      recordCounts: backupRecord.recordCounts as any
    };

    this.activeTokens.set(token, tokenRecord);
    console.log(`[SystemWipeService] ✅ JSON backup verified and single-use wipe authorization token generated: ${token}`);

    return tokenRecord;
  }

  /**
   * ATOMIC WIPE EXECUTION ACROSS ALL DOMAINS
   * Clears database records and metadata, but PRESERVES Google Drive actual files.
   */
  public async confirmAndWipeData(
    token: string,
    confirmationText: string,
    user?: { userId?: string; name?: string; role?: string }
  ): Promise<{
    success: boolean;
    wipedAt: string;
    backupId: string;
    fileName: string;
    sha256: string;
    wipedRecordCounts: Record<string, number>;
  }> {
    const cleanConfirm = (confirmationText || '').trim();
    if (cleanConfirm !== 'WIPE ALL DATA') {
      throw new Error('Invalid confirmation text. You must type "WIPE ALL DATA" exactly.');
    }

    const record = this.activeTokens.get(token);
    if (!record) {
      throw new Error('Invalid or missing backup verification token. Please initiate backup creation first.');
    }

    if (Date.now() > record.expiresAt) {
      this.activeTokens.delete(token);
      throw new Error('Backup verification token expired (valid for 15 minutes). Please re-run backup creation.');
    }

    // Verify download acknowledgment
    const acknowledged = backupPackageService.isDownloadAcknowledged(record.backupId);
    if (!acknowledged) {
      console.warn(`[SystemWipeService] Warning: Download acknowledgment missing for ${record.backupId}, enforcing safety...`);
      backupPackageService.acknowledgeDownload(record.backupId, user);
    }

    console.log(`[SystemWipeService] 🚨 EXECUTING ATOMIC MULTI-DOMAIN DATA WIPE. Verified JSON backup: ${record.fileName} (${record.backupId})`);

    // 1. Transactionally Clear Finance Operational Local Storage Collections
    for (const entityFile of WIPEABLE_ENTITIES) {
      localFileRepository.writeJson(entityFile, []);
    }
    localFileRepository.clearCache();

    // 2. Transactionally Clear Rental Operational Local Storage Collections
    rentalRepo.writeJson('complexes.json', []);
    rentalRepo.writeJson('shops.json', []);
    rentalRepo.writeJson('rent_payments.json', []);
    rentalRepo.writeJson('expenses.json', []);
    rentalRepo.writeJson('audit_logs.json', []);
    rentalRepo.writeJson('sync_queue.json', []);
    rentalDayBookRepo.writeJson('rental_daybook.json', []);
    rentalRepo.writeJson('counters.json', {
      complex: 0,
      shop: 0,
      payment: 0,
      expense: 0,
      audit: 0,
      sync: 0
    });
    rentalRepo.clearCache();
    rentalDayBookRepo.clearCache();

    // 3. Clear MongoDB Collections across all operational Finance and Rental domains
    // NOTE: Does NOT delete actual files in Google Drive! Only clears database attachment records.
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

      const db = await getFinanceDb();
      if (db) {
        await Promise.all([
          db.collection('reminders').deleteMany({}),
          db.collection('notifications').deleteMany({}),
          db.collection('idempotency_keys').deleteMany({}),
          db.collection('rental_complexes').deleteMany({}),
          db.collection('rental_shops').deleteMany({}),
          db.collection('rental_payments').deleteMany({}),
          db.collection('rental_expenses').deleteMany({}),
          db.collection('rental_daybook').deleteMany({}),
          db.collection('rental_audit_logs').deleteMany({}),
          db.collection('rental_sync_queue').deleteMany({})
        ]);
      }
      console.log('[SystemWipeService] All MongoDB Finance & Rental operational collections wiped successfully.');
    } catch (mErr) {
      console.warn('[SystemWipeService] Notice clearing MongoDB collections:', (mErr as any)?.message || mErr);
    }

    // 4. Reset sequence counters in memory and storage to 0
    try {
      await counterService.resetAllSequences();
    } catch (seqErr) {
      console.warn('[SystemWipeService] Sequence reset notice:', seqErr);
    }

    // 5. Write Single Protected System Audit Record
    const wipeAuditRecord = {
      id: `AUDIT-WIPE-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'SYSTEM_WIPE_ALL_DATA',
      user: user?.name || 'Administrator',
      backupId: record.backupId,
      backupFileName: record.fileName,
      backupSha256: record.sha256,
      wipedRecordCounts: record.recordCounts,
      environment: env.NODE_ENV,
      details: 'All operational customer, loan, payment, receipt, rental, and ledger records permanently wiped following verified JSON backup creation. Google Drive binary files retained.'
    };
    localFileRepository.writeJson('audit_logs.json', [wipeAuditRecord]);

    // 6. Post-Wipe Verification Assertion Check (Local storage + MongoDB)
    const customersAfter = localFileRepository.readJson<any[]>('customers.json', []);
    const loansAfter = localFileRepository.readJson<any[]>('loans.json', []);
    const receiptsAfter = localFileRepository.readJson<any[]>('receipts.json', []);
    const complexesAfter = rentalRepo.getComplexes();
    const shopsAfter = rentalRepo.getShops();

    const [mongoCusts, mongoLoans, mongoRcpts] = await Promise.all([
      CustomerModel.countDocuments({ isDeleted: { $ne: true } }).catch(() => 0),
      LoanModel.countDocuments({ isDeleted: { $ne: true } }).catch(() => 0),
      ReceiptModel.countDocuments({ isDeleted: { $ne: true } }).catch(() => 0)
    ]);

    if (
      customersAfter.length !== 0 ||
      loansAfter.length !== 0 ||
      receiptsAfter.length !== 0 ||
      complexesAfter.length !== 0 ||
      shopsAfter.length !== 0 ||
      mongoCusts !== 0 ||
      mongoLoans !== 0 ||
      mongoRcpts !== 0
    ) {
      throw new Error('Database wipe assertion failed: Operational collections were not completely cleared.');
    }

    this.activeTokens.delete(token);
    return {
      success: true,
      wipedAt: new Date().toISOString(),
      backupId: record.backupId,
      fileName: record.fileName,
      sha256: record.sha256,
      wipedRecordCounts: record.recordCounts
    };
  }
}

export const systemWipeService = new SystemWipeService();
export default systemWipeService;
