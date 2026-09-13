export type RentalStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'UNPAID';
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
  id: string;
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
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface ShopSettlementSummary {
  shopId: string;
  shopNumber: string;
  shopName: string;
  tenantName: string;
  mobileNumber: string;
  complexId: string;
  complexName: string;
  monthlyRent: number;
  rentDueDay?: number;
  status: RentalStatus;
  /** Original security deposit collected at tenancy start — immutable */
  securityDepositAmount: number;
  /** Amount deducted from security deposit through authorized settlement */
  securityDepositDeducted: number;
  /** Current remaining security deposit balance */
  securityDepositBalance: number;
  /** Pending monthly rent (separate from security deposit) */
  pendingRent: number;
  otherOutstanding: number;
  totalOutstanding: number;
  /** Refundable deposit = balance minus any deductions */
  refundableDeposit: number;
  settlementStatus: 'NO_BALANCE' | 'REFUNDABLE' | 'OUTSTANDING_DUE';
  canClose: boolean;
  blockReason?: string;
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
  paymentMonth: string; // YYYY-MM e.g. "2026-09"
  monthlyRent: number;
  amountReceived: number;
  cashAmount: number;
  gpayAmount: number;
  paymentMode: PaymentMode;
  advanceUsed: number;
  advanceGenerated: number;
  balanceAfterPayment: number;
  balance?: number;
  paymentDate: string; // YYYY-MM-DD
  paymentStatus: PaymentStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface RentalExpense {
  id: string;
  expenseId: string; // EXP-0001
  complexId?: string | null;
  complexName?: string;
  expenseScope?: ExpenseScope;
  shopId?: string | null;
  shopNumber?: string;
  expenseDate: string; // YYYY-MM-DD
  category?: ExpenseCategory | string;
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
  createdAt?: string;
  updatedAt?: string;
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  syncError?: string;
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
  month?: string;
  source?: string;
  version?: number;
  lastSyncedAt?: string;
  syncStatus?: 'SYNCED' | 'PENDING' | 'DELAYED' | 'FAILED' | 'NO_DATA';
  syncStatusMessage?: string;
  totalComplexes: number;
  totalShops: number;
  expectedMonthlyRent: number;
  collectedThisMonth: number;
  pendingRent: number;
  availableAdvance?: number;
  advanceAmount?: number;
  totalExpenses: number;
  netCollection: number;
  todaysCollection?: number;
  todaysExpenses?: number;
  collectionRate?: number;
  paymentModeSplit?: {
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
    location?: string;
    totalShops?: number;
    expectedRent: number;
    collected: number;
    pending: number;
    advance?: number;
    expenses: number;
    net?: number;
    netCollection?: number;
    collectionRate?: number;
  }[];
  complexBreakdown?: {
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
    collectionRate?: number;
  }[];
  pendingRentList?: {
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
    pendingDueNow?: number;
    availableAdvance: number;
    paymentStatus: string;
    dueDate?: string;
    isDue?: boolean;
    daysOverdue?: number;
  }[];
  recentPayments?: {
    paymentId: string;
    complexId?: string;
    complexName: string;
    shopId?: string;
    shopNumber: string;
    tenantName: string;
    mobileNumber?: string;
    paymentMonth: string;
    amountReceived: number;
    cashAmount?: number;
    gpayAmount?: number;
    advanceUsed?: number;
    balance?: number;
    paymentMode: string;
    paymentDate: string;
    paymentStatus: string;
    notes?: string;
  }[];
  recentExpenses?: {
    expenseId: string;
    complexId?: string;
    complexName: string;
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

export interface MonthlyRentReportItem {
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
}

export interface PaymentModeReportData {
  cash: {
    count: number;
    total: number;
  };
  gpay: {
    count: number;
    total: number;
  };
  totalAmount: number;
  totalTransactions: number;
}

export interface SyncSummary {
  total: number;
  pending: number;
  synced: number;
  failed: number;
  isConfigured: boolean;
  spreadsheetId?: string;
}

export type RentalTransactionType =
  | 'RENT_PAYMENT'
  | 'EXPENSE'
  | 'MANUAL_INCOME'
  | 'MANUAL_EXPENSE'
  | 'SECURITY_DEPOSIT_RECEIVED'
  | 'SECURITY_DEPOSIT_REFUND'
  | 'SECURITY_DEPOSIT_ADJUSTMENT';

export interface RentalDayBookEntry {
  id: string;
  entryId: string;
  date: string; // YYYY-MM-DD
  transactionType: RentalTransactionType;
  sourceType: 'RENTAL_PAYMENT' | 'RENTAL_EXPENSE' | 'MANUAL_ENTRY';
  sourceId: string;
  complexId?: string;
  complexName?: string;
  shopId?: string;
  shopNumber?: string;
  shopName?: string;
  tenantName?: string;
  particulars: string;
  category?: string;
  paymentMode: 'CASH' | 'GPAY' | 'BOTH';
  cashAmount: number;
  gpayAmount: number;
  debit: number;
  credit: number;
  runningBalance: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RentalDayBookFilter {
  fromDate?: string;
  toDate?: string;
  complexId?: string;
  transactionType?: RentalTransactionType;
  paymentMode?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface RentalDayBookSummary {
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  closingBalance: number;
  cashIncome: number;
  cashExpense: number;
  netCash: number;
  gpayIncome: number;
  gpayExpense: number;
  netGpay: number;
  transactionCount: number;
  complexSummaries: {
    complexId: string;
    complexName: string;
    income: number;
    expense: number;
    net: number;
  }[];
}

export interface RentalDayBookResponse {
  summary: RentalDayBookSummary;
  entries: RentalDayBookEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

export type RentalNotificationCategory = 'RENTAL';
export type RentalNotificationType =
  | 'RENT_DUE'
  | 'RENT_OVERDUE'
  | 'RENT_PARTIAL'
  | 'RENT_PAYMENT'
  | 'SECURITY_DEPOSIT_RECEIVED'
  | 'SECURITY_DEPOSIT_REFUND'
  | 'SECURITY_DEPOSIT_REFUND_PENDING'
  | 'SHOP_CREATED'
  | 'SHOP_CLOSED'
  | 'SHOP_SETTLEMENT'
  | 'RENTAL_EXPENSE'
  | 'COMPLEX_STATUS'
  | 'RENTAL_SYSTEM';

export interface RentalNotification {
  id: string;
  module: 'RENTAL';
  category: 'RENTAL';
  type: RentalNotificationType;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  customerId: string;
  customerName: string;
  customerPhone?: string;
  entityId: string;
  entityDbId?: string;
  complexId?: string;
  complexName?: string;
  shopId?: string;
  title: string;
  message: string;
  amount?: number;
  dueDate?: string;
  periodKey?: string;
  daysOverdue?: number;
  daysRemaining?: number;
  read: boolean;
  actionLabel: string;
  createdAt: string;
}



