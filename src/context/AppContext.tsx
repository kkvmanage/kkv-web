import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Customer,
  FixedDeposit,
  Loan,
  NavPage,
  Receipt,
  DayBookEntry,
  MasterControlSettings,
  WhatsAppTemplates,
  TelegramConfig,
  FDCustomer,
  FDInterestPayout,
  FDWithdrawal,
  FDRenewal,
  FDRateHistoryItem,
  DeviceSession,
  UserRole,
  UserPermissions,
  UserProfile,
  StaffAuditLog,
  AppNotification,
  LoanTypeConfig,
  RepaymentSystemConfig,
  CalculationStrategy,
  PurityConfig,
  PurityCategory
} from '../types';
import {
  getDefaultPermissionsForRole,
  normalizeRole,
  normalizePermissions,
  isAdminRole,
  MASTER_ADMIN_EMAIL
} from '../config/permissions';
import { detectCurrentDeviceInfo, generateSessionId } from '../utils/deviceUtils';
import { apiService, getStoredAuthToken, setStoredAuthToken } from '../services/api';
import { calculateFDInterestSchedule, normalizeDateString, calculateInterestPeriodKey, addCalendarMonths, formatFDDate } from '../utils/fdInterestUtils';
import { generateAllNotifications } from '../utils/notificationUtils';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export const defaultLoanTypes: LoanTypeConfig[] = [
  {
    id: 'gold-loan',
    name: 'Gold Loan',
    description: 'Standard gold ornament backed financing',
    active: true,
    showOnLoanIssue: true,
    cardFeeEnabled: true,
    cardFee: 75,
    defaultMonthlyRate: 2.0,
    interestProfileId: 'gold-bands',
    repaymentSystemId: 'monthly-interest-only',
    calculationStrategy: 'MONTHLY_INTEREST_ONLY',
    sortOrder: 1
  },
  {
    id: 'silver-loan',
    name: 'Silver Loan',
    description: 'Silver article backed loan',
    active: true,
    showOnLoanIssue: true,
    cardFeeEnabled: true,
    cardFee: 60,
    defaultMonthlyRate: 3.0,
    interestProfileId: 'silver-bands',
    repaymentSystemId: 'monthly-interest-only',
    calculationStrategy: 'MONTHLY_INTEREST_ONLY',
    sortOrder: 2
  },
  {
    id: 'pronote',
    name: 'Pronote',
    description: 'Promissory note unsecured credit',
    active: true,
    showOnLoanIssue: true,
    cardFeeEnabled: true,
    cardFee: 50,
    defaultMonthlyRate: 4.0,
    interestProfileId: 'pronote-interest',
    repaymentSystemId: 'monthly-interest-only',
    calculationStrategy: 'MONTHLY_INTEREST_ONLY',
    sortOrder: 3
  },
  {
    id: 'hire-purchase',
    name: 'Hire Purchase',
    description: 'Vehicle and asset hire purchase financing',
    active: true,
    showOnLoanIssue: true,
    cardFeeEnabled: true,
    cardFee: 40,
    defaultMonthlyRate: 1.5,
    interestProfileId: 'fixed-rate',
    repaymentSystemId: 'emi',
    calculationStrategy: 'EMI',
    sortOrder: 4
  }
];

export const defaultRepaymentSystems: RepaymentSystemConfig[] = [
  { id: 'monthly-interest-only', name: 'Monthly Interest Only', description: 'Monthly interest due; principal remains until closure', calculationStrategy: 'MONTHLY_INTEREST_ONLY', active: true, sortOrder: 1 },
  { id: 'emi', name: 'EMI', description: 'Equated Monthly Installment (Principal + Interest)', calculationStrategy: 'EMI', active: true, sortOrder: 2 },
  { id: 'bullet', name: 'Bullet Repayment', description: 'Lump-sum principal + accrued interest at maturity', calculationStrategy: 'BULLET', active: true, sortOrder: 3 }
];

/**
 * Migrate old flat amountBands/silverAmountBands from MasterControlSettings
 * into their respective LoanTypeConfig.amountBands field.
 * Safe to run multiple times — skips migration if amountBands already set on the loan type.
 */
export function migrateLoanTypeAmountBands(settings: MasterControlSettings): LoanTypeConfig[] {
  const loanTypes = settings.loanTypes && settings.loanTypes.length > 0 ? settings.loanTypes : defaultLoanTypes;
  return loanTypes.map((lt) => {
    // Already has per-type bands — no migration needed
    if (lt.amountBands && lt.amountBands.length > 0) return lt;
    if (lt.id === 'gold-loan' && settings.amountBands && settings.amountBands.length > 0) {
      return { ...lt, amountBands: settings.amountBands };
    }
    if (lt.id === 'silver-loan' && settings.silverAmountBands && settings.silverAmountBands.length > 0) {
      return { ...lt, amountBands: settings.silverAmountBands };
    }
    return lt;
  });
}


export const defaultPurityOptions: PurityConfig[] = [
  { id: 'gold-24', name: '24ct', category: 'GOLD', purityValue: 24, ratePerGram: 6800, active: true, sortOrder: 1, description: '24 Carat Pure Gold (99.9%)' },
  { id: 'gold-22', name: '22ct', category: 'GOLD', purityValue: 22, ratePerGram: 6400, active: true, sortOrder: 2, description: '22 Carat Standard Gold (91.6%)' },
  { id: 'gold-20', name: '20ct', category: 'GOLD', purityValue: 20, ratePerGram: 5800, active: true, sortOrder: 3, description: '20 Carat Gold (83.3%)' },
  { id: 'gold-18', name: '18ct', category: 'GOLD', purityValue: 18, ratePerGram: 5200, active: true, sortOrder: 4, description: '18 Carat Gold (75.0%)' },
  { id: 'gold-14', name: '14ct', category: 'GOLD', purityValue: 14, ratePerGram: 4000, active: true, sortOrder: 5, description: '14 Carat Gold (58.5%)' },
  { id: 'silver-925', name: 'Silver 925', category: 'SILVER', purityValue: 925, ratePerGram: 85, active: true, sortOrder: 6, description: 'Sterling Silver (92.5%)' },
  { id: 'silver-999', name: 'Silver 999', category: 'SILVER', purityValue: 999, ratePerGram: 92, active: true, sortOrder: 7, description: 'Fine Pure Silver (99.9%)' }
];

const defaultMasterSettings: MasterControlSettings = {
  purityOptions: defaultPurityOptions,
  goldRate22ct: 6400,
  loanTypes: defaultLoanTypes,
  repaymentSystems: defaultRepaymentSystems,
  goldLoanMonthlyRate: 1.5,
  silverLoanMonthlyRate: 2.0,
  pronoteMonthlyRate: 2.5,
  hirePurchaseMonthlyRate: 3.0,
  defaultCardFee: 10,
  overdueInterestRatePA: 24,
  overduePenaltyPerDayPercent: 3.6,
  graceDays: 3,
  upiId: 'yourbusiness@okhdfcbank',
  upiPayeeName: 'KKV GOLD FINANCE',
  upiPaymentEnabled: true,
  loanConfigVersion: 'v1',
  showOnLoanIssue: true,
  hireShowOnLoanIssue: true,
  silverShowOnLoanIssue: true,
  pronoteShowOnLoanIssue: true,
  pronoteRate: 12,
  goldCardFeeEnabled: true,
  goldCardFee: 10,
  silverCardFeeEnabled: true,
  silverCardFee: 10,
  pronoteCardFeeEnabled: true,
  pronoteCardFee: 10,
  hireCardFeeEnabled: true,
  hireCardFee: 10,
  overdueCalculationMethod: 'Whole months — a part month counts as full (recommended)',
  silverAmountBands: [
    {
      id: 'silver-band-1',
      condition: 'Above',
      amount: 0,
      baseRateMonthly: 2.0,
      penaltyAfterMonths: 6,
      penaltyStepUpMonthly: 0.1,
      penaltyCalculation: 'From the start — stepped rate over the whole overc'
    }
  ],
  amountBands: [
    {
      id: 'band-1',
      condition: 'Below',
      amount: 10000,
      baseRateMonthly: 2.0,
      penaltyAfterMonths: 6,
      penaltyStepUpMonthly: 0.1,
      penaltyCalculation: 'From the start — stepped rate over the whole overc'
    },
    {
      id: 'band-2',
      condition: 'Above',
      amount: 10000,
      baseRateMonthly: 1.5,
      penaltyAfterMonths: 3,
      penaltyStepUpMonthly: 0.1,
      penaltyCalculation: 'From the start — stepped rate over the whole overc'
    }
  ],
  areas: ['Komarapalayam', 'Main Market', 'Bypass Road'],
  partners: ['K.K. Velu (Capital)', 'R. Ramesh (Capital)'],
  vehicleDocuments: [
    'RC Book', 'Spare key', 'Insurance policy', 'Road tax receipt',
    'Permit', 'F.C. certificate', 'Invoice / bill', 'Form 35 / NOC', 'Delivery note', 'Other'
  ],
  vehicleCompanies: [
    'Aprilia', 'Ashok Leyland', 'Aston Martin', 'Audi', 'Bajaj', 'BMW',
    'BYD', 'Chevrolet', 'Citroen', 'Daewoo', 'Datsun', 'Ducati', 'Eicher',
    'Ferrari', 'Fiat', 'Force Motors', 'Ford', 'Harley-Davidson', 'Hero',
    'Hero Honda', 'Hindustan Motors', 'Honda', 'Hyundai', 'Isuzu', 'Iveco',
    'Jaguar', 'Java', 'Jeep', 'JCB', 'Kawasaki', 'Kia', 'KTM', 'Lamborghini',
    'Land Rover', 'Lexus', 'Mahindra', 'Maruti Suzuki', 'Maserati', 'Mazda',
    'Mercedes-Benz', 'MG', 'Mini', 'Mitsubishi', 'Nissan', 'Okinawa', 'Olectra',
    'Ola Electric', 'Opel', 'Piaggio', 'Porsche', 'Premier', 'Renault',
    'Rolls-Royce', 'Royal Enfield', 'SML Isuzu', 'Skoda', 'Suzuki', 'Swaraj Mazda',
    'Tata', 'Tork', 'TVS', 'Ultraviolette', 'Vespa', 'Volkswagen', 'Volvo',
    'Yamaha', 'Yezdi', 'Ather', 'Ampere', 'Bounce', 'Revolt', 'Simple Energy',
    'Hop Electric', 'Komaki', 'Kinetic', 'LML', 'Mahindra Last Mile', 'Atul Auto',
    'Bharat Benz', 'Scania', 'MAN', 'Daimler', 'Hyosung', 'Benelli', 'CFMoto',
    'Triumph', 'Norton', 'BSA', 'Indian', 'Zontes', 'QJ Motor', 'Keeway',
    'Moto Morini', 'Husqvarna', 'Other'
  ],
  insuranceCompanies: [
    'Acko General Insurance', 'Bajaj Allianz General Insurance',
    'Cholamandalam MS General Insurance', 'Digit General Insurance',
    'Future Generali India Insurance', 'Go Digit General Insurance',
    'HDFC ERGO General Insurance', 'ICICI Lombard General Insurance',
    'IFFCO Tokio General Insurance', 'Kotak Mahindra General Insurance',
    'Liberty General Insurance', 'Magma HDI General Insurance',
    'Navi General Insurance', 'National Insurance Company',
    'Raheja QBE General Insurance', 'Reliance General Insurance',
    'Royal Sundaram General Insurance', 'SBI General Insurance',
    'Shriram General Insurance', 'Tata AIG General Insurance',
    'The New India Assurance', 'The Oriental Insurance Company',
    'United India Insurance', 'Universal Sompo General Insurance',
    'Zuno General Insurance', 'Other'
  ],
  showrooms: ['Main Branch', 'Bypass Branch'],
  lockersEnabled: false,
  configurationVersion: 1,
  fdInterestRate: 12,
  fdInterestRateEffectiveFrom: '01-08-2026',
  fdDefaultTenureMonths: 12,
  fdMinimumAmount: 5000,
  fdMaximumAmount: 10000000,
  fdRenewalPolicy: 'MANUAL',
  fdCalculationMethod: 'MONTHLY_DIVIDEND',
  fdInterestRateHistory: [
    {
      id: 'FD-RATE-001',
      rate: 12,
      previousRate: 10,
      effectiveFrom: '01-08-2026',
      changedBy: 'Master Admin',
      changedAt: '2026-08-01T09:00:00.000Z',
      notes: 'Initial Base Master FD Interest Rate'
    }
  ]
};

const defaultWhatsAppTemplates: WhatsAppTemplates = {
  welcomeMessage: 'Dear {name}, Thank you for choosing {bankName}. Your pledge account {loanId} for ₹{principal} has been disbursed. Next due date is {dueDate}.',
  dueReminderMessage: 'Dear {name}, your interest payment for Gold Loan {loanId} (Principal ₹{principal}) is pending. Due date: {dueDate}. Total amount due: ₹{amount}. UPI ID: {upiId}',
  receiptMessage: 'Dear {name}, payment receipt #{billNo} of ₹{amount} for loan {loanId} has been successfully recorded on {date}. Thank you, {bankName}.'
};

const defaultTelegramConfig: TelegramConfig = {
  botToken: '123456789:ABCdef...',
  chatId: '',
  isSecured: false,
  autoBackupOnOpen: false,
  lastBackupDate: '25/08/2026, 15:12:11'
};

interface AppContextType {
  currentPage: NavPage;
  setCurrentPage: (page: NavPage) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;
  isWorkspaceSelected: boolean;
  setIsWorkspaceSelected: (val: boolean) => void;
  selectedWorkspace: string;
  setSelectedWorkspace: (ws: string) => void;
  userRole: UserRole | null;
  setUserRole: (role: UserRole | null) => void;
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  authLoading: boolean;
  hasPermission: (module: string, action?: string) => boolean;
  loginWithCredentials: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logoutUser: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;

  // Staff & RBAC Management
  staffList: UserProfile[];
  fetchStaffList: () => Promise<void>;
  createStaffAccount: (data: { email: string; displayName?: string; fullName?: string; name?: string; role?: UserRole | string; phone?: string; department?: string; permissions?: Partial<UserPermissions>; password?: string; initialPassword?: string; temporaryPassword?: string }) => Promise<{ success: boolean; data?: any; message?: string }>;
  updateStaffProfile: (id: string, updates: any) => Promise<{ success: boolean; message?: string }>;
  toggleStaffStatus: (id: string, isActive: boolean) => Promise<{ success: boolean; message?: string }>;
  resetStaffPassword: (id: string, newPassword?: string) => Promise<{ success: boolean; temporaryPassword?: string; message?: string }>;
  revokeStaffSessions: (id: string) => Promise<{ success: boolean; message?: string }>;
  deleteStaffAccount: (id: string) => Promise<{ success: boolean; message?: string }>;
  staffAuditLogs: StaffAuditLog[];
  fetchStaffAuditLogs: () => Promise<void>;

  loans: Loan[];
  customers: Customer[];
  receipts: Receipt[];
  fixedDeposits: FixedDeposit[];
  dayBookEntries: DayBookEntry[];
  fdCustomers: FDCustomer[];
  fdInterestPayouts: FDInterestPayout[];
  fdWithdrawals: FDWithdrawal[];
  selectedLoan: Loan | null;
  setSelectedLoan: (loan: Loan | null) => void;
  selectedReceipt: Receipt | null;
  setSelectedReceipt: (receipt: Receipt | null) => void;
  masterControlOpen: boolean;
  setMasterControlOpen: (open: boolean) => void;
  masterControlUnlocked: boolean;
  unlockMasterControl: (password: string) => Promise<boolean>;
  changeMasterPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  masterControlSettings: MasterControlSettings;
  updateMasterControlSettings: (settings: Partial<MasterControlSettings>) => void;
  addLoanType: (config: {
    name: string;
    description?: string;
    active?: boolean;
    showOnLoanIssue?: boolean;
    useMasterDefaults?: boolean;
    cardFeeEnabled?: boolean;
    cardFee?: number;
    defaultMonthlyRate?: number;
    interestProfileId?: string;
    repaymentSystemId?: string;
    calculationStrategy?: CalculationStrategy;
  }) => { success: boolean; message?: string };
  updateLoanType: (id: string, updates: Partial<LoanTypeConfig>) => { success: boolean; message?: string };
  toggleLoanTypeStatus: (id: string) => { success: boolean; message?: string };
  toggleLoanTypeVisibility: (id: string) => { success: boolean; message?: string };
  deleteLoanType: (id: string) => { success: boolean; message?: string };
  addRepaymentSystem: (config: { name: string; description?: string; calculationStrategy: CalculationStrategy; active?: boolean }) => { success: boolean; message?: string };
  updateRepaymentSystem: (id: string, updates: { name?: string; description?: string; calculationStrategy?: CalculationStrategy; active?: boolean }) => { success: boolean; message?: string };
  toggleRepaymentSystemStatus: (id: string) => { success: boolean; message?: string };
  addPurityOption: (config: { name: string; category?: PurityCategory; purityValue?: number; ratePerGram?: number; description?: string; active?: boolean }) => { success: boolean; message?: string };
  updatePurityOption: (id: string, updates: { name?: string; category?: PurityCategory; purityValue?: number; ratePerGram?: number; description?: string; active?: boolean }) => { success: boolean; message?: string };
  togglePurityStatus: (id: string) => { success: boolean; message?: string };
  deletePurityOption: (id: string) => { success: boolean; message?: string };
  getPurityRate: (purityIdOrName: string) => number;
  updateFDInterestRate: (newRate: number, effectiveFrom: string, notes?: string) => boolean;
  whatsAppTemplates: WhatsAppTemplates;
  updateWhatsAppTemplates: (templates: Partial<WhatsAppTemplates>) => void;
  telegramConfig: TelegramConfig;
  updateTelegramConfig: (config: Partial<TelegramConfig>) => void;

  getCustomerById: (id: string) => Customer | undefined;
  addLoan: (loan: Omit<Loan, 'id' | 'loanNo'> & { loanNo?: string; receiptBillNo?: number }) => Loan;
  addReceipt: (receipt: Omit<Receipt, 'id' | 'receiptNo'>) => Receipt;
  addFixedDeposit: (fd: Omit<FixedDeposit, 'id' | 'fdNo'>) => FixedDeposit;
  addFDCustomer: (cust: Omit<FDCustomer, 'id' | 'createdAt'>) => FDCustomer;
  addCustomer: (customer: Omit<Customer, 'id' | 'activeLoansCount' | 'totalBorrowed' | 'joinedDate'>) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => Customer | null;
  deleteCustomer: (id: string) => boolean;
  restoreCustomer: (id: string) => boolean;
  deleteCustomerPermanently: (id: string) => Promise<boolean>;
  addDayBookEntry: (entry: Omit<DayBookEntry, 'id' | 'time' | 'cashBal' | 'bankBal'>) => DayBookEntry;
  payFDInterest: (fdNo: string, mode: 'Cash' | 'Bank' | 'UPI' | string, amount?: number, targetDueDate?: string, targetPeriodKey?: string) => boolean;
  withdrawFD: (fdNo: string, mode: 'Cash' | 'Bank' | 'UPI', notes?: string, withdrawalAmount?: number, transactionReference?: string, bankName?: string) => FDWithdrawal | null;
  renewFD: (fdNo: string, periodMonths: number, notes?: string) => boolean;
  fdRenewals: FDRenewal[];
  deleteFixedDeposit: (fdNo: string) => boolean;
  bulkUpdateFixedDepositDates: (fdNos: string[], newDepositDate?: string, offsetDays?: number) => Promise<boolean>;
  cashInHand: number;
  cashAtBank: number;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  toasts: Toast[];
  removeToast: (id: string) => void;
  selectedProfileCustomerId: string | null;
  setSelectedProfileCustomerId: (id: string | null) => void;
  editingCustomerId: string | null;
  setEditingCustomerId: (id: string | null) => void;
  startEditCustomer: (id: string) => void;
  resetAllData: () => void;
  restoreDataFromJSON: (jsonStr: string) => boolean;
  reloadAllData: () => Promise<void>;

  // Device & Active Session Management
  sessions: DeviceSession[];
  currentSessionId: string;
  fetchSessions: () => Promise<void>;
  revokeSessionById: (sessionId: string) => Promise<boolean>;
  revokeOtherSessionsExceptCurrent: () => Promise<number>;
  revokeAllActiveSessions: () => Promise<number>;

  // Centralized Notifications
  notifications: AppNotification[];
  unreadNotificationCount: number;
  isNotificationOpen: boolean;
  setIsNotificationOpen: (open: boolean) => void;
  toggleNotificationOpen: () => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const validNavPages: Set<NavPage> = new Set([
  'dashboard',
  'customers',
  'customers-add',
  'add-customer-form',
  'edit-customer',
  'search-customer',
  'customer-profile',
  'loan-issue',
  'loan-display',
  'loan-receipts',
  'receipt-display',
  'all-receipts',
  'pending-loans',
  'total-loans',
  'rc-renewal-reminders',
  'bill-balance',
  'fd-customers',
  'new-deposit',
  'deposit-display',
  'deposit-interest',
  'interest-display',
  'interest-pending',
  'deposit-withdrawal',
  'withdrawal-display',
  'fd-customers-deposits',
  'day-book',
  'trial-balance',
  'profit-loss',
  'balance-sheet',
  'accounts',
  'daily-reminders',
  'notifications',
  'backup-restore',
  'admin-panel',
  'settings',
  'rental',
  'rental-dashboard',
  'rental-complexes',
  'rental-complex-detail',
  'rental-shops',
  'rental-shop-detail',
  'rental-payments',
  'rental-daybook',
  'rental-expenses',
  'rental-reports'
]);

function isValidNavPage(page: string | null | undefined): page is NavPage {
  return page ? validNavPages.has(page as NavPage) : false;
}

function resolveInitialPage(): NavPage {
  if (typeof window === 'undefined') return 'dashboard';

  // 1. URL search params e.g. ?page=customers or ?view=loan-display
  try {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('page') || params.get('view');
    if (isValidNavPage(p)) return p;
  } catch (e) {}

  // 2. URL pathname e.g. /customers, /search-customer, /rental-shops, /rental/complexes
  try {
    const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (rawPath) {
      const normalized = rawPath.replace(/\//g, '-');
      if (isValidNavPage(normalized)) return normalized;
      if (rawPath === 'rental' || rawPath === 'rental-dashboard') return 'rental-dashboard';
      if (rawPath.startsWith('rental-complex') || rawPath.startsWith('rental/complex')) return 'rental-complexes';
      if (rawPath.startsWith('rental-shop') || rawPath.startsWith('rental/shop')) return 'rental-shops';
      if (rawPath.startsWith('rental-payment') || rawPath.startsWith('rental/payment')) return 'rental-payments';
      if (rawPath.startsWith('rental-daybook') || rawPath.startsWith('rental/daybook')) return 'rental-daybook';
      if (rawPath.startsWith('rental-expense') || rawPath.startsWith('rental/expense')) return 'rental-expenses';
      if (rawPath.startsWith('rental-report') || rawPath.startsWith('rental/report')) return 'rental-reports';
      if (rawPath === 'admin' || rawPath === 'staff') return 'admin-panel';
      if (rawPath === 'customers/search' || rawPath === 'search') return 'search-customer';
      if (rawPath === 'loans' || rawPath === 'loan') return 'loan-display';
      if (rawPath === 'receipts' || rawPath === 'receipt') return 'all-receipts';
    }
  } catch (e) {}

  // 3. URL hash e.g. #customers or #/search-customer
  try {
    const hash = window.location.hash.replace(/^#[/]?/, '').toLowerCase();
    if (isValidNavPage(hash)) return hash;
  } catch (e) {}

  // 4. Session storage
  try {
    const saved = sessionStorage.getItem('kkv_current_page');
    if (isValidNavPage(saved)) return saved;
  } catch (e) {}

  // 5. Default based on role
  try {
    const savedRole = localStorage.getItem('kkv_userRole') || sessionStorage.getItem('kkv_userRole');
    if (savedRole && savedRole.includes('RENTAL_STAFF')) {
      return 'rental-dashboard';
    }
  } catch (e) {}

  return 'dashboard';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPageRaw] = useState<NavPage>(resolveInitialPage);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const setCurrentPage = (page: NavPage) => {
    setCurrentPageRaw(page);
    setIsMobileMenuOpen(false);
    try {
      sessionStorage.setItem('kkv_current_page', page);
      const url = new URL(window.location.href);
      url.searchParams.set('page', page);
      window.history.replaceState({ page }, '', url.toString());
    } catch (e) {}
  };

  useEffect(() => {
    const handlePopState = () => {
      const page = resolveInitialPage();
      setCurrentPageRaw(page);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Safe local storage helpers to prevent QuotaExceededError crashes
  const getStored = <T,>(key: string, fallback: T): T => {
    try {
      const stored = localStorage.getItem(`kkv_${key}`);
      if (!stored) return fallback;
      const parsed = JSON.parse(stored);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
      console.warn(`[SafeStorage] Could not read kkv_${key} from localStorage, using fallback.`, e);
      return fallback;
    }
  };

  const safeSetStored = (key: string, value: any) => {
    try {
      let dataToSave = value;
      if (key === 'loans' && Array.isArray(value)) {
        dataToSave = value.map((l: any) => {
          // Do not embed heavy Base64 customer photo strings inside loan records in localStorage
          const { customerPhotoUrl, ...rest } = l;
          const isShortLink = customerPhotoUrl && typeof customerPhotoUrl === 'string' && customerPhotoUrl.length < 500;
          return isShortLink ? { ...rest, customerPhotoUrl } : rest;
        });
      } else if (key === 'customers' && Array.isArray(value)) {
        dataToSave = value.map((c: any) => {
          // Strip heavy Base64 images (>50KB) from localStorage cache to prevent quota exceeded errors
          if (c.customerPhoto && typeof c.customerPhoto === 'string' && c.customerPhoto.length > 50000) {
            const { customerPhoto, ...rest } = c;
            return rest;
          }
          return c;
        });
      }
      localStorage.setItem(`kkv_${key}`, JSON.stringify(dataToSave));
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        console.warn(`[SafeStorage] QuotaExceededError saving kkv_${key}. Pruning large fields...`);
        try {
          if (key === 'loans' && Array.isArray(value)) {
            const stripped = value.map(({ customerPhotoUrl, photos, kycDocuments, ...rest }: any) => rest);
            localStorage.setItem(`kkv_${key}`, JSON.stringify(stripped));
          } else if (key === 'customers' && Array.isArray(value)) {
            const stripped = value.map(({ customerPhoto, currentLocation, permanentLocation, ...rest }: any) => rest);
            localStorage.setItem(`kkv_${key}`, JSON.stringify(stripped));
          }
        } catch (fallbackErr) {
          console.error(`[SafeStorage] Could not persist kkv_${key} due to browser storage limits.`, fallbackErr);
        }
      } else {
        console.error(`[SafeStorage] Error saving kkv_${key}:`, err);
      }
    }
  };

  const [darkMode, setDarkMode] = useState<boolean>(() => getStored('darkMode', false));
  const [loans, setLoans] = useState<Loan[]>(() => getStored<Loan[]>('loans', []));
  const [customers, setCustomers] = useState<Customer[]>(() => getStored<Customer[]>('customers', []));
  const [receipts, setReceipts] = useState<Receipt[]>(() => getStored<Receipt[]>('receipts', []));
  const [fixedDeposits, setFixedDeposits] = useState<FixedDeposit[]>(() => getStored<FixedDeposit[]>('fixedDeposits', []));
  const [dayBookEntries, setDayBookEntries] = useState<DayBookEntry[]>(() => getStored<DayBookEntry[]>('dayBookEntries', []));
  const [isWorkspaceSelected, setIsWorkspaceSelected] = useState<boolean>(() => getStored('isWorkspaceSelected', true));
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(() => getStored('selectedWorkspace', 'KKV GOLD FINANCE'));
  const [userRole, setUserRole] = useState<UserRole | null>(() => getStored('userRole', null));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStored('currentUser', null));
  const [authLoading, setAuthLoading] = useState<boolean>(() => Boolean(getStoredAuthToken()));
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [staffAuditLogs, setStaffAuditLogs] = useState<StaffAuditLog[]>([]);

  const [fdCustomers, setFdCustomers] = useState<FDCustomer[]>(() => getStored<FDCustomer[]>('fdCustomers', []));
  const [fdInterestPayouts, setFdInterestPayouts] = useState<FDInterestPayout[]>(() => getStored('fdInterestPayouts', []));
  const [fdWithdrawals, setFdWithdrawals] = useState<FDWithdrawal[]>(() => getStored('fdWithdrawals', []));
  const [fdRenewals, setFdRenewals] = useState<FDRenewal[]>(() => getStored('fdRenewals', []));

  const [masterControlOpen, setMasterControlOpen] = useState<boolean>(false);
  const [masterControlUnlocked, setMasterControlUnlocked] = useState<boolean>(false);
  // ── Master Settings: initialize from defaults only — backend is the source of truth ──
  // Do NOT bootstrap from localStorage: stale cached config would mask backend changes.
  // reloadAllData() (called on mount + login) always fetches the authoritative backend value.
  const [masterControlSettings, setMasterControlSettings] = useState<MasterControlSettings>(() => {
    // Use localStorage as a quick first-render cache only if available,
    // but immediately overwrite from backend on mount via reloadAllData.
    const cached = getStored<MasterControlSettings | null>('masterSettings', null);
    if (cached && cached.loanTypes && cached.loanTypes.length > 0) {
      const migratedLoanTypes = migrateLoanTypeAmountBands(cached);
      return {
        ...defaultMasterSettings,
        ...cached,
        loanTypes: migratedLoanTypes,
        repaymentSystems: cached.repaymentSystems && cached.repaymentSystems.length > 0 ? cached.repaymentSystems : defaultRepaymentSystems,
        purityOptions: cached.purityOptions && cached.purityOptions.length > 0 ? cached.purityOptions : defaultPurityOptions,
        goldRate22ct: cached.goldRate22ct ?? 6400
      };
    }
    // Fall back to hardcoded defaults if no cache exists
    return {
      ...defaultMasterSettings,
      repaymentSystems: defaultRepaymentSystems,
      purityOptions: defaultPurityOptions
    };
  });
  const [whatsAppTemplates, setWhatsAppTemplates] = useState<WhatsAppTemplates>(() => getStored('waTemplates', defaultWhatsAppTemplates));
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => getStored('tgConfig', defaultTelegramConfig));

  const [selectedLoan, setSelectedLoanRaw] = useState<Loan | null>(null);
  const setSelectedLoan = (loan: Loan | null) => {
    setSelectedLoanRaw(loan);
    try {
      if (loan?.loanNo) {
        sessionStorage.setItem('kkv_selected_loan_no', loan.loanNo);
        const url = new URL(window.location.href);
        url.searchParams.set('loanNo', loan.loanNo);
        window.history.replaceState({}, '', url.toString());
      } else {
        sessionStorage.removeItem('kkv_selected_loan_no');
        const url = new URL(window.location.href);
        url.searchParams.delete('loanNo');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {}
  };

  const [selectedReceipt, setSelectedReceiptRaw] = useState<Receipt | null>(null);
  const setSelectedReceipt = (receipt: Receipt | null) => {
    setSelectedReceiptRaw(receipt);
    try {
      if (receipt?.receiptNo) {
        sessionStorage.setItem('kkv_selected_receipt_no', String(receipt.receiptNo));
        const url = new URL(window.location.href);
        url.searchParams.set('receiptNo', String(receipt.receiptNo));
        window.history.replaceState({}, '', url.toString());
      } else {
        sessionStorage.removeItem('kkv_selected_receipt_no');
        const url = new URL(window.location.href);
        url.searchParams.delete('receiptNo');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {}
  };

  const [selectedProfileCustomerId, setSelectedProfileCustomerIdRaw] = useState<string | null>(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('customerId');
      if (param) return param;
      return sessionStorage.getItem('kkv_selected_profile_customer_id');
    } catch {
      return null;
    }
  });

  const setSelectedProfileCustomerId = (id: string | null) => {
    setSelectedProfileCustomerIdRaw(id);
    try {
      if (id) {
        sessionStorage.setItem('kkv_selected_profile_customer_id', id);
        const url = new URL(window.location.href);
        url.searchParams.set('customerId', id);
        window.history.replaceState({}, '', url.toString());
      } else {
        sessionStorage.removeItem('kkv_selected_profile_customer_id');
        const url = new URL(window.location.href);
        url.searchParams.delete('customerId');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {}
  };

  const [editingCustomerId, setEditingCustomerIdRaw] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('kkv_editing_customer_id');
    } catch {
      return null;
    }
  });

  const setEditingCustomerId = (id: string | null) => {
    setEditingCustomerIdRaw(id);
    try {
      if (id) {
        sessionStorage.setItem('kkv_editing_customer_id', id);
      } else {
        sessionStorage.removeItem('kkv_editing_customer_id');
      }
    } catch (e) {}
  };

  const startEditCustomer = (id: string) => {
    setEditingCustomerId(id);
    setCurrentPage('edit-customer');
  };

  // Restore selectedLoan from sessionStorage/URL once loans array is hydrated from backend
  useEffect(() => {
    if (!selectedLoan && loans.length > 0) {
      try {
        const savedLoanNo = new URLSearchParams(window.location.search).get('loanNo') || sessionStorage.getItem('kkv_selected_loan_no');
        if (savedLoanNo) {
          const match = loans.find(l => l.loanNo === savedLoanNo || l.id === savedLoanNo);
          if (match) setSelectedLoanRaw(match);
        }
      } catch (e) {}
    }
  }, [loans, selectedLoan]);

  // Restore selectedReceipt from sessionStorage/URL once receipts array is hydrated from backend
  useEffect(() => {
    if (!selectedReceipt && receipts.length > 0) {
      try {
        const savedReceiptNo = new URLSearchParams(window.location.search).get('receiptNo') || sessionStorage.getItem('kkv_selected_receipt_no');
        if (savedReceiptNo) {
          const match = receipts.find(r => String(r.receiptNo) === savedReceiptNo || r.id === savedReceiptNo);
          if (match) setSelectedReceiptRaw(match);
        }
      } catch (e) {}
    }
  }, [receipts, selectedReceipt]);

  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Device & Active Session State ──────────────────────────────────────────
  const [currentSessionId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kkv_current_session_id');
      if (saved) return saved;
      const gen = generateSessionId();
      localStorage.setItem('kkv_current_session_id', gen);
      return gen;
    } catch {
      return generateSessionId();
    }
  });
  const [sessions, setSessions] = useState<DeviceSession[]>([]);

  // ── Centralized Notifications State ──────────────────────────────────────────
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() =>
    getStored('read_notification_ids', [])
  );
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const toggleNotificationOpen = () => setIsNotificationOpen((prev) => !prev);

  // Persist states safely to localStorage
  useEffect(() => { safeSetStored('darkMode', darkMode); }, [darkMode]);
  useEffect(() => { safeSetStored('loans', loans); }, [loans]);
  useEffect(() => { safeSetStored('customers', customers); }, [customers]);
  useEffect(() => { safeSetStored('receipts', receipts); }, [receipts]);
  useEffect(() => { safeSetStored('fixedDeposits', fixedDeposits); }, [fixedDeposits]);
  useEffect(() => { safeSetStored('dayBookEntries', dayBookEntries); }, [dayBookEntries]);
  useEffect(() => { safeSetStored('fdCustomers', fdCustomers); }, [fdCustomers]);
  useEffect(() => { safeSetStored('fdInterestPayouts', fdInterestPayouts); }, [fdInterestPayouts]);
  useEffect(() => { safeSetStored('fdWithdrawals', fdWithdrawals); }, [fdWithdrawals]);
  useEffect(() => { safeSetStored('fdRenewals', fdRenewals); }, [fdRenewals]);
  useEffect(() => { safeSetStored('read_notification_ids', readNotificationIds); }, [readNotificationIds]);
  useEffect(() => { safeSetStored('masterSettings', masterControlSettings); }, [masterControlSettings]);
  useEffect(() => { safeSetStored('waTemplates', whatsAppTemplates); }, [whatsAppTemplates]);
  useEffect(() => { safeSetStored('tgConfig', telegramConfig); }, [telegramConfig]);
  useEffect(() => { safeSetStored('userRole', userRole); }, [userRole]);
  useEffect(() => { safeSetStored('currentUser', currentUser); }, [currentUser]);

  // Sync document theme class — dark green is the PRIMARY theme (no class needed).
  // Adding 'light-mode' class switches to the lighter variant.
  useEffect(() => {
    if (darkMode) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
  }, [darkMode]);

  const reloadAllData = async (activeUser?: UserProfile | null) => {
    const u = activeUser !== undefined ? activeUser : currentUser;
    const role = u?.role || userRole;
    if (!u || !role) return;

    const isAdmin = isAdminRole(role);
    const perms = u.permissions as any;

    const canView = (mod: string) => {
      if (isAdmin) return true;
      return Boolean(perms && perms[mod] && perms[mod].view);
    };

    try {
      const promises: Promise<any>[] = [];
      const fetchKeys: string[] = [];

      if (canView('customers')) {
        promises.push(apiService.getCustomers());
        fetchKeys.push('customers');
      }
      if (canView('loans')) {
        promises.push(apiService.getLoans());
        fetchKeys.push('loans');
      }
      if (canView('receipts')) {
        promises.push(apiService.getReceipts());
        fetchKeys.push('receipts');
      }
      if (canView('fd')) {
        promises.push(apiService.getFixedDeposits());
        fetchKeys.push('fd');
        promises.push(apiService.getFDCustomers());
        fetchKeys.push('fdCustomers');
        promises.push(apiService.getFDPayouts());
        fetchKeys.push('fdInterestPayouts');
        promises.push(apiService.getFDWithdrawals());
        fetchKeys.push('fdWithdrawals');
        promises.push(apiService.getFDRenewals());
        fetchKeys.push('fdRenewals');
      }
      if (canView('accounting')) {
        promises.push(apiService.getDayBook());
        fetchKeys.push('dayBook');
      }

      // ── Master Settings: fetch for ALL roles (Admin + Staff + Rental Staff) ────
      // Uses GET /api/config/settings — a read-only endpoint accessible to all roles.
      // This ensures staff always see the latest admin configuration after page load.
      // Admin additionally fetches full settings (includes sensitive fields) via getMasterSettings().
      promises.push(apiService.getPublicSettings());
      fetchKeys.push('masterSettings');

      if (isAdmin) {
        promises.push(apiService.getWhatsAppTemplates());
        fetchKeys.push('waTemplates');
        promises.push(apiService.getTelegramConfig());
        fetchKeys.push('tgConfig');
      }

      const results = await Promise.allSettled(promises);
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value !== undefined && res.value !== null) {
          const val = res.value;
          const key = fetchKeys[idx];
          if (key === 'customers' && Array.isArray(val)) setCustomers(val);
          else if (key === 'loans' && Array.isArray(val)) setLoans(val);
          else if (key === 'receipts' && Array.isArray(val)) setReceipts(val);
          else if (key === 'fd' && Array.isArray(val)) setFixedDeposits(val);
          else if (key === 'fdCustomers' && Array.isArray(val)) setFdCustomers(val);
          else if (key === 'fdInterestPayouts' && Array.isArray(val)) setFdInterestPayouts(val);
          else if (key === 'fdWithdrawals' && Array.isArray(val)) setFdWithdrawals(val);
          else if (key === 'fdRenewals' && Array.isArray(val)) setFdRenewals(val);
          else if (key === 'dayBook' && Array.isArray(val)) setDayBookEntries(val);
          else if (key === 'masterSettings') {
            // val may be the response body — extract .data if present
            const settingsData = (val && typeof val === 'object' && val.data) ? val.data : val;
            if (settingsData && typeof settingsData === 'object') {
              setMasterControlSettings(prev => {
                const migratedLoanTypes = migrateLoanTypeAmountBands(settingsData);
                const next = {
                  ...prev,
                  ...settingsData,
                  loanTypes: migratedLoanTypes,
                  repaymentSystems: settingsData.repaymentSystems && settingsData.repaymentSystems.length > 0 ? settingsData.repaymentSystems : defaultRepaymentSystems,
                  purityOptions: settingsData.purityOptions && settingsData.purityOptions.length > 0 ? settingsData.purityOptions : (prev.purityOptions || defaultPurityOptions),
                  goldRate22ct: settingsData.goldRate22ct ?? prev.goldRate22ct ?? 6400
                };
                console.log(`[AppContext] Master settings loaded from backend: ${next.loanTypes?.length} loan types, FD rate: ${next.fdInterestRate}% p.a.`);
                return next;
              });
            }
          } else if (key === 'waTemplates' && val) setWhatsAppTemplates(val);
          else if (key === 'tgConfig' && val) setTelegramConfig(val);
        }
      });
    } catch (err) {
      console.warn('Backend API reload error:', err);
    }
  };

  // Fetch initial authoritative data from Express Backend on mount only if session exists
  useEffect(() => {
    let isMounted = true;
    let fallbackTimeout: any = null;

    async function initAuthAndData() {
      const token = getStoredAuthToken();
      if (!token) {
        if (isMounted) {
          setAuthLoading(false);
          setCurrentUser(null);
          setUserRole(null);
        }
        return;
      }

      // Safety watchdog: ensure authLoading is NEVER stuck for more than 4 seconds
      fallbackTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('[AppContext] Auth initialization watchdog triggered: forcing authLoading to false.');
          setAuthLoading(false);
        }
      }, 4000);

      try {
        const me = await apiService.getMe();
        if (!isMounted) return;

        if (me && me.role) {
          const userObj: UserProfile = {
            ...me,
            uid: me.uid || me._id || me.staffId || 'user_uid',
            id: me.staffId || me.id || me._id,
            role: normalizeRole(me.role),
            permissions: normalizePermissions(me.permissions, me.role)
          };
          setCurrentUser(userObj);
          setUserRole(userObj.role);
          safeSetStored('currentUser', userObj);
          safeSetStored('userRole', userObj.role);

          try {
            await reloadAllData(userObj);
          } catch (err) {
            console.warn('[AppContext] Initial background data reload warning:', err);
          }

          // Complete auth restoration after data hydration
          setAuthLoading(false);
        } else {
          setStoredAuthToken(null);
          setCurrentUser(null);
          setUserRole(null);
          setAuthLoading(false);
        }
      } catch (err) {
        console.warn('[AppContext] Initial session restoration error:', err);
        if (isMounted) {
          setStoredAuthToken(null);
          setCurrentUser(null);
          setUserRole(null);
          setAuthLoading(false);
        }
      } finally {
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    initAuthAndData();

    return () => {
      isMounted = false;
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, []);

  // ── RBAC Permission Guard ──────────────────────────────────────────────────
  const hasPermission = (module: string, action: string = 'view'): boolean => {
    if (!currentUser || !userRole) return false;
    if (isAdminRole(userRole)) {
      return true;
    }

    // Map module aliases
    let targetModule = module;
    if (module === 'rentalManagement') targetModule = 'rental';
    if (module === 'fixedDeposits' || module === 'fdInterest' || module === 'fdWithdrawal') targetModule = 'fd';
    if (module === 'loanReceipts') targetModule = 'receipts';

    const perms = currentUser.permissions as any;
    if (!perms) return false;

    if (perms[targetModule] && typeof perms[targetModule] === 'object') {
      return Boolean(perms[targetModule][action]);
    }
    if (typeof perms[targetModule] === 'boolean') {
      return perms[targetModule];
    }
    if (typeof perms[module] === 'boolean') {
      return perms[module];
    }
    return false;
  };

  // ── Staff Management Methods (Admin Only) ──────────────────────────────────
  const fetchStaffList = async () => {
    try {
      const res = await apiService.getStaffList();
      if (res.success && res.data) {
        setStaffList(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch staff list:', err);
    }
  };

  const fetchStaffAuditLogs = async () => {
    try {
      const res = await apiService.getStaffAuditLogs();
      if (res.success && res.data) {
        setStaffAuditLogs(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch audit logs:', err);
    }
  };

  const createStaffAccount = async (data: {
    email: string;
    displayName?: string;
    fullName?: string;
    name?: string;
    role?: UserRole | string;
    phone?: string;
    department?: string;
    permissions?: Partial<UserPermissions>;
    password?: string;
    initialPassword?: string;
    temporaryPassword?: string;
  }): Promise<{ success: boolean; data?: any; message?: string }> => {
    try {
      const res = await apiService.createStaff(data);
      if (res.success) {
        showToast(`Staff account created successfully for ${data.email}.`, 'success');
        await fetchStaffList();
        return { success: true, data: res.data };
      }
      showToast(res.message || 'Failed to create staff account.', 'error');
      return { success: false, message: res.message };
    } catch (err: any) {
      showToast(err.message || 'Error creating staff account.', 'error');
      return { success: false, message: err.message };
    }
  };

  const updateStaffProfile = async (id: string, updates: any): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await apiService.updateStaff(id, updates);
      if (res.success) {
        showToast('Staff profile updated successfully.', 'success');
        await fetchStaffList();
        if (currentUser?.id === id || currentUser?.uid === id || currentUser?.staffId === id) {
          if (res.data) {
            const updated: UserProfile = {
              ...res.data,
              uid: res.data.uid || res.data._id || res.data.staffId,
              role: normalizeRole(res.data.role),
              permissions: res.data.permissions || getDefaultPermissionsForRole(res.data.role)
            };
            setCurrentUser(updated);
            setUserRole(updated.role);
          }
        }
        return { success: true };
      }
      showToast(res.message || 'Failed to update staff profile.', 'error');
      return { success: false, message: res.message };
    } catch (err: any) {
      showToast(err.message || 'Error updating staff profile.', 'error');
      return { success: false, message: err.message };
    }
  };

  const toggleStaffStatus = async (id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await apiService.toggleStaffStatus(id, isActive);
      if (res.success) {
        showToast(`Staff account successfully ${isActive ? 'activated' : 'deactivated'}.`, 'info');
        await fetchStaffList();
        return { success: true };
      }
      showToast(res.message || 'Failed to update staff status.', 'error');
      return { success: false, message: res.message };
    } catch (err: any) {
      showToast(err.message || 'Error updating staff status.', 'error');
      return { success: false, message: err.message };
    }
  };

  const resetStaffPassword = async (id: string, newPassword?: string): Promise<{ success: boolean; temporaryPassword?: string; message?: string }> => {
    try {
      const res = await apiService.resetStaffPassword(id, newPassword);
      if (res.success) {
        showToast(`Staff password reset successfully.`, 'success');
        await fetchStaffList();
        return { success: true, temporaryPassword: res.temporaryPassword };
      }
      showToast(res.message || 'Failed to reset staff password.', 'error');
      return { success: false, message: res.message };
    } catch (err: any) {
      showToast(err.message || 'Error resetting staff password.', 'error');
      return { success: false, message: err.message };
    }
  };

  const revokeStaffSessions = async (id: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await apiService.revokeSession(id);
      if (res.success) {
        showToast(res.message || 'Staff session revoked.', 'success');
        await fetchSessions();
        return { success: true };
      }
      showToast(res.message || 'Failed to revoke staff session.', 'error');
      return { success: false, message: res.message };
    } catch (err: any) {
      showToast(err.message || 'Error revoking staff session.', 'error');
      return { success: false, message: err.message };
    }
  };

  const deleteStaffAccount = async (id: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await apiService.deleteStaff(id);
      if (res.success) {
        showToast('Staff account permanently deleted.', 'info');
        await fetchStaffList();
        return { success: true };
      }
      showToast(res.message || 'Failed to delete staff account.', 'error');
      return { success: false, message: res.message };
    } catch (err: any) {
      showToast(err.message || 'Error deleting staff account.', 'error');
      return { success: false, message: err.message };
    }
  };

  // ── Authentication Flow ────────────────────────────────────────────────────
  const loginWithCredentials = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    setAuthLoading(true);
    try {
      const res = await apiService.login({ email, password });
      if (res.success && res.user) {
        const userObj: UserProfile = {
          ...res.user,
          uid: res.user.uid || res.user._id || res.user.staffId || 'user_uid',
          id: res.user.staffId || res.user.id || res.user._id,
          role: normalizeRole(res.user.role),
          permissions: normalizePermissions(res.user.permissions, res.user.role)
        };

        setCurrentUser(userObj);
        setUserRole(userObj.role);
        safeSetStored('currentUser', userObj);
        safeSetStored('userRole', userObj.role);

        // Load permitted module data
        try {
          await reloadAllData(userObj);
        } catch (err) {
          console.warn('[AppContext] Post-login data load warning:', err);
        }

        // Role-based dashboard redirection
        if (userObj.role === 'RENTAL_STAFF') {
          setCurrentPage('rental-dashboard');
        } else {
          setCurrentPage('dashboard');
        }

        showToast(`Signed in as ${userObj.displayName || userObj.fullName || userObj.email} (${userObj.role})`, 'success');
        setAuthLoading(false);
        return { success: true };
      }

      setAuthLoading(false);
      return { success: false, message: res.message || 'Invalid credentials.' };
    } catch (err: any) {
      setAuthLoading(false);
      return { success: false, message: err?.message || 'Login failed. Please verify credentials.' };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await apiService.changePassword({ currentPassword, newPassword });
      if (currentUser) {
        const updated = { ...currentUser, mustChangePassword: false };
        setCurrentUser(updated);
        safeSetStored('currentUser', updated);
      }
      showToast('Password changed successfully.', 'success');
      return { success: true };
    } catch (err: any) {
      showToast(err.message || 'Failed to change password.', 'error');
      return { success: false, message: err.message };
    }
  };

  const logoutUser = async () => {
    try {
      await apiService.logout();
    } catch {
      // Ignore network errors on logout
    }
    setCurrentUser(null);
    setUserRole(null);
    safeSetStored('currentUser', null);
    safeSetStored('userRole', null);
    showToast('Signed out cleanly.', 'info');
  };

  // ── Session Management Methods & Heartbeat ─────────────────────────────────
  const fetchSessions = async () => {
    try {
      const res = await apiService.getSessions();
      if (res.success && res.data) {
        const enriched = res.data.map((s: DeviceSession) => ({
          ...s,
          isCurrent: s.sessionId === currentSessionId
        }));
        setSessions(enriched);
      }
    } catch (err) {
      console.warn('Failed to fetch sessions from server:', err);
    }
  };

  const registerCurrentDeviceSession = async () => {
    if (!userRole || !currentUser) return;
    try {
      const info = detectCurrentDeviceInfo();
      await apiService.registerSession({
        sessionId: currentSessionId,
        userId: currentUser.uid || (userRole === 'ADMIN' ? 'uid_master_admin_01' : 'uid_staff'),
        userRole,
        userEmail: currentUser.email || MASTER_ADMIN_EMAIL,
        deviceType: info.deviceType,
        deviceName: info.deviceName,
        operatingSystem: info.operatingSystem,
        osVersion: info.osVersion,
        browser: info.browser,
        browserVersion: info.browserVersion,
        ipAddress: info.ipAddress,
        location: info.location,
        screenResolution: info.screenResolution,
        timezone: info.timezone,
        status: 'ACTIVE'
      });
      fetchSessions();
    } catch (err) {
      console.warn('Failed to register device session:', err);
    }
  };

  const revokeSessionById = async (sessionId: string): Promise<boolean> => {
    try {
      const res = await apiService.revokeSession(sessionId);
      if (res.success) {
        // If current session was revoked
        if (sessionId === currentSessionId) {
          setUserRole(null);
          showToast('Current session signed out.', 'info');
        } else {
          showToast('Remote session signed out successfully.', 'success');
        }
        await fetchSessions();
        return true;
      }
      showToast(res.message || 'Failed to revoke session.', 'error');
      return false;
    } catch (err: any) {
      showToast(err.message || 'Error revoking session.', 'error');
      return false;
    }
  };

  const revokeOtherSessionsExceptCurrent = async (): Promise<number> => {
    try {
      const res = await apiService.revokeOtherSessions(currentSessionId);
      if (res.success) {
        showToast(res.message || 'All other devices have been signed out.', 'success');
        await fetchSessions();
        return res.revokedCount || 0;
      }
      showToast(res.message || 'Failed to sign out other devices.', 'error');
      return 0;
    } catch (err: any) {
      showToast(err.message || 'Error signing out other devices.', 'error');
      return 0;
    }
  };

  const revokeAllActiveSessions = async (): Promise<number> => {
    try {
      const res = await apiService.revokeAllSessions();
      if (res.success) {
        setUserRole(null);
        showToast('All active sessions signed out. Returning to login.', 'info');
        return res.revokedCount || 0;
      }
      showToast(res.message || 'Failed to sign out all sessions.', 'error');
      return 0;
    } catch (err: any) {
      showToast(err.message || 'Error signing out all sessions.', 'error');
      return 0;
    }
  };

  // Heartbeat & Session Revocation Checker
  useEffect(() => {
    if (!userRole) return;

    // Register on login
    registerCurrentDeviceSession();

    const interval = setInterval(async () => {
      try {
        const check = await apiService.checkSessionStatus(currentSessionId);
        if (check.success && check.data && check.data.isRevoked) {
          setUserRole(null);
          setCurrentUser(null);
          setStoredAuthToken(null);
          showToast('Your session is no longer valid. Please sign in again.', 'error');
        } else {
          // Send periodic heartbeat
          registerCurrentDeviceSession();
        }
      } catch {
        // Ignore network glitch
      }
    }, 45000); // Check every 45s

    return () => clearInterval(interval);
  }, [userRole, currentSessionId]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  // Compute live balances
  const cashInHand = dayBookEntries.reduce((sum, e) => sum + (e.cashIn - e.cashOut), 0);
  const cashAtBank = dayBookEntries.reduce((sum, e) => sum + (e.bankIn - e.bankOut), 0);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const unlockMasterControl = async (password: string): Promise<boolean> => {
    if (!password) {
      showToast('Please enter master password', 'warning');
      return false;
    }
    try {
      const res = await apiService.unlockMasterControl(password);
      if (res.success) {
        setMasterControlUnlocked(true);
        showToast('Master Control unlocked successfully', 'success');
        return true;
      } else {
        showToast(res.message || 'Incorrect Master Control password', 'error');
        return false;
      }
    } catch (err: any) {
      showToast('Incorrect Master Control password', 'error');
      return false;
    }
  };

  const changeMasterPassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
    if (!currentPassword || !newPassword) {
      showToast('Please enter both current and new passwords.', 'warning');
      return { success: false, message: 'Please enter both current and new passwords.' };
    }
    try {
      const res = await apiService.changeMasterPassword(currentPassword, newPassword);
      if (res.success) {
        showToast('Stored password successfully secured!', 'success');
        return { success: true, message: res.message };
      } else {
        showToast(res.message || 'Current password does not match.', 'error');
        return { success: false, message: res.message };
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to update Master Control password.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const updateMasterControlSettings = (newSetts: Partial<MasterControlSettings>) => {
    setMasterControlSettings(prev => {
      const isFinancialChanged =
        (newSetts.goldRate22ct !== undefined && newSetts.goldRate22ct !== prev.goldRate22ct) ||
        (newSetts.goldLoanMonthlyRate !== undefined && newSetts.goldLoanMonthlyRate !== prev.goldLoanMonthlyRate) ||
        (newSetts.silverLoanMonthlyRate !== undefined && newSetts.silverLoanMonthlyRate !== prev.silverLoanMonthlyRate) ||
        (newSetts.pronoteMonthlyRate !== undefined && newSetts.pronoteMonthlyRate !== prev.pronoteMonthlyRate) ||
        (newSetts.hirePurchaseMonthlyRate !== undefined && newSetts.hirePurchaseMonthlyRate !== prev.hirePurchaseMonthlyRate) ||
        (newSetts.defaultCardFee !== undefined && newSetts.defaultCardFee !== prev.defaultCardFee) ||
        (newSetts.fdInterestRate !== undefined && newSetts.fdInterestRate !== prev.fdInterestRate) ||
        (newSetts.fdDefaultTenureMonths !== undefined && newSetts.fdDefaultTenureMonths !== prev.fdDefaultTenureMonths) ||
        (newSetts.fdMinimumAmount !== undefined && newSetts.fdMinimumAmount !== prev.fdMinimumAmount) ||
        (newSetts.fdMaximumAmount !== undefined && newSetts.fdMaximumAmount !== prev.fdMaximumAmount) ||
        (newSetts.fdRenewalPolicy !== undefined && newSetts.fdRenewalPolicy !== prev.fdRenewalPolicy) ||
        (newSetts.fdCalculationMethod !== undefined && newSetts.fdCalculationMethod !== prev.fdCalculationMethod) ||
        (newSetts.fdPayoutFrequency !== undefined && newSetts.fdPayoutFrequency !== prev.fdPayoutFrequency);

      const nextVersion = isFinancialChanged
        ? (prev.configurationVersion || 1) + 1
        : (newSetts.configurationVersion || prev.configurationVersion || 1);

      let updatedHistory = newSetts.fdInterestRateHistory || prev.fdInterestRateHistory || [];
      if (newSetts.fdInterestRate !== undefined && newSetts.fdInterestRate !== prev.fdInterestRate) {
        const historyItem: FDRateHistoryItem = {
          id: `FD-RATE-${Date.now()}`,
          rate: Number(newSetts.fdInterestRate),
          previousRate: prev.fdInterestRate,
          effectiveFrom: newSetts.fdInterestRateEffectiveFrom || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
          changedBy: currentUser?.email || 'Master Admin',
          changedAt: new Date().toISOString(),
          notes: `Updated Master FD interest rate from ${prev.fdInterestRate ?? 12}% to ${newSetts.fdInterestRate}% p.a.`
        };
        updatedHistory = [historyItem, ...updatedHistory];
      }

      const updated: MasterControlSettings = {
        ...prev,
        ...newSetts,
        fdInterestRateHistory: updatedHistory,
        configurationVersion: nextVersion
      };

      apiService.updateMasterSettings(updated).catch(e => console.error(e));
      return updated;
    });
    logMasterConfigAudit('MASTER_CONFIG_UPDATED', 'master_control', 'Updated Master Control global financial parameters');
    showToast('Master Control settings saved successfully!', 'success');
  };

  const logMasterConfigAudit = (action: string, entityId: string, details?: string) => {
    const auditEntry: StaffAuditLog = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      actorUid: currentUser?.email || 'master-admin',
      actorEmail: currentUser?.email || MASTER_ADMIN_EMAIL,
      action,
      targetUid: entityId,
      details,
      result: 'SUCCESS'
    };
    setStaffAuditLogs(prev => [auditEntry, ...prev]);
  };

  const addLoanType = (config: {
    name: string;
    description?: string;
    active?: boolean;
    showOnLoanIssue?: boolean;
    useMasterDefaults?: boolean;
    cardFeeEnabled?: boolean;
    cardFee?: number;
    defaultMonthlyRate?: number;
    interestProfileId?: string;
    repaymentSystemId?: string;
    calculationStrategy?: CalculationStrategy;
  }): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can add loan types.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const trimmed = config.name?.trim() || '';
    if (!trimmed) {
      showToast('Loan type name cannot be empty.', 'warning');
      return { success: false, message: 'Loan type name cannot be empty.' };
    }
    if (trimmed.length > 60) {
      showToast('Loan type name is too long (maximum 60 characters).', 'warning');
      return { success: false, message: 'Loan type name is too long.' };
    }
    const currentList = masterControlSettings.loanTypes || defaultLoanTypes;
    if (currentList.some(t => t.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      showToast(`Loan type "${trimmed}" already exists.`, 'warning');
      return { success: false, message: `Loan type "${trimmed}" already exists.` };
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'loan-type';
    let id = slug;
    let counter = 1;
    while (currentList.some(t => t.id === id)) {
      id = `${slug}-${counter++}`;
    }

    const maxSort = currentList.length > 0 ? Math.max(...currentList.map(t => t.sortOrder || 0)) : 0;
    const newItem: LoanTypeConfig = {
      id,
      name: trimmed,
      description: config.description?.trim() || undefined,
      active: config.active ?? true,
      showOnLoanIssue: config.showOnLoanIssue ?? true,
      useMasterDefaults: config.useMasterDefaults !== false,
      cardFeeEnabled: config.cardFeeEnabled ?? true,
      cardFee: config.cardFee !== undefined ? config.cardFee : 25,
      defaultMonthlyRate: config.defaultMonthlyRate !== undefined ? config.defaultMonthlyRate : 1.5,
      interestProfileId: config.interestProfileId || 'gold-bands',
      repaymentSystemId: config.repaymentSystemId || 'monthly-interest-only',
      calculationStrategy: config.calculationStrategy || 'MONTHLY_INTEREST_ONLY',
      sortOrder: maxSort + 1,
      configurationVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [...currentList, newItem];
    setMasterControlSettings(prev => {
      const next = { ...prev, loanTypes: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit('LOAN_TYPE_CREATED', id, `Created loan type "${trimmed}" (${newItem.active ? 'ACTIVE' : 'DISABLED'})`);
    showToast(`Loan type "${trimmed}" added successfully!`, 'success');
    return { success: true };
  };

  const updateLoanType = (id: string, updates: Partial<LoanTypeConfig>): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can modify loan types.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const currentList = masterControlSettings.loanTypes || defaultLoanTypes;
    const existing = currentList.find(t => t.id === id);
    if (!existing) {
      showToast('Loan type not found.', 'error');
      return { success: false, message: 'Loan type not found.' };
    }

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        showToast('Loan type name cannot be empty.', 'warning');
        return { success: false, message: 'Loan type name cannot be empty.' };
      }
      if (trimmed.length > 60) {
        showToast('Loan type name is too long (maximum 60 characters).', 'warning');
        return { success: false, message: 'Loan type name is too long.' };
      }
      if (currentList.some(t => t.id !== id && t.name.trim().toLowerCase() === trimmed.toLowerCase())) {
        showToast(`Loan type "${trimmed}" already exists.`, 'warning');
        return { success: false, message: `Loan type "${trimmed}" already exists.` };
      }
    }

    const updated = currentList.map(t => {
      if (t.id !== id) return t;
      const nextVersion = (t.configurationVersion || 1) + 1;
      return {
        ...t,
        name: updates.name !== undefined ? updates.name.trim() : t.name,
        description: updates.description !== undefined ? (updates.description.trim() || undefined) : t.description,
        active: updates.active !== undefined ? updates.active : t.active,
        showOnLoanIssue: updates.showOnLoanIssue !== undefined ? updates.showOnLoanIssue : (t.showOnLoanIssue ?? true),
        cardFeeEnabled: updates.cardFeeEnabled !== undefined ? updates.cardFeeEnabled : t.cardFeeEnabled,
        cardFee: updates.cardFee !== undefined ? updates.cardFee : t.cardFee,
        defaultMonthlyRate: updates.defaultMonthlyRate !== undefined ? updates.defaultMonthlyRate : t.defaultMonthlyRate,
        interestProfileId: updates.interestProfileId !== undefined ? updates.interestProfileId : t.interestProfileId,
        repaymentSystemId: updates.repaymentSystemId !== undefined ? updates.repaymentSystemId : t.repaymentSystemId,
        calculationStrategy: updates.calculationStrategy !== undefined ? updates.calculationStrategy : t.calculationStrategy,
        configurationVersion: nextVersion,
        updatedAt: new Date().toISOString()
      };
    });

    setMasterControlSettings(prev => {
      const next = { ...prev, loanTypes: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit('LOAN_TYPE_UPDATED', id, `Updated loan type "${id}" details`);
    showToast('Loan type updated successfully!', 'success');
    return { success: true };
  };

  const toggleLoanTypeStatus = (id: string): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can toggle loan type status.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const currentList = masterControlSettings.loanTypes || defaultLoanTypes;
    const existing = currentList.find(t => t.id === id);
    if (!existing) {
      showToast('Loan type not found.', 'error');
      return { success: false, message: 'Loan type not found.' };
    }
    const newStatus = !existing.active;
    const updated = currentList.map(t => t.id === id ? { ...t, active: newStatus, updatedAt: new Date().toISOString() } : t);
    setMasterControlSettings(prev => {
      const next = { ...prev, loanTypes: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit(newStatus ? 'LOAN_TYPE_ENABLED' : 'LOAN_TYPE_DISABLED', id, `${newStatus ? 'Enabled' : 'Disabled'} loan type "${existing.name}"`);
    showToast(`Loan type "${existing.name}" ${newStatus ? 'enabled' : 'disabled'}.`, 'info');
    return { success: true };
  };

  const toggleLoanTypeVisibility = (id: string): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can change loan type visibility.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const currentList = masterControlSettings.loanTypes || defaultLoanTypes;
    const existing = currentList.find(t => t.id === id);
    if (!existing) {
      showToast('Loan type not found.', 'error');
      return { success: false, message: 'Loan type not found.' };
    }
    const newVisibility = existing.showOnLoanIssue === false ? true : false;
    const updated = currentList.map(t => t.id === id ? { ...t, showOnLoanIssue: newVisibility, updatedAt: new Date().toISOString() } : t);
    setMasterControlSettings(prev => {
      const next = { ...prev, loanTypes: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit('LOAN_TYPE_VISIBILITY_CHANGED', id, `Changed Show on Loan Issue for "${existing.name}" to ${newVisibility ? 'ON' : 'OFF'}`);
    showToast(`Loan type "${existing.name}" visibility set to ${newVisibility ? 'ON' : 'OFF'}.`, 'info');
    return { success: true };
  };

  const deleteLoanType = (id: string): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can delete loan types.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const currentList = masterControlSettings.loanTypes || defaultLoanTypes;
    const existing = currentList.find(t => t.id === id);
    if (!existing) {
      showToast('Loan type not found.', 'error');
      return { success: false, message: 'Loan type not found.' };
    }

    // Check if referenced by existing loans
    const isReferenced = (loans || []).some(l => 
      l.loanTypeId === id || 
      (l.loanType && l.loanType.toLowerCase() === existing.name.toLowerCase()) ||
      (l.loanTypeName && l.loanTypeName.toLowerCase() === existing.name.toLowerCase())
    );

    if (isReferenced) {
      showToast(`Cannot delete "${existing.name}" because existing loans reference it. Please disable it instead.`, 'warning');
      return { success: false, message: `Cannot delete "${existing.name}" because historical loans reference it. Please disable it instead.` };
    }

    const updated = currentList.filter(t => t.id !== id);
    setMasterControlSettings(prev => {
      const next = { ...prev, loanTypes: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit('LOAN_TYPE_DELETED', id, `Deleted unused loan type "${existing.name}"`);
    showToast(`Loan type "${existing.name}" removed successfully!`, 'success');
    return { success: true };
  };

  const addRepaymentSystem = (config: { name: string; description?: string; calculationStrategy: CalculationStrategy; active?: boolean }): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can add repayment systems.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const trimmed = config.name?.trim() || '';
    if (!trimmed) {
      showToast('Repayment system name cannot be empty.', 'warning');
      return { success: false, message: 'Repayment system name cannot be empty.' };
    }
    if (trimmed.length > 60) {
      showToast('Repayment system name is too long (maximum 60 characters).', 'warning');
      return { success: false, message: 'Repayment system name is too long.' };
    }
    const validStrategies: CalculationStrategy[] = ['MONTHLY_INTEREST_ONLY', 'EMI', 'BULLET'];
    if (!validStrategies.includes(config.calculationStrategy)) {
      showToast('Please select a valid calculation strategy.', 'warning');
      return { success: false, message: 'Invalid calculation strategy.' };
    }
    const currentList = masterControlSettings.repaymentSystems || defaultRepaymentSystems;
    if (currentList.some(r => r.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      showToast(`Repayment system "${trimmed}" already exists.`, 'warning');
      return { success: false, message: `Repayment system "${trimmed}" already exists.` };
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'repayment-sys';
    let id = slug;
    let counter = 1;
    while (currentList.some(r => r.id === id)) {
      id = `${slug}-${counter++}`;
    }

    const maxSort = currentList.length > 0 ? Math.max(...currentList.map(r => r.sortOrder || 0)) : 0;
    const newItem: RepaymentSystemConfig = {
      id,
      name: trimmed,
      description: config.description?.trim() || undefined,
      calculationStrategy: config.calculationStrategy,
      active: config.active ?? true,
      sortOrder: maxSort + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [...currentList, newItem];
    setMasterControlSettings(prev => {
      const next = { ...prev, repaymentSystems: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit('REPAYMENT_SYSTEM_CREATED', id, `Created repayment system "${trimmed}" (Strategy: ${config.calculationStrategy})`);
    showToast(`Repayment system "${trimmed}" added successfully!`, 'success');
    return { success: true };
  };

  const updateRepaymentSystem = (id: string, updates: { name?: string; description?: string; calculationStrategy?: CalculationStrategy; active?: boolean }): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can modify repayment systems.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const currentList = masterControlSettings.repaymentSystems || defaultRepaymentSystems;
    const existing = currentList.find(r => r.id === id);
    if (!existing) {
      showToast('Repayment system not found.', 'error');
      return { success: false, message: 'Repayment system not found.' };
    }

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        showToast('Repayment system name cannot be empty.', 'warning');
        return { success: false, message: 'Repayment system name cannot be empty.' };
      }
      if (trimmed.length > 60) {
        showToast('Repayment system name is too long (maximum 60 characters).', 'warning');
        return { success: false, message: 'Repayment system name is too long.' };
      }
      if (currentList.some(r => r.id !== id && r.name.trim().toLowerCase() === trimmed.toLowerCase())) {
        showToast(`Repayment system "${trimmed}" already exists.`, 'warning');
        return { success: false, message: `Repayment system "${trimmed}" already exists.` };
      }
    }

    if (updates.calculationStrategy !== undefined) {
      const validStrategies: CalculationStrategy[] = ['MONTHLY_INTEREST_ONLY', 'EMI', 'BULLET'];
      if (!validStrategies.includes(updates.calculationStrategy)) {
        showToast('Invalid calculation strategy.', 'warning');
        return { success: false, message: 'Invalid calculation strategy.' };
      }
    }

    const updated = currentList.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        name: updates.name !== undefined ? updates.name.trim() : r.name,
        description: updates.description !== undefined ? updates.description.trim() || undefined : r.description,
        calculationStrategy: updates.calculationStrategy !== undefined ? updates.calculationStrategy : r.calculationStrategy,
        active: updates.active !== undefined ? updates.active : r.active,
        updatedAt: new Date().toISOString()
      };
    });

    setMasterControlSettings(prev => {
      const next = { ...prev, repaymentSystems: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit('REPAYMENT_SYSTEM_UPDATED', id, `Updated repayment system "${id}"`);
    showToast('Repayment system updated successfully!', 'success');
    return { success: true };
  };

  const toggleRepaymentSystemStatus = (id: string): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can toggle repayment system status.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const currentList = masterControlSettings.repaymentSystems || defaultRepaymentSystems;
    const existing = currentList.find(r => r.id === id);
    if (!existing) {
      showToast('Repayment system not found.', 'error');
      return { success: false, message: 'Repayment system not found.' };
    }
    const newStatus = !existing.active;
    const updated = currentList.map(r => r.id === id ? { ...r, active: newStatus, updatedAt: new Date().toISOString() } : r);
    setMasterControlSettings(prev => {
      const next = { ...prev, repaymentSystems: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit(newStatus ? 'REPAYMENT_SYSTEM_ENABLED' : 'REPAYMENT_SYSTEM_DISABLED', id, `${newStatus ? 'Enabled' : 'Disabled'} repayment system "${existing.name}"`);
    showToast(`Repayment system "${existing.name}" ${newStatus ? 'enabled' : 'disabled'}.`, 'info');
    return { success: true };
  };

  
  const getPurityRate = (purityIdOrName: string): number => {
    if (!purityIdOrName) return 0;
    const list = masterControlSettings.purityOptions || defaultPurityOptions;
    const item = list.find(p => p.id === purityIdOrName || p.name.trim().toLowerCase() === purityIdOrName.trim().toLowerCase());
    const baseGoldRate = masterControlSettings.goldRate22ct || 6400;

    if (item) {
      if (item.ratePerGram && item.ratePerGram > 0) {
        return item.ratePerGram;
      }
      if (item.category === 'OTHER') {
        // Do NOT silently use 22ct gold rate for OTHER materials!
        return 0;
      }
      if (item.category === 'SILVER') {
        return 85;
      }
      if (item.category === 'GOLD') {
        if (item.purityValue) {
          return Math.round((baseGoldRate / 22) * item.purityValue);
        }
        return baseGoldRate;
      }
    }

    const lower = purityIdOrName.trim().toLowerCase();
    if (lower.includes('silver')) return 85;
    if (lower.includes('24ct') || lower.includes('24k')) return Math.round((baseGoldRate / 22) * 24);
    if (lower.includes('22ct') || lower.includes('22k')) return baseGoldRate;
    if (lower.includes('18ct') || lower.includes('18k')) return Math.round((baseGoldRate / 22) * 18);
    if (lower.includes('14ct') || lower.includes('14k')) return Math.round((baseGoldRate / 22) * 14);

    return 0;
  };

  const addPurityOption = (config: { name: string; category?: PurityCategory; purityValue?: number; ratePerGram?: number; description?: string; active?: boolean }): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can add purity options.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const trimmed = config.name?.trim() || '';
    if (!trimmed) {
      showToast('Purity name cannot be empty.', 'warning');
      return { success: false, message: 'Purity name cannot be empty.' };
    }
    if (trimmed.length > 50) {
      showToast('Purity name is too long (maximum 50 characters).', 'warning');
      return { success: false, message: 'Purity name is too long.' };
    }
    const currentList = masterControlSettings.purityOptions || defaultPurityOptions;
    if (currentList.some(p => p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      showToast('This purity/material already exists.', 'warning');
      return { success: false, message: 'This purity/material already exists.' };
    }

    if (config.ratePerGram !== undefined && (isNaN(config.ratePerGram) || !isFinite(config.ratePerGram) || config.ratePerGram < 0)) {
      showToast('Enter a valid non-negative rate.', 'warning');
      return { success: false, message: 'Enter a valid non-negative rate.' };
    }

    if (config.purityValue !== undefined && (isNaN(config.purityValue) || !isFinite(config.purityValue) || config.purityValue < 0)) {
      showToast('Enter a valid purity value.', 'warning');
      return { success: false, message: 'Enter a valid purity value.' };
    }

    const category: PurityCategory = config.category || (trimmed.toLowerCase().includes('silver') ? 'SILVER' : 'GOLD');
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom-purity';
    let id = `${category.toLowerCase()}-${slug}`;
    let counter = 1;
    while (currentList.some(p => p.id === id)) {
      id = `${category.toLowerCase()}-${slug}-${counter++}`;
    }

    const maxSort = currentList.length > 0 ? Math.max(...currentList.map(p => p.sortOrder || 0)) : 0;
    const newItem: PurityConfig = {
      id,
      name: trimmed,
      category,
      purityValue: config.purityValue !== undefined && !isNaN(Number(config.purityValue)) && Number(config.purityValue) > 0 ? Number(config.purityValue) : undefined,
      ratePerGram: config.ratePerGram !== undefined && !isNaN(Number(config.ratePerGram)) && Number(config.ratePerGram) > 0 ? Number(config.ratePerGram) : undefined,
      description: config.description?.trim() || undefined,
      active: config.active ?? true,
      sortOrder: maxSort + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [...currentList, newItem];
    setMasterControlSettings(prev => {
      const next = { ...prev, purityOptions: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit('PURITY_CREATED', id, `Created purity "${trimmed}" (Category: ${category}, Rate: ${newItem.ratePerGram ?? 'Unconfigured'}, PurityValue: ${newItem.purityValue ?? 'N/A'}, Status: ${newItem.active ? 'ACTIVE' : 'DISABLED'})`);
    showToast(`Purity "${trimmed}" added successfully.`, 'success');
    return { success: true };
  };

  const updatePurityOption = (id: string, updates: { name?: string; category?: PurityCategory; purityValue?: number; ratePerGram?: number; description?: string; active?: boolean }): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can modify purity options.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const currentList = masterControlSettings.purityOptions || defaultPurityOptions;
    const existing = currentList.find(p => p.id === id);
    if (!existing) {
      showToast('Purity option not found.', 'error');
      return { success: false, message: 'Purity option not found.' };
    }

    let finalName = existing.name;
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        showToast('Purity name cannot be empty.', 'warning');
        return { success: false, message: 'Purity name cannot be empty.' };
      }
      if (trimmed.length > 50) {
        showToast('Purity name is too long (maximum 50 characters).', 'warning');
        return { success: false, message: 'Purity name is too long.' };
      }
      if (currentList.some(p => p.id !== id && p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
        showToast('This purity/material already exists.', 'warning');
        return { success: false, message: 'This purity/material already exists.' };
      }
      finalName = trimmed;
    }

    if (updates.ratePerGram !== undefined && (isNaN(updates.ratePerGram) || !isFinite(updates.ratePerGram) || updates.ratePerGram < 0)) {
      showToast('Enter a valid non-negative rate.', 'warning');
      return { success: false, message: 'Enter a valid non-negative rate.' };
    }

    if (updates.purityValue !== undefined && (isNaN(updates.purityValue) || !isFinite(updates.purityValue) || updates.purityValue < 0)) {
      showToast('Enter a valid purity value.', 'warning');
      return { success: false, message: 'Enter a valid purity value.' };
    }

    if (updates.ratePerGram !== undefined && updates.ratePerGram !== existing.ratePerGram) {
      logMasterConfigAudit('PURITY_RATE_CHANGED', id, `Changed rate for "${existing.name}" from ₹${existing.ratePerGram || 0} to ₹${updates.ratePerGram}`);
    }

    const updated = currentList.map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        name: finalName,
        category: updates.category !== undefined ? updates.category : p.category,
        purityValue: updates.purityValue !== undefined && updates.purityValue > 0 ? updates.purityValue : undefined,
        ratePerGram: updates.ratePerGram !== undefined && updates.ratePerGram > 0 ? updates.ratePerGram : undefined,
        description: updates.description !== undefined ? updates.description.trim() || undefined : p.description,
        active: updates.active !== undefined ? updates.active : p.active,
        updatedAt: new Date().toISOString()
      };
    });

    setMasterControlSettings(prev => {
      const next = { ...prev, purityOptions: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit('PURITY_UPDATED', id, `Updated purity "${finalName}" (Previous: ${JSON.stringify(existing)}, New: ${JSON.stringify(updates)})`);
    showToast(`Purity "${finalName}" updated successfully.`, 'success');
    return { success: true };
  };

  const togglePurityStatus = (id: string): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can toggle purity status.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const currentList = masterControlSettings.purityOptions || defaultPurityOptions;
    const existing = currentList.find(p => p.id === id);
    if (!existing) {
      showToast('Purity option not found.', 'error');
      return { success: false, message: 'Purity option not found.' };
    }
    const newStatus = !existing.active;
    const updated = currentList.map(p => p.id === id ? { ...p, active: newStatus, updatedAt: new Date().toISOString() } : p);
    setMasterControlSettings(prev => {
      const next = { ...prev, purityOptions: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit(newStatus ? 'PURITY_ENABLED' : 'PURITY_DISABLED', id, `${newStatus ? 'Enabled' : 'Disabled'} purity "${existing.name}"`);
    showToast(`Purity "${existing.name}" ${newStatus ? 'enabled' : 'disabled'}.`, 'info');
    return { success: true };
  };

  const deletePurityOption = (id: string): { success: boolean; message?: string } => {
    if (userRole !== 'ADMIN' && !hasPermission('masterControl') && !hasPermission('settings')) {
      showToast('Permission denied. Only Master Admin can delete purity options.', 'error');
      return { success: false, message: 'Permission denied.' };
    }
    const currentList = masterControlSettings.purityOptions || defaultPurityOptions;
    const existing = currentList.find(p => p.id === id);
    if (!existing) {
      showToast('Purity option not found.', 'error');
      return { success: false, message: 'Purity option not found.' };
    }
    const isUsedInLoans = loans.some(l =>
      (l.items || (l as any).ornamentItems || []).some((item: any) => item.purity === existing.name || item.purityId === existing.id || item.purityName === existing.name)
    );
    if (isUsedInLoans) {
      showToast(`Cannot delete "${existing.name}" because historical loans reference it. Please DISABLE it instead.`, 'warning');
      return { success: false, message: 'Cannot delete purity referenced by historical loans. Please disable it instead.' };
    }

    const updated = currentList.filter(p => p.id !== id);
    setMasterControlSettings(prev => {
      const next = { ...prev, purityOptions: updated };
      apiService.updateMasterSettings(next).catch(e => console.error(e));
      return next;
    });
    logMasterConfigAudit('PURITY_DELETED', id, `Deleted purity "${existing.name}" (${existing.category})`);
    showToast(`Purity "${existing.name}" deleted successfully.`, 'info');
    return { success: true };
  };

  const updateFDInterestRate = (newRate: number, effectiveFrom?: string, notes?: string): boolean => {
    if (userRole !== 'ADMIN' && !masterControlUnlocked && !hasPermission('settings') && !hasPermission('masterControl')) {
      showToast('Permission denied. Only Master Admin can change default FD interest rate.', 'error');
      return false;
    }
    if (isNaN(newRate) || newRate <= 0 || newRate > 36) {
      showToast('Please enter a valid interest rate between 0.25% and 36.00% p.a.', 'error');
      return false;
    }

    const currentRate = masterControlSettings.fdInterestRate ?? 12;
    const todayISO = new Date().toISOString();
    const effDate = effectiveFrom || new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const adminName = currentUser?.displayName || (userRole === 'ADMIN' ? 'Master Admin' : 'Admin');

    const historyItem: FDRateHistoryItem = {
      id: `FD-RATE-${Date.now()}`,
      rate: Number(newRate.toFixed(2)),
      previousRate: currentRate,
      effectiveFrom: effDate,
      effectiveTo: null,
      changedBy: adminName,
      changedAt: todayISO,
      notes: notes || 'Default master FD interest rate updated'
    };

    const existingHistory = masterControlSettings.fdInterestRateHistory || [];
    const updatedHistory = [
      historyItem,
      ...existingHistory.map(h => ({
        ...h,
        effectiveTo: h.effectiveTo || effDate
      }))
    ];

    setMasterControlSettings(prev => {
      const updated = {
        ...prev,
        fdInterestRate: Number(newRate.toFixed(2)),
        fdInterestRateEffectiveFrom: effDate,
        fdInterestRateHistory: updatedHistory
      };
      apiService.updateMasterSettings(updated).catch(e => console.error(e));
      return updated;
    });

    logMasterConfigAudit('FD_DEFAULT_RATE_CHANGED', 'FD-RATE', `Changed default FD interest rate from ${currentRate.toFixed(2)}% to ${newRate.toFixed(2)}% p.a. (Effective: ${effDate}, Changed By: ${adminName})`);
    showToast(`Default FD interest rate updated to ${newRate.toFixed(2)}% p.a. (Effective: ${effDate})`, 'success');
    return true;
  };

  const updateWhatsAppTemplates = (newTpls: Partial<WhatsAppTemplates>) => {
    setWhatsAppTemplates(prev => {
      const updated = { ...prev, ...newTpls };
      apiService.updateWhatsAppTemplates(updated).catch(e => console.error(e));
      return updated;
    });
    showToast('WhatsApp templates saved!', 'success');
  };

  const updateTelegramConfig = (newCfg: Partial<TelegramConfig>) => {
    setTelegramConfig(prev => {
      const updated = { ...prev, ...newCfg };
      apiService.updateTelegramConfig(updated).catch(e => console.error(e));
      return updated;
    });
    showToast('Telegram configuration saved!', 'success');
  };

  const getCustomerById = (id: string): Customer | undefined => {
    return customers.find(c => c.id === id || (c.customerId && c.customerId.toString() === id));
  };

  const addLoan = (loanData: Omit<Loan, 'id' | 'loanNo'> & { loanNo?: string; receiptBillNo?: number }): Loan => {
    let maxLoanNum = 0;
    for (const l of loans) {
      const match = (l.loanNo || '').match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxLoanNum) maxLoanNum = num;
      }
    }
    const storedLoanSeq = getStored('last_loan_sequence', 0);
    const nextLoanSeq = Math.max(maxLoanNum, storedLoanSeq) + 1;

    let finalSeq = nextLoanSeq;
    if (loanData.loanNo) {
      const parsed = parseInt(loanData.loanNo.replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) {
        finalSeq = parsed;
      }
    } else if (loanData.receiptBillNo && Number(loanData.receiptBillNo) > 0) {
      finalSeq = Number(loanData.receiptBillNo);
    }

    const loanNo = `GL-${finalSeq}`;
    const receiptNo = finalSeq;
    safeSetStored('last_loan_sequence', Math.max(finalSeq, nextLoanSeq));
    safeSetStored('last_receipt_sequence', Math.max(finalSeq, nextLoanSeq));

    // Deduplication check: verify if loan with loanNo or identical customer & parameters already exists
    const existingLoan = loans.find(l =>
      (loanNo && l.loanNo.toLowerCase() === loanNo.toLowerCase()) ||
      (l.customerId === loanData.customerId && l.date === loanData.date && l.principal === loanData.principal)
    );
    if (existingLoan) {
      showToast(`Loan ${existingLoan.loanNo} already exists! Duplicate creation prevented.`, 'warning');
      return existingLoan;
    }

    const normalizedItems = (loanData.items || []).map((it) => {
      const gross = Math.round((Number(it.grossWeight) || 0) * 1000) / 1000;
      const deduction = Math.round((Number(it.deductionWeight) || 0) * 1000) / 1000;
      const net = Math.max(0, Math.round((gross - deduction) * 1000) / 1000);
      return {
        ...it,
        grossWeight: gross,
        deductionWeight: deduction,
        netWeight: net
      };
    });

    const totalGrossWeight = Math.round(normalizedItems.reduce((sum, it) => sum + it.grossWeight, 0) * 1000) / 1000;
    const totalDeductionWeight = Math.round(normalizedItems.reduce((sum, it) => sum + (it.deductionWeight || 0), 0) * 1000) / 1000;
    const totalNetWeight = Math.round(normalizedItems.reduce((sum, it) => sum + it.netWeight, 0) * 1000) / 1000;

    const newLoan: Loan = {
      ...loanData,
      id: `L-${Date.now()}`,
      loanNo,
      items: normalizedItems,
      totalGrossWeight,
      totalDeductionWeight,
      totalNetWeight,
      lastInterestPaidDate: loanData.date,
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')
    };

    setLoans((prev) => [newLoan, ...prev]);

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === newLoan.customerId || c.name.toLowerCase() === newLoan.customerName.toLowerCase()
          ? { ...c, activeLoansCount: c.activeLoansCount + 1, totalBorrowed: c.totalBorrowed + newLoan.principal }
          : c
      )
    );

    const disbursementReceipt: Receipt = {
      id: `RCPT-${Date.now()}`,
      receiptNo,
      loanId: newLoan.id,
      loanNo: newLoan.loanNo,
      customerId: newLoan.customerId,
      customerName: newLoan.customerName,
      kind: 'NEW LOAN',
      loanType: newLoan.loanType,
      amount: newLoan.principal,
      principalComponent: newLoan.principal,
      interestComponent: 0,
      paymentMode: newLoan.bankMode === 'Cash' ? 'Cash' : 'UPI',
      date: newLoan.date,
      notes: 'New Loan Disbursement'
    };

    setReceipts((prev) => [disbursementReceipt, ...prev]);

    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isCash = newLoan.bankMode === 'Cash';
    const isSplit = newLoan.bankMode === 'Split';
    const cashDisbursed = isCash ? newLoan.principal : isSplit ? newLoan.cashAmount : 0;
    const bankDisbursed = isCash ? 0 : isSplit ? newLoan.bankAmount : newLoan.principal;

    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      time: timeStr,
      billNo: receiptNo.toString(),
      particulars: `Loan Disbursement (${loanNo}) - ${newLoan.customerName}`,
      accountHead: 'Gold Loan Portfolio',
      mode: newLoan.bankMode === 'Cash' ? 'Cash' : newLoan.bankMode === 'UPI' ? 'UPI' : 'Bank',
      cashIn: 0,
      cashOut: cashDisbursed,
      bankIn: 0,
      bankOut: bankDisbursed,
      cashBal: cashInHand - cashDisbursed,
      bankBal: cashAtBank - bankDisbursed,
      customerName: newLoan.customerName,
      loanNo,
      date: newLoan.date
    };

    setDayBookEntries((prev) => [dbEntry, ...prev]);

    // Authoritative backend persistence & sync
    apiService.createLoan({
      ...loanData,
      loanNo,
      receiptBillNo: receiptNo
    }).then(() => {
      reloadAllData().catch(() => {});
    }).catch((err) => {
      console.warn('[AppContext] Backend loan creation warning:', err);
    });

    showToast(`Loan ${loanNo} issued successfully!`, 'success');
    return newLoan;
  };

  const addReceipt = (receiptData: Omit<Receipt, 'id' | 'receiptNo'>): Receipt => {
    const maxExisting = receipts.length > 0 ? Math.max(...receipts.map((r) => r.receiptNo || 0)) : 0;
    const storedSeq = getStored('last_receipt_sequence', 0);
    const receiptNo = Math.max(maxExisting, storedSeq) + 1;
    safeSetStored('last_receipt_sequence', receiptNo);

    const targetLoan = loans.find((l) => l.loanNo === receiptData.loanNo || l.id === receiptData.loanId);
    const prevOutstanding = targetLoan ? targetLoan.outstandingPrincipal : 0;
    const newPrincipal = Math.max(0, prevOutstanding - (receiptData.principalComponent || 0));

    const newReceipt: Receipt = {
      ...receiptData,
      id: `RCPT-${Date.now()}`,
      receiptNo,
      outstandingBefore: receiptData.outstandingBefore ?? prevOutstanding,
      outstandingAfter: receiptData.outstandingAfter ?? newPrincipal,
      processedBy: receiptData.processedBy ?? 'Admin',
      createdAt: receiptData.createdAt ?? new Date().toISOString()
    };

    setReceipts((prev) => [newReceipt, ...prev]);

    setLoans((prev) =>
      prev.map((l) => {
        if (l.loanNo === newReceipt.loanNo || l.id === newReceipt.loanId) {
          const isFullClosure = newReceipt.kind === 'LOAN CLOSURE' || newPrincipal === 0;
          let calculatedNextDue = newReceipt.nextDueDate || l.nextDueDate;
          if (newReceipt.interestComponent > 0 && !newReceipt.nextDueDate && l.nextDueDate) {
            try {
              calculatedNextDue = addCalendarMonths(l.nextDueDate, 1);
            } catch {
              calculatedNextDue = l.nextDueDate;
            }
          }

          return {
            ...l,
            outstandingPrincipal: newPrincipal,
            status: isFullClosure ? 'CLOSED' : l.status,
            lastInterestPaidDate: newReceipt.date,
            nextDueDate: calculatedNextDue
          };
        }
        return l;
      })
    );

    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isCash = newReceipt.paymentMode === 'Cash';
    const isBank = newReceipt.paymentMode === 'Bank' || newReceipt.paymentMode === 'UPI';

    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      time: timeStr,
      billNo: receiptNo.toString(),
      particulars: `${newReceipt.kind} (${newReceipt.loanNo}) - ${newReceipt.customerName}`,
      accountHead: newReceipt.interestComponent > 0 ? 'Interest Income' : 'Pledge Repayment',
      mode: newReceipt.paymentMode,
      cashIn: isCash ? newReceipt.amount : 0,
      cashOut: 0,
      bankIn: isBank ? newReceipt.amount : 0,
      bankOut: 0,
      cashBal: isCash ? cashInHand + newReceipt.amount : cashInHand,
      bankBal: isBank ? cashAtBank + newReceipt.amount : cashAtBank,
      tdsAmount: newReceipt.tdsAmount || 0,
      customerName: newReceipt.customerName,
      loanNo: newReceipt.loanNo,
      date: newReceipt.date
    };

    setDayBookEntries((prev) => [dbEntry, ...prev]);

    // Authoritative backend persistence & sync
    apiService.createReceipt(newReceipt).then(() => {
      reloadAllData().catch(() => {});
    }).catch((err) => {
      console.warn('[AppContext] Backend receipt creation warning:', err);
    });

    showToast(`Receipt #${receiptNo} recorded successfully!`, 'success');
    return newReceipt;
  };

  const addFixedDeposit = (fdData: Omit<FixedDeposit, 'id' | 'fdNo'>): FixedDeposit => {
    const maxSeq = fixedDeposits.reduce((max, f) => {
      const match = f.fdNo ? f.fdNo.match(/\d+/) : null;
      const num = match ? parseInt(match[0], 10) : 0;
      return num > max ? num : max;
    }, 0);
    const nextNumber = maxSeq + 1;
    const fdNo = `FD-${nextNumber.toString().padStart(2, '0')}`;
    const newFd: FixedDeposit = {
      ...fdData,
      id: `FD-${Date.now()}`,
      fdNo,
      remainingPrincipal: fdData.remainingPrincipal ?? fdData.principal,
      totalWithdrawnPrincipal: fdData.totalWithdrawnPrincipal ?? 0,

      // ── IMMUTABLE CONTRACTUAL SNAPSHOT FIELDS ──────────────────────────────
      fdInterestRateSnapshot: fdData.fdInterestRateSnapshot ?? fdData.interestRatePA,
      fdTenureSnapshot: fdData.fdTenureSnapshot ?? fdData.tenureMonths ?? (masterControlSettings.fdDefaultTenureMonths ?? 12),
      calculationMethodSnapshot: fdData.calculationMethodSnapshot ?? (masterControlSettings.fdCalculationMethod || 'MONTHLY_DIVIDEND'),
      minimumAmountSnapshot: fdData.minimumAmountSnapshot ?? (masterControlSettings.fdMinimumAmount ?? 5000),
      configurationVersion: fdData.configurationVersion ?? (masterControlSettings.configurationVersion || 1)
    };

    setFixedDeposits((prev) => [newFd, ...prev]);

    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isCash = newFd.receivingMethod === 'Cash';
    const isBank = newFd.receivingMethod === 'Bank' || newFd.receivingMethod === 'UPI';

    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      time: timeStr,
      billNo: fdNo,
      particulars: `Fixed Deposit Inflow (${fdNo}) - ${newFd.depositorName}`,
      accountHead: 'Fixed Deposits',
      mode: isCash ? 'Cash' : (newFd.receivingMethod === 'UPI' ? 'UPI' : 'Bank'),
      cashIn: isCash ? newFd.principal : 0,
      cashOut: 0,
      bankIn: isBank ? newFd.principal : 0,
      bankOut: 0,
      cashBal: isCash ? cashInHand + newFd.principal : cashInHand,
      bankBal: isBank ? cashAtBank + newFd.principal : cashAtBank,
      customerName: newFd.depositorName,
      date: newFd.depositDate
    };

    setDayBookEntries((prev) => [dbEntry, ...prev]);

    // Authoritative backend persistence & sync
    apiService.createFixedDeposit(newFd).then(() => {
      reloadAllData().catch(() => {});
    }).catch((err) => {
      console.warn('[AppContext] Backend FD creation warning:', err);
    });

    showToast(`Fixed Deposit ${fdNo} issued successfully!`, 'success');
    return newFd;
  };

  const addFDCustomer = (custData: Omit<FDCustomer, 'id' | 'createdAt'>): FDCustomer => {
    const newCust: FDCustomer = {
      ...custData,
      id: `fdc-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setFdCustomers(prev => [newCust, ...prev]);

    // Authoritative backend persistence & sync
    apiService.createFDCustomer(newCust).then(() => {
      reloadAllData().catch(() => {});
    }).catch((err) => {
      console.warn('[AppContext] Backend FD Customer creation warning:', err);
    });

    showToast(`FD Customer ${newCust.name} saved successfully!`, 'success');
    return newCust;
  };

  const addCustomer = (custData: Omit<Customer, 'id' | 'activeLoansCount' | 'totalBorrowed' | 'joinedDate'>): Customer => {
    // Phone normalization utility
    const normPhone = custData.phone ? custData.phone.replace(/\D/g, '').slice(-10) : '';

    // Check unique mobile number constraint among active (non-deleted) customers
    const existing = customers.find(c => !c.isDeleted && (c.phoneNormalized === normPhone || c.phone.replace(/\D/g, '').slice(-10) === normPhone));
    if (existing) {
      showToast('This mobile number is already registered to an existing customer.', 'error');
      throw new Error('DUPLICATE_PHONE_NUMBER');
    }

    // Atomic Customer ID sequence counter from localStorage / max existing ID
    const storedSeq = localStorage.getItem('kkv_customer_sequence');
    let seq = storedSeq ? parseInt(storedSeq, 10) : 0;
    if (!seq || isNaN(seq)) {
      seq = customers.reduce((max, c) => {
        const num = c.customerId || parseInt(c.id.replace(/\D/g, ''), 10) || 0;
        return Math.max(max, num);
      }, 0);
    }
    const nextSeq = seq + 1;
    localStorage.setItem('kkv_customer_sequence', nextSeq.toString());

    const id = `CUST-${nextSeq.toString().padStart(4, '0')}`;
    const newCust: Customer = {
      ...custData,
      id,
      customerId: nextSeq,
      phoneNormalized: normPhone,
      isDeleted: false,
      activeLoansCount: 0,
      totalBorrowed: 0,
      status: custData.status || 'VERIFIED',
      joinedDate: new Date().toLocaleDateString('en-GB'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setCustomers((prev) => [newCust, ...prev.filter(c => c.id !== id)]);

    // Persist to backend
    apiService.createCustomer(newCust).catch((err) => {
      console.warn('[AppContext] Customer backend save sync warning:', err);
    });

    showToast(`Customer ${newCust.name} (${newCust.id}) added successfully!`, 'success');
    return newCust;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>): Customer | null => {
    let updatedCust: Customer | null = null;

    setCustomers((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      if (index === -1) return prev;

      updatedCust = {
        ...prev[index],
        ...updates,
        id: prev[index].id, // Permanent ID protection
        updatedAt: new Date().toISOString()
      };

      const newArr = [...prev];
      newArr[index] = updatedCust;
      return newArr;
    });

    if (updatedCust) {
      apiService.updateCustomer(id, updates).catch((err) => {
        console.warn('[AppContext] Customer backend update sync warning:', err);
      });
      showToast(`Customer ${updates.name || id} updated successfully!`, 'success');
    }

    return updatedCust;
  };

  const deleteCustomer = (id: string): boolean => {
    if (userRole !== 'ADMIN') {
      showToast('You do not have permission to delete customer records.', 'error');
      return false;
    }

    const targetCust = customers.find((c) => c.id === id);
    if (!targetCust) return false;

    // Soft delete: Mark isDeleted = true
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: 'ADMIN' } : c))
    );

    apiService.deleteCustomer(id).catch((err) => {
      console.warn('[AppContext] Customer backend delete sync warning:', err);
    });

    showToast(`Customer ${targetCust.name} (${targetCust.id}) soft-deleted successfully.`, 'success');
    return true;
  };

  const restoreCustomer = (id: string): boolean => {
    if (userRole !== 'ADMIN') {
      showToast('You do not have permission to restore customer records.', 'error');
      return false;
    }

    const targetCust = customers.find((c) => c.id === id);
    if (!targetCust) return false;

    // Restore customer: Mark isDeleted = false
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isDeleted: false, deletedAt: null, deletedBy: null } : c))
    );

    apiService.restoreCustomer(id).catch((err) => {
      console.warn('[AppContext] Customer backend restore sync warning:', err);
    });

    showToast(`Customer ${targetCust.name} (${targetCust.id}) restored successfully.`, 'success');
    return true;
  };

  const deleteCustomerPermanently = async (id: string): Promise<boolean> => {
    if (userRole !== 'ADMIN') {
      showToast('Only Master Admin has permission to permanently delete customer records.', 'error');
      return false;
    }

    const targetCust = customers.find((c) => c.id === id || (c.customerId && c.customerId.toString() === id));
    if (!targetCust) {
      showToast('Customer not found.', 'error');
      return false;
    }

    const custId = targetCust.id;
    const numericCustIdStr = targetCust.customerId ? targetCust.customerId.toString() : '';

    try {
      await apiService.deleteCustomerPermanently(id);
    } catch (err: any) {
      console.warn('[AppContext] Customer backend permanent deletion sync warning:', err);
    }

    // 1. Remove customer record permanently
    setCustomers((prev) =>
      prev.filter((c) => c.id !== custId && (numericCustIdStr ? c.customerId?.toString() !== numericCustIdStr : true))
    );

    // 2. Cascade delete loans
    const deletedLoanNos = new Set<string>();
    const deletedLoanIds = new Set<string>();

    loans.forEach((l) => {
      if (l.customerId === custId || (numericCustIdStr && l.customerId === numericCustIdStr)) {
        deletedLoanNos.add(l.loanNo);
        deletedLoanIds.add(l.id);
      }
    });

    setLoans((prev) =>
      prev.filter((l) => l.customerId !== custId && (numericCustIdStr ? l.customerId !== numericCustIdStr : true))
    );

    // 3. Cascade delete receipts
    setReceipts((prev) =>
      prev.filter(
        (r) =>
          r.customerId !== custId &&
          (numericCustIdStr ? r.customerId !== numericCustIdStr : true) &&
          !deletedLoanNos.has(r.loanNo) &&
          !deletedLoanIds.has(r.loanId)
      )
    );

    // 4. Cascade delete daybook entries
    setDayBookEntries((prev) =>
      prev.filter(
        (d) =>
          (d.customerName ? d.customerName !== targetCust.name : true) &&
          (d.loanNo ? !deletedLoanNos.has(d.loanNo) : true)
      )
    );

    // 5. Cascade delete fixed deposits, interest payouts, and withdrawals
    const deletedFdNos = new Set<string>();
    fixedDeposits.forEach((f) => {
      if (f.customerId === custId || (numericCustIdStr && f.customerId === numericCustIdStr)) {
        deletedFdNos.add(f.fdNo);
      }
    });

    setFixedDeposits((prev) =>
      prev.filter((f) => f.customerId !== custId && (numericCustIdStr ? f.customerId !== numericCustIdStr : true))
    );
    setFdInterestPayouts((prev) => prev.filter((p) => !deletedFdNos.has(p.fdNo)));
    setFdWithdrawals((prev) => prev.filter((w) => !deletedFdNos.has(w.fdNo)));
    setFdRenewals((prev) => prev.filter((r) => !deletedFdNos.has(r.fdNo)));

    showToast('Customer and all associated records have been permanently deleted successfully.', 'success');
    return true;
  };

  const addDayBookEntry = (entryData: Omit<DayBookEntry, 'id' | 'time' | 'cashBal' | 'bankBal'>): DayBookEntry => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const newEntry: DayBookEntry = {
      ...entryData,
      id: `db-${Date.now()}`,
      time: timeStr,
      cashBal: cashInHand + (entryData.cashIn - entryData.cashOut),
      bankBal: cashAtBank + (entryData.bankIn - entryData.bankOut)
    };

    setDayBookEntries((prev) => [newEntry, ...prev]);
    showToast(`Day Book entry recorded!`, 'success');
    return newEntry;
  };

  const payFDInterest = (
    fdNo: string,
    mode: 'Cash' | 'Bank' | 'UPI' | string,
    amount?: number,
    targetDueDate?: string,
    targetPeriodKey?: string
  ): boolean => {
    const targetFD = fixedDeposits.find((f) => f.fdNo === fdNo || f.id === fdNo);
    if (!targetFD) {
      showToast('Fixed Deposit record not found.', 'error');
      return false;
    }

    if (targetFD.status === 'WITHDRAWN') {
      showToast('This Fixed Deposit is closed and cannot receive interest payouts.', 'error');
      return false;
    }

    const schedule = calculateFDInterestSchedule(targetFD, fdInterestPayouts);

    const dueDateToPay = targetDueDate ? normalizeDateString(targetDueDate) : schedule.nextPayoutDate;
    const periodKeyToPay = targetPeriodKey || calculateInterestPeriodKey(targetFD.fdNo, dueDateToPay);

    // Check duplicate period key
    const duplicate = fdInterestPayouts.some(
      (p) =>
        p.status === 'PAID' &&
        ((p as any).periodKey === periodKeyToPay ||
          (p.fdNo === targetFD.fdNo && (p.dueDate === dueDateToPay || (p as any).periodKey === periodKeyToPay)))
    );

    if (duplicate) {
      showToast('This interest period has already been paid.', 'error');
      return false;
    }

    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const payoutAmount = amount && amount > 0 ? amount : schedule.payoutAmount;

    const payout: FDInterestPayout = {
      id: `fd-payout-${Date.now()}`,
      fdId: targetFD.id,
      fdNo: targetFD.fdNo,
      customerId: targetFD.customerId,
      depositorName: targetFD.depositorName,
      amount: payoutAmount,
      date: todayStr,
      dueDate: dueDateToPay,
      periodKey: periodKeyToPay,
      mode: mode as any,
      status: 'PAID'
    };

    setFdInterestPayouts((prev) => [payout, ...prev]);

    // Daybook entry
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isCash = mode === 'Cash';
    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      time: timeStr,
      billNo: `INT-${targetFD.fdNo}`,
      particulars: `FD Interest Payout (${targetFD.fdNo}) - ${targetFD.depositorName} (${dueDateToPay})`,
      accountHead: 'Interest Expense',
      mode: mode as any,
      cashIn: 0,
      cashOut: isCash ? payoutAmount : 0,
      bankIn: 0,
      bankOut: isCash ? 0 : payoutAmount,
      cashBal: isCash ? cashInHand - payoutAmount : cashInHand,
      bankBal: isCash ? cashAtBank : cashAtBank - payoutAmount,
      customerName: targetFD.depositorName,
      date: todayStr
    };

    setDayBookEntries((prev) => [dbEntry, ...prev]);

    // Authoritative backend persistence & sync
    apiService.payFDInterest(targetFD.fdNo, payoutAmount, mode, dueDateToPay, periodKeyToPay).then(() => {
      reloadAllData().catch(() => {});
    }).catch((err) => {
      console.warn('[AppContext] Backend FD Interest payout warning:', err);
    });

    showToast(`Interest payout of ₹${payoutAmount.toLocaleString('en-IN')} recorded for ${targetFD.fdNo} (${dueDateToPay})`, 'success');
    return true;
  };

  const withdrawFD = (
    fdNo: string,
    mode: 'Cash' | 'Bank' | 'UPI',
    notes?: string,
    withdrawalAmount?: number,
    transactionReference?: string,
    bankName?: string
  ): FDWithdrawal | null => {
    const targetFD = fixedDeposits.find(f => f.fdNo === fdNo);
    if (!targetFD) {
      showToast('Fixed Deposit record not found.', 'error');
      return null;
    }
    if (targetFD.status === 'WITHDRAWN') {
      showToast('This Fixed Deposit is already closed and fully withdrawn.', 'error');
      return null;
    }

    const currentRemaining = targetFD.remainingPrincipal ?? targetFD.principal;
    const amountToWithdraw = withdrawalAmount && withdrawalAmount > 0 ? Math.min(withdrawalAmount, currentRemaining) : currentRemaining;

    if (amountToWithdraw <= 0) {
      showToast('Invalid withdrawal amount.', 'error');
      return null;
    }

    const newRemaining = Math.max(0, currentRemaining - amountToWithdraw);
    const newTotalWithdrawn = (targetFD.totalWithdrawnPrincipal ?? 0) + amountToWithdraw;
    const isFullyWithdrawn = newRemaining <= 0;

    // Safe Monotonic Withdrawal ID (WD-XXX)
    const storedWdSeq = getStored<number>('last_fd_withdrawal_sequence', 0);
    const maxWdSeq = fdWithdrawals.reduce((max, w) => {
      const match = w.withdrawalId?.match(/(\d+)$/);
      const num = match ? parseInt(match[1], 10) : 0;
      return num > max ? num : max;
    }, 0);
    const nextWdNum = Math.max(storedWdSeq, maxWdSeq) + 1;
    safeSetStored('last_fd_withdrawal_sequence', nextWdNum);
    const newWithdrawalId = `WD-${String(nextWdNum).padStart(3, '0')}`;

    // Safe Monotonic Receipt Number (FDR-XXX)
    const storedRcptSeq = getStored<number>('last_fd_receipt_sequence', 0);
    const maxRcptSeq = fdWithdrawals.reduce((max, w) => {
      const match = (w.receiptNo || w.receiptId)?.match(/(\d+)$/);
      const num = match ? parseInt(match[1], 10) : 0;
      return num > max ? num : max;
    }, 0);
    const nextRcptNum = Math.max(storedRcptSeq, maxRcptSeq) + 1;
    safeSetStored('last_fd_receipt_sequence', nextRcptNum);
    const newReceiptNo = `FDR-${String(nextRcptNum).padStart(3, '0')}`;

    const todayStr = formatFDDate(new Date());
    const withdrawal: FDWithdrawal = {
      id: `fd-wth-${Date.now()}`,
      withdrawalId: newWithdrawalId,
      receiptNo: newReceiptNo,
      receiptId: newReceiptNo,
      withdrawalType: isFullyWithdrawn ? 'FULL' : 'PARTIAL',
      fdId: targetFD.id,
      fdNo,
      customerId: targetFD.customerId,
      customerPhone: targetFD.phone,
      depositorName: targetFD.depositorName,
      originalPrincipal: targetFD.principal,
      balanceBefore: currentRemaining,
      principalAmount: amountToWithdraw,
      remainingBalance: newRemaining,
      interestPaid: 0,
      totalAmount: amountToWithdraw,
      withdrawalDate: todayStr,
      mode,
      transactionReference: transactionReference || undefined,
      bankName: bankName || undefined,
      notes: notes || (isFullyWithdrawn ? 'Full FD settlement' : 'Partial principal withdrawal'),
      status: 'COMPLETED',
      processedBy: 'Admin',
      createdAt: new Date().toISOString(),
      items: (targetFD as any).items || [],
      photos: (targetFD as any).photos || []
    };

    setFdWithdrawals(prev => [withdrawal, ...prev]);
    setFixedDeposits(prev => prev.map(f => f.fdNo === fdNo ? {
      ...f,
      status: isFullyWithdrawn ? 'WITHDRAWN' : f.status,
      remainingPrincipal: newRemaining,
      totalWithdrawnPrincipal: newTotalWithdrawn
    } : f));

    // Daybook entry
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isCash = mode === 'Cash';
    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      time: timeStr,
      billNo: newWithdrawalId,
      particulars: `FD ${isFullyWithdrawn ? 'Full Closure' : 'Partial Withdrawal'} (${fdNo}) - ${targetFD.depositorName}`,
      accountHead: 'Fixed Deposits',
      mode,
      cashIn: 0,
      cashOut: isCash ? amountToWithdraw : 0,
      bankIn: 0,
      bankOut: isCash ? 0 : amountToWithdraw,
      cashBal: isCash ? cashInHand - amountToWithdraw : cashInHand,
      bankBal: isCash ? cashAtBank : cashAtBank - amountToWithdraw,
      customerName: targetFD.depositorName,
      date: todayStr
    };

    setDayBookEntries(prev => [dbEntry, ...prev]);

    // Authoritative backend persistence & sync
    apiService.withdrawFD(fdNo, mode, notes, amountToWithdraw, transactionReference, bankName).then(() => {
      reloadAllData().catch(() => {});
    }).catch((err) => {
      console.warn('[AppContext] Backend FD withdrawal warning:', err);
    });

    showToast(
      isFullyWithdrawn
        ? `Fixed Deposit ${fdNo} closed and fully refunded (₹${amountToWithdraw.toLocaleString('en-IN')})`
        : `Partial withdrawal of ₹${amountToWithdraw.toLocaleString('en-IN')} processed for ${fdNo}. Remaining: ₹${newRemaining.toLocaleString('en-IN')}`,
      'success'
    );
    return withdrawal;
  };

  const renewFD = (fdNo: string, periodMonths: number, notes?: string): boolean => {
    if (userRole !== 'ADMIN' && userRole !== 'STAFF') {
      showToast('You do not have permission to renew Fixed Deposits.', 'error');
      return false;
    }
    const targetFD = fixedDeposits.find(f => f.fdNo === fdNo);
    if (!targetFD) {
      showToast('Fixed Deposit record not found.', 'error');
      return false;
    }
    if (targetFD.status === 'WITHDRAWN') {
      showToast('Cannot renew a fully withdrawn Fixed Deposit.', 'error');
      return false;
    }
    if (periodMonths <= 0) {
      showToast('Invalid renewal period.', 'error');
      return false;
    }

    const previousMaturityDate = targetFD.maturityDate;
    const newMaturityDate = addCalendarMonths(previousMaturityDate, periodMonths);
    const todayStr = formatFDDate(new Date());

    // Sequential RN-XXX ID
    const maxRnSeq = fdRenewals.reduce((max, r) => {
      const match = r.renewalId?.match(/(\d+)$/);
      const num = match ? parseInt(match[1], 10) : 0;
      return num > max ? num : max;
    }, 0);
    const newRenewalId = `RN-${String(maxRnSeq + 1).padStart(3, '0')}`;

    const renewal: FDRenewal = {
      id: `fd-rnw-${Date.now()}`,
      renewalId: newRenewalId,
      fdId: targetFD.id,
      fdNo,
      customerId: targetFD.customerId,
      depositorName: targetFD.depositorName,
      previousMaturityDate,
      newMaturityDate,
      renewalPeriodMonths: periodMonths,
      renewalDate: todayStr,
      interestRateAtRenewal: targetFD.interestRatePA,
      notes: notes || `FD renewed for ${periodMonths} months`,
      status: 'COMPLETED'
    };

    setFdRenewals(prev => [renewal, ...prev]);
    setFixedDeposits(prev => prev.map(f => f.fdNo === fdNo ? {
      ...f,
      maturityDate: newMaturityDate,
      status: 'ACTIVE' as const
    } : f));

    // Daybook audit entry
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}-rnw`,
      time: timeStr,
      billNo: newRenewalId,
      particulars: `FD Renewal (${fdNo}) - ${targetFD.depositorName} — Extended ${periodMonths}m to ${newMaturityDate}`,
      accountHead: 'Fixed Deposits',
      mode: 'Cash',
      cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0,
      cashBal: cashInHand, bankBal: cashAtBank,
      customerName: targetFD.depositorName,
      date: todayStr
    };
    setDayBookEntries(prev => [dbEntry, ...prev]);

    // Authoritative backend persistence & sync
    apiService.renewFD(fdNo, periodMonths, notes).then(() => {
      reloadAllData().catch(() => {});
    }).catch((err) => {
      console.warn('[AppContext] Backend FD renewal warning:', err);
    });

    showToast(`Fixed Deposit ${fdNo} renewed for ${periodMonths} months. New maturity: ${newMaturityDate}`, 'success');
    return true;
  };

  const deleteFixedDeposit = (fdNo: string): boolean => {
    if (userRole !== 'ADMIN') {
      showToast('Only Master Admin has permission to delete Fixed Deposit contracts.', 'error');
      return false;
    }
    const target = fixedDeposits.find((f) => f.fdNo === fdNo);
    if (!target) return false;

    setFixedDeposits((prev) => prev.filter((f) => f.fdNo !== fdNo));
    setFdInterestPayouts((prev) => prev.filter((p) => p.fdNo !== fdNo));
    setFdWithdrawals((prev) => prev.filter((w) => w.fdNo !== fdNo));
    setFdRenewals((prev) => prev.filter((r) => r.fdNo !== fdNo));

    // Authoritative backend persistence & sync
    apiService.deleteFixedDeposit(fdNo).then(() => {
      reloadAllData().catch(() => {});
    }).catch((err) => {
      console.warn('[AppContext] Backend FD delete warning:', err);
    });

    showToast(`Fixed Deposit ${fdNo} permanently deleted.`, 'success');
    return true;
  };

  const bulkUpdateFixedDepositDates = async (fdNos: string[], newDepositDate?: string, offsetDays?: number): Promise<boolean> => {
    try {
      const res = await apiService.bulkUpdateFDDates(fdNos, newDepositDate, offsetDays);
      if (res && res.success) {
        // Refresh fixed deposits from backend
        const fdList = await apiService.getFixedDeposits();
        if (fdList) setFixedDeposits(fdList);

        // Also refresh day book to show the correct entry dates!
        const dbList = await apiService.getDayBook();
        if (dbList) setDayBookEntries(dbList);

        showToast(res.message || 'Fixed deposits updated successfully!', 'success');
        return true;
      }
      showToast(res?.message || 'Failed to update fixed deposits.', 'error');
      return false;
    } catch (err: any) {
      showToast(err.message || 'Error updating fixed deposits.', 'error');
      return false;
    }
  };

  const resetAllData = () => {
    // Preserve authentication tokens and session preferences in localStorage
    const authKeys = [
      'kkv_auth_token',
      'kkv_session_token',
      'kkv_user_role',
      'kkv_user',
      'kkv_userRole',
      'kkv_currentUser',
      'kkv_darkMode',
      'kkv_isWorkspaceSelected',
      'kkv_selectedWorkspace'
    ];
    const preserved: Record<string, string> = {};
    for (const key of authKeys) {
      const val = localStorage.getItem(key);
      if (val !== null) preserved[key] = val;
    }

    localStorage.clear();

    for (const [k, v] of Object.entries(preserved)) {
      localStorage.setItem(k, v);
    }

    setLoans([]);
    setCustomers([]);
    setReceipts([]);
    setFixedDeposits([]);
    setDayBookEntries([]);
    setFdCustomers([]);
    setFdInterestPayouts([]);
    setFdWithdrawals([]);
    setFdRenewals([]);

    showToast('All system operational data wiped. System ready for fresh start.', 'warning');
  };

  const restoreDataFromJSON = (jsonStr: string): boolean => {
    try {
      const rawData = JSON.parse(jsonStr);
      const data = rawData.data || rawData;
      if (Array.isArray(data.loans)) setLoans(data.loans);
      if (Array.isArray(data.customers)) setCustomers(data.customers);
      if (Array.isArray(data.receipts)) setReceipts(data.receipts);
      if (Array.isArray(data.fixedDeposits)) setFixedDeposits(data.fixedDeposits);
      if (Array.isArray(data.fdInterestPayouts)) setFdInterestPayouts(data.fdInterestPayouts);
      if (Array.isArray(data.fdWithdrawals)) setFdWithdrawals(data.fdWithdrawals);
      if (Array.isArray(data.fdRenewals)) setFdRenewals(data.fdRenewals);
      if (Array.isArray(data.fdCustomers)) setFdCustomers(data.fdCustomers);
      if (Array.isArray(data.dayBookEntries)) setDayBookEntries(data.dayBookEntries);
      if (data.masterControlSettings) setMasterControlSettings(data.masterControlSettings);
      if (data.whatsAppTemplates) setWhatsAppTemplates(data.whatsAppTemplates);
      showToast('Data restored successfully!', 'success');
      return true;
    } catch {
      showToast('Invalid backup JSON file!', 'error');
      return false;
    }
  };

  // ── Centralized Notifications Derivation & Handlers ────────────────────────
  const notifications = useMemo(() => {
    return generateAllNotifications({
      loans,
      receipts,
      fixedDeposits,
      fdInterestPayouts,
      customers,
      fdCustomers,
      readNotificationIds
    });
  }, [loans, receipts, fixedDeposits, fdInterestPayouts, customers, fdCustomers, readNotificationIds]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.read && n.type !== 'PAID').length;
  }, [notifications]);

  const markNotificationAsRead = (id: string) => {
    setReadNotificationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const markAllNotificationsAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotificationIds((prev) => Array.from(new Set([...prev, ...allIds])));
    showToast('All notifications marked as read.', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        searchQuery,
        setSearchQuery,
        darkMode,
        setDarkMode,
        toggleDarkMode,
        isWorkspaceSelected,
        setIsWorkspaceSelected,
        selectedWorkspace,
        setSelectedWorkspace,
        userRole,
        setUserRole,
        loans,
        customers,
        receipts,
        fixedDeposits,
        dayBookEntries,
        fdCustomers,
        fdInterestPayouts,
        fdWithdrawals,
        fdRenewals,
        selectedLoan,
        setSelectedLoan,
        selectedReceipt,
        setSelectedReceipt,
        masterControlOpen,
        setMasterControlOpen,
        masterControlUnlocked,
        unlockMasterControl,
        changeMasterPassword,
        masterControlSettings,
        updateMasterControlSettings,
        addLoanType,
        updateLoanType,
        toggleLoanTypeStatus,
        toggleLoanTypeVisibility,
        deleteLoanType,
        addRepaymentSystem,
        updateRepaymentSystem,
        toggleRepaymentSystemStatus,
        addPurityOption,
        updatePurityOption,
        togglePurityStatus,
        deletePurityOption,
        getPurityRate,
        updateFDInterestRate,
        whatsAppTemplates,
        updateWhatsAppTemplates,
        telegramConfig,
        updateTelegramConfig,
        getCustomerById,
        addLoan,
        addReceipt,
        addFixedDeposit,
        addFDCustomer,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        restoreCustomer,
        deleteCustomerPermanently,
        addDayBookEntry,
        payFDInterest,
        withdrawFD,
        renewFD,
        deleteFixedDeposit,
        bulkUpdateFixedDepositDates,
        cashInHand,
        cashAtBank,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
        showToast,
        toasts,
        removeToast,
        selectedProfileCustomerId,
        setSelectedProfileCustomerId,
        editingCustomerId,
        setEditingCustomerId,
        startEditCustomer,
        resetAllData,
        restoreDataFromJSON,
        reloadAllData,

        // RBAC & Authentication State
        currentUser,
        setCurrentUser,
        authLoading,
        hasPermission,
        loginWithCredentials,
        logoutUser,
        changePassword,

        // Staff & RBAC Management
        staffList,
        fetchStaffList,
        createStaffAccount,
        updateStaffProfile,
        toggleStaffStatus,
        resetStaffPassword,
        revokeStaffSessions,
        deleteStaffAccount,
        staffAuditLogs,
        fetchStaffAuditLogs,

        // Device & Active Session Management
        sessions,
        currentSessionId,
        fetchSessions,
        revokeSessionById,
        revokeOtherSessionsExceptCurrent,
        revokeAllActiveSessions,

        // Centralized Notifications
        notifications,
        unreadNotificationCount,
        isNotificationOpen,
        setIsNotificationOpen,
        toggleNotificationOpen,
        markNotificationAsRead,
        markAllNotificationsAsRead
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
