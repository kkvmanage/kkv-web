import { Router } from 'express';
import { rentalController } from '../controllers/rental.controller.js';
import { authenticateUser, authorizePermission, authorizeRoles } from '../../../middleware/auth.middleware.js';

const router = Router();

// Protect all rental routes with authenticated session
router.use(authenticateUser);

// Dashboard (ADMIN + RENTAL_STAFF / permitted STAFF)
router.get('/dashboard', authorizePermission('rental', 'view'), rentalController.getDashboard.bind(rentalController));

// Complexes
router.get('/complexes', authorizePermission('rental', 'view'), rentalController.getComplexes.bind(rentalController));
router.post('/complexes', authorizePermission('rental', 'create'), rentalController.createComplex.bind(rentalController));
router.get('/complexes/:id', authorizePermission('rental', 'view'), rentalController.getComplexById.bind(rentalController));
router.put('/complexes/:id', authorizePermission('rental', 'update'), rentalController.updateComplex.bind(rentalController));

// Shops
router.get('/shops', authorizePermission('rental', 'view'), rentalController.getShops.bind(rentalController));
router.post('/shops', authorizePermission('rental', 'create'), rentalController.createShop.bind(rentalController));
router.get('/shops/:id', authorizePermission('rental', 'view'), rentalController.getShopById.bind(rentalController));
router.get('/shops/:id/status', authorizePermission('rental', 'view'), rentalController.getShopMonthlyStatus.bind(rentalController));
router.get('/shops/:id/settlement', authorizePermission('rental', 'view'), rentalController.getShopSettlement.bind(rentalController));
router.post('/shops/:id/close', authorizePermission('rental', 'update'), rentalController.closeShop.bind(rentalController));
router.delete('/shops/:id', authorizeRoles('ADMIN'), rentalController.deleteShop.bind(rentalController));
router.put('/shops/:id', authorizePermission('rental', 'update'), rentalController.updateShop.bind(rentalController));


// Rent Payments
router.get('/payments', authorizePermission('rental', 'view'), rentalController.getPayments.bind(rentalController));
router.post('/payments', authorizePermission('rental', 'create'), rentalController.createPayment.bind(rentalController));

// Expenses
router.get('/expenses', authorizePermission('rental', 'view'), rentalController.getExpenses.bind(rentalController));
router.post('/expenses', authorizePermission('rental', 'create'), rentalController.createExpense.bind(rentalController));
router.put('/expenses/:id', authorizePermission('rental', 'update'), rentalController.updateExpense.bind(rentalController));
router.delete('/expenses/:id', authorizePermission('rental', 'delete'), rentalController.deleteExpense.bind(rentalController));

// Day Book
router.get('/day-book', authorizePermission('rental', 'view'), rentalController.getDayBook.bind(rentalController));
router.post('/day-book', authorizePermission('rental', 'create'), rentalController.createManualDayBookEntry.bind(rentalController));

// Reports
router.get('/reports/monthly', authorizePermission('rental', 'view'), rentalController.getMonthlyReport.bind(rentalController));
router.get('/reports/expenses', authorizePermission('rental', 'view'), rentalController.getExpenseReport.bind(rentalController));
router.get('/reports/payment-modes', authorizePermission('rental', 'view'), rentalController.getPaymentModeReport.bind(rentalController));

// Pending Rent
router.get('/pending', authorizePermission('rental', 'view'), rentalController.getPendingRent.bind(rentalController));

// Sync Status & Control (ADMIN, RENTAL_STAFF, or staff with rental permissions)
router.get('/sync/status', authorizePermission('rental', 'view'), rentalController.getSyncStatus.bind(rentalController));
router.get('/sync-status', authorizePermission('rental', 'view'), rentalController.getSyncStatus.bind(rentalController));
router.post('/sync/retry', authorizePermission('rental', 'update'), rentalController.retrySync.bind(rentalController));
router.post('/sync-retry', authorizePermission('rental', 'update'), rentalController.retrySync.bind(rentalController));

// Admin-only Summary
router.get('/admin/summary', authorizeRoles('ADMIN'), rentalController.getAdminSummary.bind(rentalController));

export default router;
