import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Printer,
  Download,
  X,
  User,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  DollarSign,
  FileText
} from 'lucide-react';
import { Customer, Loan, Receipt } from '../types';
import { getCanonicalCustomerId, isMatchingCustomerId } from '../utils/customerUtils';
import {
  formatFDDate,
  normalizeDateString,
  compareFDDates,
  getDaysDifference,
  addCalendarMonths
} from '../utils/fdInterestUtils';
import { getOverdueEscalationDetails } from '../utils/loanCalculationUtils';
import { PageHeader, StatGrid, StatCard } from '../components/ui';

export const PendingLoans: React.FC = () => {
  const {
    loans,
    customers,
    receipts,
    addReceipt,
    showToast,
    masterControlSettings
  } = useApp();

  // Normalized today's date
  const todayStr = useMemo(() => formatFDDate(new Date()), []);

  // ── Step 1: Customer ID First State (STRICTLY NULL ON INITIAL LOAD) ─────────
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // ── Step 2 & 3: Loan Selection & Payment Modal State (STRICTLY NULL / CLOSED) ─
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  // ── Payment Form State ──────────────────────────────────────────────────────
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [receiptType, setReceiptType] = useState<
    'Interest Payment' | 'Principal Payment' | 'Interest + Principal' | 'Full Loan Closure'
  >('Interest Payment');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [principalPaidInput, setPrincipalPaidInput] = useState<string>('');
  const [interestPaidInput, setInterestPaidInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'UPI'>('Cash');
  const [bankName, setBankName] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [notes, setNotes] = useState<string>('Monthly loan collection');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ── Modals & Lightbox State ────────────────────────────────────────────────
  const [lastGeneratedReceipt, setLastGeneratedReceipt] = useState<Receipt | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [viewingLoanHistory, setViewingLoanHistory] = useState<Loan | null>(null);

  // ── Requirement 17: Display-Only Summary Cards Metrics ──────────────────────
  const summaryMetrics = useMemo(() => {
    const activeLoans = loans.filter((l) => l.status !== 'CLOSED');
    let overdueCount = 0;
    let overdueAmount = 0;

    activeLoans.forEach((l) => {
      const rawDueDate = l.nextDueDate || l.renewalDate || l.date;
      const dueDateStr = normalizeDateString(rawDueDate);
      const comp = compareFDDates(todayStr, dueDateStr);
      if (comp > 0) {
        overdueCount++;
        const baseMonthly =
          l.monthlyInterest > 0
            ? l.monthlyInterest
            : Math.round(((l.outstandingPrincipal ?? l.principal) * (l.interestRate || 1.5)) / 100);
        overdueAmount += baseMonthly;
      }
    });

    const collectedToday = receipts
      .filter((r) => r.date === todayStr)
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      totalPending: activeLoans.length,
      overdueAccounts: overdueCount,
      totalOverdueAmount: overdueAmount,
      collectedToday
    };
  }, [loans, receipts, todayStr]);

  // ── Customer Search Filter (Customer ID prioritized) ───────────────────────
  const matchingCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return [];

    return customers.filter((c) => {
      if (c.isDeleted) return false;
      const canonicalId = getCanonicalCustomerId(c).toLowerCase();
      const numIdStr = c.customerId ? c.customerId.toString() : '';
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();

      // Check if user searched for a loan number directly (e.g. GL-001)
      const matchesLoanNo = loans.some(
        (l) => isMatchingCustomerId(l.customerId, c) && l.loanNo.toLowerCase().includes(q)
      );

      return (
        canonicalId.includes(q) ||
        numIdStr.includes(q) ||
        isMatchingCustomerId(q, c) ||
        name.includes(q) ||
        phone.includes(q) ||
        matchesLoanNo
      );
    });
  }, [customerSearchQuery, customers, loans]);

  // ── Quick Select Chips for Testing ─────────────────────────────────────────
  const sampleCustomerChips = useMemo(() => {
    return customers
      .filter((c) => !c.isDeleted)
      .slice(0, 4)
      .map((c) => ({
        id: c.id,
        canonicalId: getCanonicalCustomerId(c),
        name: c.name,
        phone: c.phone,
        customer: c
      }));
  }, [customers]);

  // ── Helper: Resolve Customer Details for a Loan ───────────────────────────
  const resolveLoanCustomer = (l: Loan) => {
    const found = customers.find((c) => isMatchingCustomerId(l.customerId, c));
    return {
      name: found ? found.name : l.customerName,
      custId: found ? getCanonicalCustomerId(found) : (l.customerId || 'CUST-XXXX'),
      phone: found ? found.phone : (l.customerPhone || 'N/A'),
      address: found ? found.currentAddress : (l.customerCurrentAddress || 'N/A'),
      photo: found?.customerPhoto || null,
      customer: found || null
    };
  };

  // ── Helper: Calculate Due Metrics for a Loan ───────────────────────────────
  const getLoanDueMetrics = (l: Loan) => {
    const rawDueDate = l.nextDueDate || l.renewalDate || l.date;
    const dueDateStr = normalizeDateString(rawDueDate);
    const outstanding = l.outstandingPrincipal ?? l.principal;
    const baseMonthlyInterest =
      l.monthlyInterest > 0
        ? l.monthlyInterest
        : Math.round((outstanding * (l.interestRate || 1.5)) / 100);

    const periodReceipts = receipts.filter(
      (r) =>
        (r.loanNo === l.loanNo || r.loanId === l.id) &&
        (r.kind === 'INTEREST PAYMENT' || r.kind === 'REPAYMENT' || r.kind === 'PART PAYMENT' || r.kind === 'LOAN CLOSURE') &&
        (r.date === dueDateStr ||
          compareFDDates(r.date, dueDateStr) >= 0 ||
          (r.currentDueDate && normalizeDateString(r.currentDueDate) === dueDateStr))
    );

    const interestAlreadyPaid = periodReceipts.reduce((sum, r) => sum + (r.interestComponent || 0), 0);
    const isInterestFullyPaid =
      interestAlreadyPaid >= baseMonthlyInterest ||
      (l.lastInterestPaidDate && compareFDDates(normalizeDateString(l.lastInterestPaidDate), dueDateStr) >= 0);

    let daysOverdue = 0;
    let statusText: 'CLOSED' | 'PAID' | 'PARTIALLY PAID' | 'OVERDUE' | 'DUE TODAY' | 'UPCOMING' | 'NOT DUE' = 'UPCOMING';

    if (l.status === 'CLOSED' || outstanding <= 0) {
      statusText = 'CLOSED';
    } else if (isInterestFullyPaid) {
      statusText = 'PAID';
    } else if (interestAlreadyPaid > 0 && interestAlreadyPaid < baseMonthlyInterest) {
      statusText = 'PARTIALLY PAID';
    } else {
      const comp = compareFDDates(todayStr, dueDateStr);
      if (comp > 0) {
        statusText = 'OVERDUE';
        daysOverdue = Math.max(0, getDaysDifference(todayStr, dueDateStr));
      } else if (comp === 0) {
        statusText = 'DUE TODAY';
      } else {
        statusText = 'NOT DUE';
      }
    }

    const escalationDetails = getOverdueEscalationDetails(daysOverdue, l.interestRate || 1.5, masterControlSettings);
    const applicableInterestRate = escalationDetails.currentRate;
    const isEscalated = escalationDetails.isEscalated;

    // When overdue with escalation active, compute monthly interest dynamically based on applicable tier rate
    const effectiveMonthlyInterest = (statusText === 'OVERDUE' && masterControlSettings?.overdueEscalationEnabled)
      ? Math.round((outstanding * applicableInterestRate) / 100)
      : baseMonthlyInterest;

    const dynamicRemainingInterestDue = isInterestFullyPaid ? 0 : Math.max(0, effectiveMonthlyInterest - interestAlreadyPaid);

    const penaltyRatePerDay = masterControlSettings?.overduePenaltyPerDayPercent ?? 0;
    const penaltyAmount = (statusText === 'OVERDUE' && penaltyRatePerDay > 0)
      ? Math.round((dynamicRemainingInterestDue * penaltyRatePerDay * daysOverdue) / 100)
      : 0;

    const totalDue = dynamicRemainingInterestDue + penaltyAmount;

    return {
      dueDateStr,
      outstanding,
      baseMonthlyInterest: effectiveMonthlyInterest,
      contractualMonthlyInterest: baseMonthlyInterest,
      interestAlreadyPaid,
      remainingInterestDue: dynamicRemainingInterestDue,
      isInterestFullyPaid,
      daysOverdue,
      statusText,
      penaltyAmount,
      totalDue,
      applicableInterestRate,
      isEscalated,
      escalationDetails
    };
  };

  // ── Selected Customer's Loans List ─────────────────────────────────────────
  const customerLoans = useMemo(() => {
    if (!selectedCustomer) return [];
    return loans.filter((l) => isMatchingCustomerId(l.customerId, selectedCustomer));
  }, [loans, selectedCustomer]);

  // ── Helper: Calculate Unpaid & Historical Periods for Selected Loan ────────
  const loanPeriodsBreakdown = useMemo(() => {
    if (!selectedLoan) return [];

    const periods: Array<{
      periodKey: string;
      monthName: string;
      dueDateStr: string;
      interestDue: number;
      interestPaid: number;
      isPaid: boolean;
      receiptNo?: number;
      daysOverdue: number;
      statusText: 'PAID' | 'OVERDUE' | 'DUE TODAY' | 'UPCOMING';
    }> = [];

    const rawDueDate = selectedLoan.nextDueDate || selectedLoan.renewalDate || selectedLoan.date;
    const canonicalDueDate = normalizeDateString(rawDueDate);
    const normalizedPayment = paymentDate ? normalizeDateString(paymentDate) : todayStr;
    const baseMonthly =
      selectedLoan.monthlyInterest > 0
        ? selectedLoan.monthlyInterest
        : Math.round(((selectedLoan.outstandingPrincipal ?? selectedLoan.principal) * (selectedLoan.interestRate || 1.5)) / 100);

    const parts = canonicalDueDate.split('-');
    const dueDay = parseInt(parts[0], 10) || 2;
    const dueMonth = parseInt(parts[1], 10) || 10;
    const dueYear = parseInt(parts[2], 10) || 2026;

    // Generate up to 3 consecutive periods: prior missed month, contractual due month, upcoming month
    const monthOffsets = [-1, 0, 1];
    monthOffsets.forEach((offset) => {
      let m = dueMonth + offset;
      let y = dueYear;
      if (m < 1) {
        m += 12;
        y -= 1;
      }
      if (m > 12) {
        m -= 12;
        y += 1;
      }

      const pDueDateStr = `${String(dueDay).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
      const pDateObj = new Date(y, m - 1, dueDay);
      const monthName = pDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const periodKey = `${selectedLoan.loanNo} + ${y}-${String(m).padStart(2, '0')}`;

      // Check matching receipts
      const mReceipts = receipts.filter(
        (r) =>
          (r.loanNo === selectedLoan.loanNo || r.loanId === selectedLoan.id) &&
          (r.kind === 'INTEREST PAYMENT' || r.kind === 'REPAYMENT' || r.kind === 'PART PAYMENT' || r.kind === 'LOAN CLOSURE') &&
          (r.currentDueDate === pDueDateStr || r.date === pDueDateStr || (r.notes && r.notes.includes(periodKey)))
      );

      const paidAmt = mReceipts.reduce((sum, r) => sum + (r.interestComponent || 0), 0);
      const isPaid = Boolean(
        paidAmt >= baseMonthly ||
          (offset < 0 &&
            selectedLoan.lastInterestPaidDate &&
            compareFDDates(normalizeDateString(selectedLoan.lastInterestPaidDate), pDueDateStr) >= 0)
      );

      let daysOverdue = 0;
      let statusText: 'PAID' | 'OVERDUE' | 'DUE TODAY' | 'UPCOMING' = 'UPCOMING';

      if (isPaid) {
        statusText = 'PAID';
      } else {
        const comp = compareFDDates(normalizedPayment, pDueDateStr);
        if (comp > 0) {
          statusText = 'OVERDUE';
          daysOverdue = Math.max(0, getDaysDifference(normalizedPayment, pDueDateStr));
        } else if (comp === 0) {
          statusText = 'DUE TODAY';
        } else {
          statusText = 'UPCOMING';
        }
      }

      periods.push({
        periodKey,
        monthName,
        dueDateStr: pDueDateStr,
        interestDue: baseMonthly,
        interestPaid: paidAmt,
        isPaid,
        receiptNo: mReceipts[0]?.receiptNo,
        daysOverdue,
        statusText
      });
    });

    return periods;
  }, [selectedLoan, paymentDate, receipts, todayStr]);

  // ── Collection Real-time Calculations ──────────────────────────────────────
  const collectionMetrics = useMemo(() => {
    if (!selectedLoan) return null;

    const rawDueDate = selectedLoan.nextDueDate || selectedLoan.renewalDate || selectedLoan.date;
    const dueDateStr = normalizeDateString(rawDueDate);
    const outstanding = selectedLoan.outstandingPrincipal ?? selectedLoan.principal;
    const baseMonthlyInterest =
      selectedLoan.monthlyInterest > 0
        ? selectedLoan.monthlyInterest
        : Math.round((outstanding * (selectedLoan.interestRate || 1.5)) / 100);

    const normalizedPaymentDate = paymentDate ? normalizeDateString(paymentDate) : todayStr;

    // Previous payment check for this period
    const periodReceipts = receipts.filter(
      (r) =>
        (r.loanNo === selectedLoan.loanNo || r.loanId === selectedLoan.id) &&
        (r.kind === 'INTEREST PAYMENT' || r.kind === 'REPAYMENT' || r.kind === 'PART PAYMENT' || r.kind === 'LOAN CLOSURE') &&
        (r.date === dueDateStr ||
          compareFDDates(r.date, dueDateStr) >= 0 ||
          (r.currentDueDate && normalizeDateString(r.currentDueDate) === dueDateStr))
    );

    const interestAlreadyPaid = periodReceipts.reduce((sum, r) => sum + (r.interestComponent || 0), 0);
    const isPeriodAlreadyFullyPaid =
      interestAlreadyPaid >= baseMonthlyInterest ||
      (selectedLoan.lastInterestPaidDate &&
        compareFDDates(normalizeDateString(selectedLoan.lastInterestPaidDate), dueDateStr) >= 0);

    // Compare Payment Date with Due Date
    const comp = compareFDDates(normalizedPaymentDate, dueDateStr);
    let daysOverdue = 0;
    let timingStatus: 'OVERDUE' | 'DUE TODAY' | 'EARLY PAYMENT' = 'DUE TODAY';

    if (comp > 0) {
      timingStatus = 'OVERDUE';
      daysOverdue = Math.max(0, getDaysDifference(normalizedPaymentDate, dueDateStr));
    } else if (comp === 0) {
      timingStatus = 'DUE TODAY';
    } else {
      timingStatus = 'EARLY PAYMENT';
    }

    const escalationDetails = getOverdueEscalationDetails(daysOverdue, selectedLoan.interestRate || 1.5, masterControlSettings);
    const applicableInterestRate = escalationDetails.currentRate;
    const isEscalated = escalationDetails.isEscalated;

    const effectiveMonthlyInterest = (timingStatus === 'OVERDUE' && masterControlSettings?.overdueEscalationEnabled)
      ? Math.round((outstanding * applicableInterestRate) / 100)
      : baseMonthlyInterest;

    const dynamicRemainingInterestDue = isPeriodAlreadyFullyPaid ? 0 : Math.max(0, effectiveMonthlyInterest - interestAlreadyPaid);

    const penaltyRatePerDay = masterControlSettings?.overduePenaltyPerDayPercent ?? 0;
    const penaltyAmount = (timingStatus === 'OVERDUE' && penaltyRatePerDay > 0)
      ? Math.round((dynamicRemainingInterestDue * penaltyRatePerDay * daysOverdue) / 100)
      : 0;

    const totalInterestDueWithPenalty = dynamicRemainingInterestDue + penaltyAmount;

    return {
      dueDateStr,
      normalizedPaymentDate,
      outstanding,
      baseMonthlyInterest: effectiveMonthlyInterest,
      contractualMonthlyInterest: baseMonthlyInterest,
      interestAlreadyPaid,
      isPeriodAlreadyFullyPaid,
      remainingInterestDue: dynamicRemainingInterestDue,
      timingStatus,
      daysOverdue,
      penaltyAmount,
      totalInterestDueWithPenalty,
      applicableInterestRate,
      isEscalated,
      escalationDetails
    };
  }, [selectedLoan, paymentDate, receipts, todayStr, masterControlSettings]);

  // Update inputs when collection target or receiptType changes
  useEffect(() => {
    if (!selectedLoan || !collectionMetrics) return;

    if (receiptType === 'Interest Payment') {
      const defaultAmt = collectionMetrics.totalInterestDueWithPenalty;
      setAmountReceived(defaultAmt > 0 ? defaultAmt.toString() : '');
      setInterestPaidInput(defaultAmt > 0 ? defaultAmt.toString() : '');
      setPrincipalPaidInput('0');
    } else if (receiptType === 'Principal Payment') {
      setAmountReceived('');
      setInterestPaidInput('0');
      setPrincipalPaidInput('');
    } else if (receiptType === 'Interest + Principal') {
      const intVal = collectionMetrics.totalInterestDueWithPenalty;
      setInterestPaidInput(intVal.toString());
      setPrincipalPaidInput('');
      setAmountReceived(intVal > 0 ? intVal.toString() : '');
    } else if (receiptType === 'Full Loan Closure') {
      const fullPrin = collectionMetrics.outstanding;
      const fullInt = collectionMetrics.totalInterestDueWithPenalty;
      const totalSettlement = fullPrin + fullInt;
      setPrincipalPaidInput(fullPrin.toString());
      setInterestPaidInput(fullInt.toString());
      setAmountReceived(totalSettlement.toString());
    }
  }, [selectedLoan, receiptType, collectionMetrics]);

  // ── Action: Explicit User Selection of a Loan (Opens Collection Modal) ──────
  const handleSelectLoan = (l: Loan) => {
    setSelectedLoan(l);
    setReceiptType('Interest Payment');
    setPaymentMethod('Cash');
    setBankName('');
    setTransactionReference('');
    setUpiId('');
    setNotes(`Monthly collection for ${l.loanNo}`);
    setIsPaymentModalOpen(true);
  };

  // ── Action: Close Payment Modal ────────────────────────────────────────────
  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setSelectedLoan(null);
    setAmountReceived('');
    setPrincipalPaidInput('');
    setInterestPaidInput('');
  };

  // ── Action: Change Customer ────────────────────────────────────────────────
  const handleChangeCustomer = () => {
    setIsPaymentModalOpen(false);
    setSelectedLoan(null);
    setSelectedCustomer(null);
    setCustomerSearchQuery('');
    setAmountReceived('');
    setPrincipalPaidInput('');
    setInterestPaidInput('');
  };

  // ── WhatsApp Reminder Helper ──────────────────────────────────────────────
  const handleSendWhatsApp = (l: Loan) => {
    const rc = resolveLoanCustomer(l);
    const metrics = getLoanDueMetrics(l);
    let msg = `Dear ${rc.name},\nThis is a gentle reminder from KKV Gold Finance regarding your Gold Loan ${l.loanNo}.\nOutstanding Principal: ₹${metrics.outstanding.toLocaleString('en-IN')}\nMonthly Interest: ₹${metrics.baseMonthlyInterest.toLocaleString('en-IN')}\nDue Date: ${metrics.dueDateStr}`;

    if (metrics.statusText === 'OVERDUE') {
      msg += `\nStatus: OVERDUE by ${metrics.daysOverdue} days. Total Due with penalty: ₹${metrics.totalDue.toLocaleString('en-IN')}. Please settle at your earliest convenience.`;
    }

    const cleanPhone = (rc.phone || '').replace(/\D/g, '');
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // ── Action: Submit Payment Collection (Double-click protected) ─────────────
  const handleConfirmPayment = () => {
    if (isSubmitting || !selectedLoan || !collectionMetrics) return;

    // Period duplicate check
    if (receiptType === 'Interest Payment' && collectionMetrics.isPeriodAlreadyFullyPaid) {
      showToast('This interest period has already been paid for this loan!', 'error');
      return;
    }

    const numTotal = parseFloat(amountReceived) || 0;
    if (numTotal <= 0) {
      showToast('Please enter a valid amount received.', 'error');
      return;
    }

    let numInt = parseFloat(interestPaidInput) || 0;
    let numPrin = parseFloat(principalPaidInput) || 0;

    if (receiptType === 'Interest Payment') {
      numInt = numTotal;
      numPrin = 0;
    } else if (receiptType === 'Principal Payment') {
      numPrin = numTotal;
      numInt = 0;
    }

    if (numPrin > collectionMetrics.outstanding) {
      showToast(
        `Principal payment (₹${numPrin.toLocaleString('en-IN')}) cannot exceed current outstanding (₹${collectionMetrics.outstanding.toLocaleString('en-IN')}).`,
        'error'
      );
      return;
    }

    if (paymentMethod === 'Bank' && !transactionReference.trim()) {
      showToast('Please enter the Bank UTR / Transaction Reference.', 'error');
      return;
    }

    if (paymentMethod === 'UPI' && !transactionReference.trim()) {
      showToast('Please enter the UPI Transaction Reference / UTR.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const rc = resolveLoanCustomer(selectedLoan);
      const isFullClosure =
        receiptType === 'Full Loan Closure' ||
        (collectionMetrics.outstanding - numPrin <= 0 && collectionMetrics.outstanding > 0);

      const calculatedNextDueDate = addCalendarMonths(collectionMetrics.dueDateStr, 1);

      const receiptRecord = addReceipt({
        loanId: selectedLoan.id,
        loanNo: selectedLoan.loanNo,
        customerId: rc.custId,
        customerName: rc.name,
        customerPhone: rc.phone,
        loanType: selectedLoan.loanTypeName || selectedLoan.loanType || 'Gold Loan',
        kind: isFullClosure
          ? 'LOAN CLOSURE'
          : receiptType === 'Principal Payment'
          ? 'PART PAYMENT'
          : 'INTEREST PAYMENT',
        amount: numTotal,
        interestComponent: numInt,
        principalComponent: numPrin,
        penaltyComponent: collectionMetrics.penaltyAmount,
        odCharges: collectionMetrics.penaltyAmount,
        daysLate: collectionMetrics.daysOverdue,
        otherCharges: 0,
        discount: 0,
        tdsAmount: 0,
        paymentMode: paymentMethod,
        bankName: paymentMethod === 'Bank' ? bankName : undefined,
        transactionReference: transactionReference.trim() || undefined,
        upiId: paymentMethod === 'UPI' ? upiId.trim() : undefined,
        date: collectionMetrics.normalizedPaymentDate,
        currentDueDate: collectionMetrics.dueDateStr,
        nextDueDate: isFullClosure ? undefined : calculatedNextDueDate,
        outstandingBefore: collectionMetrics.outstanding,
        outstandingAfter: Math.max(0, collectionMetrics.outstanding - numPrin),
        notes: notes.trim() || `${receiptType} collection via ${paymentMethod}`
      });

      setLastGeneratedReceipt(receiptRecord);
      setShowSuccessModal(true);
      setIsPaymentModalOpen(false);
      setSelectedLoan(null);
      showToast(`Payment collected successfully! Receipt #${receiptRecord.receiptNo} generated.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error recording payment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Action: Print Receipt Voucher ──────────────────────────────────────────
  const handlePrintVoucher = (rc: Receipt) => {
    setViewingReceipt(rc);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // ── Action: Download PDF / HTML Voucher ────────────────────────────────────
  const handleDownloadReceiptHtml = (rc: Receipt) => {
    const filename = `KKV-Gold-Finance-Loan-Receipt-REC-${rc.receiptNo}.html`;
    const targetLoan = loans.find((l) => l.loanNo === rc.loanNo || l.id === rc.loanId);
    const targetCust = customers.find((c) => isMatchingCustomerId(rc.customerId, c));
    const custName = targetCust?.name || rc.customerName || 'Valued Customer';
    const custId = targetCust ? getCanonicalCustomerId(targetCust) : rc.customerId;
    const custPhone = targetCust?.phone || rc.customerPhone || 'N/A';
    const custAddress = targetCust?.currentAddress || targetLoan?.customerCurrentAddress || 'Tamil Nadu, India';

    const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Loan Payment Receipt - REC-${rc.receiptNo}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #f8fafc; }
  .voucher { max-width: 740px; margin: 0 auto; background: #ffffff; padding: 32px; border: 1.5px solid #064e3b; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #064e3b; padding-bottom: 16px; margin-bottom: 20px; }
  .logo-title { font-size: 22px; font-weight: 800; color: #064e3b; margin: 0; }
  .tagline { font-size: 11px; color: #64748b; margin: 3px 0 0; }
  .receipt-title { background: #064e3b; color: #ffffff; font-weight: 800; padding: 6px 14px; border-radius: 6px; font-size: 13px; text-transform: uppercase; }
  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; background: #f1f5f9; padding: 14px; border-radius: 8px; font-size: 13px; }
  .section-title { font-size: 12.5px; font-weight: 800; color: #064e3b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 18px 0 10px; text-transform: uppercase; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .label { color: #64748b; }
  .val { font-weight: 700; color: #0f172a; }
  .highlight { color: #059669; font-size: 16px; }
  .footer { margin-top: 36px; padding-top: 18px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
  th { background: #f8fafc; text-align: left; padding: 8px; border: 1px solid #e2e8f0; font-weight: 700; }
  td { padding: 8px; border: 1px solid #e2e8f0; }
  @media print { body { background: #fff; margin: 0; } .voucher { border: none; box-shadow: none; padding: 10px; } }
</style>
</head>
<body>
<div class="voucher">
  <div class="header">
    <div>
      <h1 class="logo-title">KKV GOLD FINANCE</h1>
      <p class="tagline">MAIN BRANCH &mdash; 104 G.S.T Road, Chennai - 600045 | Ph: +91 44 2233 4455</p>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Reg: TN-CHE-2018-GF492 | GSTIN: 33AAAAA0000A1Z5</div>
    </div>
    <div style="text-align:right;">
      <span class="receipt-title">Loan Payment Receipt</span>
    </div>
  </div>

  <div class="meta-grid">
    <div><span class="label">Receipt Number:</span><br/><strong class="val" style="color:#064e3b;">REC-${rc.receiptNo}</strong></div>
    <div><span class="label">Loan Number:</span><br/><strong class="val">${rc.loanNo}</strong></div>
    <div><span class="label">Payment Date:</span><br/><strong class="val">${rc.date}</strong></div>
  </div>

  <div class="section-title">Customer Details</div>
  <div class="grid-2">
    <div class="row"><span class="label">Customer Name:</span><span class="val">${custName}</span></div>
    <div class="row"><span class="label">Customer ID:</span><span class="val">${custId}</span></div>
    <div class="row"><span class="label">Mobile Number:</span><span class="val">+91 ${custPhone}</span></div>
    <div class="row"><span class="label">Address:</span><span class="val">${custAddress}</span></div>
  </div>

  <div class="section-title">Loan &amp; Schedule Details</div>
  <div class="grid-2">
    <div class="row"><span class="label">Loan Number:</span><span class="val" style="color:#064e3b;">${rc.loanNo}</span></div>
    <div class="row"><span class="label">Due Date:</span><span class="val">${rc.currentDueDate || rc.date}</span></div>
    <div class="row"><span class="label">Outstanding Before:</span><span class="val">₹${(rc.outstandingBefore ?? 0).toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Outstanding After:</span><span class="val highlight">₹${(rc.outstandingAfter ?? 0).toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Next Due Date:</span><span class="val">${rc.nextDueDate || '— (Closed)'}</span></div>
    <div class="row"><span class="label">Receipt Type:</span><span class="val">${rc.kind}</span></div>
  </div>

  <div class="section-title">Payment Settlement Breakdown</div>
  <div class="grid-2">
    <div class="row"><span class="label">Interest Component:</span><span class="val">₹${(rc.interestComponent || 0).toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Penalty / Overdue Charges:</span><span class="val">₹${(rc.penaltyComponent || 0).toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Principal Component:</span><span class="val">₹${(rc.principalComponent || 0).toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Total Received:</span><span class="val highlight">₹${rc.amount.toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Disbursement Method:</span><span class="val">${targetLoan?.bankMode || 'Cash / Bank'}</span></div>
    <div class="row"><span class="label">Repayment Method:</span><span class="val">${rc.paymentMode}${rc.bankName ? ' — ' + rc.bankName : ''}</span></div>
    <div class="row"><span class="label">Transaction Reference:</span><span class="val">${rc.transactionReference || 'Cash Settlement'}</span></div>
    <div class="row"><span class="label">Payment Status:</span><span class="val" style="color:#059669;">✓ PAID</span></div>
  </div>

  ${targetLoan && targetLoan.items && targetLoan.items.length > 0 ? `
  <div class="section-title">Pledged Collateral Ornaments</div>
  <table>
    <thead>
      <tr>
        <th>Item Description</th>
        <th>Qty</th>
        <th>Purity</th>
        <th>Gross Wt</th>
        <th>Deduction Wt</th>
        <th>Net Wt</th>
      </tr>
    </thead>
    <tbody>
      ${targetLoan.items.map(it => `
        <tr>
          <td><strong>${it.item}</strong></td>
          <td>${it.qty}</td>
          <td>${it.purity}</td>
          <td>${Number(it.grossWeight || 0).toFixed(3)}g</td>
          <td>${Number(it.deductionWeight || 0).toFixed(3)}g</td>
          <td>${Number(it.netWeight !== undefined ? it.netWeight : Math.max(0, (Number(it.grossWeight) || 0) - (Number(it.deductionWeight) || 0))).toFixed(3)}g</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="footer">
    <div>Customer Signature<br/><br/>_____________________</div>
    <div style="text-align:right;">Authorized Signatory (KKV)<br/><br/>_____________________</div>
  </div>
</div>
<script>
  window.onload = function() { window.print(); };
</script>
</body>
</html>`;

    const blob = new Blob([receiptHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Receipt #${rc.receiptNo} downloaded.`, 'success');
  };

  return (
    <div className="page-content" style={{ paddingBottom: '60px' }}>
      {/* PAGE HEADER */}
      <PageHeader
        title="Pending Loans & Collection Center"
        subtitle="Customer ID-first loan collection flow: Search customer → Select loan → Collect payment → Generate receipt"
        icon={<Clock size={22} />}
      />

      {/* SUMMARY STAT CARDS */}
      <StatGrid cols={4} style={{ marginBottom: '20px' }}>
        <StatCard
          label="Total Pending Loans"
          value={summaryMetrics.totalPending}
          subtitle="Active loan accounts"
        />
        <StatCard
          label="Overdue Accounts"
          value={summaryMetrics.overdueAccounts}
          subtitle="Past contractual due date"
          valueColor={summaryMetrics.overdueAccounts > 0 ? 'var(--danger)' : undefined}
        />
        <StatCard
          label="Total Overdue Amount"
          value={`₹${summaryMetrics.totalOverdueAmount.toLocaleString('en-IN')}`}
          subtitle="Accumulated due interest"
          valueColor={summaryMetrics.totalOverdueAmount > 0 ? 'var(--danger)' : undefined}
        />
        <StatCard
          label="Collected Today"
          value={`₹${summaryMetrics.collectedToday.toLocaleString('en-IN')}`}
          subtitle={`Date: ${todayStr}`}
          valueColor="var(--success)"
        />
      </StatGrid>

      {/* ════════════════════════════════════════════════════════════════════════
          STEP 1: IDENTIFY CUSTOMER (CUSTOMER ID FIRST)
          ════════════════════════════════════════════════════════════════════════ */}
      {!selectedCustomer && (
        <div className="card" style={{ padding: '28px', marginBottom: '20px' }}>
          <div style={{ marginBottom: '18px' }}>
            <span className="badge badge-info" style={{ fontWeight: 800, fontSize: '11px', marginBottom: '6px' }}>
              STEP 1 &bull; REQUIRED FIRST
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '4px 0 2px 0' }}>
              Identify Customer for Collection
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Enter an existing Customer ID to begin collection. Customer selection is strictly required before viewing loans.
            </p>
          </div>

          {/* Customer ID Search Input */}
          <div style={{ maxWidth: '680px' }}>
            <label className="form-label required" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '6px', display: 'block' }}>
              CUSTOMER ID *
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  className="input-control"
                  style={{ height: '44px', paddingLeft: '38px', fontSize: '14px', fontWeight: 600 }}
                  placeholder="Enter Customer ID, e.g. CUST-0006 (or search Name / Mobile)..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && matchingCustomers.length === 1) {
                      setSelectedCustomer(matchingCustomers[0]);
                      setCustomerSearchQuery('');
                    }
                  }}
                  autoFocus
                />
                <Search size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                {customerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearchQuery('')}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '0 20px', height: '44px', fontWeight: 700, whiteSpace: 'nowrap' }}
                onClick={() => {
                  if (matchingCustomers.length > 0) {
                    setSelectedCustomer(matchingCustomers[0]);
                    setCustomerSearchQuery('');
                  } else if (customerSearchQuery.trim()) {
                    showToast('Customer not found. Please enter a valid existing Customer ID.', 'error');
                  }
                }}
              >
                Find Customer
              </button>
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Primary workflow: Search Customer ID (e.g. <code>CUST-0006</code>) or alternate search by Name or Mobile number.
            </div>

            {/* Quick Customer Selection Chips */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Quick Pick:</span>
              {sampleCustomerChips.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(ch.customer);
                    setCustomerSearchQuery('');
                  }}
                  className="badge badge-info"
                  style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '11.5px', border: 'none', transition: 'all 0.15s ease' }}
                  title="Click to select this customer"
                >
                  <strong>{ch.canonicalId}</strong> &mdash; {ch.name} ({ch.phone})
                </button>
              ))}
            </div>
          </div>

          {/* Invalid / Not Found State */}
          {customerSearchQuery && matchingCustomers.length === 0 && (
            <div style={{ marginTop: '18px', padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--badge-danger-bg)', border: '1.5px solid var(--badge-danger-border)', color: 'var(--color-danger)', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '680px' }}>
              <AlertCircle size={18} color="#dc2626" />
              <div>
                <strong>Customer not found.</strong> Please enter a valid existing Customer ID.
              </div>
            </div>
          )}

          {/* Live Search Results List (Customer Found State) */}
          {customerSearchQuery && matchingCustomers.length > 0 && (
            <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '680px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', letterSpacing: '0.05em' }}>
                MATCHING CUSTOMERS ({matchingCustomers.length}):
              </span>
              {matchingCustomers.map((cust) => {
                const custCanonicalId = getCanonicalCustomerId(cust);
                const activeLoansCount = loans.filter((l) => isMatchingCustomerId(l.customerId, cust) && l.status !== 'CLOSED').length;

                return (
                  <div
                    key={cust.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--border-subtle)',
                      backgroundColor: '#ffffff',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'var(--bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--color-primary-dark)', overflow: 'hidden' }}>
                        {cust.customerPhoto ? (
                          <img src={cust.customerPhoto} alt={cust.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <User size={20} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-dark)' }}>{cust.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '10px', alignItems: 'center', marginTop: '2px' }}>
                          <span className="badge badge-info" style={{ fontWeight: 700, fontSize: '11px' }}>{custCanonicalId}</span>
                          <span>+91 {cust.phone}</span>
                          <span style={{ color: '#059669', fontWeight: 600 }}>✓ Verified</span>
                          <span>&bull;</span>
                          <span style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>{activeLoansCount} Active Loan(s)</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontWeight: 700, padding: '7px 16px' }}
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setCustomerSearchQuery('');
                      }}
                    >
                      Select Customer &rarr;
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Requirement 3: Empty State when no customer is selected ─────────── */}
          {!customerSearchQuery && (
            <div style={{ marginTop: '24px', padding: '40px 24px', textAlign: 'center', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: '12px', border: '1px dashed var(--border-light)' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: 'var(--text-muted)' }}>
                <Search size={24} />
              </div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '0 0 6px 0' }}>
                NO CUSTOMER SELECTED
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto' }}>
                Search for an existing Customer ID to begin collection.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          STEP 2: CUSTOMER SELECTED & LOAN LIST (MODAL REMAINS CLOSED)
          ════════════════════════════════════════════════════════════════════════ */}
      {selectedCustomer && (
        <>
          {/* Customer Confirmation Hero Card */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: '20px', borderLeft: '5px solid var(--color-primary-accent, #059669)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'var(--badge-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--badge-success-text)', border: '1px solid var(--badge-success-border)', overflow: 'hidden' }}>
                  {selectedCustomer.customerPhoto ? (
                    <img src={selectedCustomer.customerPhoto} alt={selectedCustomer.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={28} />
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '11px' }}>
                      CUSTOMER SELECTED
                    </span>
                    <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>✓ Verified</span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '4px 0 2px 0' }}>
                    {selectedCustomer.name}
                  </h3>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>Customer ID: <strong style={{ color: 'var(--color-primary-dark)' }}>{getCanonicalCustomerId(selectedCustomer)}</strong></span>
                    <span>&bull;</span>
                    <span>Mobile: <strong>+91 {selectedCustomer.phone}</strong></span>
                    <span>&bull;</span>
                    <span>Address: {selectedCustomer.currentAddress || 'N/A'}</span>
                    <span>&bull;</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary-accent, #059669)' }}>{customerLoans.length} Loan(s) Found</span>
                  </div>
                </div>
              </div>

              {/* Requirement 8: Change Customer Button */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleChangeCustomer}
                style={{ fontWeight: 700, padding: '8px 16px', color: '#dc2626', borderColor: '#fca5a5' }}
              >
                <RotateCcw size={14} style={{ marginRight: '6px' }} /> Change Customer
              </button>
            </div>
          </div>

          {/* Customer's Loan List Cards (Explicit Selection Required) */}
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <div style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <span className="badge badge-info" style={{ fontWeight: 800, fontSize: '11px', marginBottom: '6px' }}>
                STEP 2 &bull; SELECT LOAN FOR COLLECTION
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '4px 0 2px 0' }}>
                SELECT LOAN FOR COLLECTION
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Customer: <strong>{selectedCustomer.name}</strong> &bull; Customer ID: <strong>{getCanonicalCustomerId(selectedCustomer)}</strong> &mdash; Select the exact loan to collect payment against.
              </p>
            </div>

            {customerLoans.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px' }}>
                {customerLoans.map((l) => {
                  const metrics = getLoanDueMetrics(l);
                  const isOverdue = metrics.statusText === 'OVERDUE';
                  const isClosed = l.status === 'CLOSED';

                  return (
                    <div
                      key={l.id}
                      style={{
                        borderRadius: '14px',
                        border: isOverdue ? '2px solid #f87171' : '1.5px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-sm)',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px'
                      }}
                    >
                      {/* Card Header */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {l.loanTypeName || l.loanType} &bull; Disbursed via {l.bankMode || 'Cash'}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: '2px' }}>
                              {l.loanNo}
                            </div>
                          </div>

                          <div>
                            {metrics.statusText === 'OVERDUE' && (
                              <span className="badge badge-danger" style={{ fontSize: '11px', fontWeight: 800 }}>
                                OVERDUE
                              </span>
                            )}
                            {metrics.statusText === 'DUE TODAY' && (
                              <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: 800 }}>
                                DUE TODAY
                              </span>
                            )}
                            {metrics.statusText === 'NOT DUE' && (
                              <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 700 }}>
                                NOT DUE
                              </span>
                            )}
                            {metrics.statusText === 'PAID' && (
                              <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 800 }}>
                                ✓ PAID
                              </span>
                            )}
                            {metrics.statusText === 'CLOSED' && (
                              <span className="badge" style={{ backgroundColor: '#94a3b8', color: '#fff', fontSize: '11px', fontWeight: 800 }}>
                                CLOSED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Loan Metrics Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', padding: '12px 14px', borderRadius: '10px', fontSize: '12.5px', marginBottom: '12px' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Original Principal:</span>
                            <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>₹{l.principal.toLocaleString('en-IN')}</div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Outstanding:</span>
                            <div style={{ fontWeight: 800, color: isClosed ? 'var(--text-muted)' : 'var(--color-primary-dark)' }}>
                              ₹{metrics.outstanding.toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Monthly Interest:</span>
                            <div style={{ fontWeight: 700, color: metrics.isEscalated ? '#dc2626' : 'var(--color-primary-accent, #059669)' }}>
                              ₹{metrics.baseMonthlyInterest.toLocaleString('en-IN')}{' '}
                              <span style={{ fontSize: '11px', fontWeight: 600 }}>
                                ({metrics.applicableInterestRate}%/mo{metrics.isEscalated ? ' 🔥' : ''})
                              </span>
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Due Date:</span>
                            <div style={{ fontWeight: 800, color: isOverdue ? '#dc2626' : 'var(--text-dark)' }}>
                              {metrics.dueDateStr}
                            </div>
                          </div>
                        </div>

                        {/* Collateral preview */}
                        {l.items && l.items.length > 0 && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            <span>Pledged: </span>
                            <strong style={{ color: 'var(--text-secondary)' }}>
                              {l.items.map((it) => it.item).join(', ')} ({l.totalNetWeight || l.items.reduce((s, it) => s + (it.netWeight || 0), 0)}g net)
                            </strong>
                          </div>
                        )}

                        {/* Collateral Photos Thumbnails */}
                        {l.photos && l.photos.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Photos ({l.photos.length}):</span>
                            {l.photos.map((p, pIdx) => (
                              <div
                                key={pIdx}
                                onClick={() => {
                                  setSelectedLoan(l);
                                  setLightboxIndex(pIdx);
                                  setLightboxZoom(1);
                                }}
                                style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #cbd5e1' }}
                                title="Click to zoom photo"
                              >
                                <img src={p} alt="Collateral" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#25D366', borderColor: '#25D366', padding: '6px 10px', fontSize: '11.5px' }}
                            title="Send WhatsApp Reminder"
                            onClick={() => handleSendWhatsApp(l)}
                          >
                            <MessageSquare size={13} style={{ marginRight: '4px' }} /> WhatsApp
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 10px', fontSize: '11.5px' }}
                            onClick={() => setViewingLoanHistory(l)}
                          >
                            <FileText size={13} style={{ marginRight: '4px' }} /> History
                          </button>
                        </div>

                        {/* Requirement 6: ONLY THIS BUTTON OPENS PAYMENT COLLECTION */}
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontWeight: 800, padding: '8px 16px', fontSize: '12.5px' }}
                          disabled={isClosed}
                          onClick={() => handleSelectLoan(l)}
                        >
                          <DollarSign size={14} style={{ marginRight: '4px' }} /> Select Loan
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                No active loans registered under {selectedCustomer.name}.
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          STEP 3: LOAN PAYMENT COLLECTION MODAL (USER-TRIGGERED ONLY)
          ════════════════════════════════════════════════════════════════════════ */}
      {isPaymentModalOpen && selectedLoan && collectionMetrics && selectedCustomer && (() => {
        const rc = resolveLoanCustomer(selectedLoan);
        const pledgedItems = selectedLoan.items || [];
        const pledgedPhotos = selectedLoan.photos || [];

        return (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              zIndex: 1200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              overflowY: 'auto'
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '780px',
                maxHeight: '92vh',
                overflowY: 'auto',
                padding: '28px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
                color: 'var(--text-primary)'
              }}
            >
              {/* Modal Top Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
                <div>
                  <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '11px', marginBottom: '4px' }}>
                    STEP 3 &bull; LOAN PAYMENT COLLECTION
                  </span>
                  <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-primary-dark)', margin: '4px 0 2px 0' }}>
                    Loan Payment Collection
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                    Customer: <strong>{rc.name}</strong> ({rc.custId}) &bull; Loan: <strong style={{ color: 'var(--color-primary-dark)' }}>{selectedLoan.loanNo}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClosePaymentModal}
                    style={{ fontWeight: 700, padding: '6px 12px', fontSize: '12px' }}
                  >
                    <ChevronLeft size={13} style={{ marginRight: '3px' }} /> Change Loan
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePaymentModal}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                    title="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Selected Loan Summary Banner */}
              <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', border: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-info" style={{ fontWeight: 800, fontSize: '12.5px', padding: '3px 8px' }}>
                      {selectedLoan.loanNo}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                      {selectedLoan.loanTypeName || selectedLoan.loanType}
                    </span>
                  </div>

                  <div>
                    {collectionMetrics.timingStatus === 'OVERDUE' && (
                      <span className="badge badge-danger" style={{ fontSize: '11.5px', fontWeight: 800 }}>
                        ⚠ OVERDUE ({collectionMetrics.daysOverdue} Days)
                      </span>
                    )}
                    {collectionMetrics.timingStatus === 'DUE TODAY' && (
                      <span className="badge badge-warning" style={{ fontSize: '11.5px', fontWeight: 800 }}>
                        ⏰ DUE TODAY
                      </span>
                    )}
                    {collectionMetrics.timingStatus === 'EARLY PAYMENT' && (
                      <span className="badge badge-success" style={{ fontSize: '11.5px', fontWeight: 800 }}>
                        ✓ ON TIME
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '12.5px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Original Principal:</span>
                    <div style={{ fontWeight: 700 }}>₹{selectedLoan.principal.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Outstanding:</span>
                    <div style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>₹{collectionMetrics.outstanding.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Rate:</span>
                    <div style={{ fontWeight: 700 }}>{selectedLoan.interestRate}% / mo</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Contractual Due:</span>
                    <div style={{ fontWeight: 800, color: collectionMetrics.timingStatus === 'OVERDUE' ? '#dc2626' : 'inherit' }}>
                      {collectionMetrics.dueDateStr}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Monthly Interest:</span>
                    <div style={{ fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}>
                      ₹{collectionMetrics.baseMonthlyInterest.toLocaleString('en-IN')}
                    </div>
                  </div>
                  {collectionMetrics.penaltyAmount > 0 && (
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Late Penalty:</span>
                      <div style={{ fontWeight: 800, color: '#dc2626' }}>
                        +₹{collectionMetrics.penaltyAmount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Outstanding Payment Periods Breakdown */}
              {loanPeriodsBreakdown.length > 0 && (
                <div style={{ marginBottom: '18px', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: 0 }}>
                      OUTSTANDING PAYMENT PERIODS BREAKDOWN
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Historical Schedule
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                    {loanPeriodsBreakdown.map((p, idx) => (
                      <div
                        key={`period-${idx}`}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: p.isPaid ? '1px solid #a7f3d0' : p.statusText === 'OVERDUE' ? '1.5px solid #f87171' : '1px solid #cbd5e1',
                          backgroundColor: p.isPaid ? '#f0fdf4' : p.statusText === 'OVERDUE' ? '#fef2f2' : '#f8fafc',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: p.isPaid ? '#065f46' : 'var(--text-dark)' }}>{p.monthName}</strong>
                          {p.isPaid ? (
                            <span className="badge badge-success" style={{ fontSize: '9.5px', padding: '1px 5px' }}>✓ Paid</span>
                          ) : p.statusText === 'OVERDUE' ? (
                            <span className="badge badge-danger" style={{ fontSize: '9.5px', padding: '1px 5px' }}>{p.daysOverdue}d Overdue</span>
                          ) : (
                            <span className="badge badge-info" style={{ fontSize: '9.5px', padding: '1px 5px' }}>Current</span>
                          )}
                        </div>
                        <div style={{ marginTop: '3px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                          <span>Due: {p.dueDateStr}</span>
                          <span style={{ fontWeight: 700, color: p.isPaid ? '#059669' : 'var(--text-dark)' }}>
                            ₹{p.interestDue.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Collection Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Payment Date & Status */}
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label required">PAYMENT DATE *</label>
                    <input
                      type="date"
                      className="input-control"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      style={{ fontWeight: 700 }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Date of payment received from customer (defaults to today).
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">SCHEDULE TIMING STATUS</label>
                    <div style={{ minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderRadius: '8px', backgroundColor: collectionMetrics.timingStatus === 'OVERDUE' ? '#fef2f2' : '#f0fdf4', border: collectionMetrics.timingStatus === 'OVERDUE' ? '1px solid #fecdd3' : '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '6px' }}>
                      {collectionMetrics.timingStatus === 'OVERDUE' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '12.5px' }}>
                            ⚠ {collectionMetrics.daysOverdue} Days Overdue (Due: {collectionMetrics.dueDateStr})
                          </span>
                          {collectionMetrics.isEscalated && (
                            <span className="badge badge-danger" style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: '#dc2626', color: '#fff' }}>
                              🔥 Escalated Rate: {collectionMetrics.applicableInterestRate}%/mo ({collectionMetrics.escalationDetails.currentTierLabel})
                            </span>
                          )}
                        </div>
                      )}
                      {collectionMetrics.timingStatus === 'DUE TODAY' && (
                        <span style={{ color: '#d97706', fontWeight: 800, fontSize: '12.5px' }}>
                          ⏰ Due Today ({collectionMetrics.dueDateStr})
                        </span>
                      )}
                      {collectionMetrics.timingStatus === 'EARLY PAYMENT' && (
                        <span style={{ color: '#059669', fontWeight: 800, fontSize: '12.5px' }}>
                          ✓ On Time / Early Payment (Due: {collectionMetrics.dueDateStr})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Type Selector Tabs */}
                <div>
                  <label className="form-label required">PAYMENT TYPE *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                    {(['Interest Payment', 'Principal Payment', 'Interest + Principal', 'Full Loan Closure'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setReceiptType(type)}
                        className={receiptType === type ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{
                          padding: '8px 10px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          border: receiptType === type ? '2px solid var(--color-primary-accent, #059669)' : '1px solid var(--border-light)'
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Settlement Inputs */}
                <div style={{ backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  {receiptType === 'Interest Payment' && (
                    <div className="grid-3" style={{ gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Base Monthly Interest:</span>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                          ₹{collectionMetrics.baseMonthlyInterest.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Late Penalty:</span>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: collectionMetrics.penaltyAmount > 0 ? '#dc2626' : 'var(--text-dark)' }}>
                          ₹{collectionMetrics.penaltyAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Total Interest Due:</span>
                        <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}>
                          ₹{collectionMetrics.totalInterestDueWithPenalty.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  )}

                  {receiptType === 'Principal Payment' && (
                    <div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Current Outstanding: <strong>₹{collectionMetrics.outstanding.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="form-group">
                        <label className="form-label required">PRINCIPAL REPAYMENT (₹) *</label>
                        <input
                          type="number"
                          className="input-control"
                          placeholder="Principal amount..."
                          value={principalPaidInput}
                          onChange={(e) => {
                            setPrincipalPaidInput(e.target.value);
                            setAmountReceived(e.target.value);
                          }}
                          style={{ fontSize: '15px', fontWeight: 800 }}
                        />
                      </div>
                    </div>
                  )}

                  {receiptType === 'Interest + Principal' && (
                    <div className="grid-2" style={{ gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label required">INTEREST (₹) *</label>
                        <input
                          type="number"
                          className="input-control"
                          value={interestPaidInput}
                          onChange={(e) => {
                            setInterestPaidInput(e.target.value);
                            const p = parseFloat(principalPaidInput) || 0;
                            const i = parseFloat(e.target.value) || 0;
                            setAmountReceived((p + i).toString());
                          }}
                          style={{ fontSize: '14px', fontWeight: 700 }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label required">PRINCIPAL (₹) *</label>
                        <input
                          type="number"
                          className="input-control"
                          value={principalPaidInput}
                          placeholder="Principal..."
                          onChange={(e) => {
                            setPrincipalPaidInput(e.target.value);
                            const p = parseFloat(e.target.value) || 0;
                            const i = parseFloat(interestPaidInput) || 0;
                            setAmountReceived((p + i).toString());
                          }}
                          style={{ fontSize: '14px', fontWeight: 700 }}
                        />
                      </div>
                    </div>
                  )}

                  {receiptType === 'Full Loan Closure' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '12px', marginBottom: '10px' }}>
                        <div>Principal: <strong>₹{collectionMetrics.outstanding.toLocaleString('en-IN')}</strong></div>
                        <div>Interest: <strong>₹{collectionMetrics.baseMonthlyInterest.toLocaleString('en-IN')}</strong></div>
                        <div>Penalty: <strong>₹{collectionMetrics.penaltyAmount.toLocaleString('en-IN')}</strong></div>
                        <div>Total: <strong style={{ color: '#059669', fontSize: '14px' }}>₹{(collectionMetrics.outstanding + collectionMetrics.totalInterestDueWithPenalty).toLocaleString('en-IN')}</strong></div>
                      </div>
                      <span className="badge badge-danger" style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        ⚠ Full Loan Closure permanently closes this loan account.
                      </span>
                    </div>
                  )}

                  {/* Amount Received Input */}
                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label className="form-label required" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                      TOTAL AMOUNT RECEIVED (₹) *
                    </label>
                    <input
                      type="number"
                      className="input-control"
                      placeholder="Enter amount received..."
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="form-label required">PAYMENT METHOD *</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {(['Cash', 'Bank', 'UPI'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={paymentMethod === method ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ flex: 1, padding: '9px', fontSize: '13px', fontWeight: 700 }}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bank Details */}
                {paymentMethod === 'Bank' && (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">BANK NAME</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="e.g. HDFC Bank, SBI..."
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label required">UTR / TRANSACTION REFERENCE *</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="Bank UTR Number..."
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* UPI Details */}
                {paymentMethod === 'UPI' && (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label required">UPI UTR / TRANSACTION REFERENCE *</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="12-digit UPI reference..."
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">CUSTOMER UPI ID (OPTIONAL)</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="customer@upi"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Pledged Gold Review */}
                {pledgedItems.length > 0 && (
                  <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-secondary)' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '8px' }}>
                      Pledged Gold Collateral
                    </div>
                    <table className="custom-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Purity</th>
                          <th>Gross Wt</th>
                          <th>Net Wt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pledgedItems.map((it, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700 }}>{it.item}</td>
                            <td>{it.qty}</td>
                            <td>{it.purity}</td>
                            <td>{it.grossWeight}g</td>
                            <td style={{ fontWeight: 700 }}>{it.netWeight}g</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {pledgedPhotos.length > 0 && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          Collateral Photos (Click to preview):
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {pledgedPhotos.map((p, pIdx) => (
                            <div
                              key={pIdx}
                              onClick={() => {
                                setLightboxIndex(pIdx);
                                setLightboxZoom(1);
                              }}
                              style={{ width: '42px', height: '42px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #cbd5e1' }}
                            >
                              <img src={p} alt="Collateral" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">REMARKS / NOTES</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Optional remarks..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Payment Summary Preview */}
                <div style={{ backgroundColor: 'var(--badge-success-bg)', padding: '14px 16px', borderRadius: '10px', border: '1.5px solid var(--badge-success-border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--badge-success-text)', marginBottom: '6px' }}>
                    PAYMENT SUMMARY PREVIEW
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', fontSize: '12.5px' }}>
                    <div>Customer: <strong>{rc.name}</strong></div>
                    <div>Loan: <strong>{selectedLoan.loanNo}</strong></div>
                    <div>Date: <strong>{collectionMetrics.normalizedPaymentDate}</strong></div>
                    <div>Total Received: <strong style={{ color: '#059669', fontSize: '14px' }}>₹{(parseFloat(amountReceived) || 0).toLocaleString('en-IN')}</strong></div>
                    <div>Next Due: <strong>{receiptType === 'Full Loan Closure' ? '— (Closed)' : addCalendarMonths(collectionMetrics.dueDateStr, 1)}</strong></div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  {/* Requirement 10: Cancel button returns to customer's loan list */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClosePaymentModal}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmPayment}
                    disabled={isSubmitting}
                    style={{ padding: '10px 24px', fontSize: '13.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <DollarSign size={15} />
                    <span>{isSubmitting ? 'Processing Payment...' : 'Confirm Payment & Generate Receipt'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════════
          RECEIPT SUCCESS MODAL
          ════════════════════════════════════════════════════════════════════════ */}
      {showSuccessModal && lastGeneratedReceipt && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '32px',
              textAlign: 'center',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-card)'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--badge-success-bg)',
                color: 'var(--badge-success-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '0 0 6px 0' }}>
              ✓ LOAN PAYMENT RECEIVED
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px 0' }}>
              Receipt #{lastGeneratedReceipt.receiptNo} has been generated and synchronized across all records.
            </p>

            <div style={{ backgroundColor: 'var(--bg-surface-secondary)', padding: '16px', borderRadius: '10px', marginBottom: '22px', textAlign: 'left', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Receipt Number:</span>
                <strong style={{ color: 'var(--color-primary-dark)' }}>REC-{lastGeneratedReceipt.receiptNo}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Loan Number:</span>
                <strong>{lastGeneratedReceipt.loanNo}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                <strong>{lastGeneratedReceipt.customerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Amount Paid:</span>
                <strong style={{ color: '#059669', fontSize: '15px' }}>₹{lastGeneratedReceipt.amount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Remaining Balance:</span>
                <strong>₹{(lastGeneratedReceipt.outstandingAfter ?? 0).toLocaleString('en-IN')}</strong>
              </div>
              {lastGeneratedReceipt.nextDueDate && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Next Due Date:</span>
                  <strong>{lastGeneratedReceipt.nextDueDate}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingReceipt(lastGeneratedReceipt)}
                style={{ fontSize: '13px', fontWeight: 700 }}
              >
                <Eye size={15} style={{ marginRight: '6px' }} /> View Receipt
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handlePrintVoucher(lastGeneratedReceipt)}
                style={{ fontSize: '13px', fontWeight: 700 }}
              >
                <Printer size={15} style={{ marginRight: '6px' }} /> Print Receipt
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleDownloadReceiptHtml(lastGeneratedReceipt)}
                style={{ fontSize: '13px', fontWeight: 700 }}
              >
                <Download size={15} style={{ marginRight: '6px' }} /> Download PDF
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowSuccessModal(false);
                }}
                style={{ fontSize: '13px', fontWeight: 800, padding: '8px 20px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          BRANDED PRINTABLE RECEIPT VOUCHER MODAL
          ════════════════════════════════════════════════════════════════════════ */}
      {viewingReceipt && (() => {
        const rc = viewingReceipt;
        const targetLoan = loans.find((l) => l.loanNo === rc.loanNo || l.id === rc.loanId);
        const targetCust = customers.find((c) => isMatchingCustomerId(rc.customerId, c));
        const custName = targetCust?.name || rc.customerName || 'Valued Customer';
        const custId = targetCust ? getCanonicalCustomerId(targetCust) : rc.customerId;
        const custPhone = targetCust?.phone || rc.customerPhone || 'N/A';
        const custAddress = targetCust?.currentAddress || targetLoan?.customerCurrentAddress || 'Tamil Nadu, India';

        return (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              zIndex: 1350,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              overflowY: 'auto'
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '740px',
                maxHeight: '94vh',
                overflowY: 'auto',
                padding: '32px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)'
              }}
            >
              {/* Modal Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '11.5px' }}>
                  ✓ OFFICIAL PAYMENT VOUCHER
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handlePrintVoucher(rc)}
                    style={{ fontWeight: 700 }}
                  >
                    <Printer size={14} style={{ marginRight: '4px' }} /> Print
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDownloadReceiptHtml(rc)}
                    style={{ fontWeight: 700 }}
                  >
                    <Download size={14} style={{ marginRight: '4px' }} /> Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingReceipt(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Voucher Content Container */}
              <div id="loan-payment-receipt-voucher" style={{ border: '2px solid #064e3b', borderRadius: '12px', padding: '24px', backgroundColor: '#ffffff' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #064e3b', paddingBottom: '14px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#064e3b', margin: 0 }}>
                      KKV GOLD FINANCE
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                      MAIN BRANCH &mdash; 104 G.S.T Road, Chennai - 600045 | Ph: +91 44 2233 4455
                    </p>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                      Reg: TN-CHE-2018-GF492 | GSTIN: 33AAAAA0000A1Z5
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ backgroundColor: '#064e3b', color: '#ffffff', fontWeight: 800, padding: '5px 12px', borderRadius: '6px', fontSize: '12.5px', textTransform: 'uppercase' }}>
                      Loan Payment Receipt
                    </div>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: '#f1f5f9', padding: '12px 14px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Receipt No:</span>
                    <div style={{ fontWeight: 800, color: '#064e3b' }}>REC-{rc.receiptNo}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Loan No:</span>
                    <div style={{ fontWeight: 800 }}>{rc.loanNo}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Payment Date:</span>
                    <div style={{ fontWeight: 800 }}>{rc.date}</div>
                  </div>
                </div>

                {/* Customer Details */}
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#064e3b', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Customer Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
                  <div>Name: <strong>{custName}</strong></div>
                  <div>Customer ID: <strong>{custId}</strong></div>
                  <div>Mobile: <strong>+91 {custPhone}</strong></div>
                  <div>Address: {custAddress}</div>
                </div>

                {/* Loan & Schedule Details */}
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#064e3b', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Loan &amp; Schedule Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
                  <div>Loan Number: <strong>{rc.loanNo}</strong></div>
                  <div>Contractual Due: <strong>{rc.currentDueDate || rc.date}</strong></div>
                  <div>Outstanding Before: <strong>₹{(rc.outstandingBefore ?? 0).toLocaleString('en-IN')}</strong></div>
                  <div>Outstanding After: <strong style={{ color: '#059669' }}>₹{(rc.outstandingAfter ?? 0).toLocaleString('en-IN')}</strong></div>
                  <div>Next Due Date: <strong>{rc.nextDueDate || '— (Closed)'}</strong></div>
                  <div>Receipt Type: <strong>{rc.kind}</strong></div>
                </div>

                {/* Settlement Breakdown */}
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#064e3b', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Payment Settlement Breakdown
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
                  <div>Interest Paid: <strong>₹{(rc.interestComponent || 0).toLocaleString('en-IN')}</strong></div>
                  <div>Penalty / Late Charges: <strong>₹{(rc.penaltyComponent || 0).toLocaleString('en-IN')}</strong></div>
                  <div>Principal Repaid: <strong>₹{(rc.principalComponent || 0).toLocaleString('en-IN')}</strong></div>
                  <div>Total Received: <strong style={{ color: '#059669', fontSize: '14px' }}>₹{rc.amount.toLocaleString('en-IN')}</strong></div>
                  <div>Disbursement Mode: <strong>{targetLoan?.bankMode || 'Cash'}</strong></div>
                  <div>Repayment Mode: <strong>{rc.paymentMode}{rc.bankName ? ` (${rc.bankName})` : ''}</strong></div>
                  <div>Transaction Reference: <strong>{rc.transactionReference || 'Cash Settlement'}</strong></div>
                  <div>Status: <strong style={{ color: '#059669' }}>✓ PAID</strong></div>
                </div>

                {/* Pledged Ornaments Table */}
                {targetLoan && targetLoan.items && targetLoan.items.length > 0 && (
                  <div style={{ marginTop: '10px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#064e3b', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Pledged Collateral Ornaments
                    </div>
                    <table className="custom-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Purity</th>
                          <th>Gross Wt</th>
                          <th>Deduction Wt</th>
                          <th>Net Wt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetLoan.items.map((it, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700 }}>{it.item}</td>
                            <td>{it.qty}</td>
                            <td>{it.purity}</td>
                            <td>{Number(it.grossWeight || 0).toFixed(3)}g</td>
                            <td>{Number(it.deductionWeight || 0).toFixed(3)}g</td>
                            <td>{Number(it.netWeight !== undefined ? it.netWeight : Math.max(0, (Number(it.grossWeight) || 0) - (Number(it.deductionWeight) || 0))).toFixed(3)}g</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div>Customer Signature<br/><br/>_______________________</div>
                  <div style={{ textAlign: 'right' }}>Authorized Signatory (KKV)<br/><br/>_______________________</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════════
          INTERACTIVE PHOTO LIGHTBOX MODAL
          ════════════════════════════════════════════════════════════════════════ */}
      {lightboxIndex !== null && selectedLoan && selectedLoan.photos && selectedLoan.photos[lightboxIndex] && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.92)',
            zIndex: 1400,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              right: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#ffffff',
              zIndex: 10
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '14px', fontWeight: 700 }}>
              Pledged Collateral &bull; {selectedLoan.loanNo} (Photo {lightboxIndex + 1} of {selectedLoan.photos.length})
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(3, z + 0.25))}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ZoomIn size={16} /> Zoom
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(0.5, z - 0.25))}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom(1)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Image */}
          <div
            style={{
              maxHeight: '80vh',
              maxWidth: '85vw',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedLoan.photos[lightboxIndex]}
              alt="Pledged Gold"
              style={{
                transform: `scale(${lightboxZoom})`,
                transition: 'transform 0.2s ease',
                maxHeight: '80vh',
                maxWidth: '85vw',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
          </div>

          {/* Navigation Arrows */}
          {selectedLoan.photos.length > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                display: 'flex',
                gap: '20px',
                zIndex: 10
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={lightboxIndex === 0}
                onClick={() => {
                  setLightboxIndex((idx) => Math.max(0, (idx ?? 0) - 1));
                  setLightboxZoom(1);
                }}
                style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: lightboxIndex === 0 ? 'not-allowed' : 'pointer', opacity: lightboxIndex === 0 ? 0.4 : 1 }}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                disabled={lightboxIndex === selectedLoan.photos.length - 1}
                onClick={() => {
                  setLightboxIndex((idx) => Math.min(selectedLoan.photos.length - 1, (idx ?? 0) + 1));
                  setLightboxZoom(1);
                }}
                style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: lightboxIndex === selectedLoan.photos.length - 1 ? 'not-allowed' : 'pointer', opacity: lightboxIndex === selectedLoan.photos.length - 1 ? 0.4 : 1 }}
              >
                <ChevronRight size={22} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PAYMENT HISTORY MODAL FOR SELECTED LOAN
          ════════════════════════════════════════════════════════════════════════ */}
      {viewingLoanHistory && (() => {
        const historyReceipts = receipts.filter(
          (r) => r.loanId === viewingLoanHistory.id || r.loanNo === viewingLoanHistory.loanNo
        );

        return (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.65)',
              zIndex: 1300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '85vh',
                overflowY: 'auto',
                padding: '24px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: 0 }}>
                    Payment History &bull; {viewingLoanHistory.loanNo}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Customer: {viewingLoanHistory.customerName} &bull; Outstanding: ₹{viewingLoanHistory.outstandingPrincipal.toLocaleString('en-IN')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingLoanHistory(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={20} />
                </button>
              </div>

              {historyReceipts.length > 0 ? (
                <div className="table-container">
                  <table className="custom-table" style={{ fontSize: '12.5px' }}>
                    <thead>
                      <tr>
                        <th>Receipt No</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyReceipts.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>REC-{r.receiptNo}</td>
                          <td>{r.date}</td>
                          <td>
                            <span className="badge badge-info" style={{ fontSize: '10.5px' }}>{r.kind}</span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#059669' }}>₹{r.amount.toLocaleString('en-IN')}</td>
                          <td>{r.paymentMode}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                              onClick={() => {
                                setViewingReceipt(r);
                                setViewingLoanHistory(null);
                              }}
                            >
                              <Eye size={12} /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                  No previous payments recorded for loan {viewingLoanHistory.loanNo}.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setViewingLoanHistory(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
