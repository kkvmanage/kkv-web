export type RentalStatus = 'ACTIVE' | 'INACTIVE';
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
    availableAdvance: number;
    paymentStatus: string;
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

export type RentalTransactionType = 'RENT_PAYMENT' | 'EXPENSE' | 'MANUAL_INCOME' | 'MANUAL_EXPENSE';

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

