import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { telegramRepository } from '../telegram/telegram.repository.js';
import { Loan, Receipt, LoanTypeConfig } from '../types/index.js';
import { customerService } from './customer.service.js';
import { receiptService } from './receipt.service.js';
import { accountingService } from './accounting.service.js';
import { adminService } from './admin.service.js';
import { counterService } from './counter.service.js';
import { googleDriveService } from './googleDrive.service.js';
import { FileAttachmentModel } from '../models/FileAttachment.js';

const parseLoanDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date();
  const clean = dateStr.trim();
  const separator = clean.includes('-') ? '-' : clean.includes('/') ? '/' : null;
  if (separator) {
    const parts = clean.split(separator);
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      // DD-MM-YYYY
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
  }
  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatLoanDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const addMonthsToLoanDate = (baseDate: Date, monthsToAdd: number): Date => {
  const origDay = baseDate.getDate();
  const origMonth = baseDate.getMonth();
  const origYear = baseDate.getFullYear();

  const totalMonths = origMonth + monthsToAdd;
  const targetYear = origYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(origDay, maxDaysInTargetMonth);

  return new Date(targetYear, targetMonth, targetDay);
};

const calculateAuthoritativeNextDueDate = (
  issueDateStr?: string,
  deductAdvanceInterest?: boolean,
  advanceDays?: number
): string => {
  const baseDate = parseLoanDate(issueDateStr);
  const monthsToAdd = deductAdvanceInterest && (advanceDays || 0) > 0 ? 2 : 1;
  const nextDueDate = addMonthsToLoanDate(baseDate, monthsToAdd);
  return formatLoanDate(nextDueDate);
};

export class LoanService {
  public async getAllAsync(includeDeleted: boolean = false): Promise<Loan[]> {
    return this.getAll(includeDeleted);
  }

  public getAll(includeDeleted: boolean = false): Loan[] {
    return telegramRepository.getRecords<Loan>('LOAN', { includeDeleted });
  }

  public async getByIdAsync(id: string): Promise<Loan | null> {
    return this.getById(id);
  }

  public getById(id: string): Loan | null {
    const loans = this.getAll(true);
    return loans.find((l) => l.id === id || l.loanNo.toLowerCase() === id.toLowerCase()) || null;
  }

  public async getByLoanNoAsync(loanNo: string): Promise<Loan | null> {
    return this.getByIdAsync(loanNo);
  }

  public getByLoanNo(loanNo: string): Loan | null {
    return this.getById(loanNo);
  }

  public calculateFinancials(principal: number, interestRatePercent: number, items: any[], manualMarketValue?: number) {
    const decPrincipal = new Decimal(principal || 0);
    const decRate = new Decimal(interestRatePercent || 0);

    const monthlyInterest = decPrincipal.times(decRate).dividedBy(100).toDecimalPlaces(2).toNumber();

    let totalGross = new Decimal(0);
    let totalDeduction = new Decimal(0);
    let totalNet = new Decimal(0);

    if (!Array.isArray(items) || items.length === 0) {
      const err: any = new Error('At least one ornament item is required.');
      err.code = 'INVALID_ORNAMENTS';
      throw err;
    }

    const normalizedItems = (items || []).map((it, idx) => {
      const rawQty = it.qty;
      const qtyNum = Number(rawQty);

      if (!Number.isInteger(qtyNum) || qtyNum < 1) {
        const err: any = new Error('Quantity must be a whole number greater than or equal to 1');
        err.code = 'INVALID_QUANTITY';
        throw err;
      }

      const grossVal = Math.round((Number(it.grossWeight) || 0) * 1000) / 1000;
      const deductionVal = Math.round((Number(it.deductionWeight) || 0) * 1000) / 1000;

      if (grossVal < 0 || deductionVal < 0) {
        const err: any = new Error(`Weight values cannot be negative for item ${it.item || idx + 1}.`);
        err.code = 'INVALID_WEIGHT';
        throw err;
      }

      if (deductionVal > grossVal) {
        const err: any = new Error(
          `Deduction weight (${deductionVal.toFixed(3)}g) cannot be greater than gross weight (${grossVal.toFixed(3)}g) for item ${it.item || idx + 1}.`
        );
        err.code = 'INVALID_WEIGHT';
        throw err;
      }

      const netVal = Math.max(0, Math.round((grossVal - deductionVal) * 1000) / 1000);

      totalGross = totalGross.plus(new Decimal(grossVal));
      totalDeduction = totalDeduction.plus(new Decimal(deductionVal));
      totalNet = totalNet.plus(new Decimal(netVal));

      return {
        ...it,
        id: it.id || `item_${idx + 1}_${Date.now()}`,
        qty: qtyNum,
        grossWeight: grossVal,
        deductionWeight: deductionVal,
        netWeight: netVal
      };
    });

    const settings = adminService.getSettings();
    const goldRate = Number(settings.goldRate22ct || (settings as any).goldRate22k || 5500);

    const calculatedMarketValue = totalNet.times(goldRate).toDecimalPlaces(2).toNumber();
    const finalMarketValue = (manualMarketValue !== undefined && manualMarketValue !== null && manualMarketValue > 0)
      ? manualMarketValue
      : calculatedMarketValue;

    const ltv = finalMarketValue > 0
      ? decPrincipal.dividedBy(finalMarketValue).times(100).toDecimalPlaces(2).toNumber()
      : 0;

    return {
      monthlyInterest,
      totalGrossWeight: totalGross.toDecimalPlaces(3).toNumber(),
      totalDeductionWeight: totalDeduction.toDecimalPlaces(3).toNumber(),
      totalNetWeight: totalNet.toDecimalPlaces(3).toNumber(),
      marketValue: finalMarketValue,
      ltv,
      normalizedItems
    };
  }

  public async create(loanData: Omit<Loan, 'id' | 'loanNo' | 'receiptBillNo' | 'outstandingPrincipal' | 'accruedInterest' | 'status'>, actor?: any): Promise<Loan> {
    const seq = await counterService.getNextLoanSequence();
    const loanNo = `GL-${seq}`;
    const id = loanNo;

    const effectivePrincipal = Number(loanData.principal);
    if (!effectivePrincipal || effectivePrincipal <= 0) {
      const err: any = new Error('Principal amount must be greater than zero.');
      err.code = 'INVALID_PRINCIPAL';
      throw err;
    }

    const activeConfigs = adminService.getLoanTypeConfigs();
    let matchedType: any = undefined;

    if (loanData.loanTypeId) {
      matchedType = activeConfigs.find((c: any) => c.id === loanData.loanTypeId);
    }
    if (!matchedType && loanData.loanType) {
      matchedType = activeConfigs.find((c: any) => (c.name || '').toLowerCase() === loanData.loanType.toLowerCase());
    }
    if (!matchedType && activeConfigs.length > 0) {
      matchedType = activeConfigs[0];
    }

    const settings = adminService.getSettings();
    const isTransactionCardFeeEnabled = loanData.cardFeeEnabled !== undefined
      ? Boolean(loanData.cardFeeEnabled)
      : ((settings as any).goldCardFeeEnabled !== false && (settings as any).cardFeeEnabled !== false);

    const serverCardFeeAmount = typeof (settings as any).goldCardFee === 'number'
      ? (settings as any).goldCardFee
      : (typeof settings.defaultCardFee === 'number' ? settings.defaultCardFee : 25);
    const effectiveCardFee = isTransactionCardFeeEnabled
      ? (typeof loanData.cardFee === 'number' ? loanData.cardFee : serverCardFeeAmount)
      : 0;

    let interestRate = Number(loanData.interestRate);
    let interestProfileName = 'Gold Loan Profile';
    let configVersion = 1;
    let amountBandId: string | undefined = undefined;

    if (matchedType) {
      configVersion = matchedType.version || matchedType.configurationVersion || 1;
      const rateConfig = adminService.resolveEffectiveRateForAmount(matchedType.id, effectivePrincipal);
      interestRate = rateConfig.rate;
      interestProfileName = rateConfig.profileName;
      amountBandId = rateConfig.bandId;
    }

    const calc = this.calculateFinancials(
      effectivePrincipal,
      interestRate,
      loanData.items,
      loanData.marketValue
    );

    let normalizedNominee: any = undefined;
    const isNomineeEnabled = loanData.nominee?.hasNominee || loanData.nominee?.enabled;
    if (isNomineeEnabled && loanData.nominee) {
      const nom = loanData.nominee;
      const fullName = (nom.fullName || nom.name || '').trim();
      const relation = (nom.relation || nom.relationship || '').trim();
      const mobile = (nom.mobile || nom.phone || '').replace(/\D/g, '');
      const aadhaarDigits = (nom.aadhaarNumber || nom.idProof || '').replace(/\D/g, '');
      const panUpper = (nom.panNumber || '').trim().toUpperCase();

      normalizedNominee = {
        hasNominee: true,
        enabled: true,
        name: fullName,
        fullName,
        relation,
        relationship: relation,
        phone: mobile,
        mobile,
        aadhaarNumber: aadhaarDigits,
        panNumber: panUpper || undefined,
        address: nom.address || ''
      };
    }

    let normalizedGuarantor: any = undefined;
    const isGuarantorEnabled = loanData.guarantor?.hasGuarantor || loanData.guarantor?.enabled;
    if (isGuarantorEnabled && loanData.guarantor) {
      const guar = loanData.guarantor;
      const fullName = (guar.fullName || guar.name || '').trim();
      const relation = (guar.relation || guar.relationship || '').trim();
      const mobile = (guar.mobile || guar.phone || '').replace(/\D/g, '');
      const aadhaarDigits = (guar.aadhaarNumber || guar.idProof || '').replace(/\D/g, '');
      const panUpper = (guar.panNumber || '').trim().toUpperCase();

      normalizedGuarantor = {
        hasGuarantor: true,
        enabled: true,
        name: fullName,
        fullName,
        relation,
        relationship: relation,
        phone: mobile,
        mobile,
        aadhaarNumber: aadhaarDigits,
        panNumber: panUpper || undefined,
        address: guar.address || guar.currentAddress || ''
      };
    }

    const effectiveIssueDateStr = loanData.date || formatLoanDate(new Date());
    const baseIssueDate = parseLoanDate(effectiveIssueDateStr);
    const effectiveAdvanceDays = loanData.advanceDays || (loanData.deductAdvanceInterest ? 30 : 0);
    const hasAdvance = Boolean(loanData.deductAdvanceInterest && effectiveAdvanceDays > 0);
    const monthsCovered = hasAdvance ? Math.max(1, Math.round(effectiveAdvanceDays / 30)) : 0;

    const authoritativeNextDueDate = loanData.nextDueDate && loanData.nextDueDate.trim().length > 0
      ? loanData.nextDueDate
      : calculateAuthoritativeNextDueDate(effectiveIssueDateStr, loanData.deductAdvanceInterest, effectiveAdvanceDays);

    const coveredInterestStartDate = hasAdvance ? formatLoanDate(baseIssueDate) : undefined;
    const coveredInterestEndDate = hasAdvance ? formatLoanDate(addMonthsToLoanDate(baseIssueDate, monthsCovered)) : undefined;

    const authoritativeLastInterestPaidDate = hasAdvance
      ? (coveredInterestEndDate || formatLoanDate(baseIssueDate))
      : formatLoanDate(baseIssueDate);

    const advanceInterest = hasAdvance
      ? (loanData.advanceInterestAmount || Math.round(((calc.monthlyInterest || 0) / 30) * effectiveAdvanceDays))
      : 0;
    const netDisbursed = new Decimal(effectivePrincipal).minus(advanceInterest).minus(effectiveCardFee).toNumber();

    const newLoan: Loan = {
      ...loanData,
      photos: loanData.photos || [],
      principal: effectivePrincipal,
      id,
      loanNo,
      receiptBillNo: seq,
      loanType: matchedType ? matchedType.name : loanData.loanType,
      loanTypeId: matchedType ? matchedType.id : (loanData.loanTypeId || 'gold-loan'),
      loanTypeName: matchedType ? matchedType.name : (loanData.loanTypeName || loanData.loanType),
      nominee: normalizedNominee,
      guarantor: normalizedGuarantor,

      nomineeName: normalizedNominee?.name,
      nomineeRelation: normalizedNominee?.relation,
      nomineePhone: normalizedNominee?.phone,
      nomineeAadhaar: normalizedNominee?.aadhaarNumber,
      nomineePan: normalizedNominee?.panNumber,
      guarantorName: normalizedGuarantor?.name,
      guarantorRelation: normalizedGuarantor?.relation,
      guarantorPhone: normalizedGuarantor?.phone,
      guarantorAadhaar: normalizedGuarantor?.aadhaarNumber,
      guarantorPan: normalizedGuarantor?.panNumber,
      loanTypeNameSnapshot: matchedType ? matchedType.name : loanData.loanType,
      interestRateSnapshot: interestRate,
      interestProfileSnapshot: interestProfileName,
      cardFeeSnapshot: serverCardFeeAmount,
      interestProfileIdSnapshot: matchedType?.interestProfileId || 'gold-bands',
      interestProfileNameSnapshot: interestProfileName,
      interestConfigurationSnapshot: {
        interestRate,
        interestRateUnit: 'MONTHLY',
        rateSource: 'MASTER_CONTROL',
        amountBandId
      },
      configurationVersion: configVersion,
      configurationSource: matchedType && matchedType.useMasterDefaults !== false ? 'MASTER_INHERITED' : 'CUSTOM_OVERRIDE',
      rateEffectiveAt: loanData.date || new Date().toISOString(),

      interestRate,
      cardFee: effectiveCardFee,
      cardFeeEnabled: isTransactionCardFeeEnabled,
      cardFeePaymentMode: isTransactionCardFeeEnabled ? (loanData.cardFeePaymentMode || 'Cash') : 'Cash',
      cardFeeBankMode: isTransactionCardFeeEnabled && loanData.cardFeePaymentMode === 'Bank' ? loanData.cardFeeBankMode : undefined,
      items: calc.normalizedItems,
      monthlyInterest: calc.monthlyInterest,
      totalGrossWeight: calc.totalGrossWeight,
      totalDeductionWeight: calc.totalDeductionWeight,
      totalNetWeight: calc.totalNetWeight,
      marketValue: calc.marketValue,
      ltv: calc.ltv,
      disbursedAmount: netDisbursed,
      netDisbursed,
      outstandingPrincipal: effectivePrincipal,
      accruedInterest: calc.monthlyInterest,
      status: 'ACTIVE',
      date: formatLoanDate(baseIssueDate),
      coveredInterestStartDate,
      coveredInterestEndDate,
      advanceInterestCollectedAt: hasAdvance ? new Date().toISOString() : undefined,
      lastInterestPaidDate: authoritativeLastInterestPaidDate,
      nextDueDate: authoritativeNextDueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Persist to Telegram
    await telegramRepository.createRecord('LOAN', newLoan.id, newLoan, actor);

    // Update customer active loans count
    const customer = customerService.getById(newLoan.customerId);
    if (customer) {
      await customerService.update(customer.id, {
        activeLoansCount: (customer.activeLoansCount || 0) + 1,
        totalBorrowed: new Decimal(customer.totalBorrowed || 0).plus(effectivePrincipal).toNumber()
      });
    }

    // Create New Loan Receipt
    try {
      await receiptService.create({
        receiptNo: seq,
        loanId: newLoan.id,
        loanNo: newLoan.loanNo,
        customerId: newLoan.customerId,
        customerName: newLoan.customerName,
        kind: 'NEW LOAN',
        loanType: newLoan.loanType,
        amount: effectivePrincipal,
        principalComponent: effectivePrincipal,
        interestComponent: 0,
        paymentMode: newLoan.bankMode === 'Cash' ? 'Cash' : 'UPI',
        date: newLoan.date || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        notes: 'New Loan Disbursement'
      });
    } catch (e) {
      console.warn('[LoanService] Receipt creation note:', e);
    }

    // Create DayBook Entry
    try {
      const isCash = newLoan.bankMode === 'Cash';
      const isSplit = newLoan.bankMode === 'Split';
      const actualDisbursed = newLoan.netDisbursed !== undefined ? newLoan.netDisbursed : effectivePrincipal;
      const cashDisbursed = isCash ? actualDisbursed : isSplit ? (newLoan.cashAmount || 0) : 0;
      const bankDisbursed = isCash ? 0 : isSplit ? (newLoan.bankAmount || 0) : actualDisbursed;

      await accountingService.addEntryAsync({
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        billNo: String(seq),
        particulars: `Loan Disbursement (${loanNo}) - ${newLoan.customerName}`,
        accountHead: 'Gold Loan Portfolio',
        mode: isCash ? 'Cash' : newLoan.bankMode === 'UPI' ? 'UPI' : 'Bank',
        cashIn: 0,
        cashOut: cashDisbursed,
        bankIn: 0,
        bankOut: bankDisbursed,
        customerName: newLoan.customerName,
        loanNo,
        date: newLoan.date || new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
      });

      if (effectiveCardFee > 0) {
        const isFeeBank = newLoan.cardFeePaymentMode === 'Bank';
        const feeMode: 'Cash' | 'UPI' | 'Bank' = isFeeBank
          ? (newLoan.cardFeeBankMode === 'UPI' ? 'UPI' : 'Bank')
          : 'Cash';

        await accountingService.addEntryAsync({
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          billNo: String(seq),
          particulars: `Card Processing Fee (${loanNo}) - ${newLoan.customerName}`,
          accountHead: 'Processing Fees',
          mode: feeMode,
          cashIn: isFeeBank ? 0 : effectiveCardFee,
          cashOut: 0,
          bankIn: isFeeBank ? effectiveCardFee : 0,
          bankOut: 0,
          customerName: newLoan.customerName,
          loanNo,
          date: newLoan.date || new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
        });
      }
    } catch (e) {
      console.warn('[LoanService] Accounting entry note:', e);
    }

    return newLoan;
  }

  public async closeLoanAsync(loanNo: string): Promise<Loan | null> {
    const loan = this.getById(loanNo);
    if (!loan) return null;

    const updated = await telegramRepository.updateRecord<Loan>('LOAN', loan.id, {
      outstandingPrincipal: 0,
      status: 'CLOSED',
      updatedAt: new Date().toISOString()
    });

    return updated.data;
  }

  public closeLoan(loanNo: string): Loan | null {
    const loan = this.getById(loanNo);
    if (!loan) return null;

    telegramRepository.updateRecord<Loan>('LOAN', loan.id, {
      outstandingPrincipal: 0,
      status: 'CLOSED',
      updatedAt: new Date().toISOString()
    }).catch(() => {});

    return { ...loan, outstandingPrincipal: 0, status: 'CLOSED' };
  }

  public async updateAsync(id: string, updates: Partial<Loan>): Promise<Loan | null> {
    const loan = this.getById(id);
    if (!loan) return null;

    const updated = await telegramRepository.updateRecord<Loan>('LOAN', loan.id, updates);
    return updated.data;
  }

  public update(id: string, updates: Partial<Loan>): Loan | null {
    const loan = this.getById(id);
    if (!loan) return null;

    telegramRepository.updateRecord<Loan>('LOAN', loan.id, updates).catch(() => {});
    return { ...loan, ...updates };
  }

  public async deleteAsync(id: string): Promise<boolean> {
    const loan = this.getById(id);
    if (!loan) return false;

    const res = await telegramRepository.deleteRecord('LOAN', loan.id, false);
    return res.success;
  }

  public delete(id: string): boolean {
    const loan = this.getById(id);
    if (!loan) return false;

    telegramRepository.deleteRecord('LOAN', loan.id, false).catch(() => {});
    return true;
  }

  public async getPendingLoansAsync(customerId?: string, asOfDateStr?: string): Promise<{ loan: Loan; metrics: any }[]> {
    const allLoans = await this.getAllAsync();
    const allReceipts = await receiptService.getAllAsync();

    const asOfDate = asOfDateStr ? parseLoanDate(asOfDateStr) : new Date();
    const todayMidnight = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());

    const result: { loan: Loan; metrics: any }[] = [];

    for (const loan of allLoans) {
      if (loan.isDeleted || loan.status === 'CLOSED') continue;
      const outstanding = Number(loan.outstandingPrincipal ?? loan.principal ?? 0);
      if (outstanding <= 0) continue;

      if (customerId) {
        const cId = (loan.customerId || '').trim().toLowerCase();
        const targetId = customerId.trim().toLowerCase();
        if (cId !== targetId && (loan as any).id !== targetId) continue;
      }

      let rawDueDate = loan.nextDueDate;
      if (!rawDueDate) {
        rawDueDate = calculateAuthoritativeNextDueDate(
          loan.date || (loan as any).issueDate,
          loan.deductAdvanceInterest,
          loan.advanceDays ?? (loan as any).advanceInterestDays ?? 0
        );
      }
      const dueDate = parseLoanDate(rawDueDate);
      const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

      const monthlyRate = Number(loan.interestRate ?? 0) / 100;
      const monthlyInterest = Math.round(outstanding * monthlyRate);
      const scheduledDue = monthlyInterest > 0 ? monthlyInterest : 0;

      const loanReceipts = allReceipts.filter(
        (r) =>
          (r.loanNo === loan.loanNo || r.loanId === loan.id || r.loanId === loan.loanNo) &&
          (r.kind === 'INTEREST PAYMENT' ||
            (r.kind as string) === 'INTEREST + PRINCIPAL' ||
            r.kind === 'PART PAYMENT' ||
            r.kind === 'REPAYMENT' ||
            r.kind === 'LOAN CLOSURE')
      );

      const relevantReceipts = loanReceipts.filter((r) => {
        if (!r.date) return false;
        const rDate = parseLoanDate(r.date);
        const rDateMidnight = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate());

        if (loan.lastInterestPaidDate) {
          const lastPaid = parseLoanDate(loan.lastInterestPaidDate);
          const lastPaidMidnight = new Date(lastPaid.getFullYear(), lastPaid.getMonth(), lastPaid.getDate());
          if (rDateMidnight <= lastPaidMidnight) return false;
        }

        if (r.currentDueDate) {
          const rDueDate = parseLoanDate(r.currentDueDate);
          return (
            rDueDate.getFullYear() === dueDate.getFullYear() &&
            rDueDate.getMonth() === dueDate.getMonth() &&
            rDueDate.getDate() === dueDate.getDate()
          );
        }

        return true;
      });

      const periodPaidAmount = relevantReceipts.reduce((sum, r) => {
        const intComp = Number(r.interestComponent ?? 0);
        const amt = Number(r.amount ?? 0);
        return sum + (intComp > 0 ? intComp : amt > 0 && r.kind === 'INTEREST PAYMENT' ? amt : 0);
      }, 0);

      const remainingDue = Math.max(0, scheduledDue - periodPaidAmount);
      const isDue = todayMidnight.getTime() >= dueDateMidnight.getTime();
      const isPending = isDue && remainingDue > 0;

      if (isPending) {
        const diffDays = Math.max(0, Math.floor((todayMidnight.getTime() - dueDateMidnight.getTime()) / (1000 * 60 * 60 * 24)));
        const statusText = diffDays > 0 ? 'OVERDUE' : periodPaidAmount > 0 ? 'PARTIALLY PAID' : 'DUE TODAY';
        result.push({
          loan,
          metrics: {
            dueDate: formatLoanDate(dueDate),
            scheduledDue,
            paidAmount: periodPaidAmount,
            remainingDue,
            daysOverdue: diffDays,
            statusText
          }
        });
      }
    }

    return result;
  }
}

export const loanService = new LoanService();
export default loanService;
