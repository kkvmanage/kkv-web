import bcrypt from 'bcrypt';
import { localFileRepository } from '../repositories/localFile.repository.js';
import { MasterControlSettings, WhatsAppTemplates, TelegramConfig } from '../types/index.js';

const SETTINGS_FILE = 'settings.json';
const WA_FILE = 'whatsapp_templates.json';
const TG_FILE = 'telegram_settings.json';

const defaultMasterSettings: MasterControlSettings = {
  loanTypes: [
    {
      id: 'gold-loan',
      name: 'Gold Loan',
      description: 'Standard gold ornament backed financing',
      defaultMonthlyRate: 2.0,
      cardFee: 75,
      cardFeeEnabled: true,
      interestProfileId: 'gold-bands',
      repaymentSystemId: 'monthly-interest-only',
      active: true,
      showOnLoanIssue: true,
      configurationVersion: 1,
      sortOrder: 1
    },
    {
      id: 'silver-loan',
      name: 'Silver Loan',
      description: 'Silver article backed loan',
      defaultMonthlyRate: 3.0,
      cardFee: 60,
      cardFeeEnabled: true,
      interestProfileId: 'silver-bands',
      repaymentSystemId: 'monthly-interest-only',
      active: true,
      showOnLoanIssue: true,
      configurationVersion: 1,
      sortOrder: 2
    },
    {
      id: 'pronote',
      name: 'Pronote',
      description: 'Promissory note unsecured credit',
      defaultMonthlyRate: 4.0,
      cardFee: 50,
      cardFeeEnabled: true,
      interestProfileId: 'pronote-interest',
      repaymentSystemId: 'monthly-interest-only',
      active: true,
      showOnLoanIssue: true,
      configurationVersion: 1,
      sortOrder: 3
    },
    {
      id: 'hire-purchase',
      name: 'Hire Purchase',
      description: 'Vehicle and asset hire purchase financing',
      defaultMonthlyRate: 1.5,
      cardFee: 40,
      cardFeeEnabled: true,
      interestProfileId: 'fixed-rate',
      repaymentSystemId: 'emi',
      active: true,
      showOnLoanIssue: true,
      configurationVersion: 1,
      sortOrder: 4
    }
  ],
  repaymentSystems: [
    { id: 'monthly-interest-only', name: 'Monthly Interest Only', description: 'Monthly interest due; principal remains until closure', calculationStrategy: 'MONTHLY_INTEREST_ONLY', active: true, sortOrder: 1 },
    { id: 'emi', name: 'EMI', description: 'Equated Monthly Installment (Principal + Interest)', calculationStrategy: 'EMI', active: true, sortOrder: 2 },
    { id: 'bullet', name: 'Bullet Repayment', description: 'Lump-sum principal + accrued interest at maturity', calculationStrategy: 'BULLET', active: true, sortOrder: 3 }
  ],
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
    'Hop Electric', 'Komaki'
  ],
  insuranceCompanies: [],
  showrooms: ['Main Branch', 'Bypass Branch'],
  lockersEnabled: false,
  adminPassword: 'admin123',
  managerPassword: 'manager123',
  operatorPassword: 'operator123',
  animationsEnabled: true,
  performanceModeEnabled: false,
  bulkFdDateChangeEnabled: true,
  goldRate22ct: 6400,
  configurationVersion: 1,
  overdueEscalationEnabled: false,
  overdueBaseRateMonthly: 2.0,
  overdueEscalationTiers: [
    { overdueDays: 0, rate: 2.0 },
    { overdueDays: 90, rate: 2.1 },
    { overdueDays: 180, rate: 2.2 },
    { overdueDays: 270, rate: 2.3 },
    { overdueDays: 360, rate: 2.4 }
  ],
  fdInterestRate: 12,
  fdInterestRateEffectiveFrom: '01-08-2026',
  fdDefaultTenureMonths: 12,
  fdAllowedTenures: [6, 12, 24, 36, 60],
  fdMinimumAmount: 5000,
  fdMaximumAmount: 10000000,
  fdPayoutFrequency: 'Monthly',
  fdAllowedReceivingMethods: ['Cash', 'Bank', 'UPI'],
  fdLockinPeriodMonths: 3,
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
  botToken: '',
  chatId: '',
  isSecured: false,
  autoBackupOnOpen: false,
  lastBackupDate: ''
};

export class AdminService {
  public getMasterSettings(): MasterControlSettings {
    const raw = localFileRepository.readJson<MasterControlSettings>(SETTINGS_FILE, defaultMasterSettings);

    // Merge saved loan types with defaults — saved values ALWAYS take priority.
    // Only fill in fields that are explicitly undefined/missing in the saved record.
    // This ensures admin-added or admin-modified loan types survive getMasterSettings() calls.
    const savedLoanTypes = raw.loanTypes && raw.loanTypes.length > 0 ? raw.loanTypes : defaultMasterSettings.loanTypes || [];
    const mergedLoanTypes = savedLoanTypes.map((lt: any) => {
      // Find matching default only for fallback values; do NOT overwrite saved values
      const defaultMatch = defaultMasterSettings.loanTypes?.find((d) => d.id === lt.id);
      return {
        // Provide default fallbacks for fields not present in the saved record
        interestProfileId: defaultMatch?.interestProfileId || 'gold-bands',
        repaymentSystemId: defaultMatch?.repaymentSystemId || 'monthly-interest-only',
        configurationVersion: defaultMatch?.configurationVersion || 1,
        // Spread saved values LAST so they override every default
        ...lt,
        // Ensure required fields have fallback values if still missing
        defaultMonthlyRate: lt.defaultMonthlyRate !== undefined ? lt.defaultMonthlyRate : (defaultMatch?.defaultMonthlyRate ?? 2.0),
        cardFee: lt.cardFee !== undefined ? lt.cardFee : (defaultMatch?.cardFee ?? 50),
        cardFeeEnabled: lt.cardFeeEnabled !== undefined ? lt.cardFeeEnabled : (defaultMatch?.cardFeeEnabled ?? true),
        active: lt.active !== undefined ? lt.active : (defaultMatch?.active ?? true),
        showOnLoanIssue: lt.showOnLoanIssue !== undefined ? lt.showOnLoanIssue : (defaultMatch?.showOnLoanIssue ?? true),
        // Resolve amountBands: use per-loan-type bands, then global bands for known types, then default
        amountBands: lt.amountBands && lt.amountBands.length > 0
          ? lt.amountBands
          : (lt.id === 'gold-loan' && raw.amountBands && raw.amountBands.length > 0)
            ? raw.amountBands
            : (lt.id === 'silver-loan' && raw.silverAmountBands && raw.silverAmountBands.length > 0)
              ? raw.silverAmountBands
              : (defaultMatch?.amountBands ?? undefined)
      };
    });

    const rawTiers = raw.overdueEscalationTiers || (raw as any).overdueInterest?.escalationTiers;
    const resolvedTiers = (rawTiers && rawTiers.length > 0 ? rawTiers : defaultMasterSettings.overdueEscalationTiers || [])
      .map((t: any) => ({
        overdueDays: Math.max(0, Number(t.overdueDays) || 0),
        rate: Math.max(0, Number(t.rate) || 0)
      }))
      .sort((a: any, b: any) => a.overdueDays - b.overdueDays);

    return {
      ...defaultMasterSettings,
      ...raw,
      loanTypes: mergedLoanTypes,
      overdueEscalationEnabled: raw.overdueEscalationEnabled ?? (raw as any).overdueInterest?.enabled ?? defaultMasterSettings.overdueEscalationEnabled ?? false,
      overdueBaseRateMonthly: raw.overdueBaseRateMonthly ?? (raw as any).overdueInterest?.baseRate ?? defaultMasterSettings.overdueBaseRateMonthly ?? 2.0,
      overdueEscalationTiers: resolvedTiers,
      fdAllowedTenures: raw.fdAllowedTenures && raw.fdAllowedTenures.length > 0 ? raw.fdAllowedTenures : defaultMasterSettings.fdAllowedTenures,
      fdAllowedReceivingMethods: raw.fdAllowedReceivingMethods && raw.fdAllowedReceivingMethods.length > 0 ? raw.fdAllowedReceivingMethods : defaultMasterSettings.fdAllowedReceivingMethods,
      fdInterestRateHistory: raw.fdInterestRateHistory && raw.fdInterestRateHistory.length > 0 ? raw.fdInterestRateHistory : defaultMasterSettings.fdInterestRateHistory
    };
  }

  public updateMasterSettings(data: Partial<MasterControlSettings>): MasterControlSettings {
    const current = this.getMasterSettings();

    // Check if financial defaults have been updated
    const isFinancialChanged =
      (data.goldRate22ct !== undefined && data.goldRate22ct !== current.goldRate22ct) ||
      (data.goldLoanMonthlyRate !== undefined && data.goldLoanMonthlyRate !== current.goldLoanMonthlyRate) ||
      (data.silverLoanMonthlyRate !== undefined && data.silverLoanMonthlyRate !== current.silverLoanMonthlyRate) ||
      (data.pronoteMonthlyRate !== undefined && data.pronoteMonthlyRate !== current.pronoteMonthlyRate) ||
      (data.hirePurchaseMonthlyRate !== undefined && data.hirePurchaseMonthlyRate !== current.hirePurchaseMonthlyRate) ||
      (data.defaultCardFee !== undefined && data.defaultCardFee !== current.defaultCardFee) ||
      (data.overdueEscalationEnabled !== undefined && data.overdueEscalationEnabled !== current.overdueEscalationEnabled) ||
      (data.overdueBaseRateMonthly !== undefined && data.overdueBaseRateMonthly !== current.overdueBaseRateMonthly) ||
      (data.overdueEscalationTiers !== undefined) ||
      (data.fdInterestRate !== undefined && data.fdInterestRate !== current.fdInterestRate) ||
      (data.fdDefaultTenureMonths !== undefined && data.fdDefaultTenureMonths !== current.fdDefaultTenureMonths) ||
      (data.fdMinimumAmount !== undefined && data.fdMinimumAmount !== current.fdMinimumAmount) ||
      (data.fdMaximumAmount !== undefined && data.fdMaximumAmount !== current.fdMaximumAmount) ||
      (data.fdRenewalPolicy !== undefined && data.fdRenewalPolicy !== current.fdRenewalPolicy) ||
      (data.fdCalculationMethod !== undefined && data.fdCalculationMethod !== current.fdCalculationMethod) ||
      (data.fdPayoutFrequency !== undefined && data.fdPayoutFrequency !== current.fdPayoutFrequency);

    const nextVersion = isFinancialChanged
      ? (current.configurationVersion || 1) + 1
      : (data.configurationVersion || current.configurationVersion || 1);

    // Track FD Interest Rate change history
    let updatedHistory = data.fdInterestRateHistory || current.fdInterestRateHistory || [];
    if (data.fdInterestRate !== undefined && data.fdInterestRate !== current.fdInterestRate) {
      const historyItem = {
        id: `FD-RATE-${Date.now()}`,
        rate: Number(data.fdInterestRate),
        previousRate: current.fdInterestRate,
        effectiveFrom: data.fdInterestRateEffectiveFrom || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        changedBy: (data as any).changedBy || 'Master Admin',
        changedAt: new Date().toISOString(),
        notes: (data as any).notes || `Updated Master FD interest rate from ${current.fdInterestRate}% to ${data.fdInterestRate}% p.a.`
      };
      updatedHistory = [historyItem, ...updatedHistory];
    }

    // Process & sort Overdue Escalation Tiers if updated
    let cleanedTiers = current.overdueEscalationTiers;
    const inputTiers = data.overdueEscalationTiers || data.overdueInterest?.escalationTiers;
    if (inputTiers && Array.isArray(inputTiers)) {
      const tierMap = new Map<number, number>();
      for (const t of inputTiers) {
        const days = Math.max(0, Math.floor(Number(t.overdueDays) || 0));
        const rate = Math.max(0, Number(t.rate) || 0);
        tierMap.set(days, rate);
      }
      // Ensure tier at 0 days exists
      if (!tierMap.has(0)) {
        const base = Number(data.overdueBaseRateMonthly ?? current.overdueBaseRateMonthly ?? 2.0);
        tierMap.set(0, base);
      }
      cleanedTiers = Array.from(tierMap.entries())
        .map(([overdueDays, rate]) => ({ overdueDays, rate }))
        .sort((a, b) => a.overdueDays - b.overdueDays);
    }

    // Handle password hashing if adminPassword was explicitly passed
    let adminPassword = current.adminPassword;
    if (data.adminPassword && data.adminPassword.trim() !== '') {
      if (data.adminPassword.startsWith('$2a$') || data.adminPassword.startsWith('$2b$') || data.adminPassword.startsWith('$2y$')) {
        adminPassword = data.adminPassword;
      } else {
        adminPassword = bcrypt.hashSync(data.adminPassword.trim(), 10);
      }
    }

    const updated: MasterControlSettings = {
      ...current,
      ...data,
      overdueEscalationTiers: cleanedTiers,
      adminPassword,
      fdInterestRateHistory: updatedHistory,
      configurationVersion: nextVersion
    };

    localFileRepository.writeJson(SETTINGS_FILE, updated);
    return updated;
  }

  public getWhatsAppTemplates(): WhatsAppTemplates {
    return localFileRepository.readJson<WhatsAppTemplates>(WA_FILE, defaultWhatsAppTemplates);
  }

  public updateWhatsAppTemplates(data: Partial<WhatsAppTemplates>): WhatsAppTemplates {
    const current = this.getWhatsAppTemplates();
    const updated = { ...current, ...data };
    localFileRepository.writeJson(WA_FILE, updated);
    return updated;
  }

  public getTelegramConfig(): TelegramConfig {
    return localFileRepository.readJson<TelegramConfig>(TG_FILE, defaultTelegramConfig);
  }

  public updateTelegramConfig(data: Partial<TelegramConfig>): TelegramConfig {
    const current = this.getTelegramConfig();
    const updated = { ...current, ...data };
    localFileRepository.writeJson(TG_FILE, updated);
    return updated;
  }

  public verifyPassword(password: string, storedHashOrPlain?: string): boolean {
    if (!password) return false;
    if (!storedHashOrPlain) {
      // Default to bcrypt hash of 'admin123' if not set
      return password === 'admin123';
    }
    if (storedHashOrPlain.startsWith('$2a$') || storedHashOrPlain.startsWith('$2b$') || storedHashOrPlain.startsWith('$2y$')) {
      try {
        return bcrypt.compareSync(password, storedHashOrPlain);
      } catch (err) {
        console.error('[AdminService] bcrypt compare error:', err);
        return false;
      }
    }
    // Legacy plaintext comparison
    return password === storedHashOrPlain;
  }

  public changeMasterPassword(currentPassword: string, newPassword: string): { success: boolean; message?: string } {
    if (!currentPassword || !newPassword) {
      return { success: false, message: 'Both current password and new password are required.' };
    }
    if (newPassword.trim().length < 4) {
      return { success: false, message: 'New password must be at least 4 characters long.' };
    }

    const current = this.getMasterSettings();
    const isValid = this.verifyPassword(currentPassword, current.adminPassword);
    if (!isValid) {
      return { success: false, message: 'Current password does not match.' };
    }

    const hashed = bcrypt.hashSync(newPassword.trim(), 10);
    const updated: MasterControlSettings = {
      ...current,
      adminPassword: hashed
    };

    localFileRepository.writeJson(SETTINGS_FILE, updated);
    return { success: true, message: 'Master Control password updated successfully.' };
  }

  public unlockMasterControl(password: string): boolean {
    if (!password) return false;
    const settings = this.getMasterSettings();
    return this.verifyPassword(password, settings.adminPassword);
  }

  public getSettings(): MasterControlSettings {
    return this.getMasterSettings();
  }

  public getLoanTypeConfigs(): any[] {
    return this.getMasterSettings().loanTypes || [];
  }

  public resolveEffectiveRateForAmount(loanTypeId: string, amount: number): { rate: number; profileName: string; bandId?: string } {
    const settings = this.getMasterSettings();
    const type = (settings.loanTypes || []).find((t: any) => t.id === loanTypeId);
    if (!type) {
      return { rate: settings.goldLoanMonthlyRate ?? 1.5, profileName: 'Gold Loan Profile' };
    }

    if (type.amountBands && type.amountBands.length > 0) {
      for (const band of type.amountBands) {
        if (band.condition === 'Below' && amount < band.amount) {
          return { rate: band.baseRateMonthly, profileName: type.name, bandId: band.id };
        }
        if (band.condition === 'Above' && amount >= band.amount) {
          return { rate: band.baseRateMonthly, profileName: type.name, bandId: band.id };
        }
      }
    }

    return { rate: type.defaultMonthlyRate || 2.0, profileName: type.name };
  }
}

export const adminService = new AdminService();
