export type RentalStatus = 'ACTIVE' | 'INACTIVE';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING';
export type PaymentMode = 'CASH' | 'GPAY' | 'BOTH';
export type ExpenseCategory =
  | 'Electricity'
  | 'Maintenance'
  | 'Cleaning'
  | 'Plumbing'
  | 'Repair'
  | 'Water'
  | 'Security'
  | 'Transport'
  | 'Other';

export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface RentalComplex {
  id: string; // internal UUID or string
  complexId: string; // CMP-0001
  complexName: string;
  location: string;
  status: RentalStatus;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface RentalShop {
  id: string;
  shopId: string; // SHOP-0001
  complexId: string; // CMP-0001
  complexName?: string;
  shopNumber: string;
  shopName: string;
  tenantName: string;
  mobileNumber: string;
  monthlyRent: number;
  availableAdvance: number;
  status: RentalStatus;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface RentalPayment {
  id: string;
  paymentId: string; // PAY-0001
  complexId: string;
  complexName?: string;
  shopId: string;
  shopNumber?: string;
  shopName?: string;
  tenantName?: string;
  mobileNumber: string;
  paymentMonth: string; // YYYY-MM e.g. "2026-09" or "September 2026"
  monthlyRent: number;
  amountReceived: number;
  cashAmount: number;
  gpayAmount: number;
  paymentMode: PaymentMode;
  advanceUsed: number;
  advanceGenerated: number;
  balanceAfterPayment: number;
  paymentDate: string; // YYYY-MM-DD
  paymentStatus: PaymentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface RentalExpense {
  id: string;
  expenseId: string; // EXP-0001
  complexId: string;
  complexName?: string;
  shopId?: string;
  shopNumber?: string;
  expenseDate: string; // YYYY-MM-DD
  category: ExpenseCategory;
  expenseReason: string;
  expenseAmount: number;
  paymentMode: PaymentMode;
  cashAmount: number;
  gpayAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface RentalAuditLog {
  id: string;
  auditId: string; // AUD-0001
  userId: string;
  action: string;
  entityType: 'Complex' | 'Shop' | 'RentPayment' | 'Expense' | 'Advance' | 'Sync';
  entityId: string;
  oldValue?: any;
  newValue?: any;
  timestamp: string;
}

export interface SyncQueueItem {
  id: string; // SYNC-0001
  entityType: 'Complex' | 'Shop' | 'RentPayment' | 'Expense' | 'AuditLog';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  status: SyncStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  nextRetryAt?: string;
}

export interface RentalDashboardData {
  totalComplexes: number;
  totalShops: number;
  expectedMonthlyRent: number;
  collectedThisMonth: number;
  pendingRent: number;
  availableAdvance: number;
  todaysCollection: number;
  todaysExpenses: number;
  thisMonthExpenses: number;
  netCollection: number;
  recentPayments: RentalPayment[];
  recentExpenses: RentalExpense[];
  monthlyTrend: {
    month: string;
    expected: number;
    collected: number;
    pending: number;
    expenses: number;
    net: number;
  }[];
  complexStats: {
    complexId: string;
    complexName: string;
    location: string;
    totalShops: number;
    expectedRent: number;
    collected: number;
    pending: number;
    expenses: number;
    net: number;
  }[];
  paymentModeSplit: {
    cashTotal: number;
    gpayTotal: number;
    total: number;
  };
}

export interface AdminRentalSummary {
  totalComplexes: number;
  totalShops: number;
  expectedMonthlyRent: number;
  collectedThisMonth: number;
  pendingRent: number;
  advanceAmount: number;
  totalExpenses: number;
  netCollection: number;
  complexPerformance: {
    complexId: string;
    complexName: string;
    expectedRent: number;
    collected: number;
    pending: number;
    expenses: number;
    net: number;
  }[];
}

// ── Rental Day Book Types ───────────────────────────────────────────────────
export type RentalTransactionType =
  | 'RENT_COLLECTION'
  | 'ADVANCE_RENT'
  | 'SECURITY_DEPOSIT'
  | 'LATE_FEE'
  | 'MAINTENANCE_INCOME'
  | 'OTHER_INCOME'
  | 'MAINTENANCE_EXPENSE'
  | 'REPAIR_EXPENSE'
  | 'ELECTRICITY_EXPENSE'
  | 'WATER_EXPENSE'
  | 'CLEANING_EXPENSE'
  | 'STAFF_EXPENSE'
  | 'REFUND'
  | 'OTHER_EXPENSE'
  | 'MANUAL_ENTRY';

export interface RentalDayBookEntry {
  id: string;
  voucherNo: string;
  date: string; // YYYY-MM-DD
  transactionType: RentalTransactionType;
  category: string;
  description: string;
  complexId: string;
  complexName?: string;
  shopId?: string;
  shopNumber?: string;
  shopName?: string;
  tenantName?: string;
  paymentMode: PaymentMode | string;
  debit: number;
  credit: number;
  runningBalance?: number;
  referenceType: 'RENT_PAYMENT' | 'RENTAL_EXPENSE' | 'MANUAL' | 'REFUND';
  referenceId: string;
  entrySource: 'SYSTEM' | 'MANUAL';
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentalDayBookFilter {
  date?: string;
  from?: string;
  to?: string;
  complexId?: string;
  paymentMode?: string;
  transactionType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface RentalDayBookSummary {
  openingBalance: number;
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  paymentModeSummary: {
    cashIncome: number;
    cashExpense: number;
    gpayIncome: number;
    gpayExpense: number;
    otherIncome: number;
    otherExpense: number;
  };
  complexSummary: {
    complexId: string;
    complexName: string;
    income: number;
    expense: number;
    net: number;
  }[];
  entries: RentalDayBookEntry[];
  totalCount: number;
  page: number;
  limit: number;
}

