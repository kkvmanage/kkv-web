export type RentalStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING';
export type PaymentMode = 'CASH' | 'GPAY' | 'BOTH';
export type ExpenseScope = 'COMPLEX' | 'SHOP' | 'RENTAL';

export type ExpenseCategory =
  | 'Maintenance'
  | 'Security'
  | 'Cleaning'
  | 'Staff Food / Tea'
  | 'Electricity'
  | 'Water'
  | 'Plumbing'
  | 'Electrical'
  | 'Lift Maintenance'
  | 'Generator / Fuel'
  | 'Labour'
  | 'Technician'
  | 'Office Expense'
  | 'Transportation'
  | 'Stationery'
  | 'Waste Management'
  | 'Emergency Expense'
  | 'Miscellaneous'
  | 'Repair'
  | 'Other'
  | (string & {});

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
  doorNumber?: string;
  shopName: string;
  tenantName: string;
  mobileNumber: string;
  ebNumber?: string;
  monthlyRent: number;
  rentDueDay?: number;
  advanceAmount?: number;
  availableAdvance: number;
  status: RentalStatus;
  closedAt?: string;
  closedBy?: string;
  closingReason?: string;
  settlementNotes?: string;
  refundableAdvanceAtClose?: number;
  closingPendingRent?: number;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface ShopSettlementSummary {
  shopId: string;
  shopNumber: string;
  doorNumber?: string;
  shopName: string;
  tenantName: string;
  mobileNumber: string;
  ebNumber?: string;
  complexId: string;
  complexName: string;
  location?: string;
  monthlyRent: number;
  rentDueDay: number;
  pendingRent: number;
  /** Original security deposit collected at tenancy start — immutable */
  securityDepositAmount: number;
  /** Amount adjusted/deducted from the security deposit */
  securityDepositDeducted: number;
  /** Current remaining security deposit balance */
  securityDepositBalance: number;
  outstandingBalance: number;
  /** Refundable deposit after deductions */
  refundableDeposit: number;
  financialTransactionCount: number;
  canClose: boolean;
  canDelete: boolean;
  status: RentalStatus;
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
  expenseScope?: ExpenseScope;
  shopId?: string | null;
  shopNumber?: string;
  expenseDate: string; // YYYY-MM-DD
  category: ExpenseCategory;
  expenseReason: string;
  expenseAmount: number;
  paymentMode: PaymentMode;
  cashAmount: number;
  gpayAmount: number;
  receiptUrl?: string;
  paidTo?: string;
  notes?: string;
  createdBy?: string;
  updatedBy?: string;
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

export interface PendingRentItem {
  id: string;
  complexId: string;
  complexName: string;
  location?: string;
  shopId: string;
  shopNumber: string;
  doorNumber?: string;
  shopName: string;
  tenantName: string;
  mobileNumber: string;
  ebNumber?: string;
  dueDate: string; // YYYY-MM-DD
  rentDueDay: number;
  monthlyRent: number;
  paidAmount: number;
  advanceUsed: number;
  totalCovered: number;
  pendingAmount: number;
  daysOverdue: number;
  status: 'DUE' | 'OVERDUE' | 'PARTIAL';
  availableAdvance: number;
}

export interface PendingRentSummary {
  totalPendingRent: number;
  totalOverdueRent: number;
  totalDueTodayRent: number;
  totalPendingShops: number;
  totalOverdueShops: number;
  totalDueTodayShops: number;
  totalPartialShops: number;
}

export interface PendingRentResponse {
  summary: PendingRentSummary;
  items: PendingRentItem[];
  month: string;
}

// ── Rental Day Book Types ───────────────────────────────────────────────────
export type RentalTransactionType =
  | 'RENT_COLLECTION'
  | 'ADVANCE_RENT'
  | 'SECURITY_DEPOSIT'
  | 'SECURITY_DEPOSIT_REFUND'
  | 'SECURITY_DEPOSIT_ADJUSTMENT'
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

export interface ComplexDeleteCheck {
  complexId: string;
  complexName: string;
  canDelete: boolean;
  reason?: string;
  dependencies: {
    shopsCount: number;
    activeShopsCount: number;
    paymentsCount: number;
    expensesCount: number;
    dayBookEntriesCount: number;
    securityDepositsHeld: number;
    pendingRent: number;
  };
}

export interface ShopDeleteCheck {
  shopId: string;
  shopNumber: string;
  shopName: string;
  tenantName: string;
  complexName?: string;
  canDelete: boolean;
  reason?: string;
  dependencies: {
    paymentsCount: number;
    expensesCount: number;
    dayBookEntriesCount: number;
    securityDepositAmount: number;
    securityDepositBalance: number;
    pendingRent: number;
    status: RentalStatus;
  };
}

