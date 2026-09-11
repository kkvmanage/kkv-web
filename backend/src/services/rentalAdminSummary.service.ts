import { rentalRepository } from '../modules/rental/repositories/rental.repository.js';
import { rentalDayBookRepository } from '../modules/rental/repositories/rentalDayBook.repository.js';
import { getFinanceDb } from '../config/database.js';

export interface AdminRentalSummary {
  month: string;
  source: 'RENTAL_SERVICE' | 'SYNCED_RENTAL_DATA' | 'GOOGLE_DRIVE';
  version?: number;
  lastSyncedAt: string;
  syncStatus: 'SYNCED' | 'PENDING' | 'DELAYED' | 'FAILED' | 'NO_DATA';
  syncStatusMessage?: string;
  totalComplexes: number;
  totalShops: number;
  expectedMonthlyRent: number;
  collectedThisMonth: number;
  pendingRent: number;
  availableAdvance: number;
  totalExpenses: number;
  netCollection: number;
  todaysCollection: number;
  todaysExpenses: number;
  collectionRate: number;
  paymentModeSplit: {
    cashTotal: number;
    gpayTotal: number;
    total: number;
    cashCount: number;
    gpayCount: number;
    bothCount: number;
  };
  complexPerformance: {
    complexId: string;
    complexName: string;
    location: string;
    totalShops: number;
    expectedRent: number;
    collected: number;
    pending: number;
    advance: number;
    expenses: number;
    netCollection: number;
    collectionRate: number;
  }[];
  complexBreakdown: {
    complexId: string;
    complexName: string;
    location?: string;
    totalShops: number;
    expectedRent: number;
    collected: number;
    pending: number;
    advance?: number;
    expenses: number;
    netCollection: number;
    collectionRate: number;
  }[];
  pendingRentList: {
    shopId: string;
    shopNumber: string;
    shopName: string;
    tenantName: string;
    mobileNumber: string;
    complexId: string;
    complexName: string;
    monthlyRent: number;
    collectedThisMonth: number;
    advanceUsed: number;
    pendingBalance: number;
    availableAdvance: number;
    paymentStatus: string;
  }[];
  recentPayments: {
    paymentId: string;
    complexId?: string;
    complexName: string;
    shopId?: string;
    shopNumber: string;
    tenantName: string;
    mobileNumber?: string;
    paymentMonth: string;
    amountReceived: number;
    cashAmount: number;
    gpayAmount: number;
    advanceUsed: number;
    balance: number;
    paymentMode: string;
    paymentDate: string;
    paymentStatus: string;
    notes?: string;
  }[];
  recentExpenses: {
    expenseId: string;
    complexId?: string;
    complexName: string;
    expenseScope?: string;
    shopId?: string;
    shopNumber?: string;
    category: string;
    expenseReason: string;
    expenseAmount: number;
    cashAmount?: number;
    gpayAmount?: number;
    paymentMode: string;
    expenseDate: string;
    notes?: string;
  }[];
}

class RentalAdminSummaryService {
  private loadRawRentalData(): {
    complexes: any[];
    shops: any[];
    payments: any[];
    expenses: any[];
    syncQueue: any[];
    mtime?: string;
    version?: number;
  } {
    const complexes = rentalRepository.getComplexes();
    const shops = rentalRepository.getShops();
    const payments = rentalRepository.getPayments();
    const expenses = rentalRepository.getExpenses();
    const syncQueue = rentalRepository.getSyncQueue();

    const version = syncQueue.length > 0 ? (100 + syncQueue.length) : (complexes.length + shops.length + payments.length + expenses.length);

    return {
      complexes,
      shops,
      payments,
      expenses,
      syncQueue,
      mtime: new Date().toISOString(),
      version
    };
  }

  public getComplexesList() {
    const { complexes, shops } = this.loadRawRentalData();
    return complexes.map((c) => {
      const cShops = shops.filter((s) => s.complexId === c.complexId);
      return {
        ...c,
        totalShops: cShops.length,
        activeShops: cShops.filter((s) => s.status === 'ACTIVE').length
      };
    });
  }

  public getShopsList(complexId?: string) {
    const { complexes, shops } = this.loadRawRentalData();
    const complexMap = new Map(complexes.map((c) => [c.complexId, c.complexName]));
    let filtered = shops;
    if (complexId) filtered = filtered.filter((s) => s.complexId === complexId);

    return filtered.map((s) => ({
      ...s,
      complexName: complexMap.get(s.complexId) || s.complexId
    }));
  }

  public getSummary(options?: { month?: string; complexId?: string; search?: string }): AdminRentalSummary {
    const currentMonth = options?.month || new Date().toISOString().substring(0, 7);
    const filterComplexId = options?.complexId;
    const searchQuery = (options?.search || '').toLowerCase().trim();
    const todayISO = new Date().toISOString().substring(0, 10);

    const { complexes: allComplexes, shops: allShops, payments: allPayments, expenses: allExpenses, syncQueue, mtime, version } = this.loadRawRentalData();

    // Map helpers
    const complexMap = new Map(allComplexes.map((c) => [c.complexId, c]));
    const shopMap = new Map(allShops.map((s) => [s.shopId, s]));

    // Filter complexes if specified
    const complexes = filterComplexId
      ? allComplexes.filter((c) => c.complexId === filterComplexId)
      : allComplexes;

    // Active shops in scope
    let shops = filterComplexId
      ? allShops.filter((s) => s.complexId === filterComplexId)
      : allShops;

    if (searchQuery) {
      shops = shops.filter((s) =>
        (s.shopNumber || '').toLowerCase().includes(searchQuery) ||
        (s.shopName || '').toLowerCase().includes(searchQuery) ||
        (s.tenantName || '').toLowerCase().includes(searchQuery) ||
        (s.mobileNumber || '').includes(searchQuery) ||
        (s.complexId || '').toLowerCase().includes(searchQuery)
      );
    }

    const activeShops = shops.filter((s) => s.status === 'ACTIVE');
    const totalComplexes = complexes.length;
    const totalShops = shops.length;

    // Expected Rent
    const expectedMonthlyRent = activeShops.reduce((sum, s) => sum + (Number(s.monthlyRent) || 0), 0);
    const availableAdvance = activeShops.reduce((sum, s) => sum + (Number(s.availableAdvance) || 0), 0);

    // Payments in selected month
    let monthPayments = allPayments.filter((p) => p.paymentMonth === currentMonth);
    if (filterComplexId) {
      monthPayments = monthPayments.filter((p) => p.complexId === filterComplexId);
    }

    const collectedThisMonth = monthPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
    const advanceUsedThisMonth = monthPayments.reduce((sum, p) => sum + (Number(p.advanceUsed) || 0), 0);

    // Calculate pending rent per shop
    let pendingRent = 0;
    const pendingRentList: AdminRentalSummary['pendingRentList'] = [];

    activeShops.forEach((shop) => {
      const shopPayments = monthPayments.filter((p) => p.shopId === shop.shopId);
      const shopCollected = shopPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
      const shopAdvanceUsed = shopPayments.reduce((sum, p) => sum + (Number(p.advanceUsed) || 0), 0);
      const shopExpected = Number(shop.monthlyRent) || 0;
      const shopBalance = Math.max(0, shopExpected - (shopCollected + shopAdvanceUsed));
      
      const comp = complexMap.get(shop.complexId);
      let pStatus = 'UNPAID';
      if (shopBalance === 0 && shopExpected > 0) pStatus = 'PAID';
      else if (shopCollected > 0 || shopAdvanceUsed > 0) pStatus = 'PARTIAL';

      if (shopBalance > 0) {
        pendingRent += shopBalance;
        pendingRentList.push({
          shopId: shop.shopId,
          shopNumber: shop.shopNumber,
          shopName: shop.shopName,
          tenantName: shop.tenantName,
          mobileNumber: shop.mobileNumber,
          complexId: shop.complexId,
          complexName: comp?.complexName || shop.complexId,
          monthlyRent: shopExpected,
          collectedThisMonth: shopCollected,
          advanceUsed: shopAdvanceUsed,
          pendingBalance: shopBalance,
          availableAdvance: Number(shop.availableAdvance) || 0,
          paymentStatus: pStatus
        });
      }
    });

    // Sort pending rent list highest outstanding first
    pendingRentList.sort((a, b) => b.pendingBalance - a.pendingBalance);

    // Expenses in selected month
    let monthExpenses = allExpenses.filter((e) => (e.expenseDate || '').startsWith(currentMonth));
    if (filterComplexId) {
      monthExpenses = monthExpenses.filter((e) => e.complexId === filterComplexId);
    }
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + (Number(e.expenseAmount) || 0), 0);
    const netCollection = collectedThisMonth - totalExpenses;

    // Today's collections and expenses
    const todaysPayments = allPayments.filter((p) => (p.paymentDate || '').startsWith(todayISO));
    const todaysCollection = todaysPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);

    const todaysExpensesList = allExpenses.filter((e) => (e.expenseDate || '').startsWith(todayISO));
    const todaysExpenses = todaysExpensesList.reduce((sum, e) => sum + (Number(e.expenseAmount) || 0), 0);

    // Collection Rate
    const collectionRate = expectedMonthlyRent > 0
      ? Math.min(100, Math.round(((collectedThisMonth + advanceUsedThisMonth) / expectedMonthlyRent) * 100))
      : (totalComplexes > 0 ? 100 : 0);

    // Payment Mode Split for selected month
    const cashTotal = monthPayments.reduce((sum, p) => sum + (Number(p.cashAmount) || 0), 0);
    const gpayTotal = monthPayments.reduce((sum, p) => sum + (Number(p.gpayAmount) || 0), 0);
    const cashCount = monthPayments.filter((p) => p.paymentMode === 'CASH').length;
    const gpayCount = monthPayments.filter((p) => p.paymentMode === 'GPAY').length;
    const bothCount = monthPayments.filter((p) => p.paymentMode === 'BOTH').length;

    // Complex Performance Breakdown
    const complexPerformance = complexes.map((c) => {
      const cShops = allShops.filter((s) => s.complexId === c.complexId);
      const cActiveShops = cShops.filter((s) => s.status === 'ACTIVE');
      const cExpected = cActiveShops.reduce((sum, s) => sum + (Number(s.monthlyRent) || 0), 0);
      const cAdvance = cActiveShops.reduce((sum, s) => sum + (Number(s.availableAdvance) || 0), 0);

      const cPayments = allPayments.filter((p) => p.complexId === c.complexId && p.paymentMonth === currentMonth);
      const cCollected = cPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
      const cAdvanceUsed = cPayments.reduce((sum, p) => sum + (Number(p.advanceUsed) || 0), 0);
      const cPending = Math.max(0, cExpected - (cCollected + cAdvanceUsed));

      const cExpenses = allExpenses
        .filter((e) => e.complexId === c.complexId && (e.expenseDate || '').startsWith(currentMonth))
        .reduce((sum, e) => sum + (Number(e.expenseAmount) || 0), 0);

      const cNet = cCollected - cExpenses;
      const cRate = cExpected > 0 ? Math.min(100, Math.round(((cCollected + cAdvanceUsed) / cExpected) * 100)) : 100;

      return {
        complexId: c.complexId,
        complexName: c.complexName || c.name || c.complexId,
        location: c.location || 'N/A',
        totalShops: cShops.length,
        expectedRent: cExpected,
        collected: cCollected,
        pending: cPending,
        advance: cAdvance,
        expenses: cExpenses,
        netCollection: cNet,
        collectionRate: cRate
      };
    });

    // Recent Payments List
    let paymentsScope = allPayments;
    if (filterComplexId) paymentsScope = paymentsScope.filter((p) => p.complexId === filterComplexId);
    const recentPayments = paymentsScope
      .slice(-25)
      .reverse()
      .map((p) => {
        const s = shopMap.get(p.shopId);
        const c = complexMap.get(p.complexId || (s ? s.complexId : ''));
        return {
          paymentId: p.paymentId,
          complexId: p.complexId || s?.complexId,
          complexName: c?.complexName || p.complexName || p.complexId || 'N/A',
          shopId: p.shopId,
          shopNumber: s?.shopNumber || p.shopNumber || p.shopId || 'N/A',
          tenantName: s?.tenantName || p.tenantName || 'N/A',
          mobileNumber: s?.mobileNumber || p.mobileNumber || '',
          paymentMonth: p.paymentMonth || currentMonth,
          amountReceived: Number(p.amountReceived) || 0,
          cashAmount: Number(p.cashAmount) || 0,
          gpayAmount: Number(p.gpayAmount) || 0,
          advanceUsed: Number(p.advanceUsed) || 0,
          balance: Number(p.balance) || 0,
          paymentMode: p.paymentMode || 'CASH',
          paymentDate: p.paymentDate || '',
          paymentStatus: p.paymentStatus || p.status || 'PAID',
          notes: p.notes
        };
      });

    // Recent Expenses List
    let expensesScope = allExpenses;
    if (filterComplexId) expensesScope = expensesScope.filter((e) => e.complexId === filterComplexId);
    const recentExpenses = expensesScope
      .slice(-25)
      .reverse()
      .map((e) => {
        const c = complexMap.get(e.complexId);
        const s = e.shopId ? shopMap.get(e.shopId) : undefined;
        const scope = e.expenseScope || (e.shopId ? 'SHOP' : 'COMPLEX');
        return {
          expenseId: e.expenseId,
          complexId: e.complexId,
          complexName: c?.complexName || e.complexName || e.complexId || 'N/A',
          expenseScope: scope,
          shopId: e.shopId,
          shopNumber: s?.shopNumber || e.shopNumber || (scope === 'COMPLEX' ? 'General Complex Expense' : ''),
          category: e.category || 'Maintenance',
          expenseReason: e.expenseReason || e.reason || 'General Expense',
          expenseAmount: Number(e.expenseAmount) || 0,
          cashAmount: Number(e.cashAmount) || 0,
          gpayAmount: Number(e.gpayAmount) || 0,
          paymentMode: e.paymentMode || 'CASH',
          expenseDate: e.expenseDate || '',
          notes: e.notes
        };
      });

    // Sync Status computation
    let syncStatus: AdminRentalSummary['syncStatus'] = 'SYNCED';
    let syncStatusMessage = 'Connected and synchronized with Rental Ledger.';

    if (totalComplexes === 0 && totalShops === 0) {
      syncStatus = 'NO_DATA';
      syncStatusMessage = 'No complexes registered yet in Rental system.';
    }

    const lastSyncedAt = mtime || new Date().toISOString();

    return {
      month: currentMonth,
      source: 'SYNCED_RENTAL_DATA',
      version: version || 100,
      lastSyncedAt,
      syncStatus,
      syncStatusMessage,
      totalComplexes,
      totalShops,
      expectedMonthlyRent,
      collectedThisMonth,
      pendingRent,
      availableAdvance,
      totalExpenses,
      netCollection,
      todaysCollection,
      todaysExpenses,
      collectionRate,
      paymentModeSplit: {
        cashTotal,
        gpayTotal,
        total: cashTotal + gpayTotal,
        cashCount,
        gpayCount,
        bothCount
      },
      complexPerformance,
      complexBreakdown: complexPerformance,
      pendingRentList,
      recentPayments,
      recentExpenses
    };
  }

  public getComplexDetails(complexId: string, month?: string) {
    const currentMonth = month || new Date().toISOString().substring(0, 7);
    const { complexes, shops, payments, expenses } = this.loadRawRentalData();

    const complex = complexes.find((c) => c.complexId === complexId);
    if (!complex) return null;

    const cShops = shops.filter((s) => s.complexId === complexId);
    const cActiveShops = cShops.filter((s) => s.status === 'ACTIVE');
    const monthPayments = payments.filter((p) => p.complexId === complexId && p.paymentMonth === currentMonth);
    const monthExpenses = expenses.filter((e) => e.complexId === complexId && (e.expenseDate || '').startsWith(currentMonth));

    const expectedRent = cActiveShops.reduce((sum, s) => sum + (Number(s.monthlyRent) || 0), 0);
    const collected = monthPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
    const advanceUsed = monthPayments.reduce((sum, p) => sum + (Number(p.advanceUsed) || 0), 0);
    const pending = Math.max(0, expectedRent - (collected + advanceUsed));
    const advance = cActiveShops.reduce((sum, s) => sum + (Number(s.availableAdvance) || 0), 0);
    const expenseTotal = monthExpenses.reduce((sum, e) => sum + (Number(e.expenseAmount) || 0), 0);
    const netCollection = collected - expenseTotal;

    // Detailed shops with monthly status
    const shopList = cShops.map((s) => {
      const sPayments = monthPayments.filter((p) => p.shopId === s.shopId);
      const sCollected = sPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
      const sAdvUsed = sPayments.reduce((sum, p) => sum + (Number(p.advanceUsed) || 0), 0);
      const sRent = Number(s.monthlyRent) || 0;
      const sBalance = Math.max(0, sRent - (sCollected + sAdvUsed));
      let pStatus = 'UNPAID';
      if (sBalance === 0 && sRent > 0) pStatus = 'PAID';
      else if (sCollected > 0 || sAdvUsed > 0) pStatus = 'PARTIAL';

      return {
        shopId: s.shopId,
        shopNumber: s.shopNumber,
        shopName: s.shopName,
        tenantName: s.tenantName,
        mobileNumber: s.mobileNumber,
        monthlyRent: sRent,
        availableAdvance: Number(s.availableAdvance) || 0,
        status: s.status,
        currentMonthPaid: sCollected,
        currentMonthAdvanceUsed: sAdvUsed,
        currentMonthBalance: sBalance,
        paymentStatus: pStatus
      };
    });

    return {
      complexId: complex.complexId,
      complexName: complex.complexName,
      location: complex.location,
      status: complex.status,
      totalShops: cShops.length,
      activeShops: cActiveShops.length,
      month: currentMonth,
      expectedRent,
      collected,
      pending,
      advance,
      expenses: expenseTotal,
      netCollection,
      collectionRate: expectedRent > 0 ? Math.min(100, Math.round(((collected + advanceUsed) / expectedRent) * 100)) : 100,
      shops: shopList
    };
  }

  public getShopDetails(shopId: string, month?: string) {
    const currentMonth = month || new Date().toISOString().substring(0, 7);
    const { complexes, shops, payments, expenses } = this.loadRawRentalData();

    const shop = shops.find((s) => s.shopId === shopId);
    if (!shop) return null;

    const complex = complexes.find((c) => c.complexId === shop.complexId);

    // Payments history
    const shopPayments = payments
      .filter((p) => p.shopId === shopId)
      .sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));

    // Expenses for this shop
    const shopExpenses = expenses
      .filter((e) => e.shopId === shopId)
      .sort((a, b) => (b.expenseDate || '').localeCompare(a.expenseDate || ''));

    // Current month status
    const thisMonthPayments = shopPayments.filter((p) => p.paymentMonth === currentMonth);
    const paid = thisMonthPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
    const advanceUsed = thisMonthPayments.reduce((sum, p) => sum + (Number(p.advanceUsed) || 0), 0);
    const rent = Number(shop.monthlyRent) || 0;
    const balance = Math.max(0, rent - (paid + advanceUsed));
    let status = 'UNPAID';
    if (balance === 0 && rent > 0) status = 'PAID';
    else if (paid > 0 || advanceUsed > 0) status = 'PARTIAL';

    return {
      shopId: shop.shopId,
      complexId: shop.complexId,
      complexName: complex?.complexName || shop.complexId,
      shopNumber: shop.shopNumber,
      shopName: shop.shopName,
      tenantName: shop.tenantName,
      mobileNumber: shop.mobileNumber,
      monthlyRent: rent,
      availableAdvance: Number(shop.availableAdvance) || 0,
      shopStatus: shop.status,
      currentMonth: {
        month: currentMonth,
        expectedRent: rent,
        paid,
        advanceUsed,
        balance,
        status
      },
      payments: shopPayments,
      expenses: shopExpenses
    };
  }

  public getPayments(filters?: {
    month?: string;
    complexId?: string;
    shopId?: string;
    search?: string;
    status?: string;
    mode?: string;
  }) {
    const { complexes, shops, payments } = this.loadRawRentalData();
    const complexMap = new Map(complexes.map((c) => [c.complexId, c]));
    const shopMap = new Map(shops.map((s) => [s.shopId, s]));

    let results = payments;

    if (filters?.month) results = results.filter((p) => p.paymentMonth === filters.month);
    if (filters?.complexId) results = results.filter((p) => p.complexId === filters.complexId);
    if (filters?.shopId) results = results.filter((p) => p.shopId === filters.shopId);
    if (filters?.mode) results = results.filter((p) => p.paymentMode === filters.mode);
    if (filters?.status) results = results.filter((p) => (p.paymentStatus || p.status) === filters.status);

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      results = results.filter((p) => {
        const s = shopMap.get(p.shopId);
        const c = complexMap.get(p.complexId || (s ? s.complexId : ''));
        return (
          p.paymentId.toLowerCase().includes(q) ||
          (p.tenantName || s?.tenantName || '').toLowerCase().includes(q) ||
          (p.shopNumber || s?.shopNumber || '').toLowerCase().includes(q) ||
          (c?.complexName || '').toLowerCase().includes(q) ||
          (p.mobileNumber || s?.mobileNumber || '').includes(q)
        );
      });
    }

    return results
      .sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''))
      .map((p) => {
        const s = shopMap.get(p.shopId);
        const c = complexMap.get(p.complexId || (s ? s.complexId : ''));
        return {
          paymentId: p.paymentId,
          complexId: p.complexId || s?.complexId,
          complexName: c?.complexName || p.complexName || 'N/A',
          shopId: p.shopId,
          shopNumber: s?.shopNumber || p.shopNumber || 'N/A',
          tenantName: s?.tenantName || p.tenantName || 'N/A',
          mobileNumber: s?.mobileNumber || p.mobileNumber || '',
          paymentMonth: p.paymentMonth,
          amountReceived: Number(p.amountReceived) || 0,
          cashAmount: Number(p.cashAmount) || 0,
          gpayAmount: Number(p.gpayAmount) || 0,
          advanceUsed: Number(p.advanceUsed) || 0,
          balance: Number(p.balance) || 0,
          paymentMode: p.paymentMode,
          paymentDate: p.paymentDate,
          paymentStatus: p.paymentStatus || p.status || 'PAID',
          notes: p.notes
        };
      });
  }

  public getExpenses(filters?: {
    month?: string;
    complexId?: string;
    shopId?: string;
    search?: string;
    category?: string;
  }) {
    const { complexes, shops, expenses } = this.loadRawRentalData();
    const complexMap = new Map(complexes.map((c) => [c.complexId, c]));
    const shopMap = new Map(shops.map((s) => [s.shopId, s]));

    let results = expenses;

    if (filters?.month) results = results.filter((e) => (e.expenseDate || '').startsWith(filters.month!));
    if (filters?.complexId) results = results.filter((e) => e.complexId === filters.complexId);
    if (filters?.shopId) results = results.filter((e) => e.shopId === filters.shopId);
    if (filters?.category) results = results.filter((e) => e.category === filters.category);

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      results = results.filter((e) => {
        const c = complexMap.get(e.complexId);
        const s = e.shopId ? shopMap.get(e.shopId) : undefined;
        return (
          e.expenseId.toLowerCase().includes(q) ||
          (e.expenseReason || '').toLowerCase().includes(q) ||
          (c?.complexName || '').toLowerCase().includes(q) ||
          (s?.shopNumber || '').toLowerCase().includes(q) ||
          (e.category || '').toLowerCase().includes(q)
        );
      });
    }

    return results
      .sort((a, b) => (b.expenseDate || '').localeCompare(a.expenseDate || ''))
      .map((e) => {
        const c = complexMap.get(e.complexId);
        const s = e.shopId ? shopMap.get(e.shopId) : undefined;
        return {
          expenseId: e.expenseId,
          complexId: e.complexId,
          complexName: c?.complexName || e.complexName || 'N/A',
          shopId: e.shopId,
          shopNumber: s?.shopNumber || '',
          category: e.category,
          expenseReason: e.expenseReason,
          expenseAmount: Number(e.expenseAmount) || 0,
          cashAmount: Number(e.cashAmount) || 0,
          gpayAmount: Number(e.gpayAmount) || 0,
          paymentMode: e.paymentMode,
          expenseDate: e.expenseDate,
          notes: e.notes
        };
      });
  }

  public getSyncStatus() {
    const { complexes, shops, payments, expenses, syncQueue, mtime, version } = this.loadRawRentalData();
    const pendingItems = syncQueue.filter((q) => q.status === 'PENDING').length;
    const failedItems = syncQueue.filter((q) => q.status === 'FAILED').length;
    const syncedItems = syncQueue.filter((q) => q.status === 'SYNCED').length;

    return {
      status: failedItems > 0 ? 'SYNC_DELAYED' : (pendingItems > 0 ? 'SYNC_PENDING' : 'SYNCED'),
      version: version || 100,
      lastSyncedAt: mtime || new Date().toISOString(),
      source: 'Google Drive (kkv finance / Rental)',
      pendingChanges: pendingItems,
      isConfigured: true,
      counts: {
        complexes: complexes.length,
        shops: shops.length,
        payments: payments.length,
        expenses: expenses.length,
        syncQueue: syncQueue.length,
        syncedItems,
        pendingItems,
        failedItems
      }
    };
  }

  public async resetRentalBusinessData(): Promise<{
    resetCounts: {
      complexes: number;
      shops: number;
      payments: number;
      expenses: number;
      daybook: number;
      auditLogs: number;
      syncQueue: number;
    };
    timestamp: string;
  }> {
    const complexes = rentalRepository.getComplexes();
    const shops = rentalRepository.getShops();
    const payments = rentalRepository.getPayments();
    const expenses = rentalRepository.getExpenses();
    const auditLogs = rentalRepository.getAuditLogs();
    const syncQueue = rentalRepository.getSyncQueue();

    const counts = {
      complexes: complexes.length,
      shops: shops.length,
      payments: payments.length,
      expenses: expenses.length,
      daybook: 0,
      auditLogs: auditLogs.length,
      syncQueue: syncQueue.length
    };

    // 1. Reset rental repository JSON files safely
    rentalRepository.writeJson('complexes.json', []);
    rentalRepository.writeJson('shops.json', []);
    rentalRepository.writeJson('rent_payments.json', []);
    rentalRepository.writeJson('expenses.json', []);
    rentalRepository.writeJson('audit_logs.json', []);
    rentalRepository.writeJson('sync_queue.json', []);
    rentalRepository.writeJson('counters.json', {
      complex: 0,
      shop: 0,
      payment: 0,
      expense: 0,
      audit: 0,
      sync: 0
    });

    rentalDayBookRepository.writeJson('rental_daybook.json', []);

    // 2. Clear MongoDB rental_daybook collection if connected
    try {
      const db = await getFinanceDb();
      if (db) {
        await db.collection('rental_daybook').deleteMany({});
      }
    } catch (err) {
      console.warn('[RentalAdminSummaryService] Warning clearing MongoDB rental_daybook:', err);
    }

    return {
      resetCounts: counts,
      timestamp: new Date().toISOString()
    };
  }
}

export const rentalAdminSummaryService = new RentalAdminSummaryService();

