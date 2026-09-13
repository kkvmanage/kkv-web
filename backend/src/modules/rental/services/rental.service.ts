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
  RentalDayBookEntry,
  ExpenseScope,
  PendingRentItem,
  PendingRentSummary,
  PendingRentResponse,
  ShopSettlementSummary,
  ComplexDeleteCheck,
  ShopDeleteCheck,
  RentalNotification
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

  // ── Date-Based Rent Due Helpers ──────────────────────────────────────────
  public calculateRentDueDate(monthStr: string, rentDueDay: number = 10): { dueDateStr: string; dueDate: Date } {
    const cleanMonth = (monthStr || this.getCurrentMonth()).slice(0, 7);
    const [yearStr, monthPart] = cleanMonth.split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const monthIndex = (parseInt(monthPart, 10) || (new Date().getMonth() + 1)) - 1;
    const maxDays = new Date(year, monthIndex + 1, 0).getDate();
    const dueDay = Math.min(Math.max(1, Math.round(Number(rentDueDay) || 10)), maxDays);
    const dueDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    const dueDate = new Date(year, monthIndex, dueDay);
    dueDate.setHours(0, 0, 0, 0);
    return { dueDateStr, dueDate };
  }

  public getShopRentDueMetrics(
    shop: RentalShop,
    monthStr: string,
    payments: RentalPayment[],
    asOfDate?: string | Date
  ) {
    const today = asOfDate ? (typeof asOfDate === 'string' ? new Date(asOfDate) : new Date(asOfDate)) : new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const cleanMonth = (monthStr || this.getCurrentMonth()).slice(0, 7);
    const { dueDateStr, dueDate } = this.calculateRentDueDate(cleanMonth, shop.rentDueDay || 10);

    const monthPayments = payments.filter((p) => p.shopId === shop.shopId && p.paymentMonth === cleanMonth);
    const amountReceived = monthPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
    const advanceUsed = monthPayments.reduce((sum, p) => sum + (Number(p.advanceUsed) || 0), 0);
    const advanceGenerated = monthPayments.reduce((sum, p) => sum + (Number(p.advanceGenerated) || 0), 0);
    const totalCovered = amountReceived + advanceUsed;

    const monthlyRent = Number(shop.monthlyRent) || 0;
    const unpaidBalance = Math.max(0, monthlyRent - totalCovered);
    const isFullyPaid = (totalCovered >= monthlyRent && monthlyRent > 0) || (monthlyRent === 0);
    const isDue = today.getTime() >= dueDate.getTime();
    const isDueToday = todayStr === dueDateStr;

    let isPending = unpaidBalance > 0;
    let pendingAmount = unpaidBalance;
    let daysOverdue = 0;
    let statusText: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' | 'DUE TODAY' | 'UPCOMING' = 'UPCOMING';

    if (isFullyPaid) {
      statusText = 'PAID';
      isPending = false;
      pendingAmount = 0;
    } else {
      if (today.getTime() > dueDate.getTime()) {
        const diffMs = today.getTime() - dueDate.getTime();
        daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        statusText = 'OVERDUE';
      } else if (isDueToday) {
        daysOverdue = 0;
        statusText = 'DUE TODAY';
      } else if (totalCovered > 0) {
        statusText = 'PARTIAL';
      } else {
        statusText = isDue ? 'PENDING' : 'UPCOMING';
      }
    }

    return {
      shopId: shop.shopId,
      shopNumber: shop.shopNumber,
      shopName: shop.shopName || '',
      tenantName: shop.tenantName || '',
      mobileNumber: shop.mobileNumber || '',
      doorNumber: shop.doorNumber || '',
      ebNumber: shop.ebNumber || '',
      complexId: shop.complexId,
      monthlyRent,
      rentDueDay: shop.rentDueDay || 10,
      month: cleanMonth,
      dueDateStr,
      dueDate,
      isDue,
      isDueToday,
      isFullyPaid,
      isPending,
      daysOverdue,
      amountPaid: amountReceived,
      advanceUsed,
      advanceGenerated,
      totalCovered,
      unpaidBalance,
      outstandingBalance: unpaidBalance,
      pendingAmount,
      availableAdvance: Number(shop.availableAdvance) || 0,
      status: isFullyPaid ? 'PAID' : daysOverdue > 0 ? 'OVERDUE' : isDueToday ? 'DUE' : totalCovered > 0 ? 'PARTIAL' : 'PENDING',
      statusText,
      payments: monthPayments
    };
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

  public async getComplexDeleteCheck(complexId: string): Promise<ComplexDeleteCheck> {
    const complex = rentalRepository.getComplexById(complexId);
    if (!complex) throw new Error(`Complex ${complexId} not found`);

    const shops = rentalRepository.getShopsByComplexId(complexId);
    const activeShops = shops.filter((s) => s.status === 'ACTIVE');
    const payments = rentalRepository.getPayments().filter((p) => p.complexId === complexId);
    const expenses = rentalRepository.getExpenses().filter((e) => e.complexId === complexId);
    const dayBookEntries = (await rentalDayBookRepository.getManualEntries()).filter((d) => d.complexId === complexId);

    const securityDepositsHeld = shops.reduce((sum, s) => sum + (Number(s.availableAdvance) || 0), 0);
    const currentMonth = this.getCurrentMonth();
    let totalPendingRent = 0;
    activeShops.forEach((s) => {
      const sPayments = payments.filter((p) => p.shopId === s.shopId);
      const metrics = this.getShopRentDueMetrics(s, currentMonth, sPayments);
      totalPendingRent += (metrics.pendingAmount || 0);
    });

    const shopsCount = shops.length;
    const activeShopsCount = activeShops.length;
    const paymentsCount = payments.length;
    const expensesCount = expenses.length;
    const dayBookEntriesCount = dayBookEntries.length;

    const hasDependencies =
      shopsCount > 0 ||
      paymentsCount > 0 ||
      expensesCount > 0 ||
      dayBookEntriesCount > 0 ||
      securityDepositsHeld > 0;

    let reason: string | undefined;
    if (hasDependencies) {
      const parts: string[] = [];
      if (shopsCount > 0) parts.push(`${shopsCount} shop(s) (${activeShopsCount} active)`);
      if (securityDepositsHeld > 0) parts.push(`₹${securityDepositsHeld.toLocaleString('en-IN')} security deposits held`);
      if (paymentsCount > 0) parts.push(`${paymentsCount} rent payment(s)`);
      if (expensesCount > 0) parts.push(`${expensesCount} expense(s)`);
      if (dayBookEntriesCount > 0) parts.push(`${dayBookEntriesCount} Day Book record(s)`);
      reason = `Cannot permanently delete complex "${complex.complexName}" (${complex.complexId}). It contains ${parts.join(', ')}. For data safety, please Disable or Archive the complex instead.`;
    } else {
      reason = `No rental or financial history was found. This unused complex can be permanently deleted.`;
    }

    return {
      complexId: complex.complexId,
      complexName: complex.complexName,
      canDelete: !hasDependencies,
      reason,
      dependencies: {
        shopsCount,
        activeShopsCount,
        paymentsCount,
        expensesCount,
        dayBookEntriesCount,
        securityDepositsHeld,
        pendingRent: totalPendingRent
      }
    };
  }

  public async deleteComplex(complexId: string, userId: string = 'SYSTEM'): Promise<boolean> {
    const complex = rentalRepository.getComplexById(complexId);
    if (!complex) throw new Error(`Complex ${complexId} not found`);

    const check = await this.getComplexDeleteCheck(complexId);
    if (!check.canDelete) {
      throw new Error(check.reason || `Cannot delete complex ${complex.complexName} because it contains dependent records.`);
    }

    const success = rentalRepository.deleteComplex(complexId);
    if (success) {
      rentalRepository.saveAuditLog({
        id: rentalRepository.nextAuditId(),
        auditId: rentalRepository.nextAuditId(),
        userId,
        action: 'DELETE_COMPLEX',
        entityType: 'Complex',
        entityId: complexId,
        oldValue: complex,
        timestamp: new Date().toISOString()
      });
      await syncService.enqueue('Complex', complexId, 'DELETE', complex);
    }
    return success;
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
          (s.doorNumber && s.doorNumber.toLowerCase().includes(q)) ||
          s.shopName.toLowerCase().includes(q) ||
          s.tenantName.toLowerCase().includes(q) ||
          s.mobileNumber.includes(q) ||
          (s.ebNumber && s.ebNumber.toLowerCase().includes(q)) ||
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
      doorNumber: string;
      shopName: string;
      tenantName: string;
      mobileNumber: string;
      ebNumber?: string;
      monthlyRent: number;
      rentDueDay?: number;
      advanceAmount?: number;
      advancePaymentMode?: PaymentMode | string;
      status?: RentalStatus;
    },
    userId: string = 'SYSTEM'
  ): Promise<RentalShop> {
    const complex = rentalRepository.getComplexById(data.complexId);
    if (!complex) {
      throw new Error(`Complex ${data.complexId} does not exist`);
    }
    if (complex.status === 'INACTIVE') {
      throw new Error(`Cannot add a shop to disabled/inactive complex "${complex.complexName}". Please enable the complex first.`);
    }

    if (!data.shopNumber || !data.shopNumber.trim()) {
      throw new Error('Shop number cannot be empty');
    }
    if (!data.doorNumber || !data.doorNumber.trim()) {
      throw new Error('Door number cannot be empty');
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

    const advanceAmount = data.advanceAmount !== undefined ? Number(data.advanceAmount) : 0;
    if (isNaN(advanceAmount) || advanceAmount < 0) {
      throw new Error('Advance amount must be a non-negative number');
    }

    const rentDueDay = data.rentDueDay !== undefined
      ? Math.min(31, Math.max(1, Math.round(Number(data.rentDueDay))))
      : 10;

    const cleanDoor = data.doorNumber.trim();
    const cleanEB = data.ebNumber ? data.ebNumber.trim() : '';

    // Check duplicate shop number in same complex
    const existingShops = rentalRepository.getShopsByComplexId(data.complexId);
    const isDuplicateShop = existingShops.some(
      (s) => s.shopNumber.trim().toLowerCase() === data.shopNumber.trim().toLowerCase()
    );
    if (isDuplicateShop) {
      throw new Error(`Shop number "${data.shopNumber}" already exists in ${complex.complexName}`);
    }

    // Check duplicate door number in same complex
    const isDuplicateDoor = existingShops.some(
      (s) => s.doorNumber && s.doorNumber.trim().toLowerCase() === cleanDoor.toLowerCase()
    );
    if (isDuplicateDoor) {
      throw new Error(`Door number "${cleanDoor}" already exists in ${complex.complexName}`);
    }

    // Check duplicate EB number if provided
    if (cleanEB) {
      const allShops = rentalRepository.getShops();
      const isDuplicateEB = allShops.some(
        (s) => s.ebNumber && s.ebNumber.trim().toLowerCase() === cleanEB.toLowerCase()
      );
      if (isDuplicateEB) {
        throw new Error(`EB number "${cleanEB}" is already registered to another shop`);
      }
    }

    const now = new Date().toISOString();
    const shopId = rentalRepository.nextShopId();
    const shop: RentalShop = {
      id: shopId,
      shopId,
      complexId: data.complexId,
      complexName: complex.complexName,
      shopNumber: data.shopNumber.trim(),
      doorNumber: cleanDoor,
      shopName: data.shopName.trim(),
      tenantName: data.tenantName.trim(),
      mobileNumber: cleanMobile,
      ebNumber: cleanEB || undefined,
      monthlyRent,
      rentDueDay,
      advanceAmount,
      availableAdvance: advanceAmount,
      status: data.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING'
    };

    rentalRepository.saveShop(shop);

    // If advance amount is collected, record a traceable Security Deposit entry in Day Book
    if (advanceAmount > 0) {
      const advanceEntry: RentalDayBookEntry = {
        id: `rdb_adv_${shopId}`,
        voucherNo: `ADV-${shopId}`,
        date: now.slice(0, 10),
        transactionType: 'SECURITY_DEPOSIT',
        category: 'Advance / Security Deposit',
        description: `Advance Security Deposit - ${shop.tenantName} (${shop.shopNumber})`,
        complexId: shop.complexId,
        complexName: complex.complexName,
        shopId: shop.shopId,
        shopNumber: shop.shopNumber,
        shopName: shop.shopName,
        tenantName: shop.tenantName,
        paymentMode: data.advancePaymentMode || 'CASH',
        debit: 0,
        credit: advanceAmount,
        referenceType: 'MANUAL',
        referenceId: shop.shopId,
        entrySource: 'SYSTEM',
        notes: `Advance Security Deposit collected on shop creation (${cleanDoor ? 'Door: ' + cleanDoor : ''})`,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      };
      await rentalDayBookRepository.saveManualEntry(advanceEntry);
    }

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
      doorNumber: string;
      shopName: string;
      tenantName: string;
      mobileNumber: string;
      ebNumber: string;
      monthlyRent: number;
      rentDueDay: number;
      // advanceAmount is intentionally excluded — it is an immutable historical record.
      // Only availableAdvance may be adjusted through authorised ledger operations.
      availableAdvance: number;
      status: RentalStatus;
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

    // Check duplicate door number if changed
    if (data.doorNumber && data.doorNumber.trim().toLowerCase() !== (existing.doorNumber || '').toLowerCase()) {
      const existingShops = rentalRepository.getShopsByComplexId(targetComplexId);
      const isDuplicateDoor = existingShops.some(
        (s) => s.shopId !== shopId && s.doorNumber && s.doorNumber.trim().toLowerCase() === data.doorNumber!.trim().toLowerCase()
      );
      if (isDuplicateDoor) {
        throw new Error(`Door number "${data.doorNumber}" already exists in complex`);
      }
    }

    // Check duplicate EB number if changed and non-empty
    if (data.ebNumber && data.ebNumber.trim().toLowerCase() !== (existing.ebNumber || '').toLowerCase()) {
      const cleanEB = data.ebNumber.trim().toLowerCase();
      const allShops = rentalRepository.getShops();
      const isDuplicateEB = allShops.some(
        (s) => s.shopId !== shopId && s.ebNumber && s.ebNumber.trim().toLowerCase() === cleanEB
      );
      if (isDuplicateEB) {
        throw new Error(`EB number "${data.ebNumber}" is already registered to another shop`);
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
      doorNumber: data.doorNumber !== undefined ? data.doorNumber.trim() : existing.doorNumber,
      shopName: data.shopName !== undefined ? data.shopName.trim() : existing.shopName,
      tenantName: data.tenantName !== undefined ? data.tenantName.trim() : existing.tenantName,
      mobileNumber: cleanMobile,
      ebNumber: data.ebNumber !== undefined ? data.ebNumber.trim() : existing.ebNumber,
      monthlyRent: data.monthlyRent !== undefined ? Number(data.monthlyRent) : existing.monthlyRent,
      rentDueDay: data.rentDueDay !== undefined ? Math.min(31, Math.max(1, Math.round(Number(data.rentDueDay)))) : (existing.rentDueDay || 10),
      // advanceAmount is ALWAYS preserved from the existing record — it is the original security deposit
      // and must never be overwritten by a shop-profile update.
      advanceAmount: existing.advanceAmount,
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
    return this.getShopRentDueMetrics(shop, month, allPayments);
  }

  // ── Shop Settlement & Lifecycle ───────────────────────────────────────────
  public async getShopSettlementSummary(shopId: string): Promise<ShopSettlementSummary> {
    const shop = rentalRepository.getShopById(shopId);
    if (!shop) throw new Error(`Shop ${shopId} not found`);

    const complex = rentalRepository.getComplexById(shop.complexId);
    const currentMonth = this.getCurrentMonth();
    const payments = rentalRepository.getPaymentsByShopId(shopId);
    const expenses = rentalRepository.getExpenses().filter((e) => e.shopId === shopId);

    const metrics = this.getShopRentDueMetrics(shop, currentMonth, payments);
    const securityDepositAmount = Number(shop.advanceAmount) || 0;
    const securityDepositBalance = Number(shop.availableAdvance) || 0;
    // Deducted = original minus current balance (already applied adjustments)
    const securityDepositDeducted = Math.max(0, securityDepositAmount - securityDepositBalance);
    const pendingRent = metrics.pendingAmount || 0;
    const outstandingBalance = pendingRent;
    // Refundable = current balance (the business decides whether to deduct outstanding rent)
    const refundableDeposit = securityDepositBalance;
    const financialTransactionCount = payments.length + expenses.length;

    return {
      shopId: shop.shopId,
      shopNumber: shop.shopNumber,
      doorNumber: shop.doorNumber,
      shopName: shop.shopName,
      tenantName: shop.tenantName,
      mobileNumber: shop.mobileNumber,
      ebNumber: shop.ebNumber,
      complexId: shop.complexId,
      complexName: complex?.complexName || shop.complexName || 'Unknown Complex',
      location: complex?.location,
      monthlyRent: shop.monthlyRent,
      rentDueDay: shop.rentDueDay || 10,
      pendingRent,
      securityDepositAmount,
      securityDepositDeducted,
      securityDepositBalance,
      outstandingBalance,
      refundableDeposit,
      financialTransactionCount,
      canClose: shop.status !== 'CLOSED',
      canDelete: financialTransactionCount === 0 && securityDepositBalance === 0 && pendingRent === 0,
      status: shop.status
    };
  }

  public async closeShop(
    shopId: string,
    data: {
      reason?: string;
      notes?: string;
      refundAmount?: number;
      refundPaymentMode?: PaymentMode | string;
      refundNotes?: string;
    },
    userId: string = 'STAFF'
  ): Promise<{ shop: RentalShop; settlement: ShopSettlementSummary }> {
    const shop = rentalRepository.getShopById(shopId);
    if (!shop) throw new Error(`Shop ${shopId} not found`);

    if (shop.status === 'CLOSED') {
      throw new Error(`Shop "${shop.shopNumber}" (${shopId}) is already closed`);
    }

    const settlement = await this.getShopSettlementSummary(shopId);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // Validate refund amount
    const refundAmount = Math.max(0, Number(data.refundAmount || 0));
    if (refundAmount > settlement.securityDepositBalance) {
      throw new Error(
        `Refund amount (\u20b9${refundAmount}) cannot exceed the security deposit balance (\u20b9${settlement.securityDepositBalance})`
      );
    }

    const updatedShop: RentalShop = {
      ...shop,
      status: 'CLOSED',
      closedAt: now,
      closedBy: userId,
      closingReason: data.reason || 'Tenancy ended',
      settlementNotes: data.notes || '',
      refundableAdvanceAtClose: settlement.refundableDeposit,
      closingPendingRent: settlement.pendingRent,
      // Record the refunded amount by reducing availableAdvance
      availableAdvance: Math.max(0, (Number(shop.availableAdvance) || 0) - refundAmount),
      updatedAt: now,
      syncStatus: 'PENDING'
    };

    rentalRepository.saveShop(updatedShop);

    // Record Security Deposit Refund in Day Book
    if (refundAmount > 0) {
      const complex = rentalRepository.getComplexById(shop.complexId);
      const refundEntry: RentalDayBookEntry = {
        id: `rdb_refund_${shopId}_${Date.now()}`,
        voucherNo: `REFUND-${shopId}`,
        date: today,
        transactionType: 'SECURITY_DEPOSIT_REFUND',
        category: 'Security Deposit Refund',
        description: `Security Deposit Refund - ${shop.tenantName} (${shop.shopNumber}) on shop closure`,
        complexId: shop.complexId,
        complexName: complex?.complexName || shop.complexName || '',
        shopId: shop.shopId,
        shopNumber: shop.shopNumber,
        shopName: shop.shopName,
        tenantName: shop.tenantName,
        paymentMode: (data.refundPaymentMode as PaymentMode) || 'CASH',
        debit: refundAmount,   // Refund is money going OUT
        credit: 0,
        referenceType: 'REFUND',
        referenceId: shopId,
        entrySource: 'SYSTEM',
        notes: data.refundNotes || `Security deposit refund on shop closure. Closing reason: ${data.reason || 'Tenancy ended'}`,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      };
      await rentalDayBookRepository.saveManualEntry(refundEntry);
    }

    rentalRepository.saveAuditLog({
      id: rentalRepository.nextAuditId(),
      auditId: rentalRepository.nextAuditId(),
      userId,
      action: 'CLOSE_SHOP',
      entityType: 'Shop',
      entityId: shopId,
      oldValue: shop,
      newValue: {
        ...updatedShop,
        settlementSummary: settlement,
        depositRefunded: refundAmount
      },
      timestamp: now
    });

    await syncService.enqueue('Shop', shopId, 'UPDATE', updatedShop);

    return {
      shop: updatedShop,
      settlement
    };
  }

  // ── Security Deposit Refund (standalone, before or independent of close) ───
  public async refundSecurityDeposit(
    shopId: string,
    data: {
      refundAmount: number;
      paymentMode: PaymentMode | string;
      refundDate?: string;
      notes?: string;
    },
    userId: string = 'STAFF'
  ): Promise<{ shop: RentalShop; refundedAmount: number; remainingBalance: number }> {
    const shop = rentalRepository.getShopById(shopId);
    if (!shop) throw new Error(`Shop ${shopId} not found`);

    const refundAmount = Number(data.refundAmount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      throw new Error('Refund amount must be a positive number');
    }

    const currentBalance = Number(shop.availableAdvance) || 0;
    if (refundAmount > currentBalance) {
      throw new Error(
        `Refund amount (\u20b9${refundAmount.toLocaleString('en-IN')}) exceeds the current security deposit balance (\u20b9${currentBalance.toLocaleString('en-IN')})`
      );
    }

    const now = new Date().toISOString();
    const today = data.refundDate || now.slice(0, 10);
    const remainingBalance = currentBalance - refundAmount;

    // Update deposit balance
    const updatedShop: RentalShop = {
      ...shop,
      availableAdvance: remainingBalance,
      updatedAt: now,
      syncStatus: 'PENDING'
    };
    rentalRepository.saveShop(updatedShop);

    // Record in Day Book
    const complex = rentalRepository.getComplexById(shop.complexId);
    const refundEntry: RentalDayBookEntry = {
      id: `rdb_refund_${shopId}_${Date.now()}`,
      voucherNo: `REFUND-${shopId}-${Date.now()}`,
      date: today,
      transactionType: 'SECURITY_DEPOSIT_REFUND',
      category: 'Security Deposit Refund',
      description: `Security Deposit Refund - ${shop.tenantName} (${shop.shopNumber})`,
      complexId: shop.complexId,
      complexName: complex?.complexName || shop.complexName || '',
      shopId: shop.shopId,
      shopNumber: shop.shopNumber,
      shopName: shop.shopName,
      tenantName: shop.tenantName,
      paymentMode: (data.paymentMode as PaymentMode) || 'CASH',
      debit: refundAmount,
      credit: 0,
      referenceType: 'REFUND',
      referenceId: shopId,
      entrySource: 'SYSTEM',
      notes: data.notes || `Partial security deposit refund. Remaining balance: \u20b9${remainingBalance.toLocaleString('en-IN')}`,
      createdBy: userId,
      createdAt: now,
      updatedAt: now
    };
    await rentalDayBookRepository.saveManualEntry(refundEntry);

    rentalRepository.saveAuditLog({
      id: rentalRepository.nextAuditId(),
      auditId: rentalRepository.nextAuditId(),
      userId,
      action: 'SECURITY_DEPOSIT_REFUND',
      entityType: 'Advance',
      entityId: shopId,
      newValue: { refundAmount, remainingBalance, paymentMode: data.paymentMode },
      timestamp: now
    });

    await syncService.enqueue('Shop', shopId, 'UPDATE', updatedShop);
    return { shop: updatedShop, refundedAmount: refundAmount, remainingBalance };
  }

  public async getShopDeleteCheck(shopId: string): Promise<ShopDeleteCheck> {
    const shop = rentalRepository.getShopById(shopId);
    if (!shop) throw new Error(`Shop ${shopId} not found`);

    const payments = rentalRepository.getPaymentsByShopId(shopId);
    const expenses = rentalRepository.getExpenses().filter((e) => e.shopId === shopId);
    const dayBookEntries = (await rentalDayBookRepository.getManualEntries()).filter(
      (d) => d.shopId === shopId || d.referenceId === shopId
    );

    const securityDepositAmount = Number(shop.advanceAmount) || 0;
    const securityDepositBalance = Number(shop.availableAdvance) || 0;

    const currentMonth = this.getCurrentMonth();
    const metrics = this.getShopRentDueMetrics(shop, currentMonth, payments);
    const pendingRent = metrics.pendingAmount || 0;

    const paymentsCount = payments.length;
    const expensesCount = expenses.length;
    const dayBookEntriesCount = dayBookEntries.length;

    const hasFinancialRecords =
      paymentsCount > 0 ||
      expensesCount > 0 ||
      dayBookEntriesCount > 0 ||
      securityDepositAmount > 0 ||
      securityDepositBalance > 0 ||
      pendingRent > 0;

    let reason: string | undefined;
    if (hasFinancialRecords) {
      const parts: string[] = [];
      if (paymentsCount > 0) parts.push(`${paymentsCount} rent payment(s)`);
      if (securityDepositBalance > 0) parts.push(`₹${securityDepositBalance.toLocaleString('en-IN')} security deposit balance`);
      if (pendingRent > 0) parts.push(`₹${pendingRent.toLocaleString('en-IN')} pending rent`);
      if (expensesCount > 0) parts.push(`${expensesCount} expense(s)`);
      if (dayBookEntriesCount > 0) parts.push(`${dayBookEntriesCount} Day Book record(s)`);
      reason = `Cannot permanently delete shop "${shop.shopNumber}" (${shop.shopName || shop.shopId}). It contains ${parts.join(', ')}. Financial history must be preserved. Use "Close Shop" to settle and archive it.`;
    } else {
      reason = `This shop has no financial or rental history and can be permanently deleted.`;
    }

    return {
      shopId: shop.shopId,
      shopNumber: shop.shopNumber,
      shopName: shop.shopName,
      tenantName: shop.tenantName,
      complexName: shop.complexName,
      canDelete: !hasFinancialRecords,
      reason,
      dependencies: {
        paymentsCount,
        expensesCount,
        dayBookEntriesCount,
        securityDepositAmount,
        securityDepositBalance,
        pendingRent,
        status: shop.status
      }
    };
  }

  public async deleteShop(shopId: string, userId: string = 'SYSTEM'): Promise<boolean> {
    const shop = rentalRepository.getShopById(shopId);
    if (!shop) throw new Error(`Shop ${shopId} not found`);

    const check = await this.getShopDeleteCheck(shopId);
    if (!check.canDelete) {
      throw new Error(check.reason || `Cannot permanently delete shop "${shop.shopNumber}". Financial history exists.`);
    }

    const success = rentalRepository.deleteShop(shopId);
    if (success) {
      rentalRepository.saveAuditLog({
        id: rentalRepository.nextAuditId(),
        auditId: rentalRepository.nextAuditId(),
        userId,
        action: 'DELETE_SHOP',
        entityType: 'Shop',
        entityId: shopId,
        oldValue: shop,
        timestamp: new Date().toISOString()
      });
      await syncService.enqueue('Shop', shopId, 'DELETE', shop);
    }
    return success;
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

    if (amountReceived === 0) {
      throw new Error('Payment amount received must be greater than zero');
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
          `Cash amount (\u20b9${cashAmount}) + GPay amount (\u20b9${gpayAmount}) must equal total amount received (\u20b9${amountReceived})`
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

    // Security deposit is NEVER used for rent collection.
    // advanceUsed is always 0 in rent payments.
    const actualAdvanceUsed = 0;
    const dueAfterAdvance = remainingDueBeforeThisPayment;

    // Rent covered by new cash/gpay payment
    const rentCoveredByPayment = Math.min(amountReceived, dueAfterAdvance);

    // Any surplus received generates Rent Credit for future months
    const advanceGenerated = Math.max(0, amountReceived - dueAfterAdvance);

    // Outstanding balance for this month after this transaction
    const balanceAfterPayment = Math.max(0, dueAfterAdvance - rentCoveredByPayment);

    // Calculate total covered status
    const totalCoveredNow = priorCovered + rentCoveredByPayment;
    let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PENDING';
    if (totalCoveredNow >= monthlyRent) {
      paymentStatus = 'PAID';
    } else if (totalCoveredNow > 0) {
      paymentStatus = 'PARTIAL';
    }

    // Overpayment surplus increases availableAdvance (rent credit, NOT security deposit)
    if (advanceGenerated > 0) {
      const newAvailableAdvance = shop.availableAdvance + advanceGenerated;
      shop.availableAdvance = newAvailableAdvance;
      rentalRepository.saveShop(shop);
    }

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

    if (advanceGenerated > 0) {
      rentalRepository.saveAuditLog({
        id: rentalRepository.nextAuditId(),
        auditId: rentalRepository.nextAuditId(),
        userId,
        action: 'RENT_CREDIT_GENERATED',
        entityType: 'Advance',
        entityId: shop.shopId,
        newValue: { amount: advanceGenerated, paymentId, totalAdvance: shop.availableAdvance },
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
    scope?: ExpenseScope;
    category?: ExpenseCategory;
    paymentMode?: PaymentMode;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<RentalExpense[]> {
    let list = rentalRepository.getExpenses();
    const complexes = rentalRepository.getComplexes();
    const shops = rentalRepository.getShops();
    const complexMap = new Map(complexes.map((c) => [c.complexId, c.complexName]));
    const shopMap = new Map(shops.map((s) => [s.shopId, s.shopNumber]));

    list = list.map((e) => {
      const scope: ExpenseScope = e.expenseScope || (e.shopId ? 'SHOP' : e.complexId ? 'COMPLEX' : 'RENTAL');
      return {
        ...e,
        expenseScope: scope,
        complexName: e.complexName || (e.complexId ? complexMap.get(e.complexId) : '') || 'General Rental',
        shopNumber: e.shopId ? shopMap.get(e.shopId) || '' : undefined
      };
    });

    if (filters?.complexId) list = list.filter((e) => e.complexId === filters.complexId);
    if (filters?.shopId) list = list.filter((e) => e.shopId === filters.shopId);
    if (filters?.scope) list = list.filter((e) => e.expenseScope === filters.scope);
    if (filters?.category) list = list.filter((e) => e.category === filters.category);
    if (filters?.paymentMode) list = list.filter((e) => e.paymentMode === filters.paymentMode);
    if (filters?.startDate) list = list.filter((e) => e.expenseDate >= filters.startDate!);
    if (filters?.endDate) list = list.filter((e) => e.expenseDate <= filters.endDate!);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.expenseId.toLowerCase().includes(q) ||
          e.expenseReason.toLowerCase().includes(q) ||
          (e.category ? e.category.toLowerCase().includes(q) : false) ||
          (e.complexName && e.complexName.toLowerCase().includes(q)) ||
          (e.notes && e.notes.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  }

  public async createExpense(
    data: {
      complexId?: string | null;
      expenseScope?: ExpenseScope;
      shopId?: string | null;
      expenseDate: string;
      category?: ExpenseCategory | string;
      expenseReason: string;
      expenseAmount: number;
      paymentMode: PaymentMode;
      cashAmount?: number;
      gpayAmount?: number;
      receiptUrl?: string;
      notes?: string;
    },
    userId: string = 'SYSTEM'
  ): Promise<RentalExpense> {
    if (!data.expenseReason || !data.expenseReason.trim()) {
      throw new Error('Expense description / reason is required');
    }

    const expenseAmount = Number(data.expenseAmount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      throw new Error('Expense amount must be a positive number greater than zero');
    }

    let complexId: string | null = null;
    let complexName: string = 'General Rental';
    if (data.complexId && data.complexId.trim()) {
      const complex = rentalRepository.getComplexById(data.complexId.trim());
      if (complex) {
        complexId = complex.complexId;
        complexName = complex.complexName;
      }
    }

    const scope: ExpenseScope = data.expenseScope || (data.shopId ? 'SHOP' : complexId ? 'COMPLEX' : 'RENTAL');

    let resolvedShopId: string | undefined = undefined;
    if (scope === 'SHOP' && data.shopId && data.shopId.trim()) {
      const shop = rentalRepository.getShopById(data.shopId.trim());
      if (shop) {
        resolvedShopId = shop.shopId;
        if (!complexId) {
          complexId = shop.complexId;
          complexName = shop.complexName || 'General Rental';
        }
      }
    }

    const category = data.category?.trim() || 'General';

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
      if (cashAmount < 0 || gpayAmount < 0) {
        throw new Error('Split cash and GPay amounts cannot be negative');
      }
      if (Math.abs(cashAmount + gpayAmount - expenseAmount) > 0.01) {
        throw new Error(
          `Cash amount (₹${cashAmount.toLocaleString('en-IN')}) + GPay amount (₹${gpayAmount.toLocaleString('en-IN')}) must equal total expense amount (₹${expenseAmount.toLocaleString('en-IN')})`
        );
      }
    }

    const now = new Date().toISOString();
    const expenseId = rentalRepository.nextExpenseId();

    const expense: RentalExpense = {
      id: expenseId,
      expenseId,
      complexId,
      complexName,
      expenseScope: scope,
      shopId: resolvedShopId,
      expenseDate: data.expenseDate || this.getTodayDate(),
      category: category as ExpenseCategory,
      expenseReason: data.expenseReason.trim(),
      expenseAmount,
      paymentMode: mode,
      cashAmount,
      gpayAmount,
      receiptUrl: data.receiptUrl?.trim() || undefined,
      notes: data.notes?.trim() || '',
      createdBy: userId,
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
      complexId?: string | null;
      expenseScope?: ExpenseScope;
      shopId?: string | null;
      expenseDate: string;
      category?: ExpenseCategory | string;
      expenseReason: string;
      expenseAmount: number;
      paymentMode: PaymentMode;
      cashAmount?: number;
      gpayAmount?: number;
      receiptUrl?: string;
      notes?: string;
    }>,
    userId: string = 'SYSTEM'
  ): Promise<RentalExpense> {
    const existing = rentalRepository.getExpenseById(expenseId);
    if (!existing) throw new Error(`Expense ${expenseId} not found`);

    let complexId = existing.complexId;
    let complexName = existing.complexName || 'General Rental';

    if (data.complexId !== undefined) {
      if (data.complexId && data.complexId.trim()) {
        const complex = rentalRepository.getComplexById(data.complexId.trim());
        if (complex) {
          complexId = complex.complexId;
          complexName = complex.complexName;
        }
      } else {
        complexId = null;
        complexName = 'General Rental';
      }
    }

    const scope: ExpenseScope = data.expenseScope || existing.expenseScope || (existing.shopId ? 'SHOP' : complexId ? 'COMPLEX' : 'RENTAL');

    let resolvedShopId: string | undefined = existing.shopId || undefined;
    if (data.shopId !== undefined) {
      if (data.shopId && data.shopId.trim()) {
        const shop = rentalRepository.getShopById(data.shopId.trim());
        if (shop) resolvedShopId = shop.shopId;
      } else {
        resolvedShopId = undefined;
      }
    }

    const expenseAmount = data.expenseAmount !== undefined ? Number(data.expenseAmount) : existing.expenseAmount;
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      throw new Error('Expense amount must be a positive number greater than zero');
    }

    const mode = data.paymentMode || existing.paymentMode || 'CASH';
    let cashAmount = data.cashAmount !== undefined ? Number(data.cashAmount) : existing.cashAmount;
    let gpayAmount = data.gpayAmount !== undefined ? Number(data.gpayAmount) : existing.gpayAmount;

    if (mode === 'CASH') {
      cashAmount = expenseAmount;
      gpayAmount = 0;
    } else if (mode === 'GPAY') {
      cashAmount = 0;
      gpayAmount = expenseAmount;
    } else if (mode === 'BOTH') {
      if (cashAmount < 0 || gpayAmount < 0) {
        throw new Error('Split cash and GPay amounts cannot be negative');
      }
      if (Math.abs(cashAmount + gpayAmount - expenseAmount) > 0.01) {
        throw new Error(
          `Cash amount (₹${cashAmount.toLocaleString('en-IN')}) + GPay amount (₹${gpayAmount.toLocaleString('en-IN')}) must equal total expense amount (₹${expenseAmount.toLocaleString('en-IN')})`
        );
      }
    }

    const now = new Date().toISOString();
    const updated: RentalExpense = {
      ...existing,
      complexId,
      complexName,
      expenseScope: scope,
      shopId: resolvedShopId,
      expenseDate: data.expenseDate || existing.expenseDate,
      category: (data.category !== undefined ? data.category : existing.category) as ExpenseCategory,
      expenseReason: data.expenseReason !== undefined ? data.expenseReason.trim() : existing.expenseReason,
      expenseAmount,
      paymentMode: mode,
      cashAmount,
      gpayAmount,
      receiptUrl: data.receiptUrl !== undefined ? data.receiptUrl.trim() : existing.receiptUrl,
      notes: data.notes !== undefined ? data.notes.trim() : existing.notes,
      updatedBy: userId,
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

    // Calculate date-based pending rent for each active shop for selected month
    let pendingRent = 0;
    activeShops.forEach((s) => {
      const metrics = this.getShopRentDueMetrics(s, selectedMonth, monthPayments);
      pendingRent += metrics.pendingAmount;
    });

    const availableAdvance = shops.reduce((sum, s) => sum + s.availableAdvance, 0);

    const todaysPayments = payments.filter((p) => p.paymentDate === today);
    const todaysCollection = todaysPayments.reduce((sum, p) => sum + p.amountReceived, 0);

    const todaysExpensesList = expenses.filter((e) => e.expenseDate === today);
    const todaysExpenses = todaysExpensesList.reduce((sum, e) => sum + e.expenseAmount, 0);

    const thisMonthExpensesList = expenses.filter((e) => e.expenseDate.startsWith(selectedMonth));
    const thisMonthExpenses = thisMonthExpensesList.reduce((sum, e) => sum + e.expenseAmount, 0);

    const netCollection = collectedThisMonth - thisMonthExpenses;

    // Monthly Trend (Last 6 Months) - Date-Aware
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
        const metrics = this.getShopRentDueMetrics(s, mStr, mPayments);
        mPending += metrics.pendingAmount;
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

    // Complex Stats - Date-Aware
    const allComplexes = rentalRepository.getComplexes();
    const complexStats = allComplexes.map((c) => {
      const cShops = rentalRepository.getShopsByComplexId(c.complexId).filter((s) => s.status === 'ACTIVE');
      const cExpected = cShops.reduce((sum, s) => sum + s.monthlyRent, 0);
      const cPayments = rentalRepository.getPayments().filter((p) => p.complexId === c.complexId && p.paymentMonth === selectedMonth);
      const cCollected = cPayments.reduce((sum, p) => sum + p.amountReceived, 0);
      const cExpenses = rentalRepository.getExpenses().filter((e) => e.complexId === c.complexId && e.expenseDate.startsWith(selectedMonth)).reduce((sum, e) => sum + e.expenseAmount, 0);

      let cPending = 0;
      cShops.forEach((s) => {
        const metrics = this.getShopRentDueMetrics(s, selectedMonth, cPayments);
        cPending += metrics.pendingAmount;
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
      const metrics = this.getShopRentDueMetrics(s, selectedMonth, payments);
      pendingRent += metrics.pendingAmount;
    });

    const complexPerformance = complexes.map((c) => {
      const cShops = shops.filter((s) => s.complexId === c.complexId && s.status === 'ACTIVE');
      const cExpected = cShops.reduce((sum, s) => sum + s.monthlyRent, 0);
      const cPayments = payments.filter((p) => p.complexId === c.complexId);
      const cCollected = cPayments.reduce((sum, p) => sum + p.amountReceived, 0);
      const cExpenses = expenses.filter((e) => e.complexId === c.complexId).reduce((sum, e) => sum + e.expenseAmount, 0);

      let cPending = 0;
      cShops.forEach((s) => {
        const metrics = this.getShopRentDueMetrics(s, selectedMonth, cPayments);
        cPending += metrics.pendingAmount;
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
        const metrics = this.getShopRentDueMetrics(s, month, cPayments);
        pending += metrics.pendingAmount;
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

  // ── Pending Rent List ──────────────────────────────────────────────────────
  public async getPendingRentList(params?: {
    month?: string;
    complexId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PendingRentResponse> {
    const selectedMonth = params?.month ? params.month.slice(0, 7) : this.getCurrentMonth();

    const complexes = rentalRepository.getComplexes();
    const complexMap = new Map(complexes.map((c) => [c.complexId, c]));

    let shops = rentalRepository.getShops().filter((s) => s.status === 'ACTIVE');
    if (params?.complexId) {
      shops = shops.filter((s) => s.complexId === params.complexId);
    }

    const allPayments = rentalRepository.getPayments();
    const monthPayments = allPayments.filter((p) => p.paymentMonth === selectedMonth);

    // Calculate metrics for every active shop
    const allShopItems: PendingRentItem[] = shops.map((shop) => {
      const complex = complexMap.get(shop.complexId);
      const metrics = this.getShopRentDueMetrics(shop, selectedMonth, monthPayments);

      let rowStatus: 'DUE' | 'OVERDUE' | 'PARTIAL' | 'PENDING' | 'PAID';
      if (metrics.isFullyPaid) {
        rowStatus = 'PAID';
      } else if (metrics.daysOverdue > 0) {
        rowStatus = 'OVERDUE';
      } else if (metrics.isDueToday) {
        rowStatus = 'DUE';
      } else if (metrics.totalCovered > 0) {
        rowStatus = 'PARTIAL';
      } else {
        rowStatus = 'PENDING';
      }

      return {
        id: shop.id || shop.shopId,
        complexId: shop.complexId,
        complexName: complex?.complexName || shop.complexName || 'Unknown Complex',
        location: complex?.location || '',
        shopId: shop.shopId,
        shopNumber: shop.shopNumber,
        doorNumber: shop.doorNumber || '',
        shopName: shop.shopName || '',
        tenantName: shop.tenantName || '',
        mobileNumber: shop.mobileNumber || '',
        ebNumber: shop.ebNumber || '',
        dueDate: metrics.dueDateStr,
        rentDueDay: shop.rentDueDay || 10,
        monthlyRent: metrics.monthlyRent,
        paidAmount: metrics.amountPaid,
        advanceUsed: metrics.advanceUsed,
        totalCovered: metrics.totalCovered,
        pendingAmount: metrics.pendingAmount,
        daysOverdue: metrics.daysOverdue,
        status: rowStatus,
        availableAdvance: Number(shop.availableAdvance) || 0
      };
    });

    // ── Summary Metrics (Calculated across all active shops in scope) ────────
    const pendingShopsList = allShopItems.filter((i) => i.pendingAmount > 0);
    const overdueShopsList = allShopItems.filter((i) => i.daysOverdue > 0 && i.pendingAmount > 0);
    const dueTodayShopsList = allShopItems.filter((i) => i.status === 'DUE' && i.pendingAmount > 0);
    const partialShopsList = allShopItems.filter((i) => i.totalCovered > 0 && i.pendingAmount > 0);

    const totalPendingRent = pendingShopsList.reduce((sum, item) => sum + item.pendingAmount, 0);
    const totalOverdueRent = overdueShopsList.reduce((sum, item) => sum + item.pendingAmount, 0);
    const totalDueTodayRent = dueTodayShopsList.reduce((sum, item) => sum + item.pendingAmount, 0);
    const totalPartialRent = partialShopsList.reduce((sum, item) => sum + item.pendingAmount, 0);

    const summary: PendingRentSummary = {
      totalPendingRent,
      totalPendingAmount: totalPendingRent,
      totalPendingShops: pendingShopsList.length,
      pendingShops: pendingShopsList.length,
      totalOverdueRent,
      overdueAmount: totalOverdueRent,
      totalOverdueShops: overdueShopsList.length,
      overdueShops: overdueShopsList.length,
      totalDueTodayRent,
      dueTodayAmount: totalDueTodayRent,
      totalDueTodayShops: dueTodayShopsList.length,
      dueTodayShops: dueTodayShopsList.length,
      totalPartialRent,
      partiallyPaidAmount: totalPartialRent,
      totalPartialShops: partialShopsList.length,
      partiallyPaidShops: partialShopsList.length
    };

    // ── Filter Display Items ────────────────────────────────────────────────
    let displayedItems = [...allShopItems];

    // Status filter
    const statusFilter = (params?.status || 'ALL').toUpperCase();
    if (statusFilter === 'PAID') {
      displayedItems = displayedItems.filter((i) => i.status === 'PAID');
    } else if (statusFilter === 'OVERDUE') {
      displayedItems = displayedItems.filter((i) => i.status === 'OVERDUE');
    } else if (statusFilter === 'DUE' || statusFilter === 'DUE_TODAY') {
      displayedItems = displayedItems.filter((i) => i.status === 'DUE');
    } else if (statusFilter === 'PARTIAL' || statusFilter === 'PARTIALLY_PAID') {
      displayedItems = displayedItems.filter((i) => i.totalCovered > 0 && i.pendingAmount > 0);
    } else if (statusFilter === 'PENDING') {
      displayedItems = displayedItems.filter((i) => i.pendingAmount > 0 && i.totalCovered === 0);
    } else {
      // 'ALL': by default displays all shops with pending unpaid/partial balance
      displayedItems = displayedItems.filter((i) => i.pendingAmount > 0);
    }

    // Search filter
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      displayedItems = displayedItems.filter((item) =>
        item.complexName.toLowerCase().includes(q) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        item.shopNumber.toLowerCase().includes(q) ||
        (item.doorNumber && item.doorNumber.toLowerCase().includes(q)) ||
        (item.shopName && item.shopName.toLowerCase().includes(q)) ||
        item.tenantName.toLowerCase().includes(q) ||
        item.mobileNumber.includes(q) ||
        (item.ebNumber && item.ebNumber.toLowerCase().includes(q))
      );
    }

    // Default Sorting: Overdue highest days first, then highest pending amount
    displayedItems.sort((a, b) => {
      if (a.daysOverdue !== b.daysOverdue) {
        return b.daysOverdue - a.daysOverdue;
      }
      return b.pendingAmount - a.pendingAmount;
    });

    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 100;
    const total = displayedItems.length;
    const pages = Math.max(1, Math.ceil(total / limit));

    return {
      summary,
      items: displayedItems,
      month: selectedMonth,
      pagination: {
        page,
        limit,
        total,
        pages
      }
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
        credit: Number(p.amountReceived || 0),
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
      const cName = e.complexName || (e.complexId ? complexMap.get(e.complexId) : '') || 'General Rental';
      const scope = e.expenseScope || (e.shopId ? 'SHOP' : e.complexId ? 'COMPLEX' : 'RENTAL');
      return {
        id: `rdb_exp_${e.expenseId || e.id}`,
        voucherNo: e.expenseId || `EXP-${e.id}`,
        date: e.expenseDate || e.createdAt?.slice(0, 10) || this.getTodayDate(),
        transactionType: 'MAINTENANCE_EXPENSE',
        category: e.category || 'Rental Expense',
        description: e.expenseReason || `${e.category || 'Rental'} Expense`,
        complexId: e.complexId || undefined,
        complexName: cName,
        shopId: e.shopId || undefined,
        shopNumber: e.shopNumber || (scope === 'COMPLEX' ? 'General Complex' : scope === 'RENTAL' || !e.shopId ? 'General Rental' : undefined),
        paymentMode: e.paymentMode,
        debit: Number(e.expenseAmount || 0),
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
    const debit = isIncome ? 0 : Math.max(0, Number(data.debit || totalAmt));
    const credit = isIncome ? Math.max(0, Number(data.credit || totalAmt)) : 0;

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

  // ── Rental-Scoped Notifications ───────────────────────────────────────────
  public async getRentalNotifications(readNotificationIds: string[] = []): Promise<RentalNotification[]> {
    const notificationsMap = new Map<string, RentalNotification>();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const selectedMonth = this.getCurrentMonth();

    // 1. Pending & Overdue Rent Notifications
    const pendingRentResponse = await this.getPendingRentList({ month: selectedMonth });
    for (const item of pendingRentResponse.items) {
      if (item.status === 'OVERDUE') {
        const notifId = `rental_${item.shopId}_overdue_${selectedMonth}`;
        notificationsMap.set(notifId, {
          id: notifId,
          module: 'RENTAL',
          category: 'RENTAL',
          type: 'RENT_OVERDUE',
          priority: item.daysOverdue > 15 ? 'CRITICAL' : 'HIGH',
          customerId: item.tenantName,
          customerName: item.tenantName,
          customerPhone: item.mobileNumber,
          entityId: item.shopNumber,
          shopId: item.shopId,
          complexId: item.complexId,
          complexName: item.complexName,
          title: `⚠ Rent Overdue — ${item.shopNumber}`,
          message: `Rent overdue for ${item.shopNumber} (${item.tenantName}) — ₹${item.pendingAmount.toLocaleString('en-IN')} pending since ${item.dueDate} (${item.daysOverdue} days overdue).`,
          amount: item.pendingAmount,
          dueDate: item.dueDate,
          periodKey: selectedMonth,
          daysOverdue: item.daysOverdue,
          read: readNotificationIds.includes(notifId),
          actionLabel: 'Collect Rent',
          createdAt: item.dueDate || todayStr
        });
      } else if (item.status === 'DUE') {
        const notifId = `rental_${item.shopId}_due_${selectedMonth}`;
        notificationsMap.set(notifId, {
          id: notifId,
          module: 'RENTAL',
          category: 'RENTAL',
          type: 'RENT_DUE',
          priority: 'MEDIUM',
          customerId: item.tenantName,
          customerName: item.tenantName,
          customerPhone: item.mobileNumber,
          entityId: item.shopNumber,
          shopId: item.shopId,
          complexId: item.complexId,
          complexName: item.complexName,
          title: `🔔 Rent Due Today — ${item.shopNumber}`,
          message: `Rent due today for ${item.shopNumber} (${item.tenantName}) — ₹${item.pendingAmount.toLocaleString('en-IN')}.`,
          amount: item.pendingAmount,
          dueDate: item.dueDate,
          periodKey: selectedMonth,
          daysRemaining: 0,
          read: readNotificationIds.includes(notifId),
          actionLabel: 'Collect Rent',
          createdAt: todayStr
        });
      } else if (item.status === 'PARTIAL') {
        const notifId = `rental_${item.shopId}_partial_${selectedMonth}`;
        notificationsMap.set(notifId, {
          id: notifId,
          module: 'RENTAL',
          category: 'RENTAL',
          type: 'RENT_PARTIAL',
          priority: 'MEDIUM',
          customerId: item.tenantName,
          customerName: item.tenantName,
          customerPhone: item.mobileNumber,
          entityId: item.shopNumber,
          shopId: item.shopId,
          complexId: item.complexId,
          complexName: item.complexName,
          title: `⏳ Partial Rent Pending — ${item.shopNumber}`,
          message: `${item.tenantName} paid ₹${item.totalCovered.toLocaleString('en-IN')}. ₹${item.pendingAmount.toLocaleString('en-IN')} rent remains pending for ${item.shopNumber}.`,
          amount: item.pendingAmount,
          dueDate: item.dueDate,
          periodKey: selectedMonth,
          daysOverdue: item.daysOverdue,
          read: readNotificationIds.includes(notifId),
          actionLabel: 'Collect Rent',
          createdAt: todayStr
        });
      }
    }

    // 2. Pending Security Deposit Refunds (Closed shops with security deposit balance)
    const allShops = rentalRepository.getShops();
    const closedShopsWithDeposit = allShops.filter(
      (s) => s.status === 'CLOSED' && Number(s.availableAdvance) > 0
    );
    for (const shop of closedShopsWithDeposit) {
      const notifId = `rental_${shop.shopId}_deposit_refund_pending`;
      notificationsMap.set(notifId, {
        id: notifId,
        module: 'RENTAL',
        category: 'RENTAL',
        type: 'SECURITY_DEPOSIT_REFUND_PENDING',
        priority: 'HIGH',
        customerId: shop.tenantName,
        customerName: shop.tenantName,
        customerPhone: shop.mobileNumber,
        entityId: shop.shopNumber,
        shopId: shop.shopId,
        complexId: shop.complexId,
        complexName: shop.complexName,
        title: `🛡 Security Deposit Refund Pending — ${shop.shopNumber}`,
        message: `₹${Number(shop.availableAdvance).toLocaleString('en-IN')} security deposit is pending settlement for ${shop.shopNumber} (${shop.tenantName}).`,
        amount: Number(shop.availableAdvance),
        read: readNotificationIds.includes(notifId),
        actionLabel: 'Refund Deposit',
        createdAt: shop.closedAt ? shop.closedAt.slice(0, 10) : todayStr
      });
    }

    // 3. Recent Security Deposits Received (from Day Book)
    const dayBookEntries = await rentalDayBookRepository.getManualEntries();
    const recentDepositEntries = dayBookEntries.filter((e: RentalDayBookEntry) => e.transactionType === 'SECURITY_DEPOSIT').slice(-10);
    for (const entry of recentDepositEntries) {
      const notifId = `rental_sec_dep_${entry.id}`;
      notificationsMap.set(notifId, {
        id: notifId,
        module: 'RENTAL',
        category: 'RENTAL',
        type: 'SECURITY_DEPOSIT_RECEIVED',
        priority: 'LOW',
        customerId: entry.tenantName || 'Tenant',
        customerName: entry.tenantName || 'Tenant',
        entityId: entry.shopNumber || entry.voucherNo,
        shopId: entry.shopId,
        complexId: entry.complexId,
        complexName: entry.complexName,
        title: `💰 Security Deposit Received`,
        message: `Security deposit of ₹${Number(entry.credit).toLocaleString('en-IN')} received for ${entry.shopNumber || entry.description}.`,
        amount: Number(entry.credit),
        read: readNotificationIds.includes(notifId) || true, // info only
        actionLabel: 'View Details',
        createdAt: entry.date || todayStr
      });
    }

    // 4. Recent Security Deposit Refunds Completed (from Day Book)
    const recentRefundEntries = dayBookEntries.filter((e: RentalDayBookEntry) => e.transactionType === 'SECURITY_DEPOSIT_REFUND').slice(-10);
    for (const entry of recentRefundEntries) {
      const notifId = `rental_sec_refund_${entry.id}`;
      notificationsMap.set(notifId, {
        id: notifId,
        module: 'RENTAL',
        category: 'RENTAL',
        type: 'SECURITY_DEPOSIT_REFUND',
        priority: 'LOW',
        customerId: entry.tenantName || 'Tenant',
        customerName: entry.tenantName || 'Tenant',
        entityId: entry.shopNumber || entry.voucherNo,
        shopId: entry.shopId,
        complexId: entry.complexId,
        complexName: entry.complexName,
        title: `✓ Security Deposit Refunded`,
        message: `Security deposit refund of ₹${Number(entry.debit).toLocaleString('en-IN')} completed for ${entry.shopNumber || entry.description}.`,
        amount: Number(entry.debit),
        read: readNotificationIds.includes(notifId) || true,
        actionLabel: 'View Day Book',
        createdAt: entry.date || todayStr
      });
    }

    // 5. Recent Shop Closures
    const recentlyClosedShops = allShops.filter((s) => s.status === 'CLOSED' && s.closedAt).slice(-5);
    for (const shop of recentlyClosedShops) {
      const notifId = `rental_shop_closed_${shop.shopId}`;
      if (!notificationsMap.has(notifId)) {
        notificationsMap.set(notifId, {
          id: notifId,
          module: 'RENTAL',
          category: 'RENTAL',
          type: 'SHOP_CLOSED',
          priority: 'LOW',
          customerId: shop.tenantName,
          customerName: shop.tenantName,
          customerPhone: shop.mobileNumber,
          entityId: shop.shopNumber,
          shopId: shop.shopId,
          complexId: shop.complexId,
          complexName: shop.complexName,
          title: `📦 Shop Closed — ${shop.shopNumber}`,
          message: `${shop.shopNumber} (${shop.shopName}) was closed successfully.`,
          read: readNotificationIds.includes(notifId) || true,
          actionLabel: 'View Shops',
          createdAt: shop.closedAt ? shop.closedAt.slice(0, 10) : todayStr
        });
      }
    }

    // Sort by priority and date
    const PRIORITY_ORDER: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    };

    const notifList = Array.from(notificationsMap.values());
    notifList.sort((a, b) => {
      const pDiff = (PRIORITY_ORDER[b.priority] || 1) - (PRIORITY_ORDER[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return notifList;
  }
}

export const rentalService = new RentalService();
