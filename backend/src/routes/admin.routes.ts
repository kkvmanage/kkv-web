import { Router } from 'express';
import multer from 'multer';
import {
  getMasterSettings,
  updateMasterSettings,
  getWhatsAppTemplates,
  updateWhatsAppTemplates,
  unlockMasterControl,
  changeMasterPassword,
  getDriveHealth,
  createBackupPackage,
  getBackupHistory,
  downloadBackupZip,
  acknowledgeDownload,
  getWipePreview,
  initiateWipeBackup,
  confirmSystemWipe,
  getAvailableRestoreBackups,
  validateRestoreBackup,
  executeSystemRestore,
  getRestoreHistory,
  retryDriveSync,
  getRentalSummary,
  getRentalComplexes,
  getRentalShops,
  getRentalComplexDetails,
  getRentalShopDetails,
  getRentalPayments,
  getRentalExpenses,
  getRentalSyncStatus,
  resetRentalData,
  getDatabaseStatus,
  migrateToAtlas
} from '../controllers/admin.controller.js';
import staffRoutes from './staff.routes.js';
import { getAuditLogs } from '../controllers/staff.controller.js';
import { authenticateUser, authorizeRoles } from '../middleware/auth.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max
});

const router = Router();

// Apply Authentication & Admin Authorization to all Admin routes
router.use(authenticateUser);
router.use(authorizeRoles('ADMIN'));

// Staff Management subrouter mounted under /api/admin/staff
router.use('/staff', staffRoutes);

// Staff Audit Logs
router.get('/audit-logs', getAuditLogs);
router.get('/audit', getAuditLogs);

// Master Settings
router.get('/settings', getMasterSettings);
router.put('/settings', updateMasterSettings);

// Rental Admin Integration Endpoints
router.get('/rental-summary', getRentalSummary);
router.get('/rental/summary', getRentalSummary);
router.get('/rental/complexes', getRentalComplexes);
router.get('/rental/complexes/:id', getRentalComplexDetails);
router.get('/rental/shops', getRentalShops);
router.get('/rental/shops/:id', getRentalShopDetails);
router.get('/rental/payments', getRentalPayments);
router.get('/rental/expenses', getRentalExpenses);
router.get('/rental/sync-status', getRentalSyncStatus);
router.post('/rental/reset-data', resetRentalData);

router.get('/whatsapp-templates', getWhatsAppTemplates);
router.put('/whatsapp-templates', updateWhatsAppTemplates);
router.post('/unlock', unlockMasterControl);
router.post('/change-master-password', changeMasterPassword);

// Database & MongoDB Management
router.get('/database/status', getDatabaseStatus);
router.post('/database/migrate-to-atlas', migrateToAtlas);

// Storage & Backup Status
router.get('/backup/drive-health', getDriveHealth);
router.get('/drive-health', getDriveHealth);

// Backup Package APIs
router.post('/backup/create', createBackupPackage);
router.get('/backup/history', getBackupHistory);
router.get('/backup/:backupId/download', downloadBackupZip);
router.post('/backup/:backupId/acknowledge-download', acknowledgeDownload);

// Wipe All Data Workflow
router.get('/wipe-all-data/preview', getWipePreview);
router.post('/wipe-all-data/initiate', initiateWipeBackup);
router.post('/wipe-all-data/confirm', confirmSystemWipe);

// System Restore Workflow
router.get('/system/backups', getAvailableRestoreBackups);
router.post('/system/restore/validate', upload.single('backupFile'), validateRestoreBackup);
router.post('/system/restore', executeSystemRestore);
router.get('/system/restore/history', getRestoreHistory);
router.post('/system/restore/:restoreId/sync-drive', retryDriveSync);

// Aliases for compatibility
router.post('/restore/upload', upload.single('backupFile'), validateRestoreBackup);
router.post('/restore/validate', upload.single('backupFile'), validateRestoreBackup);
router.post('/restore/execute', executeSystemRestore);
router.get('/restore/history', getRestoreHistory);
router.post('/restore/:restoreId/sync-drive', retryDriveSync);

export default router;
