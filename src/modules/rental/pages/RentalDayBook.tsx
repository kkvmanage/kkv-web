import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Download,
  Printer,
  Plus,
  Search,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CheckCircle2,
  Layers,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Banknote
} from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import {
  RentalDayBookEntry,
  RentalDayBookSummary,
  RentalComplex,
  RentalShop,
  RentalTransactionType,
  PaymentMode
} from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { useApp } from '../../../context/AppContext';

export const RentalDayBook: React.FC = () => {
  const { hasPermission, showToast } = useApp();

  // Ledger state
  const [entries, setEntries] = useState<RentalDayBookEntry[]>([]);
  const [summary, setSummary] = useState<RentalDayBookSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalEntries, setTotalEntries] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // Metadata
  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [shops, setShops] = useState<RentalShop[]>([]);

  // Quick Date presets
  const todayStr = new Date().toISOString().substring(0, 10);
  const [quickDatePreset, setQuickDatePreset] = useState<
    'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'
  >('THIS_MONTH');

  // Date filters (defaults to current month)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState(todayStr);

  // Other filters
  const [selectedComplex, setSelectedComplex] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Manual Entry Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualDate, setManualDate] = useState(todayStr);
  const [manualType, setManualType] = useState<'MANUAL_INCOME' | 'MANUAL_EXPENSE'>('MANUAL_INCOME');
  const [manualParticulars, setManualParticulars] = useState('');
  const [manualAmount, setManualAmount] = useState<number | ''>('');
  const [manualMode, setManualMode] = useState<PaymentMode>('CASH');
  const [manualCashAmount, setManualCashAmount] = useState<number | ''>('');
  const [manualGpayAmount, setManualGpayAmount] = useState<number | ''>('');
  const [manualComplexId, setManualComplexId] = useState('');
  const [manualShopId, setManualShopId] = useState('');
  const [manualCategory, setManualCategory] = useState('Maintenance');
  const [manualNotes, setManualNotes] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Set date ranges according to preset
  const applyPreset = (preset: 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM') => {
    setQuickDatePreset(preset);
    const now = new Date();

    if (preset === 'TODAY') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().substring(0, 10);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === 'THIS_WEEK') {
      const first = new Date(now.setDate(now.getDate() - now.getDay()));
      setFromDate(first.toISOString().substring(0, 10));
      setToDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const d = new Date();
      setFromDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
      setToDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
      setFromDate(`${year}-${month}-01`);
      setToDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  // Fetch initial dropdown metadata
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          rentalApi.getComplexes(),
          rentalApi.getShops()
        ]);
        if (cRes.success && cRes.data) setComplexes(cRes.data);
        if (sRes.success && sRes.data) setShops(sRes.data);
      } catch (e) {
        console.error('Failed to load complexes or shops for Day Book filter:', e);
      }
    };
    fetchMeta();
  }, []);

  // Fetch Day Book data from backend
  const fetchDayBook = async () => {
    setLoading(true);
    try {
      const res = await rentalApi.getDayBook({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        complexId: selectedComplex || undefined,
        transactionType: selectedType !== 'ALL' ? (selectedType as RentalTransactionType) : undefined,
        paymentMode: selectedMode !== 'ALL' ? selectedMode : undefined,
        search: search.trim() || undefined,
        page,
        limit
      });

      if (res.success && res.data) {
        setEntries(res.data.entries || []);
        setSummary(res.data.summary || null);
        setTotalEntries(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        showToast(res.message || 'Failed to fetch Day Book', 'error');
      }
    } catch (err: any) {
      console.error('Error fetching Day Book:', err);
      showToast(err.message || 'Error fetching Day Book', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayBook();
  }, [fromDate, toDate, selectedComplex, selectedType, selectedMode, page, limit]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDayBook();
  };

  const handleResetFilters = () => {
    applyPreset('THIS_MONTH');
    setSelectedComplex('');
    setSelectedType('ALL');
    setSelectedMode('ALL');
    setSearch('');
    setPage(1);
  };

  // Helper formatting
  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return '₹0';
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  // Filter shops available for selected complex in manual modal
  const filteredShopsForModal = useMemo(() => {
    if (!manualComplexId) return shops;
    return shops.filter((s) => s.complexId === manualComplexId);
  }, [shops, manualComplexId]);

  // Handle Manual Entry Submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualParticulars.trim()) {
      showToast('Please provide a description/particulars', 'error');
      return;
    }
    const amt = Number(manualAmount);
    if (!amt || amt <= 0) {
      showToast('Please provide a valid amount > 0', 'error');
      return;
    }

    let cash = 0;
    let gpay = 0;
    if (manualMode === 'CASH') {
      cash = amt;
    } else if (manualMode === 'GPAY') {
      gpay = amt;
    } else {
      cash = Number(manualCashAmount) || 0;
      gpay = Number(manualGpayAmount) || 0;
      if (cash + gpay !== amt) {
        showToast(`Cash (₹${cash}) + GPAY (₹${gpay}) must equal total amount (₹${amt})`, 'error');
        return;
      }
    }

    setIsSubmittingManual(true);
    try {
      const res = await rentalApi.createManualDayBookEntry({
        date: manualDate,
        transactionType: manualType,
        particulars: manualParticulars.trim(),
        amount: amt,
        paymentMode: manualMode,
        cashAmount: cash,
        gpayAmount: gpay,
        complexId: manualComplexId || undefined,
        shopId: manualShopId || undefined,
        category: manualCategory || undefined,
        notes: manualNotes.trim() || undefined
      });

      if (res.success) {
        showToast('Manual Day Book entry recorded successfully', 'success');
        setShowManualModal(false);
        // Reset modal form
        setManualParticulars('');
        setManualAmount('');
        setManualCashAmount('');
        setManualGpayAmount('');
        setManualNotes('');
        fetchDayBook();
      } else {
        showToast(res.message || 'Failed to record entry', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error recording entry', 'error');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!entries.length) {
      showToast('No entries to export', 'info');
      return;
    }

    const headers = [
      'Entry ID',
      'Date',
      'Complex',
      'Shop / Tenant',
      'Particulars',
      'Type',
      'Payment Mode',
      'Cash (₹)',
      'GPAY (₹)',
      'Debit (₹ Out)',
      'Credit (₹ In)',
      'Running Balance (₹)',
      'Notes'
    ];

    const rows = entries.map((e) => [
      `"${e.entryId}"`,
      `"${e.date}"`,
      `"${e.complexName || 'General / All'}"`,
      `"${e.shopNumber ? `${e.shopNumber} - ${e.tenantName || ''}` : '—'}"`,
      `"${e.particulars.replace(/"/g, '""')}"`,
      `"${e.transactionType}"`,
      `"${e.paymentMode}"`,
      e.cashAmount || 0,
      e.gpayAmount || 0,
      e.debit || 0,
      e.credit || 0,
      e.runningBalance || 0,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rental_DayBook_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Rental Day Book CSV exported successfully', 'success');
  };

  // Print Statement
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-content print-container">
      {/* Header */}
      <RentalHeader
        title="Rental Day Book"
        subtitle="Complete chronological ledger of commercial rental income, maintenance expenses, cash/online splits, and running balances"
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportCSV}
              title="Download CSV report"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrint}
              title="Print official Day Book statement"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
            {hasPermission('rental', 'create') && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowManualModal(true)}
              >
                <Plus size={15} />
                <span>+ Manual Entry</span>
              </button>
            )}
          </div>
        }
      />

      {/* Metric Cards Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        {/* Opening Balance */}
        <div
          className="metric-card"
          style={{
            background: 'var(--bg-surface)',
            borderRadius: '12px',
            padding: '18px',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Opening Balance
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Wallet size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {formatCurrency(summary?.openingBalance)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            Prior to {fromDate || 'beginning'}
          </div>
        </div>

        {/* Total Income / Credits */}
        <div
          className="metric-card"
          style={{
            background: 'var(--bg-surface)',
            borderRadius: '12px',
            padding: '18px',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>
              Total Income (Credit)
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginBottom: '4px' }}>
            {formatCurrency(summary?.totalIncome)}
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>Cash: <strong>{formatCurrency(summary?.cashIncome)}</strong></span>
            <span>•</span>
            <span>GPAY: <strong>{formatCurrency(summary?.gpayIncome)}</strong></span>
          </div>
        </div>

        {/* Total Expenses / Debits */}
        <div
          className="metric-card"
          style={{
            background: 'var(--bg-surface)',
            borderRadius: '12px',
            padding: '18px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626' }}>
              Total Expenses (Debit)
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444', marginBottom: '4px' }}>
            {formatCurrency(summary?.totalExpense)}
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>Cash: <strong>{formatCurrency(summary?.cashExpense)}</strong></span>
            <span>•</span>
            <span>GPAY: <strong>{formatCurrency(summary?.gpayExpense)}</strong></span>
          </div>
        </div>

        {/* Closing Balance */}
        <div
          className="metric-card"
          style={{
            background: 'var(--bg-surface)',
            borderRadius: '12px',
            padding: '18px',
            border: '1px solid var(--primary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
              Closing Balance
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--primary-subtle, rgba(217, 119, 6, 0.12))',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {formatCurrency(summary?.closingBalance)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>Net Period Cashflow:</span>
            <strong
              style={{
                color: (summary?.netCashFlow || 0) >= 0 ? '#10b981' : '#ef4444'
              }}
            >
              {(summary?.netCashFlow || 0) >= 0 ? '+' : ''}
              {formatCurrency(summary?.netCashFlow)}
            </strong>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="no-print"
        style={{
          background: 'var(--bg-surface)',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px'
        }}
      >
        {/* Quick Date Presets */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4px' }}>
            Period:
          </span>
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'YESTERDAY', label: 'Yesterday' },
            { id: 'THIS_WEEK', label: 'This Week' },
            { id: 'THIS_MONTH', label: 'This Month' },
            { id: 'LAST_MONTH', label: 'Last Month' },
            { id: 'CUSTOM', label: 'Custom Range' }
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id as any)}
              className={`btn btn-sm ${
                quickDatePreset === preset.id ? 'btn-primary' : 'btn-secondary'
              }`}
              style={{
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '12px'
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Multi-Filter Row */}
        <form onSubmit={handleSearchSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px',
              alignItems: 'flex-end'
            }}
          >
            {/* From Date */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setQuickDatePreset('CUSTOM');
                }}
                className="form-control"
                style={{ height: '36px', fontSize: '13px' }}
              />
            </div>

            {/* To Date */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setQuickDatePreset('CUSTOM');
                }}
                className="form-control"
                style={{ height: '36px', fontSize: '13px' }}
              />
            </div>

            {/* Complex */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Complex
              </label>
              <select
                value={selectedComplex}
                onChange={(e) => setSelectedComplex(e.target.value)}
                className="form-control"
                style={{ height: '36px', fontSize: '13px' }}
              >
                <option value="">All Complexes</option>
                {complexes.map((c) => (
                  <option key={c.id} value={c.complexId}>
                    {c.complexName} ({c.complexId})
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Type */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Transaction Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="form-control"
                style={{ height: '36px', fontSize: '13px' }}
              >
                <option value="ALL">All Types</option>
                <option value="RENT_PAYMENT">Rent Payments (Credit)</option>
                <option value="EXPENSE">Expenses (Debit)</option>
                <option value="MANUAL_INCOME">Manual Income</option>
                <option value="MANUAL_EXPENSE">Manual Expense</option>
              </select>
            </div>

            {/* Payment Mode */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Payment Mode
              </label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="form-control"
                style={{ height: '36px', fontSize: '13px' }}
              >
                <option value="ALL">All Modes</option>
                <option value="CASH">Cash Only</option>
                <option value="GPAY">GPAY / UPI Only</option>
                <option value="BOTH">Split (Both)</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Search Keyword
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Tenant, Shop, Notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-control"
                  style={{ height: '36px', fontSize: '13px', paddingLeft: '32px' }}
                />
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)'
                  }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: '36px', padding: '0 16px', fontSize: '13px' }}
              >
                Filter
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetFilters}
                style={{ height: '36px', padding: '0 12px' }}
                title="Reset all filters"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Complex Breakdown Pills (if active) */}
      {summary?.complexSummaries && summary.complexSummaries.length > 0 && (
        <div
          className="no-print"
          style={{
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '10px',
            marginBottom: '16px'
          }}
        >
          {summary.complexSummaries.map((cs) => (
            <div
              key={cs.complexId}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 14px',
                minWidth: '200px',
                flexShrink: 0
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {cs.complexName}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span>In: <strong style={{ color: '#10b981' }}>{formatCurrency(cs.income)}</strong></span>
                <span>Out: <strong style={{ color: '#ef4444' }}>{formatCurrency(cs.expense)}</strong></span>
                <span>Net: <strong style={{ color: cs.net >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(cs.net)}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ledger Table Section */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Chronological Transaction Ledger
            </h3>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'var(--bg-muted)',
                color: 'var(--text-secondary)',
                fontWeight: 600
              }}
            >
              {totalEntries} record{totalEntries === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Showing Page {page} of {totalPages}
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Date & Ref</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Complex & Unit</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Particulars</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Type</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Mode</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                  Debit (₹ Out)
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                  Credit (₹ In)
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                  Running Balance (₹)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance Row if filtered */}
              {summary && page === 1 && (
                <tr style={{ background: 'rgba(99, 102, 241, 0.04)', fontStyle: 'italic', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {fromDate || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>—</td>
                  <td colSpan={3} style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    [ OPENING BALANCE B/F ]
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>—</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>—</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatCurrency(summary.openingBalance)}
                  </td>
                </tr>
              )}

              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</div> Loading Rental Day Book...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                    No rental transactions found for the selected period and criteria.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isCredit = entry.credit > 0;
                  const isDebit = entry.debit > 0;

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      {/* Date & Ref */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.date}</div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: 'var(--text-tertiary)'
                          }}
                        >
                          {entry.entryId}
                        </span>
                      </td>

                      {/* Complex & Unit */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {entry.complexName || 'General'}
                        </div>
                        {entry.shopNumber ? (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Shop #{entry.shopNumber} {entry.tenantName ? `(${entry.tenantName})` : ''}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>All Complex Units</div>
                        )}
                      </td>

                      {/* Particulars */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', maxWidth: '300px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {entry.particulars}
                        </div>
                        {entry.category && (
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'var(--bg-muted)',
                              color: 'var(--text-secondary)',
                              marginTop: '2px',
                              marginRight: '6px'
                            }}
                          >
                            {entry.category}
                          </span>
                        )}
                        {entry.notes && (
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                            {entry.notes}
                          </span>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        {entry.transactionType === 'RENT_PAYMENT' && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#059669',
                              display: 'inline-block'
                            }}
                          >
                            Rent Collection
                          </span>
                        )}
                        {entry.transactionType === 'EXPENSE' && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#dc2626',
                              display: 'inline-block'
                            }}
                          >
                            Expense
                          </span>
                        )}
                        {entry.transactionType === 'MANUAL_INCOME' && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#2563eb',
                              display: 'inline-block'
                            }}
                          >
                            Manual Income
                          </span>
                        )}
                        {entry.transactionType === 'MANUAL_EXPENSE' && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#d97706',
                              display: 'inline-block'
                            }}
                          >
                            Manual Expense
                          </span>
                        )}
                      </td>

                      {/* Payment Mode */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {entry.paymentMode === 'CASH' && <Banknote size={14} color="#10b981" />}
                          {entry.paymentMode === 'GPAY' && <CreditCard size={14} color="#6366f1" />}
                          {entry.paymentMode === 'BOTH' && <Layers size={14} color="#f59e0b" />}
                          <span style={{ fontWeight: 600, fontSize: '12px' }}>{entry.paymentMode}</span>
                        </div>
                        {entry.paymentMode === 'BOTH' && (
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                            C: ₹{entry.cashAmount} | G: ₹{entry.gpayAmount}
                          </div>
                        )}
                      </td>

                      {/* Debit (₹ Out) */}
                      <td
                        style={{
                          padding: '12px 14px',
                          textAlign: 'right',
                          verticalAlign: 'top',
                          fontWeight: isDebit ? 700 : 400,
                          color: isDebit ? '#dc2626' : 'var(--text-tertiary)'
                        }}
                      >
                        {isDebit ? formatCurrency(entry.debit) : '—'}
                      </td>

                      {/* Credit (₹ In) */}
                      <td
                        style={{
                          padding: '12px 14px',
                          textAlign: 'right',
                          verticalAlign: 'top',
                          fontWeight: isCredit ? 700 : 400,
                          color: isCredit ? '#059669' : 'var(--text-tertiary)'
                        }}
                      >
                        {isCredit ? formatCurrency(entry.credit) : '—'}
                      </td>

                      {/* Running Balance */}
                      <td
                        style={{
                          padding: '12px 14px',
                          textAlign: 'right',
                          verticalAlign: 'top',
                          fontWeight: 800,
                          color: 'var(--text-primary)'
                        }}
                      >
                        {formatCurrency(entry.runningBalance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer Totals */}
            {summary && (
              <tfoot>
                <tr
                  style={{
                    background: 'var(--bg-muted)',
                    borderTop: '2px solid var(--border-subtle)',
                    fontWeight: 800
                  }}
                >
                  <td colSpan={5} style={{ padding: '14px 18px', textAlign: 'right' }}>
                    PERIOD TOTALS & CLOSING BALANCE:
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', color: '#dc2626', fontSize: '14px' }}>
                    {formatCurrency(summary.totalExpense)}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', color: '#059669', fontSize: '14px' }}>
                    {formatCurrency(summary.totalIncome)}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', color: 'var(--primary)', fontSize: '15px' }}>
                    {formatCurrency(summary.closingBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            className="no-print"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Showing {entries.length} of {totalEntries} entries</span>
                <span>•</span>
                <span>Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="form-control"
                  style={{ height: '28px', padding: '2px 8px', fontSize: '12px', width: '70px', display: 'inline-block' }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            className="modal-content"
            style={{
              background: 'var(--bg-surface)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '540px',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-muted)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Record Manual Day Book Entry
                </h3>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowManualModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleManualSubmit}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Date & Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="form-control"
                      style={{ height: '38px', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Entry Type *
                    </label>
                    <select
                      value={manualType}
                      onChange={(e) => setManualType(e.target.value as any)}
                      className="form-control"
                      style={{ height: '38px', fontSize: '13px' }}
                    >
                      <option value="MANUAL_INCOME">Manual Income (+ Credit)</option>
                      <option value="MANUAL_EXPENSE">Manual Expense (- Debit)</option>
                    </select>
                  </div>
                </div>

                {/* Particulars */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Particulars / Description *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Sundry Maintenance, Electricity bill refund, etc."
                    value={manualParticulars}
                    onChange={(e) => setManualParticulars(e.target.value)}
                    className="form-control"
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                </div>

                {/* Amount & Mode */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="0.00"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="form-control"
                      style={{ height: '38px', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Payment Mode *
                    </label>
                    <select
                      value={manualMode}
                      onChange={(e) => setManualMode(e.target.value as PaymentMode)}
                      className="form-control"
                      style={{ height: '38px', fontSize: '13px' }}
                    >
                      <option value="CASH">Cash</option>
                      <option value="GPAY">GPAY / UPI / Bank</option>
                      <option value="BOTH">Split (Cash + GPAY)</option>
                    </select>
                  </div>
                </div>

                {/* Split inputs if mode === BOTH */}
                {manualMode === 'BOTH' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      padding: '10px',
                      background: 'var(--bg-muted)',
                      borderRadius: '8px'
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                        Cash Portion (₹) *
                      </label>
                      <input
                        type="number"
                        placeholder="Cash amount"
                        value={manualCashAmount}
                        onChange={(e) => setManualCashAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="form-control"
                        style={{ height: '36px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                        GPAY Portion (₹) *
                      </label>
                      <input
                        type="number"
                        placeholder="GPAY amount"
                        value={manualGpayAmount}
                        onChange={(e) => setManualGpayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="form-control"
                        style={{ height: '36px', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                )}

                {/* Complex & Unit (Optional) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Complex (Optional)
                    </label>
                    <select
                      value={manualComplexId}
                      onChange={(e) => {
                        setManualComplexId(e.target.value);
                        setManualShopId('');
                      }}
                      className="form-control"
                      style={{ height: '38px', fontSize: '13px' }}
                    >
                      <option value="">General / None</option>
                      {complexes.map((c) => (
                        <option key={c.id} value={c.complexId}>
                          {c.complexName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Shop (Optional)
                    </label>
                    <select
                      value={manualShopId}
                      onChange={(e) => setManualShopId(e.target.value)}
                      className="form-control"
                      style={{ height: '38px', fontSize: '13px' }}
                      disabled={!manualComplexId}
                    >
                      <option value="">All / None</option>
                      {filteredShopsForModal.map((s) => (
                        <option key={s.id} value={s.shopId}>
                          Shop {s.shopNumber} - {s.tenantName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Category & Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maintenance, Electricity, Repair, Sundry"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="form-control"
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Additional details..."
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    className="form-control"
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  padding: '14px 20px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  background: 'var(--bg-muted)'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowManualModal(false)}
                  disabled={isSubmittingManual}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingManual}
                >
                  {isSubmittingManual ? 'Recording...' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
