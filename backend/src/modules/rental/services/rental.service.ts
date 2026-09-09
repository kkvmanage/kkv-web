import { rentalRepository } from '../repositories/rental.repository.js';
import { rentalDayBookRepository } from '../repositories/rentalDayBook.repository.js';
import { syncService } from './sync.service.js';
import {
  RentalComplex,
  RentalShop,
  RentalPayment,
  RentalExpense,
  RentalAuditLog,
  RentalDashboardData,
  AdminRentalSummary,
  PaymentMode,
  ExpenseCategory,
  RentalStatus,
  RentalDayBookEntry
} from '../types/rental.types.js';

export class RentalService {
  // ── Format Helper ──────────────────────────────────────────────────────────
  private getCurrentMonth(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private getTodayDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ── Complexes ──────────────────────────────────────────────────────────────
  public async getComplexes(status?: RentalStatus): Promise<RentalComplex[]> {
    const list = rentalRepository.getComplexes();
    if (status) return list.filter((c) => c.status === status);
    return list;
  }

  public async getComplexById(complexId: string): Promise<RentalComplex | null> {
    return rentalRepository.getComplexById(complexId);
  }

  public async createComplex(
    data: { complexName: string; location: string; status?: RentalStatus },
    userId: string = 'SYSTEM'
  ): Promise<RentalComplex> {
    if (!data.complexName || !data.complexName.trim()) {
      throw new Error('Complex name cannot be empty');
    }
    if (!data.location || !data.location.trim()) {
      throw new Error('Location cannot be empty');
    }

    const now = new Date().toISOString();
    const complexId = rentalRepository.nextComplexId();
    const complex: RentalComplex = {
      id: complexId,
      complexId,
      complexName: data.complexName.trim(),
      location: data.location.trim(),
      status: data.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING'
    };

    rentalRepository.saveComplex(complex);

    rentalRepository.saveAuditLog({
      id: rentalRepository.nextAuditId(),
      auditId: rentalRepository.nextAuditId(),
      userId,
      action: 'CREATE_COMPLEX',
      entityType: 'Complex',
      entityId: complexId,
      newValue: complex,
      timestamp: now
    });

    await syncService.enqueue('Complex', complexId, 'CREATE', complex);
    return complex;
  }

  public async updateComplex(
    complexId: string,
    data: Partial<{ complexName: string; location: string; status: RentalStatus }>,
    userId: string = 'SYSTEM'
  ): Promise<RentalComplex> {
    const existing = rentalRepository.getComplexById(complexId);
    if (!existing) {
      throw new Error(`Complex ${complexId} not found`);
    }

    const now = new Date().toISOString();
    const updated: RentalComplex = {
      ...existing,
      complexName: data.complexName !== undefined ? data.complexName.trim() : existing.complexName,
      location: data.location !== undefined ? data.location.trim() : existing.location,
      status: data.status !== undefined ? data.status : existing.status,
      updatedAt: now,
      syncStatus: 'PENDING'
    };

    rentalRepository.saveComplex(updated);

    rentalRepository.saveAuditLog({
      id: rentalRepository.nextAuditId(),
      auditId: rentalRepository.nextAuditId(),
      userId,
      action: 'UPDATE_COMPLEX',
      entityType: 'Complex',
      entityId: complexId,
      oldValue: existing,
      newValue: updated,
      timestamp: now
    });

    await syncService.enqueue('Complex', complexId, 'UPDATE', updated);
    return updated;
  }

  // ── Shops ──────────────────────────────────────────────────────────────────
  public async getShops(filters?: { complexId?: string; status?: RentalStatus; search?: string }): Promise<RentalShop[]> {
    let list = rentalRepository.getShops();
    const complexes = rentalRepository.getComplexes();
    const complexMap = new Map(complexes.map((c) => [c.complexId, c.complexName]));

    list = list.map((s) => ({
      ...s,
      complexName: complexMap.get(s.complexId) || 'Unknown Complex'
    }));

    if (filters?.complexId) {
      list = list.filter((s) => s.complexId === filters.complexId);
    }
    if (filters?.status) {
      list = list.filter((s) => s.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.shopNumber.toLowerCase().includes(q) ||
          s.shopName.toLowerCase().includes(q) ||
          s.tenantName.toLowerCase().includes(q) ||
          s.mobileNumber.includes(q) ||
          (s.complexName && s.complexName.toLowerCase().includes(q))
      );
    }
    return list;
  }

  public async getShopById(shopId: string): Promise<RentalShop | null> {
    const shop = rentalRepository.getShopById(shopId);
    if (!shop) return null;
    const complex = rentalRepository.getComplexById(shop.complexId);
    return {
      ...shop,
      complexName: complex?.complexName || 'Unknown Complex'
    };
  }

  public async createShop(
    data: {
      complexId: string;
      shopNumber: string;
      shopName: string;
      tenantName: string;
      mobileNumber: string;
      monthlyRent: number;
      status?: RentalStatus;
    },
    userId: string = 'SYSTEM'
  ): Promise<RentalShop> {
    const complex = rentalRepository.getComplexById(data.complexId);
    if (!complex) {
      throw new Error(`Complex ${data.complexId} does not exist`);
    }

    if (!data.shopNumber || !data.shopNumber.trim()) {
      throw new Error('Shop number cannot be empty');
    }
    if (!data.shopName || !data.shopName.trim()) {
      throw new Error('Shop name cannot be empty');
    }
    if (!data.tenantName || !data.tenantName.trim()) {
      throw new Error('Tenant name cannot be empty');
    }

    const cleanMobile = data.mobileNumber ? data.mobileNumber.replace(/\D/g, '') : '';
    if (cleanMobile.length < 10) {
      throw new Error('Valid 10-digit mobile number is required');
    }

    const monthlyRent = Number(data.monthlyRent);
    if (isNaN(monthlyRent) || monthlyRent < 0) {
      throw new Error('Monthly rent must be a non-negative number');
    }

    // Check duplicate shop number in same complex
    const existingShops = rentalRepository.getShopsByComplexId(data.complexId);
    const isDuplicate = existingShops.some(
      (s) => s.shopNumber.trim().toLowerCase() === data.shopNumber.trim().toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`Shop number "${data.shopNumber}" already exists in ${complex.complexName}`);
    }

    const now = new Date().toISOString();
    const shopId = rentalRepository.nextShopId();
    const shop: RentalShop = {
      id: shopId,
      shopId,
      complexId: data.complexId,
      complexName: complex.complexName,
      shopNumber: data.shopNumber.trim(),
      shopName: data.shopName.trim(),
      tenantName: data.tenantName.trim(),
      mobileNumber: cleanMobile,
      monthlyRent,
      availableAdvance: 0,
      status: data.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING'
    };

    rentalRepository.saveShop(shop);

    rentalRepository.saveAuditLog({
      id: rentalRepository.nextAuditId(),
      auditId: rentalRepository.nextAuditId(),
      userId,
      action: 'CREATE_SHOP',
      entityType: 'Shop',
      entityId: shopId,
      newValue: shop,
      timestamp: now
    });

    await syncService.enqueue('Shop', shopId, 'CREATE', shop);
    return shop;
  }

  public async updateShop(
    shopId: string,
    data: Partial<{
      complexId: string;
      shopNumber: string;
      shopName: string;
      tenantName: string;
      mobileNumber: string;
      monthlyRent: number;
      status: RentalStatus;
      availableAdvance: number;
    }>,
    userId: string = 'SYSTEM'
  ): Promise<RentalShop> {
    const existing = rentalRepository.getShopById(shopId);
    if (!existing) {
      throw new Error(`Shop ${shopId} not found`);
    }

    const targetComplexId = data.complexId || existing.complexId;
    const complex = rentalRepository.getComplexById(targetComplexId);

    // Check duplicate shop number if changed
    if (data.shopNumber && data.shopNumber.trim().toLowerCase() !== existing.shopNumber.toLowerCase()) {
      const existingShops = rentalRepository.getShopsByComplexId(targetComplexId);
      const isDuplicate = existingShops.some(
        (s) => s.shopId !== shopId && s.shopNumber.trim().toLowerCase() === data.shopNumber!.trim().toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`Shop number "${data.shopNumber}" already exists in complex`);
      }
    }

    let cleanMobile = existing.mobileNumber;
    if (data.mobileNumber !== undefined) {
      cleanMobile = data.mobileNumber.replace(/\D/g, '');
      if (cleanMobile.length < 10) {
        throw new Error('Valid 10-digit mobile number is required');
      }
    }

    const now = new Date().toISOString();
    const updated: RentalShop = {
      ...existing,
      complexId: targetComplexId,
      complexName: complex?.complexName || existing.complexName,
      shopNumber: data.shopNumber !== undefined ? data.shopNumber.trim() : existing.shopNumber,
      shopName: data.shopName !== undefined ? data.shopName.trim() : existing.shopName,
      tenantName: data.tenantName !== undefined ? data.tenantName.trim() : existing.tenantName,
      mobileNumber: cleanMobile,
      monthlyRent: data.monthlyRent !== undefined ? Number(data.monthlyRent) : existing.monthlyRent,
      availableAdvance: data.availableAdvance !== undefined ? Number(data.availableAdvance) : existing.availableAdvance,
      status: data.status !== undefined ? data.status : existing.status,
      updatedAt: now,
      syncStatus: 'PENDING'
    };

    rentalRepository.saveShop(updated);

    rentalRepository.saveAuditLog({
      id: rentalRepository.nextAuditId(),
      auditId: rentalRepository.nextAuditId(),
      userId,
      action: 'UPDATE_SHOP',
      entityType: 'Shop',
      entityId: shopId,
      oldValue: existing,
      newValue: updated,
      timestamp: now
    });

    await syncService.enqueue('Shop', shopId, 'UPDATE', updated);
    return updated;
  }

  // ── Shop Monthly Calculation Helper ───────────────────────────────────────
  public getShopMonthlyStatus(shopId: string, month: string) {
    const shop = rentalRepository.getShopById(shopId);
    if (!shop) throw new Error(`Shop ${shopId} not found`);

    const allPayments = rentalRepository.getPaymentsByShopId(shopId);
    const monthPayments = allPayments.filter((p) => p.paymentMonth === month);

    const totalPaidInCashAndGpay = monthPayments.reduce((sum, p) => sum + p.amountReceived, 0);
    const totalAdvanceUsed = monthPayments.reduce((sum, p) => sum + p.advanceUsed, 0);
    const totalAdvanceGenerated = monthPayments.reduce((sum, p) => sum + p.advanceGenerated, 0);

    const totalCovered = totalPaidInCashAndGpay + totalAdvanceUsed;
    const requiredRent = shop.monthlyRent;
    const outstandingBalance = Math.max(0, requiredRent - totalCovered);

    let status: 'PAID' | 'PARTIAL' | 'PENDING' = 'PENDING';
    if (totalCovered >= requiredRent && requiredRent > 0) {
      status = 'PAID';
    } else if (totalCovered > 0) {
      status = 'PARTIAL';
    } else if (requiredRent === 0) {
      status = 'PAID';
    }

    return {
      shopId: shop.shopId,
      shopNumber: shop.shopNumber,
      shopName: shop.shopName,
      tenantName: shop.tenantName,
      mobileNumber: shop.mobileNumber,
      monthlyRent: requiredRent,
      month,
      amountPaid: totalPaidInCashAndGpay,
      advanceUsed: totalAdvanceUsed,
      advanceGenerated: totalAdvanceGenerated,
      totalCovered,
      outstandingBalance,
      availableAdvance: shop.availableAdvance,
      status,
      payments: monthPayments
    };
  }

  // ── Rent Payments ──────────────────────────────────────────────────────────
  public async getPayments(filters?: {
    complexId?: string;
    shopId?: string;
    paymentMonth?: string;
    paymentStatus?: string;
    paymentMode?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<RentalPayment[]> {
    let list = rentalRepository.getPayments();
    const complexes = rentalRepository.getComplexes();
    const shops = rentalRepository.getShops();
    const complexMap = new Map(complexes.map((c) => [c.complexId, c.complexName]));
    const shopMap = new Map(shops.map((s) => [s.shopId, s]));

    list = list.map((p) => {
      const s = shopMap.get(p.shopId);
      return {
        ...p,
        complexName: complexMap.get(p.complexId) || s?.complexName || 'Unknown Complex',
        shopNumber: s?.shopNumber || p.shopNumber || '',
        shopName: s?.shopName || p.shopName || '',
        tenantName: s?.tenantName || p.tenantName || ''
      };
    });

    if (filters?.complexId) list = list.filter((p) => p.complexId === filters.complexId);
    if (filters?.shopId) list = list.filter((p) => p.shopId === filters.shopId);
    if (filters?.paymentMonth) list = list.filter((p) => p.paymentMonth === filters.paymentMonth);
    if (filters?.paymentStatus) list = list.filter((p) => p.paymentStatus === filters.paymentStatus);
    if (filters?.paymentMode) list = list.filter((p) => p.paymentMode === filters.paymentMode);
    if (filters?.startDate) list = list.filter((p) => p.paymentDate >= filters.startDate!);
    if (filters?.endDate) list = list.filter((p) => p.paymentDate <= filters.endDate!);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.paymentId.toLowerCase().includes(q) ||
          (p.shopNumber && p.shopNumber.toLowerCase().includes(q)) ||
          (p.shopName && p.shopName.toLowerCase().includes(q)) ||
          (p.tenantName && p.tenantName.toLowerCase().includes(q)) ||
          p.mobileNumber.includes(q)
      );
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }

  public async createPayment(
    data: {
      complexId: string;
      shopId: string;
      paymentMonth: string;
      amountReceived: number;
      advanceToUse?: number;
      paymentMode: PaymentMode;
      cashAmount?: number;
      gpayAmount?: number;
      paymentDate: string;
      mobileNumber?: string;
      notes?: string;
    },
    userId: string = 'SYSTEM'
  ): Promise<RentalPayment> {
    const shop = rentalRepository.getShopById(data.shopId);
    if (!shop) throw new Error(`Shop ${data.shopId} not found`);

    const complex = rentalRepository.getComplexById(data.complexId || shop.complexId);
    if (!complex) throw new Error(`Complex ${data.complexId} not found`);

    const amountReceived = Math.max(0, Number(data.amountReceived || 0));
    const advanceToUse = Math.max(0, Number(data.advanceToUse || 0));

    if (amountReceived === 0 && advanceToUse === 0) {
      throw new Error('Payment amount received or advance to use must be greater than zero');
    }

    // Validate Advance Availability
    if (advanceToUse > shop.availableAdvance) {
      throw new Error(
        `Requested advance (₹${advanceToUse}) exceeds available advance balance (₹${shop.availableAdvance})`
      );
    }

    // Validate Payment Mode & Split
    let cashAmount = 0;
    let gpayAmount = 0;
    const mode = data.paymentMode || 'CASH';

    if (mode === 'CASH') {
      cashAmount = amountReceived;
      gpayAmount = 0;
    } else if (mode === 'GPAY') {
      cashAmount = 0;
      gpayAmount = amountReceived;
    } else if (mode === 'BOTH') {
      cashAmount = Number(data.cashAmount || 0);
      gpayAmount = Number(data.gpayAmount || 0);
      if (Math.abs(cashAmount + gpayAmount - amountReceived) > 0.01) {
        throw new Error(
          `Cash amount (₹${cashAmount}) + GPay amount (₹${gpayAmount}) must equal total amount received (₹${amountReceived})`
        );
      }
    }

    // Backend Financial Calculation for the selected month
    const existingPayments = rentalRepository.getPaymentsByShopId(shop.shopId);
    const monthPayments = existingPayments.filter((p) => p.paymentMonth === data.paymentMonth);
    const priorPaid = monthPayments.reduce((sum, p) => sum + p.amountReceived, 0);
    const priorAdvanceUsed = monthPayments.reduce((sum, p) => sum + p.advanceUsed, 0);
    const priorCovered = priorPaid + priorAdvanceUsed;

    const monthlyRent = shop.monthlyRent;
    const remainingDueBeforeThisPayment = Math.max(0, monthlyRent - priorCovered);

    // Apply Advance Used first (up to remaining due)
    const actualAdvanceUsed = Math.min(advanceToUse, remainingDueBeforeThisPayment);
    const dueAfterAdvance = Math.max(0, remainingDueBeforeThisPayment - actualAdvanceUsed);

    // Rent covered by new cash/gpay payment
    const rentCoveredByPayment = Math.min(amountReceived, dueAfterAdvance);

    // Any surplus received generates Advance Credit for future months
    const advanceGenerated = Math.max(0, amountReceived - dueAfterAdvance);

    // Outstanding balance for this month after this transaction
    const balanceAfterPayment = Math.max(0, dueAfterAdvance - rentCoveredByPayment);

    // Calculate total covered status
    const totalCoveredNow = priorCovered + actualAdvanceUsed + rentCoveredByPayment;
    let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PENDING';
    if (totalCoveredNow >= monthlyRent) {
      paymentStatus = 'PAID';
    } else if (totalCoveredNow > 0) {
      paymentStatus = 'PARTIAL';
    }

    // Update Shop's available advance balance
    const newAvailableAdvance = shop.availableAdvance - actualAdvanceUsed + advanceGenerated;
    shop.availableAdvance = newAvailableAdvance;
    rentalRepository.saveShop(shop);

    const now = new Date().toISOString();
    const paymentId = rentalRepository.nextPaymentId();

    const payment: RentalPayment = {
      id: paymentId,
      paymentId,
      complexId: complex.complexId,
      complexName: complex.complexName,
      shopId: shop.shopId,
      shopNumber: shop.shopNumber,
      shopName: shop.shopName,
      tenantName: shop.tenantName,
      mobileNumber: data.mobileNumber || shop.mobileNumber,
      paymentMonth: data.paymentMonth,
      monthlyRent,
      amountReceived,
      cashAmount,
      gpayAmount,
      paymentMode: mode,
      advanceUsed: actualAdvanceUsed,
      advanceGenerated,
      balanceAfterPayment,
      paymentDate: data.paymentDate || this.getTodayDate(),
      paymentStatus,
      notes: data.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING'
    };

    rentalRepository.savePayment(payment);

    // Audit logs
    rentalRepository.saveAuditLog({
      id: rentalRepository.nextAuditId(),
      auditId: rentalRepository.nextAuditId(),
      userId,
      action: 'CREATE_RENT_PAYMENT',
      entityType: 'RentPayment',
      entityId: paymentId,
      newValue: payment,
      timestamp: now
    });

    if (actualAdvanceUsed > 0) {
      rentalRepository.saveAuditLog({
        id: rentalRepository.nextAuditId(),
        auditId: rentalRepository.nextAuditId(),
        userId,
        action: 'ADVANCE_USED',
        entityType: 'Advance',
        entityId: shop.shopId,
        newValue: { amount: actualAdvanceUsed, paymentId, remainingAdvance: newAvailableAdvance },
        timestamp: now
      });
    }

    if (advanceGenerated > 0) {
      rentalRepository.saveAuditLog({
        id: rentalRepository.nextAuditId(),
        auditId: rentalRepository.nextAuditId(),
        userId,
        action: 'ADVANCE_GENERATED',
        entityType: 'Advance',
        entityId: shop.shopId,
        newValue: { amount: advanceGenerated, paymentId, totalAdvance: newAvailableAdvance },
        timestamp: now
      });
    }

    await syncService.enqueue('RentPayment', paymentId, 'CREATE', payment);
    return payment;
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  public async getExpenses(filters?: {
    complexId?: string;
    shopId?: string;
    category?: ExpenseCategory;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<RentalExpense[]> {
    let list = rentalRepository.getExpenses();
    const complexes = rentalRepository.getComplexes();
    const shops = rentalRepository.getShops();
    const complexMap = new Map(complexes.map((c) => [c.complexId, c.complexName]));
    const shopMap = new Map(shops.map((s) => [s.shopId, s.shopNumber]));

    list = list.map((e) => ({
      ...e,
      complexName: complexMap.get(e.complexId) || 'Unknown Complex',
      shopNumber: e.shopId ? shopMap.get(e.shopId) || '' : undefined
    }));

    if (filters?.complexId) list = list.filter((e) => e.complexId === filters.complexId);
    if (filters?.shopId) list = list.filter((e) => e.shopId === filters.shopId);
    if (filters?.category) list = list.filter((e) => e.category === filters.category);
    if (filters?.startDate) list = list.filter((e) => e.expenseDate >= filters.startDate!);
    if (filters?.endDate) list = list.filter((e) => e.expenseDate <= filters.endDate!);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.expenseId.toLowerCase().includes(q) ||
          e.expenseReason.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.complexName && e.complexName.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  }

  public async createExpense(
    data: {
      complexId: string;
      shopId?: string;
      expenseDate: string;
      category: ExpenseCategory;
      expenseReason: string;
      expenseAmount: number;
      paymentMode: PaymentMode;
      cashAmount?: number;
      gpayAmount?: number;
      notes?: string;
    },
    userId: string = 'SYSTEM'
  ): Promise<RentalExpense> {
    const complex = rentalRepository.getComplexById(data.complexId);
    if (!complex) throw new Error(`Complex ${data.complexId} not found`);

    if (!data.category) throw new Error('Expense category is required');
    if (!data.expenseReason || !data.expenseReason.trim()) {
      throw new Error('Expense reason is required');
    }

    const expenseAmount = Number(data.expenseAmount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }

    const mode = data.paymentMode || 'CASH';
    let cashAmount = 0;
    let gpayAmount = 0;

    if (mode === 'CASH') {
      cashAmount = expenseAmount;
      gpayAmount = 0;
    } else if (mode === 'GPAY') {
      cashAmount = 0;
      gpayAmount = expenseAmount;
    } else if (mode === 'BOTH') {
      cashAmount = Number(data.cashAmount || 0);
      gpayAmount = Number(data.gpayAmount || 0);
      if (Math.abs(cashAmount + gpayAmount - expenseAmount) > 0.01) {
        throw new Error(
          `Cash amount (₹${cashAmount}) + GPay amount (₹${gpayAmount}) must equal total expense amount (₹${expenseAmount})`
        );
      }
    }

    const now = new Date().toISOString();
    const expenseId = rentalRepository.nextExpenseId();

    const expense: RentalExpense = {
      id: expenseId,
      expenseId,
      complexId: complex.complexId,
      complexName: complex.complexName,
      shopId: data.shopId || undefined,
      expenseDate: data.expenseDate || this.getTodayDate(),
      category: data.category,
      expenseReason: data.expenseReason.trim(),
      expenseAmount,
      paymentMode: mode,
      cashAmount,
      gpayAmount,
      notes: data.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING'
    };

    rentalRepository.saveExpense(expense);

    rentalRepository.saveAuditLog({
      id: rentalRepository.nextAuditId(),
      auditId: rentalRepository.nextAuditId(),
      userId,
      action: 'CREATE_EXPENSE',
      entityType: 'Expense',
      entityId: expenseId,
      newValue: expense,
      timestamp: now
    });

    await syncService.enqueue('Expense', expenseId, 'CREATE', expense);
    return expense;
  }

  public async updateExpense(
    expenseId: string,
    data: Partial<{
      complexId: string;
      shopId?: string;
      expenseDate: string;
      category: ExpenseCategory;
      expenseReason: string;
      expenseAmount: number;
      paymentMode: PaymentMode;
      cashAmount?: number;
      gpayAmount?: number;
      notes?: string;
    }>,
    userId: string = 'SYSTEM'
  ): Promise<RentalExpense> {
    const existing = rentalRepository.getExpenseById(expenseId);
    if (!existing) throw new Error(`Expense ${expenseId} not found`);

    const now = new Date().toISOString();
    const updated: RentalExpense = {
      ...existing,
      complexId: data.complexId || existing.complexId,
      shopId: data.shopId !== undefined ? data.shopId : existing.shopId,
      expenseDate: data.expenseDate || existing.expenseDate,
      category: data.category || existing.category,
      expenseReason: data.expenseReason !== undefined ? data.expenseReason.trim() : existing.expenseReason,
      expenseAmount: data.expenseAmount !== undefined ? Number(data.expenseAmount) : existing.expenseAmount,
      paymentMode: data.paymentMode || existing.paymentMode,
      cashAmount: data.cashAmount !== undefined ? Number(data.cashAmount) : existing.cashAmount,
      gpayAmount: data.gpayAmount !== undefined ? Number(data.gpayAmount) : existing.gpayAmount,
      notes: data.notes !== undefined ? data.notes.trim() : existing.notes,
      updatedAt: now,
      syncStatus: 'PENDING'
    };

    rentalRepository.saveExpense(updated);

    rentalRepository.saveAuditLog({
      id: rentalRepository.nextAuditId(),
      auditId: rentalRepository.nextAuditId(),
      userId,
      action: 'UPDATE_EXPENSE',
      entityType: 'Expense',
      entityId: expenseId,
      oldValue: existing,
      newValue: updated,
      timestamp: now
    });

    await syncService.enqueue('Expense', expenseId, 'UPDATE', updated);
    return updated;
  }

  public async deleteExpense(expenseId: string, userId: string = 'SYSTEM'): Promise<boolean> {
    const existing = rentalRepository.getExpenseById(expenseId);
    if (!existing) throw new Error(`Expense ${expenseId} not found`);

    const success = rentalRepository.deleteExpense(expenseId);
    if (success) {
      rentalRepository.saveAuditLog({
        id: rentalRepository.nextAuditId(),
        auditId: rentalRepository.nextAuditId(),
        userId,
        action: 'DELETE_EXPENSE',
        entityType: 'Expense',
        entityId: expenseId,
        oldValue: existing,
        timestamp: new Date().toISOString()
      });
    }
    return success;
  }

  // ── Dashboard Aggregation ──────────────────────────────────────────────────
  public async getDashboardData(month?: string, complexId?: string): Promise<RentalDashboardData> {
    const selectedMonth = month || this.getCurrentMonth();
    const today = this.getTodayDate();

    let complexes = rentalRepository.getComplexes();
    let shops = rentalRepository.getShops();
    let payments = rentalRepository.getPayments();
    let expenses = rentalRepository.getExpenses();

    if (complexId) {
      complexes = complexes.filter((c) => c.complexId === complexId);
      shops = shops.filter((s) => s.complexId === complexId);
      payments = payments.filter((p) => p.complexId === complexId);
      expenses = expenses.filter((e) => e.complexId === complexId);
    }

    const activeShops = shops.filter((s) => s.status === 'ACTIVE');
    const expectedMonthlyRent = activeShops.reduce((sum, s) => sum + s.monthlyRent, 0);

    const monthPayments = payments.filter((p) => p.paymentMonth === selectedMonth);
    const collectedThisMonth = monthPayments.reduce((sum, p) => sum + p.amountReceived, 0);

    // Calculate pending rent for each active shop for selected month
    let pendingRent = 0;
    activeShops.forEach((s) => {
      const sPayments = monthPayments.filter((p) => p.shopId === s.shopId);
      const sPaid = sPayments.reduce((sum, p) => sum + p.amountReceived, 0);
      const sAdvanceUsed = sPayments.reduce((sum, p) => sum + p.advanceUsed, 0);
      const sCovered = sPaid + sAdvanceUsed;
      pendingRent += Math.max(0, s.monthlyRent - sCovered);
    });

    const availableAdvance = shops.reduce((sum, s) => sum + s.availableAdvance, 0);

    const todaysPayments = payments.filter((p) => p.paymentDate === today);
    const todaysCollection = todaysPayments.reduce((sum, p) => sum + p.amountReceived, 0);

    const todaysExpensesList = expenses.filter((e) => e.expenseDate === today);
    const todaysExpenses = todaysExpensesList.reduce((sum, e) => sum + e.expenseAmount, 0);

    const thisMonthExpensesList = expenses.filter((e) => e.expenseDate.startsWith(selectedMonth));
    const thisMonthExpenses = thisMonthExpensesList.reduce((sum, e) => sum + e.expenseAmount, 0);

    const netCollection = collectedThisMonth - thisMonthExpenses;

    // Monthly Trend (Last 6 Months)
    const monthlyTrend: RentalDashboardData['monthlyTrend'] = [];
    const baseDate = new Date(`${selectedMonth}-01`);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const mStr = `${y}-${m}`;

      const mPayments = payments.filter((p) => p.paymentMonth === mStr);
      const mCollected = mPayments.reduce((sum, p) => sum + p.amountReceived, 0);
      const mExpenses = expenses.filter((e) => e.expenseDate.startsWith(mStr)).reduce((sum, e) => sum + e.expenseAmount, 0);

      let mPending = 0;
      activeShops.forEach((s) => {
        const sPayments = mPayments.filter((p) => p.shopId === s.shopId);
        const sCovered = sPayments.reduce((sum, p) => sum + p.amountReceived + p.advanceUsed, 0);
        mPending += Math.max(0, s.monthlyRent - sCovered);
      });

      monthlyTrend.push({
        month: mStr,
        expected: expectedMonthlyRent,
        collected: mCollected,
        pending: mPending,
        expenses: mExpenses,
        net: mCollected - mExpenses
      });
    }

    // Complex Stats
    const allComplexes = rentalRepository.getComplexes();
    const complexStats = allComplexes.map((c) => {
      const cShops = rentalRepository.getShopsByComplexId(c.complexId).filter((s) => s.status === 'ACTIVE');
      const cExpected = cShops.reduce((sum, s) => sum + s.monthlyRent, 0);
      const cPayments = rentalRepository.getPayments().filter((p) => p.complexId === c.complexId && p.paymentMonth === selectedMonth);
      const cCollected = cPayments.reduce((sum, p) => sum + p.amountReceived, 0);
      const cExpenses = rentalRepository.getExpenses().filter((e) => e.complexId === c.complexId && e.expenseDate.startsWith(selectedMonth)).reduce((sum, e) => sum + e.expenseAmount, 0);

      let cPending = 0;
      cShops.forEach((s) => {
        const sPayments = cPayments.filter((p) => p.shopId === s.shopId);
        const sCovered = sPayments.reduce((sum, p) => sum + p.amountReceived + p.advanceUsed, 0);
        cPending += Math.max(0, s.monthlyRent - sCovered);
      });

      return {
        complexId: c.complexId,
        complexName: c.complexName,
        location: c.location,
        totalShops: cShops.length,
        expectedRent: cExpected,
        collected: cCollected,
        pending: cPending,
        expenses: cExpenses,
        net: cCollected - cExpenses
      };
    });

    const cashTotal = monthPayments.reduce((sum, p) => sum + p.cashAmount, 0);
    const gpayTotal = monthPayments.reduce((sum, p) => sum + p.gpayAmount, 0);

    return {
      totalComplexes: complexes.length,
      totalShops: shops.length,
      expectedMonthlyRent,
      collectedThisMonth,
      pendingRent,
      availableAdvance,
      todaysCollection,
      todaysExpenses,
      thisMonthExpenses,
      netCollection,
      recentPayments: payments.slice(0, 8),
      recentExpenses: expenses.slice(0, 8),
      monthlyTrend,
      complexStats,
      paymentModeSplit: {
        cashTotal,
        gpayTotal,
        total: cashTotal + gpayTotal
      }
    };
  }

  // ── Admin Summary API ──────────────────────────────────────────────────────
  public async getAdminSummary(month?: string): Promise<AdminRentalSummary> {
    const selectedMonth = month || this.getCurrentMonth();
    const complexes = rentalRepository.getComplexes();
    const shops = rentalRepository.getShops();
    const activeShops = shops.filter((s) => s.status === 'ACTIVE');
    const payments = rentalRepository.getPayments().filter((p) => p.paymentMonth === selectedMonth);
    const expenses = rentalRepository.getExpenses().filter((e) => e.expenseDate.startsWith(selectedMonth));

    const expectedMonthlyRent = activeShops.reduce((sum, s) => sum + s.monthlyRent, 0);
    const collectedThisMonth = payments.reduce((sum, p) => sum + p.amountReceived, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.expenseAmount, 0);
    const advanceAmount = shops.reduce((sum, s) => sum + s.availableAdvance, 0);

    let pendingRent = 0;
    activeShops.forEach((s) => {
      const sPayments = payments.filter((p) => p.shopId === s.shopId);
      const sCovered = sPayments.reduce((sum, p) => sum + p.amountReceived + p.advanceUsed, 0);
      pendingRent += Math.max(0, s.monthlyRent - sCovered);
    });

    const complexPerformance = complexes.map((c) => {
      const cShops = shops.filter((s) => s.complexId === c.complexId && s.status === 'ACTIVE');
      const cExpected = cShops.reduce((sum, s) => sum + s.monthlyRent, 0);
      const cPayments = payments.filter((p) => p.complexId === c.complexId);
      const cCollected = cPayments.reduce((sum, p) => sum + p.amountReceived, 0);
      const cExpenses = expenses.filter((e) => e.complexId === c.complexId).reduce((sum, e) => sum + e.expenseAmount, 0);

      let cPending = 0;
      cShops.forEach((s) => {
        const sPayments = cPayments.filter((p) => p.shopId === s.shopId);
        const sCovered = sPayments.reduce((sum, p) => sum + p.amountReceived + p.advanceUsed, 0);
        cPending += Math.max(0, s.monthlyRent - sCovered);
      });

      return {
        complexId: c.complexId,
        complexName: c.complexName,
        expectedRent: cExpected,
        collected: cCollected,
        pending: cPending,
        expenses: cExpenses,
        net: cCollected - cExpenses
      };
    });

    return {
      totalComplexes: complexes.length,
      totalShops: shops.length,
      expectedMonthlyRent,
      collectedThisMonth,
      pendingRent,
      advanceAmount,
      totalExpenses,
      netCollection: collectedThisMonth - totalExpenses,
      complexPerformance
    };
  }

  // ── Reports ────────────────────────────────────────────────────────────────
  public async getMonthlyRentReport(month: string, complexId?: string) {
    let complexes = rentalRepository.getComplexes();
    if (complexId) complexes = complexes.filter((c) => c.complexId === complexId);

    const shops = rentalRepository.getShops();
    const payments = rentalRepository.getPayments().filter((p) => p.paymentMonth === month);
    const expenses = rentalRepository.getExpenses().filter((e) => e.expenseDate.startsWith(month));

    return complexes.map((c) => {
      const cShops = shops.filter((s) => s.complexId === c.complexId && s.status === 'ACTIVE');
      const expected = cShops.reduce((sum, s) => sum + s.monthlyRent, 0);
      const cPayments = payments.filter((p) => p.complexId === c.complexId);
      const collected = cPayments.reduce((sum, p) => sum + p.amountReceived, 0);
      const cExpenses = expenses.filter((e) => e.complexId === c.complexId).reduce((sum, e) => sum + e.expenseAmount, 0);
      const advance = cShops.reduce((sum, s) => sum + s.availableAdvance, 0);

      let pending = 0;
      cShops.forEach((s) => {
        const sPayments = cPayments.filter((p) => p.shopId === s.shopId);
        const sCovered = sPayments.reduce((sum, p) => sum + p.amountReceived + p.advanceUsed, 0);
        pending += Math.max(0, s.monthlyRent - sCovered);
      });

      return {
        complexId: c.complexId,
        complexName: c.complexName,
        location: c.location,
        totalShops: cShops.length,
        expectedRent: expected,
        collected,
        pending,
        advance,
        expenses: cExpenses,
        netCollection: collected - cExpenses
      };
    });
  }

  public async getPaymentModeReport(month?: string, complexId?: string) {
    let payments = rentalRepository.getPayments();
    if (month) payments = payments.filter((p) => p.paymentMonth === month);
    if (complexId) payments = payments.filter((p) => p.complexId === complexId);

    const cashPayments = payments.filter((p) => p.paymentMode === 'CASH' || (p.paymentMode === 'BOTH' && p.cashAmount > 0));
    const gpayPayments = payments.filter((p) => p.paymentMode === 'GPAY' || (p.paymentMode === 'BOTH' && p.gpayAmount > 0));

    const totalCash = payments.reduce((sum, p) => sum + p.cashAmount, 0);
    const totalGPay = payments.reduce((sum, p) => sum + p.gpayAmount, 0);

    return {
      cash: {
        count: cashPayments.length,
        total: totalCash
      },
      gpay: {
        count: gpayPayments.length,
        total: totalGPay
      },
      totalAmount: totalCash + totalGPay,
      totalTransactions: payments.length
    };
  }

  // ── Rental Day Book Module ──────────────────────────────────────────────────
  public async getDayBook(filter: {
    from?: string;
    to?: string;
    date?: string;
    complexId?: string;
    paymentMode?: string;
    transactionType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const complexes = rentalRepository.getComplexes();
    const complexMap = new Map<string, string>();
    complexes.forEach(c => complexMap.set(c.complexId, c.complexName));

    const allPayments = rentalRepository.getPayments();
    const allExpenses = rentalRepository.getExpenses();
    const manualEntries = await rentalDayBookRepository.getManualEntries();

    // 1. Convert Payments to Day Book Credit Entries
    const paymentEntries: RentalDayBookEntry[] = allPayments.map(p => {
      const cName = p.complexName || complexMap.get(p.complexId) || p.complexId;
      return {
        id: `rdb_pay_${p.paymentId || p.id}`,
        voucherNo: p.paymentId || `PAY-${p.id}`,
        date: p.paymentDate || p.createdAt?.slice(0, 10) || this.getTodayDate(),
        transactionType: 'RENT_COLLECTION',
        category: 'Income',
        description: `Rent Collection - ${p.tenantName || 'Tenant'} (${p.shopNumber || p.shopName || 'Shop'})`,
        complexId: p.complexId,
        complexName: cName,
        shopId: p.shopId,
        shopNumber: p.shopNumber,
        shopName: p.shopName,
        tenantName: p.tenantName,
        paymentMode: p.paymentMode,
        debit: 0,
        credit: Math.round(Number(p.amountReceived || 0)),
        referenceType: 'RENT_PAYMENT',
        referenceId: p.paymentId || p.id,
        entrySource: 'SYSTEM',
        notes: p.notes,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString()
      };
    });

    // 2. Convert Expenses to Day Book Debit Entries
    const expenseEntries: RentalDayBookEntry[] = allExpenses.map(e => {
      const cName = e.complexName || complexMap.get(e.complexId) || e.complexId;
      return {
        id: `rdb_exp_${e.expenseId || e.id}`,
        voucherNo: e.expenseId || `EXP-${e.id}`,
        date: e.expenseDate || e.createdAt?.slice(0, 10) || this.getTodayDate(),
        transactionType: 'MAINTENANCE_EXPENSE',
        category: e.category || 'Expense',
        description: e.expenseReason || `${e.category || 'Rental'} Expense`,
        complexId: e.complexId,
        complexName: cName,
        shopId: e.shopId,
        shopNumber: e.shopNumber,
        paymentMode: e.paymentMode,
        debit: Math.round(Number(e.expenseAmount || 0)),
        credit: 0,
        referenceType: 'RENTAL_EXPENSE',
        referenceId: e.expenseId || e.id,
        entrySource: 'SYSTEM',
        notes: e.notes,
        createdAt: e.createdAt || new Date().toISOString(),
        updatedAt: e.updatedAt || new Date().toISOString()
      };
    });

    // 3. Combine All Transactions
    const allUnifiedEntries: RentalDayBookEntry[] = [
      ...paymentEntries,
      ...expenseEntries,
      ...manualEntries
    ].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    // Date range resolution
    const today = this.getTodayDate();
    const fromDate = (filter.from || filter.date || today).trim();
    const toDate = (filter.to || filter.date || fromDate || today).trim();

    // 4. Authoritative Opening Balance Calculation (all historical records before fromDate)
    let openingBalance = 0;
    allUnifiedEntries.forEach(entry => {
      if (entry.date < fromDate) {
        if (!filter.complexId || entry.complexId === filter.complexId) {
          openingBalance += (entry.credit || 0) - (entry.debit || 0);
        }
      }
    });

    // 5. Filter for the selected range
    let inRangeEntries = allUnifiedEntries.filter(entry => {
      if (entry.date < fromDate || entry.date > toDate) return false;
      if (filter.complexId && filter.complexId !== 'ALL' && entry.complexId !== filter.complexId) return false;

      if (filter.paymentMode && filter.paymentMode !== 'ALL') {
        const mode = (entry.paymentMode || '').toUpperCase();
        const filterMode = filter.paymentMode.toUpperCase();
        if (mode !== filterMode && mode !== 'BOTH') return false;
      }

      if (filter.transactionType && filter.transactionType !== 'ALL') {
        const tt = filter.transactionType.toUpperCase();
        if (tt === 'INCOME' && entry.credit <= 0) return false;
        if (tt === 'EXPENSE' && entry.debit <= 0) return false;
        if (tt !== 'INCOME' && tt !== 'EXPENSE' && entry.transactionType.toUpperCase() !== tt) return false;
      }

      if (filter.search && filter.search.trim()) {
        const q = filter.search.trim().toLowerCase();
        const match =
          (entry.voucherNo && entry.voucherNo.toLowerCase().includes(q)) ||
          (entry.description && entry.description.toLowerCase().includes(q)) ||
          (entry.tenantName && entry.tenantName.toLowerCase().includes(q)) ||
          (entry.shopNumber && entry.shopNumber.toLowerCase().includes(q)) ||
          (entry.shopName && entry.shopName.toLowerCase().includes(q)) ||
          (entry.complexName && entry.complexName.toLowerCase().includes(q)) ||
          (entry.category && entry.category.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });

    // 6. Compute Running Balance & Totals
    let runningBal = openingBalance;
    let totalCredit = 0;
    let totalDebit = 0;

    const paymentModeSummary = {
      cashIncome: 0,
      cashExpense: 0,
      gpayIncome: 0,
      gpayExpense: 0,
      otherIncome: 0,
      otherExpense: 0
    };

    const complexSummaryMap = new Map<string, { complexId: string; complexName: string; income: number; expense: number; net: number }>();
    complexes.forEach(c => {
      complexSummaryMap.set(c.complexId, {
        complexId: c.complexId,
        complexName: c.complexName,
        income: 0,
        expense: 0,
        net: 0
      });
    });

    const enrichedEntries = inRangeEntries.map(entry => {
      runningBal = runningBal + (entry.credit || 0) - (entry.debit || 0);
      totalCredit += (entry.credit || 0);
      totalDebit += (entry.debit || 0);

      // Payment Mode Breakdown
      const mode = (entry.paymentMode || '').toUpperCase();
      if (mode === 'CASH') {
        paymentModeSummary.cashIncome += (entry.credit || 0);
        paymentModeSummary.cashExpense += (entry.debit || 0);
      } else if (mode === 'GPAY' || mode === 'UPI') {
        paymentModeSummary.gpayIncome += (entry.credit || 0);
        paymentModeSummary.gpayExpense += (entry.debit || 0);
      } else {
        paymentModeSummary.otherIncome += (entry.credit || 0);
        paymentModeSummary.otherExpense += (entry.debit || 0);
      }

      // Complex Breakdown
      if (entry.complexId) {
        let cs = complexSummaryMap.get(entry.complexId);
        if (!cs) {
          cs = {
            complexId: entry.complexId,
            complexName: entry.complexName || entry.complexId,
            income: 0,
            expense: 0,
            net: 0
          };
          complexSummaryMap.set(entry.complexId, cs);
        }
        cs.income += (entry.credit || 0);
        cs.expense += (entry.debit || 0);
        cs.net = cs.income - cs.expense;
      }

      return {
        ...entry,
        runningBalance: runningBal
      };
    });

    const closingBalance = openingBalance + totalCredit - totalDebit;

    // 7. Pagination
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Number(filter.limit) || 50);
    const totalCount = enrichedEntries.length;
    const startIndex = (page - 1) * limit;
    const paginatedEntries = enrichedEntries.slice(startIndex, startIndex + limit);

    const summary = {
      openingBalance,
      totalIncome: totalCredit,
      totalCredit,
      totalExpense: totalDebit,
      totalDebit,
      netCashFlow: totalCredit - totalDebit,
      closingBalance,
      cashIncome: paymentModeSummary.cashIncome,
      cashExpense: paymentModeSummary.cashExpense,
      netCash: paymentModeSummary.cashIncome - paymentModeSummary.cashExpense,
      gpayIncome: paymentModeSummary.gpayIncome,
      gpayExpense: paymentModeSummary.gpayExpense,
      netGpay: paymentModeSummary.gpayIncome - paymentModeSummary.gpayExpense,
      transactionCount: totalCount,
      paymentModeSummary,
      complexSummaries: Array.from(complexSummaryMap.values()),
      complexSummary: Array.from(complexSummaryMap.values())
    };

    const formattedEntries = paginatedEntries.map(e => ({
      ...e,
      entryId: e.voucherNo || e.id,
      particulars: e.description || e.category || 'Rental Transaction'
    }));

    return {
      summary,
      entries: formattedEntries,
      total: totalCount,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      openingBalance,
      totalCredit,
      totalDebit,
      closingBalance,
      paymentModeSummary,
      complexSummary: Array.from(complexSummaryMap.values())
    };
  }

  public async createManualDayBookEntry(
    data: {
      date?: string;
      transactionType?: string;
      category?: string;
      description?: string;
      particulars?: string;
      complexId?: string;
      shopId?: string;
      shopNumber?: string;
      tenantName?: string;
      paymentMode?: string;
      amount?: number;
      cashAmount?: number;
      gpayAmount?: number;
      debit?: number;
      credit?: number;
      notes?: string;
    },
    userId: string = 'STAFF'
  ): Promise<RentalDayBookEntry> {
    const complexes = rentalRepository.getComplexes();
    const complex = complexes.find(c => c.complexId === data.complexId);

    const now = new Date().toISOString();
    const voucherSeq = Date.now().toString().slice(-6);
    const voucherNo = `RDB-M${voucherSeq}`;

    const desc = data.particulars || data.description || 'Manual Adjustment';
    const isIncome =
      data.transactionType === 'MANUAL_INCOME' ||
      data.transactionType === 'OTHER_INCOME' ||
      Boolean(data.credit && data.credit > 0);

    const totalAmt = Number(data.amount || (isIncome ? data.credit : data.debit) || 0);
    const debit = isIncome ? 0 : Math.max(0, Math.round(Number(data.debit || totalAmt)));
    const credit = isIncome ? Math.max(0, Math.round(Number(data.credit || totalAmt))) : 0;

    const entry: RentalDayBookEntry = {
      id: `rdb_m_${Date.now()}`,
      voucherNo,
      date: data.date || this.getTodayDate(),
      transactionType: (data.transactionType || (isIncome ? 'OTHER_INCOME' : 'OTHER_EXPENSE')) as any,
      category: data.category || (isIncome ? 'Manual Income' : 'Manual Expense'),
      description: desc,
      complexId: data.complexId || 'GENERAL',
      complexName: complex?.complexName || data.complexId || 'General',
      shopId: data.shopId,
      shopNumber: data.shopNumber,
      tenantName: data.tenantName,
      paymentMode: data.paymentMode || 'CASH',
      debit,
      credit,
      referenceType: 'MANUAL',
      referenceId: voucherNo,
      entrySource: 'MANUAL',
      notes: data.notes,
      createdBy: userId,
      createdAt: now,
      updatedAt: now
    };

    await rentalDayBookRepository.saveManualEntry(entry);
    return {
      ...entry,
      entryId: entry.voucherNo,
      particulars: entry.description
    } as any;
  }
}

export const rentalService = new RentalService();
