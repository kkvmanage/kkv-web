import Decimal from 'decimal.js';
import { googleDriveRepository } from '../repositories/googleDrive.repository.js';
import { syncQueueService } from './syncQueue.service.js';
import { counterService } from './counter.service.js';
import {
  FixedDeposit,
  FDCustomer,
  FDInterestPayout,
  FDWithdrawal,
  FDRenewal,
  DayBookEntry
} from '../types/index.js';
import { accountingService } from './accounting.service.js';
import { adminService } from './admin.service.js';
import { FixedDepositModel } from '../models/FixedDeposit.js';
import { FDCustomerModel } from '../models/FDCustomer.js';
import { FDInterestPayoutModel } from '../models/FDInterestPayout.js';
import { FDWithdrawalModel } from '../models/FDWithdrawal.js';
import { FDRenewalModel } from '../models/FDRenewal.js';
import { isMongoConnected, ensureMongoConnected } from '../config/database.js';

const FD_CUST_FILE = 'fd_customers.json';
const FD_DEPOSITS_FILE = 'fixed_deposits.json';
const FD_PAYOUTS_FILE = 'fd_interest_payouts.json';
const FD_WITHDRAWALS_FILE = 'fd_withdrawals.json';
const FD_RENEWALS_FILE = 'fd_renewals.json';

const initialFDCustomers: FDCustomer[] = [];
const initialDeposits: FixedDeposit[] = [];

export class FDService {
  private hasSeededToMongo = false;

  private async ensureSeeded(): Promise<void> {
    if (this.hasSeededToMongo) return;
    try {
      if (!isMongoConnected()) {
        await ensureMongoConnected();
      }
      if (isMongoConnected()) {
        // Seed FDs
        const fdCount = await FixedDepositModel.countDocuments();
        if (fdCount === 0) {
          const fileDeposits = googleDriveRepository.readJson<FixedDeposit[]>(FD_DEPOSITS_FILE, initialDeposits);
          if (Array.isArray(fileDeposits) && fileDeposits.length > 0) {
            for (const f of fileDeposits) {
              await FixedDepositModel.findOneAndUpdate(
                { $or: [{ id: f.id }, { fdNo: f.fdNo }] },
                { $set: f },
                { upsert: true }
              );
            }
            console.log(`[FDService] Migrated ${fileDeposits.length} FDs from JSON to MongoDB.`);
          }
        }

        // Seed FD Customers
        const fdcCount = await FDCustomerModel.countDocuments();
        if (fdcCount === 0) {
          const fileCusts = googleDriveRepository.readJson<FDCustomer[]>(FD_CUST_FILE, initialFDCustomers);
          if (Array.isArray(fileCusts) && fileCusts.length > 0) {
            for (const c of fileCusts) {
              await FDCustomerModel.findOneAndUpdate(
                { id: c.id },
                { $set: c },
                { upsert: true }
              );
            }
            console.log(`[FDService] Migrated ${fileCusts.length} FD Customers from JSON to MongoDB.`);
          }
        }

        this.hasSeededToMongo = true;
      }
    } catch (err) {
      console.warn('[FDService] Seed to Mongo note:', err);
    }
  }

  // ── CUSTOMERS ─────────────────────────────────────────────────────────────
  public async getCustomersAsync(): Promise<FDCustomer[]> {
    await this.ensureSeeded();
    try {
      if (isMongoConnected()) {
        const dbCusts = await FDCustomerModel.find({ isDeleted: { $ne: true } })
          .sort({ createdAt: -1 })
          .lean();
        if (Array.isArray(dbCusts)) {
          const mapped: FDCustomer[] = dbCusts.map((c: any) => ({
            ...c,
            id: c.id || c._id?.toString()
          }));
          googleDriveRepository.writeJson(FD_CUST_FILE, mapped);
          return mapped;
        }
      }
    } catch (err) {
      console.warn('[FDService] getCustomersAsync Mongo error:', err);
    }

    const list = googleDriveRepository.readJson<FDCustomer[]>(FD_CUST_FILE, initialFDCustomers);
    return Array.isArray(list) ? list.filter((c) => !c.isDeleted) : [];
  }

  public getCustomers(): FDCustomer[] {
    const list = googleDriveRepository.readJson<FDCustomer[]>(FD_CUST_FILE, initialFDCustomers);
    return Array.isArray(list) ? list.filter((c) => !c.isDeleted) : [];
  }

  public async createCustomer(data: Omit<FDCustomer, 'id' | 'createdAt'>): Promise<FDCustomer> {
    const id = `fdc-${Date.now()}`;
    const createdAt = new Date().toLocaleDateString('en-GB');

    const newCust: FDCustomer = {
      ...data,
      id,
      createdAt
    };

    // 1. Authoritative persistence to MongoDB
    try {
      if (!isMongoConnected()) {
        await ensureMongoConnected();
      }
      if (isMongoConnected()) {
        await FDCustomerModel.create(newCust);
      }
    } catch (mongoErr) {
      console.error('[FDService] Mongo createCustomer error:', mongoErr);
    }

    // 2. Local File Repository & Sync Queue
    const customers = this.getCustomers();
    customers.unshift(newCust);
    googleDriveRepository.writeJson(FD_CUST_FILE, customers);
    syncQueueService.enqueue('fd_customer', newCust.id, 'CREATE', newCust);

    return newCust;
  }

  // ── DEPOSITS ──────────────────────────────────────────────────────────────
  public async getDepositsAsync(): Promise<FixedDeposit[]> {
    await this.ensureSeeded();
    try {
      if (isMongoConnected()) {
        const dbDeposits = await FixedDepositModel.find({ isDeleted: { $ne: true } })
          .sort({ createdAt: -1 })
          .lean();
        if (Array.isArray(dbDeposits)) {
          const mapped: FixedDeposit[] = dbDeposits.map((d: any) => ({
            ...d,
            id: d.id || d._id?.toString()
          }));
          googleDriveRepository.writeJson(FD_DEPOSITS_FILE, mapped);
          return mapped;
        }
      }
    } catch (err) {
      console.warn('[FDService] getDepositsAsync Mongo error:', err);
    }

    const list = googleDriveRepository.readJson<FixedDeposit[]>(FD_DEPOSITS_FILE, initialDeposits);
    return Array.isArray(list) ? list.filter((f) => !f.isDeleted) : [];
  }

  public getDeposits(): FixedDeposit[] {
    const list = googleDriveRepository.readJson<FixedDeposit[]>(FD_DEPOSITS_FILE, initialDeposits);
    return Array.isArray(list) ? list.filter((f) => !f.isDeleted) : [];
  }

  public async createDeposit(data: Omit<FixedDeposit, 'id' | 'fdNo'> & { fdNo?: string }): Promise<FixedDeposit> {
    let fdNo: string;
    if (data.fdNo && /^FD-\d+$/i.test(data.fdNo.trim())) {
      fdNo = data.fdNo.trim().toUpperCase();
      const num = parseInt(fdNo.replace(/\D/g, ''), 10);
      await counterService.setSequenceIfHigher('fdSequence', num);
    } else {
      fdNo = await counterService.getNextFdNo();
    }

    // ── MASTER CONTROL RESOLUTION (SINGLE SOURCE OF TRUTH) ────────────────────
    const masterSettings = adminService.getMasterSettings();
    const serverRatePA = data.interestRatePA !== undefined && !isNaN(Number(data.interestRatePA))
      ? Number(data.interestRatePA)
      : (masterSettings.fdInterestRate ?? 12);
    const serverTenureMonths = data.tenureMonths !== undefined && !isNaN(Number(data.tenureMonths))
      ? Number(data.tenureMonths)
      : (masterSettings.fdDefaultTenureMonths ?? 12);
    const minAmount = masterSettings.fdMinimumAmount ?? 0;

    if (minAmount > 0 && (Number(data.principal) || 0) < minAmount) {
      throw new Error(`Minimum Fixed Deposit principal amount is ₹${minAmount.toLocaleString('en-IN')}`);
    }

    const principal = new Decimal(data.principal || 0);
    const ratePA = new Decimal(serverRatePA);
    // Monthly payout = (Principal * RatePA) / (12 * 100)
    const monthlyPayout = principal.times(ratePA).dividedBy(1200).toDecimalPlaces(2).toNumber();

    const newFD: FixedDeposit = {
      ...data,
      id: `FD-${Date.now()}`,
      fdNo,
      principal: principal.toNumber(),
      remainingPrincipal: data.remainingPrincipal ?? principal.toNumber(),
      totalWithdrawnPrincipal: data.totalWithdrawnPrincipal ?? 0,
      interestRatePA: serverRatePA,
      tenureMonths: serverTenureMonths,
      monthlyPayout,
      status: data.status || 'ACTIVE',

      // ── IMMUTABLE CONTRACTUAL SNAPSHOT FIELDS ──────────────────────────────
      fdInterestRateSnapshot: serverRatePA,
      fdTenureSnapshot: serverTenureMonths,
      calculationMethodSnapshot: masterSettings.fdCalculationMethod || 'MONTHLY_DIVIDEND',
      minimumAmountSnapshot: minAmount,
      configurationVersion: masterSettings.configurationVersion || 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 1. Authoritative MongoDB Persistence
    try {
      if (!isMongoConnected()) {
        await ensureMongoConnected();
      }
      if (isMongoConnected()) {
        await FixedDepositModel.create(newFD);
      }
    } catch (mongoErr: any) {
      console.error('[FDService] Mongo createDeposit error:', mongoErr);
      throw new Error('Database persistence failed: ' + (mongoErr?.message || mongoErr));
    }

    // 2. Local File Repository & Sync Queue
    const deposits = this.getDeposits();
    deposits.unshift(newFD);
    googleDriveRepository.writeJson(FD_DEPOSITS_FILE, deposits);
    syncQueueService.enqueue('fixed_deposit', newFD.fdNo, 'CREATE', newFD);

    // Create DayBook Entry
    const isCash = data.receivingMethod === 'Cash';
    const isBank = data.receivingMethod === 'Bank' || data.receivingMethod === 'UPI';

    try {
      await accountingService.addEntryAsync({
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        billNo: fdNo,
        particulars: `Fixed Deposit Inflow (${fdNo}) - ${data.depositorName}`,
        accountHead: 'Fixed Deposits',
        mode: data.receivingMethod,
        cashIn: isCash ? data.principal : 0,
        cashOut: 0,
        bankIn: isBank ? data.principal : 0,
        bankOut: 0,
        customerName: data.depositorName,
        date: data.depositDate
      });
    } catch (e) {
      console.warn('[FDService] DayBook entry note:', e);
    }

    return newFD;
  }

  // ── PAYOUTS ───────────────────────────────────────────────────────────────
  public async getPayoutsAsync(): Promise<FDInterestPayout[]> {
    try {
      if (isMongoConnected()) {
        const dbPayouts = await FDInterestPayoutModel.find()
          .sort({ createdAt: -1 })
          .lean();
        if (Array.isArray(dbPayouts)) {
          return dbPayouts.map((p: any) => ({ ...p, id: p.id || p._id?.toString() }));
        }
      }
    } catch (err) {
      console.warn('[FDService] getPayoutsAsync Mongo error:', err);
    }
    return googleDriveRepository.readJson<FDInterestPayout[]>(FD_PAYOUTS_FILE, []);
  }

  public getPayouts(): FDInterestPayout[] {
    return googleDriveRepository.readJson<FDInterestPayout[]>(FD_PAYOUTS_FILE, []);
  }

  public async payInterest(
    fdNo: string,
    amount: number,
    mode: 'Cash' | 'Bank' | 'UPI',
    dueDate?: string,
    periodKey?: string
  ): Promise<FDInterestPayout | null> {
    const deposits = await this.getDepositsAsync();
    const targetFD = deposits.find((f) => f.fdNo === fdNo);
    if (!targetFD) return null;

    const payout: FDInterestPayout = {
      id: `fd-payout-${Date.now()}`,
      fdNo,
      customerId: targetFD.customerId,
      depositorName: targetFD.depositorName,
      amount,
      date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      dueDate,
      periodKey,
      mode,
      status: 'PAID'
    };

    // 1. Authoritative persistence in MongoDB
    try {
      if (isMongoConnected()) {
        await FDInterestPayoutModel.create(payout);
      }
    } catch (mongoErr) {
      console.error('[FDService] Mongo payInterest error:', mongoErr);
    }

    const payouts = this.getPayouts();
    payouts.unshift(payout);
    googleDriveRepository.writeJson(FD_PAYOUTS_FILE, payouts);
    syncQueueService.enqueue('fd_interest_payout', payout.id, 'CREATE', payout);

    // Accounting Entry
    const isCash = mode === 'Cash';
    try {
      await accountingService.addEntryAsync({
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        billNo: `INT-${fdNo}`,
        particulars: `FD Interest Payout (${fdNo}) - ${targetFD.depositorName}`,
        accountHead: 'Interest Expense',
        mode,
        cashIn: 0,
        cashOut: isCash ? amount : 0,
        bankIn: 0,
        bankOut: isCash ? 0 : amount,
        customerName: targetFD.depositorName,
        date: payout.date
      });
    } catch (e) {
      console.warn('[FDService] DayBook entry note:', e);
    }

    return payout;
  }

  // ── WITHDRAWALS ───────────────────────────────────────────────────────────
  public async getWithdrawalsAsync(): Promise<FDWithdrawal[]> {
    try {
      if (isMongoConnected()) {
        const dbWithdrawals = await FDWithdrawalModel.find()
          .sort({ createdAt: -1 })
          .lean();
        if (Array.isArray(dbWithdrawals)) {
          return dbWithdrawals.map((w: any) => ({ ...w, id: w.id || w._id?.toString() }));
        }
      }
    } catch (err) {
      console.warn('[FDService] getWithdrawalsAsync Mongo error:', err);
    }
    return googleDriveRepository.readJson<FDWithdrawal[]>(FD_WITHDRAWALS_FILE, []);
  }

  public getWithdrawals(): FDWithdrawal[] {
    return googleDriveRepository.readJson<FDWithdrawal[]>(FD_WITHDRAWALS_FILE, []);
  }

  public async withdraw(
    fdNo: string,
    mode: 'Cash' | 'Bank' | 'UPI',
    notes?: string,
    withdrawalAmount?: number,
    transactionReference?: string,
    bankName?: string
  ): Promise<FDWithdrawal | null> {
    const deposits = await this.getDepositsAsync();
    const index = deposits.findIndex((f) => f.fdNo === fdNo);
    if (index === -1) return null;

    const targetFD = deposits[index];
    const currentRemaining = targetFD.remainingPrincipal ?? targetFD.principal;
    const amountToWithdraw = withdrawalAmount && withdrawalAmount > 0 ? Math.min(withdrawalAmount, currentRemaining) : currentRemaining;

    if (amountToWithdraw <= 0) return null;

    const newRemaining = Math.max(0, currentRemaining - amountToWithdraw);
    const newTotalWithdrawn = (targetFD.totalWithdrawnPrincipal ?? 0) + amountToWithdraw;
    const isFullyWithdrawn = newRemaining <= 0;
    const newStatus = isFullyWithdrawn ? 'WITHDRAWN' : targetFD.status;

    // Update FD in MongoDB
    try {
      if (isMongoConnected()) {
        await FixedDepositModel.findOneAndUpdate(
          { fdNo },
          {
            $set: {
              status: newStatus,
              remainingPrincipal: newRemaining,
              totalWithdrawnPrincipal: newTotalWithdrawn,
              updatedAt: new Date().toISOString()
            }
          }
        );
      }
    } catch (mongoErr) {
      console.error('[FDService] Mongo update FD on withdraw error:', mongoErr);
    }

    deposits[index].status = newStatus;
    deposits[index].remainingPrincipal = newRemaining;
    deposits[index].totalWithdrawnPrincipal = newTotalWithdrawn;
    googleDriveRepository.writeJson(FD_DEPOSITS_FILE, deposits);

    const withdrawal: FDWithdrawal = {
      id: `fd-wth-${Date.now()}`,
      withdrawalId: `WD-${Date.now()}`,
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
      withdrawalDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      mode,
      transactionReference,
      bankName,
      notes: notes || (isFullyWithdrawn ? 'Full FD settlement' : 'Partial principal withdrawal'),
      status: 'COMPLETED',
      processedBy: 'Admin'
    };

    // Save withdrawal in MongoDB
    try {
      if (isMongoConnected()) {
        await FDWithdrawalModel.create(withdrawal);
      }
    } catch (mongoErr) {
      console.error('[FDService] Mongo save withdrawal error:', mongoErr);
    }

    const withdrawals = this.getWithdrawals();
    withdrawals.unshift(withdrawal);
    googleDriveRepository.writeJson(FD_WITHDRAWALS_FILE, withdrawals);
    syncQueueService.enqueue('fd_withdrawal', withdrawal.id, 'CREATE', withdrawal);

    // Accounting Entry
    const isCash = mode === 'Cash';
    try {
      await accountingService.addEntryAsync({
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        billNo: `WTH-${fdNo}`,
        particulars: `Fixed Deposit ${isFullyWithdrawn ? 'Full Closure' : 'Partial Withdrawal'} (${fdNo}) - ${targetFD.depositorName}`,
        accountHead: 'Fixed Deposits',
        mode,
        cashIn: 0,
        cashOut: isCash ? amountToWithdraw : 0,
        bankIn: 0,
        bankOut: isCash ? 0 : amountToWithdraw,
        customerName: targetFD.depositorName,
        date: withdrawal.withdrawalDate
      });
    } catch (e) {
      console.warn('[FDService] DayBook entry note:', e);
    }

    return withdrawal;
  }

  // ── RENEWALS ──────────────────────────────────────────────────────────────
  public async getRenewalsAsync(): Promise<FDRenewal[]> {
    try {
      if (isMongoConnected()) {
        const dbRenewals = await FDRenewalModel.find().sort({ createdAt: -1 }).lean();
        if (Array.isArray(dbRenewals)) {
          return dbRenewals.map((r: any) => ({ ...r, id: r.id || r._id?.toString() }));
        }
      }
    } catch (err) {
      console.warn('[FDService] getRenewalsAsync Mongo error:', err);
    }
    return googleDriveRepository.readJson<FDRenewal[]>(FD_RENEWALS_FILE, []);
  }

  public getRenewals(): FDRenewal[] {
    return googleDriveRepository.readJson<FDRenewal[]>(FD_RENEWALS_FILE, []);
  }

  public async renew(fdNo: string, periodMonths: number, notes?: string): Promise<FDRenewal | null> {
    const deposits = await this.getDepositsAsync();
    const index = deposits.findIndex((f) => f.fdNo === fdNo);
    if (index === -1) return null;

    const targetFD = deposits[index];
    if (targetFD.status === 'WITHDRAWN') return null;

    const parseDMY = (s: string): Date => {
      const [d, m, y] = s.split(/[-/]/).map(Number);
      return new Date(y, m - 1, d);
    };

    const formatDMY = (d: Date): string => {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const previousMaturityDate = targetFD.maturityDate;
    const prevDate = parseDMY(previousMaturityDate);
    const newDate = new Date(prevDate.getFullYear(), prevDate.getMonth() + periodMonths, prevDate.getDate());
    const newMaturityDate = formatDMY(newDate);

    // Update in Mongo
    try {
      if (isMongoConnected()) {
        await FixedDepositModel.findOneAndUpdate(
          { fdNo },
          { $set: { maturityDate: newMaturityDate, status: 'ACTIVE', updatedAt: new Date().toISOString() } }
        );
      }
    } catch (mongoErr) {
      console.error('[FDService] Mongo update FD on renew error:', mongoErr);
    }

    deposits[index].maturityDate = newMaturityDate;
    deposits[index].status = 'ACTIVE';
    googleDriveRepository.writeJson(FD_DEPOSITS_FILE, deposits);

    const renewal: FDRenewal = {
      id: `fd-rnw-${Date.now()}`,
      renewalId: `RN-${Date.now()}`,
      fdId: targetFD.id,
      fdNo,
      customerId: targetFD.customerId,
      depositorName: targetFD.depositorName,
      previousMaturityDate,
      newMaturityDate,
      renewalPeriodMonths: periodMonths,
      renewalDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      interestRateAtRenewal: targetFD.interestRatePA,
      notes: notes || `FD renewed for ${periodMonths} months`,
      status: 'COMPLETED'
    };

    try {
      if (isMongoConnected()) {
        await FDRenewalModel.create(renewal);
      }
    } catch (mongoErr) {
      console.error('[FDService] Mongo save renewal error:', mongoErr);
    }

    const renewals = this.getRenewals();
    renewals.unshift(renewal);
    googleDriveRepository.writeJson(FD_RENEWALS_FILE, renewals);
    syncQueueService.enqueue('fd_renewal', renewal.id, 'CREATE', renewal);

    return renewal;
  }

  public async deleteDeposit(fdNo: string): Promise<boolean> {
    try {
      if (isMongoConnected()) {
        await FixedDepositModel.findOneAndUpdate(
          { fdNo },
          { $set: { isDeleted: true, updatedAt: new Date().toISOString() } }
        );
      }
    } catch (err) {
      console.warn('[FDService] deleteDeposit Mongo error:', err);
    }

    const deposits = this.getDeposits();
    const filtered = deposits.filter((f) => f.fdNo !== fdNo);
    if (filtered.length === deposits.length) return false;
    googleDriveRepository.writeJson(FD_DEPOSITS_FILE, filtered);
    syncQueueService.enqueue('fixed_deposit', fdNo, 'DELETE', { fdNo, isDeleted: true });
    return true;
  }

  public bulkUpdateDates(fdNos: string[], newDepositDate?: string, offsetDays?: number): FixedDeposit[] {
    const deposits = this.getDeposits();
    const daybookEntries = googleDriveRepository.readJson<DayBookEntry[]>('daybook_entries.json', []);
    const updatedDeposits: FixedDeposit[] = [];

    const parseDMY = (s: string): Date => {
      const [d, m, y] = s.split(/[-/]/).map(Number);
      return new Date(y, m - 1, d);
    };

    const formatDMY = (d: Date): string => {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    for (const fd of deposits) {
      if (fdNos.includes(fd.fdNo)) {
        let oldDepDate = parseDMY(fd.depositDate);
        let newDepDate = oldDepDate;
        let oldMatDate = parseDMY(fd.maturityDate);
        let newMatDate = oldMatDate;

        if (newDepositDate) {
          newDepDate = parseDMY(newDepositDate);
          const diffTime = newDepDate.getTime() - oldDepDate.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          newMatDate = new Date(oldMatDate.getTime() + diffDays * 24 * 60 * 60 * 1000);
        } else if (offsetDays !== undefined) {
          newDepDate = new Date(oldDepDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
          newMatDate = new Date(oldMatDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
        }

        fd.depositDate = formatDMY(newDepDate);
        fd.maturityDate = formatDMY(newMatDate);
        updatedDeposits.push(fd);

        if (isMongoConnected()) {
          FixedDepositModel.findOneAndUpdate(
            { fdNo: fd.fdNo },
            { $set: { depositDate: fd.depositDate, maturityDate: fd.maturityDate, updatedAt: new Date().toISOString() } }
          ).catch(() => {});
        }

        for (const entry of daybookEntries) {
          if (entry.billNo === fd.fdNo) {
            entry.date = fd.depositDate;
          }
        }
      }
    }

    googleDriveRepository.writeJson(FD_DEPOSITS_FILE, deposits);
    googleDriveRepository.writeJson('daybook_entries.json', daybookEntries);

    return updatedDeposits;
  }
}

export const fdService = new FDService();
