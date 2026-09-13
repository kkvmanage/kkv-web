import {
  AppNotification,
  Loan,
  Receipt,
  FixedDeposit,
  FDInterestPayout,
  Customer,
  FDCustomer
} from '../types';
import {
  formatFDDate,
  compareFDDates,
  getDaysDifference,
  calculateFDInterestSchedule,
  getPendingFDInterestPeriods,
  getFDMaturityInfo,
  normalizeDateString
} from './fdInterestUtils';
import { isMatchingCustomerId, getCanonicalCustomerId } from './customerUtils';

export interface NotificationEngineInput {
  loans: Loan[];
  receipts: Receipt[];
  fixedDeposits: FixedDeposit[];
  fdInterestPayouts: FDInterestPayout[];
  customers: Customer[];
  fdCustomers?: FDCustomer[];
  readNotificationIds: string[];
  todayOverride?: string; // DD-MM-YYYY
}

export interface NotificationSummaryCounts {
  total: number;
  loans: number;
  fixedDeposits: number;
  rental: number;
  overdue: number;
  unread: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

/**
 * Pure deterministic notification generation engine.
 * Derives notifications from active loans, receipts, FDs, and interest payouts.
 */
export const generateAllNotifications = ({
  loans,
  receipts,
  fixedDeposits,
  fdInterestPayouts,
  customers,
  readNotificationIds,
  todayOverride
}: NotificationEngineInput): AppNotification[] => {
  const todayStr = todayOverride || formatFDDate(new Date());
  const notifMap = new Map<string, AppNotification>();

  const isCustSoftDeleted = (customerId: string, name?: string): boolean => {
    const found = customers.find(
      (c) => isMatchingCustomerId(customerId, c) || (name && c.name.toLowerCase() === name.toLowerCase())
    );
    return !!found?.isDeleted;
  };

  const getCustCanonicalId = (customerId: string, name?: string): string => {
    const found = customers.find(
      (c) => isMatchingCustomerId(customerId, c) || (name && c.name.toLowerCase() === name.toLowerCase())
    );
    return found ? getCanonicalCustomerId(found) : customerId;
  };

  // ── 1. LOAN NOTIFICATIONS ──────────────────────────────────────────────────
  loans.forEach((loan) => {
    if (isCustSoftDeleted(loan.customerId, loan.customerName)) return;

    const canonicalCustId = getCustCanonicalId(loan.customerId, loan.customerName);

    // If loan is closed or has zero principal, do not generate active dues
    if (loan.status === 'CLOSED' || loan.outstandingPrincipal <= 0) {
      return;
    }

    const monthlyAmount =
      loan.monthlyInterest > 0
        ? loan.monthlyInterest
        : loan.outstandingPrincipal > 0 && loan.interestRate > 0
        ? Math.round((loan.outstandingPrincipal * loan.interestRate) / 100)
        : 0;

    const rawDueDate = loan.nextDueDate || loan.renewalDate || loan.date;
    const dueDateStr = normalizeDateString(rawDueDate);
    if (!dueDateStr) return;

    // Derive period key (e.g. "2026-10")
    const dateParts = dueDateStr.split('-');
    const periodKey = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}` : dueDateStr;
    const notifId = `loan_${loan.loanNo}_due_${periodKey}`;

    // Check if paid for this period
    const hasPaidReceipt = receipts.some(
      (r) =>
        r.loanNo === loan.loanNo &&
        (r.kind === 'INTEREST PAYMENT' || r.kind === 'REPAYMENT' || r.kind === 'PART PAYMENT') &&
        (r.date === dueDateStr ||
          compareFDDates(r.date, dueDateStr) >= 0 ||
          (r.currentDueDate && normalizeDateString(r.currentDueDate) === dueDateStr))
    );
    const isPaid =
      hasPaidReceipt ||
      (loan.lastInterestPaidDate && compareFDDates(normalizeDateString(loan.lastInterestPaidDate), dueDateStr) >= 0);

    if (isPaid) {
      notifMap.set(notifId, {
        id: notifId,
        category: 'LOAN',
        type: 'PAID',
        priority: 'LOW',
        customerId: canonicalCustId,
        customerName: loan.customerName,
        customerPhone: loan.customerPhone,
        entityId: loan.loanNo,
        entityDbId: loan.id,
        title: '✓ Loan Payment Received',
        message: `${loan.customerName}'s loan ${loan.loanNo} payment of ₹${monthlyAmount.toLocaleString('en-IN')} received.`,
        amount: monthlyAmount,
        dueDate: dueDateStr,
        periodKey,
        read: true,
        actionLabel: 'View Loan',
        createdAt: loan.lastInterestPaidDate ? normalizeDateString(loan.lastInterestPaidDate) : todayStr
      });
    } else {
      const comp = compareFDDates(todayStr, dueDateStr);
      if (comp < 0) {
        // Upcoming (within next 30 days)
        const daysRemaining = getDaysDifference(dueDateStr, todayStr);
        if (daysRemaining <= 30) {
          notifMap.set(notifId, {
            id: notifId,
            category: 'LOAN',
            type: 'UPCOMING',
            priority: 'LOW',
            customerId: canonicalCustId,
            customerName: loan.customerName,
            customerPhone: loan.customerPhone,
            entityId: loan.loanNo,
            entityDbId: loan.id,
            title: '💰 Loan Payment Upcoming',
            message: `${loan.customerName}'s loan ${loan.loanNo} has a monthly payment of ₹${monthlyAmount.toLocaleString('en-IN')} due on ${dueDateStr}.`,
            amount: monthlyAmount,
            dueDate: dueDateStr,
            periodKey,
            daysRemaining,
            read: readNotificationIds.includes(notifId),
            actionLabel: 'View Loan',
            createdAt: todayStr
          });
        }
      } else if (comp === 0) {
        // Due today
        notifMap.set(notifId, {
          id: notifId,
          category: 'LOAN',
          type: 'DUE',
          priority: 'MEDIUM',
          customerId: canonicalCustId,
          customerName: loan.customerName,
          customerPhone: loan.customerPhone,
          entityId: loan.loanNo,
          entityDbId: loan.id,
          title: '🔔 Loan Payment Due Today',
          message: `${loan.customerName}'s loan ${loan.loanNo} has ₹${monthlyAmount.toLocaleString('en-IN')} due today.`,
          amount: monthlyAmount,
          dueDate: dueDateStr,
          periodKey,
          daysRemaining: 0,
          read: readNotificationIds.includes(notifId),
          actionLabel: 'View Loan',
          createdAt: todayStr
        });
      } else {
        // Overdue
        const daysOverdue = getDaysDifference(todayStr, dueDateStr);
        notifMap.set(notifId, {
          id: notifId,
          category: 'LOAN',
          type: 'OVERDUE',
          priority: daysOverdue > 30 ? 'CRITICAL' : 'HIGH',
          customerId: canonicalCustId,
          customerName: loan.customerName,
          customerPhone: loan.customerPhone,
          entityId: loan.loanNo,
          entityDbId: loan.id,
          title: '⚠ Loan Payment Overdue',
          message: `${loan.customerName}'s loan ${loan.loanNo} payment of ₹${monthlyAmount.toLocaleString('en-IN')} was due on ${dueDateStr} (${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue).`,
          amount: monthlyAmount,
          dueDate: dueDateStr,
          periodKey,
          daysOverdue,
          read: readNotificationIds.includes(notifId),
          actionLabel: 'View Loan',
          createdAt: todayStr
        });
      }
    }

    // Check Loan Renewal Reminder
    if (loan.renewalDate) {
      const rnDateStr = normalizeDateString(loan.renewalDate);
      if (rnDateStr && compareFDDates(todayStr, rnDateStr) >= 0) {
        const rnNotifId = `loan_${loan.loanNo}_renewal_${rnDateStr}`;
        notifMap.set(rnNotifId, {
          id: rnNotifId,
          category: 'LOAN',
          type: 'RENEWAL',
          priority: 'HIGH',
          customerId: canonicalCustId,
          customerName: loan.customerName,
          customerPhone: loan.customerPhone,
          entityId: loan.loanNo,
          entityDbId: loan.id,
          title: '🔄 Loan Renewal Due',
          message: `Loan ${loan.loanNo} for ${loan.customerName} reached its renewal date on ${rnDateStr}.`,
          amount: loan.outstandingPrincipal,
          dueDate: rnDateStr,
          read: readNotificationIds.includes(rnNotifId),
          actionLabel: 'View Loan',
          createdAt: todayStr
        });
      }
    }
  });

  // ── 2. FIXED DEPOSIT NOTIFICATIONS ─────────────────────────────────────────
  fixedDeposits.forEach((fd) => {
    if (isCustSoftDeleted(fd.customerId, fd.depositorName)) return;

    // Fully withdrawn FDs stop generating future notifications
    if (fd.status === 'WITHDRAWN') return;

    const canonicalCustId = getCustCanonicalId(fd.customerId, fd.depositorName);

    // 2A. Monthly Interest Payout Schedule
    // 1) Paid interest payouts
    const paidPayouts = fdInterestPayouts.filter(
      (p) => (p.fdNo === fd.fdNo || (p.fdId && p.fdId === fd.id)) && p.status === 'PAID'
    );
    paidPayouts.forEach((p) => {
      const notifId = `fd_${fd.fdNo}_interest_${p.periodKey || p.dueDate}`;
      notifMap.set(notifId, {
        id: notifId,
        category: 'FIXED_DEPOSIT',
        type: 'PAID',
        priority: 'LOW',
        customerId: canonicalCustId,
        customerName: fd.depositorName,
        customerPhone: fd.phone,
        entityId: fd.fdNo,
        entityDbId: fd.id,
        title: '✓ FD Interest Paid',
        message: `₹${p.amount.toLocaleString('en-IN')} paid for ${fd.depositorName}'s FD ${fd.fdNo} on ${p.date || p.dueDate}.`,
        amount: p.amount,
        dueDate: p.dueDate,
        periodKey: p.periodKey,
        read: true,
        actionLabel: 'View FD',
        createdAt: p.date || p.dueDate || todayStr
      });
    });

    // 2) Pending / Overdue interest periods
    const pendingPeriods = getPendingFDInterestPeriods(fd, fdInterestPayouts, todayStr);
    pendingPeriods.forEach((p) => {
      const notifId = `fd_${fd.fdNo}_interest_${p.periodKey}`;
      const isOverdue = p.daysOverdue > 0;
      notifMap.set(notifId, {
        id: notifId,
        category: 'FIXED_DEPOSIT',
        type: isOverdue ? 'OVERDUE' : 'DUE',
        priority: isOverdue && p.daysOverdue > 30 ? 'CRITICAL' : 'HIGH',
        customerId: canonicalCustId,
        customerName: fd.depositorName,
        customerPhone: fd.phone,
        entityId: fd.fdNo,
        entityDbId: fd.id,
        title: isOverdue ? '⚠ FD Interest Pending' : '💰 FD Interest Due',
        message: isOverdue
          ? `${fd.depositorName}'s FD ${fd.fdNo} interest of ₹${p.amount.toLocaleString('en-IN')} was due on ${p.dueDate} (${p.daysOverdue} ${p.daysOverdue === 1 ? 'day' : 'days'} overdue).`
          : `₹${p.amount.toLocaleString('en-IN')} interest is due for ${fd.depositorName}'s FD ${fd.fdNo} on ${p.dueDate}.`,
        amount: p.amount,
        dueDate: p.dueDate,
        periodKey: p.periodKey,
        daysOverdue: p.daysOverdue,
        read: readNotificationIds.includes(notifId),
        actionLabel: 'Pay Interest',
        createdAt: todayStr
      });
    });

    // 3) Upcoming next interest payout
    const sched = calculateFDInterestSchedule(fd, fdInterestPayouts, todayStr);
    if (sched.status === 'NOT_DUE' && sched.nextPayoutDate) {
      const notifId = `fd_${fd.fdNo}_interest_${sched.periodKey}`;
      const daysRemaining = Math.max(0, Math.abs(sched.daysPending || 0));
      if (daysRemaining <= 30) {
        notifMap.set(notifId, {
          id: notifId,
          category: 'FIXED_DEPOSIT',
          type: 'UPCOMING',
          priority: 'LOW',
          customerId: canonicalCustId,
          customerName: fd.depositorName,
          customerPhone: fd.phone,
          entityId: fd.fdNo,
          entityDbId: fd.id,
          title: '🏦 FD Interest Upcoming',
          message: `${fd.depositorName}'s FD ${fd.fdNo} has a monthly interest payout of ₹${sched.payoutAmount.toLocaleString('en-IN')} scheduled for ${sched.nextPayoutDate}.`,
          amount: sched.payoutAmount,
          dueDate: sched.nextPayoutDate,
          periodKey: sched.periodKey,
          daysRemaining,
          read: readNotificationIds.includes(notifId),
          actionLabel: 'View FD',
          createdAt: todayStr
        });
      }
    }

    // 2B. Maturity & Renewal Notifications
    const matInfo = getFDMaturityInfo(fd, todayStr);
    const fdPrincipal = fd.remainingPrincipal ?? fd.principal;

    if (matInfo.maturityStatus === 'MATURED') {
      const matNotifId = `fd_${fd.fdNo}_maturity_${fd.maturityDate}`;
      notifMap.set(matNotifId, {
        id: matNotifId,
        category: 'FIXED_DEPOSIT',
        type: 'MATURITY',
        priority: 'HIGH',
        customerId: canonicalCustId,
        customerName: fd.depositorName,
        customerPhone: fd.phone,
        entityId: fd.fdNo,
        entityDbId: fd.id,
        title: '✅ FD Matured',
        message: `FD ${fd.fdNo} for ${fd.depositorName} matured on ${fd.maturityDate}${
          matInfo.daysSinceMaturity > 0 ? ` (${matInfo.daysSinceMaturity} days ago)` : ''
        }.`,
        amount: fdPrincipal,
        dueDate: fd.maturityDate,
        daysOverdue: matInfo.daysSinceMaturity,
        read: readNotificationIds.includes(matNotifId),
        actionLabel: 'View FD',
        createdAt: todayStr
      });

      const rnNotifId = `fd_${fd.fdNo}_renewal_${fd.maturityDate}`;
      notifMap.set(rnNotifId, {
        id: rnNotifId,
        category: 'FIXED_DEPOSIT',
        type: 'RENEWAL',
        priority: 'MEDIUM',
        customerId: canonicalCustId,
        customerName: fd.depositorName,
        customerPhone: fd.phone,
        entityId: fd.fdNo,
        entityDbId: fd.id,
        title: '🔄 FD Renewal Available',
        message: `FD ${fd.fdNo} for ${fd.depositorName} is ready for renewal / extension (Matured on ${fd.maturityDate}).`,
        amount: fdPrincipal,
        dueDate: fd.maturityDate,
        read: readNotificationIds.includes(rnNotifId),
        actionLabel: 'Renew FD',
        createdAt: todayStr
      });
    } else if (matInfo.maturityStatus === 'NEAR_MATURITY') {
      const matNotifId = `fd_${fd.fdNo}_maturity_${fd.maturityDate}`;
      notifMap.set(matNotifId, {
        id: matNotifId,
        category: 'FIXED_DEPOSIT',
        type: 'MATURITY',
        priority: 'HIGH',
        customerId: canonicalCustId,
        customerName: fd.depositorName,
        customerPhone: fd.phone,
        entityId: fd.fdNo,
        entityDbId: fd.id,
        title: '🔔 FD Maturity Approaching',
        message: `${fd.depositorName}'s FD ${fd.fdNo} matures on ${fd.maturityDate} (${matInfo.remainingDays} days remaining).`,
        amount: fdPrincipal,
        dueDate: fd.maturityDate,
        daysRemaining: matInfo.remainingDays,
        read: readNotificationIds.includes(matNotifId),
        actionLabel: 'View FD',
        createdAt: todayStr
      });
    }
  });

  const allNotifications = Array.from(notifMap.values()).map((n) => ({
    ...n,
    module: n.module || ('FINANCE' as const)
  }));

  // Sort: Priority DESC > Days Remaining ASC / Overdue DESC > CreatedAt DESC
  return allNotifications.sort((a, b) => {
    const pA = PRIORITY_ORDER[a.priority] || 1;
    const pB = PRIORITY_ORDER[b.priority] || 1;
    if (pB !== pA) return pB - pA;

    // Overdue items sorted by daysOverdue DESC
    if (a.type === 'OVERDUE' && b.type === 'OVERDUE') {
      return (b.daysOverdue || 0) - (a.daysOverdue || 0);
    }

    // Upcoming items sorted by daysRemaining ASC
    if (a.type === 'UPCOMING' && b.type === 'UPCOMING') {
      return (a.daysRemaining || 0) - (b.daysRemaining || 0);
    }

    // Non-paid before paid
    if (a.type !== 'PAID' && b.type === 'PAID') return -1;
    if (a.type === 'PAID' && b.type !== 'PAID') return 1;

    // Fallback date compare
    return compareFDDates(b.dueDate || b.createdAt, a.dueDate || a.createdAt);
  });
};

/**
 * Calculates dynamic summary counts for the Notification Center.
 */
export const calculateNotificationCounts = (
  notifications: AppNotification[]
): NotificationSummaryCounts => {
  let loans = 0;
  let fixedDeposits = 0;
  let rental = 0;
  let overdue = 0;
  let unread = 0;

  notifications.forEach((n) => {
    if (n.category === 'LOAN') loans += 1;
    if (n.category === 'FIXED_DEPOSIT') fixedDeposits += 1;
    if (n.category === 'RENTAL' || n.module === 'RENTAL') rental += 1;
    if (n.type === 'OVERDUE' || n.type === 'RENT_OVERDUE') overdue += 1;
    if (!n.read && n.type !== 'PAID') unread += 1;
  });

  return {
    total: notifications.length,
    loans,
    fixedDeposits,
    rental,
    overdue,
    unread
  };
};
