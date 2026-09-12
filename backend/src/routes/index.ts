import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import customerRoutes from './customer.routes.js';
import loanRoutes from './loan.routes.js';
import receiptRoutes from './receipt.routes.js';
import fdRoutes from './fd.routes.js';
import accountingRoutes from './accounting.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import adminRoutes from './admin.routes.js';
import backupRoutes from './backup.routes.js';
import syncRoutes from './sync.routes.js';
import telegramRoutes from './telegram.routes.js';
import reminderRoutes from './reminder.routes.js';
import searchRoutes from './search.routes.js';
import locationRoutes from './location.routes.js';
import sessionRoutes from './session.routes.js';
import staffRoutes from './staff.routes.js';
import configRoutes from './config.routes.js';
import fileRoutes from './file.routes.js';
import rentalRoutes from '../modules/rental/routes/rental.routes.js';
import { getRentalSummary } from '../controllers/admin.controller.js';
import { authenticateUser, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

// Public & Health
router.use('/health', healthRoutes);

// Auth (Login is public, me/logout/change-password are protected)
router.use('/auth', authRoutes);

// Protected App Modules
router.use('/customers', customerRoutes);
router.use('/loans', loanRoutes);
router.use('/receipts', receiptRoutes);
router.use('/fd', fdRoutes);
router.use('/fd-customers', fdRoutes);
router.use('/fixed-deposits', fdRoutes);
router.use('/accounting', accountingRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);
router.use('/backup', backupRoutes);
router.use('/backups', backupRoutes);
router.use('/restore', adminRoutes);
router.use('/staff', staffRoutes);
router.use('/config', configRoutes);
router.use('/loan-types', configRoutes);
router.use('/files', fileRoutes);
router.use('/rental', rentalRoutes);
router.get('/rental-summary', authenticateUser, authorizeRoles('ADMIN'), getRentalSummary);
router.use('/search', searchRoutes);
router.use('/location', locationRoutes);
router.use('/sessions', sessionRoutes);
router.use('/sync', syncRoutes);
router.use('/telegram', telegramRoutes);
router.use('/reminders', reminderRoutes);

export default router;
