import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import { getBackupsDirectory, ensureDirectoryExists } from '../config/storage.js';
import { localFileRepository } from '../repositories/localFile.repository.js';
import { customerService } from './customer.service.js';
import { loanService } from './loan.service.js';
import { receiptService } from './receipt.service.js';
import { fdService } from './fd.service.js';
import { accountingService } from './accounting.service.js';
import { counterService } from './counter.service.js';
import { RentalRepository } from '../modules/rental/repositories/rental.repository.js';
import { RentalDayBookRepository } from '../modules/rental/repositories/rentalDayBook.repository.js';
import { FileAttachmentModel } from '../models/FileAttachment.js';
import { CustomerModel } from '../models/Customer.js';
import { googleDriveService } from './googleDrive.service.js';
import { env } from '../config/env.js';
import { calculateSha256 } from '../utils/backupExport.util.js';

export interface BackupHistoryRecord {
  backupId: string;
  fileName: string;
  fileSize: number;
  sha256: string;
  createdAt: string;
  createdBy: {
    userId: string;
    name: string;
    role: string;
  };
  recordCounts: {
    customers: number;
    loans: number;
    receipts: number;
    loanPayments: number;
    goldOrnaments: number;
    fixedDeposits: number;
    fdCustomers?: number;
    fdInterestPayouts?: number;
    fdWithdrawals?: number;
    dayBookEntries: number;
    reminders?: number;
    notifications?: number;
    auditLogs?: number;
    rentalComplexes: number;
    rentalShops: number;
    rentPayments: number;
    rentalExpenses: number;
    rentalDayBook: number;
    fileAttachments: number;
    totalRecords: number;
  };
  sequences: {
    loanSequence: number;
    receiptNo: number;
    customerId: number;
    complex: number;
    shop: number;
    payment: number;
    expense: number;
  };
  backupType?: 'FULL_BACKUP' | 'PRE_RESTORE_BACKUP' | 'RESTORED_STATE' | 'EMERGENCY_BACKUP' | 'PRE_WIPE_BACKUP';
  downloadAcknowledged: boolean;
  downloadAcknowledgedAt?: string;
  downloadAcknowledgedBy?: string;
  driveBackupFileId?: string;
  driveFolderId?: string;
  status: 'CREATED' | 'VERIFIED' | 'LOCAL_VERIFIED' | 'FAILED' | 'RESTORED';
}

function formatBackupTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}-${MM}-${DD}_${hh}-${mm}-${ss}`;
}

const rentalRepo = new RentalRepository();
const rentalDayBookRepo = new RentalDayBookRepository();

class BackupPackageService {
  private historyFile = 'backups_history.json';
  private downloadAcknowledgments: Map<string, { userId: string; timestamp: string }> = new Map();

  private get backupsDir(): string {
    return getBackupsDirectory();
  }

  constructor() {
    try {
      ensureDirectoryExists(this.backupsDir);
    } catch (err) {
      console.warn('[BackupPackageService] Notice: Backups directory initialization warning:', (err as any)?.message || err);
    }
  }

  /**
   * Generates ONE single Authoritative JSON Backup File containing:
   * - Backup metadata (ID, version, timestamp, environment, databaseType)
   * - Finance domain (customers, loans, receipts, payments, ornaments, fixedDeposits, dayBook)
   * - Rental domain (complexes, shops, rentPayments, expenses, dayBook, counters)
   * - Attachment metadata & Google Drive file references (no binary blobs)
   * - Sequence counters (exact state for continuous numbering)
   * - Required non-sensitive master data
   * - Cryptographic SHA-256 integrity checksum
   *
   * Also optionally uploads the JSON backup file to Google Drive System Backups if configured.
   */
  public async createFullBackupPackage(
    user?: { userId?: string; name?: string; role?: string },
    options?: { backupType?: 'FULL_BACKUP' | 'PRE_RESTORE_BACKUP' | 'RESTORED_STATE' | 'EMERGENCY_BACKUP' | 'PRE_WIPE_BACKUP' }
  ): Promise<BackupHistoryRecord> {
    const timestamp = new Date();
    const backupType = options?.backupType || 'FULL_BACKUP';
    const timestampStr = formatBackupTimestamp(timestamp);
    const dateStr = timestamp.toISOString().slice(0, 10);
    const backupId = `BKP-${dateStr.replace(/-/g, '')}-${timestamp.getTime().toString().slice(-4)}`;
    const fileName = backupType === 'PRE_WIPE_BACKUP'
      ? `KKV_GOLD_FINANCE_WIPE_BACKUP_${timestampStr}.zip`
      : `KKV_GOLD_FINANCE_FULL_BACKUP_${timestampStr}.zip`;

    console.log(`[BackupPackageService] 📦 Starting complete backup ZIP generation: ${backupId} (${fileName})...`);

    // 1. Fetch Finance Entities (Combining Local Storage + MongoDB Customers)
    let customers = customerService.getAll() || [];
    try {
      const mongoCustomers = await CustomerModel.find({}).lean();
      if (mongoCustomers && mongoCustomers.length > 0) {
        const custMap = new Map<string, any>();
        customers.forEach(c => custMap.set(c.id || (c as any).customerId, c));
        mongoCustomers.forEach((mc: any) => {
          const id = mc.customerId || mc.id || mc._id?.toString();
          custMap.set(id, { ...mc, id });
        });
        customers = Array.from(custMap.values());
      }
    } catch (mErr) {
      console.warn('[BackupPackageService] MongoDB Customer fetch notice:', (mErr as any)?.message || mErr);
    }

    const loans = loanService.getAll() || [];
    const receipts = receiptService.getAll() || [];
    const fixedDeposits = fdService.getDeposits() || [];
    const fdCustomers = fdService.getCustomers() || [];
    const fdInterestPayouts = fdService.getPayouts() || [];
    const fdWithdrawals = fdService.getWithdrawals() || [];
    const dayBookEntries = accountingService.getDayBook() || [];
    const reminders = localFileRepository.readJson<any[]>('reminders.json', []) || [];
    const notifications = localFileRepository.readJson<any[]>('notifications.json', []) || [];
    const auditLogs = localFileRepository.readJson<any[]>('audit_logs.json', []) || [];

    // Auxiliary Finance entity extractions
    const customerKycList: any[] = [];
    customers.forEach(c => {
      if ((c as any).kyc) customerKycList.push({ customerId: c.id || (c as any).customerId, ...(c as any).kyc });
    });

    const loanPaymentsList: any[] = [];
    const loanInterestHistoryList: any[] = [];
    const goldPledgeItemsList: any[] = [];
    loans.forEach(l => {
      if (Array.isArray(l.items)) {
        l.items.forEach(it => goldPledgeItemsList.push({ loanId: l.id, loanNo: l.loanNo, ...it }));
      }
      if (Array.isArray((l as any).payments)) {
        (l as any).payments.forEach((p: any) => loanPaymentsList.push({ loanId: l.id, loanNo: l.loanNo, ...p }));
      }
      if (Array.isArray((l as any).interestHistory)) {
        (l as any).interestHistory.forEach((h: any) => loanInterestHistoryList.push({ loanId: l.id, loanNo: l.loanNo, ...h }));
      }
    });

    // 2. Fetch Rental Entities
    const rentalComplexes = rentalRepo.getComplexes() || [];
    const rentalShops = rentalRepo.getShops() || [];
    const rentPayments = rentalRepo.getPayments() || [];
    const rentalExpenses = rentalRepo.getExpenses() || [];
    const rentalAuditLogs = rentalRepo.getAuditLogs() || [];
    let rentalDayBook: any[] = [];
    try {
      rentalDayBook = await rentalDayBookRepo.getManualEntries();
    } catch {
      rentalDayBook = rentalDayBookRepo.readJson('rental_daybook.json', []) || [];
    }
    const rentalCounters = rentalRepo.readJson('counters.json', {
      complex: 0,
      shop: 0,
      payment: 0,
      expense: 0,
      audit: 0,
      sync: 0
    });

    // 3. Fetch File Attachments Metadata (with Drive references)
    let fileAttachments: any[] = [];
    try {
      fileAttachments = await FileAttachmentModel.find({}).lean();
    } catch (attErr) {
      console.warn('[BackupPackageService] MongoDB FileAttachment fetch notice:', (attErr as any)?.message || attErr);
      fileAttachments = localFileRepository.readJson<any[]>('file_attachments.json', []) || [];
    }

    // 4. Fetch Permitted Master Data (No Secrets/Passwords)
    const masterSettings = localFileRepository.readJson('master_settings.json', null);
    const systemConfig = localFileRepository.readJson('system_config.json', null);
    const printerSettings = localFileRepository.readJson('printer_settings.json', null);
    const branchProfile = localFileRepository.readJson('branch_profile.json', null);
    const permittedMasterData = {
      masterSettings,
      systemConfig,
      printerSettings,
      branchProfile
    };

    // 5. Sequence Counters
    const currentCounters = localFileRepository.readJson<any>('counters.json', {
      customerId: 0,
      loanSequence: 0,
      loanNo: 0,
      receiptNo: 0,
      fdNo: 0
    });

    const sequences = {
      loanSequence: currentCounters.loanSequence || currentCounters.loanNo || counterService.getHighestExistingLoanNumber(),
      receiptNo: currentCounters.receiptNo || (receipts.length > 0 ? Math.max(...receipts.map((r: any) => parseInt(r.receiptNo || r.id || '0', 10) || 0)) : 0),
      customerId: currentCounters.customerId || customers.length,
      complex: rentalCounters.complex || 0,
      shop: rentalCounters.shop || 0,
      payment: rentalCounters.payment || 0,
      expense: rentalCounters.expense || 0
    };

    // Calculate record counts
    const recordCounts: BackupHistoryRecord['recordCounts'] = {
      customers: customers.length,
      loans: loans.length,
      receipts: receipts.length,
      loanPayments: loanPaymentsList.length,
      goldOrnaments: goldPledgeItemsList.length,
      fixedDeposits: fixedDeposits.length,
      fdCustomers: fdCustomers.length,
      fdInterestPayouts: fdInterestPayouts.length,
      fdWithdrawals: fdWithdrawals.length,
      dayBookEntries: dayBookEntries.length,
      reminders: reminders.length,
      notifications: notifications.length,
      auditLogs: auditLogs.length,
      rentalComplexes: rentalComplexes.length,
      rentalShops: rentalShops.length,
      rentPayments: rentPayments.length,
      rentalExpenses: rentalExpenses.length,
      rentalDayBook: rentalDayBook.length,
      fileAttachments: fileAttachments.length,
      totalRecords:
        customers.length +
        loans.length +
        receipts.length +
        fixedDeposits.length +
        fdCustomers.length +
        fdInterestPayouts.length +
        fdWithdrawals.length +
        dayBookEntries.length +
        reminders.length +
        notifications.length +
        rentalComplexes.length +
        rentalShops.length +
        rentPayments.length +
        rentalExpenses.length +
        rentalDayBook.length +
        fileAttachments.length
    };

    // 6. Build Complete Single JSON Backup Structure
    const backupPayload: any = {
      backup: {
        application: 'KKV Gold Finance & Rental Management',
        backupVersion: '2.0.0',
        backupId,
        backupType,
        createdAt: timestamp.toISOString(),
        timestamp: timestamp.getTime(),
        createdBy: {
          userId: user?.userId || 'ADMIN-001',
          name: user?.name || 'Administrator',
          role: user?.role || 'Admin'
        },
        environment: env.NODE_ENV,
        databaseType: 'Hybrid (MongoDB + Local JSON)'
      },
      recordCounts,
      sequences,
      finance: {
        customers,
        customerKyc: customerKycList,
        loans,
        loanPayments: loanPaymentsList,
        loanInterestHistory: loanInterestHistoryList,
        goldPledgeItems: goldPledgeItemsList,
        receipts,
        fixedDeposits,
        fdCustomers,
        fdInterestPayouts,
        fdWithdrawals,
        dayBook: dayBookEntries,
        reminders,
        notifications,
        auditLogs
      },
      rental: {
        complexes: rentalComplexes,
        shops: rentalShops,
        rentPayments,
        expenses: rentalExpenses,
        dayBook: rentalDayBook,
        auditLogs: rentalAuditLogs,
        counters: rentalCounters
      },
      attachments: fileAttachments,
      system: {
        requiredMasterData: permittedMasterData
      },
      // Root-level backward-compatibility fields
      data: {
        customers,
        loans,
        receipts,
        fixedDeposits,
        fdCustomers,
        fdInterestPayouts,
        fdWithdrawals,
        dayBookEntries,
        reminders,
        notifications,
        auditLogs,
        rentalComplexes,
        rentalShops,
        rentPayments,
        rentalExpenses,
        rentalDayBook,
        fileAttachments
      }
    };

    // 6. Build Snapshot JSON & ZIP Package
    const finalJsonString = JSON.stringify(backupPayload, null, 2);
    const jsonBuffer = Buffer.from(finalJsonString, 'utf-8');
    const snapshotSha256 = calculateSha256(jsonBuffer);

    // Embed snapshot checksum into integrity section
    backupPayload.integrity = {
      checksum: snapshotSha256,
      schemaVersion: '2.0.0'
    };

    const serializedJson = JSON.stringify(backupPayload, null, 2);
    const finalSnapshotBuffer = Buffer.from(serializedJson, 'utf-8');
    const finalSnapshotSha256 = calculateSha256(finalSnapshotBuffer);

    // Build Manifest
    const manifestData = {
      application: 'KKV Gold Finance',
      backupType,
      backupVersion: '2.0.0',
      backupId,
      fileName,
      createdAt: timestamp.toISOString(),
      createdBy: {
        userId: user?.userId || 'ADMIN-001',
        name: user?.name || 'Administrator',
        role: user?.role || 'Admin'
      },
      recordCounts,
      sequences,
      sha256: finalSnapshotSha256,
      includesDriveReferences: true,
      includesSecrets: false
    };

    // Build JSZip Archive
    const zip = new JSZip();
    zip.file('snapshot.json', serializedJson);
    zip.file('manifest.json', JSON.stringify(manifestData, null, 2));
    zip.file('version.json', JSON.stringify({ schemaVersion: '2.0.0', application: 'KKV Gold Finance', version: '2.0.0', createdAt: timestamp.toISOString() }, null, 2));
    zip.file('checksums.json', JSON.stringify({ 'snapshot.json': finalSnapshotSha256, schemaVersion: '2.0.0' }, null, 2));

    // Structured Domain Folders
    const financeFolder = zip.folder('finance')!;
    financeFolder.file('customers.json', JSON.stringify(customers, null, 2));
    financeFolder.file('loans.json', JSON.stringify(loans, null, 2));
    financeFolder.file('receipts.json', JSON.stringify(receipts, null, 2));
    financeFolder.file('fixed_deposits.json', JSON.stringify(fixedDeposits, null, 2));
    financeFolder.file('daybook.json', JSON.stringify(dayBookEntries, null, 2));

    const rentalFolder = zip.folder('rental')!;
    rentalFolder.file('complexes.json', JSON.stringify(rentalComplexes, null, 2));
    rentalFolder.file('shops.json', JSON.stringify(rentalShops, null, 2));
    rentalFolder.file('payments.json', JSON.stringify(rentPayments, null, 2));
    rentalFolder.file('expenses.json', JSON.stringify(rentalExpenses, null, 2));
    rentalFolder.file('daybook.json', JSON.stringify(rentalDayBook, null, 2));

    const attFolder = zip.folder('attachments')!;
    attFolder.file('file_attachments.json', JSON.stringify(fileAttachments, null, 2));

    const sysFolder = zip.folder('system')!;
    sysFolder.file('master_data.json', JSON.stringify(permittedMasterData, null, 2));

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
    const zipSha256 = calculateSha256(zipBuffer);

    // Save ZIP package to local storage
    const localZipPath = path.join(this.backupsDir, fileName);
    fs.writeFileSync(localZipPath, zipBuffer);

    // Also write JSON snapshot for direct fallback
    const jsonFileName = `KKV_GOLD_FINANCE_BACKUP_${timestampStr}.json`;
    const localJsonPath = path.join(this.backupsDir, jsonFileName);
    fs.writeFileSync(localJsonPath, finalSnapshotBuffer);

    console.log(`[BackupPackageService] ✅ Backup ZIP package created: ${fileName} (${zipBuffer.length} bytes, SHA-256: ${zipSha256})`);

    // 7. Upload Backup ZIP to Google Drive (System Backups / Wipe Backups / YYYY / MM)
    let driveBackupFileId: string | undefined;
    let driveFolderId: string | undefined;
    try {
      if (googleDriveService.isReady()) {
        const rootFolderId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
        const systemBackupsFolderId = await googleDriveService.getOrCreateFolder('System Backups', rootFolderId);
        const folderName = backupType === 'PRE_WIPE_BACKUP' ? 'Wipe Backups' : 'Full Backups';
        const targetBackupsFolderId = await googleDriveService.getOrCreateFolder(folderName, systemBackupsFolderId);
        const yearFolderId = await googleDriveService.getOrCreateFolder(timestamp.getFullYear().toString(), targetBackupsFolderId);
        const monthFolderId = await googleDriveService.getOrCreateFolder(
          (timestamp.getMonth() + 1).toString().padStart(2, '0'),
          yearFolderId
        );
        driveFolderId = monthFolderId;

        const uploadRes = await googleDriveService.uploadBuffer(zipBuffer, fileName, 'application/zip', monthFolderId);
        driveBackupFileId = uploadRes.fileId;
        console.log(`[BackupPackageService] ☁️ Uploaded backup ZIP to Google Drive: ${uploadRes.fileId}`);
      }
    } catch (driveErr) {
      console.warn('[BackupPackageService] Google Drive backup upload warning:', (driveErr as any)?.message || driveErr);
    }

    // 8. Record in History
    const historyRecord: BackupHistoryRecord = {
      backupId,
      fileName,
      fileSize: zipBuffer.length,
      sha256: zipSha256,
      createdAt: timestamp.toISOString(),
      createdBy: {
        userId: user?.userId || 'ADMIN-001',
        name: user?.name || 'Administrator',
        role: user?.role || 'Admin'
      },
      recordCounts,
      sequences,
      backupType,
      downloadAcknowledged: false,
      driveBackupFileId,
      driveFolderId,
      status: 'LOCAL_VERIFIED'
    };

    this.saveHistoryRecord(historyRecord);

    // 9. Write System Audit Log
    const auditRecord = {
      id: `AUDIT-BKP-${Date.now()}`,
      timestamp: timestamp.toISOString(),
      action: 'BACKUP_CREATED',
      user: user?.name || 'Administrator',
      backupId,
      fileName,
      fileSize: zipBuffer.length,
      sha256: zipSha256,
      driveBackupFileId: driveBackupFileId || null,
      details: `Full backup ZIP package created with ${recordCounts.totalRecords} total operational records (Finance + Rental + Attachments).`
    };
    const currentLogs = localFileRepository.readJson<any[]>('audit_logs.json', []);
    localFileRepository.writeJson('audit_logs.json', [auditRecord, ...currentLogs.slice(0, 500)]);

    return historyRecord;
  }

  /**
   * Retrieves the raw JSON buffer for authenticated download.
   */
  public getBackupFile(backupIdOrFileName: string): { buffer: Buffer; fileName: string; fileSize: number; sha256: string } | null {
    const history = this.getBackupHistory();
    const record = history.find(r => r.backupId === backupIdOrFileName || r.fileName === backupIdOrFileName);

    let targetFileName = record ? record.fileName : backupIdOrFileName;
    if (!targetFileName.endsWith('.json') && !targetFileName.endsWith('.zip')) {
      targetFileName = `${targetFileName}.json`;
    }

    const filePath = path.join(this.backupsDir, targetFileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`[BackupPackageService] File not found: ${filePath}`);
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    const sha256 = calculateSha256(buffer);

    return {
      buffer,
      fileName: targetFileName,
      fileSize: buffer.length,
      sha256
    };
  }

  // Alias for backward compatibility
  public getBackupZip(backupIdOrFileName: string) {
    return this.getBackupFile(backupIdOrFileName);
  }

  /**
   * Records explicit administrator download acknowledgment.
   */
  public acknowledgeDownload(backupId: string, user?: { userId?: string; name?: string }): { success: boolean; acknowledgedAt: string } {
    const history = this.getBackupHistory();
    const record = history.find(r => r.backupId === backupId || r.fileName === backupId);

    const now = new Date().toISOString();
    this.downloadAcknowledgments.set(backupId, {
      userId: user?.userId || 'ADMIN-001',
      timestamp: now
    });

    if (record) {
      record.downloadAcknowledged = true;
      record.downloadAcknowledgedAt = now;
      record.downloadAcknowledgedBy = user?.name || 'Administrator';
      this.updateHistoryRecord(record);
    }

    const auditRecord = {
      id: `AUDIT-DL-${Date.now()}`,
      timestamp: now,
      action: 'BACKUP_DOWNLOADED_ACKNOWLEDGED',
      user: user?.name || 'Administrator',
      backupId,
      details: 'Administrator explicitly acknowledged downloading the verified JSON backup package.'
    };
    const currentLogs = localFileRepository.readJson<any[]>('audit_logs.json', []);
    localFileRepository.writeJson('audit_logs.json', [auditRecord, ...currentLogs.slice(0, 500)]);

    console.log(`[BackupPackageService] 📥 Download acknowledged for backup: ${backupId}`);
    return { success: true, acknowledgedAt: now };
  }

  /**
   * Checks whether a backup download was explicitly acknowledged.
   */
  public isDownloadAcknowledged(backupId: string): boolean {
    if (this.downloadAcknowledgments.has(backupId)) return true;
    const history = this.getBackupHistory();
    const record = history.find(r => r.backupId === backupId);
    return !!record?.downloadAcknowledged;
  }

  /**
   * Returns list of all historical backups.
   */
  public getBackupHistory(): BackupHistoryRecord[] {
    return localFileRepository.readJson<BackupHistoryRecord[]>(this.historyFile, []);
  }

  private saveHistoryRecord(record: BackupHistoryRecord): void {
    const list = this.getBackupHistory();
    const existingIdx = list.findIndex(r => r.backupId === record.backupId);
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    localFileRepository.writeJson(this.historyFile, list);
  }

  private updateHistoryRecord(record: BackupHistoryRecord): void {
    this.saveHistoryRecord(record);
  }
}

export const backupPackageService = new BackupPackageService();
export default backupPackageService;
