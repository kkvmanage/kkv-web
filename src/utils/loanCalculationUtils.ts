import {
  Loan,
  Receipt,
  AmountBand,
  MasterControlSettings,
  CalculationStrategy,
  LoanTypeConfig,
  OverdueEscalationTier
} from '../types';

/**
 * Format a number as Indian Currency string (e.g. ₹1,00,000 or ₹1,500)
 */
export const formatINR = (amount: number | string | undefined | null): string => {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : (typeof amount === 'string' && !isNaN(Number(amount)) ? Number(amount) : 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(num) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

/**
 * Clean currency rounding to 2 decimal places or nearest integer
 */
export const roundCurrency = (amount: number): number => {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

/**
 * Parse a DD-MM-YYYY or YYYY-MM-DD date string into a Date object
 */
export const parseLoanDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      // DD-MM-YYYY
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
  }
  return new Date(dateStr);
};

/**
 * Format a Date object into DD-MM-YYYY
 */
export const formatLoanDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Calculate the next due date (default +1 month from reference date)
 */
export const calculateNextDueDate = (issueDateStr?: string): string => {
  const baseDate = issueDateStr ? parseLoanDate(issueDateStr) : new Date();
  const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, baseDate.getDate());
  return formatLoanDate(nextDate);
};

/**
 * Check whether a loan product is active and visible on Loan Issue
 */
export const isLoanProductVisibleOnIssue = (
  loanType: LoanTypeConfig | { id: string; name?: string; showOnLoanIssue?: boolean; active?: boolean },
  settings?: MasterControlSettings | null
): boolean => {
  if (loanType.active === false) return false;

  if (loanType.showOnLoanIssue !== undefined) {
    return Boolean(loanType.showOnLoanIssue);
  }

  const typeKey = (loanType.name || loanType.id || '').toLowerCase();
  if (typeKey.includes('gold')) {
    if (settings?.showOnLoanIssue !== undefined) return Boolean(settings.showOnLoanIssue);
  } else if (typeKey.includes('silver')) {
    if (settings?.silverShowOnLoanIssue !== undefined) return Boolean(settings.silverShowOnLoanIssue);
  } else if (typeKey.includes('pronote')) {
    if (settings?.pronoteShowOnLoanIssue !== undefined) return Boolean(settings.pronoteShowOnLoanIssue);
  } else if (typeKey.includes('hire') || typeKey.includes('purchase')) {
    if (settings?.hireShowOnLoanIssue !== undefined) return Boolean(settings.hireShowOnLoanIssue);
  }

  return true;
};

/**
 * Filter loan types to those active and configured for display in Loan Issue
 */
export const getActiveLoanTypesForIssue = (
  loanTypes: LoanTypeConfig[] | undefined,
  settings?: MasterControlSettings | null
): LoanTypeConfig[] => {
  const list = loanTypes || settings?.loanTypes || [];
  const filtered = list.filter((lt) => isLoanProductVisibleOnIssue(lt, settings));

  if (filtered.length > 0) return filtered;

  // Safe fallback if all are turned off
  return [
    {
      id: 'gold-loan',
      name: 'Gold Loan',
      active: true,
      showOnLoanIssue: true,
      cardFeeEnabled: true,
      cardFee: 25,
      defaultMonthlyRate: 1.5,
      sortOrder: 1
    }
  ];
};

/**
 * Resolve matching Amount Band for a loan product and principal amount
 */
export const getApplicableInterestBand = (
  principal: number,
  loanTypeNameOrId: string = 'Gold Loan',
  settings?: MasterControlSettings | null
): AmountBand | null => {
  if (!settings || principal <= 0) return null;

  const key = (loanTypeNameOrId || '').toLowerCase().trim();
  let bands: AmountBand[] = [];

  const loanTypeObj = settings.loanTypes?.find(
    (lt) => lt.id.toLowerCase() === key || lt.name.toLowerCase() === key
  );

  // Priority 1: bands stored directly on the loanType object (new canonical schema)
  if (loanTypeObj?.amountBands && loanTypeObj.amountBands.length > 0) {
    bands = loanTypeObj.amountBands;
  } else {
    // Priority 2: legacy flat fields (backward compat)
    if (loanTypeObj?.interestProfileId === 'silver-bands' || (!loanTypeObj?.interestProfileId && key.includes('silver'))) {
      bands = settings.silverAmountBands || [];
    } else if (loanTypeObj?.interestProfileId === 'gold-bands' || (!loanTypeObj?.interestProfileId && (key.includes('gold') || (!key.includes('pronote') && !key.includes('hire'))))) {
      bands = settings.amountBands || [];
    }
  }

  if (!bands || bands.length === 0) return null;

  // Evaluate bands in order
  for (const band of bands) {
    if (band.condition === 'Below' && principal <= band.amount) {
      return band;
    }
    if (band.condition === 'Above' && principal > band.amount) {
      return band;
    }
  }

  // If no exact match found, choose closest boundary
  const sorted = [...bands].sort((a, b) => a.amount - b.amount);
  const fallback = sorted.find((b) => principal <= b.amount) || sorted[sorted.length - 1];
  return fallback || null;
};


/**
 * Get applicable monthly interest rate % based on Master Control configuration
 */
export const getApplicableInterestRate = (
  principal: number,
  loanTypeNameOrId: string = 'Gold Loan',
  settings?: MasterControlSettings | null
): number => {
  const key = (loanTypeNameOrId || '').toLowerCase().trim();
  const matchedLoanType = settings?.loanTypes?.find(
    (lt) => lt.id.toLowerCase() === key || lt.name.toLowerCase() === key
  );

  // 1. Amount Bands Profile — only attempt if the type actually has bands configured
  const usesBandProfile =
    matchedLoanType?.interestProfileId === 'gold-bands' ||
    matchedLoanType?.interestProfileId === 'silver-bands' ||
    (matchedLoanType?.amountBands && matchedLoanType.amountBands.length > 0) ||
    // Legacy: unknown profile and no explicit fixed-rate marker — default to band resolution
    (!matchedLoanType?.interestProfileId && !key.includes('pronote') && !key.includes('hire'));

  if (principal > 0 && usesBandProfile) {
    const matchedBand = getApplicableInterestBand(principal, loanTypeNameOrId, settings);
    if (matchedBand && typeof matchedBand.baseRateMonthly === 'number' && matchedBand.baseRateMonthly > 0) {
      return matchedBand.baseRateMonthly;
    }
  }

  // 2. Explicit Configured Default Monthly Rate on the Loan Type itself
  if (matchedLoanType && typeof matchedLoanType.defaultMonthlyRate === 'number' && matchedLoanType.defaultMonthlyRate > 0) {
    return matchedLoanType.defaultMonthlyRate;
  }

  // 3. Fallback based on product category if loanType rate is undefined
  if (matchedLoanType?.interestProfileId === 'silver-bands' || key.includes('silver')) {
    return settings?.silverLoanMonthlyRate ?? 3.0;
  }
  if (key.includes('pronote') || matchedLoanType?.interestProfileId === 'pronote-interest') {
    return settings?.pronoteMonthlyRate ?? settings?.pronoteRate ?? 4.0;
  }
  if (key.includes('hire') || key.includes('purchase')) {
    return settings?.hirePurchaseMonthlyRate ?? 1.5;
  }

  // Default Gold Loan Master Rate
  return settings?.goldLoanMonthlyRate ?? 2.0;
};


/**
 * Retrieve product-specific card/processing fee configuration
 */
export const getProductCardFeeConfig = (
  loanTypeNameOrId: string = 'Gold Loan',
  settings?: MasterControlSettings | null
): { enabled: boolean; amount: number } => {
  const key = (loanTypeNameOrId || '').toLowerCase().trim();

  // 1. Check canonical loanTypes first
  if (settings?.loanTypes && settings.loanTypes.length > 0) {
    const matched = settings.loanTypes.find(
      (lt) => lt.id.toLowerCase() === key || lt.name.toLowerCase() === key
    );
    if (matched) {
      return {
        enabled: matched.cardFeeEnabled !== undefined ? Boolean(matched.cardFeeEnabled) : true,
        amount: typeof matched.cardFee === 'number' ? matched.cardFee : (settings.defaultCardFee ?? 25)
      };
    }
  }

  // 2. Legacy fallback keys
  if (key.includes('silver')) {
    return {
      enabled: settings?.silverCardFeeEnabled ?? true,
      amount: settings?.silverCardFee ?? settings?.defaultCardFee ?? 30
    };
  }
  if (key.includes('pronote')) {
    return {
      enabled: settings?.pronoteCardFeeEnabled ?? true,
      amount: settings?.pronoteCardFee ?? settings?.defaultCardFee ?? 35
    };
  }
  if (key.includes('hire') || key.includes('purchase')) {
    return {
      enabled: settings?.hireCardFeeEnabled ?? true,
      amount: settings?.hireCardFee ?? settings?.defaultCardFee ?? 40
    };
  }

  // Gold Loan / default
  return {
    enabled: settings?.goldCardFeeEnabled ?? true,
    amount: settings?.goldCardFee ?? settings?.defaultCardFee ?? 25
  };
};

export interface LoanTermsCalculation {
  principal: number;
  interestRate: number; // monthly %
  monthlyInterest: number;
  emiAmount?: number;
  matchingBand: AmountBand | null;
  cardFeeConfig: { enabled: boolean; amount: number };
  effectiveCardFee: number;
  advanceInterestAmount: number;
  netDisbursed: number;
  nextDueDate: string;
  contractSnapshot: {
    interestRate: number;
    interestRateUnit: 'MONTHLY' | 'YEARLY';
    rateSource: 'MASTER_CONTROL' | 'CUSTOM';
    rateEffectiveAt: string;
    loanConfigVersion: string;
    amountBandId?: string;
    amountBandCondition?: 'Below' | 'Above';
    amountBandThreshold?: number;
    penaltyAfterMonths?: number;
    penaltyStepUpMonthly?: number;
    penaltyCalculation?: string;
    cardFee: number;
    cardFeeEnabled: boolean;
  };
}

/**
 * Calculate complete loan financial terms & dynamic preview for Loan Issue
 */
export const calculateLoanTerms = (params: {
  principal: number;
  loanTypeId?: string;
  loanTypeName?: string;
  repaymentStrategy?: CalculationStrategy;
  settings?: MasterControlSettings | null;
  deductAdvanceInterest?: boolean;
  advanceDays?: number;
  customCardFeeEnabled?: boolean;
  customCardFeeAmount?: number;
  issueDate?: string;
}): LoanTermsCalculation => {
  const {
    principal,
    loanTypeId = 'gold-loan',
    loanTypeName = 'Gold Loan',
    repaymentStrategy = 'MONTHLY_INTEREST_ONLY',
    settings,
    deductAdvanceInterest = false,
    advanceDays = 0,
    customCardFeeEnabled,
    customCardFeeAmount,
    issueDate
  } = params;

  const numericPrincipal = typeof principal === 'number' && !isNaN(principal) ? Math.max(0, principal) : 0;
  const matchingBand = getApplicableInterestBand(numericPrincipal, loanTypeName || loanTypeId, settings);
  const interestRate = getApplicableInterestRate(numericPrincipal, loanTypeName || loanTypeId, settings);

  let monthlyInterest = Math.round((numericPrincipal * interestRate) / 100);
  let emiAmount: number | undefined = undefined;

  if (repaymentStrategy === 'EMI' && numericPrincipal > 0) {
    const r = interestRate / 100;
    const n = 12;
    emiAmount = Math.round((numericPrincipal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  }

  const productFeeConfig = getProductCardFeeConfig(loanTypeName || loanTypeId, settings);
  const isCardFeeActive = customCardFeeEnabled !== undefined ? customCardFeeEnabled : productFeeConfig.enabled;
  const cardFeeVal = customCardFeeAmount !== undefined ? customCardFeeAmount : productFeeConfig.amount;
  const effectiveCardFee = isCardFeeActive ? cardFeeVal : 0;

  const advanceInterestAmount = deductAdvanceInterest
    ? Math.round((monthlyInterest / 30) * (advanceDays || 30))
    : 0;

  const netDisbursed = Math.max(0, numericPrincipal - advanceInterestAmount - effectiveCardFee);
  const nextDueDate = calculateNextDueDate(issueDate);

  const contractSnapshot = {
    interestRate,
    interestRateUnit: 'MONTHLY' as const,
    rateSource: 'MASTER_CONTROL' as const,
    rateEffectiveAt: new Date().toISOString(),
    loanConfigVersion: settings?.loanConfigVersion || 'v1',
    amountBandId: matchingBand?.id,
    amountBandCondition: matchingBand?.condition,
    amountBandThreshold: matchingBand?.amount,
    penaltyAfterMonths: matchingBand?.penaltyAfterMonths ?? 3,
    penaltyStepUpMonthly: matchingBand?.penaltyStepUpMonthly ?? 0.1,
    penaltyCalculation: matchingBand?.penaltyCalculation ?? 'From the start — stepped rate over the whole overc',
    cardFee: effectiveCardFee,
    cardFeeEnabled: isCardFeeActive
  };

  return {
    principal: numericPrincipal,
    interestRate,
    monthlyInterest,
    emiAmount,
    matchingBand,
    cardFeeConfig: productFeeConfig,
    effectiveCardFee,
    advanceInterestAmount,
    netDisbursed,
    nextDueDate,
    contractSnapshot
  };
};

export interface OverdueEscalationDetails {
  daysOverdue: number;
  baseRate: number;
  currentRate: number;
  isEscalated: boolean;
  currentTierIndex: number;
  currentTierLabel: string;
  currentTierThreshold: number;
  nextTier: OverdueEscalationTier | null;
  daysUntilNextTier: number | null;
}

export interface OverduePeriodAuditItem {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: string;
  periodEndDate: string;
  daysOverdueAtPeriod: number;
  appliedRateMonthly: number;
  interestAmount: number;
}

/**
 * Centralized Overdue Interest Rate Resolver
 * Determines applicable monthly interest rate based on days overdue and configured escalation tiers.
 */
export const getApplicableOverdueInterestRate = (
  daysOverdue: number,
  baseRate: number = 2.0,
  settings?: MasterControlSettings | null
): number => {
  const safeBaseRate = typeof baseRate === 'number' && !isNaN(baseRate) && baseRate > 0 ? baseRate : (settings?.overdueBaseRateMonthly ?? 2.0);
  if (!settings || daysOverdue <= 0) return safeBaseRate;

  const isEnabled = settings.overdueEscalationEnabled ?? settings.overdueInterest?.enabled ?? false;
  if (!isEnabled) return safeBaseRate;

  const rawTiers = settings.overdueEscalationTiers || settings.overdueInterest?.escalationTiers;
  if (!rawTiers || rawTiers.length === 0) return safeBaseRate;

  const sortedTiers = [...rawTiers]
    .map(t => ({
      overdueDays: Math.max(0, Number(t.overdueDays) || 0),
      rate: Math.max(0, Number(t.rate) || 0)
    }))
    .sort((a, b) => a.overdueDays - b.overdueDays);

  let matchedRate = safeBaseRate;
  for (const tier of sortedTiers) {
    if (daysOverdue >= tier.overdueDays) {
      matchedRate = tier.rate;
    } else {
      break;
    }
  }

  return matchedRate;
};

/**
 * Full details of overdue escalation tier, active rate, and countdown to next escalation
 */
export const getOverdueEscalationDetails = (
  daysOverdue: number,
  baseRate: number = 2.0,
  settings?: MasterControlSettings | null
): OverdueEscalationDetails => {
  const safeBaseRate = typeof baseRate === 'number' && !isNaN(baseRate) && baseRate > 0 ? baseRate : (settings?.overdueBaseRateMonthly ?? 2.0);
  const isEnabled = settings?.overdueEscalationEnabled ?? settings?.overdueInterest?.enabled ?? false;
  const rawTiers = settings?.overdueEscalationTiers || settings?.overdueInterest?.escalationTiers || [];

  const defaultTiers: OverdueEscalationTier[] = [
    { overdueDays: 0, rate: safeBaseRate },
    { overdueDays: 90, rate: roundCurrency(safeBaseRate + 0.1) },
    { overdueDays: 180, rate: roundCurrency(safeBaseRate + 0.2) },
    { overdueDays: 270, rate: roundCurrency(safeBaseRate + 0.3) },
    { overdueDays: 360, rate: roundCurrency(safeBaseRate + 0.4) }
  ];

  const activeTiers = (isEnabled && rawTiers.length > 0 ? rawTiers : defaultTiers)
    .map(t => ({
      overdueDays: Math.max(0, Number(t.overdueDays) || 0),
      rate: Math.max(0, Number(t.rate) || 0)
    }))
    .sort((a, b) => a.overdueDays - b.overdueDays);

  if (!activeTiers.some(t => t.overdueDays === 0)) {
    activeTiers.unshift({ overdueDays: 0, rate: safeBaseRate });
  }

  let currentTierIndex = 0;
  let currentRate = safeBaseRate;
  let currentTierThreshold = 0;

  if (isEnabled && daysOverdue > 0) {
    for (let i = 0; i < activeTiers.length; i++) {
      if (daysOverdue >= activeTiers[i].overdueDays) {
        currentTierIndex = i;
        currentRate = activeTiers[i].rate;
        currentTierThreshold = activeTiers[i].overdueDays;
      } else {
        break;
      }
    }
  }

  const nextTier = (isEnabled && currentTierIndex < activeTiers.length - 1)
    ? activeTiers[currentTierIndex + 1]
    : null;

  const daysUntilNextTier = (nextTier && daysOverdue >= 0)
    ? Math.max(0, nextTier.overdueDays - daysOverdue)
    : null;

  const isEscalated = isEnabled && currentRate > safeBaseRate && daysOverdue > 0;
  const currentTierLabel = currentTierIndex === 0
    ? 'Base Tier (0+ Days)'
    : `Tier ${currentTierIndex} (${currentTierThreshold}+ Days)`;

  return {
    daysOverdue: Math.max(0, daysOverdue),
    baseRate: safeBaseRate,
    currentRate: isEnabled && daysOverdue > 0 ? currentRate : safeBaseRate,
    isEscalated,
    currentTierIndex,
    currentTierLabel,
    currentTierThreshold,
    nextTier,
    daysUntilNextTier
  };
};

/**
 * Non-retroactive multi-period overdue interest calculation.
 * Computes interest period by period where each period uses the rate applicable
 * at that stage of delinquency without retroactive recalculation of earlier periods.
 */
export const calculateNonRetroactiveOverduePeriods = (params: {
  principal: number;
  baseRate: number;
  dueDate: Date;
  asOfDate: Date;
  settings?: MasterControlSettings | null;
}): {
  totalInterest: number;
  periods: OverduePeriodAuditItem[];
  currentApplicableRate: number;
} => {
  const { principal, baseRate, dueDate, asOfDate, settings } = params;
  if (principal <= 0 || asOfDate <= dueDate) {
    const defaultRate = getApplicableOverdueInterestRate(0, baseRate, settings);
    return {
      totalInterest: Math.round((principal * defaultRate) / 100),
      periods: [],
      currentApplicableRate: defaultRate
    };
  }

  const totalDaysDiff = Math.max(0, Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
  const totalMonths = Math.max(1, Math.ceil(totalDaysDiff / 30));

  const periods: OverduePeriodAuditItem[] = [];
  let totalInterest = 0;

  for (let m = 0; m < totalMonths; m++) {
    const periodStartDays = m * 30;
    const periodEndDays = Math.min(totalDaysDiff, (m + 1) * 30);
    const applicableRate = getApplicableOverdueInterestRate(periodStartDays, baseRate, settings);
    const periodInterest = Math.round((principal * applicableRate) / 100);

    const pStartDate = new Date(dueDate.getTime() + periodStartDays * 24 * 60 * 60 * 1000);
    const pEndDate = new Date(dueDate.getTime() + periodEndDays * 24 * 60 * 60 * 1000);

    periods.push({
      periodIndex: m + 1,
      periodLabel: `Month ${m + 1} (${periodStartDays}–${periodEndDays} days overdue)`,
      periodStartDate: formatLoanDate(pStartDate),
      periodEndDate: formatLoanDate(pEndDate),
      daysOverdueAtPeriod: periodStartDays,
      appliedRateMonthly: applicableRate,
      interestAmount: periodInterest
    });

    totalInterest += periodInterest;
  }

  const currentApplicableRate = getApplicableOverdueInterestRate(totalDaysDiff, baseRate, settings);

  return {
    totalInterest,
    periods,
    currentApplicableRate
  };
};

export interface LoanOverdueResult {
  dueDateStr: string;
  outstanding: number;
  baseMonthlyInterest: number;
  interestAlreadyPaid: number;
  remainingInterestDue: number;
  isInterestFullyPaid: boolean;
  daysOverdue: number;
  monthsOverdue: number;
  statusText: 'CLOSED' | 'PAID' | 'PARTIALLY PAID' | 'OVERDUE' | 'DUE TODAY' | 'UPCOMING' | 'NOT DUE';
  penaltyRatePercent: number;
  penaltyAmount: number;
  totalDue: number;
  applicableInterestRate: number;
  escalationDetails: OverdueEscalationDetails;
}

/**
 * Calculate overdue interest, penalty, and total dues for a loan contract
 * Prioritizes the loan's contractual values and applies progressive overdue escalation.
 */
export const calculateLoanOverdueAndDues = (params: {
  loan: Loan;
  asOfDate?: string;
  receipts?: Receipt[];
  settings?: MasterControlSettings | null;
}): LoanOverdueResult => {
  const { loan, asOfDate, receipts = [], settings } = params;

  const outstanding = typeof loan.outstandingPrincipal === 'number'
    ? loan.outstandingPrincipal
    : loan.principal || 0;

  // Use contractual interest rate
  const contractualRate = loan.interestRate || getApplicableInterestRate(loan.principal, loan.loanType || loan.loanTypeName, settings);

  const today = asOfDate ? parseLoanDate(asOfDate) : new Date();

  // Derive due date
  const dueDateStr = loan.nextDueDate || calculateNextDueDate(loan.date);
  const dueDate = parseLoanDate(dueDateStr);

  // Compute interest payments for this period
  const paidReceipts = receipts.filter(
    (r) => r.loanId === loan.id || (r.loanNo && r.loanNo === loan.loanNo)
  );

  const interestAlreadyPaid = paidReceipts.reduce((sum, r) => {
    if (r.kind === 'INTEREST PAYMENT' || r.kind === 'INTEREST + PRINCIPAL' || r.kind === 'PART PAYMENT') {
      return sum + (Number(r.interestComponent) || 0);
    }
    return sum;
  }, 0);

  let daysOverdue = 0;
  let monthsOverdue = 0;
  let statusText: LoanOverdueResult['statusText'] = 'UPCOMING';

  const timeDiff = today.getTime() - dueDate.getTime();
  if (timeDiff > 0) {
    daysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    monthsOverdue = Math.max(1, Math.ceil(daysOverdue / 30));
  }

  // Calculate applicable escalated rate based on days overdue
  const escalationDetails = getOverdueEscalationDetails(daysOverdue, contractualRate, settings);
  const applicableInterestRate = escalationDetails.currentRate;

  // Calculate monthly interest using applicable escalated rate
  const baseMonthlyInterest = Math.round((outstanding * applicableInterestRate) / 100);

  const isInterestFullyPaid: boolean = Boolean(
    interestAlreadyPaid >= baseMonthlyInterest ||
    (loan.lastInterestPaidDate && parseLoanDate(loan.lastInterestPaidDate) >= dueDate)
  );

  const remainingInterestDue = isInterestFullyPaid
    ? 0
    : Math.max(0, baseMonthlyInterest - (interestAlreadyPaid % baseMonthlyInterest));

  if (loan.status === 'CLOSED' || outstanding <= 0) {
    statusText = 'CLOSED';
  } else if (isInterestFullyPaid) {
    statusText = 'PAID';
  } else if (interestAlreadyPaid > 0 && interestAlreadyPaid < baseMonthlyInterest) {
    statusText = 'PARTIALLY PAID';
  } else if (timeDiff > 0) {
    statusText = 'OVERDUE';
  } else if (timeDiff === 0 || formatLoanDate(today) === dueDateStr) {
    statusText = 'DUE TODAY';
  } else {
    statusText = 'NOT DUE';
  }

  // Calculate Penalty based on loan's contractual penalty rules or Master Control
  let penaltyAmount = 0;
  let penaltyRatePercent = 0;

  if (statusText === 'OVERDUE') {
    const penaltyThresholdMonths = loan.penaltyAfterMonths ?? 3;
    const penaltyStepUp = loan.penaltyStepUpMonthly ?? 0.1;
    const graceDays = settings?.graceDays ?? 3;

    if (daysOverdue > graceDays) {
      if (monthsOverdue > penaltyThresholdMonths) {
        // Step-up penalty calculation
        const overdueMonthsBeyondThreshold = monthsOverdue - penaltyThresholdMonths;
        penaltyRatePercent = overdueMonthsBeyondThreshold * penaltyStepUp;
        penaltyAmount = Math.round((remainingInterestDue * penaltyRatePercent) / 100);
      } else {
        // Standard per-day penalty if configured
        const dailyPenaltyRate = settings?.overduePenaltyPerDayPercent ?? 0;
        if (dailyPenaltyRate > 0) {
          penaltyAmount = Math.round((remainingInterestDue * dailyPenaltyRate * daysOverdue) / 100);
          penaltyRatePercent = dailyPenaltyRate * daysOverdue;
        }
      }
    }
  }

  const totalDue = remainingInterestDue + penaltyAmount;

  return {
    dueDateStr,
    outstanding,
    baseMonthlyInterest,
    interestAlreadyPaid,
    remainingInterestDue,
    isInterestFullyPaid,
    daysOverdue,
    monthsOverdue,
    statusText,
    penaltyRatePercent,
    penaltyAmount,
    totalDue,
    applicableInterestRate,
    escalationDetails
  };
};
