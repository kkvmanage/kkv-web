import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Eye,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  X,
  User,
  Trash2,
  Printer,
  Download,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { FixedDeposit, Customer, FDWithdrawal, OrnamentItem } from '../types';
import { getCanonicalCustomerId, isMatchingCustomerId } from '../utils/customerUtils';
import { KKVLogo } from '../components/common/KKVLogo';
import {
  calculateFDInterestSchedule,
  getAllPendingFDInterestPeriods,
  PendingInterestPeriod,
  getFDMaturityInfo,
  getWithdrawalEligibility,
  addCalendarMonths,
  formatFDDate
} from '../utils/fdInterestUtils';

export const calculateMaturityDate = (startDateStr: string, tenureMos: number): string => {
  if (!startDateStr) return '';
  let day = 1, month = 1, year = 2026;
  const parts = startDateStr.split(/[-/]/).map((p) => parseInt(p, 10));
  if (parts.length === 3) {
    if (parts[0] > 1000) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      day = parts[0];
      month = parts[1];
      year = parts[2];
    }
  } else {
    const today = new Date();
    day = today.getDate();
    month = today.getMonth() + 1;
    year = today.getFullYear();
  }

  const totalMonths = month - 1 + tenureMos;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, maxDaysInTargetMonth);

  return `${String(targetDay).padStart(2, '0')}-${String(targetMonth).padStart(2, '0')}-${targetYear}`;
};

export const FixedDeposits: React.FC = () => {
  const {
    currentPage,
    setCurrentPage,
    fixedDeposits,
    addFixedDeposit,
    customers,
    fdInterestPayouts,
    payFDInterest,
    fdWithdrawals,
    withdrawFD,
    renewFD,
    fdRenewals,
    deleteFixedDeposit,
    masterControlSettings,
    userRole,
    setSelectedProfileCustomerId,
    showToast
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<string>('new-deposit');
  const [processingFdNos, setProcessingFdNos] = useState<Set<string>>(new Set());

  // Interest Pending Search, Filter, and Payment Modal state
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string>('');
  const [pendingFilterStatus, setPendingFilterStatus] = useState<'ALL' | 'PENDING' | 'OVERDUE'>('ALL');
  const [payingPeriod, setPayingPeriod] = useState<PendingInterestPeriod | null>(null);
  const [payPendingMode, setPayPendingMode] = useState<'Cash' | 'Bank' | 'UPI'>('Cash');
  const [payPendingBankName, setPayPendingBankName] = useState<string>('');
  const [payPendingTxRef, setPayPendingTxRef] = useState<string>('');
  const [payPendingUpiId, setPayPendingUpiId] = useState<string>('');

  // Sync sidebar route to sub-tab
  useEffect(() => {
    if ([
      'new-deposit',
      'deposit-display',
      'deposit-interest',
      'interest-display',
      'interest-pending',
      'deposit-withdrawal',
      'withdrawal-display',
      'fd-customers-deposits'
    ].includes(currentPage)) {
      setActiveSubTab(currentPage);
    }
  }, [currentPage]);

  // Customer Selection State for New Deposit
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // New Deposit Form State
  const [depositDate, setDepositDate] = useState<string>(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
  const [principal, setPrincipal] = useState<string>('200000');
  const [interestRatePA, setInterestRatePA] = useState<number | ''>(masterControlSettings?.fdInterestRate ?? 12);
  const [tenureMonths, setTenureMonths] = useState<number | ''>(masterControlSettings?.fdDefaultTenureMonths ?? 12);
  const [payoutFrequency, setPayoutFrequency] = useState<string>('Monthly');
  const [receivingMethod, setReceivingMethod] = useState<'Cash' | 'Bank' | 'UPI'>('Cash');
  const [nomineeName, setNomineeName] = useState<string>('');
  const [nomineeRelation, setNomineeRelation] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Sync interestRatePA, tenureMonths, and payoutFrequency with master settings when they change
  useEffect(() => {
    if (masterControlSettings?.fdInterestRate !== undefined) {
      setInterestRatePA(masterControlSettings.fdInterestRate);
    }
    if (masterControlSettings?.fdDefaultTenureMonths !== undefined) {
      setTenureMonths(masterControlSettings.fdDefaultTenureMonths);
    }
    if (masterControlSettings?.fdPayoutFrequency) {
      setPayoutFrequency(masterControlSettings.fdPayoutFrequency);
    }
  }, [masterControlSettings?.fdInterestRate, masterControlSettings?.fdDefaultTenureMonths, masterControlSettings?.fdPayoutFrequency]);

  // Register display filter state
  const [displaySearchText, setDisplaySearchText] = useState<string>('');
  const [displayStatusFilter, setDisplayStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MATURED' | 'WITHDRAWN'>('ALL');

  const [wdCustSearchQuery, setWdCustSearchQuery] = useState<string>('');
  const [wdSelectedCustomer, setWdSelectedCustomer] = useState<Customer | null>(null);
  const [wdSelectedFD, setWdSelectedFD] = useState<FixedDeposit | null>(null);
  const [wdActionType, setWdActionType] = useState<'PARTIAL' | 'FULL' | 'RENEW'>('PARTIAL');
  const [wdType, setWdType] = useState<'PARTIAL' | 'FULL'>('PARTIAL');
  const [wdAmount, setWdAmount] = useState<string>('');
  const [wdMode, setWdMode] = useState<'Cash' | 'Bank' | 'UPI'>('Cash');
  const [wdBankName, setWdBankName] = useState<string>('');
  const [wdTxRef, setWdTxRef] = useState<string>('');
  const [wdUpiId, setWdUpiId] = useState<string>('');
  const [wdShowConfirmModal, setWdShowConfirmModal] = useState<boolean>(false);
  const [wdProcessing, setWdProcessing] = useState<boolean>(false);
  const [wdNotes, setWdNotes] = useState<string>('');
  // Renewal state
  const [rnPeriodMonths, setRnPeriodMonths] = useState<number>(12);
  const [rnNotes, setRnNotes] = useState<string>('');
  const [rnShowConfirmModal, setRnShowConfirmModal] = useState<boolean>(false);
  const [rnProcessing, setRnProcessing] = useState<boolean>(false);

  // ── Withdrawal Display State ────────────────────────────────────────────────
  const [wdDisplaySearch, setWdDisplaySearch] = useState<string>('');
  const [wdDisplayTypeFilter, setWdDisplayTypeFilter] = useState<'ALL' | 'PARTIAL' | 'FULL'>('ALL');
  const [wdDisplayStatusFilter, setWdDisplayStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'CANCELLED'>('ALL');
  const [wdDisplayTab, setWdDisplayTab] = useState<'WITHDRAWALS' | 'RENEWALS'>('WITHDRAWALS');

  // ── Withdrawal Receipt & Success Modal State ──────────────────────────────
  const [lastWdReceipt, setLastWdReceipt] = useState<FDWithdrawal | null>(null);
  const [wdShowSuccessModal, setWdShowSuccessModal] = useState<boolean>(false);
  const [viewingReceiptWd, setViewingReceiptWd] = useState<FDWithdrawal | null>(null);
  const [wdLightboxPhotoIndex, setWdLightboxPhotoIndex] = useState<number | null>(null);
  const [wdLightboxZoom, setWdLightboxZoom] = useState<number>(1);

  // Download PDF / Printable HTML Voucher
  const handleDownloadWdPdf = (wd: FDWithdrawal) => {
    const customerObj = customers.find(c => isMatchingCustomerId(wd.customerId, c));
    const custName = customerObj?.name || wd.depositorName;
    const custId = customerObj ? getCanonicalCustomerId(customerObj) : (wd.customerId || '—');
    const custPhone = customerObj?.phone || wd.customerPhone || '';
    const custAddr = customerObj?.currentAddress || 'Tamil Nadu';

    const filename = `KKV-Gold-Finance-FD-Withdrawal-${wd.receiptNo || wd.withdrawalId || 'Receipt'}.html`;
    const receiptHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>KKV Gold Finance - Fixed Deposit Withdrawal Receipt ${wd.receiptNo || wd.withdrawalId}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #1e293b; background: #f8fafc; }
  .voucher { max-width: 740px; margin: 0 auto; background: #ffffff; border: 2px solid #064e3b; border-radius: 12px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #064e3b; padding-bottom: 16px; }
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
      <span class="receipt-title">FD Withdrawal Receipt</span>
    </div>
  </div>

  <div class="meta-grid">
    <div><span class="label">Receipt Number:</span><br/><strong class="val" style="color:#064e3b;">${wd.receiptNo || 'FDR-001'}</strong></div>
    <div><span class="label">Withdrawal ID:</span><br/><strong class="val">${wd.withdrawalId || 'WD-001'}</strong></div>
    <div><span class="label">Date:</span><br/><strong class="val">${wd.withdrawalDate}</strong></div>
  </div>

  <div class="section-title">Customer Details</div>
  <div class="grid-2">
    <div class="row"><span class="label">Customer Name:</span><span class="val">${custName}</span></div>
    <div class="row"><span class="label">Customer ID:</span><span class="val">${custId}</span></div>
    <div class="row"><span class="label">Mobile Number:</span><span class="val">+91 ${custPhone}</span></div>
    <div class="row"><span class="label">Address:</span><span class="val">${custAddr}</span></div>
  </div>

  <div class="section-title">Fixed Deposit Details</div>
  <div class="grid-2">
    <div class="row"><span class="label">FD Number:</span><span class="val" style="color:#064e3b;">${wd.fdNo}</span></div>
    <div class="row"><span class="label">Original Principal:</span><span class="val">₹${(wd.originalPrincipal ?? wd.principalAmount + (wd.remainingBalance ?? 0)).toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Balance Before Withdrawal:</span><span class="val">₹${(wd.balanceBefore ?? (wd.principalAmount + (wd.remainingBalance ?? 0))).toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Withdrawal Type:</span><span class="val">${wd.withdrawalType === 'FULL' || (wd.remainingBalance ?? 0) === 0 ? 'FULL CLOSURE' : 'Partial Withdrawal'}</span></div>
  </div>

  <div class="section-title">Withdrawal Settlement Details</div>
  <div class="grid-2">
    <div class="row"><span class="label">Withdrawal Amount:</span><span class="val highlight">₹${wd.principalAmount.toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Remaining Principal Balance:</span><span class="val">₹${(wd.remainingBalance ?? 0).toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">Payment Method:</span><span class="val">${wd.mode}${wd.bankName ? ' — ' + wd.bankName : ''}</span></div>
    <div class="row"><span class="label">Transaction Reference:</span><span class="val">${wd.transactionReference || 'Cash Settlement'}</span></div>
    <div class="row"><span class="label">Withdrawal Date:</span><span class="val">${wd.withdrawalDate}</span></div>
    <div class="row"><span class="label">FD Status:</span><span class="val">${(wd.remainingBalance ?? 0) === 0 ? 'CLOSED / WITHDRAWN' : 'ACTIVE / PARTIAL'}</span></div>
  </div>

  ${wd.items && wd.items.length > 0 ? `
  <div class="section-title">Pledged Collateral / Ornaments</div>
  <table>
    <thead>
      <tr>
        <th>Item Description</th>
        <th>Qty</th>
        <th>Purity</th>
        <th>Gross Wt</th>
        <th>Net Wt</th>
      </tr>
    </thead>
    <tbody>
      ${wd.items.map(it => `
        <tr>
          <td><strong>${it.item}</strong></td>
          <td>${it.qty}</td>
          <td>${it.purity}</td>
          <td>${it.grossWeight}g</td>
          <td>${it.netWeight}g</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="section-title">Status &amp; Verification</div>
  <div class="grid-2">
    <div class="row"><span class="label">Transaction Status:</span><span class="val" style="color:#059669;">✓ COMPLETED</span></div>
    <div class="row"><span class="label">Processed By:</span><span class="val">${wd.processedBy || 'Admin'}</span></div>
  </div>

  <div class="footer">
    <div>Customer Signature<br/><br/>_____________________</div>
    <div style="text-align:right;">Authorized Signatory<br/><br/>_____________________</div>
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
    showToast(`Withdrawal receipt ${wd.receiptNo || wd.withdrawalId} downloaded.`, 'success');
  };


  // Calculated values
  const numericPrincipal = typeof principal === 'number' ? principal : parseFloat(String(principal)) || 0;
  const numericRate = typeof interestRatePA === 'number' ? interestRatePA : parseFloat(String(interestRatePA)) || 0;
  const numericTenure = typeof tenureMonths === 'number' ? tenureMonths : parseInt(String(tenureMonths), 10) || 0;

  const monthlyPayout = Math.round((numericPrincipal * (numericRate / 100)) / 12);
  const expectedMaturityAmount = Math.round(numericPrincipal + (numericPrincipal * (numericRate / 100) * (numericTenure / 12)));
  const calculatedMaturityDatePreview = useMemo(() => calculateMaturityDate(depositDate, numericTenure || 12), [depositDate, numericTenure]);

  const maxSeq = useMemo(() => {
    return fixedDeposits.reduce((max, f) => {
      const match = f.fdNo ? f.fdNo.match(/\d+/) : null;
      const num = match ? parseInt(match[0], 10) : 0;
      return num > max ? num : max;
    }, 0);
  }, [fixedDeposits]);
  const nextFdNo = `FD-${(maxSeq + 1).toString().padStart(2, '0')}`;

  // Filter non-deleted active customers
  const activeCustomers = useMemo(() => customers.filter((c) => !c.isDeleted), [customers]);

  // Real-time matching customers based on query (New Deposit)
  const matchingCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return [];
    const q = customerSearchQuery.toLowerCase().trim();
    return activeCustomers.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        (c.customerId && c.customerId.toString().toLowerCase().includes(q)) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [activeCustomers, customerSearchQuery]);

  // Real-time matching customers for Withdrawal flow
  const wdMatchingCustomers = useMemo(() => {
    if (!wdCustSearchQuery.trim() || wdSelectedCustomer) return [];
    const q = wdCustSearchQuery.toLowerCase().trim();
    return activeCustomers.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        (c.customerId && c.customerId.toString().toLowerCase().includes(q)) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [activeCustomers, wdCustSearchQuery, wdSelectedCustomer]);

  // FDs belonging to the withdrawal-selected customer
  const wdCustomerFDs = useMemo(() => {
    if (!wdSelectedCustomer) return [];
    return fixedDeposits.filter((f) => isMatchingCustomerId(f.customerId, wdSelectedCustomer));
  }, [fixedDeposits, wdSelectedCustomer]);

  // Submission lock to prevent duplicate FD creation
  const [isSubmittingFD, setIsSubmittingFD] = useState<boolean>(false);

  // Handle Customer Selection
  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerSearchQuery(cust.name);
    showToast(`Selected Customer: ${cust.name} (${getCanonicalCustomerId(cust)})`, 'success');
  };

  const handleClearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearchQuery('');
  };

  // Submit Fixed Deposit
  const handleSubmitDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingFD) return;

    if (!selectedCustomer) {
      showToast('Please search and select an existing Customer first.', 'error');
      return;
    }

    if (!numericPrincipal || numericPrincipal <= 0) {
      showToast('Please enter a valid principal deposit amount greater than zero.', 'error');
      return;
    }

    const minAmount = masterControlSettings?.fdMinimumAmount ?? 5000;
    if (numericPrincipal < minAmount) {
      showToast(`Minimum Fixed Deposit principal amount is ₹${minAmount.toLocaleString('en-IN')}.`, 'error');
      return;
    }

    if (!numericRate || numericRate <= 0 || numericRate > 100) {
      showToast('Please enter a valid annual interest rate (e.g. 12% p.a.).', 'error');
      return;
    }

    if (!numericTenure || numericTenure < 1) {
      showToast('Please enter a valid deposit tenure in months (min 1 month).', 'error');
      return;
    }

    setIsSubmittingFD(true);

    try {
      const calculatedMaturityDate = calculateMaturityDate(depositDate, numericTenure);
      const canonicalCustId = getCanonicalCustomerId(selectedCustomer);

      addFixedDeposit({
        customerId: canonicalCustId,
        depositorName: selectedCustomer.name,
        phone: selectedCustomer.phone,
        idProofType: selectedCustomer.idProof || 'Aadhaar Card',
        idProofNumber: selectedCustomer.idNumber || '',
        address: selectedCustomer.currentAddress || '',
        depositDate,
        maturityDate: calculatedMaturityDate,
        principal: numericPrincipal,
        remainingPrincipal: numericPrincipal,
        totalWithdrawnPrincipal: 0,
        tenureMonths: numericTenure,
        interestRatePA: numericRate,
        receivingMethod,
        monthlyPayout,
        status: 'ACTIVE',
        parentCustomerName: '',
        nomineeName,
        nomineeRelation,
        remarks
      });

      showToast(`Fixed Deposit ${nextFdNo} created successfully for ${selectedCustomer.name}!`, 'success');

      // Reset Form
      setSelectedCustomer(null);
      setCustomerSearchQuery('');
      setPrincipal('200000');
      setNomineeName('');
      setNomineeRelation('');
      setRemarks('');
    } finally {
      setIsSubmittingFD(false);
    }
  };


  // Helper function to resolve customer object from FD
  const resolveCustomer = (customerId: string, defaultName: string, defaultPhone: string) => {
    const found = customers.find((c) => isMatchingCustomerId(customerId, c));
    return {
      name: found?.name || defaultName,
      phone: found?.phone || defaultPhone,
      id: found ? getCanonicalCustomerId(found) : customerId,
      photo: found?.customerPhoto
    };
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-dark)' }}>
            Fixed Deposit Management
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Issue and manage high-yield term deposits linked to master registered customers.
          </p>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '4px', flexWrap: 'wrap' }}>
        {[
          { key: 'new-deposit', label: '➕ New Deposit' },
          { key: 'deposit-display', label: '📋 Deposit Display' },
          { key: 'deposit-interest', label: '💰 Deposit Interest' },
          { key: 'interest-display', label: '📄 Interest Display' },
          { key: 'interest-pending', label: '⏳ Interest Pending' },
          { key: 'deposit-withdrawal', label: '💸 Deposit Withdrawal' },
          { key: 'withdrawal-display', label: '📑 Withdrawal Display' },
          { key: 'fd-customers-deposits', label: '👥 FD Customers & Deposits' }
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn btn-sm ${activeSubTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-sm)', fontWeight: 600 }}
            onClick={() => {
              setActiveSubTab(t.key);
              setCurrentPage(t.key as any);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SUBVIEW 1: NEW DEPOSIT */}
      {activeSubTab === 'new-deposit' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <div>
              <h2 className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>Issue New Fixed Deposit</h2>
              <p className="card-description">Select an existing registered customer and configure term deposit details</p>
            </div>
          </div>

          {/* SECTION 1: MASTER CUSTOMER SELECTION */}
          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
              borderRadius: '12px',
              border: '1px solid var(--border-light, #e2e8f0)',
              marginBottom: '20px'
            }}
          >
            <label className="form-label required" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
              1. SEARCH &amp; SELECT MASTER CUSTOMER *
            </label>
            <div style={{ position: 'relative', marginTop: '6px' }}>
              <input
                type="text"
                className="input-control"
                style={{ height: '42px', paddingLeft: '38px', fontSize: '13px' }}
                placeholder="Search Customer ID, Name, or Mobile Number (e.g. CUST-006, Sanjai, 8637628773)..."
                value={customerSearchQuery}
                onChange={(e) => {
                  setCustomerSearchQuery(e.target.value);
                  if (selectedCustomer) setSelectedCustomer(null);
                }}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
            </div>

            {/* Matching Customer Suggestions Dropdown */}
            {!selectedCustomer && customerSearchQuery.trim() !== '' && (
              <div
                style={{
                  marginTop: '8px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  borderRadius: '8px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                {matchingCustomers.length === 0 ? (
                  <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <AlertCircle size={16} color="var(--color-danger, #ef4444)" style={{ display: 'inline', marginRight: '6px' }} />
                    Customer not found. Please enter a valid existing Customer ID or Name.
                  </div>
                ) : (
                  matchingCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-secondary, #f8fafc)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {c.customerPhoto ? (
                          <img src={c.customerPhoto} alt={c.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-light-accent)', color: 'var(--color-primary-dark)', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-dark)' }}>{c.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>+91 {c.phone}</span>
                        </div>
                      </div>
                      <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 600 }}>{c.id}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SELECTED READ-ONLY CUSTOMER PREVIEW CARD */}
            {selectedCustomer && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '10px',
                  border: '1.5px solid var(--color-primary-accent, #059669)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {selectedCustomer.customerPhoto ? (
                      <img
                        src={selectedCustomer.customerPhoto}
                        alt={selectedCustomer.name}
                        style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary-accent)' }}
                      />
                    ) : (
                      <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'var(--color-light-accent)', color: 'var(--color-primary-dark)', fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {selectedCustomer.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>{selectedCustomer.name}</h3>
                        <span className="badge badge-success" style={{ fontSize: '10px' }}>✓ VERIFIED MASTER CUSTOMER</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Customer ID: <strong style={{ color: 'var(--color-primary-dark)' }}>{selectedCustomer.id}</strong> | Phone: <strong>+91 {selectedCustomer.phone}</strong> | Gender: {selectedCustomer.gender} | Occupation: {selectedCustomer.occupation || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '12px', height: '32px', gap: '4px' }}
                      onClick={() => {
                        setSelectedProfileCustomerId(selectedCustomer.id);
                        setCurrentPage('customer-profile');
                      }}
                    >
                      <Eye size={13} />
                      <span>View Customer Profile</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '12px', height: '32px', gap: '4px', color: 'var(--color-danger, #ef4444)' }}
                      onClick={handleClearSelectedCustomer}
                    >
                      <RotateCcw size={13} />
                      <span>Change</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: FIXED DEPOSIT DETAILS FORM */}
          {selectedCustomer ? (
            <form onSubmit={handleSubmitDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                2. FIXED DEPOSIT TERMS &amp; FINANCIAL DETAILS
              </h3>

              <div className="grid-2">
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label required">FD NUMBER</label>
                    <span className="badge badge-success" style={{ fontSize: '10px' }}>✓ Auto Generated</span>
                  </div>
                  <input type="text" className="input-control readonly" readOnly value={nextFdNo} />
                </div>

                <div className="form-group">
                  <label className="form-label required">DEPOSIT START DATE</label>
                  <input type="text" className="input-control" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label required">PRINCIPAL AMOUNT (₹)</label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Min: ₹{(masterControlSettings?.fdMinimumAmount ?? 5000).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min={masterControlSettings?.fdMinimumAmount ?? 5000}
                    className="input-control"
                    style={{ fontWeight: 700, fontSize: '15px' }}
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label required">INTEREST RATE (% P.A.)</label>
                    <span className="badge badge-warning" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      🔒 Master Controlled
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input-control readonly"
                    readOnly
                    style={{ fontWeight: 800, fontSize: '15px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', cursor: 'not-allowed', color: 'var(--color-primary-dark, #059669)' }}
                    value={`${(masterControlSettings?.fdInterestRate ?? 12).toFixed(2)}% P.A.`}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                    Inherited from Master Control · Effective: {masterControlSettings?.fdInterestRateEffectiveFrom || 'Active'}
                  </span>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label required">TENURE</label>
                    <span className="badge badge-info" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      🔒 Master Controlled
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input-control readonly"
                    readOnly
                    style={{ fontWeight: 700, backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', cursor: 'not-allowed' }}
                    value={`${masterControlSettings?.fdDefaultTenureMonths ?? 12} Months`}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                    Inherited from Master Control (Default: {masterControlSettings?.fdDefaultTenureMonths ?? 12} Mos)
                  </span>
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label required">PAYOUT FREQUENCY</label>
                    <span className="badge badge-success" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      🔒 Master Controlled
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input-control readonly"
                    readOnly
                    style={{ fontWeight: 600, backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', cursor: 'not-allowed' }}
                    value={`${payoutFrequency || masterControlSettings?.fdPayoutFrequency || 'Monthly'} Dividend`}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                    Inherited from Master Control · Strategy: {masterControlSettings?.fdCalculationMethod || 'MONTHLY_DIVIDEND'}
                  </span>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label required">RECEIVING METHOD</label>
                  <select className="input-control" value={receivingMethod} onChange={(e) => setReceivingMethod(e.target.value as any)}>
                    <option value="Cash">Cash Account</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="UPI">UPI Payment</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">NOMINEE NAME (OPTIONAL)</label>
                  <input type="text" className="input-control" placeholder="Nominee full name" value={nomineeName} onChange={(e) => setNomineeName(e.target.value)} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">NOMINEE RELATION (OPTIONAL)</label>
                  <input type="text" className="input-control" placeholder="e.g. Spouse, Son, Daughter" value={nomineeRelation} onChange={(e) => setNomineeRelation(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">REMARKS / NOTES</label>
                  <input type="text" className="input-control" placeholder="Any special deposit notes" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>
              </div>

              {/* Financial Calculation Summary Box */}
              <div
                style={{
                  padding: '20px',
                  backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginTop: '8px'
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>MONTHLY INTEREST PAYOUT</span>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '4px 0' }}>
                    ₹{monthlyPayout.toLocaleString('en-IN')} / mo
                  </h3>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>Regular dividend commitment</p>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>EXPECTED MATURITY AMOUNT</span>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary-accent, #059669)', margin: '4px 0' }}>
                    ₹{expectedMaturityAmount.toLocaleString('en-IN')}
                  </h3>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>Maturity Date: {calculatedMaturityDatePreview} ({tenureMonths} mos)</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingFD} style={{ padding: '12px 28px', fontWeight: 800, fontSize: '14px' }}>
                  {isSubmittingFD ? 'Processing Deposit...' : `Issue Fixed Deposit ${nextFdNo}`}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleClearSelectedCustomer}>
                  Reset
                </button>
              </div>
            </form>
          ) : (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                borderRadius: '10px',
                border: '1px dashed var(--border-light, #cbd5e1)',
                color: 'var(--text-muted)'
              }}
            >
              <User size={36} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark)' }}>Please Select a Master Customer First</div>
              <p style={{ fontSize: '12.5px', margin: '4px 0 0 0' }}>Use the search box above to find and confirm an existing customer before issuing a Fixed Deposit.</p>
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW 2: DEPOSIT DISPLAY & REGISTER */}
      {(activeSubTab === 'deposit-display' || activeSubTab === 'fd-customers-deposits') && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>Fixed Deposit Register</h2>
              <p className="card-description">All active and historical Fixed Deposits linked to registered master customers</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-success">{fixedDeposits.filter((f) => f.status === 'ACTIVE').length} Active FDs</span>
              <span className="badge badge-info">{fixedDeposits.length} Total FDs</span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 280px' }}>
              <input
                type="text"
                className="input-control"
                style={{ height: '38px', paddingLeft: '34px', fontSize: '13px' }}
                placeholder="Filter by FD No, Customer ID, Name, or Mobile..."
                value={displaySearchText}
                onChange={(e) => setDisplaySearchText(e.target.value)}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-muted)' }} />
            </div>

            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-surface-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              {(['ALL', 'ACTIVE', 'MATURED', 'WITHDRAWN'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`btn btn-sm ${displayStatusFilter === st ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '11.5px', padding: '4px 10px', fontWeight: 700 }}
                  onClick={() => setDisplayStatusFilter(st)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>FD NO</th>
                  <th>CUSTOMER</th>
                  <th>CUSTOMER ID</th>
                  <th>PHONE</th>
                  <th>DEPOSIT DATE</th>
                  <th>MATURITY DATE</th>
                  <th>ORIGINAL PRINCIPAL</th>
                  <th>REMAINING BAL</th>
                  <th>RATE (% P.A.)</th>
                  <th>MONTHLY PAYOUT</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {fixedDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No Fixed Deposits recorded yet in the system.
                    </td>
                  </tr>
                ) : (
                  fixedDeposits
                    .filter((f) => {
                      if (displayStatusFilter !== 'ALL' && f.status !== displayStatusFilter) return false;
                      if (displaySearchText.trim()) {
                        const q = displaySearchText.toLowerCase().trim();
                        return (
                          f.fdNo.toLowerCase().includes(q) ||
                          f.depositorName.toLowerCase().includes(q) ||
                          f.customerId.toLowerCase().includes(q) ||
                          f.phone.includes(q)
                        );
                      }
                      return true;
                    })
                    .map((f) => {
                      const resolved = resolveCustomer(f.customerId, f.depositorName, f.phone);
                      const remaining = f.remainingPrincipal ?? f.principal;
                      return (
                        <tr key={f.id}>
                          <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{f.fdNo}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {resolved.photo ? (
                                <img src={resolved.photo} alt={resolved.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--color-light-accent)', color: 'var(--color-primary-dark)', fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {resolved.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{resolved.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 600 }}>{resolved.id}</span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>+91 {resolved.phone}</td>
                          <td>{f.depositDate}</td>
                          <td>{f.maturityDate}</td>
                          <td style={{ fontWeight: 700, color: 'var(--color-primary-accent, #059669)' }}>₹{f.principal.toLocaleString('en-IN')}</td>
                          <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>₹{remaining.toLocaleString('en-IN')}</td>
                          <td>{f.interestRatePA}%</td>
                          <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                            ₹{f.monthlyPayout.toLocaleString('en-IN')}
                          </td>
                          <td>
                            <span className={`badge ${f.status === 'ACTIVE' ? 'badge-success' : f.status === 'MATURED' ? 'badge-info' : 'badge-warning'}`}>
                              {f.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ height: '28px', padding: '0 8px', fontSize: '11px', gap: '4px', fontWeight: 600 }}
                                onClick={() => {
                                  setSelectedProfileCustomerId(resolved.id);
                                  setCurrentPage('customer-profile');
                                }}
                              >
                                <Eye size={12} />
                                <span>View Customer</span>
                              </button>
                              {userRole === 'ADMIN' && (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ height: '28px', padding: '0 8px', fontSize: '11px', gap: '4px', fontWeight: 600, color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                  title="Delete Fixed Deposit (Master Admin Only)"
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete Fixed Deposit ${f.fdNo}?`)) {
                                      deleteFixedDeposit(f.fdNo);
                                    }
                                  }}
                                >
                                  <Trash2 size={12} />
                                  <span>Delete FD</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: DEPOSIT INTEREST (DISBURSEMENT SCHEDULE & TABLE) */}
      {activeSubTab === 'deposit-interest' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <div>
              <h2 className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>Disburse FD Monthly Interest</h2>
              <p className="card-description">
                Schedule and record interest payouts for active fixed deposits based on contractual deposit date cycles.
              </p>
            </div>
          </div>

          <div className="table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
            <table className="custom-table" style={{ minWidth: '1100px', width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>FD NO</th>
                  <th style={{ width: '170px' }}>CUSTOMER</th>
                  <th style={{ width: '110px' }}>CUSTOMER ID</th>
                  <th style={{ width: '130px' }}>ORIGINAL PRINCIPAL</th>
                  <th style={{ width: '130px' }}>REMAINING BAL</th>
                  <th style={{ width: '130px' }}>MONTHLY PAYOUT</th>
                  <th style={{ width: '110px' }}>NEXT PAYOUT</th>
                  <th style={{ width: '130px' }}>PAYMENT MODE</th>
                  <th style={{ width: '130px' }}>STATUS</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {fixedDeposits.filter((f) => f.status === 'ACTIVE').length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No active Fixed Deposits available for interest disbursement.
                    </td>
                  </tr>
                ) : (
                  fixedDeposits.filter((f) => f.status === 'ACTIVE').map((f) => {
                    const resolved = resolveCustomer(f.customerId, f.depositorName, f.phone);
                    const remaining = f.remainingPrincipal ?? f.principal;
                    const schedule = calculateFDInterestSchedule(f, fdInterestPayouts);
                    const isProcessing = processingFdNos.has(f.fdNo);

                    return (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{f.fdNo}</td>
                        <td style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={resolved.name}>
                          {resolved.name}
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 600 }}>
                            {resolved.id}
                          </span>
                        </td>
                        <td>₹{f.principal.toLocaleString('en-IN')}</td>
                        <td style={{ fontWeight: 700 }}>₹{remaining.toLocaleString('en-IN')}</td>
                        <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                          ₹{schedule.payoutAmount.toLocaleString('en-IN')}
                        </td>
                        <td style={{ fontWeight: 700, color: schedule.isEligible ? 'var(--color-primary-accent, #059669)' : 'var(--text-dark)' }}>
                          {schedule.nextPayoutDate}
                        </td>
                        <td>
                          <select id={`mode-${f.id}`} className="input-control" style={{ padding: '4px 8px', fontSize: '12px' }}>
                            <option value="Cash">Cash Account</option>
                            <option value="Bank">Bank Transfer</option>
                            <option value="UPI">UPI Payment</option>
                          </select>
                        </td>
                        <td>
                          {schedule.status === 'NOT_DUE' && (
                            <span className="badge" style={{ backgroundColor: 'var(--bg-surface-secondary)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700 }}>
                              NOT YET DUE
                            </span>
                          )}
                          {schedule.status === 'DUE' && (
                            <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 800 }}>
                              ✓ INTEREST DUE
                            </span>
                          )}
                          {schedule.status === 'OVERDUE' && (
                            <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: 800 }}>
                              ⚠ OVERDUE ({schedule.daysPending}d)
                            </span>
                          )}
                          {schedule.status === 'WITHDRAWN' && (
                            <span className="badge badge-danger" style={{ fontSize: '11px', fontWeight: 800 }}>
                              WITHDRAWN
                            </span>
                          )}
                          {schedule.status === 'MATURED' && (
                            <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 800 }}>
                              MATURED
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${schedule.isEligible ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                              height: '30px',
                              padding: '0 12px',
                              fontWeight: 700,
                              opacity: schedule.isEligible && !isProcessing ? 1 : 0.6,
                              cursor: schedule.isEligible && !isProcessing ? 'pointer' : 'not-allowed'
                            }}
                            disabled={!schedule.isEligible || isProcessing}
                            title={schedule.isEligible ? 'Click to disburse interest' : schedule.statusText}
                            onClick={() => {
                              if (!schedule.isEligible || isProcessing) return;
                              const selectEl = document.getElementById(`mode-${f.id}`) as HTMLSelectElement;
                              const mode = (selectEl?.value || 'Cash') as 'Cash' | 'Bank' | 'UPI';

                              setProcessingFdNos((prev) => new Set(prev).add(f.fdNo));
                              payFDInterest(f.fdNo, mode, schedule.payoutAmount, schedule.nextPayoutDate, schedule.periodKey);
                              setProcessingFdNos((prev) => {
                                const next = new Set(prev);
                                next.delete(f.fdNo);
                                return next;
                              });
                            }}
                          >
                            {isProcessing
                              ? 'Processing...'
                              : schedule.isEligible
                              ? 'Disburse Interest'
                              : 'Not Due'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 4: INTEREST DISPLAY (PAID HISTORICAL LEDGER) */}
      {activeSubTab === 'interest-display' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <div>
              <h2 className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>FD Interest Payout Ledger</h2>
              <p className="card-description">Historical ledger of processed monthly dividend payments to depositors</p>
            </div>
          </div>

          <div className="table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
            <table className="custom-table" style={{ minWidth: '950px', width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>PAYOUT DATE</th>
                  <th style={{ width: '110px' }}>DUE DATE</th>
                  <th style={{ width: '90px' }}>FD NO</th>
                  <th style={{ width: '180px' }}>CUSTOMER</th>
                  <th style={{ width: '110px' }}>CUSTOMER ID</th>
                  <th style={{ width: '130px' }}>PAYOUT AMOUNT</th>
                  <th style={{ width: '120px' }}>PAYMENT MODE</th>
                  <th style={{ width: '100px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {fdInterestPayouts.length > 0 ? (
                  fdInterestPayouts.map((p) => {
                    const targetFd = fixedDeposits.find((f) => f.fdNo === p.fdNo || f.id === p.fdId);
                    const resolvedCust = resolveCustomer(p.customerId || targetFd?.customerId || '', p.depositorName, '');
                    return (
                      <tr key={p.id}>
                        <td>{p.date}</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>{p.dueDate || p.date}</td>
                        <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{p.fdNo}</td>
                        <td style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={resolvedCust.name}>
                          {resolvedCust.name}
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 600 }}>
                            {resolvedCust.id}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>₹{p.amount.toLocaleString('en-IN')}</td>
                        <td>{p.mode || 'Cash'}</td>
                        <td><span className="badge badge-success" style={{ fontWeight: 800 }}>🟢 PAID</span></td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '35px', color: 'var(--text-muted)' }}>
                      No interest payouts recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 5: INTEREST PENDING (MULTI-PERIOD DYNAMIC SCHEDULING) */}
      {activeSubTab === 'interest-pending' && (() => {
        const allPendingPeriods = getAllPendingFDInterestPeriods(fixedDeposits, fdInterestPayouts);
        const totalPendingAmount = allPendingPeriods.reduce((sum, p) => sum + p.amount, 0);
        const totalPendingCount = allPendingPeriods.length;
        const totalOverdueCount = allPendingPeriods.filter((p) => p.daysOverdue > 0).length;
        const activeFdsWithPendingCount = new Set(allPendingPeriods.map((p) => p.fdNo)).size;

        const filteredPendingPeriods = allPendingPeriods.filter((p) => {
          const q = pendingSearchQuery.trim().toLowerCase();
          if (q) {
            const matchFd = p.fdNo.toLowerCase().includes(q);
            const matchCustId = p.customerId.toLowerCase().includes(q);
            const matchName = p.depositorName.toLowerCase().includes(q);
            const matchPhone = p.phone ? p.phone.toLowerCase().includes(q) : false;
            if (!matchFd && !matchCustId && !matchName && !matchPhone) return false;
          }
          if (pendingFilterStatus === 'PENDING') return p.daysOverdue === 0;
          if (pendingFilterStatus === 'OVERDUE') return p.daysOverdue > 0;
          return true;
        });

        return (
          <div>
            {/* DYNAMIC SUMMARY METRIC CARDS */}
            <div className="grid-4" style={{ marginBottom: '20px' }}>
              <div className="card" style={{ padding: '16px', backgroundColor: 'var(--badge-warning-bg)', border: '1px solid var(--badge-warning-border)', color: 'var(--color-warning)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#d46b08', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  TOTAL PENDING INTEREST
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                  ₹{totalPendingAmount.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: '2px' }}>
                  Sum of all unpaid due interest periods
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  PENDING PERIODS
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: '4px' }}>
                  {totalPendingCount}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Total contractual periods due for payout
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#cf1322', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  OVERDUE PERIODS
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#cf1322', marginTop: '4px' }}>
                  {totalOverdueCount}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Periods past scheduled due date
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ACTIVE FDs WITH PENDING
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: '4px' }}>
                  {activeFdsWithPendingCount}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Unique active deposits requiring disbursal
                </div>
              </div>
            </div>

            {/* SEARCH & FILTER BAR */}
            <div className="card" style={{ padding: '24px' }}>
              <div className="card-header" style={{ marginBottom: '16px' }}>
                <div>
                  <h2 className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>FD Monthly Interest Pending</h2>
                  <p className="card-description">
                    Unpaid contractual interest periods calculated dynamically up to today. Each period is individually actionable.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '280px', display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-control"
                      style={{ paddingLeft: '36px' }}
                      placeholder="Search by FD Number, Customer ID, Name, or Mobile..."
                      value={pendingSearchQuery}
                      onChange={(e) => setPendingSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className={`btn ${pendingFilterStatus === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
                    onClick={() => setPendingFilterStatus('ALL')}
                  >
                    All ({allPendingPeriods.length})
                  </button>
                  <button
                    type="button"
                    className={`btn ${pendingFilterStatus === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
                    onClick={() => setPendingFilterStatus('PENDING')}
                  >
                    Pending Due Today ({allPendingPeriods.filter((p) => p.daysOverdue === 0).length})
                  </button>
                  <button
                    type="button"
                    className={`btn ${pendingFilterStatus === 'OVERDUE' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
                    onClick={() => setPendingFilterStatus('OVERDUE')}
                  >
                    Overdue ({allPendingPeriods.filter((p) => p.daysOverdue > 0).length})
                  </button>
                </div>
              </div>

              {/* TABLE CONTAINER WITH NO PAGE SCROLLBAR */}
              <div className="table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
                <table className="custom-table" style={{ minWidth: '1050px', width: '100%', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>DUE DATE</th>
                      <th style={{ width: '90px' }}>FD NO</th>
                      <th style={{ width: '160px' }}>CUSTOMER</th>
                      <th style={{ width: '110px' }}>CUSTOMER ID</th>
                      <th style={{ width: '180px' }}>INTEREST PERIOD</th>
                      <th style={{ width: '130px' }}>PENDING AMOUNT</th>
                      <th style={{ width: '120px' }}>DAYS OVERDUE</th>
                      <th style={{ width: '120px' }}>STATUS</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPendingPeriods.length > 0 ? (
                      filteredPendingPeriods.map((p) => {
                        const resolvedCust = resolveCustomer(p.customerId, p.depositorName, p.phone || '');
                        const isProcessing = processingFdNos.has(p.fdNo);

                        return (
                          <tr key={`${p.fdNo}-${p.periodKey}`}>
                            <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{p.dueDate}</td>
                            <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{p.fdNo}</td>
                            <td style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={resolvedCust.name}>
                              {resolvedCust.name}
                            </td>
                            <td>
                              <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 600 }}>
                                {resolvedCust.id}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: '#475569' }}>{p.periodLabel}</td>
                            <td style={{ fontWeight: 800, color: '#d97706' }}>
                              ₹{p.amount.toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontWeight: 700, color: p.daysOverdue > 0 ? '#cf1322' : '#d97706' }}>
                              {p.daysOverdue > 0 ? `${p.daysOverdue} days` : 'Due Today'}
                            </td>
                            <td>
                              {p.status === 'OVERDUE' ? (
                                <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: 800 }}>
                                  ⚠ OVERDUE
                                </span>
                              ) : (
                                <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#d97706', fontSize: '11px', fontWeight: 800 }}>
                                  🟡 PENDING DUE
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ height: '30px', padding: '0 12px', fontSize: '11px', fontWeight: 800 }}
                                disabled={isProcessing}
                                onClick={() => {
                                  setPayingPeriod(p);
                                  setPayPendingMode('Cash');
                                  setPayPendingBankName('');
                                  setPayPendingTxRef('');
                                  setPayPendingUpiId('');
                                }}
                              >
                                Pay Interest
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No pending interest payouts matching criteria. All active deposits are up to date!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAY PENDING INTEREST MODAL */}
            {payingPeriod && (
              <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: 0 }}>
                      Disburse Interest — {payingPeriod.fdNo}
                    </h3>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => setPayingPeriod(null)}>✕</button>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-surface-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Customer: </span><strong>{payingPeriod.depositorName} ({payingPeriod.customerId})</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Interest Period: </span><strong>{payingPeriod.periodLabel}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Scheduled Due Date: </span><strong>{payingPeriod.dueDate}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Interest Amount: </span><strong style={{ color: 'var(--color-primary-dark)', fontSize: '16px' }}>₹{payingPeriod.amount.toLocaleString('en-IN')}</strong></div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label required">PAYMENT METHOD</label>
                    <select className="input-control" value={payPendingMode} onChange={(e) => setPayPendingMode(e.target.value as any)}>
                      <option value="Cash">Cash Account</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="UPI">UPI Payment</option>
                    </select>
                  </div>

                  {payPendingMode === 'Bank' && (
                    <>
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label">BANK NAME</label>
                        <input type="text" className="input-control" placeholder="e.g. HDFC Bank" value={payPendingBankName} onChange={(e) => setPayPendingBankName(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label className="form-label required">TRANSACTION / UTR REFERENCE NUMBER</label>
                        <input type="text" className="input-control" placeholder="Enter Bank UTR Ref" value={payPendingTxRef} onChange={(e) => setPayPendingTxRef(e.target.value)} />
                      </div>
                    </>
                  )}

                  {payPendingMode === 'UPI' && (
                    <>
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label required">UPI TRANSACTION ID / UTR</label>
                        <input type="text" className="input-control" placeholder="Enter UPI Transaction Ref" value={payPendingTxRef} onChange={(e) => setPayPendingTxRef(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label className="form-label">UPI VPA / ID (OPTIONAL)</label>
                        <input type="text" className="input-control" placeholder="e.g. name@upi" value={payPendingUpiId} onChange={(e) => setPayPendingUpiId(e.target.value)} />
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setPayingPeriod(null)}>Cancel</button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontWeight: 800 }}
                      onClick={() => {
                        if (payPendingMode === 'Bank' && !payPendingTxRef.trim()) {
                          showToast('Please enter the Bank Transfer UTR / Transaction Reference.', 'error');
                          return;
                        }
                        if (payPendingMode === 'UPI' && !payPendingTxRef.trim()) {
                          showToast('Please enter the UPI Transaction ID.', 'error');
                          return;
                        }

                        setProcessingFdNos((prev) => new Set(prev).add(payingPeriod.fdNo));
                        const success = payFDInterest(
                          payingPeriod.fdNo,
                          payPendingMode,
                          payingPeriod.amount,
                          payingPeriod.dueDate,
                          payingPeriod.periodKey
                        );
                        setProcessingFdNos((prev) => {
                          const next = new Set(prev);
                          next.delete(payingPeriod.fdNo);
                          return next;
                        });

                        if (success) {
                          setPayingPeriod(null);
                          setPayPendingTxRef('');
                          setPayPendingBankName('');
                          setPayPendingUpiId('');
                        }
                      }}
                    >
                      Confirm Payout ₹{payingPeriod.amount.toLocaleString('en-IN')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* SUBVIEW 5: DEPOSIT WITHDRAWAL — CUSTOMER → FD → WITHDRAWAL FLOW */}
      {activeSubTab === 'deposit-withdrawal' && (() => {
        const wdRemaining = wdSelectedFD ? (wdSelectedFD.remainingPrincipal ?? wdSelectedFD.principal) : 0;
        const numWdAmount = typeof wdAmount === 'number' ? wdAmount : 0;
        const wdNewRemaining = wdType === 'FULL' ? 0 : Math.max(0, wdRemaining - numWdAmount);
        const wdEffectiveAmount = wdType === 'FULL' ? wdRemaining : numWdAmount;
        const paidInterestForFD = fdInterestPayouts.filter(p => p.fdNo === wdSelectedFD?.fdNo).reduce((s, p) => s + p.amount, 0);

        const handleWdSelectCustomer = (cust: Customer) => {
          setWdSelectedCustomer(cust);
          setWdCustSearchQuery(cust.name);
          setWdSelectedFD(null);
          setWdAmount('');
          setWdType('PARTIAL');
          setWdMode('Cash');
          setWdBankName('');
          setWdTxRef('');
          setWdUpiId('');
          setWdNotes('');
        };

        const handleWdClearCustomer = () => {
          setWdSelectedCustomer(null);
          setWdCustSearchQuery('');
          setWdSelectedFD(null);
          setWdAmount('');
        };

        const handleWdSelectFD = (fd: FixedDeposit) => {
          setWdSelectedFD(fd);
          setWdType('PARTIAL');
          const rem = fd.remainingPrincipal ?? fd.principal;
          setWdAmount(String(rem));
          setWdMode('Cash');
          setWdBankName('');
          setWdTxRef('');
          setWdUpiId('');
          setWdNotes('');
        };

        const handleWdConfirm = () => {
          if (wdProcessing || !wdSelectedFD) return;
          const amt = wdType === 'FULL' ? wdRemaining : numWdAmount;
          if (amt <= 0) { showToast('Please enter a valid withdrawal amount.', 'error'); return; }
          if (amt > wdRemaining) { showToast('Withdrawal amount cannot exceed remaining principal.', 'error'); return; }
          if (wdMode === 'Bank' && !wdTxRef.trim()) { showToast('Please enter the Bank Transfer UTR / Transaction Reference.', 'error'); return; }
          if (wdMode === 'UPI' && !wdTxRef.trim()) { showToast('Please enter the UPI Transaction ID / UTR.', 'error'); return; }
          setWdShowConfirmModal(true);
        };

        const handleWdFinalConfirm = () => {
          if (wdProcessing || !wdSelectedFD) return;
          setWdProcessing(true);
          const amt = wdActionType === 'FULL' ? wdRemaining : numWdAmount;
          const notesText = wdNotes.trim() || (wdActionType === 'FULL' ? 'Full FD Closure' : 'Partial Principal Withdrawal');
          const createdWd = withdrawFD(wdSelectedFD.fdNo, wdMode, notesText, amt, wdTxRef || undefined, wdBankName || undefined);
          setWdProcessing(false);
          setWdShowConfirmModal(false);
          if (createdWd) {
            setLastWdReceipt(createdWd);
            setWdShowSuccessModal(true);
          }
        };

        const wdActiveFDs = wdCustomerFDs.filter(f => f.status !== 'WITHDRAWN');
        const wdClosedFDs = wdCustomerFDs.filter(f => f.status === 'WITHDRAWN');

        return (
          <>
            <div className="card" style={{ padding: '24px' }}>
              <div className="card-header" style={{ marginBottom: '16px' }}>
                <div>
                  <h2 className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>Fixed Deposit Withdrawal &amp; Closure</h2>
                  <p className="card-description">Search an existing customer, select their Fixed Deposit, and process partial or full closure</p>
                </div>
              </div>

              {/* STEP 1: CUSTOMER SEARCH */}
              <div style={{ padding: '18px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', borderRadius: '12px', border: '1px solid var(--border-light, #e2e8f0)', marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '8px', display: 'block' }}>
                  1. SEARCH CUSTOMER
                </label>
                {!wdSelectedCustomer && (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="input-control"
                      style={{ height: '42px', paddingLeft: '38px', fontSize: '13px' }}
                      placeholder="Search by Customer ID, Name, or Mobile Number (e.g. CUST-006, Sanjai, 8637628773)..."
                      value={wdCustSearchQuery}
                      onChange={(e) => setWdCustSearchQuery(e.target.value)}
                    />
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>
                )}

                {/* Suggestions Dropdown */}
                {!wdSelectedCustomer && wdCustSearchQuery.trim() !== '' && (
                  <div style={{ marginTop: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: '8px', maxHeight: '220px', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
                    {wdMatchingCustomers.length === 0 ? (
                      <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger, #ef4444)', fontSize: '13px', fontWeight: 600 }}>
                        <AlertCircle size={15} />
                        Customer not found. Please select an existing registered customer.
                      </div>
                    ) : (
                      wdMatchingCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleWdSelectCustomer(c)}
                          style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background-color 0.15s ease' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-secondary, #f8fafc)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {c.customerPhoto ? (
                              <img src={c.customerPhoto} alt={c.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-light-accent)', color: 'var(--color-primary-dark)', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-dark)' }}>{c.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {c.customerId || c.id} &bull; +91 {c.phone} &bull; {c.occupation || 'N/A'}
                              </div>
                            </div>
                          </div>
                          <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 600 }}>{c.customerId || c.id}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Customer Chip */}
                {wdSelectedCustomer && (
                  <div style={{ marginTop: '8px', padding: '12px 16px', backgroundColor: 'var(--bg-card)', borderRadius: '10px', border: '1.5px solid var(--color-primary-accent, #059669)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {wdSelectedCustomer.customerPhoto ? (
                        <img src={wdSelectedCustomer.customerPhoto} alt={wdSelectedCustomer.name} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary-accent)' }} />
                      ) : (
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'var(--color-light-accent)', color: 'var(--color-primary-dark)', fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {wdSelectedCustomer.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-dark)' }}>{wdSelectedCustomer.name}</span>
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>✓ Verified</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {getCanonicalCustomerId(wdSelectedCustomer)} &bull; +91 {wdSelectedCustomer.phone}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '12px', height: '32px', gap: '4px' }} onClick={() => { setSelectedProfileCustomerId(wdSelectedCustomer.id); setCurrentPage('customer-profile'); }}>
                        <Eye size={13} /> <span>View Profile</span>
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '12px', height: '32px', gap: '4px', color: 'var(--color-danger, #ef4444)' }} onClick={handleWdClearCustomer}>
                        <RotateCcw size={13} /> <span>Change</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: CUSTOMER'S FD LIST */}
              {wdSelectedCustomer && !wdSelectedFD && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                      FIXED DEPOSITS OF {wdSelectedCustomer.name.toUpperCase()}
                    </h3>
                    <span className="badge badge-info" style={{ fontWeight: 700 }}>{getCanonicalCustomerId(wdSelectedCustomer)}</span>
                  </div>

                  {wdCustomerFDs.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: '10px', border: '1px dashed var(--border-light)', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No Fixed Deposits found for this customer.
                    </div>
                  ) : wdActiveFDs.length === 0 ? (
                    <div style={{ padding: '16px', backgroundColor: 'var(--badge-warning-bg)', border: '1px solid var(--badge-warning-border)', borderRadius: '10px', color: 'var(--color-warning)', fontSize: '13px', fontWeight: 600 }}>
                      ⚠️ All Fixed Deposits for this customer have been fully withdrawn.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {wdActiveFDs.map((fd) => {
                        const rem = fd.remainingPrincipal ?? fd.principal;
                        return (
                          <div key={fd.id} style={{ padding: '16px 20px', backgroundColor: 'var(--bg-card)', borderRadius: '10px', border: '1.5px solid var(--border-light, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', flex: 1 }}>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>FD NUMBER</div>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>{fd.fdNo}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ORIGINAL PRINCIPAL</div>
                                <div style={{ fontSize: '14px', fontWeight: 700 }}>₹{fd.principal.toLocaleString('en-IN')}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>REMAINING BALANCE</div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}>₹{rem.toLocaleString('en-IN')}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>INTEREST RATE</div>
                                <div style={{ fontSize: '14px', fontWeight: 700 }}>{fd.interestRatePA}% p.a.</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DEPOSIT DATE</div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{fd.depositDate}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>MATURITY DATE</div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{fd.maturityDate}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</div>
                                <span className={`badge ${fd.status === 'ACTIVE' ? 'badge-success' : fd.status === 'MATURED' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '11px', fontWeight: 800 }}>{fd.status}</span>
                              </div>
                            </div>
                            <button type="button" className="btn btn-primary btn-sm" style={{ fontWeight: 800, whiteSpace: 'nowrap' }} onClick={() => handleWdSelectFD(fd)}>
                              Select
                            </button>
                          </div>
                        );
                      })}
                      {wdClosedFDs.length > 0 && (
                        <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: '8px', border: '1px dashed var(--border-light)', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                          ℹ️ {wdClosedFDs.length} fully withdrawn FD{wdClosedFDs.length > 1 ? 's' : ''} ({wdClosedFDs.map(f => f.fdNo).join(', ')}) not shown — no further withdrawals possible.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: SELECTED FD + MATURITY + ACTION FORM */}
              {wdSelectedCustomer && wdSelectedFD && (() => {
                const matInfo = getFDMaturityInfo(wdSelectedFD);
                const eligibility = getWithdrawalEligibility(wdSelectedFD);
                const rnNewMaturity = addCalendarMonths(wdSelectedFD.maturityDate, rnPeriodMonths);

                const handleRnConfirmOpen = () => {
                  if (rnProcessing) return;
                  setRnShowConfirmModal(true);
                };

                const handleRnFinalConfirm = () => {
                  if (rnProcessing || !wdSelectedFD) return;
                  setRnProcessing(true);
                  const ok = renewFD(wdSelectedFD.fdNo, rnPeriodMonths, rnNotes.trim() || undefined);
                  setRnShowConfirmModal(false);
                  setRnProcessing(false);
                  if (ok) {
                    setWdSelectedFD(null);
                    setWdActionType('PARTIAL');
                    setRnNotes('');
                    setRnPeriodMonths(12);
                  }
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* FD Summary */}
                    <div style={{ padding: '16px 20px', backgroundColor: 'var(--badge-success-bg)', borderRadius: '12px', border: '1.5px solid var(--badge-success-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>SELECTED FIXED DEPOSIT</h3>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '12px' }} onClick={() => setWdSelectedFD(null)}>← Back to FD List</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', fontSize: '13px' }}>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>FD NUMBER</span><strong style={{ color: 'var(--color-primary-dark)', fontSize: '15px' }}>{wdSelectedFD.fdNo}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>CUSTOMER</span><strong>{wdSelectedCustomer.name}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>CUSTOMER ID</span><span className="badge badge-info" style={{ fontWeight: 700 }}>{getCanonicalCustomerId(wdSelectedCustomer)}</span></div>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>ORIGINAL PRINCIPAL</span><strong>₹{wdSelectedFD.principal.toLocaleString('en-IN')}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>REMAINING PRINCIPAL</span><strong style={{ color: 'var(--color-primary-accent, #059669)', fontSize: '15px' }}>₹{wdRemaining.toLocaleString('en-IN')}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>INTEREST RATE</span><strong>{wdSelectedFD.interestRatePA}% p.a.</strong></div>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>DEPOSIT DATE</span><strong>{wdSelectedFD.depositDate}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>MATURITY DATE</span><strong>{wdSelectedFD.maturityDate}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>PAYOUT FREQUENCY</span><strong>{wdSelectedFD.payoutFrequency || 'Monthly'}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', fontSize: '11px' }}>STATUS</span><span className={`badge ${wdSelectedFD.status === 'ACTIVE' ? 'badge-success' : wdSelectedFD.status === 'MATURED' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '11px', fontWeight: 800 }}>{wdSelectedFD.status}</span></div>
                      </div>
                    </div>

                    {/* Maturity Information Card */}
                    <div style={{
                      padding: '14px 20px',
                      borderRadius: '10px',
                      border: `1.5px solid ${matInfo.maturityStatus === 'MATURED' ? '#3b82f6' : matInfo.maturityStatus === 'NEAR_MATURITY' ? '#f59e0b' : 'var(--border-light, #e2e8f0)'}`,
                      backgroundColor: matInfo.maturityStatus === 'MATURED' ? '#eff6ff' : matInfo.maturityStatus === 'NEAR_MATURITY' ? '#fffbeb' : 'var(--bg-surface-secondary)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '6px' }}>MATURITY INFORMATION</div>
                          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px' }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>Deposit Date: </span><strong>{wdSelectedFD.depositDate}</strong></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Maturity Date: </span><strong>{wdSelectedFD.maturityDate}</strong></div>
                            {matInfo.maturityStatus !== 'MATURED' && (
                              <div><span style={{ color: 'var(--text-muted)' }}>Remaining Tenure: </span><strong>{matInfo.remainingDays} days ({matInfo.remainingMonths > 0 ? `${matInfo.remainingMonths} month${matInfo.remainingMonths !== 1 ? 's' : ''}` : 'less than 1 month'})</strong></div>
                            )}
                            {matInfo.maturityStatus === 'MATURED' && matInfo.daysSinceMaturity > 0 && (
                              <div><span style={{ color: 'var(--text-muted)' }}>Days Since Maturity: </span><strong style={{ color: '#3b82f6' }}>{matInfo.daysSinceMaturity} day{matInfo.daysSinceMaturity !== 1 ? 's' : ''}</strong></div>
                            )}
                          </div>
                        </div>
                        <span style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 800,
                          backgroundColor: matInfo.maturityStatus === 'MATURED' ? '#3b82f6' : matInfo.maturityStatus === 'NEAR_MATURITY' ? '#f59e0b' : 'var(--color-primary-accent, #059669)',
                          color: '#ffffff'
                        }}>
                          {matInfo.maturityStatus === 'MATURED' ? '✓ MATURED' : matInfo.maturityStatus === 'NEAR_MATURITY' ? `⚠ ${matInfo.maturityLabel}` : `● ${matInfo.maturityLabel}`}
                        </span>
                      </div>
                    </div>

                    {/* Eligibility */}
                    <div style={{ padding: '10px 16px', borderRadius: '8px', backgroundColor: eligibility.eligible ? '#f0fdf4' : '#fef2f2', border: `1px solid ${eligibility.eligible ? '#bbf7d0' : '#fecaca'}`, fontSize: '13px', fontWeight: 600, color: eligibility.eligible ? '#15803d' : '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {eligibility.eligible ? '✓' : '⚠'} WITHDRAWAL ELIGIBILITY: {eligibility.reason}
                    </div>

                    {/* Action Type Selector */}
                    <div className="card" style={{ padding: '18px 20px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', display: 'block', marginBottom: '12px' }}>SELECT ACTION *</label>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {(['PARTIAL', 'FULL', 'RENEW'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setWdActionType(t);
                              if (t === 'FULL') { setWdType('FULL'); setWdAmount(String(wdRemaining)); }
                              else if (t === 'PARTIAL') { setWdType('PARTIAL'); setWdAmount(''); }
                            }}
                            style={{
                              padding: '10px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '13px',
                              border: `2px solid ${wdActionType === t ? (t === 'RENEW' ? '#3b82f6' : 'var(--color-primary-accent, #059669)') : 'var(--border-light, #e2e8f0)'}`,
                              backgroundColor: wdActionType === t ? (t === 'RENEW' ? '#3b82f6' : 'var(--color-primary-accent, #059669)') : '#ffffff',
                              color: wdActionType === t ? '#ffffff' : 'var(--text-dark)',
                              cursor: 'pointer', transition: 'all 0.15s ease'
                            }}
                          >
                            {t === 'PARTIAL' ? '⬤ Partial Withdrawal' : t === 'FULL' ? '◼ Full Closure' : <><RefreshCw size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Renew / Extend</>}
                          </button>
                        ))}
                      </div>

                      {/* PARTIAL / FULL FORM */}
                      {(wdActionType === 'PARTIAL' || wdActionType === 'FULL') && eligibility.eligible && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginTop: '18px' }}>
                          <div className="form-group">
                            <label className="form-label required">{wdActionType === 'FULL' ? 'CLOSURE AMOUNT (₹)' : 'AMOUNT TO WITHDRAW (₹) *'}</label>
                            <input
                              type="number"
                              step="any"
                              className="input-control"
                              placeholder="Enter withdrawal amount"
                              value={wdActionType === 'FULL' ? wdRemaining : wdAmount}
                              readOnly={wdActionType === 'FULL'}
                              style={{ backgroundColor: wdActionType === 'FULL' ? 'var(--bg-surface-secondary)' : undefined }}
                              onChange={(e) => { if (wdActionType === 'PARTIAL') setWdAmount(e.target.value); }}
                              max={wdRemaining}
                            />
                            {wdActionType === 'PARTIAL' && numWdAmount > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Remaining after withdrawal: <strong style={{ color: numWdAmount > wdRemaining ? 'var(--color-danger, #ef4444)' : 'var(--color-primary-accent)' }}>₹{Math.max(0, wdRemaining - numWdAmount).toLocaleString('en-IN')}</strong>
                                {numWdAmount > wdRemaining && <span style={{ color: 'var(--color-danger, #ef4444)', fontWeight: 700 }}> — Cannot exceed ₹{wdRemaining.toLocaleString('en-IN')}</span>}
                              </div>
                            )}
                          </div>

                          <div className="form-group">
                            <label className="form-label required">PAYMENT / SETTLEMENT METHOD *</label>
                            <select className="input-control" value={wdMode} onChange={(e) => { setWdMode(e.target.value as any); setWdTxRef(''); setWdBankName(''); }}>
                              <option value="Cash">Cash Account</option>
                              <option value="Bank">Bank Transfer</option>
                              <option value="UPI">UPI Payment</option>
                            </select>
                          </div>

                          {wdMode === 'Bank' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">BANK NAME</label>
                                <input type="text" className="input-control" placeholder="e.g. HDFC Bank" value={wdBankName} onChange={(e) => setWdBankName(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label required">UTR / TRANSACTION REFERENCE *</label>
                                <input type="text" className="input-control" placeholder="Enter Bank UTR Ref" value={wdTxRef} onChange={(e) => setWdTxRef(e.target.value)} />
                              </div>
                            </>
                          )}
                          {wdMode === 'UPI' && (
                            <>
                              <div className="form-group">
                                <label className="form-label required">UPI TRANSACTION ID / UTR *</label>
                                <input type="text" className="input-control" placeholder="Enter UPI Transaction Ref" value={wdTxRef} onChange={(e) => setWdTxRef(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">UPI VPA / ID (OPTIONAL)</label>
                                <input type="text" className="input-control" placeholder="e.g. name@upi" value={wdUpiId} onChange={(e) => setWdUpiId(e.target.value)} />
                              </div>
                            </>
                          )}
                          <div className="form-group">
                            <label className="form-label">REMARKS / NOTES</label>
                            <input type="text" className="input-control" placeholder="Maturity payout / Premature withdrawal" value={wdNotes} onChange={(e) => setWdNotes(e.target.value)} />
                          </div>
                        </div>
                      )}

                      {/* RENEW FORM */}
                      {wdActionType === 'RENEW' && (
                        <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', display: 'block', marginBottom: '8px' }}>RENEWAL PERIOD</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {[3, 6, 12, 24].map((m) => (
                                <button key={m} type="button"
                                  onClick={() => setRnPeriodMonths(m)}
                                  style={{
                                    padding: '8px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '13px',
                                    border: `2px solid ${rnPeriodMonths === m ? '#3b82f6' : 'var(--border-light)'}`,
                                    backgroundColor: rnPeriodMonths === m ? '#3b82f6' : '#ffffff',
                                    color: rnPeriodMonths === m ? '#ffffff' : 'var(--text-dark)',
                                    cursor: 'pointer'
                                  }}
                                >{m} Months</button>
                              ))}
                            </div>
                          </div>

                          {/* Renewal Preview */}
                          <div style={{ padding: '14px 18px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1.5px solid #93c5fd', fontSize: '13px' }}>
                            <div style={{ fontWeight: 800, color: '#1d4ed8', marginBottom: '10px', fontSize: '13px' }}>RENEWAL PREVIEW — {wdSelectedFD.fdNo}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>FD Number:</span><strong>{wdSelectedFD.fdNo}</strong></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Current Maturity:</span><strong>{wdSelectedFD.maturityDate}</strong></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Extension Period:</span><strong>{rnPeriodMonths} months</strong></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>New Maturity Date:</span><strong style={{ color: '#1d4ed8', fontSize: '14px' }}>{rnNewMaturity}</strong></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Interest Rate:</span><strong>{wdSelectedFD.interestRatePA}% p.a. (current rate)</strong></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Renewal Date:</span><strong>{formatFDDate(new Date())}</strong></div>
                            </div>
                          </div>

                          <div className="form-group" style={{ maxWidth: '400px' }}>
                            <label className="form-label">RENEWAL NOTES (OPTIONAL)</label>
                            <input type="text" className="input-control" placeholder="e.g. Customer requested extension" value={rnNotes} onChange={(e) => setRnNotes(e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Settlement Summary (withdrawal only) */}
                    {(wdActionType === 'PARTIAL' || wdActionType === 'FULL') && eligibility.eligible && (
                      <div style={{ padding: '14px 18px', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: '10px', border: '1px solid var(--border-light)', fontSize: '13px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '10px', fontSize: '12px' }}>SETTLEMENT SUMMARY — {wdSelectedFD.fdNo}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Original Principal:</span><strong>₹{wdSelectedFD.principal.toLocaleString('en-IN')}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Current Remaining:</span><strong>₹{wdRemaining.toLocaleString('en-IN')}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Withdrawal Amount:</span><strong style={{ color: 'var(--color-primary-accent, #059669)' }}>₹{wdEffectiveAmount.toLocaleString('en-IN')}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>New Remaining:</span><strong>₹{wdNewRemaining.toLocaleString('en-IN')}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Interest Paid to Date:</span><strong>₹{paidInterestForFD.toLocaleString('en-IN')}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Payment Method:</span><strong>{wdMode}{wdBankName ? ` — ${wdBankName}` : ''}{wdTxRef ? ` (${wdTxRef})` : ''}</strong></div>
                        </div>
                        {wdActionType === 'FULL' && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#fee2e2', borderRadius: '6px', fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>
                            ⚠ Full Closure: This FD will be permanently marked WITHDRAWN. No further interest or withdrawals will be possible.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setWdSelectedFD(null)}>← Cancel</button>
                      {wdActionType === 'RENEW' ? (
                        <button type="button" className="btn btn-primary" style={{ fontWeight: 800, padding: '10px 28px', backgroundColor: '#3b82f6', borderColor: '#3b82f6' }} onClick={handleRnConfirmOpen}>
                          <RefreshCw size={14} style={{ marginRight: '6px' }} />Confirm Renewal
                        </button>
                      ) : (
                        <button
                          type="button" className="btn btn-primary"
                          style={{ fontWeight: 800, padding: '10px 28px' }}
                          disabled={!eligibility.eligible || (wdActionType === 'PARTIAL' && (numWdAmount <= 0 || numWdAmount > wdRemaining))}
                          onClick={handleWdConfirm}
                        >
                          Confirm Withdrawal →
                        </button>
                      )}
                    </div>

                    {/* Withdrawal Confirm Modal */}
                    {wdShowConfirmModal && (
                      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '28px', borderRadius: '14px', backgroundColor: 'var(--bg-card)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '0 0 6px 0' }}>Confirm Fixed Deposit Withdrawal?</h3>
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px 0' }}>Please verify the details. This action cannot be undone.</p>
                          <div style={{ backgroundColor: 'var(--bg-surface-secondary)', padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13px', marginBottom: '18px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Customer:</span><strong>{wdSelectedCustomer?.name}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Customer ID:</span><strong>{getCanonicalCustomerId(wdSelectedCustomer!)}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>FD Number:</span><strong style={{ color: 'var(--color-primary-dark)' }}>{wdSelectedFD.fdNo}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Withdrawal Type:</span><strong>{wdActionType === 'FULL' ? 'Full Closure' : 'Partial Withdrawal'}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Amount:</span><strong style={{ color: 'var(--color-primary-accent, #059669)', fontSize: '15px' }}>₹{wdEffectiveAmount.toLocaleString('en-IN')}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Remaining After:</span><strong>₹{wdNewRemaining.toLocaleString('en-IN')}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Payment Method:</span><strong>{wdMode}{wdTxRef ? ` (${wdTxRef})` : ''}</strong></div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setWdShowConfirmModal(false)} disabled={wdProcessing}>Cancel</button>
                            <button type="button" className="btn btn-primary" style={{ fontWeight: 800 }} disabled={wdProcessing}
                              onClick={handleWdFinalConfirm}
                            >
                              {wdProcessing ? 'Processing...' : `Confirm Withdrawal ₹${wdEffectiveAmount.toLocaleString('en-IN')}`}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* WITHDRAWAL SUCCESS SCREEN & IMMEDIATE RECEIPT MODAL */}
                    {wdShowSuccessModal && lastWdReceipt && (
                      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '32px', borderRadius: '16px', backgroundColor: 'var(--bg-card)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' }}>
                          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '2px solid #a7f3d0' }}>
                            <CheckCircle2 size={36} />
                          </div>
                          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '0 0 6px 0' }}>✓ WITHDRAWAL COMPLETED</h2>
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
                            Withdrawal transaction and receipt have been recorded successfully.
                          </p>

                          <div style={{ backgroundColor: 'var(--bg-surface-secondary)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', textAlign: 'left', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                              <strong>{lastWdReceipt.depositorName}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Customer ID:</span>
                              <span className="badge badge-info" style={{ fontWeight: 700 }}>{lastWdReceipt.customerId || '—'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>FD Number:</span>
                              <strong style={{ color: 'var(--color-primary-dark)' }}>{lastWdReceipt.fdNo}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Withdrawal Amount:</span>
                              <strong style={{ color: 'var(--color-primary-accent, #059669)', fontSize: '15px' }}>₹{lastWdReceipt.principalAmount.toLocaleString('en-IN')}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Remaining Balance:</span>
                              <strong style={{ fontSize: '14px' }}>₹{(lastWdReceipt.remainingBalance ?? 0).toLocaleString('en-IN')}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Withdrawal ID:</span>
                              <strong style={{ color: 'var(--color-primary-dark)' }}>{lastWdReceipt.withdrawalId || '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Receipt No:</span>
                              <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '12px' }}>{lastWdReceipt.receiptNo || lastWdReceipt.receiptId || '—'}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ fontWeight: 700, padding: '9px 18px' }}
                              onClick={() => {
                                setViewingReceiptWd(lastWdReceipt);
                                setWdShowSuccessModal(false);
                              }}
                            >
                              <Eye size={14} style={{ marginRight: '6px' }} /> View Receipt
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontWeight: 700, padding: '9px 18px' }}
                              onClick={() => {
                                setViewingReceiptWd(lastWdReceipt);
                                setWdShowSuccessModal(false);
                                setTimeout(() => window.print(), 250);
                              }}
                            >
                              <Printer size={14} style={{ marginRight: '6px' }} /> Print Receipt
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontWeight: 700, padding: '9px 18px' }}
                              onClick={() => handleDownloadWdPdf(lastWdReceipt)}
                            >
                              <Download size={14} style={{ marginRight: '6px' }} /> Download PDF
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '9px 18px' }}
                              onClick={() => {
                                setWdShowSuccessModal(false);
                                setLastWdReceipt(null);
                                setWdSelectedFD(null);
                                setWdAmount('');
                                setWdType('PARTIAL');
                                setWdActionType('PARTIAL');
                                setWdMode('Cash');
                                setWdBankName('');
                                setWdTxRef('');
                                setWdUpiId('');
                                setWdNotes('');
                              }}
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Renewal Confirm Modal */}
                    {rnShowConfirmModal && (
                      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '28px', borderRadius: '14px', backgroundColor: 'var(--bg-card)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1d4ed8', margin: '0 0 6px 0' }}>Confirm FD Renewal?</h3>
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px 0' }}>The maturity date will be extended. This creates an auditable renewal record.</p>
                          <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13px', marginBottom: '18px', border: '1px solid #bfdbfe' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Customer:</span><strong>{wdSelectedCustomer?.name}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>FD Number:</span><strong style={{ color: '#1d4ed8' }}>{wdSelectedFD.fdNo}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Current Maturity:</span><strong>{wdSelectedFD.maturityDate}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Extension:</span><strong>{rnPeriodMonths} months</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>New Maturity Date:</span><strong style={{ color: '#1d4ed8', fontSize: '14px' }}>{rnNewMaturity}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Interest Rate:</span><strong>{wdSelectedFD.interestRatePA}% p.a.</strong></div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setRnShowConfirmModal(false)} disabled={rnProcessing}>Cancel</button>
                            <button type="button" className="btn btn-primary" style={{ fontWeight: 800, backgroundColor: '#3b82f6', borderColor: '#3b82f6' }} disabled={rnProcessing} onClick={handleRnFinalConfirm}>
                              {rnProcessing ? 'Processing...' : `Confirm Renewal → ${rnNewMaturity}`}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </>
        );
      })()}

      {/* SUBVIEW 6: WITHDRAWAL DISPLAY */}
      {activeSubTab === 'withdrawal-display' && (() => {
        const resolveWdCust = (w: typeof fdWithdrawals[0]) => {
          const found = customers.find(c => isMatchingCustomerId(w.customerId || '', c));
          return { name: found?.name || w.depositorName, custId: found ? getCanonicalCustomerId(found) : (w.customerId || '—'), phone: found?.phone || '' };
        };

        const q = wdDisplaySearch.toLowerCase().trim();
        const filteredWd = fdWithdrawals.filter(w => {
          const rc = resolveWdCust(w);
          const matchSearch = !q ||
            (w.withdrawalId || '').toLowerCase().includes(q) ||
            (w.receiptNo || '').toLowerCase().includes(q) ||
            (w.receiptId || '').toLowerCase().includes(q) ||
            w.fdNo.toLowerCase().includes(q) ||
            rc.custId.toLowerCase().includes(q) ||
            rc.name.toLowerCase().includes(q) ||
            rc.phone.includes(q);
          const isFullClosure = w.withdrawalType === 'FULL' || (w.remainingBalance ?? 1) === 0;
          const matchType = wdDisplayTypeFilter === 'ALL' || (wdDisplayTypeFilter === 'FULL' && isFullClosure) || (wdDisplayTypeFilter === 'PARTIAL' && !isFullClosure);
          const matchStatus = wdDisplayStatusFilter === 'ALL' || (w.status || 'COMPLETED') === wdDisplayStatusFilter;
          return matchSearch && matchType && matchStatus;
        });

        const totalRefunded = fdWithdrawals.reduce((s, w) => s + w.principalAmount, 0);
        const partialCount = fdWithdrawals.filter(w => w.withdrawalType === 'PARTIAL' || ((w.remainingBalance ?? 1) > 0)).length;
        const fullCount = fdWithdrawals.filter(w => w.withdrawalType === 'FULL' || (w.remainingBalance ?? 1) === 0).length;

        // Current Month withdrawals
        const currentMonthNumber = new Date().getMonth() + 1;
        const currentYearNumber = new Date().getFullYear();
        const currentMonthWds = fdWithdrawals.filter(w => {
          const parts = w.withdrawalDate.split(/[-/]/);
          if (parts.length === 3) {
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            return m === currentMonthNumber && y === currentYearNumber;
          }
          return false;
        });
        const currentMonthRefunded = currentMonthWds.reduce((s, w) => s + w.principalAmount, 0);

        return (
          <>
            <div className="card" style={{ padding: '24px' }}>
              <div className="card-header" style={{ marginBottom: '18px' }}>
                <div>
                  <h2 className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>Withdrawal &amp; Settlement Ledger</h2>
                  <p className="card-description">Complete history of all FD withdrawals, closures, and settlement receipts</p>
                </div>
              </div>

              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'TOTAL WITHDRAWALS', value: fdWithdrawals.length, color: 'var(--color-primary-dark)' },
                  { label: 'TOTAL REFUNDED', value: `₹${totalRefunded.toLocaleString('en-IN')}`, color: 'var(--color-primary-accent, #059669)' },
                  { label: 'PARTIAL WITHDRAWALS', value: partialCount, color: '#d97706' },
                  { label: 'FULL CLOSURES', value: fullCount, color: '#dc2626' },
                  { label: 'CURRENT MONTH', value: `₹${currentMonthRefunded.toLocaleString('en-IN')} (${currentMonthWds.length})`, color: '#7c3aed' },
                  { label: 'TOTAL RENEWALS', value: fdRenewals.length, color: '#2563eb' }
                ].map((card) => (
                  <div key={card.label} style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.05em' }}>{card.label}</div>
                    <div style={{ fontSize: '19px', fontWeight: 800, color: card.color }}>{card.value}</div>
                  </div>
                ))}
              </div>

              {/* View Switcher: Withdrawals vs Renewals */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => setWdDisplayTab('WITHDRAWALS')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: wdDisplayTab === 'WITHDRAWALS' ? 'var(--color-primary-dark)' : 'transparent',
                    color: wdDisplayTab === 'WITHDRAWALS' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  📄 Withdrawals &amp; Closures ({fdWithdrawals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWdDisplayTab('RENEWALS')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: wdDisplayTab === 'RENEWALS' ? '#2563eb' : 'transparent',
                    color: wdDisplayTab === 'RENEWALS' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  <RefreshCw size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Renewal History ({fdRenewals.length})
                </button>
              </div>

              {wdDisplayTab === 'WITHDRAWALS' && (
                <>
                  {/* Search + Filters */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
                      <input type="text" className="input-control" style={{ height: '38px', paddingLeft: '34px', fontSize: '13px' }}
                        placeholder="Search by Receipt No (FDR-001), WD ID (WD-001), FD No, Customer ID, Name, Mobile..."
                        value={wdDisplaySearch} onChange={(e) => setWdDisplaySearch(e.target.value)} />
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      {wdDisplaySearch && <button onClick={() => setWdDisplaySearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(['ALL', 'PARTIAL', 'FULL'] as const).map(f => (
                        <button key={f} type="button"
                          onClick={() => setWdDisplayTypeFilter(f)}
                          className={wdDisplayTypeFilter === f ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                          style={{ fontSize: '12px', fontWeight: 700 }}>
                          {f === 'ALL' ? 'All Types' : f === 'PARTIAL' ? '⬤ Partial' : '◼ Full'}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(['ALL', 'COMPLETED', 'PENDING', 'CANCELLED'] as const).map(f => (
                        <button key={f} type="button"
                          onClick={() => setWdDisplayStatusFilter(f)}
                          className={wdDisplayStatusFilter === f ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                          style={{ fontSize: '12px', fontWeight: 700 }}>
                          {f === 'ALL' ? 'All Status' : f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="table-container" style={{ width: '100%', overflowX: 'auto' }}>
                    <table className="custom-table" style={{ minWidth: '1200px', width: '100%', tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '100px' }}>RECEIPT NO</th>
                          <th style={{ width: '90px' }}>WD ID</th>
                          <th style={{ width: '100px' }}>DATE</th>
                          <th style={{ width: '130px' }}>CUSTOMER</th>
                          <th style={{ width: '100px' }}>CUST ID</th>
                          <th style={{ width: '85px' }}>FD NO</th>
                          <th style={{ width: '115px' }}>ORIGINAL BAL</th>
                          <th style={{ width: '120px' }}>WITHDRAWN AMT</th>
                          <th style={{ width: '110px' }}>REMAINING BAL</th>
                          <th style={{ width: '95px' }}>TYPE</th>
                          <th style={{ width: '100px' }}>PAYMENT MODE</th>
                          <th style={{ width: '95px' }}>STATUS</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWd.length > 0 ? (
                          filteredWd.map((w) => {
                            const rc = resolveWdCust(w);
                            const isFullClosure = w.withdrawalType === 'FULL' || (w.remainingBalance ?? 1) === 0;
                            const wdStatus = w.status || 'COMPLETED';
                            const origBal = w.originalPrincipal ?? (w.principalAmount + (w.remainingBalance ?? 0));
                            return (
                              <tr key={w.id}>
                                <td>
                                  <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.5px' }}>
                                    {w.receiptNo || w.receiptId || '—'}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)', fontSize: '12px' }}>{w.withdrawalId || '—'}</td>
                                <td>{w.withdrawalDate}</td>
                                <td style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rc.name}>{rc.name}</td>
                                <td><span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 600 }}>{rc.custId}</span></td>
                                <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{w.fdNo}</td>
                                <td style={{ fontWeight: 600 }}>₹{origBal.toLocaleString('en-IN')}</td>
                                <td style={{ fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}>₹{w.principalAmount.toLocaleString('en-IN')}</td>
                                <td style={{ fontWeight: 700 }}>₹{(w.remainingBalance ?? 0).toLocaleString('en-IN')}</td>
                                <td><span className={`badge ${isFullClosure ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '10.5px', fontWeight: 800 }}>{isFullClosure ? '◼ FULL' : '⬤ PARTIAL'}</span></td>
                                <td>{w.mode}{w.bankName ? ` (${w.bankName})` : ''}</td>
                                <td><span className={`badge ${wdStatus === 'COMPLETED' ? 'badge-success' : wdStatus === 'CANCELLED' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '11px', fontWeight: 700 }}>{wdStatus}</span></td>
                                <td>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: '11px', padding: '4px 7px' }}
                                      title="View Receipt Voucher"
                                      onClick={() => setViewingReceiptWd(w)}
                                    >
                                      <Eye size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: '11px', padding: '4px 7px' }}
                                      title="Print Receipt"
                                      onClick={() => {
                                        setViewingReceiptWd(w);
                                        setTimeout(() => window.print(), 250);
                                      }}
                                    >
                                      <Printer size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: '11px', padding: '4px 7px' }}
                                      title="Download PDF"
                                      onClick={() => handleDownloadWdPdf(w)}
                                    >
                                      <Download size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={13} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                              {fdWithdrawals.length === 0 ? 'No withdrawal records yet.' : 'No records match your search / filter.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {wdDisplayTab === 'RENEWALS' && (
                <div className="table-container" style={{ width: '100%', overflowX: 'auto' }}>
                  <table className="custom-table" style={{ minWidth: '1000px', width: '100%', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '90px' }}>RENEWAL ID</th>
                        <th style={{ width: '100px' }}>DATE</th>
                        <th style={{ width: '80px' }}>FD NO</th>
                        <th style={{ width: '150px' }}>CUSTOMER</th>
                        <th style={{ width: '110px' }}>CUST ID</th>
                        <th style={{ width: '120px' }}>PREV MATURITY</th>
                        <th style={{ width: '90px' }}>EXTENSION</th>
                        <th style={{ width: '120px' }}>NEW MATURITY</th>
                        <th style={{ width: '90px' }}>RATE</th>
                        <th style={{ width: '90px' }}>STATUS</th>
                        <th style={{ width: '160px' }}>REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fdRenewals.length > 0 ? (
                        fdRenewals.map((r) => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 800, color: '#2563eb', fontSize: '12px' }}>{r.renewalId}</td>
                            <td>{r.renewalDate}</td>
                            <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{r.fdNo}</td>
                            <td style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.depositorName}>{r.depositorName}</td>
                            <td><span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 600 }}>{r.customerId}</span></td>
                            <td style={{ color: 'var(--text-muted)' }}>{r.previousMaturityDate}</td>
                            <td><span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 700 }}>+{r.renewalPeriodMonths}m</span></td>
                            <td style={{ fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}>{r.newMaturityDate}</td>
                            <td>{r.interestRateAtRenewal}% p.a.</td>
                            <td><span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 700 }}>{r.status}</span></td>
                            <td style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes || ''}>{r.notes || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            No Fixed Deposit renewals recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* DEDICATED FIXED DEPOSIT WITHDRAWAL RECEIPT VOUCHER MODAL */}
            {viewingReceiptWd && (() => {
              const custObj = customers.find(c => isMatchingCustomerId(viewingReceiptWd.customerId, c));
              const custName = custObj?.name || viewingReceiptWd.depositorName;
              const custId = custObj ? getCanonicalCustomerId(custObj) : (viewingReceiptWd.customerId || '—');
              const custPhone = custObj?.phone || viewingReceiptWd.customerPhone || '';
              const custAddress = custObj?.currentAddress || 'Tamil Nadu';
              const isFullClosure = viewingReceiptWd.withdrawalType === 'FULL' || (viewingReceiptWd.remainingBalance ?? 1) === 0;

              // Collateral items & photos resolved from withdrawal or parent FD
              const targetFD = fixedDeposits.find(f => f.fdNo === viewingReceiptWd.fdNo || f.id === viewingReceiptWd.fdId);
              const itemsList: OrnamentItem[] = (viewingReceiptWd.items && viewingReceiptWd.items.length > 0) ? viewingReceiptWd.items : (targetFD?.items || []);
              const photosList: string[] = (viewingReceiptWd.photos && viewingReceiptWd.photos.length > 0) ? viewingReceiptWd.photos : (targetFD?.photos || []);

              return (
                <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
                  {/* Global Print-only styles */}
                  <style>
                    {`
                      @media print {
                        body * {
                          visibility: hidden !important;
                        }
                        #fd-withdrawal-receipt-voucher,
                        #fd-withdrawal-receipt-voucher * {
                          visibility: visible !important;
                        }
                        #fd-withdrawal-receipt-voucher {
                          position: absolute !important;
                          left: 0 !important;
                          top: 0 !important;
                          width: 100% !important;
                          max-width: 100% !important;
                          margin: 0 !important;
                          padding: 15px !important;
                          box-shadow: none !important;
                          border: none !important;
                          background: #ffffff !important;
                        }
                        .no-print {
                          display: none !important;
                        }
                      }
                    `}
                  </style>

                  <div className="card" style={{ width: '100%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto', padding: '0', borderRadius: '14px', backgroundColor: 'var(--bg-card)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
                    {/* Top Action Bar (hidden on print) */}
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '11px' }}>
                          {viewingReceiptWd.receiptNo || 'FDR-001'}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                          Fixed Deposit Withdrawal Receipt
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontWeight: 700 }}
                          onClick={() => window.print()}
                        >
                          <Printer size={13} style={{ marginRight: '5px' }} /> Print
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontWeight: 700 }}
                          onClick={() => handleDownloadWdPdf(viewingReceiptWd)}
                        >
                          <Download size={13} style={{ marginRight: '5px' }} /> Download PDF
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                          onClick={() => setViewingReceiptWd(null)}
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>

                    {/* Printable Voucher Body */}
                    <div id="fd-withdrawal-receipt-voucher" style={{ padding: '32px 36px', backgroundColor: '#ffffff', color: '#0f172a' }}>
                      {/* Company Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '2.5px solid var(--color-primary-dark)' }}>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                          <KKVLogo size={54} />
                          <div>
                            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: 0, letterSpacing: '0.5px' }}>
                              KKV GOLD FINANCE
                            </h1>
                            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                              MAIN BRANCH &mdash; 104 G.S.T Road, Chennai - 600045 | Ph: +91 44 2233 4455
                            </p>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                              Reg No: TN-CHE-2018-GF492 | GSTIN: 33AAAAA0000A1Z5
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ backgroundColor: 'var(--color-primary-dark)', color: '#ffffff', fontWeight: 800, fontSize: '11.5px', padding: '5px 12px', borderRadius: '4px', letterSpacing: '0.5px', display: 'inline-block' }}>
                            FIXED DEPOSIT WITHDRAWAL RECEIPT
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Authorized Non-Banking Gold Finance
                          </div>
                        </div>
                      </div>

                      {/* Meta Highlight Strip */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '18px 0', padding: '12px 18px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, display: 'block' }}>RECEIPT NUMBER</span>
                          <strong style={{ color: 'var(--color-primary-dark)', fontSize: '15px' }}>{viewingReceiptWd.receiptNo || viewingReceiptWd.receiptId || 'FDR-001'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, display: 'block' }}>WITHDRAWAL ID</span>
                          <strong style={{ color: 'var(--color-primary-dark)', fontSize: '15px' }}>{viewingReceiptWd.withdrawalId || 'WD-001'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, display: 'block' }}>DATE</span>
                          <strong style={{ fontSize: '14px' }}>{viewingReceiptWd.withdrawalDate}</strong>
                        </div>
                      </div>

                      {/* Customer Details */}
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>
                          CUSTOMER DETAILS
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Customer Name:</span><strong>{custName}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Customer ID:</span><span className="badge badge-info" style={{ fontWeight: 700 }}>{custId}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Mobile Number:</span><strong>+91 {custPhone}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Address:</span><span>{custAddress}</span></div>
                        </div>
                      </div>

                      {/* Fixed Deposit Details */}
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>
                          FIXED DEPOSIT DETAILS
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>FD Number:</span><strong style={{ color: 'var(--color-primary-dark)' }}>{viewingReceiptWd.fdNo}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Deposit Date:</span><strong>{targetFD?.depositDate || viewingReceiptWd.withdrawalDate}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Original Principal:</span><strong>₹{(viewingReceiptWd.originalPrincipal ?? (viewingReceiptWd.principalAmount + (viewingReceiptWd.remainingBalance ?? 0))).toLocaleString('en-IN')}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Balance Before Withdrawal:</span><strong>₹{(viewingReceiptWd.balanceBefore ?? (viewingReceiptWd.principalAmount + (viewingReceiptWd.remainingBalance ?? 0))).toLocaleString('en-IN')}</strong></div>
                        </div>
                      </div>

                      {/* Withdrawal Settlement Details */}
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>
                          WITHDRAWAL SETTLEMENT DETAILS
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Withdrawal Type:</span>
                            <span className={`badge ${isFullClosure ? 'badge-danger' : 'badge-warning'}`} style={{ fontWeight: 800, fontSize: '11px' }}>
                              {isFullClosure ? 'FULL CLOSURE' : 'PARTIAL WITHDRAWAL'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Withdrawal Amount:</span>
                            <strong style={{ color: 'var(--color-primary-accent, #059669)', fontSize: '16px' }}>₹{viewingReceiptWd.principalAmount.toLocaleString('en-IN')}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Remaining Balance:</span>
                            <strong style={{ fontSize: '14px', color: isFullClosure ? 'var(--text-muted)' : 'var(--color-primary-dark)' }}>
                              ₹{(viewingReceiptWd.remainingBalance ?? 0).toLocaleString('en-IN')}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Payment Method:</span>
                            <strong>{viewingReceiptWd.mode}{viewingReceiptWd.bankName ? ` — ${viewingReceiptWd.bankName}` : ''}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Transaction Reference:</span>
                            <strong>{viewingReceiptWd.transactionReference || 'Cash Settlement'}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Withdrawal Date:</span>
                            <strong>{viewingReceiptWd.withdrawalDate}</strong>
                          </div>
                        </div>
                      </div>

                      {/* PLEDGED COLLATERAL ORNAMENTS TABLE */}
                      {itemsList.length > 0 && (
                        <div style={{ marginBottom: '18px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>
                            PLEDGED COLLATERAL / ORNAMENTS
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f8fafc' }}>
                                <th style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Item Description</th>
                                <th style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center', width: '50px' }}>Qty</th>
                                <th style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center', width: '70px' }}>Purity</th>
                                <th style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'right', width: '90px' }}>Gross Wt</th>
                                <th style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'right', width: '90px' }}>Net Wt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemsList.map((it, idx) => (
                                <tr key={it.id || idx}>
                                  <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', fontWeight: 600 }}>{it.item}</td>
                                  <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{it.qty}</td>
                                  <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{it.purity}</td>
                                  <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{it.grossWeight}g</td>
                                  <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 700 }}>{it.netWeight}g</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* PLEDGED COLLATERAL PHOTOS */}
                      {photosList.length > 0 && (
                        <div style={{ marginBottom: '18px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>
                            PLEDGED ORNAMENT PHOTOS
                          </div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {photosList.map((p, pIdx) => (
                              <div
                                key={pIdx}
                                onClick={() => {
                                  setWdLightboxPhotoIndex(pIdx);
                                  setWdLightboxZoom(1);
                                }}
                                style={{
                                  width: '80px',
                                  height: '80px',
                                  borderRadius: '8px',
                                  border: '1.5px solid #cbd5e1',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
                                }}
                                title="Click to view full size"
                              >
                                <img src={p} alt={`Pledged ornament ${pIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Audit & Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px', marginBottom: '24px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                          <strong style={{ color: '#059669' }}>✓ COMPLETED</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Processed By: </span>
                          <strong>{viewingReceiptWd.processedBy || 'Admin'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Timestamp: </span>
                          <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Signatures */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '28px', borderTop: '1px dashed #cbd5e1', fontSize: '12px', color: '#64748b' }}>
                        <div style={{ textAlign: 'center', minWidth: '160px' }}>
                          <div style={{ borderBottom: '1px solid #94a3b8', width: '140px', margin: '0 auto 6px auto' }}></div>
                          Customer Signature
                        </div>
                        <div style={{ textAlign: 'center', minWidth: '160px' }}>
                          <div style={{ borderBottom: '1px solid #94a3b8', width: '140px', margin: '0 auto 6px auto' }}></div>
                          Authorized Signatory (KKV)
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar (hidden on print) */}
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', backgroundColor: '#f8fafc' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setViewingReceiptWd(null)}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleDownloadWdPdf(viewingReceiptWd)}
                      >
                        <Download size={14} style={{ marginRight: '6px' }} /> Download PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => window.print()}
                      >
                        <Printer size={14} style={{ marginRight: '6px' }} /> Print Voucher
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* LIGHTBOX MODAL FOR PLEDGED GOLD PHOTOS */}
            {wdLightboxPhotoIndex !== null && viewingReceiptWd && (() => {
              const targetFD = fixedDeposits.find(f => f.fdNo === viewingReceiptWd.fdNo || f.id === viewingReceiptWd.fdId);
              const photos: string[] = (viewingReceiptWd.photos && viewingReceiptWd.photos.length > 0) ? viewingReceiptWd.photos : (targetFD?.photos || []);
              if (photos.length === 0) return null;
              const photo = photos[wdLightboxPhotoIndex] || photos[0];

              return (
                <div
                  className="modal-backdrop"
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.88)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    padding: '20px'
                  }}
                  onClick={() => setWdLightboxPhotoIndex(null)}
                >
                  {/* Top Bar Controls */}
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '900px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: '#ffffff',
                      marginBottom: '12px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      Pledged Ornament Photo {wdLightboxPhotoIndex + 1} of {photos.length}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#fff', borderColor: '#475569', backgroundColor: 'rgba(255,255,255,0.1)' }}
                        onClick={() => setWdLightboxZoom((z) => Math.min(3, z + 0.25))}
                        title="Zoom In"
                      >
                        <ZoomIn size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#fff', borderColor: '#475569', backgroundColor: 'rgba(255,255,255,0.1)' }}
                        onClick={() => setWdLightboxZoom((z) => Math.max(0.5, z - 0.25))}
                        title="Zoom Out"
                      >
                        <ZoomOut size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#fff', borderColor: '#475569', backgroundColor: 'rgba(255,255,255,0.1)' }}
                        onClick={() => setWdLightboxZoom(1)}
                        title="Reset Zoom"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#fff', borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.2)' }}
                        onClick={() => setWdLightboxPhotoIndex(null)}
                        title="Close"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Main Image Container */}
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      maxWidth: '90vw',
                      maxHeight: '80vh',
                      overflow: 'hidden'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {photos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setWdLightboxPhotoIndex((prev) => (prev! > 0 ? prev! - 1 : photos.length - 1))}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          zIndex: 10,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '42px',
                          height: '42px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <ChevronLeft size={24} />
                      </button>
                    )}

                    <img
                      src={photo}
                      alt="Pledged Gold Full"
                      style={{
                        maxWidth: '85vw',
                        maxHeight: '75vh',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        transform: `scale(${wdLightboxZoom})`,
                        transition: 'transform 0.15s ease'
                      }}
                    />

                    {photos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setWdLightboxPhotoIndex((prev) => (prev! < photos.length - 1 ? prev! + 1 : 0))}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          zIndex: 10,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '42px',
                          height: '42px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <ChevronRight size={24} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        );
      })()}
    </div>
  );
};
