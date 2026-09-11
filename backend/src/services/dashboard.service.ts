import Decimal from 'decimal.js';
import { customerService } from './customer.service.js';
import { loanService } from './loan.service.js';
import { receiptService } from './receipt.service.js';
import { fdService } from './fd.service.js';
import { accountingService } from './accounting.service.js';
import { Loan, Receipt } from '../types/index.js';

export interface MonthlyTrend {
  monthKey: string;     // e.g. "2026-09"
  month: string;        // e.g. "Sep 2026"
  monthShort: string;   // e.g. "Sep"
  disbursed: number;
  collected: number;
}

export interface StatusDistribution {
  active: number;
  overdue: number;
  closed: number;
  total: number;
  activePercent: number;
  overduePercent: number;
  closedPercent: number;
}

export interface DashboardSummaryData {
  totalDisbursed: number;
  totalCollected: number;
  totalOutstanding: number;
  activeBorrowers: number;
  totalCustomers: number;
  activeLoansCount: number;
  overdueLoansCount: number;
  closedLoansCount: number;
  totalLoansCount: number;
  activeFDsCount: number;
  cashInHand: number;
  cashAtBank: number;
  monthlyTrends: MonthlyTrend[];
  statusDistribution: StatusDistribution;
  recentTransactions: Array<{
    id: string;
    receiptNo: number;
    kind: string;
    customerName: string;
    loanNo: string;
    amount: number;
    date: string;
    paymentMode?: string;
  }>;
}

function parseRecordDate(dateStr?: string, createdAt?: string): Date | null {
  if (createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  // DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[-/]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(trimmed)) {
    const parts = trimmed.split(/[-/]/);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

export class DashboardService {
  public getSummary(user?: any, branchId?: string): DashboardSummaryData {
    let customers = customerService.getAll();
    let loans = loanService.getAll();
    let receipts = receiptService.getAll();
    let fds = fdService.getDeposits();
    const balances = accountingService.getBalances();

    // Enforce branch scope
    if (user && user.role !== 'ADMIN') {
      const assignedBranch = user.branchId || user.branch || user.department;
      if (assignedBranch) {
        loans = loans.filter((l: any) => !l.branchId || l.branchId === assignedBranch);
        customers = customers.filter((c: any) => !c.branchId || c.branchId === assignedBranch);
        receipts = receipts.filter((r: any) => !r.branchId || r.branchId === assignedBranch);
        fds = fds.filter((f: any) => !f.branchId || f.branchId === assignedBranch);
      }
    } else if (branchId) {
      loans = loans.filter((l: any) => l.branchId === branchId);
      customers = customers.filter((c: any) => c.branchId === branchId);
      receipts = receipts.filter((r: any) => r.branchId === branchId);
      fds = fds.filter((f: any) => f.branchId === branchId);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalDisbursed = new Decimal(0);
    let totalOutstanding = new Decimal(0);
    let totalCollected = new Decimal(0);

    let activeLoansCount = 0;
    let overdueLoansCount = 0;
    let closedLoansCount = 0;

    const activeBorrowerCustomerIds = new Set<string>();

    loans.forEach((l) => {
      totalDisbursed = totalDisbursed.plus(new Decimal(l.principal || l.disbursedAmount || 0));

      if (l.status === 'CLOSED') {
        closedLoansCount++;
      } else if (l.status === 'OVERDUE') {
        overdueLoansCount++;
        totalOutstanding = totalOutstanding.plus(new Decimal(l.outstandingPrincipal || 0));
        if (l.customerId) activeBorrowerCustomerIds.add(String(l.customerId));
      } else {
        // ACTIVE status check
        const nextDue = l.nextDueDate ? parseRecordDate(l.nextDueDate) : null;
        if (nextDue && nextDue < today) {
          overdueLoansCount++;
        } else {
          activeLoansCount++;
        }
        totalOutstanding = totalOutstanding.plus(new Decimal(l.outstandingPrincipal || 0));
        if (l.customerId) activeBorrowerCustomerIds.add(String(l.customerId));
      }
    });

    receipts.forEach((r) => {
      // Repayments, interest payments, loan closure payments are collected inflow
      if (r.kind !== 'NEW LOAN') {
        totalCollected = totalCollected.plus(new Decimal(r.amount || 0));
      }
    });

    const totalLoansCount = loans.length;
    const activeFDs = fds.filter((f) => f.status === 'ACTIVE');

    // ── Generate 6-Month Historical Trends ───────────────────────────────────
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const monthlyTrends: MonthlyTrend[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const monthShort = monthNames[monthIdx];
      const monthFull = `${monthShort} ${year}`;

      monthlyTrends.push({
        monthKey,
        month: monthFull,
        monthShort,
        disbursed: 0,
        collected: 0
      });
    }

    const trendMap = new Map<string, { disbursed: Decimal; collected: Decimal }>();
    monthlyTrends.forEach((t) => {
      trendMap.set(t.monthKey, { disbursed: new Decimal(0), collected: new Decimal(0) });
    });

    loans.forEach((l) => {
      const lDate = parseRecordDate(l.date, l.createdAt);
      if (lDate) {
        const key = `${lDate.getFullYear()}-${String(lDate.getMonth() + 1).padStart(2, '0')}`;
        if (trendMap.has(key)) {
          const entry = trendMap.get(key)!;
          entry.disbursed = entry.disbursed.plus(new Decimal(l.principal || l.disbursedAmount || 0));
        }
      }
    });

    receipts.forEach((r) => {
      if (r.kind !== 'NEW LOAN') {
        const rDate = parseRecordDate(r.date, (r as any).createdAt);
        if (rDate) {
          const key = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`;
          if (trendMap.has(key)) {
            const entry = trendMap.get(key)!;
            entry.collected = entry.collected.plus(new Decimal(r.amount || 0));
          }
        }
      }
    });

    monthlyTrends.forEach((t) => {
      const entry = trendMap.get(t.monthKey);
      if (entry) {
        t.disbursed = entry.disbursed.toNumber();
        t.collected = entry.collected.toNumber();
      }
    });

    // ── Status Distribution Calculations ────────────────────────────────────
    const activePercent = totalLoansCount > 0 ? Math.round((activeLoansCount / totalLoansCount) * 100) : 0;
    const overduePercent = totalLoansCount > 0 ? Math.round((overdueLoansCount / totalLoansCount) * 100) : 0;
    const closedPercent = totalLoansCount > 0 ? Math.max(0, 100 - activePercent - overduePercent) : 0;

    const statusDistribution: StatusDistribution = {
      active: activeLoansCount,
      overdue: overdueLoansCount,
      closed: closedLoansCount,
      total: totalLoansCount,
      activePercent,
      overduePercent,
      closedPercent
    };

    // ── Recent Financial Transactions ────────────────────────────────────────
    const recentTransactions = receipts.slice(0, 5).map((r) => ({
      id: r.id || `RCPT-${r.receiptNo}`,
      receiptNo: r.receiptNo,
      kind: r.kind,
      customerName: r.customerName || 'Customer',
      loanNo: r.loanNo || '—',
      amount: r.amount,
      date: r.date,
      paymentMode: r.paymentMode
    }));

    return {
      totalDisbursed: totalDisbursed.toNumber(),
      totalCollected: totalCollected.toNumber(),
      totalOutstanding: totalOutstanding.toNumber(),
      activeBorrowers: activeBorrowerCustomerIds.size,
      totalCustomers: customers.length,
      activeLoansCount,
      overdueLoansCount,
      closedLoansCount,
      totalLoansCount,
      activeFDsCount: activeFDs.length,
      cashInHand: balances.cashInHand,
      cashAtBank: balances.cashAtBank,
      monthlyTrends,
      statusDistribution,
      recentTransactions
    };
  }
}

export const dashboardService = new DashboardService();

