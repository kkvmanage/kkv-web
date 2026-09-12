import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  searchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer,
  deletePermanentlyCustomer
} from '../controllers/customerController.js';
import { handleUploadMiddleware } from '../middleware/uploadMiddleware.js';
import { authenticateUser, authorizePermission, authorizeRoles } from '../middleware/auth.middleware.js';
import { getLoansByCustomerId } from '../controllers/loan.controller.js';

const router = Router();

// Protect all customer routes with JWT authentication
router.use(authenticateUser);

// Operational Endpoints: Fine-grained permissions
router.get('/', authorizePermission('customers', 'view'), getCustomers);
router.get('/search', authorizePermission('customers', 'view'), searchCustomers);
router.get('/:id/loans', authorizePermission('loans', 'view'), getLoansByCustomerId);
router.get('/:id', authorizePermission('customers', 'view'), getCustomerById);
router.post('/', authorizePermission('customers', 'create'), handleUploadMiddleware, createCustomer);
router.put('/:id', authorizePermission('customers', 'update'), handleUploadMiddleware, updateCustomer);

// Sensitive/Destructive Endpoints
router.delete('/:id', authorizePermission('customers', 'delete'), deleteCustomer);
router.post('/:id/restore', authorizePermission('customers', 'update'), restoreCustomer);
router.delete('/:id/permanent', authorizeRoles('ADMIN'), deletePermanentlyCustomer);

export default router;
