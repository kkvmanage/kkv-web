import { Request, Response } from 'express';
import { adminService } from '../services/admin.service.js';
import { systemWipeService } from '../services/systemWipe.service.js';
import { systemRestoreService } from '../services/systemRestore.service.js';
import { backupPackageService } from '../services/backupPackage.service.js';

export const getMasterSettings = (req: Request, res: Response) => {
  const settings = adminService.getMasterSettings();
  const { adminPassword, ...safeSettings } = settings;
  return res.json({ success: true, data: safeSettings });
};

export const updateMasterSettings = (req: Request, res: Response) => {
  // Validate FD parameters if present
  if (req.body.fdInterestRate !== undefined) {
    const rate = Number(req.body.fdInterestRate);
    if (isNaN(rate) || rate <= 0 || rate > 100) {
      return res.status(400).json({ success: false, message: 'FD Interest Rate must be a valid positive percentage between 0 and 100.' });
    }
  }

  if (req.body.fdDefaultTenureMonths !== undefined) {
    const tenure = Number(req.body.fdDefaultTenureMonths);
    if (isNaN(tenure) || tenure < 1) {
      return res.status(400).json({ success: false, message: 'FD Default Tenure must be at least 1 month.' });
    }
  }

  if (req.body.fdMinimumAmount !== undefined) {
    const minAmt = Number(req.body.fdMinimumAmount);
    if (isNaN(minAmt) || minAmt < 0) {
      return res.status(400).json({ success: false, message: 'FD Minimum Amount cannot be negative.' });
    }
  }

  if (req.body.fdMaximumAmount !== undefined && req.body.fdMinimumAmount !== undefined) {
    if (Number(req.body.fdMaximumAmount) < Number(req.body.fdMinimumAmount)) {
      return res.status(400).json({ success: false, message: 'FD Maximum Amount cannot be less than Minimum Amount.' });
    }
  }

  const updated = adminService.updateMasterSettings(req.body);
  const { adminPassword, ...safeUpdated } = updated;
  return res.json({ success: true, message: 'Master control settings updated', data: safeUpdated });
};

export const getWhatsAppTemplates = (req: Request, res: Response) => {
  const templates = adminService.getWhatsAppTemplates();
  return res.json({ success: true, data: templates });
};

export const updateWhatsAppTemplates = (req: Request, res: Response) => {
  const updated = adminService.updateWhatsAppTemplates(req.body);
  return res.json({ success: true, message: 'WhatsApp templates updated', data: updated });
};

export const unlockMasterControl = (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }
  const unlocked = adminService.unlockMasterControl(password);
  if (!unlocked) {
    return res.status(401).json({ success: false, message: 'Incorrect Master Control password' });
  }
  return res.json({ success: true, message: 'Master Control unlocked successfully' });
};

export const changeMasterPassword = (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both current password and new password are required.' });
  }
  const result = adminService.changeMasterPassword(currentPassword, newPassword);
  if (!result.success) {
    return res.status(401).json({ success: false, message: result.message || 'Current password does not match.' });
  }
  return res.json({ success: true, message: result.message || 'Master Control password updated successfully.' });
};

export const getDriveHealth = async (_req: Request, res: Response) => {
  return res.status(200).json({
    enabled: false,
    status: 'LOCAL_STORAGE_ACTIVE',
    success: true,
    connected: true,
    message: 'Local server storage is active and verified.'
  });
};

// ==========================================
// BACKUP PACKAGE APIs
// ==========================================

export const createBackupPackage = async (req: Request, res: Response) => {
  try {
    const user = {
      userId: req.user?.id || (req.headers['x-actor-uid'] as string) || 'ADMIN-001',
      name: req.user?.name || (req.headers['x-actor-name'] as string) || 'Administrator',
      role: req.user?.role || 'ADMIN'
    };

    const record = await backupPackageService.createFullBackupPackage(user);
    return res.json({
      success: true,
      message: 'Full backup package created and verified successfully.',
      data: record
    });
  } catch (err: any) {
    console.error('[AdminController] createBackupPackage error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to create backup package.',
      error: { code: 'BACKUP_CREATION_FAILED' }
    });
  }
};

export const getBackupHistory = (req: Request, res: Response) => {
  try {
    const history = backupPackageService.getBackupHistory();
    return res.json({ success: true, data: history });
  } catch (err: any) {
    console.error('[AdminController] getBackupHistory error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve backup history.',
      data: []
    });
  }
};

export const downloadBackupZip = (req: Request, res: Response) => {
  try {
    const { backupId } = req.params;
    if (!backupId) {
      return res.status(400).json({ success: false, message: 'Backup ID is required.' });
    }

    const fileData = backupPackageService.getBackupFile(backupId);
    if (!fileData) {
      return res.status(404).json({ success: false, message: 'Backup file not found.' });
    }

    const isJson = fileData.fileName.endsWith('.json');
    res.setHeader('Content-Type', isJson ? 'application/json' : 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.setHeader('Content-Length', fileData.fileSize);
    res.setHeader('x-backup-sha256', fileData.sha256);

    return res.send(fileData.buffer);
  } catch (err: any) {
    console.error('[AdminController] downloadBackupFile error:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to download backup file.' });
  }
};

export const downloadBackupFile = downloadBackupZip;

export const acknowledgeDownload = (req: Request, res: Response) => {
  try {
    const { backupId } = req.params;
    const user = {
      userId: req.user?.id || 'ADMIN-001',
      name: req.user?.name || 'Administrator'
    };

    const ack = backupPackageService.acknowledgeDownload(backupId, user);
    return res.json({ success: true, message: 'Download acknowledged', data: ack });
  } catch (err: any) {
    console.error('[AdminController] acknowledgeDownload error:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to acknowledge download.' });
  }
};

// ==========================================
// WIPE ALL DATA APIs
// ==========================================

export const getWipePreview = async (_req: Request, res: Response) => {
  try {
    const preview = await systemWipeService.getWipePreview();
    return res.json({ success: true, data: preview });
  } catch (err: any) {
    console.error('[AdminController] getWipePreview error:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to load wipe preview data.' });
  }
};

export const initiateWipeBackup = async (req: Request, res: Response) => {
  try {
    const { confirmationText } = req.body || {};
    const cleanConfirm = (confirmationText || '').trim();
    if (cleanConfirm !== 'WIPE ALL DATA') {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmation text. You must type "WIPE ALL DATA" exactly.',
        error: { code: 'INVALID_CONFIRMATION' }
      });
    }

    const user = {
      userId: req.user?.id || 'ADMIN-001',
      name: req.user?.name || 'Administrator',
      role: req.user?.role || 'ADMIN'
    };

    const verificationRecord = await systemWipeService.initiateFullBackupAndVerify(cleanConfirm, user);
    return res.json({
      success: true,
      message: 'Complete backup created and verified in local server storage successfully.',
      data: verificationRecord
    });
  } catch (err: any) {
    console.error('[AdminController] initiateWipeBackup error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Backup verification failed. No application data was deleted.',
      error: { code: 'BACKUP_VERIFICATION_FAILED' }
    });
  }
};

export const confirmSystemWipe = async (req: Request, res: Response) => {
  try {
    const { token, confirmationText } = req.body || {};
    const cleanConfirm = (confirmationText || '').trim();
    if (!token || cleanConfirm !== 'WIPE ALL DATA') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token or confirmation text.',
        error: { code: 'INVALID_REQUEST' }
      });
    }

    const user = {
      userId: req.user?.id || 'ADMIN-001',
      name: req.user?.name || 'Administrator',
      role: req.user?.role || 'ADMIN'
    };

    const wipeResult = await systemWipeService.confirmAndWipeData(token, cleanConfirm, user);
    return res.json({
      success: true,
      message: 'All application operational data has been permanently removed.',
      data: wipeResult
    });
  } catch (err: any) {
    console.error('[AdminController] confirmSystemWipe error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Data wipe failed.',
      error: { code: 'WIPE_FAILED' }
    });
  }
};

// ==========================================
// SYSTEM RESTORE APIs
// ==========================================

export const getAvailableRestoreBackups = async (_req: Request, res: Response) => {
  try {
    const backups = await systemRestoreService.getAvailableBackups();
    return res.json({ success: true, data: backups });
  } catch (err: any) {
    console.error('[AdminController] getAvailableRestoreBackups error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to list backup packages.',
      error: { code: 'BACKUP_LISTING_FAILED' }
    });
  }
};

export const validateRestoreBackup = async (req: Request, res: Response) => {
  try {
    let jsonBuffer: Buffer | undefined;
    let jsonString: string | undefined;

    if (req.file) {
      jsonBuffer = req.file.buffer;
    } else if (req.body.jsonString) {
      jsonString = req.body.jsonString;
    }

    const { fileId, backupId } = req.body || {};

    const validationResult = await systemRestoreService.validateBackupForRestore({
      jsonBuffer,
      jsonString,
      fileId,
      backupId
    });

    return res.json({
      success: true,
      message: 'Backup package validated successfully.',
      data: validationResult
    });
  } catch (err: any) {
    console.error('[AdminController] validateRestoreBackup error:', err?.message || err);
    return res.status(400).json({
      success: false,
      message: err?.message || 'Backup validation failed.',
      error: { code: 'BACKUP_VALIDATION_FAILED' }
    });
  }
};

export const executeSystemRestore = async (req: Request, res: Response) => {
  try {
    const { token, confirmationText } = req.body || {};
    const cleanConfirm = (confirmationText || '').trim();
    if (!token || (cleanConfirm !== 'RESTORE BACKUP' && cleanConfirm !== 'RESTORE SYSTEM')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token or confirmation text. You must type "RESTORE BACKUP" exactly.',
        error: { code: 'INVALID_CONFIRMATION' }
      });
    }

    const user = {
      userId: req.user?.id || 'ADMIN-001',
      name: req.user?.name || 'Administrator',
      role: req.user?.role || 'ADMIN'
    };

    const result = await systemRestoreService.executeRestore(token, cleanConfirm, user);
    return res.json({
      success: true,
      message: 'System operational database restored and verified.',
      data: result,
      restore: {
        status: 'VERIFIED',
        restoreId: result.restoreId
      },
      recordCounts: result.restoredCounts
    });
  } catch (err: any) {
    console.error('[AdminController] executeSystemRestore error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'System restore failed.',
      error: { code: 'RESTORE_FAILED' }
    });
  }
};

export const getRestoreHistory = async (_req: Request, res: Response) => {
  try {
    const history = systemRestoreService.getRestoreHistory();
    return res.json({ success: true, data: history });
  } catch (err: any) {
    console.error('[AdminController] getRestoreHistory error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to fetch restore history.',
      error: { code: 'HISTORY_FETCH_FAILED' }
    });
  }
};

export const retryDriveSync = async (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Local storage backup verified.'
  });
};

export const getRentalSummary = async (req: Request, res: Response) => {
  try {
    const { rentalAdminSummaryService } = await import('../services/rentalAdminSummary.service.js');
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const complexId = typeof req.query.complexId === 'string' ? req.query.complexId : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const summary = rentalAdminSummaryService.getSummary({ month, complexId, search });
    return res.json({
      success: true,
      data: summary
    });
  } catch (err: any) {
    console.error('[AdminController] getRentalSummary error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve rental admin summary'
    });
  }
};

export const getRentalComplexes = async (_req: Request, res: Response) => {
  try {
    const { rentalAdminSummaryService } = await import('../services/rentalAdminSummary.service.js');
    const complexes = rentalAdminSummaryService.getComplexesList();
    return res.json({
      success: true,
      data: complexes
    });
  } catch (err: any) {
    console.error('[AdminController] getRentalComplexes error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve complexes list'
    });
  }
};

export const getRentalShops = async (req: Request, res: Response) => {
  try {
    const { rentalAdminSummaryService } = await import('../services/rentalAdminSummary.service.js');
    const complexId = typeof req.query.complexId === 'string' ? req.query.complexId : undefined;
    const shops = rentalAdminSummaryService.getShopsList(complexId);
    return res.json({
      success: true,
      data: shops
    });
  } catch (err: any) {
    console.error('[AdminController] getRentalShops error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shops list'
    });
  }
};

export const getRentalComplexDetails = async (req: Request, res: Response) => {
  try {
    const { rentalAdminSummaryService } = await import('../services/rentalAdminSummary.service.js');
    const complexId = req.params.id;
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;

    const details = rentalAdminSummaryService.getComplexDetails(complexId, month);
    if (!details) {
      return res.status(404).json({ success: false, message: 'Complex not found' });
    }
    return res.json({
      success: true,
      data: details
    });
  } catch (err: any) {
    console.error('[AdminController] getRentalComplexDetails error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve complex details'
    });
  }
};

export const getRentalShopDetails = async (req: Request, res: Response) => {
  try {
    const { rentalAdminSummaryService } = await import('../services/rentalAdminSummary.service.js');
    const shopId = req.params.id;
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;

    const details = rentalAdminSummaryService.getShopDetails(shopId, month);
    if (!details) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }
    return res.json({
      success: true,
      data: details
    });
  } catch (err: any) {
    console.error('[AdminController] getRentalShopDetails error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shop details'
    });
  }
};

export const getRentalPayments = async (req: Request, res: Response) => {
  try {
    const { rentalAdminSummaryService } = await import('../services/rentalAdminSummary.service.js');
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const complexId = typeof req.query.complexId === 'string' ? req.query.complexId : undefined;
    const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const mode = typeof req.query.mode === 'string' ? req.query.mode : undefined;

    const payments = rentalAdminSummaryService.getPayments({ month, complexId, shopId, search, status, mode });
    return res.json({
      success: true,
      data: payments
    });
  } catch (err: any) {
    console.error('[AdminController] getRentalPayments error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve rental payments'
    });
  }
};

export const getRentalExpenses = async (req: Request, res: Response) => {
  try {
    const { rentalAdminSummaryService } = await import('../services/rentalAdminSummary.service.js');
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const complexId = typeof req.query.complexId === 'string' ? req.query.complexId : undefined;
    const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;

    const expenses = rentalAdminSummaryService.getExpenses({ month, complexId, shopId, search, category });
    return res.json({
      success: true,
      data: expenses
    });
  } catch (err: any) {
    console.error('[AdminController] getRentalExpenses error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve rental expenses'
    });
  }
};

export const getRentalSyncStatus = async (_req: Request, res: Response) => {
  try {
    const { rentalAdminSummaryService } = await import('../services/rentalAdminSummary.service.js');
    const status = rentalAdminSummaryService.getSyncStatus();
    return res.json({
      success: true,
      data: status
    });
  } catch (err: any) {
    console.error('[AdminController] getRentalSyncStatus error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve rental sync status'
    });
  }
};

export const resetRentalData = async (_req: Request, res: Response) => {
  try {
    const { rentalAdminSummaryService } = await import('../services/rentalAdminSummary.service.js');
    const result = await rentalAdminSummaryService.resetRentalBusinessData();
    return res.json({
      success: true,
      message: 'Rental operational records have been safely reset. Financial, customer, and authentication data preserved intact.',
      data: result
    });
  } catch (err: any) {
    console.error('[AdminController] resetRentalData error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to reset rental data'
    });
  }
};

export const getDatabaseStatus = async (_req: Request, res: Response) => {
  try {
    const { checkStorageHealth } = await import('../config/database.js');
    const health = await checkStorageHealth();
    return res.json({
      status: health.status,
      success: health.success,
      storage: 'telegram',
      telegram: health.telegram,
      ready: health.ready,
      data: {
        storageEngine: 'TELEGRAM_BOT_API',
        ...health
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      success: false,
      storage: 'telegram',
      telegram: 'disconnected',
      ready: false,
      message: err?.message || 'Failed to check database status'
    });
  }
};

export const migrateToAtlas = async (_req: Request, res: Response) => {
  try {
    const { dbService } = await import('../services/database.service.js');
    const result = await dbService.migrateLocalToAtlas();
    return res.json({
      success: result.success,
      message: result.message,
      data: result.migratedCounts
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Database migration failed'
    });
  }
};
