import Decimal from 'decimal.js';
import { telegramRepository } from '../telegram/telegram.repository.js';
import { DayBookEntry, Loan, FixedDeposit } from '../types/index.js';

export class AccountingService {
  public async getDayBookAsync(): Promise<DayBookEntry[]> {
    return this.getDayBook();
  }

  public getDayBook(): DayBookEntry[] {
    return telegramRepository.getRecords<DayBookEntry>('DAYBOOK');
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
    return this.getBalances();
  }

  public async addEntryAsync(entryData: Omit<DayBookEntry, 'id' | 'cashBal' | 'bankBal'>, actor?: any): Promise<DayBookEntry> {
    const currentBal = this.getBalances();

    const cashIn = new Decimal(entryData.cashIn || 0);
    const cashOut = new Decimal(entryData.cashOut || 0);
    const bankIn = new Decimal(entryData.bankIn || 0);
    const bankOut = new Decimal(entryData.bankOut || 0);

    const newCashBal = new Decimal(currentBal.cashInHand).plus(cashIn).minus(cashOut).toNumber();
    const newBankBal = new Decimal(currentBal.cashAtBank).plus(bankIn).minus(bankOut).toNumber();

    const id = `db-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newEntry: DayBookEntry = {
      ...entryData,
      id,
      time: entryData.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      cashIn: cashIn.toNumber(),
      cashOut: cashOut.toNumber(),
      bankIn: bankIn.toNumber(),
      bankOut: bankOut.toNumber(),
      cashBal: newCashBal,
      bankBal: newBankBal,
      date: entryData.date || new Date().toLocaleDateString('en-GB')
    };

    await telegramRepository.createRecord('DAYBOOK', id, newEntry, actor);
    return newEntry;
  }

  public addEntry(entryData: Omit<DayBookEntry, 'id' | 'cashBal' | 'bankBal'>): DayBookEntry {
    const currentBal = this.getBalances();

    const cashIn = new Decimal(entryData.cashIn || 0);
    const cashOut = new Decimal(entryData.cashOut || 0);
    const bankIn = new Decimal(entryData.bankIn || 0);
    const bankOut = new Decimal(entryData.bankOut || 0);

    const newCashBal = new Decimal(currentBal.cashInHand).plus(cashIn).minus(cashOut).toNumber();
    const newBankBal = new Decimal(currentBal.cashAtBank).plus(bankIn).minus(bankOut).toNumber();

    const id = `db-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newEntry: DayBookEntry = {
      ...entryData,
      id,
      time: entryData.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      cashIn: cashIn.toNumber(),
      cashOut: cashOut.toNumber(),
      bankIn: bankIn.toNumber(),
      bankOut: bankOut.toNumber(),
      cashBal: newCashBal,
      bankBal: newBankBal,
      date: entryData.date || new Date().toLocaleDateString('en-GB')
    };

    telegramRepository.createRecord('DAYBOOK', id, newEntry).catch(() => {});
    return newEntry;
  }

  public async getTrialBalance(): Promise<any[]> {
    const balances = this.getBalances();
    const loans = telegramRepository.getRecords<Loan>('LOAN');
    const fds = telegramRepository.getRecords<FixedDeposit>('FIXED_DEPOSIT');

    const goldLoanPortfolio = loans
      .filter((l) => !l.isDeleted && (l.status === 'ACTIVE' || l.status === 'OVERDUE'))
      .reduce((sum, l) => sum + (l.outstandingPrincipal || 0), 0);

    const fdLiability = fds
      .filter((f) => !f.isDeleted && f.status === 'ACTIVE')
      .reduce((sum, f) => sum + (f.principal || 0), 0);

    const entries = this.getDayBook();
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
    const entries = this.getDayBook();
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
    const balances = this.getBalances();
    const loans = telegramRepository.getRecords<Loan>('LOAN');
    const fds = telegramRepository.getRecords<FixedDeposit>('FIXED_DEPOSIT');

    const goldLoanPortfolio = loans
      .filter((l) => !l.isDeleted && (l.status === 'ACTIVE' || l.status === 'OVERDUE'))
      .reduce((sum, l) => sum + (l.outstandingPrincipal || 0), 0);

    const fdLiability = fds
      .filter((f) => !f.isDeleted && f.status === 'ACTIVE')
      .reduce((sum, f) => sum + (f.principal || 0), 0);

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
export default accountingService;
