import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Printer,
  Eye,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { Customer, Loan, Receipt, OrnamentItem } from '../types';
import { isMatchingCustomerId, getCanonicalCustomerId } from '../utils/customerUtils';
import { addCalendarMonths } from '../utils/fdInterestUtils';
import { parseLoanDate } from '../utils/loanCalculationUtils';
import { KKVLogo } from '../components/common/KKVLogo';

export const LoanReceipts: React.FC = () => {
  const {
    loans,
    customers,
    receipts,
    selectedLoan,
    setSelectedLoan,
    setSelectedReceipt,
    addReceipt,
    setCurrentPage,
    showToast
  } = useApp();

  // ── Step 1: Customer Selection State ──────────────────────────────────────────
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // ── Step 2: Loan Selection State ──────────────────────────────────────────────
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // ── Step 3: Receipt Form State ────────────────────────────────────────────────
  const [receiptType, setReceiptType] = useState<
    'Interest Payment' | 'EMI Payment' | 'Part Principal Payment' | 'Full Principal Closure' | 'Interest + Principal' | 'Other'
  >('Interest Payment');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [interestAmount, setInterestAmount] = useState<string>('');
  const [principalAmount, setPrincipalAmount] = useState<string>('');
  const [otherAmount, setOtherAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'UPI'>('Cash');
  const [bankName, setBankName] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [notes, setNotes] = useState<string>('Monthly interest payment');

  // Additional Charges
  const odCharge = 0;
  const otherCharges = 0;
  const discount = 0;
  const tdsAmount = 0;

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [lastGeneratedReceipt, setLastGeneratedReceipt] = useState<Receipt | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  // ── Auto-initialize with selectedLoan if arriving from another screen ─────────
  useEffect(() => {
    if (selectedLoan && !selectedCustomer) {
      const matchedCust = customers.find((c) => isMatchingCustomerId(selectedLoan.customerId, c));
      if (matchedCust) {
        setSelectedCustomer(matchedCust);
        setSelectedLoanId(selectedLoan.id);
      }
    }
  }, [selectedLoan, selectedCustomer, customers]);

  // ── Filtered Customers for Search ─────────────────────────────────────────────
  const matchingCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return customers.filter((c) => !c.isDeleted).slice(0, 8);

    return customers.filter((c) => {
      if (c.isDeleted) return false;
      const canonicalId = getCanonicalCustomerId(c).toLowerCase();
      const numIdStr = c.customerId ? c.customerId.toString() : '';
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();

      return (
        name.includes(q) ||
        phone.includes(q) ||
        canonicalId.includes(q) ||
        numIdStr.includes(q) ||
        isMatchingCustomerId(q, c)
      );
    });
  }, [customers, customerSearchQuery]);

  // ── Customer's Loans ──────────────────────────────────────────────────────────
  const customerLoans = useMemo(() => {
    if (!selectedCustomer) return [];
    return loans.filter((l) => isMatchingCustomerId(l.customerId, selectedCustomer));
  }, [loans, selectedCustomer]);

  // ── Active Loan Details ───────────────────────────────────────────────────────
  const currentLoan = useMemo(() => {
    if (!selectedLoanId) return null;
    return loans.find((l) => l.id === selectedLoanId) || null;
  }, [loans, selectedLoanId]);

  // ── Loan Previous Receipts ────────────────────────────────────────────────────
  const loanReceipts = useMemo(() => {
    if (!currentLoan) return [];
    return receipts.filter((r) => r.loanNo === currentLoan.loanNo || r.loanId === currentLoan.id);
  }, [receipts, currentLoan]);

  // ── Interest & Due Calculation ────────────────────────────────────────────────
  const monthlyInterest = useMemo(() => {
    if (!currentLoan) return 0;
    return (
      currentLoan.monthlyInterest ||
      ((currentLoan.outstandingPrincipal || currentLoan.principal) * currentLoan.interestRate) / 100
    );
  }, [currentLoan]);

  // Check if current due period has already been paid
  const isInterestAlreadyPaid = useMemo(() => {
    if (!currentLoan) return false;
    const currentDueDate = currentLoan.nextDueDate || currentLoan.date;
    if (currentLoan.lastInterestPaidDate && parseLoanDate(currentLoan.lastInterestPaidDate) >= parseLoanDate(currentDueDate)) {
      return true;
    }
    // Check if there is an interest payment recorded on/after currentDueDate
    const matchingReceipt = loanReceipts.find(
      (r) =>
        r.kind === 'INTEREST PAYMENT' &&
        (r.currentDueDate === currentDueDate || parseLoanDate(r.date) >= parseLoanDate(currentDueDate))
    );
    return Boolean(matchingReceipt);
  }, [currentLoan, loanReceipts]);

  // ── Auto-adjust amounts when receiptType or loan changes ──────────────────────
  useEffect(() => {
    if (!currentLoan) return;

    if (receiptType === 'Interest Payment') {
      setInterestAmount(String(monthlyInterest));
      setPrincipalAmount('0');
      setOtherAmount('0');
      setNotes('Monthly interest payment');
    } else if (receiptType === 'EMI Payment') {
      setInterestAmount(String(monthlyInterest));
      setPrincipalAmount('0');
      setOtherAmount('0');
      setNotes('Monthly EMI payment');
    } else if (receiptType === 'Part Principal Payment') {
      setInterestAmount('0');
      setPrincipalAmount(String(Math.min(10000, currentLoan.outstandingPrincipal)));
      setOtherAmount('0');
      setNotes('Part principal reduction payment');
    } else if (receiptType === 'Full Principal Closure') {
      setInterestAmount(isInterestAlreadyPaid ? '0' : String(monthlyInterest));
      setPrincipalAmount(String(currentLoan.outstandingPrincipal));
      setOtherAmount('0');
      setNotes('Full loan closure & gold release');
    } else if (receiptType === 'Interest + Principal') {
      setInterestAmount(String(monthlyInterest));
      setPrincipalAmount(String(Math.min(10000, currentLoan.outstandingPrincipal)));
      setOtherAmount('0');
      setNotes('Interest cleared with part principal repayment');
    } else {
      setInterestAmount('0');
      setPrincipalAmount('0');
      setOtherAmount('0');
      setNotes('Other loan settlement charge');
    }
  }, [receiptType, currentLoan, monthlyInterest, isInterestAlreadyPaid]);

  const numInterest = parseFloat(interestAmount) || 0;
  const numPrincipal = parseFloat(principalAmount) || 0;
  const numOther = parseFloat(otherAmount) || 0;

  // Total base amount
  const baseAmount = useMemo(() => {
    if (receiptType === 'Interest Payment' || receiptType === 'EMI Payment') {
      return numInterest;
    }
    if (receiptType === 'Part Principal Payment') {
      return numPrincipal;
    }
    if (receiptType === 'Full Principal Closure') {
      return numPrincipal + numInterest;
    }
    if (receiptType === 'Interest + Principal') {
      return numInterest + numPrincipal;
    }
    return numOther;
  }, [receiptType, numInterest, numPrincipal, numOther]);

  const netTotalAmount = Math.max(0, baseAmount + odCharge + otherCharges - discount);

  // Outstanding preview after receipt
  const outstandingAfter = useMemo(() => {
    if (!currentLoan) return 0;
    if (receiptType === 'Full Principal Closure') return 0;
    const deduction =
      receiptType === 'Part Principal Payment' || receiptType === 'Interest + Principal'
        ? numPrincipal
        : 0;
    return Math.max(0, currentLoan.outstandingPrincipal - deduction);
  }, [currentLoan, receiptType, numPrincipal]);

  // Next receipt number
  const nextReceiptNo = useMemo(() => {
    const maxExisting = receipts.length > 0 ? Math.max(...receipts.map((r) => r.receiptNo || 0)) : 0;
    return maxExisting + 1;
  }, [receipts]);

  // ── Handler: Customer Selection ───────────────────────────────────────────────
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    const custLoans = loans.filter((l) => isMatchingCustomerId(l.customerId, customer));
    if (custLoans.length === 1) {
      setSelectedLoanId(custLoans[0].id);
      setSelectedLoan(custLoans[0]);
    } else {
      setSelectedLoanId(null);
    }
  };

  const handleResetCustomer = () => {
    setSelectedCustomer(null);
    setSelectedLoanId(null);
    setSelectedLoan(null);
  };

  // ── Handler: Loan Selection ───────────────────────────────────────────────────
  const handleSelectLoan = (loan: Loan) => {
    setSelectedLoanId(loan.id);
    setSelectedLoan(loan);
  };

  // ── Handler: Form Submission ──────────────────────────────────────────────────
  const handleGenerateReceipt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedCustomer) {
      showToast('Please search and select a customer first.', 'error');
      return;
    }
    if (!currentLoan) {
      showToast('Please select a loan belonging to this customer.', 'error');
      return;
    }
    if (currentLoan.status === 'CLOSED') {
      showToast(`Loan ${currentLoan.loanNo} is already closed! No further receipts allowed.`, 'error');
      return;
    }
    if (receiptType === 'Interest Payment' && isInterestAlreadyPaid) {
      showToast('Interest for this period has already been paid! Duplicate payment blocked.', 'error');
      return;
    }
    if (netTotalAmount <= 0) {
      showToast('Payment amount must be greater than zero.', 'error');
      return;
    }
    if (
      (receiptType === 'Part Principal Payment' || receiptType === 'Interest + Principal') &&
      numPrincipal > currentLoan.outstandingPrincipal
    ) {
      showToast(
        `Principal repayment cannot exceed current outstanding of ₹${currentLoan.outstandingPrincipal.toLocaleString('en-IN')}.`,
        'error'
      );
      return;
    }
    if (paymentMethod === 'Bank' && (!bankName.trim() || !transactionReference.trim())) {
      showToast('Please enter Bank Name and UTR / Transaction Reference for Bank Transfer.', 'error');
      return;
    }
    if (paymentMethod === 'UPI' && !transactionReference.trim()) {
      showToast('Please enter UPI Transaction Reference / UTR.', 'error');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Map friendly receiptType to canonical kind
      let canonicalKind: Receipt['kind'] = 'INTEREST PAYMENT';
      if (receiptType === 'Interest Payment') canonicalKind = 'INTEREST PAYMENT';
      else if (receiptType === 'EMI Payment') canonicalKind = 'EMI PAYMENT';
      else if (receiptType === 'Part Principal Payment') canonicalKind = 'PART PAYMENT';
      else if (receiptType === 'Full Principal Closure') canonicalKind = 'LOAN CLOSURE';
      else if (receiptType === 'Interest + Principal') canonicalKind = 'INTEREST + PRINCIPAL';
      else canonicalKind = 'OTHER';

      // Next due date calculation
      let calculatedNextDue = currentLoan.nextDueDate;
      if (canonicalKind === 'INTEREST PAYMENT' || canonicalKind === 'EMI PAYMENT' || canonicalKind === 'INTEREST + PRINCIPAL') {
        const baseDueDate = currentLoan.nextDueDate || currentLoan.date || date;
        try {
          calculatedNextDue = addCalendarMonths(baseDueDate, 1);
        } catch {
          calculatedNextDue = baseDueDate;
        }
      }

      const receiptRecord = addReceipt({
        loanNo: currentLoan.loanNo,
        loanId: currentLoan.id,
        customerId: getCanonicalCustomerId(selectedCustomer),
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        kind: canonicalKind,
        loanType: currentLoan.loanTypeName || currentLoan.loanType || 'Gold Loan',
        amount: netTotalAmount,
        principalComponent:
          receiptType === 'Full Principal Closure'
            ? currentLoan.outstandingPrincipal
            : receiptType === 'Part Principal Payment' || receiptType === 'Interest + Principal'
            ? numPrincipal
            : 0,
        interestComponent:
          receiptType === 'Interest Payment' || receiptType === 'EMI Payment' || receiptType === 'Interest + Principal'
            ? numInterest
            : receiptType === 'Full Principal Closure'
            ? numInterest
            : 0,
        paymentMode: paymentMethod,
        date,
        currentDueDate: currentLoan.nextDueDate || currentLoan.date,
        nextDueDate: calculatedNextDue,
        odCharges: odCharge,
        otherCharges,
        discount,
        tdsAmount,
        notes,
        bankName: paymentMethod === 'Bank' ? bankName : undefined,
        transactionReference: paymentMethod !== 'Cash' ? transactionReference : undefined,
        upiId: paymentMethod === 'UPI' ? upiId : undefined,
        outstandingBefore: currentLoan.outstandingPrincipal,
        outstandingAfter,
        processedBy: 'Admin',
        createdAt: new Date().toISOString()
      });

      setLastGeneratedReceipt(receiptRecord);
      setShowSuccessModal(true);
      setPreviewModalOpen(false);
      showToast(`Receipt #${receiptRecord.receiptNo} generated successfully!`, 'success');
    } catch {
      showToast('An unexpected error occurred while generating the receipt.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReceiptDisplay = (r: Receipt) => {
    setSelectedReceipt(r);
    setCurrentPage('receipt-display');
  };

  // Pledged ornament photos
  const pledgedPhotos = useMemo(() => {
    if (!currentLoan) return [];
    return currentLoan.photos || (currentLoan as any).ornamentPhotos || [];
  }, [currentLoan]);

  return (
    <div className="page-content" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
            Loan Payment Receipt
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
            Customer-centric repayment, monthly interest clearing, part payment, and pledge closure
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            className="badge badge-info"
            style={{ fontSize: '12px', fontWeight: 800, padding: '6px 12px' }}
          >
            NEXT VOUCHER #{nextReceiptNo}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage('all-receipts')}
          >
            <Eye size={14} />
            <span>All Receipts Ledger</span>
          </button>
        </div>
      </div>

      {/* ── WORKFLOW CONTAINER ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1: CUSTOMER SELECTION
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="card" style={{ padding: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-subtle, #e2e8f0)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: selectedCustomer
                    ? 'rgba(5, 150, 105, 0.12)'
                    : 'rgba(217, 119, 6, 0.12)',
                  color: selectedCustomer ? 'var(--color-primary-accent, #059669)' : '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '14px'
                }}
              >
                1
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
                  Customer Identification
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Search master borrower database by Customer ID, Name, or Mobile
                </span>
              </div>
            </div>

            {selectedCustomer && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '11.5px', fontWeight: 700 }}
                onClick={handleResetCustomer}
              >
                Change Customer
              </button>
            )}
          </div>

          {!selectedCustomer ? (
            <div>
              {/* Search Bar */}
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <input
                  type="text"
                  className="input-control"
                  style={{
                    height: '44px',
                    paddingLeft: '40px',
                    fontSize: '14px',
                    borderRadius: '8px'
                  }}
                  placeholder="Search Customer ID (e.g. CUST-0006), Name (e.g. Sanjai), or Mobile (e.g. 8637628773)..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  autoFocus
                />
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
                {customerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Matching Customers Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '12px'
                }}
              >
                {matchingCustomers.length === 0 ? (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      padding: '30px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                      borderRadius: '8px'
                    }}
                  >
                    No matching customer found for "{customerSearchQuery}".
                  </div>
                ) : (
                  matchingCustomers.map((c) => {
                    const custLoansCount = loans.filter((l) => isMatchingCustomerId(l.customerId, c)).length;
                    const canonicalId = getCanonicalCustomerId(c);
                    return (
                      <div
                        key={c.id}
                        style={{
                          padding: '14px',
                          borderRadius: '8px',
                          border: '1.5px solid var(--border-light, #e2e8f0)',
                          backgroundColor: 'var(--bg-card)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {c.customerPhoto || (c as any).photoUrl ? (
                            <img
                              src={(c.customerPhoto || (c as any).photoUrl)!}
                              alt={c.name}
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid var(--border-light)'
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(5, 150, 105, 0.12)',
                                color: 'var(--color-primary-dark)',
                                fontWeight: 800,
                                fontSize: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-dark)' }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-primary-dark)', fontWeight: 700 }}>
                              {canonicalId}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              +91 {c.phone}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '8px',
                            borderTop: '1px solid var(--border-subtle, #f1f5f9)'
                          }}
                        >
                          <span
                            className="badge badge-info"
                            style={{ fontSize: '11px', fontWeight: 700 }}
                          >
                            {custLoansCount} {custLoansCount === 1 ? 'Loan' : 'Loans'}
                          </span>

                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 12px' }}
                            onClick={() => handleSelectCustomer(c)}
                          >
                            Select Customer
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Selected Customer Preview Card */
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: 'rgba(5, 150, 105, 0.05)',
                border: '1.5px solid rgba(5, 150, 105, 0.25)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {selectedCustomer.customerPhoto || (selectedCustomer as any).photoUrl ? (
                  <img
                    src={(selectedCustomer.customerPhoto || (selectedCustomer as any).photoUrl)!}
                    alt={selectedCustomer.name}
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--color-primary-accent, #059669)'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-primary-accent, #059669)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
                      {selectedCustomer.name}
                    </span>
                    <span
                      style={{
                        backgroundColor: 'var(--color-primary-dark)',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}
                    >
                      {getCanonicalCustomerId(selectedCustomer)}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    📞 +91 {selectedCustomer.phone} &nbsp;|&nbsp; 📍 {selectedCustomer.currentAddressDetails?.city || selectedCustomer.currentAddress || 'Tamil Nadu'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge badge-success" style={{ fontSize: '12px', fontWeight: 700 }}>
                  ✓ Customer Selected
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2 & 3: CUSTOMER'S LOANS & SELECTION
            ══════════════════════════════════════════════════════════════════════ */}
        {selectedCustomer && (
          <div className="card" style={{ padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--border-subtle, #e2e8f0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: currentLoan
                      ? 'rgba(5, 150, 105, 0.12)'
                      : 'rgba(2, 132, 199, 0.12)',
                    color: currentLoan ? 'var(--color-primary-accent, #059669)' : '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '14px'
                  }}
                >
                  2
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
                    Loans Belonging to {selectedCustomer.name}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Found {customerLoans.length} loan accounts linked to {getCanonicalCustomerId(selectedCustomer)}
                  </span>
                </div>
              </div>
            </div>

            {customerLoans.length === 0 ? (
              <div
                style={{
                  padding: '30px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                  borderRadius: '8px',
                  color: 'var(--text-muted)'
                }}
              >
                No loans currently registered for this customer.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '14px'
                }}
              >
                {customerLoans.map((l) => {
                  const isSelected = l.id === selectedLoanId;
                  const isClosed = l.status === 'CLOSED';
                  return (
                    <div
                      key={l.id}
                      onClick={() => !isClosed && handleSelectLoan(l)}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: isSelected
                          ? '2px solid var(--color-primary-accent, #059669)'
                          : '1px solid var(--border-light, #e2e8f0)',
                        backgroundColor: isSelected
                          ? 'rgba(5, 150, 105, 0.04)'
                          : isClosed
                          ? 'var(--bg-surface-secondary, #f8fafc)'
                          : '#ffffff',
                        boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                        cursor: isClosed ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        opacity: isClosed ? 0.7 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--color-primary-dark)' }}>
                            {l.loanNo}
                          </span>
                          <span
                            className="badge badge-gold"
                            style={{ fontSize: '11px', fontWeight: 700 }}
                          >
                            {l.loanTypeName || l.loanType || 'Gold Loan'}
                          </span>
                        </div>

                        <span
                          className={`badge ${
                            l.status === 'ACTIVE'
                              ? 'badge-success'
                              : l.status === 'OVERDUE'
                              ? 'badge-danger'
                              : 'badge-secondary'
                          }`}
                          style={{ fontSize: '11px', fontWeight: 800 }}
                        >
                          {l.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Principal:</span>
                          <div style={{ fontWeight: 700 }}>₹{l.principal.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Outstanding:</span>
                          <div style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                            ₹{l.outstandingPrincipal.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Monthly Interest:</span>
                          <div style={{ fontWeight: 700, color: '#059669' }}>
                            ₹{(l.monthlyInterest || Math.round((l.principal * l.interestRate) / 100)).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Next Due:</span>
                          <div style={{ fontWeight: 600 }}>{l.nextDueDate || l.date}</div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '8px',
                          borderTop: '1px solid var(--border-subtle, #f1f5f9)'
                        }}
                      >
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          Net Gold: <strong>{l.totalNetWeight ? `${l.totalNetWeight.toFixed(2)}g` : 'N/A'}</strong>
                        </span>

                        <button
                          type="button"
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '11.5px', fontWeight: 700 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isClosed) handleSelectLoan(l);
                          }}
                          disabled={isClosed}
                        >
                          {isSelected ? '✓ Selected' : isClosed ? 'Closed' : 'Select Loan'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 4 & 5: SELECTED LOAN DETAILS, COLLATERAL, PHOTOS & PAYMENT HISTORY
            ══════════════════════════════════════════════════════════════════════ */}
        {currentLoan && (
          <div className="grid-3" style={{ alignItems: 'start', gap: '20px' }}>
            {/* LEFT 2 COLUMNS: RECEIPT FORM */}
            <div className="card" style={{ gridColumn: 'span 2', padding: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '18px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--border-subtle, #e2e8f0)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(5, 150, 105, 0.12)',
                      color: 'var(--color-primary-accent, #059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '14px'
                    }}
                  >
                    3
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-dark)' }}>
                      Record Receipt for {currentLoan.loanNo}
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Current Outstanding: <strong>₹{currentLoan.outstandingPrincipal.toLocaleString('en-IN')}</strong>
                    </span>
                  </div>
                </div>

                <span className="badge badge-info" style={{ fontWeight: 800 }}>
                  VOUCHER #{nextReceiptNo}
                </span>
              </div>

              {/* Already Paid Warning Alert */}
              {isInterestAlreadyPaid && receiptType === 'Interest Payment' && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1.5px solid #fde68a',
                    color: '#92400e',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                >
                  <AlertTriangle size={18} color="#d97706" />
                  <span>
                    Interest for the current period (Due: {currentLoan.nextDueDate || currentLoan.date}) has already been paid. Duplicate interest receipts are blocked.
                  </span>
                </div>
              )}

              <form onSubmit={handleGenerateReceipt} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Row 1: Receipt Type + Payment Date */}
                <div className="grid-2" style={{ gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label required">RECEIPT TYPE</label>
                    <select
                      className="select-control"
                      value={receiptType}
                      onChange={(e) => setReceiptType(e.target.value as any)}
                    >
                      <option value="Interest Payment">Interest Payment</option>
                      <option value="EMI Payment">EMI Payment</option>
                      <option value="Part Principal Payment">Part Principal Payment</option>
                      <option value="Full Principal Closure">Full Principal Closure</option>
                      <option value="Interest + Principal">Interest + Principal</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label required">PAYMENT DATE</label>
                    <input
                      type="date"
                      className="input-control"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Dynamic Amount Inputs depending on Receipt Type */}
                {receiptType === 'Interest Payment' || receiptType === 'EMI Payment' ? (
                  <div className="grid-2" style={{ gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label required">MONTHLY INTEREST AMOUNT (₹)</label>
                      <input
                        type="number"
                        step="any"
                        className="input-control"
                        placeholder="0.00"
                        value={interestAmount}
                        onChange={(e) => setInterestAmount(e.target.value)}
                        style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)' }}
                        required
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Monthly interest rate: {currentLoan.interestRate}% on current balance
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">CURRENT DUE DATE</label>
                      <input
                        type="text"
                        className="input-control"
                        value={currentLoan.nextDueDate || currentLoan.date}
                        readOnly
                        style={{ backgroundColor: 'var(--bg-surface-secondary)', fontWeight: 700 }}
                      />
                    </div>
                  </div>
                ) : receiptType === 'Part Principal Payment' ? (
                  <div className="grid-2" style={{ gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label required">PART PRINCIPAL AMOUNT (₹)</label>
                      <input
                        type="number"
                        step="any"
                        className="input-control"
                        placeholder="0.00"
                        value={principalAmount}
                        onChange={(e) => setPrincipalAmount(e.target.value)}
                        max={currentLoan.outstandingPrincipal}
                        style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)' }}
                        required
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Max payable: ₹{currentLoan.outstandingPrincipal.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">REMAINING OUTSTANDING PREVIEW</label>
                      <div
                        style={{
                          padding: '8px 12px',
                          backgroundColor: 'var(--bg-surface-secondary)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-light)',
                          fontWeight: 800,
                          fontSize: '15px',
                          color: 'var(--color-primary-dark)'
                        }}
                      >
                        ₹{outstandingAfter.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                ) : receiptType === 'Full Principal Closure' ? (
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--badge-success-bg)',
                      border: '1.5px solid var(--badge-success-border)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--badge-success-text)' }}>
                        Full Loan Closure &amp; Gold Collateral Release
                      </span>
                      <span className="badge badge-success">OUTSTANDING BECOMES ₹0</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span>Principal Settlement:</span>
                      <strong>₹{currentLoan.outstandingPrincipal.toLocaleString('en-IN')}</strong>
                    </div>
                    {numInterest > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span>Pending Interest:</span>
                        <strong>₹{numInterest.toLocaleString('en-IN')}</strong>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '16px',
                        fontWeight: 900,
                        color: 'var(--color-primary-dark)',
                        paddingTop: '6px',
                        borderTop: '1px dashed #86efac'
                      }}
                    >
                      <span>Total Full Closure Amount:</span>
                      <span>₹{netTotalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ) : receiptType === 'Interest + Principal' ? (
                  <div className="grid-2" style={{ gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label required">INTEREST COMPONENT (₹)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className="input-control"
                        value={interestAmount}
                        onChange={(e) => setInterestAmount(e.target.value)}
                        style={{ fontSize: '15px', fontWeight: 700 }}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label required">PRINCIPAL COMPONENT (₹)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className="input-control"
                        value={principalAmount}
                        onChange={(e) => setPrincipalAmount(e.target.value)}
                        max={currentLoan.outstandingPrincipal}
                        style={{ fontSize: '15px', fontWeight: 700 }}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label required">CUSTOM AMOUNT (₹)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="input-control"
                      value={otherAmount}
                      onChange={(e) => setOtherAmount(e.target.value)}
                      style={{ fontSize: '16px', fontWeight: 800 }}
                      required
                    />
                  </div>
                )}

                {/* Row: Payment Method */}
                <div className="form-group">
                  <label className="form-label required">PAYMENT METHOD</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {(['Cash', 'Bank', 'UPI'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`btn btn-sm ${paymentMethod === m ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, height: '36px', fontSize: '13px', fontWeight: 700 }}
                        onClick={() => setPaymentMethod(m)}
                      >
                        {m === 'Cash' ? '💵 Cash' : m === 'Bank' ? '🏦 Bank Transfer' : '📱 UPI'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Details for Bank / UPI */}
                {paymentMethod === 'Bank' && (
                  <div className="grid-2" style={{ gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label required">BANK NAME</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="e.g. State Bank of India / HDFC Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label required">UTR / TRANSACTION REFERENCE</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="e.g. UTR1234567890"
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'UPI' && (
                  <div className="grid-2" style={{ gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label required">UPI TRANSACTION ID / UTR</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="e.g. 423589123456"
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">CUSTOMER UPI ID (OPTIONAL)</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="e.g. customer@okaxis"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Remarks & Notes */}
                <div className="form-group">
                  <label className="form-label">NOTES / PARTICULARS</label>
                  <input
                    type="text"
                    className="input-control"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter receipt particulars..."
                  />
                </div>

                {/* Net Received Summary Banner */}
                <div
                  style={{
                    backgroundColor: 'rgba(5, 150, 105, 0.08)',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1.5px solid rgba(5, 150, 105, 0.25)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-primary-dark)', letterSpacing: '0.05em' }}>
                      NET AMOUNT TO RECEIVE
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Inflow via {paymentMethod} to branch vault ledger
                    </div>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--color-primary-dark)' }}>
                    ₹{netTotalAmount.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPreviewModalOpen(true)}
                  >
                    <Eye size={15} />
                    <span>Receipt Preview</span>
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    style={{ minWidth: '220px', fontWeight: 800, gap: '8px' }}
                    disabled={isSubmitting || (isInterestAlreadyPaid && receiptType === 'Interest Payment')}
                  >
                    <Printer size={18} />
                    <span>{isSubmitting ? 'Recording...' : 'Generate & Print Receipt'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* RIGHT COLUMN: PLEDGED COLLATERAL & PLEDGED PHOTOS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Pledged Collateral Card */}
              <div className="card" style={{ padding: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-dark)' }}>
                    Pledged Gold Collateral
                  </h3>
                  <span className="badge badge-gold">COLLATERAL</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Loan Number:</span>
                    <strong style={{ color: 'var(--color-primary-dark)' }}>{currentLoan.loanNo}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Gross Weight:</span>
                    <strong>{currentLoan.totalGrossWeight ? `${currentLoan.totalGrossWeight.toFixed(2)} g` : 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Net Gold Weight:</span>
                    <strong style={{ color: 'var(--color-primary-dark)' }}>
                      {currentLoan.totalNetWeight ? `${currentLoan.totalNetWeight.toFixed(2)} g` : 'N/A'}
                    </strong>
                  </div>

                  {/* Ornaments Items List */}
                  {currentLoan.items && currentLoan.items.length > 0 && (
                    <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Pledged Ornaments:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {currentLoan.items.map((item: OrnamentItem, idx: number) => (
                          <div
                            key={item.id || idx}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                              borderRadius: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '12px'
                            }}
                          >
                            <span>
                              <strong>{item.item}</strong> (x{item.qty}) &mdash; {item.purity}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              Gross: {Number(item.grossWeight || 0).toFixed(3)}g
                              {Number(item.deductionWeight || 0) > 0 ? ` | Ded: ${Number(item.deductionWeight).toFixed(3)}g` : ''}
                              {' '}| Net: <strong style={{ color: 'var(--text-primary)' }}>{Number(item.netWeight !== undefined ? item.netWeight : Math.max(0, (Number(item.grossWeight) || 0) - (Number(item.deductionWeight) || 0))).toFixed(3)}g</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* PLEDGED GOLD PHOTOS GALLERY (MAJOR REQUIREMENT) */}
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-dark)', textTransform: 'uppercase' }}>
                      Pledged Gold Photos ({pledgedPhotos.length})
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Saved from Loan Issue
                    </span>
                  </div>

                  {pledgedPhotos.length === 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: 'var(--text-muted)'
                      }}
                    >
                      No ornament photos uploaded for this loan.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {pledgedPhotos.map((imgUrl: string, imgIdx: number) => (
                        <div
                          key={`pledged-img-${imgIdx}`}
                          onClick={() => {
                            setLightboxIndex(imgIdx);
                            setLightboxZoom(1);
                          }}
                          style={{
                            aspectRatio: '1',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '1.5px solid var(--border-light)',
                            cursor: 'pointer',
                            position: 'relative',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                          title="Click to view full photo"
                        >
                          <img
                            src={imgUrl}
                            alt={`Collateral Photo ${imgIdx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              backgroundColor: 'rgba(0, 0, 0, 0.65)',
                              color: '#ffffff',
                              fontSize: '10px',
                              textAlign: 'center',
                              padding: '2px 0',
                              fontWeight: 700
                            }}
                          >
                            Photo {imgIdx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment History Before New Receipt */}
              <div className="card" style={{ padding: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-dark)' }}>
                    Payment History ({loanReceipts.length})
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loan {currentLoan.loanNo}</span>
                </div>

                {loanReceipts.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    No prior payments recorded for this loan yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                    {loanReceipts.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                            #{r.receiptNo} &bull; {r.kind}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {r.date} &bull; {r.paymentMode}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}>
                            ₹{r.amount.toLocaleString('en-IN')}
                          </div>
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>
                            PAID
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: RECEIPT PREVIEW
          ══════════════════════════════════════════════════════════════════════ */}
      {previewModalOpen && currentLoan && selectedCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KKVLogo size={32} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                    KKV GOLD FINANCE
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>LOAN PAYMENT RECEIPT PREVIEW</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Voucher Details */}
            <div style={{ border: '1.5px solid var(--border-light)', borderRadius: '8px', padding: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                <div>
                  <div>Receipt No: <strong>#{nextReceiptNo}</strong></div>
                  <div>Date: <strong>{date}</strong></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>Customer: <strong>{selectedCustomer.name}</strong></div>
                  <div>ID: <strong>{getCanonicalCustomerId(selectedCustomer)}</strong></div>
                  <div>Phone: <strong>+91 {selectedCustomer.phone}</strong></div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div>Loan Number: <strong>{currentLoan.loanNo}</strong></div>
                  <div>Receipt Type: <strong>{receiptType}</strong></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>Payment Mode: <strong>{paymentMethod}</strong></div>
                  {transactionReference && <div>Ref: <strong>{transactionReference}</strong></div>}
                </div>
              </div>

              {/* Loan Balance Summary */}
              <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                <div>Outstanding Before: <strong>₹{currentLoan.outstandingPrincipal.toLocaleString('en-IN')}</strong></div>
                <div>Amount Received: <strong style={{ color: 'var(--color-primary-accent, #059669)' }}>₹{netTotalAmount.toLocaleString('en-IN')}</strong></div>
                <div>Outstanding After: <strong style={{ color: 'var(--color-primary-dark)' }}>₹{outstandingAfter.toLocaleString('en-IN')}</strong></div>
              </div>

              {/* Pledged Photos Preview */}
              {pledgedPhotos.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    PLEDGED GOLD PHOTOS ({pledgedPhotos.length})
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {pledgedPhotos.map((url: string, idx: number) => (
                      <img
                        key={idx}
                        src={url}
                        alt="Gold"
                        style={{ width: '50px', height: '50px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--border-light)' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreviewModalOpen(false)}
              >
                Close Preview
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleGenerateReceipt()}
                disabled={isSubmitting}
              >
                <Printer size={16} />
                <span>Confirm &amp; Generate Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: PHOTO LIGHTBOX (ZOOM, NEXT, PREVIOUS, CLOSE)
          ══════════════════════════════════════════════════════════════════════ */}
      {lightboxIndex !== null && pledgedPhotos.length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            zIndex: 4000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setLightboxIndex(null)}
        >
          {/* Controls Bar */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              display: 'flex',
              gap: '10px',
              zIndex: 4010
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setLightboxZoom((prev) => Math.min(3, prev + 0.25))}
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setLightboxZoom((prev) => Math.max(0.75, prev - 0.25))}
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setLightboxZoom(1)}
              title="Reset Zoom"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setLightboxIndex(null)}
              title="Close Lightbox"
            >
              <X size={18} />
            </button>
          </div>

          {/* Photo Frame */}
          <div
            style={{
              maxWidth: '85vw',
              maxHeight: '75vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderRadius: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={pledgedPhotos[lightboxIndex]}
              alt={`Pledged Gold ${lightboxIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                transform: `scale(${lightboxZoom})`,
                transition: 'transform 0.15s ease',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
              }}
            />
          </div>

          {/* Bottom Bar: Prev / Next / Counter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              marginTop: '20px',
              color: '#ffffff',
              zIndex: 4010
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={lightboxIndex === 0}
              onClick={() => {
                setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
                setLightboxZoom(1);
              }}
              style={{ opacity: lightboxIndex === 0 ? 0.5 : 1 }}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <span style={{ fontSize: '14px', fontWeight: 700 }}>
              Photo {lightboxIndex + 1} of {pledgedPhotos.length}
            </span>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={lightboxIndex === pledgedPhotos.length - 1}
              onClick={() => {
                setLightboxIndex((prev) => (prev !== null && prev < pledgedPhotos.length - 1 ? prev + 1 : prev));
                setLightboxZoom(1);
              }}
              style={{ opacity: lightboxIndex === pledgedPhotos.length - 1 ? 0.5 : 1 }}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: POST-GENERATION SUCCESS & PRINT VOUCHER
          ══════════════════════════════════════════════════════════════════════ */}
      {showSuccessModal && lastGeneratedReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 3500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              padding: '28px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(5, 150, 105, 0.12)',
                color: 'var(--color-primary-accent, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}
            >
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)' }}>
              Receipt #{lastGeneratedReceipt.receiptNo} Generated!
            </h3>

            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              Received ₹{lastGeneratedReceipt.amount.toLocaleString('en-IN')} via {lastGeneratedReceipt.paymentMode} for Loan {lastGeneratedReceipt.loanNo} ({lastGeneratedReceipt.customerName}).
            </p>

            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px'
              }}
            >
              <span>Remaining Loan Balance:</span>
              <strong style={{ color: 'var(--color-primary-dark)' }}>
                ₹{(lastGeneratedReceipt.outstandingAfter ?? 0).toLocaleString('en-IN')}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowSuccessModal(false);
                  handleOpenReceiptDisplay(lastGeneratedReceipt);
                }}
              >
                <Eye size={15} />
                <span>View Full Voucher</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowSuccessModal(false);
                  handleOpenReceiptDisplay(lastGeneratedReceipt);
                  setTimeout(() => {
                    window.print();
                  }, 250);
                }}
              >
                <Printer size={15} />
                <span>Print Voucher</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowSuccessModal(false);
                }}
              >
                New Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
