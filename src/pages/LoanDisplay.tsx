import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Loan } from '../types';
import {
  Receipt as ReceiptIcon,
  FileSpreadsheet,
  Eye,
  CheckCircle2,
  ArrowLeft,
  DollarSign,
  User,
  Search,
  RotateCcw,
  Clock,
  ShieldCheck,
  CreditCard,
  Building2,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

export const LoanDisplay: React.FC = () => {
  const {
    customers,
    loans,
    receipts,
    selectedLoan,
    setSelectedLoan,
    setCurrentPage,
    setSelectedProfileCustomerId,
    showToast
  } = useApp();

  // Selected single loan detail inspection state
  const [inspectingLoan, setInspectingLoan] = useState<Loan | null>(selectedLoan || null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'CLOSED' | 'OVERDUE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GOLD LOAN' | 'SILVER LOAN' | 'PRONOTE' | 'HIRE PURCHASE'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'THIS_MONTH'>('ALL');

  // Sorting & Pagination State
  const [sortField, setSortField] = useState<'date' | 'loanNo' | 'principal' | 'outstandingPrincipal' | 'customerName'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const pageSize = 10;

  // Sync inspectingLoan whenever selectedLoan changes from external context (e.g. from Search/Profile/Reminders)
  useEffect(() => {
    if (selectedLoan) {
      setInspectingLoan(selectedLoan);
    }
  }, [selectedLoan]);

  const handleBackToAllLoans = () => {
    setInspectingLoan(null);
    setSelectedLoan(null);
  };

  const handleOpenLoanDetails = (loan: Loan) => {
    setInspectingLoan(loan);
    setSelectedLoan(loan);
  };

  const handleSettle = (loan: Loan) => {
    setSelectedLoan(loan);
    setCurrentPage('loan-receipts');
    showToast(`Opening repayment & settlement for Loan ${loan.loanNo}`, 'info');
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setDateFilter('ALL');
    setCurrentPageNum(1);
  };

  // 1. Dynamic Summary Cards Calculations (from actual loan data)
  const totalLoansCount = loans.length;
  const activeCount = loans.filter((l) => l.status === 'ACTIVE').length;
  const closedCount = loans.filter((l) => l.status === 'CLOSED').length;
  const pendingCount = loans.filter((l) => l.status === 'PENDING').length;
  const totalPrincipalSum = loans.reduce((sum, l) => sum + (l.principal || 0), 0);
  const totalOutstandingSum = loans.reduce(
    (sum, l) => sum + (l.status === 'CLOSED' ? 0 : (l.outstandingPrincipal ?? l.principal ?? 0)),
    0
  );

  // 2. Filter Loans dynamically
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      // Find linked customer for search match
      const cust = customers.find(
        (c) => c.id === loan.customerId || (c.customerId && c.customerId.toString() === loan.customerId)
      );

      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        loan.loanNo.toLowerCase().includes(q) ||
        loan.id.toLowerCase().includes(q) ||
        loan.customerId.toLowerCase().includes(q) ||
        (cust && cust.id.toLowerCase().includes(q)) ||
        (cust && cust.name.toLowerCase().includes(q)) ||
        loan.customerName.toLowerCase().includes(q) ||
        (cust && cust.phone.includes(q)) ||
        loan.customerPhone.includes(q);

      const matchesStatus =
        statusFilter === 'ALL' ||
        loan.status === statusFilter ||
        (statusFilter === 'OVERDUE' && (loan.status === 'OVERDUE' || (loan.accruedInterest > 0 && loan.status === 'ACTIVE')));

      const matchesType =
        typeFilter === 'ALL' ||
        (loan.loanTypeName || loan.loanType || '').toUpperCase() === typeFilter.toUpperCase();

      let matchesDate = true;
      if (dateFilter === 'TODAY') {
        const todayStr = new Date().toISOString().slice(0, 10);
        matchesDate = loan.date === todayStr || loan.date === new Date().toLocaleDateString('en-GB');
      } else if (dateFilter === 'THIS_MONTH') {
        const now = new Date();
        const monthNum = String(now.getMonth() + 1).padStart(2, '0');
        matchesDate = loan.date.includes(`/${monthNum}/`) || loan.date.includes(`-${monthNum}-`);
      }

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });
  }, [loans, customers, search, statusFilter, typeFilter, dateFilter]);

  // 3. Sort Loans
  const sortedLoans = useMemo(() => {
    return [...filteredLoans].sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (sortField === 'date') {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLoans, sortField, sortOrder]);

  // 4. Paginate Loans
  const totalPages = Math.ceil(sortedLoans.length / pageSize) || 1;
  const paginatedLoans = useMemo(() => {
    const start = (currentPageNum - 1) * pageSize;
    return sortedLoans.slice(start, start + pageSize);
  }, [sortedLoans, currentPageNum, pageSize]);

  // Handle column header click for sorting
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // =========================================================================
  // VIEW 1: SINGLE LOAN DETAILS PAGE (when inspectingLoan is selected)
  // =========================================================================
  if (inspectingLoan) {
    // Find linked customer dynamically using customerId
    const linkedCustomer = customers.find(
      (c) => c.id === inspectingLoan.customerId || (c.customerId && c.customerId.toString() === inspectingLoan.customerId)
    );

    const customerPhoto = linkedCustomer?.customerPhoto || inspectingLoan.customerPhotoUrl;

    // Filter receipts linked strictly to this loanId
    const loanReceipts = receipts.filter(
      (r) => r.loanId === inspectingLoan.id || r.loanNo === inspectingLoan.loanNo
    );

    const totalPaymentsReceived = loanReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const monthlyInterestVal = inspectingLoan.monthlyInterest || (inspectingLoan.principal * inspectingLoan.interestRate / 100);

    // Loan Activity History Events
    const loanActivities = [
      {
        id: 'act-issue',
        date: inspectingLoan.date,
        title: `Loan ${inspectingLoan.loanNo} Issued`,
        desc: `${inspectingLoan.loanType} principal of ₹${inspectingLoan.principal.toLocaleString('en-IN')} issued @ ${inspectingLoan.interestRate}% interest/mo`,
        type: 'issue'
      },
      ...(inspectingLoan.items || []).map((item, idx) => ({
        id: `act-item-${idx}`,
        date: inspectingLoan.date,
        title: `Pledge Collateral Added: ${item.item}`,
        desc: `Qty: ${item.qty} | Purity: ${item.purity} | Net Wt: ${item.netWeight}g`,
        type: 'gold'
      })),
      ...loanReceipts.map((r) => ({
        id: `act-rcpt-${r.id}`,
        date: r.date,
        title: `Payment Receipt #${r.receiptNo} Received`,
        desc: `Received ₹${r.amount.toLocaleString('en-IN')} (${r.kind}) via ${r.paymentMode}`,
        type: 'payment'
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* HEADER / BACK NAVIGATION */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleBackToAllLoans}
            style={{ gap: '8px', fontWeight: 600 }}
          >
            <ArrowLeft size={16} />
            <span>← Back to All Loans</span>
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSettle(inspectingLoan)}
              style={{ gap: '8px', fontWeight: 700 }}
            >
              <ReceiptIcon size={16} />
              <span>Collect Payment / Receipt</span>
            </button>
          </div>
        </div>

        {/* LOAN DETAILS TITLE & STATUS HEADER CARD */}
        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--border-light, #e2e8f0)',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                  LOAN DETAILS: {inspectingLoan.loanNo}
                </h1>
                <span
                  className={`badge ${
                    inspectingLoan.status === 'ACTIVE'
                      ? 'badge-success'
                      : inspectingLoan.status === 'CLOSED'
                      ? 'badge-info'
                      : 'badge-warning'
                  }`}
                  style={{ fontSize: '12px', padding: '4px 12px' }}
                >
                  {inspectingLoan.status === 'ACTIVE'
                    ? '🟢 ACTIVE'
                    : inspectingLoan.status === 'CLOSED'
                    ? '⚪ CLOSED'
                    : '🟡 PENDING'}
                </span>
              </div>

              <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span>👤 Customer: <strong style={{ color: 'var(--text-dark)' }}>{inspectingLoan.customerName}</strong></span>
                <span>Customer ID: <strong style={{ color: 'var(--color-primary-dark)' }}>{inspectingLoan.customerId}</strong></span>
                <span>📱 +91 {inspectingLoan.customerPhone}</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>LOAN PRINCIPAL</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}>
                ₹{inspectingLoan.principal.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* LINKED CUSTOMER INFORMATION CARD */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
            <User size={18} color="var(--color-primary-accent, #059669)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>LINKED CUSTOMER INFORMATION</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {customerPhoto ? (
              <img
                src={customerPhoto}
                alt={inspectingLoan.customerName}
                style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2.5px solid var(--color-primary-accent, #059669)', flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-light-accent, #e6f4f1)', color: 'var(--color-primary-dark, #163f35)', fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid var(--color-primary-accent, #059669)', flexShrink: 0 }}>
                {inspectingLoan.customerName.charAt(0).toUpperCase()}
              </div>
            )}

            <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-dark)' }}>{inspectingLoan.customerName}</span>
                {linkedCustomer && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => {
                      setSelectedProfileCustomerId(linkedCustomer.id);
                      setCurrentPage('customer-profile');
                    }}
                  >
                    View Customer Profile
                  </button>
                )}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge badge-success" style={{ fontSize: '11.5px', padding: '3px 10px' }}>
                  Customer ID: {inspectingLoan.customerId}
                </span>
                <span>📱 +91 {inspectingLoan.customerPhone}</span>
                <span>Gender: {linkedCustomer?.gender || inspectingLoan.customerGender || 'Male'}</span>
                <span>Age: {linkedCustomer?.age || inspectingLoan.customerAge || 30} Yrs</span>
                <span>Occupation: {linkedCustomer?.occupation || inspectingLoan.customerOccupation || 'Borrower'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* GRID: LOAN INFO & FINANCIAL SUMMARY */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {/* LOAN INFORMATION CARD */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <FileSpreadsheet size={18} color="var(--color-primary-accent, #059669)" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>LOAN INFORMATION</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loan Number:</span>
                <strong style={{ color: 'var(--color-primary-dark)', fontSize: '14px' }}>{inspectingLoan.loanNo}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Receipt / Bill Number:</span>
                <strong style={{ color: 'var(--text-dark)' }}>#{inspectingLoan.receiptBillNo || 1001}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loan Type:</span>
                <span className="badge badge-gold">{inspectingLoan.loanTypeName || inspectingLoan.loanType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loan Issue Date:</span>
                <strong style={{ color: 'var(--text-dark)' }}>{inspectingLoan.date}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loan Amount:</span>
                <strong style={{ color: 'var(--text-dark)' }}>₹{inspectingLoan.principal.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Monthly Interest Rate:</span>
                <strong style={{ color: 'var(--color-primary-accent)' }}>{inspectingLoan.interestRate}% per month</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Repayment System:</span>
                <strong style={{ color: 'var(--text-dark)' }}>{inspectingLoan.repaymentSystemName || inspectingLoan.repaymentSystem || 'Monthly interest only'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loan Tenure:</span>
                <strong style={{ color: 'var(--text-dark)' }}>12 Months (Renewable)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Next Due Date:</span>
                <strong style={{ color: 'var(--color-primary-dark)' }}>{inspectingLoan.nextDueDate || inspectingLoan.date}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Disbursement Method:</span>
                <strong style={{ color: 'var(--text-dark)' }}>{inspectingLoan.bankMode || 'Cash'}</strong>
              </div>
              {(inspectingLoan.area || inspectingLoan.showroom) && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Area / Branch:</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{inspectingLoan.area || 'Main Office'} {inspectingLoan.showroom ? `(${inspectingLoan.showroom})` : ''}</strong>
                </div>
              )}
            </div>
          </div>

          {/* FINANCIAL SUMMARY CARD */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <DollarSign size={18} color="var(--color-primary-accent, #059669)" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>FINANCIAL SUMMARY</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Principal Amount:</span>
                <strong style={{ color: 'var(--text-dark)' }}>₹{inspectingLoan.principal.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Monthly Interest:</span>
                <strong style={{ color: 'var(--color-primary-dark)' }}>
                  ₹{monthlyInterestVal.toLocaleString('en-IN')} / month
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Total Payments Received:</span>
                <strong style={{ color: 'var(--color-primary-accent)' }}>₹{totalPaymentsReceived.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Outstanding Principal:</span>
                <strong style={{ color: 'var(--color-primary-dark)', fontSize: '15px' }}>
                  ₹{inspectingLoan.outstandingPrincipal.toLocaleString('en-IN')}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Accrued Interest:</span>
                <strong style={{ color: 'var(--text-dark)' }}>₹{(inspectingLoan.accruedInterest || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Net Disbursed Amount:</span>
                <strong style={{ color: 'var(--text-dark)' }}>
                  ₹{(inspectingLoan.disbursedAmount || inspectingLoan.principal).toLocaleString('en-IN')}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-dark)', fontWeight: 800 }}>Total Outstanding:</span>
                <strong style={{ color: 'var(--color-danger, #ef4444)', fontSize: '16px' }}>
                  ₹{(inspectingLoan.outstandingPrincipal + (inspectingLoan.accruedInterest || 0)).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* PLEDGED COLLATERAL / GOLD ITEMS TABLE CARD */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
            PLEDGED COLLATERAL / GOLD ITEMS ({(inspectingLoan.items || []).length} Items)
          </h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ITEM NAME</th>
                  <th>QUANTITY</th>
                  <th>PURITY</th>
                  <th>GROSS WEIGHT (G)</th>
                  <th>DEDUCTION (G)</th>
                  <th>NET WEIGHT (G)</th>
                  <th style={{ textAlign: 'right' }}>VALUATION</th>
                </tr>
              </thead>
              <tbody>
                {(!inspectingLoan.items || inspectingLoan.items.length === 0) ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No pledged ornaments recorded for this loan.
                    </td>
                  </tr>
                ) : (
                  inspectingLoan.items.map((item, idx) => {
                    const gross = Number(item.grossWeight) || 0;
                    const deduction = Number(item.deductionWeight) || 0;
                    const net = item.netWeight !== undefined ? Number(item.netWeight) : Math.max(0, gross - deduction);

                    return (
                      <tr key={`item-${item.id || idx}`}>
                        <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>{item.item}</td>
                        <td>{item.qty}</td>
                        <td><span className="badge badge-gold">{item.purity}</span></td>
                        <td>{gross.toFixed(3)} g</td>
                        <td>{deduction.toFixed(3)} g</td>
                        <td style={{ fontWeight: 700 }}>{net.toFixed(3)} g</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{Math.round(inspectingLoan.marketValue ? (inspectingLoan.marketValue / inspectingLoan.items.length) : (net * 5500)).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PLEDGED ORNAMENT PHOTOS GALLERY */}
          {((inspectingLoan.photos && inspectingLoan.photos.length > 0) || ((inspectingLoan as any).ornamentPhotos && (inspectingLoan as any).ornamentPhotos.length > 0)) && (
            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  PLEDGED ORNAMENT PHOTOS ({(inspectingLoan.photos || (inspectingLoan as any).ornamentPhotos || []).length})
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click photo to enlarge</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {(inspectingLoan.photos || (inspectingLoan as any).ornamentPhotos || []).map((imgUrl: string, imgIdx: number) => (
                  <div
                    key={`loan-img-${imgIdx}`}
                    onClick={() => setLightboxIndex(imgIdx)}
                    style={{
                      position: 'relative',
                      width: '100px',
                      height: '100px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '2px solid var(--border-light, #e2e8f0)',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                    }}
                  >
                    <img src={imgUrl} alt={`Ornament Photo ${imgIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', fontSize: '10px', textAlign: 'center', padding: '2px 0', fontWeight: 700 }}>
                      Photo {imgIdx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* NOMINEE DETAILS CARD */}
        {inspectingLoan.nominee && (inspectingLoan.nominee.hasNominee !== false && (inspectingLoan.nominee.name || (inspectingLoan.nominee as any).fullName)) && (
          <div className="card" style={{ padding: '20px', marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={18} color="var(--color-primary-accent, #059669)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>NOMINEE DETAILS</h3>
              </div>
              <span className="badge badge-success" style={{ fontSize: '11px' }}>
                Registered Nominee
              </span>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {inspectingLoan.nominee.photo ? (
                <img
                  src={inspectingLoan.nominee.photo}
                  alt={inspectingLoan.nominee.name || (inspectingLoan.nominee as any).fullName}
                  style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-light)', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', color: 'var(--color-primary-dark, #047857)', fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-light)', flexShrink: 0 }}>
                  {(inspectingLoan.nominee.name || (inspectingLoan.nominee as any).fullName || 'N').charAt(0).toUpperCase()}
                </div>
              )}

              <div style={{ flex: 1, minWidth: '280px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>FULL NAME</span>
                  <div style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '14px' }}>
                    {inspectingLoan.nominee.name || (inspectingLoan.nominee as any).fullName}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>RELATIONSHIP</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                    {inspectingLoan.nominee.relationship || inspectingLoan.nominee.relation || 'Nominee'}
                    {inspectingLoan.nominee.customRelation ? ` (${inspectingLoan.nominee.customRelation})` : ''}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>MOBILE NUMBER</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                    +91 {inspectingLoan.nominee.phone || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>GENDER</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                    {inspectingLoan.nominee.gender || 'Not specified'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>AGE / DOB</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                    {inspectingLoan.nominee.dateOfBirth ? `${inspectingLoan.nominee.dateOfBirth} (${inspectingLoan.nominee.age || '-'} Yrs)` : inspectingLoan.nominee.age ? `${inspectingLoan.nominee.age} Years` : 'Not specified'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>OCCUPATION</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                    {inspectingLoan.nominee.occupation || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>EMAIL</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                    {inspectingLoan.nominee.email || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ID PROOF TYPE</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                    {inspectingLoan.nominee.idProofType || inspectingLoan.nominee.idProof?.type || 'Aadhaar'}
                  </div>
                </div>

                {(inspectingLoan.nominee.aadhaarNumber || inspectingLoan.nominee.idProof?.aadhaarNumber) && (
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>AADHAAR NUMBER</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                      XXXX XXXX {(inspectingLoan.nominee.aadhaarNumber || inspectingLoan.nominee.idProof?.aadhaarNumber || '').slice(-4)}
                    </div>
                  </div>
                )}

                {(inspectingLoan.nominee.panNumber || inspectingLoan.nominee.idProof?.panNumber) && (
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>PAN NUMBER</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                      {inspectingLoan.nominee.panNumber || inspectingLoan.nominee.idProof?.panNumber}
                    </div>
                  </div>
                )}

                {(inspectingLoan.nominee.otherIdName || inspectingLoan.nominee.idProof?.otherIdName) && (
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{inspectingLoan.nominee.otherIdName || inspectingLoan.nominee.idProof?.otherIdName}</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                      {inspectingLoan.nominee.otherIdNumber || inspectingLoan.nominee.idProof?.otherIdNumber || inspectingLoan.nominee.idProofNumber}
                    </div>
                  </div>
                )}

                <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>CURRENT RESIDENTIAL ADDRESS</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)', marginTop: '2px' }}>
                    {inspectingLoan.nominee.address || 'N/A'}
                  </div>
                </div>

                {inspectingLoan.nominee.permanentAddress && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>PERMANENT ADDRESS</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-dark)', marginTop: '2px' }}>
                      {inspectingLoan.nominee.permanentAddress}
                    </div>
                  </div>
                )}

                {inspectingLoan.nominee.location && (
                  <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>GPS LOCATION</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dark)' }}>
                        📍 Lat: {inspectingLoan.nominee.location.latitude}, Lng: {inspectingLoan.nominee.location.longitude}
                      </span>
                      {inspectingLoan.nominee.location.googleMapsUrl && (
                        <a
                          href={inspectingLoan.nominee.location.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '10.5px', height: '24px', padding: '0 8px' }}
                        >
                          Open Google Maps 🗺️
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LIGHTBOX PREVIEW MODAL */}
        {lightboxIndex !== null && inspectingLoan && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.88)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setLightboxIndex(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                style={{
                  position: 'absolute',
                  top: '-40px',
                  right: 0,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                <X size={28} />
              </button>

              <img
                src={(inspectingLoan.photos || (inspectingLoan as any).ornamentPhotos || [])[lightboxIndex]}
                alt={`Preview ${lightboxIndex + 1}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '75vh',
                  borderRadius: '8px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  objectFit: 'contain'
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '16px', color: '#ffffff' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={lightboxIndex === 0}
                  onClick={() => setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                  style={{ opacity: lightboxIndex === 0 ? 0.5 : 1 }}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>

                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  Photo {lightboxIndex + 1} of {(inspectingLoan.photos || (inspectingLoan as any).ornamentPhotos || []).length}
                </span>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={lightboxIndex === (inspectingLoan.photos || (inspectingLoan as any).ornamentPhotos || []).length - 1}
                  onClick={() => setLightboxIndex((prev) => (prev !== null && prev < (inspectingLoan.photos || (inspectingLoan as any).ornamentPhotos || []).length - 1 ? prev + 1 : prev))}
                  style={{ opacity: lightboxIndex === (inspectingLoan.photos || (inspectingLoan as any).ornamentPhotos || []).length - 1 ? 0.5 : 1 }}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NOMINEE & GUARANTOR DETAILS CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Nominee Card */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>👤</span> NOMINEE DETAILS
            </h3>
            {inspectingLoan.nominee && inspectingLoan.nominee.hasNominee ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Full Name:</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{inspectingLoan.nominee.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Relation:</span>
                  <strong style={{ color: 'var(--color-primary-dark)' }}>{inspectingLoan.nominee.relationship || inspectingLoan.nominee.relation}</strong>
                </div>
                {inspectingLoan.nominee.age && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Age:</span>
                    <strong style={{ color: 'var(--text-dark)' }}>{inspectingLoan.nominee.age} Years</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Phone:</span>
                  <strong style={{ color: 'var(--text-dark)' }}>+91 {inspectingLoan.nominee.phone}</strong>
                </div>
                {inspectingLoan.nominee.idProofType && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>ID Proof Type:</span>
                    <span className="badge badge-info">{inspectingLoan.nominee.idProofType}</span>
                  </div>
                )}
                {inspectingLoan.nominee.idProofNumber && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Masked ID Number:</span>
                    <strong style={{ color: 'var(--text-dark)', fontFamily: 'monospace' }}>{inspectingLoan.nominee.idProofNumber}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Address:</span>
                  <div style={{ backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', color: 'var(--text-dark)', fontSize: '13px' }}>
                    {inspectingLoan.nominee.address}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No nominee registered for this loan.
              </div>
            )}
          </div>

          {/* Guarantor Card */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🤝</span> GUARANTOR DETAILS
            </h3>
            {inspectingLoan.guarantor && inspectingLoan.guarantor.hasGuarantor ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Full Name:</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{inspectingLoan.guarantor.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Relation:</span>
                  <strong style={{ color: 'var(--color-primary-dark)' }}>{inspectingLoan.guarantor.relationship || inspectingLoan.guarantor.relation}</strong>
                </div>
                {inspectingLoan.guarantor.age && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Age:</span>
                    <strong style={{ color: 'var(--text-dark)' }}>{inspectingLoan.guarantor.age} Years</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Phone:</span>
                  <strong style={{ color: 'var(--text-dark)' }}>+91 {inspectingLoan.guarantor.phone}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>ID Proof / No:</span>
                  <strong style={{ color: 'var(--text-dark)', fontFamily: 'monospace' }}>{inspectingLoan.guarantor.idProof}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Address:</span>
                  <div style={{ backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', color: 'var(--text-dark)', fontSize: '13px' }}>
                    {inspectingLoan.guarantor.address}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No guarantor registered for this loan.
              </div>
            )}
          </div>
        </div>

        {/* PAYMENT HISTORY TABLE CARD */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
            PAYMENT &amp; RECEIPT HISTORY ({loanReceipts.length} Transactions)
          </h3>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>RECEIPT NO</th>
                  <th>PAYMENT DATE</th>
                  <th>TRANSACTION TYPE</th>
                  <th>AMOUNT PAID</th>
                  <th>PAYMENT METHOD</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {loanReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No repayment receipts recorded yet for this loan.
                    </td>
                  </tr>
                ) : (
                  loanReceipts.map((r, idx) => (
                    <tr key={`rcpt-${r.id}-${idx}`}>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>#{r.receiptNo}</td>
                      <td>{r.date}</td>
                      <td>
                        <span className={`badge ${r.kind === 'NEW LOAN' ? 'badge-info' : 'badge-success'}`}>
                          {r.kind}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary-accent)' }}>
                        ₹{r.amount.toLocaleString('en-IN')}
                      </td>
                      <td>{r.paymentMode || 'Cash'}</td>
                      <td>
                        <span className="badge badge-success">COMPLETED</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACTIVITY HISTORY TIMELINE */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--color-primary-accent)" />
            <span>ACTIVITY HISTORY</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {loanActivities.map((act) => (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                  border: '1px solid var(--border-subtle, #e2e8f0)'
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: act.type === 'issue' ? 'rgba(23, 107, 82, 0.15)' : act.type === 'payment' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(201, 162, 39, 0.15)',
                    color: act.type === 'issue' ? '#176B52' : act.type === 'payment' ? '#10B981' : '#C9A227',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontWeight: 700
                  }}
                >
                  {act.type === 'issue' ? <CreditCard size={15} /> : act.type === 'payment' ? <ReceiptIcon size={15} /> : <CheckCircle2 size={15} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-dark)' }}>{act.title}</strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{act.date}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>{act.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: LOAN DISPLAY MAIN PAGE (ALL LOANS LIST & SUMMARY CARDS)
  // =========================================================================
  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', width: '100%', maxWidth: '100%' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-dark)' }}>
            Loan Display
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            View and manage all issued loans.
          </p>
        </div>
      </div>

      {/* TOP DYNAMIC SUMMARY CARDS */}
      <div className="loan-summary-grid">
        <div className="stat-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', width: '100%' }}>
            <span className="stat-label" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>TOTAL LOANS</span>
            <FileSpreadsheet size={16} color="var(--color-primary-dark)" style={{ flexShrink: 0 }} />
          </div>
          <div className="stat-value" style={{ fontSize: '20px', fontWeight: 800, marginTop: '8px', color: 'var(--text-dark)' }}>
            {totalLoansCount}
          </div>
          <div className="stat-helper" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Issued pledges</div>
        </div>

        <div className="stat-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', width: '100%' }}>
            <span className="stat-label" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--badge-success-text, #166534)', whiteSpace: 'nowrap' }}>ACTIVE</span>
            <CheckCircle2 size={16} color="var(--badge-success-text, #166534)" style={{ flexShrink: 0 }} />
          </div>
          <div className="stat-value" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--badge-success-text, #166534)', marginTop: '8px' }}>
            {activeCount}
          </div>
          <div className="stat-helper" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Currently open</div>
        </div>

        <div className="stat-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', width: '100%' }}>
            <span className="stat-label" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-info-text, #1e40af)', whiteSpace: 'nowrap' }}>CLOSED</span>
            <ShieldCheck size={16} color="var(--color-info-text, #1e40af)" style={{ flexShrink: 0 }} />
          </div>
          <div className="stat-value" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-info-text, #1e40af)', marginTop: '8px' }}>
            {closedCount}
          </div>
          <div className="stat-helper" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Fully settled</div>
        </div>

        <div className="stat-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', width: '100%' }}>
            <span className="stat-label" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--badge-warning-text, #b45309)', whiteSpace: 'nowrap' }}>PENDING</span>
            <Clock size={16} color="var(--badge-warning-text, #b45309)" style={{ flexShrink: 0 }} />
          </div>
          <div className="stat-value" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--badge-warning-text, #b45309)', marginTop: '8px' }}>
            {pendingCount}
          </div>
          <div className="stat-helper" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Awaiting approval</div>
        </div>

        <div className="stat-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', width: '100%' }}>
            <span className="stat-label" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary-dark)', whiteSpace: 'nowrap' }}>TOTAL PRINCIPAL</span>
            <DollarSign size={16} color="var(--color-primary-accent)" style={{ flexShrink: 0 }} />
          </div>
          <div className="stat-value" style={{ fontSize: '18px', fontWeight: 800, marginTop: '8px', color: 'var(--color-primary-dark)', whiteSpace: 'nowrap', overflow: 'visible' }}>
            ₹{totalPrincipalSum.toLocaleString('en-IN')}
          </div>
          <div className="stat-helper" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Cumulative principal</div>
        </div>

        <div className="stat-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', width: '100%' }}>
            <span className="stat-label" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-danger, #ef4444)', whiteSpace: 'nowrap' }}>OUTSTANDING</span>
            <Building2 size={16} color="var(--color-danger, #ef4444)" style={{ flexShrink: 0 }} />
          </div>
          <div className="stat-value" style={{ fontSize: '18px', fontWeight: 800, marginTop: '8px', color: 'var(--color-danger, #ef4444)', whiteSpace: 'nowrap', overflow: 'visible' }}>
            ₹{totalOutstandingSum.toLocaleString('en-IN')}
          </div>
          <div className="stat-helper" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Active loan balance</div>
        </div>
      </div>

      {/* SEARCH & FILTER TOOLBAR CARD */}
      <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: '12px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              SEARCH &amp; FILTER LOAN BOOK
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', height: '30px', gap: '4px' }}
              onClick={handleClearFilters}
            >
              <RotateCcw size={13} />
              <span>Clear Filters</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px', maxWidth: '100%' }}>
              <input
                type="text"
                className="input-control"
                style={{ height: '40px', paddingLeft: '38px', paddingRight: '12px', fontSize: '13px' }}
                placeholder="Search loan number, customer ID, customer name, mobile..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPageNum(1);
                }}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none'
                }}
              />
            </div>

            {/* Loan Status Filter */}
            <div style={{ flex: '0 1 140px', minWidth: '120px' }}>
              <select
                className="select-control"
                style={{ height: '40px', fontSize: '12.5px' }}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPageNum(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="CLOSED">Closed</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            {/* Loan Type Filter */}
            <div style={{ flex: '0 1 140px', minWidth: '120px' }}>
              <select
                className="select-control"
                style={{ height: '40px', fontSize: '12.5px' }}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as any);
                  setCurrentPageNum(1);
                }}
              >
                <option value="ALL">All Loan Types</option>
                <option value="GOLD LOAN">Gold Loan</option>
                <option value="SILVER LOAN">Silver Loan</option>
                <option value="PRONOTE">Pronote</option>
                <option value="HIRE PURCHASE">Hire Purchase</option>
              </select>
            </div>

            {/* Date Filter */}
            <div style={{ flex: '0 1 130px', minWidth: '110px' }}>
              <select
                className="select-control"
                style={{ height: '40px', fontSize: '12.5px' }}
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as any);
                  setCurrentPageNum(1);
                }}
              >
                <option value="ALL">All Dates</option>
                <option value="TODAY">Today</option>
                <option value="THIS_MONTH">This Month</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ALL LOANS TABLE CARD */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
              ALL LOANS
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {sortedLoans.length === 0 ? 0 : (currentPageNum - 1) * pageSize + 1}–
              {Math.min(currentPageNum * pageSize, sortedLoans.length)} of {sortedLoans.length} loans (Total Book: {loans.length})
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', height: '32px', gap: '6px' }}
              onClick={() => showToast(`Exporting ${sortedLoans.length} loan records...`, 'info')}
            >
              <FileSpreadsheet size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('loanNo')}>
                  LOAN NO {sortField === 'loanNo' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('customerName')}>
                  CUSTOMER {sortField === 'customerName' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th>CUSTOMER ID</th>
                <th>PHONE</th>
                <th>LOAN TYPE</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date')}>
                  ISSUE DATE {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('principal')}>
                  PRINCIPAL {sortField === 'principal' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th>INTEREST RATE</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('outstandingPrincipal')}>
                  OUTSTANDING {sortField === 'outstandingPrincipal' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th>STATUS</th>
                <th style={{ textAlign: 'center', width: '100px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLoans.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No loan records found matching the specified search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedLoans.map((loan, idx) => {
                  // Resolve Customer details dynamically using loan.customerId
                  const cust = customers.find(
                    (c) => c.id === loan.customerId || (c.customerId && c.customerId.toString() === loan.customerId)
                  );
                  const custName = cust?.name || loan.customerName;
                  const custPhone = cust?.phone || loan.customerPhone;
                  const custIdDisplay = cust?.id || loan.customerId;
                  const custPhoto = cust?.customerPhoto || loan.customerPhotoUrl;

                  return (
                    <tr key={`loan-entry-${loan.id}-${idx}`}>
                      <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                        {loan.loanNo}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {custPhoto ? (
                            <img
                              src={custPhoto}
                              alt={custName}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1.5px solid var(--color-primary-accent, #059669)',
                                flexShrink: 0
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-light-accent, #e6f4f1)',
                                color: 'var(--color-primary-dark, #163f35)',
                                fontWeight: 700,
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {custName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{custName}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>
                          {custIdDisplay}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>+91 {custPhone}</td>
                      <td>
                        <span className="badge badge-gold" style={{ fontSize: '11px' }}>
                          {loan.loanTypeName || loan.loanType}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>{loan.date}</td>
                      <td style={{ fontWeight: 700 }}>₹{loan.principal.toLocaleString('en-IN')}</td>
                      <td style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>{loan.interestRate}% / mo</td>
                      <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                        ₹{(loan.status === 'CLOSED' ? 0 : (loan.outstandingPrincipal ?? loan.principal)).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            loan.status === 'ACTIVE'
                              ? 'badge-success'
                              : loan.status === 'CLOSED'
                              ? 'badge-info'
                              : 'badge-warning'
                          }`}
                          style={{ fontSize: '11px' }}
                        >
                          {loan.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ height: '30px', padding: '0 10px', fontSize: '11.5px', gap: '4px', fontWeight: 700 }}
                          title="View Complete Loan Details"
                          onClick={() => handleOpenLoanDetails(loan)}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Page <strong>{currentPageNum}</strong> of <strong>{totalPages}</strong>
            </span>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={currentPageNum === 1}
                onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', opacity: currentPageNum === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={`pg-${pg}`}
                  type="button"
                  className={`btn btn-sm ${currentPageNum === pg ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCurrentPageNum(pg)}
                  style={{ width: '32px', height: '32px', padding: 0, fontWeight: 700, fontSize: '12px' }}
                >
                  {pg}
                </button>
              ))}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={currentPageNum === totalPages}
                onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))}
                style={{ padding: '4px 10px', opacity: currentPageNum === totalPages ? 0.5 : 1 }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
