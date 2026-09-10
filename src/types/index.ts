export type NavPage =
  | 'dashboard'
  | 'customers'
  | 'customers-add'
  | 'add-customer-form'
  | 'edit-customer'
  | 'search-customer'
  | 'customer-profile'
  | 'loan-issue'
  | 'loan-display'
  | 'loan-receipts'
  | 'receipt-display'
  | 'all-receipts'
  | 'pending-loans'
  | 'total-loans'
  | 'rc-renewal-reminders'
  | 'bill-balance'
  | 'fd-customers'
  | 'new-deposit'
  | 'deposit-display'
  | 'deposit-interest'
  | 'interest-display'
  | 'interest-pending'
  | 'deposit-withdrawal'
  | 'withdrawal-display'
  | 'fd-customers-deposits'
  | 'day-book'
  | 'trial-balance'
  | 'profit-loss'
  | 'balance-sheet'
  | 'accounts'
  | 'daily-reminders'
  | 'notifications'
  | 'backup-restore'
  | 'admin-panel'
  | 'settings'
  | 'rental'
  | 'rental-dashboard'
  | 'rental-complexes'
  | 'rental-complex-detail'
  | 'rental-shops'
  | 'rental-shop-detail'
  | 'rental-payments'
  | 'rental-daybook'
  | 'rental-expenses'
  | 'rental-reports';

export type PurityCategory = 'GOLD' | 'SILVER' | 'OTHER';

export type PurityOption = string;

export interface PurityConfig {
  id: string; // stable unique identifier e.g. 'gold-22', 'gold-24', 'silver-925', 'gold-21'
  name: string; // display name e.g. '22ct', '21ct Gold'
  category: PurityCategory;
  purityValue?: number; // numeric value e.g. 22, 24, 925
  ratePerGram?: number; // optional custom rate per gram override
  description?: string;
  active: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrnamentItem {
  id: string;
  item: string;
  qty: number;
  purity: string; // contractual purity name e.g. '22ct'
  purityId?: string; // unique ID e.g. 'gold-22'
  purityName?: string; // display name snapshot e.g. '22ct'
  purityCategory?: PurityCategory;
  purityValue?: number;
  rateUsed?: number; // valuation rate applied per gram
  valuation?: number; // total valuation for this item
  grossWeight: number;
  deductionWeight?: number;
  netWeight: number;
}

export interface NomineeKycDocuments {
  aadhaarFront?: string | null;
  aadhaarBack?: string | null;
  panCard?: string | null;
}

export interface NomineeDetails {
  hasNominee: boolean;
  enabled?: boolean;
  name: string;
  fullName?: string;
  relationship: string;
  relation?: string;
  customRelation?: string | null;
  specifiedRelation?: string | null;
  phone: string;
  mobile?: string;
  alternateMobile?: string;
  gender?: 'Male' | 'Female' | 'Other';
  ageMode?: 'DOB' | 'AGE';
  dateOfBirth?: string;
  age?: number;
  occupation?: string;
  email?: string;
  photo?: string | null;
  idProofType?: string;
  idProofNumber?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  otherIdName?: string;
  otherIdNumber?: string;
  idProof?: {
    type: string;
    aadhaarNumber?: string;
    panNumber?: string;
    otherIdName?: string;
    otherIdNumber?: string;
    idNumber?: string;
  };
  address: string;
  currentAddress?: string;
  permanentAddress?: string;
  isSameAddress?: boolean;
  sameAsCurrentAddress?: boolean;
  location?: CustomerLocationData | LocationDetails | null;
  documents?: NomineeKycDocuments;
}

export interface GuarantorKycDocuments {
  aadhaarFront?: string | null;
  aadhaarBack?: string | null;
  panCard?: string | null;
  photo?: string | null;
}

export interface GuarantorDetails {
  hasGuarantor: boolean;
  enabled?: boolean;
  name: string;
  fullName?: string;
  relationship?: string;
  relation?: string;
  customRelation?: string | null;
  specifiedRelation?: string | null;
  gender?: 'Male' | 'Female' | 'Other';
  dateOfBirth?: string;
  age?: number;
  phone: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  occupation?: string;
  monthlyIncome?: number;
  aadhaarNumber?: string;
  panNumber?: string;
  idProof?: string;
  address: string;
  currentAddress?: string;
  permanentAddress?: string;
  isSameAddress?: boolean;
  sameAsCurrentAddress?: boolean;
  documents?: GuarantorKycDocuments;
}

export interface CustomerLocation {
  captured: boolean;
  coordinates: string;
  mapsUrl: string;
  addressSummary: string;
}

export interface StructuredAddress {
  houseNumber: string;
  street: string;
  locality: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
}

export interface LocationDetails {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string | null;
  googleMapsUrl: string;
  locationMethod: 'gps' | 'google_maps_url' | 'manual';
}

export interface CustomerLocationData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source?: 'gps' | 'google_maps_link' | 'google_maps_url' | 'manual';
  locationMethod?: 'gps' | 'google_maps_url' | 'manual';
  googleMapsUrl: string;
  capturedAt: string | null;
}

export type CalculationStrategy = 'MONTHLY_INTEREST_ONLY' | 'EMI' | 'BULLET';

export interface LoanTypeConfig {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  showOnLoanIssue?: boolean;
  useMasterDefaults?: boolean;
  cardFeeEnabled?: boolean;
  cardFee?: number;
  defaultMonthlyRate?: number;
  interestProfileId?: 'gold-bands' | 'silver-bands' | 'pronote-interest' | 'fixed-rate' | string;
  /** Per-loan-type interest rate amount bands. When present, takes precedence over global amountBands/silverAmountBands. */
  amountBands?: AmountBand[];
  repaymentSystemId?: string;
  calculationStrategy?: CalculationStrategy;
  configurationVersion?: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RepaymentSystemConfig {
  id: string;
  name: string;
  description?: string;
  calculationStrategy: CalculationStrategy;
  active: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Loan {
  id: string;
  receiptBillNo: number;
  loanNo: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerGender: 'Male' | 'Female' | 'Other';
  customerAge: number;
  customerOccupation: string;
  customerEmail?: string;
  customerPhotoUrl?: string;
  customerCurrentAddress: string;
  customerPermanentAddress: string;
  customerLocation?: CustomerLocation;
  nominee?: NomineeDetails;
  guarantor?: GuarantorDetails;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineePhone?: string;
  nomineeAadhaar?: string;
  nomineePan?: string;
  guarantorName?: string;
  guarantorRelation?: string;
  guarantorPhone?: string;
  guarantorAadhaar?: string;
  guarantorPan?: string;
  kycDocuments?: string[];
  date: string;
  loanType: string;
  repaymentSystem: string;
  loanTypeId?: string;
  loanTypeName?: string;
  loanTypeNameSnapshot?: string;
  interestRateSnapshot?: number;
  interestProfileSnapshot?: string;
  cardFeeSnapshot?: number;
  interestProfileIdSnapshot?: string;
  interestProfileNameSnapshot?: string;
  interestConfigurationSnapshot?: any;
  repaymentSystemId?: string;
  repaymentSystemName?: string;
  calculationStrategy?: CalculationStrategy;
  area?: string;
  showroom?: string;
  principal: number;
  interestRate: number; // monthly %
  interestRateUnit?: 'MONTHLY' | 'YEARLY';
  rateSource?: 'MASTER_CONTROL' | 'CUSTOM';
  rateEffectiveAt?: string;
  loanConfigVersion?: string;
  configurationVersion?: number | string;
  configurationSource?: string;
  amountBandId?: string;
  amountBandCondition?: 'Below' | 'Above';
  amountBandThreshold?: number;
  penaltyAfterMonths?: number;
  penaltyStepUpMonthly?: number;
  penaltyCalculation?: string;
  bankMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Split';
  splitBankMode?: string;
  cashAmount: number;
  bankAmount: number;
  deductAdvanceInterest: boolean;
  advanceDays: number;
  advanceInterestAmount: number;
  advanceInterestReceivingMethod?: 'Cash' | 'Bank' | 'Cash + Bank';
  cardFee: number;
  cardFeeEnabled?: boolean;
  cardFeePaymentMode: 'Cash' | 'Bank';
  cardFeeBankMode?: string;
  items: OrnamentItem[];
  totalGrossWeight: number;
  totalDeductionWeight?: number;
  totalNetWeight: number;
  marketValue: number;
  ltv: number;
  monthlyInterest: number;
  notes: string;
  photos: string[];
  status: 'ACTIVE' | 'CLOSED' | 'PENDING' | 'OVERDUE';
  disbursedAmount: number;
  netDisbursed?: number;
  outstandingPrincipal: number;
  accruedInterest: number;
  renewalDate: string;
  lastInterestPaidDate?: string;
  nextDueDate?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  rcNumber?: string;
  rcExpiryDate?: string;
  insuranceExpiryDate?: string;
  roadTaxExpiryDate?: string;
  permitExpiryDate?: string;
  fcExpiryDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Receipt {
  id: string;
  receiptNo: number;
  loanId: string;
  loanNo: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  kind:
    | 'REPAYMENT'
    | 'NEW LOAN'
    | 'INTEREST PAYMENT'
    | 'PART PAYMENT'
    | 'LOAN CLOSURE'
    | 'EMI PAYMENT'
    | 'INTEREST + PRINCIPAL'
    | 'OTHER';
  loanType: string;
  amount: number;
  principalComponent: number;
  interestComponent: number;
  penaltyComponent?: number;
  odCharges?: number;
  otherCharges?: number;
  discount?: number;
  tdsAmount?: number;
  paymentMode: 'Cash' | 'UPI' | 'Bank';
  date: string;
  currentDueDate?: string;
  nextDueDate?: string;
  daysLate?: number;
  notes?: string;
  bankName?: string;
  transactionReference?: string;
  upiId?: string;
  outstandingBefore?: number;
  outstandingAfter?: number;
  processedBy?: string;
  createdAt?: string;
}

export interface DayBookEntry {
  id: string;
  time: string;
  billNo: string;
  particulars: string;
  accountHead: string;
  mode: 'Cash' | 'Bank' | 'UPI';
  cashIn: number;
  cashOut: number;
  bankIn: number;
  bankOut: number;
  cashBal: number;
  bankBal: number;
  tdsAmount?: number;
  customerName?: string;
  loanNo?: string;
  date: string;
}

export interface FDPaymentBreakdownItem {
  id: string;
  method: 'Cash' | 'Bank Transfer' | 'UPI';
  amount: number;
  bankName?: string;
  transactionReference?: string;
  upiId?: string;
  paymentDate: string;
  notes?: string;
}

export interface FDPaymentDetails {
  totalReceived: number;
  balanceToReceive: number;
  paymentStatus: 'FULLY_RECEIVED' | 'PARTIALLY_RECEIVED' | 'NOT_RECEIVED';
  payments: FDPaymentBreakdownItem[];
}

export interface FixedDeposit {
  id: string;
  fdNo: string;
  customerId: string;
  depositorName: string;
  phone: string;
  idProofType: string;
  idProofNumber: string;
  idNumber?: string;
  address: string;
  depositDate: string;
  maturityDate: string;
  principal: number;
  remainingPrincipal?: number;
  totalWithdrawnPrincipal?: number;
  tenureMonths?: number;
  interestRatePA: number;
  receivingMethod: 'Cash' | 'Bank' | 'UPI' | 'Bank Transfer' | 'Split' | string;
  paymentDetails?: FDPaymentDetails;
  payoutFrequency?: string;
  monthlyPayout: number;
  status: 'ACTIVE' | 'MATURED' | 'WITHDRAWN';
  parentCustomerName?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  nominee?: NomineeDetails;
  remarks?: string;
  items?: OrnamentItem[];
  photos?: string[];

  // ── IMMUTABLE CONTRACTUAL SNAPSHOT FIELDS ──────────────────────────────
  fdInterestRateSnapshot?: number;
  fdTenureSnapshot?: number;
  calculationMethodSnapshot?: string;
  minimumAmountSnapshot?: number;
  configurationVersion?: number;
}

export interface FDInterestPayout {
  id: string;
  fdId?: string;
  fdNo: string;
  customerId?: string;
  depositorName: string;
  amount: number;
  dueDate?: string;
  date: string;
  periodKey?: string;
  payoutFrequency?: string;
  mode: 'Cash' | 'Bank' | 'UPI' | string;
  status: 'PAID' | 'PENDING';
}

export interface FDWithdrawal {
  id: string;
  withdrawalId?: string;        // Sequential "WD-001" display ID
  receiptNo?: string;           // Sequential "FDR-001" display ID
  receiptId?: string;           // Linked receipt ID
  withdrawalType?: 'PARTIAL' | 'FULL';
  fdId?: string;
  fdNo: string;
  customerId?: string;
  customerPhone?: string;
  depositorName: string;
  originalPrincipal?: number;
  balanceBefore?: number;
  principalAmount: number;
  remainingBalance?: number;
  interestPaid: number;
  totalAmount: number;
  withdrawalDate: string;
  mode: 'Cash' | 'Bank' | 'UPI';
  transactionReference?: string; // UTR / UPI ref
  bankName?: string;
  upiId?: string;
  notes?: string;
  status?: 'COMPLETED' | 'PENDING' | 'CANCELLED';
  processedBy?: string;
  createdAt?: string;
  items?: OrnamentItem[];
  photos?: string[];
}

export interface FDRenewal {
  id: string;                   // Internal unique ID
  renewalId: string;            // Sequential "RN-001" display ID
  fdId?: string;
  fdNo: string;
  customerId: string;
  depositorName: string;
  previousMaturityDate: string;
  newMaturityDate: string;
  renewalPeriodMonths: number;
  renewalDate: string;
  interestRateAtRenewal: number;
  notes?: string;
  status: 'COMPLETED';
}

export interface FDCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  dob?: string;
  occupation?: string;
  notes?: string;
  idProofType: string;
  address?: string;
  documents?: string[];
  photoUrl?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  customerId?: number;
  fullName?: string;
  name: string;
  phoneNumber?: string;
  phone: string;
  phoneNormalized?: string;
  gender: 'Male' | 'Female' | 'Other';
  age?: number;
  dateOfBirth?: string;
  occupation: string;
  email?: string;
  currentAddress: string;
  permanentAddress: string;
  currentAddressDetails?: StructuredAddress;
  permanentAddressDetails?: StructuredAddress;
  customerPhoto?: string | null;
  customerPhotoData?: {
    fileId?: string;
    fileName?: string;
    url: string;
    mimeType?: string;
    fileSize?: number;
    uploadedAt?: string | Date;
    publicId?: string;
  } | null;
  photoSource?: 'upload' | 'webcam' | null;
  currentLocation?: LocationDetails | CustomerLocationData | null;
  permanentLocation?: LocationDetails | CustomerLocationData | null;
  idProofType?: string;
  idProof: string;
  idProofNumber?: string;
  idNumber: string;
  aadhaarNumber?: string;
  panNumber?: string;
  extraPan?: string;
  otherIdName?: string;
  docName?: string;
  kycDocuments?: Array<{
    documentType: string;
    documentNumber?: string;
    documentName?: string;
    fileId?: string;
    fileName?: string;
    url: string;
    mimeType?: string;
    fileSize?: number;
    uploadedAt?: string | Date;
    publicId?: string;
    resourceType?: string;
  }>;

  activeLoansCount: number;

  totalBorrowed: number;
  status: 'VERIFIED' | 'PENDING';
  joinedDate: string;
  location?: CustomerLocationData;
  profilePhotoDriveId?: string | null;
  kycDocumentDriveIds?: string[];
  nominee?: NomineeDetails | null;
  guarantor?: GuarantorDetails | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}


export interface AmountBand {
  id: string;
  condition: 'Below' | 'Above';
  amount: number;
  baseRateMonthly: number;
  penaltyAfterMonths: number;
  penaltyStepUpMonthly: number;
  penaltyCalculation: string;
}

export interface FDRateHistoryItem {
  id: string;
  rate: number;
  previousRate?: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  changedBy: string;
  changedAt: string;
  notes?: string;
}

export interface OverdueEscalationTier {
  id?: string;
  overdueDays: number; // e.g. 0, 90, 180, 270, 360
  rate: number;        // % / month (e.g. 2.00, 2.10, 2.20, 2.30, 2.40)
}

export interface OverdueInterestConfig {
  enabled: boolean;
  baseRate?: number;
  escalationTiers: OverdueEscalationTier[];
}

export interface MasterControlSettings {
  purityOptions?: PurityConfig[];
  goldRate22ct?: number;
  loanTypes?: LoanTypeConfig[];
  repaymentSystems?: RepaymentSystemConfig[];
  goldLoanMonthlyRate: number;
  silverLoanMonthlyRate: number;
  pronoteMonthlyRate: number;
  hirePurchaseMonthlyRate: number;
  defaultCardFee: number;
  overdueInterestRatePA: number;
  overduePenaltyPerDayPercent: number;
  graceDays: number;
  upiId: string;
  upiPayeeName: string;
  upiPaymentEnabled?: boolean;
  loanConfigVersion?: string;
  showOnLoanIssue: boolean;
  hireShowOnLoanIssue?: boolean;
  silverShowOnLoanIssue?: boolean;
  pronoteShowOnLoanIssue?: boolean;
  pronoteRate?: number;
  silverAmountBands?: AmountBand[];
  goldCardFeeEnabled?: boolean;
  goldCardFee?: number;
  silverCardFeeEnabled?: boolean;
  silverCardFee?: number;
  pronoteCardFeeEnabled?: boolean;
  pronoteCardFee?: number;
  hireCardFeeEnabled?: boolean;
  hireCardFee?: number;
  overdueCalculationMethod?: string;
  overdueEscalationEnabled?: boolean;
  overdueBaseRateMonthly?: number;
  overdueEscalationTiers?: OverdueEscalationTier[];
  overdueInterest?: OverdueInterestConfig;
  amountBands: AmountBand[];
  areas: string[];
  partners: string[];
  vehicleDocuments: string[];
  vehicleCompanies: string[];
  insuranceCompanies: string[];
  showrooms: string[];
  lockersEnabled: boolean;
  adminPassword?: string;
  managerPassword?: string;
  operatorPassword?: string;
  animationsEnabled?: boolean;
  performanceModeEnabled?: boolean;
  bulkFdDateChangeEnabled?: boolean;
  configurationVersion?: number;
  fdInterestRate?: number;
  fdInterestRateEffectiveFrom?: string;
  fdInterestRateHistory?: FDRateHistoryItem[];
  fdDefaultTenureMonths?: number;
  fdAllowedTenures?: number[];
  fdMinimumAmount?: number;
  fdMaximumAmount?: number;
  fdPayoutFrequency?: 'Monthly' | 'Quarterly' | 'Annual' | 'At Maturity' | string;
  fdAllowedReceivingMethods?: ('Cash' | 'Bank' | 'UPI' | string)[];
  fdLockinPeriodMonths?: number;
  fdRenewalPolicy?: 'MANUAL' | 'AUTO_RENEW_PRINCIPAL' | 'AUTO_RENEW_ALL' | string;
  fdCalculationMethod?: 'MONTHLY_DIVIDEND' | 'QUARTERLY_COMPOUNDING' | 'CUMULATIVE_AT_MATURITY' | 'SIMPLE' | string;
}

export interface WhatsAppTemplates {
  welcomeMessage: string;
  dueReminderMessage: string;
  receiptMessage: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  isSecured: boolean;
  autoBackupOnOpen: boolean;
  lastBackupDate?: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  browser: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

export type UserRole = 'ADMIN' | 'STAFF' | 'RENTAL_STAFF';

export interface ModuleActionPermissions {
  view?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  approve?: boolean;
  export?: boolean;
  restore?: boolean;
  [key: string]: boolean | undefined;
}

export interface UserPermissions {
  dashboard?: { view?: boolean };
  customers?: { view?: boolean; create?: boolean; update?: boolean; delete?: boolean };
  loans?: { view?: boolean; create?: boolean; update?: boolean; delete?: boolean; approve?: boolean };
  receipts?: { view?: boolean; create?: boolean; update?: boolean; delete?: boolean };
  fd?: { view?: boolean; create?: boolean; update?: boolean; delete?: boolean };
  accounting?: { view?: boolean; create?: boolean; update?: boolean; delete?: boolean };
  rental?: { view?: boolean; create?: boolean; update?: boolean; delete?: boolean; approve?: boolean };
  reports?: { view?: boolean; export?: boolean };
  staffManagement?: { view?: boolean; create?: boolean; update?: boolean; delete?: boolean };
  settings?: { view?: boolean; update?: boolean };
  backupRestore?: { view?: boolean; create?: boolean; restore?: boolean; delete?: boolean };
  [key: string]: any;
}

export interface UserProfile {
  id?: string;
  uid: string;
  staffId?: string;
  email: string;
  displayName: string;
  fullName?: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  department?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  createdByUid?: string;
  createdByEmail?: string;
  permissions: UserPermissions;
}

export interface StaffAuditLog {
  id: string;
  timestamp: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetUid?: string;
  targetEmail?: string;
  details?: string;
  result: 'SUCCESS' | 'FAILED';
}

export interface DeviceSession {
  sessionId: string;
  userId: string;
  userRole: UserRole;
  userEmail?: string;
  deviceType: 'DESKTOP' | 'LAPTOP' | 'MOBILE' | 'TABLET';
  deviceName: string;
  operatingSystem: string;
  osVersion?: string;
  browser: string;
  browserVersion?: string;
  ipAddress?: string;
  location?: string;
  screenResolution?: string;
  timezone?: string;
  createdAt: string;
  lastActiveAt: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'REVOKED';
  isCurrent?: boolean;
}

// ── Notification Center Models ────────────────────────────────────────────────

export type NotificationCategory = 'LOAN' | 'FIXED_DEPOSIT';

export type NotificationEventType =
  | 'UPCOMING'
  | 'DUE'
  | 'OVERDUE'
  | 'PAID'
  | 'MATURITY'
  | 'RENEWAL';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AppNotification {
  id: string; // e.g. "loan_GL-001_due_2026-10", "fd_FD-001_interest_2026-10"
  category: NotificationCategory;
  type: NotificationEventType;
  priority: NotificationPriority;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  entityId: string; // Loan No (e.g. "GL-001") or FD No (e.g. "FD-001")
  entityDbId?: string;
  title: string;
  message: string;
  amount?: number;
  dueDate?: string; // DD-MM-YYYY
  periodKey?: string; // e.g. "2026-10"
  daysOverdue?: number;
  daysRemaining?: number;
  read: boolean;
  actionLabel: string;
  createdAt: string;
}



