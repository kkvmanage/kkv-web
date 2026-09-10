import { Router } from 'express';
import {
  getPublicSettings,
  getLoanTypes,
  getLoanTypeById,
  createLoanType,
  updateLoanType,
  toggleLoanTypeStatus,
  toggleLoanTypeVisibility
} from '../controllers/config.controller.js';
import { authenticateUser, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

// ── Public Settings (READ-ONLY) — accessible to ADMIN + STAFF ──────────────
// Returns all operational config (loan types, FD rates, repayment systems)
// without sensitive admin-only fields (passwords).
// This is the endpoint staff pages must use to get fresh backend config.
router.get('/settings', authorizeRoles('ADMIN', 'STAFF', 'RENTAL_STAFF'), getPublicSettings);

// ── Loan Type Management (ADMIN + STAFF read, ADMIN write) ─────────────────
router.get('/loan-types', authorizeRoles('ADMIN', 'STAFF', 'RENTAL_STAFF'), getLoanTypes);
router.get('/loan-types/:id', authorizeRoles('ADMIN', 'STAFF', 'RENTAL_STAFF'), getLoanTypeById);
router.post('/loan-types', authorizeRoles('ADMIN'), createLoanType);
router.put('/loan-types/:id', authorizeRoles('ADMIN'), updateLoanType);
router.patch('/loan-types/:id/status', authorizeRoles('ADMIN'), toggleLoanTypeStatus);
router.patch('/loan-types/:id/visibility', authorizeRoles('ADMIN'), toggleLoanTypeVisibility);

export default router;
