import Decimal from 'decimal.js';
import { googleDriveRepository } from '../repositories/googleDrive.repository.js';
import { syncQueueService } from './syncQueue.service.js';
import { DayBookEntry, Loan, FixedDeposit } from '../types/index.js';
import { DayBookModel } from '../models/DayBook.js';
import { LoanModel } from '../models/Loan.js';
import { FixedDepositModel } from '../models/FixedDeposit.js';
import { isMongoConnected, ensureMongoConnected } from '../config/database.js';

const FILE_NAME = 'daybook_entries.json';
const initialDayBook: DayBookEntry[] = [];

export class AccountingService {
  public async getDayBookAsync(): Promise<DayBookEntry[]> {
    try {
      if (isMongoConnected()) {
        const dbEntries = await DayBookModel.find()
          .sort({ _id: -1 })
          .lean();
        const mapped: DayBookEntry[] = (dbEntries || []).map((e: any) => ({
          ...e,
          id: e.id || e._id?.toString()
        }));
        googleDriveRepository.writeJson(FILE_NAME, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[AccountingService] getDayBookAsync Mongo error:', err);
    }
    const list = googleDriveRepository.readJson<DayBookEntry[]>(FILE_NAME, initialDayBook);
    return Array.isArray(list) ? list : [];
  }

  public getDayBook(): DayBookEntry[] {
    const list = googleDriveRepository.readJson<DayBookEntry[]>(FILE_NAME, initialDayBook);
    return Array.isArray(list) ? list : [];
  }

  public getBalances(): { cashInHand: number; cashAtBank: number } {
    const entries = this.getDayBook();
    let cashInHand = new Decimal(0);
    let cashAtBank = new Decimal(0);

    entries.forEach((e) => {
      cashInHand = cashInHand.plus(new Decimal(e.cashIn || 0)).minus(new Decimal(e.cashOut || 0));
      cashAtBank = cashAtBank.plus(new Decimal(e.bankIn || 0)).minus(new Decimal(e.bankOut || 0));
    });

    return {
      cashInHand: cashInHand.toNumber(),
      cashAtBank: cashAtBank.toNumber()
    };
  }

  public async getBalancesAsync(): Promise<{ cashInHand: number; cashAtBank: number }> {
    const entries = await this.getDayBookAsync();
    let cashInHand = new Decimal(0);
    let cashAtBank = new Decimal(0);

    entries.forEach((e) => {
      cashInHand = cashInHand.plus(new Decimal(e.cashIn || 0)).minus(new Decimal(e.cashOut || 0));
      cashAtBank = cashAtBank.plus(new Decimal(e.bankIn || 0)).minus(new Decimal(e.bankOut || 0));
    });

    return {
      cashInHand: cashInHand.toNumber(),
      cashAtBank: cashAtBank.toNumber()
    };
  }

  public async addEntryAsync(entryData: Omit<DayBookEntry, 'id' | 'cashBal' | 'bankBal'>): Promise<DayBookEntry> {
    const currentBal = await this.getBalancesAsync();

    const cashIn = new Decimal(entryData.cashIn || 0);
    const cashOut = new Decimal(entryData.cashOut || 0);
    const bankIn = new Decimal(entryData.bankIn || 0);
    const bankOut = new Decimal(entryData.bankOut || 0);

    const newCashBal = new Decimal(currentBal.cashInHand).plus(cashIn).minus(cashOut).toNumber();
    const newBankBal = new Decimal(currentBal.cashAtBank).plus(bankIn).minus(bankOut).toNumber();

    const newEntry: DayBookEntry = {
      ...entryData,
      id: `db-${Date.now()}`,
      time: entryData.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      cashIn: cashIn.toNumber(),
      cashOut: cashOut.toNumber(),
      bankIn: bankIn.toNumber(),
      bankOut: bankOut.toNumber(),
      cashBal: newCashBal,
      bankBal: newBankBal,
      date: entryData.date || new Date().toLocaleDateString('en-GB')
    };

    // 1. Authoritative persistence in MongoDB
    try {
      if (!isMongoConnected()) {
        await ensureMongoConnected();
      }
      if (isMongoConnected()) {
        await DayBookModel.create(newEntry);
      }
    } catch (mongoErr) {
      console.error('[AccountingService] Mongo save daybook entry error:', mongoErr);
    }

    // 2. Local File Repository & Sync Queue
    const entries = this.getDayBook();
    entries.unshift(newEntry);
    googleDriveRepository.writeJson(FILE_NAME, entries);
    syncQueueService.enqueue('daybook', newEntry.id, 'CREATE', newEntry);

    return newEntry;
  }

  public addEntry(entryData: Omit<DayBookEntry, 'id' | 'cashBal' | 'bankBal'>): DayBookEntry {
    const entries = this.getDayBook();
    const currentBal = this.getBalances();

    const cashIn = new Decimal(entryData.cashIn || 0);
    const cashOut = new Decimal(entryData.cashOut || 0);
    const bankIn = new Decimal(entryData.bankIn || 0);
    const bankOut = new Decimal(entryData.bankOut || 0);

    const newCashBal = new Decimal(currentBal.cashInHand).plus(cashIn).minus(cashOut).toNumber();
    const newBankBal = new Decimal(currentBal.cashAtBank).plus(bankIn).minus(bankOut).toNumber();

    const newEntry: DayBookEntry = {
      ...entryData,
      id: `db-${Date.now()}`,
      time: entryData.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      cashIn: cashIn.toNumber(),
      cashOut: cashOut.toNumber(),
      bankIn: bankIn.toNumber(),
      bankOut: bankOut.toNumber(),
      cashBal: newCashBal,
      bankBal: newBankBal,
      date: entryData.date || new Date().toLocaleDateString('en-GB')
    };

    if (isMongoConnected()) {
      DayBookModel.create(newEntry).catch(() => {});
    }

    entries.unshift(newEntry);
    googleDriveRepository.writeJson(FILE_NAME, entries);
    syncQueueService.enqueue('daybook', newEntry.id, 'CREATE', newEntry);
    return newEntry;
  }

  public async getTrialBalance(): Promise<any[]> {
    const balances = await this.getBalancesAsync();
    let goldLoanPortfolio = 0;
    let fdLiability = 0;

    if (isMongoConnected()) {
      const activeLoans = await LoanModel.find({
        isDeleted: { $ne: true },
        status: { $in: ['ACTIVE', 'OVERDUE'] }
      }).lean();
      goldLoanPortfolio = activeLoans.reduce((sum: number, l: any) => sum + (l.outstandingPrincipal || 0), 0);

      const activeFds = await FixedDepositModel.find({
        isDeleted: { $ne: true },
        status: 'ACTIVE'
      }).lean();
      fdLiability = activeFds.reduce((sum: number, f: any) => sum + (f.principal || 0), 0);
    } else {
      const loans = googleDriveRepository.readJson<Loan[]>('loans.json', []);
      const fds = googleDriveRepository.readJson<FixedDeposit[]>('fixed_deposits.json', []);
      goldLoanPortfolio = loans
        .filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE')
        .reduce((sum, l) => sum + (l.outstandingPrincipal || 0), 0);
      fdLiability = fds
        .filter((f) => f.status === 'ACTIVE')
        .reduce((sum, f) => sum + (f.principal || 0), 0);
    }

    const entries = await this.getDayBookAsync();

    const interestIncome = entries
      .filter((e) => e.accountHead === 'Interest Income' || e.accountHead === 'Cash Collections')
      .reduce((sum, e) => sum + (e.cashIn || 0) + (e.bankIn || 0), 0);

    const totalDebits = Math.max(0, balances.cashInHand) + Math.max(0, balances.cashAtBank) + goldLoanPortfolio;
    const totalCredits = Math.max(0, -balances.cashInHand) + Math.max(0, -balances.cashAtBank) + fdLiability + interestIncome;
    const capitalAccount = Math.max(0, totalDebits - totalCredits);

    return [
      { accountHead: 'Cash in Hand', debit: Math.max(0, balances.cashInHand), credit: Math.max(0, -balances.cashInHand) },
      { accountHead: 'Cash at Bank', debit: Math.max(0, balances.cashAtBank), credit: Math.max(0, -balances.cashAtBank) },
      { accountHead: 'Gold Loan Portfolio', debit: goldLoanPortfolio, credit: 0 },
      { accountHead: 'Fixed Deposits Liability', debit: 0, credit: fdLiability },
      { accountHead: 'Capital Account', debit: 0, credit: capitalAccount },
      { accountHead: 'Interest Income', debit: 0, credit: interestIncome }
    ];
  }

  public async getProfitAndLoss(): Promise<any> {
    const entries = await this.getDayBookAsync();
    const interestIncome = entries
      .filter((e) => e.accountHead === 'Interest Income' || e.accountHead === 'Cash Collections')
      .reduce((sum, e) => sum + (e.cashIn || 0) + (e.bankIn || 0), 0);

    const otherIncomes = entries
      .filter((e) => e.accountHead === 'Other Income' || e.accountHead === 'Processing Fees')
      .reduce((sum, e) => sum + (e.cashIn || 0) + (e.bankIn || 0), 0);

    const interestExpenses = entries
      .filter((e) => e.accountHead === 'Interest Expense' || e.accountHead === 'FD Interest Payout')
      .reduce((sum, e) => sum + (e.cashOut || 0) + (e.bankOut || 0), 0);

    const operatingExpenses = entries
      .filter((e) => e.accountHead === 'Operating Expenses' || e.accountHead === 'Salary' || e.accountHead === 'Rent')
      .reduce((sum, e) => sum + (e.cashOut || 0) + (e.bankOut || 0), 0);

    const totalIncome = interestIncome + otherIncomes;
    const totalExpenses = interestExpenses + operatingExpenses;
    const netProfit = totalIncome - totalExpenses;

    return {
      revenue: [
        { label: 'Interest Received', amount: interestIncome },
        { label: 'Other Operational Income', amount: otherIncomes }
      ],
      expenses: [
        { label: 'Interest Paid on FDs', amount: interestExpenses },
        { label: 'Operating & Admin Expenses', amount: operatingExpenses }
      ],
      totalIncome,
      totalExpenses,
      netProfit
    };
  }

  public async getBalanceSheet(): Promise<any> {
    const balances = await this.getBalancesAsync();
    let goldLoanPortfolio = 0;
    let fdLiability = 0;

    if (isMongoConnected()) {
      const activeLoans = await LoanModel.find({
        isDeleted: { $ne: true },
        status: { $in: ['ACTIVE', 'OVERDUE'] }
      }).lean();
      goldLoanPortfolio = activeLoans.reduce((sum: number, l: any) => sum + (l.outstandingPrincipal || 0), 0);

      const activeFds = await FixedDepositModel.find({
        isDeleted: { $ne: true },
        status: 'ACTIVE'
      }).lean();
      fdLiability = activeFds.reduce((sum: number, f: any) => sum + (f.principal || 0), 0);
    } else {
      const loans = googleDriveRepository.readJson<Loan[]>('loans.json', []);
      const fds = googleDriveRepository.readJson<FixedDeposit[]>('fixed_deposits.json', []);
      goldLoanPortfolio = loans
        .filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE')
        .reduce((sum, l) => sum + (l.outstandingPrincipal || 0), 0);
      fdLiability = fds
        .filter((f) => f.status === 'ACTIVE')
        .reduce((sum, f) => sum + (f.principal || 0), 0);
    }

    const totalAssets = Math.max(0, balances.cashInHand) + Math.max(0, balances.cashAtBank) + goldLoanPortfolio;
    const totalLiabilities = fdLiability;
    const netWorth = totalAssets - totalLiabilities;

    return {
      assets: [
        { label: 'Cash in Hand', amount: Math.max(0, balances.cashInHand) },
        { label: 'Cash at Bank', amount: Math.max(0, balances.cashAtBank) },
        { label: 'Gold Loan Portfolio Outstanding', amount: goldLoanPortfolio }
      ],
      liabilities: [
        { label: 'Fixed Deposits from Public', amount: fdLiability }
      ],
      equity: [
        { label: 'Proprietor Capital / Reserves', amount: netWorth }
      ],
      totalAssets,
      totalLiabilities: totalLiabilities + netWorth
    };
  }
}

export const accountingService = new AccountingService();
