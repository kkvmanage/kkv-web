import { Request, Response } from 'express';
import { rentalService } from '../services/rental.service.js';
import { syncService } from '../services/sync.service.js';

export class RentalController {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  public async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const month = (req.query.month as string) || undefined;
      const complexId = (req.query.complexId as string) || undefined;
      const data = await rentalService.getDashboardData(month, complexId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('[RentalController] getDashboard error:', err);
      res.status(500).json({ success: false, message: err.message || 'Error fetching dashboard data' });
    }
  }

  // ── Complexes ──────────────────────────────────────────────────────────────
  public async getComplexes(req: Request, res: Response): Promise<void> {
    try {
      const status = (req.query.status as any) || undefined;
      const data = await rentalService.getComplexes(status);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Error fetching complexes' });
    }
  }

  public async getComplexById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = await rentalService.getComplexById(id);
      if (!data) {
        res.status(404).json({ success: false, message: `Complex ${id} not found` });
        return;
      }
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  public async createComplex(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const data = await rentalService.createComplex(req.body, userId);
      res.status(201).json({
        success: true,
        message: `Complex "${data.complexName}" (${data.complexId}) created successfully`,
        data
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  public async updateComplex(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const data = await rentalService.updateComplex(id, req.body, userId);
      res.json({
        success: true,
        message: `Complex ${data.complexId} updated successfully`,
        data
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  // ── Shops ──────────────────────────────────────────────────────────────────
  public async getShops(req: Request, res: Response): Promise<void> {
    try {
      const { complexId, status, search } = req.query as any;
      const data = await rentalService.getShops({ complexId, status, search });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  public async getShopById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = await rentalService.getShopById(id);
      if (!data) {
        res.status(404).json({ success: false, message: `Shop ${id} not found` });
        return;
      }
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  public async getShopMonthlyStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const data = rentalService.getShopMonthlyStatus(id, month);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  public async createShop(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const data = await rentalService.createShop(req.body, userId);
      res.status(201).json({
        success: true,
        message: `Shop "${data.shopName}" (${data.shopId}) created successfully`,
        data
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  public async updateShop(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const data = await rentalService.updateShop(id, req.body, userId);
      res.json({
        success: true,
        message: `Shop ${data.shopId} updated successfully`,
        data
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  public async getShopSettlement(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = await rentalService.getShopSettlementSummary(id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  }

  public async closeShop(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const result = await rentalService.closeShop(id, req.body, userId);
      res.json({
        success: true,
        message: `Shop "${result.shop.shopNumber}" successfully closed and archived`,
        data: result
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  public async deleteShop(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.uid || (req as any).user?.email || 'ADMIN';
      const success = await rentalService.deleteShop(id, userId);
      if (!success) {
        res.status(404).json({ success: false, message: `Shop ${id} not found` });
        return;
      }
      res.json({ success: true, message: `Shop ${id} permanently deleted` });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  // ── Rent Payments ──────────────────────────────────────────────────────────
  public async getPayments(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.query as any;
      const data = await rentalService.getPayments(filters);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  public async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const data = await rentalService.createPayment(req.body, userId);
      res.status(201).json({
        success: true,
        message: `Rent payment of ₹${data.amountReceived} recorded successfully (${data.paymentId})`,
        data
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  public async getExpenses(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.query as any;
      const data = await rentalService.getExpenses(filters);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  public async createExpense(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const data = await rentalService.createExpense(req.body, userId);
      res.status(201).json({
        success: true,
        message: `Expense of ₹${data.expenseAmount} (${data.category}) recorded successfully (${data.expenseId})`,
        data
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  public async updateExpense(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const data = await rentalService.updateExpense(id, req.body, userId);
      res.json({
        success: true,
        message: `Expense ${data.expenseId} updated successfully`,
        data
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  public async deleteExpense(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const success = await rentalService.deleteExpense(id, userId);
      if (!success) {
        res.status(404).json({ success: false, message: `Expense ${id} not found` });
        return;
      }
      res.json({ success: true, message: `Expense ${id} deleted successfully` });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  // ── Reports ────────────────────────────────────────────────────────────────
  public async getMonthlyReport(req: Request, res: Response): Promise<void> {
    try {
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const complexId = (req.query.complexId as string) || undefined;
      const data = await rentalService.getMonthlyRentReport(month, complexId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  public async getExpenseReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.query as any;
      const data = await rentalService.getExpenses(filters);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  public async getPaymentModeReport(req: Request, res: Response): Promise<void> {
    try {
      const month = (req.query.month as string) || undefined;
      const complexId = (req.query.complexId as string) || undefined;
      const data = await rentalService.getPaymentModeReport(month, complexId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Pending Rent ───────────────────────────────────────────────────────────
  public async getPendingRent(req: Request, res: Response): Promise<void> {
    try {
      const month = (req.query.month as string) || undefined;
      const complexId = (req.query.complexId as string) || undefined;
      const status = (req.query.status as string) || undefined;
      const search = (req.query.search as string) || undefined;

      const data = await rentalService.getPendingRentList({ month, complexId, status, search });
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('[RentalController] getPendingRent error:', err);
      res.status(500).json({ success: false, message: err.message || 'Error fetching pending rent' });
    }
  }

  // ── Admin Summary ──────────────────────────────────────────────────────────
  public async getAdminSummary(req: Request, res: Response): Promise<void> {
    try {
      const month = (req.query.month as string) || undefined;
      const data = await rentalService.getAdminSummary(month);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Day Book ──────────────────────────────────────────────────────────────
  public async getDayBook(req: Request, res: Response): Promise<void> {
    try {
      const {
        fromDate,
        toDate,
        complexId,
        transactionType,
        paymentMode,
        search,
        page,
        limit,
      } = req.query as any;

      const filter = {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        complexId: complexId || undefined,
        transactionType: transactionType || undefined,
        paymentMode: paymentMode || undefined,
        search: search || undefined,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      };

      const data = await rentalService.getDayBook(filter);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('[RentalController] getDayBook error:', err);
      res.status(500).json({ success: false, message: err.message || 'Error fetching Day Book' });
    }
  }

  public async createManualDayBookEntry(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.uid || (req as any).user?.email || 'STAFF';
      const data = await rentalService.createManualDayBookEntry(req.body, userId);
      res.status(201).json({
        success: true,
        message: 'Manual Day Book entry created successfully',
        data,
      });
    } catch (err: any) {
      console.error('[RentalController] createManualDayBookEntry error:', err);
      res.status(400).json({ success: false, message: err.message || 'Error creating Day Book entry' });
    }
  }

  // ── Sync Control ───────────────────────────────────────────────────────────
  public async getSyncStatus(req: Request, res: Response): Promise<void> {
    try {
      const data = syncService.getSyncSummary();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  public async retrySync(req: Request, res: Response): Promise<void> {
    try {
      const data = await syncService.processQueue();
      res.json({
        success: true,
        message: `Sync retry completed. Processed: ${data.processed}, Succeeded: ${data.succeeded}, Failed: ${data.failed}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export const rentalController = new RentalController();

