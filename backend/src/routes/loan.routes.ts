import { Router } from 'express';
import {
  getLoans,
  getLoanByNo,
  getNextSequence,
  createLoan,
  updateLoan,
  deleteLoan,
  closeLoan,
  getLoanPayments,
  addLoanPayment,
  getLoansByCustomerId
} from '../controllers/loan.controller.js';
import { authenticateUser, authorizePermission, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

// Protect all loan routes with JWT authentication
router.use(authenticateUser);

// Operational Endpoints: Module-action permissions
router.get('/next-sequence', authorizePermission('loans', 'view'), getNextSequence);
router.get('/', authorizePermission('loans', 'view'), getLoans);
router.get('/customer/:customerId', authorizePermission('loans', 'view'), getLoansByCustomerId);
router.get('/:loanNo', authorizePermission('loans', 'view'), getLoanByNo);
router.post('/', authorizePermission('loans', 'create'), createLoan);
router.put('/:id', authorizePermission('loans', 'update'), updateLoan);
router.post('/:loanNo/close', authorizePermission('loans', 'approve'), closeLoan);
router.get('/:id/payments', authorizePermission('loans', 'view'), getLoanPayments);
router.post('/:id/payments', authorizePermission('loans', 'create'), addLoanPayment);

// Destructive Endpoints
router.delete('/:id', authorizePermission('loans', 'delete'), deleteLoan);

export default router;
