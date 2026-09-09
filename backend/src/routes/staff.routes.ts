import { Router } from 'express';
import {
  getStaffList,
  getStaffProfile,
  createStaff,
  updateStaff,
  updateStaffPassword,
  toggleStaffStatus,
  revokeStaffSessions,
  deleteStaff,
  searchStaff,
  getAuditLogs,
  verifyStaffCredentials,
  lookupStaff,
  requestPasswordReset,
  resetPassword
} from '../controllers/staff.controller.js';
import { authenticateUser, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

// Staff Directory & Management - Admin Only
router.get('/', authenticateUser, authorizeRoles('ADMIN'), getStaffList);
router.post('/create', authenticateUser, authorizeRoles('ADMIN'), createStaff);
router.post('/', authenticateUser, authorizeRoles('ADMIN'), createStaff);

router.get('/audit', authenticateUser, authorizeRoles('ADMIN'), getAuditLogs);
router.get('/search', authenticateUser, authorizeRoles('ADMIN'), searchStaff);
router.get('/:uid', authenticateUser, authorizeRoles('ADMIN'), getStaffProfile);
router.put('/:uid/password', authenticateUser, authorizeRoles('ADMIN'), updateStaffPassword);
router.post('/:uid/password', authenticateUser, authorizeRoles('ADMIN'), updateStaffPassword);
router.put('/:uid/reset-password', authenticateUser, authorizeRoles('ADMIN'), updateStaffPassword);
router.post('/:uid/reset-password', authenticateUser, authorizeRoles('ADMIN'), updateStaffPassword);
router.put('/:uid', authenticateUser, authorizeRoles('ADMIN'), updateStaff);
router.patch('/:uid', authenticateUser, authorizeRoles('ADMIN'), updateStaff);
router.post('/:uid/status', authenticateUser, authorizeRoles('ADMIN'), toggleStaffStatus);
router.patch('/:uid/status', authenticateUser, authorizeRoles('ADMIN'), toggleStaffStatus);
router.post('/:uid/revoke-sessions', authenticateUser, authorizeRoles('ADMIN'), revokeStaffSessions);
router.delete('/:uid', authenticateUser, authorizeRoles('ADMIN'), deleteStaff);

// Fallback password reset
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);

export default router;
