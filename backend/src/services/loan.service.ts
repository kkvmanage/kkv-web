import Decimal from 'decimal.js';
import { localFileRepository } from '../repositories/localFile.repository.js';
import { syncQueueService } from './syncQueue.service.js';
import { Loan, Receipt, LoanTypeConfig } from '../types/index.js';
import { customerService } from './customer.service.js';
import { receiptService } from './receipt.service.js';
import { accountingService } from './accounting.service.js';
import { adminService } from './admin.service.js';

import { counterService } from './counter.service.js';

const FILE_NAME = 'loans.json';

const initialLoans: Loan[] = [];

export class LoanService {
  public getAll(): Loan[] {
    let list = localFileRepository.readJson<Loan[]>(FILE_NAME, initialLoans);
    if (!Array.isArray(list)) {
      list = [];
    }
    return list;
  }

  public getById(id: string): Loan | null {
    const loans = this.getAll();
    return loans.find((l) => l.id === id || l.loanNo.toLowerCase() === id.toLowerCase()) || null;
  }

  public getByLoanNo(loanNo: string): Loan | null {
    const loans = this.getAll();
    return loans.find((l) => l.loanNo.toLowerCase() === loanNo.toLowerCase()) || null;
  }

  public calculateFinancials(principal: number, interestRatePercent: number, items: any[], manualMarketValue?: number) {
    const decPrincipal = new Decimal(principal || 0);
    const decRate = new Decimal(interestRatePercent || 0);

    // Monthly interest = (Principal * InterestRatePercent) / 100
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
        qty: qtyNum,
        grossWeight: grossVal,
        deductionWeight: deductionVal,
        netWeight: netVal
      };
    });

    const totalGrossWeight = totalGross.toDecimalPlaces(3).toNumber();
    const totalDeductionWeight = totalDeduction.toDecimalPlaces(3).toNumber();
    const totalNetWeight = totalNet.toDecimalPlaces(3).toNumber();

    const marketValue = typeof manualMarketValue === 'number' && manualMarketValue > 0
      ? manualMarketValue
      : 0;
    const ltv = marketValue > 0 ? decPrincipal.times(100).dividedBy(marketValue).toDecimalPlaces(2).toNumber() : 0;

    return {
      monthlyInterest,
      totalGrossWeight,
      totalDeductionWeight,
      totalNetWeight,
      marketValue,
      ltv,
      normalizedItems
    };
  }

  public async create(loanData: Omit<Loan, 'id' | 'loanNo'> & { loanNo?: string }): Promise<Loan> {
    const loans = this.getAll();
    let seq: number;
    let loanNo: string;
    if (loanData.loanNo && /^GL-\d+$/i.test(loanData.loanNo.trim())) {
      loanNo = loanData.loanNo.trim().toUpperCase();
      seq = parseInt(loanNo.replace(/\D/g, ''), 10);
      await counterService.setSequenceIfHigher('loanSequence', seq);
      await counterService.setSequenceIfHigher('loanNo', seq);
    } else {
      seq = await counterService.getNextLoanSequence();
      loanNo = `GL-${seq}`;
    }
    const id = `L-${Date.now()}`;

    const effectivePrincipal = Number(loanData.principal ?? (loanData as any).principalAmount ?? (loanData as any).loanAmount ?? 0);

    // ── MASTER CONTROL RESOLUTION (SINGLE SOURCE OF TRUTH) ────────────────────
    const masterSettings = adminService.getMasterSettings();
    const loanTypes: LoanTypeConfig[] = masterSettings.loanTypes || [];

    const reqTypeId = (loanData.loanTypeId || loanData.loanType || '').toLowerCase().trim();
    if (!reqTypeId) {
      throw new Error('Loan Type is required.');
    }

    const matchedType = loanTypes.find(
      (t) => t.id.toLowerCase() === reqTypeId || t.name.toLowerCase() === reqTypeId
    );

    if (!matchedType) {
      throw new Error(`Loan type "${loanData.loanTypeId || loanData.loanType}" was not found in Master Control configuration.`);
    }

    if (!matchedType.active) {
      throw new Error(`Loan type "${matchedType.name}" is currently disabled in Master Control.`);
    }

    if (matchedType.showOnLoanIssue === false) {
      throw new Error(`Loan type "${matchedType.name}" is not enabled for new loan issuance in Master Control.`);
    }

    // Enforce server-authoritative Card Fee
    const serverCardFee = matchedType.cardFee !== undefined
      ? matchedType.cardFee
      : (masterSettings.defaultCardFee || 25);
    const serverCardFeeEnabled = matchedType.cardFeeEnabled !== undefined
      ? Boolean(matchedType.cardFeeEnabled)
      : true;
    const configVersion = matchedType.configurationVersion || 1;

    // Server-authoritative Interest Rate resolution per product configuration
    let interestRate = matchedType.defaultMonthlyRate !== undefined ? matchedType.defaultMonthlyRate : 2.0;
    let interestProfileName = 'Gold Amount Bands';
    let amountBandId: string | undefined;

    if (matchedType.interestProfileId === 'pronote-interest') {
      interestProfileName = 'Pronote Interest';
      interestRate = matchedType.defaultMonthlyRate !== undefined ? matchedType.defaultMonthlyRate : 4.0;
    } else if (matchedType.interestProfileId === 'fixed-rate') {
      interestProfileName = `Fixed Rate (${interestRate}%/mo)`;
      interestRate = matchedType.defaultMonthlyRate !== undefined ? matchedType.defaultMonthlyRate : 1.5;
    } else if (matchedType.interestProfileId === 'silver-bands') {
      interestProfileName = 'Silver Amount Bands';
      interestRate = matchedType.defaultMonthlyRate !== undefined ? matchedType.defaultMonthlyRate : 3.0;
    } else if (matchedType.interestProfileId === 'gold-bands') {
      interestProfileName = 'Gold Amount Bands';
      interestRate = matchedType.defaultMonthlyRate !== undefined ? matchedType.defaultMonthlyRate : 2.0;
    } else if (typeof matchedType.defaultMonthlyRate === 'number' && matchedType.defaultMonthlyRate > 0) {
      interestRate = matchedType.defaultMonthlyRate;
      interestProfileName = matchedType.name;
    }

    const userMarketValue = Number(loanData.marketValue) || 0;
    const calc = this.calculateFinancials(effectivePrincipal, interestRate, loanData.items || [], userMarketValue);

    // ── NOMINEE KYC VALIDATION & NORMALIZATION ──────────────────────────────
    let normalizedNominee = loanData.nominee;
    const isNomineeEnabled = Boolean(
      (loanData as any).hasNominee ||
      (loanData.nominee && ((loanData.nominee as any).hasNominee === true || (loanData.nominee as any).enabled === true || ((loanData.nominee as any).hasNominee !== false && (loanData.nominee.name || (loanData.nominee as any).fullName))))
    );
    if (isNomineeEnabled && loanData.nominee) {
      const nom = loanData.nominee;
      const fullName = (nom.fullName || nom.name || '').trim();
      if (!fullName) {
        const err: any = new Error('Nominee Full Name is required.');
        err.code = 'INVALID_NOMINEE';
        throw err;
      }

      const relation = (nom.relation || nom.relationship || '').trim();
      if (!relation || relation === '-') {
        const err: any = new Error('Nominee Relationship is required.');
        err.code = 'INVALID_NOMINEE';
        throw err;
      }

      const customRelation = (nom.customRelation || nom.specifiedRelation || '').trim();
      if (relation === 'Other' && !customRelation) {
        const err: any = new Error('Please specify the custom Nominee relationship.');
        err.code = 'INVALID_NOMINEE';
        throw err;
      }

      const mobile = (nom.mobile || nom.phone || '').replace(/\D/g, '');
      if (mobile.length !== 10 || !/^[6-9]\d{9}$/.test(mobile)) {
        const err: any = new Error('Please enter a valid 10-digit Indian Mobile Number for Nominee.');
        err.code = 'INVALID_NOMINEE';
        throw err;
      }

      const aadhaarDigits = (nom.aadhaarNumber || nom.idProofNumber || (nom as any).idProof?.aadhaarNumber || '').replace(/\D/g, '');
      if (aadhaarDigits && aadhaarDigits.length !== 12) {
        const err: any = new Error('Enter a valid 12-digit Aadhaar number for Nominee.');
        err.code = 'INVALID_NOMINEE';
        throw err;
      }

      const panUpper = (nom.panNumber || (nom as any).idProof?.panNumber || '').trim().toUpperCase();
      if (panUpper && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panUpper)) {
        const err: any = new Error('Enter a valid PAN number for Nominee (e.g. ABCDE1234F).');
        err.code = 'INVALID_NOMINEE';
        throw err;
      }

      const currentAddress = (nom.currentAddress || nom.address || '').trim();

      normalizedNominee = {
        hasNominee: true,
        enabled: true,
        name: fullName,
        fullName,
        relation,
        relationship: relation === 'Other' ? customRelation : relation,
        customRelation: relation === 'Other' ? customRelation : null,
        specifiedRelation: relation === 'Other' ? customRelation : null,
        phone: mobile,
        mobile,
        alternateMobile: nom.alternateMobile ? nom.alternateMobile.replace(/\D/g, '') : undefined,
        gender: nom.gender || 'Male',
        dateOfBirth: nom.dateOfBirth || undefined,
        age: nom.age,
        occupation: nom.occupation?.trim() || undefined,
        email: nom.email?.trim() || undefined,
        aadhaarNumber: aadhaarDigits,
        panNumber: panUpper || undefined,
        idProofNumber: aadhaarDigits,
        address: currentAddress,
        currentAddress,
        permanentAddress: nom.sameAsCurrentAddress || nom.isSameAddress ? currentAddress : (nom.permanentAddress || currentAddress),
        sameAsCurrentAddress: Boolean(nom.sameAsCurrentAddress || nom.isSameAddress),
        isSameAddress: Boolean(nom.sameAsCurrentAddress || nom.isSameAddress),
        documents: nom.documents || undefined,
        location: nom.location || null
      };
    }

    // ── GUARANTOR KYC VALIDATION & NORMALIZATION ────────────────────────────
    let normalizedGuarantor = loanData.guarantor;
    const isGuarantorEnabled = Boolean(
      (loanData as any).hasGuarantor ||
      (loanData.guarantor && ((loanData.guarantor as any).hasGuarantor === true || (loanData.guarantor as any).enabled === true || ((loanData.guarantor as any).hasGuarantor !== false && (loanData.guarantor.name || (loanData.guarantor as any).fullName))))
    );
    if (isGuarantorEnabled && loanData.guarantor) {
      const guar = loanData.guarantor;
      const fullName = (guar.fullName || guar.name || '').trim();
      if (!fullName) {
        const err: any = new Error('Guarantor Full Name is required.');
        err.code = 'INVALID_GUARANTOR';
        throw err;
      }

      const relation = (guar.relation || guar.relationship || '').trim();
      if (!relation || relation === '-') {
        const err: any = new Error('Guarantor Relationship is required.');
        err.code = 'INVALID_GUARANTOR';
        throw err;
      }

      const customRelation = (guar.customRelation || guar.specifiedRelation || '').trim();
      if (relation === 'Other' && !customRelation) {
        const err: any = new Error('Please specify the custom Guarantor relationship.');
        err.code = 'INVALID_GUARANTOR';
        throw err;
      }

      const mobile = (guar.mobile || guar.phone || '').replace(/\D/g, '');
      if (mobile.length !== 10 || !/^[6-9]\d{9}$/.test(mobile)) {
        const err: any = new Error('Please enter a valid 10-digit Indian Mobile Number for Guarantor.');
        err.code = 'INVALID_GUARANTOR';
        throw err;
      }

      const aadhaarDigits = (guar.aadhaarNumber || guar.idProof || '').replace(/\D/g, '');
      if (aadhaarDigits && aadhaarDigits.length !== 12) {
        const err: any = new Error('Enter a valid 12-digit Aadhaar number for Guarantor.');
        err.code = 'INVALID_GUARANTOR';
        throw err;
      }

      const panUpper = (guar.panNumber || '').trim().toUpperCase();
      if (panUpper && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panUpper)) {
        const err: any = new Error('Enter a valid PAN number for Guarantor (e.g. ABCDE1234F).');
        err.code = 'INVALID_GUARANTOR';
        throw err;
      }

      const monthlyIncome = guar.monthlyIncome !== undefined && guar.monthlyIncome !== null ? Number(guar.monthlyIncome) : 0;
      if (monthlyIncome < 0) {
        const err: any = new Error('Guarantor Monthly Income cannot be negative.');
        err.code = 'INVALID_GUARANTOR';
        throw err;
      }

      const currentAddress = (guar.currentAddress || guar.address || '').trim();

      normalizedGuarantor = {
        hasGuarantor: true,
        enabled: true,
        name: fullName,
        fullName,
        relation,
        relationship: relation === 'Other' ? customRelation : relation,
        customRelation: relation === 'Other' ? customRelation : null,
        specifiedRelation: relation === 'Other' ? customRelation : null,
        gender: guar.gender || 'Male',
        dateOfBirth: guar.dateOfBirth || undefined,
        age: guar.age,
        phone: mobile,
        mobile,
        alternateMobile: guar.alternateMobile ? guar.alternateMobile.replace(/\D/g, '') : undefined,
        email: guar.email?.trim() || undefined,
        occupation: guar.occupation?.trim() || undefined,
        monthlyIncome,
        aadhaarNumber: aadhaarDigits,
        panNumber: panUpper || undefined,
        idProof: aadhaarDigits,
        address: currentAddress,
        currentAddress,
        permanentAddress: guar.sameAsCurrentAddress || guar.isSameAddress ? currentAddress : (guar.permanentAddress || currentAddress),
        sameAsCurrentAddress: Boolean(guar.sameAsCurrentAddress || guar.isSameAddress),
        isSameAddress: Boolean(guar.sameAsCurrentAddress || guar.isSameAddress),
        documents: guar.documents || undefined
      };
    }

    const effectiveCardFee = serverCardFeeEnabled ? serverCardFee : 0;
    const advanceInterest = loanData.deductAdvanceInterest
      ? (loanData.advanceInterestAmount || 0)
      : 0;
    const netDisbursed = new Decimal(effectivePrincipal).minus(advanceInterest).minus(effectiveCardFee).toNumber();

    const newLoan: Loan = {
      ...loanData,
      principal: effectivePrincipal,
      id,
      loanNo,
      loanType: matchedType ? matchedType.name : loanData.loanType,
      loanTypeId: matchedType ? matchedType.id : (loanData.loanTypeId || 'gold-loan'),
      loanTypeName: matchedType ? matchedType.name : (loanData.loanTypeName || loanData.loanType),
      nominee: normalizedNominee,
      guarantor: normalizedGuarantor,

      // Backward compatibility legacy fields
      nomineeName: normalizedNominee?.name || (loanData as any).nomineeName || undefined,
      nomineeRelation: normalizedNominee?.relation || (loanData as any).nomineeRelation || undefined,
      nomineePhone: normalizedNominee?.phone || (loanData as any).nomineePhone || undefined,
      nomineeAadhaar: normalizedNominee?.aadhaarNumber || (loanData as any).nomineeAadhaar || undefined,
      nomineePan: normalizedNominee?.panNumber || (loanData as any).nomineePan || undefined,
      guarantorName: normalizedGuarantor?.name || (loanData as any).guarantorName || undefined,
      guarantorRelation: normalizedGuarantor?.relation || (loanData as any).guarantorRelation || undefined,
      guarantorPhone: normalizedGuarantor?.phone || (loanData as any).guarantorPhone || undefined,
      guarantorAadhaar: normalizedGuarantor?.aadhaarNumber || (loanData as any).guarantorAadhaar || undefined,
      guarantorPan: normalizedGuarantor?.panNumber || (loanData as any).guarantorPan || undefined,
      loanTypeNameSnapshot: matchedType ? matchedType.name : loanData.loanType,
      interestRateSnapshot: interestRate,
      interestProfileSnapshot: interestProfileName,
      cardFeeSnapshot: serverCardFee,
      interestProfileIdSnapshot: matchedType?.interestProfileId || 'gold-bands',
      interestProfileNameSnapshot: interestProfileName,
      interestConfigurationSnapshot: {
        interestRate,
        interestRateUnit: 'MONTHLY',
        rateSource: 'MASTER_CONTROL',
        amountBandId
      },
      configurationVersion: configVersion,
      configurationSource: matchedType.useMasterDefaults !== false ? 'MASTER_INHERITED' : 'CUSTOM_OVERRIDE',
      rateEffectiveAt: loanData.date || new Date().toISOString(),

      interestRate,
      cardFee: serverCardFee,
      cardFeeEnabled: serverCardFeeEnabled,
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
      date: loanData.date || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      lastInterestPaidDate: loanData.date || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    loans.unshift(newLoan);
    localFileRepository.writeJson(FILE_NAME, loans);

    // Enqueue background sync event
    syncQueueService.enqueue('loan', newLoan.loanNo, 'CREATE', newLoan);

    // Update customer active loans count
    const customer = customerService.getById(newLoan.customerId);
    if (customer) {
      customerService.update(customer.id, {
        activeLoansCount: (customer.activeLoansCount || 0) + 1,
        totalBorrowed: new Decimal(customer.totalBorrowed || 0).plus(effectivePrincipal).toNumber()
      });
    }

    // Create New Loan Receipt using the same authoritative sequence
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
      const cashDisbursed = isCash ? effectivePrincipal : isSplit ? (newLoan.cashAmount || 0) : 0;
      const bankDisbursed = isCash ? 0 : isSplit ? (newLoan.bankAmount || 0) : effectivePrincipal;

      accountingService.addEntry({
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
    } catch (e) {
      console.warn('[LoanService] Accounting entry note:', e);
    }

    return newLoan;
  }

  public closeLoan(loanNo: string): Loan | null {
    const loans = this.getAll();
    const index = loans.findIndex((l) => l.loanNo.toLowerCase() === loanNo.toLowerCase());
    if (index === -1) return null;

    loans[index].outstandingPrincipal = 0;
    loans[index].status = 'CLOSED';

    localFileRepository.writeJson(FILE_NAME, loans);
    syncQueueService.enqueue('loan', loans[index].loanNo, 'UPDATE', loans[index]);
    return loans[index];
  }

  public update(id: string, updates: Partial<Loan>): Loan | null {
    const loans = this.getAll();
    const index = loans.findIndex((l) => l.id === id || l.loanNo.toLowerCase() === id.toLowerCase());
    if (index === -1) return null;
    const originalLoanNo = loans[index].loanNo;
    const originalId = loans[index].id;
    loans[index] = { ...loans[index], ...updates, loanNo: originalLoanNo, id: originalId };
    localFileRepository.writeJson(FILE_NAME, loans);
    syncQueueService.enqueue('loan', loans[index].loanNo, 'UPDATE', loans[index]);
    return loans[index];
  }

  public delete(id: string): boolean {
    const loans = this.getAll();
    const filtered = loans.filter((l) => l.id !== id && l.loanNo.toLowerCase() !== id.toLowerCase());
    if (filtered.length === loans.length) return false;
    localFileRepository.writeJson(FILE_NAME, filtered);
    syncQueueService.enqueue('loan', id, 'DELETE', { id, isDeleted: true });
    return true;
  }
}

export const loanService = new LoanService();
