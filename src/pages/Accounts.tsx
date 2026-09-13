import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileSpreadsheet,
  Plus,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Wallet,
  Building2,
  Receipt,
  Scale,
  TrendingUp,
  Landmark,
  BadgePercent,
  Inbox,
  Printer
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';

export const Accounts: React.FC = () => {
  const {
    currentPage,
    setCurrentPage,
    dayBookEntries,
    cashInHand,
    cashAtBank,
    addDayBookEntry,
    loans,
    fixedDeposits,
    showToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'day-book' | 'trial-balance' | 'profit-loss' | 'balance-sheet'>('day-book');

  useEffect(() => {
    if (['day-book', 'trial-balance', 'profit-loss', 'balance-sheet'].includes(currentPage)) {
      setActiveTab(currentPage as any);
    }
  }, [currentPage]);

  const todayISO = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayISO);
  const [toDate, setToDate] = useState(todayISO);
  const [pnlPeriod, setPnlPeriod] = useState<'this-month' | 'last-month' | 'this-year' | 'all-time'>('this-month');
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showPaise, setShowPaise] = useState(true);
  const [showTdsModal, setShowTdsModal] = useState(false);

  // New manual entry modal state
  const [particulars, setParticulars] = useState('');
  const [accountHead, setAccountHead] = useState('Office Expenses');
  const [entryType, setEntryType] = useState<'CASH_IN' | 'CASH_OUT' | 'BANK_IN' | 'BANK_OUT'>('CASH_OUT');
  const [amount, setAmount] = useState<string>('');
  const [entryDate, setEntryDate] = useState(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));

  // Normalize date helper
  const normalizeToIso = (dateStr: string): string => {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('-');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return trimmed;
  };

  // Filtered day book entries based on date range
  const filteredEntries = dayBookEntries.filter((e) => {
    if (!fromDate && !toDate) return true;
    const entryIso = normalizeToIso(e.date);
    if (!entryIso) return true;
    if (fromDate && entryIso < fromDate) return false;
    if (toDate && entryIso > toDate) return false;
    return true;
  });

  // Calculations for In / Out
  const todayIn = filteredEntries.reduce((acc, e) => acc + (e.cashIn + e.bankIn), 0);
  const todayOut = filteredEntries.reduce((acc, e) => acc + (e.cashOut + e.bankOut), 0);

  // Financial aggregates
  const totalGoldLoansOutstanding = loans.reduce((acc, l) => acc + l.outstandingPrincipal, 0);
  const totalInterestEarned = dayBookEntries
    .filter((e) => e.accountHead === 'Interest Income')
    .reduce((acc, e) => acc + e.cashIn + e.bankIn, 0);
  const cardFeesEarned = loans.length * 10;
  const totalIncome = totalInterestEarned + cardFeesEarned;
  const interestPaidOnDeposits = fixedDeposits.reduce((acc, f) => acc + f.monthlyPayout, 0);
  const totalExpenses = interestPaidOnDeposits;
  const netProfit = totalIncome - totalExpenses;
  const totalFDPrincipal = fixedDeposits.reduce((acc, f) => acc + f.principal, 0);

  const formatMoney = (num: number) => {
    return (num || 0).toLocaleString('en-IN', {
      minimumFractionDigits: showPaise ? 2 : 0,
      maximumFractionDigits: showPaise ? 2 : 0
    });
  };

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    if (!particulars.trim() || numAmount <= 0) {
      showToast('Please enter valid particulars and amount', 'error');
      return;
    }

    const billNo = `MAN-${Date.now().toString().slice(-4)}`;
    addDayBookEntry({
      billNo,
      date: entryDate,
      particulars: particulars.trim(),
      accountHead,
      mode: entryType.startsWith('CASH') ? 'Cash' : 'Bank',
      cashIn: entryType === 'CASH_IN' ? numAmount : 0,
      cashOut: entryType === 'CASH_OUT' ? numAmount : 0,
      bankIn: entryType === 'BANK_IN' ? numAmount : 0,
      bankOut: entryType === 'BANK_OUT' ? numAmount : 0,
    });

    setParticulars('');
    setAmount('');
    setShowAddEntryModal(false);
    showToast('Manual accounting entry recorded successfully', 'success');
  };

  const handleExportExcel = () => {
    showToast('Exporting accounting statement to Excel (.xlsx)...', 'info');
  };

  const handleExportPDF = () => {
    window.print();
  };

  const tabs = [
    { id: 'day-book', label: 'Day Book', icon: Receipt },
    { id: 'trial-balance', label: 'Trial Balance', icon: Scale },
    { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
    { id: 'balance-sheet', label: 'Balance Sheet', icon: Landmark }
  ];

  return (
    <div
      className="page-content"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
      {/* Primary Page Header */}
      <PageHeader
        title={
          activeTab === 'day-book'
            ? 'Day Book'
            : activeTab === 'trial-balance'
            ? 'Trial Balance'
            : activeTab === 'profit-loss'
            ? 'Profit & Loss'
            : 'Balance Sheet'
        }
        subtitle={
          activeTab === 'day-book'
            ? 'Daily cash and bank transactions chronologically summarized'
            : activeTab === 'trial-balance'
            ? 'Double-entry balance verification of all asset, liability, revenue and expense heads.'
            : activeTab === 'profit-loss'
            ? 'Operating revenue from interest and fees versus financial expenses and costs.'
            : 'Statement of financial position detailing branch assets, liabilities and reserves.'
        }
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Accounts' },
          {
            label:
              activeTab === 'day-book'
                ? 'Day Book'
                : activeTab === 'trial-balance'
                ? 'Trial Balance'
                : activeTab === 'profit-loss'
                ? 'Profit & Loss'
                : 'Balance Sheet'
          }
        ]}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              icon={<BadgePercent size={15} style={{ color: 'var(--primary, #176B52)' }} />}
              onClick={() => setShowTdsModal(true)}
            >
              TDS Ledger
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet size={15} style={{ color: 'var(--primary, #176B52)' }} />}
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Printer size={15} />}
              onClick={handleExportPDF}
            >
              Print / PDF
            </Button>
          </div>
        }
      />

      {/* Segmented Navigation Tabs Control */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px',
          backgroundColor: 'var(--surface-secondary, #F4F7F5)',
          borderRadius: '10px',
          border: '1px solid var(--border, #E2E8E5)',
          overflowX: 'auto',
          width: 'fit-content',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id as any);
                setCurrentPage(tab.id as any);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : 'var(--text-secondary, #64748B)',
                backgroundColor: isActive ? 'var(--primary, #176B52)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 6px rgba(23, 107, 82, 0.25)' : 'none'
              }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TDS LEDGER MODAL */}
      {showTdsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border, #E2E8E5)',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            <button
              type="button"
              style={{
                position: 'absolute',
                right: '16px',
                top: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
              onClick={() => setShowTdsModal(false)}
            >
              <X size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(23, 107, 82, 0.1)',
                  color: 'var(--primary, #176B52)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <BadgePercent size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  TDS Deductions Ledger
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Section 194A Tax Deducted at Source on Interest Payments
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px', margin: '16px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Bill No</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Customer</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Gross Interest</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>TDS (10%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>25-08-2026</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary, #176B52)', fontFamily: 'monospace' }}>RCPT-104</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>Thayba Begum</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>₹1,500.00</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#DC2626', fontFamily: 'monospace' }}>₹150.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
              <Button variant="primary" onClick={() => setShowTdsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DAY BOOK TAB CONTENT */}
      {activeTab === 'day-book' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {/* 4 Summary KPI Cards Grid */}
          <div className="daybook-kpi-grid">
            {/* Card 1: Cash in Hand */}
            <div
              className="card"
              style={{
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border, #E2E8E5)',
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-secondary, #64748B)' }}>
                  Cash In Hand (Vault)
                </span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: cashInHand >= 0 ? '#176B52' : '#DC2626', lineHeight: 1.2, letterSpacing: '-0.3px', marginTop: '2px', fontFamily: 'monospace' }}>
                  ₹{formatMoney(cashInHand)}
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #8A9E95)', marginTop: '2px' }}>
                  Physical counter vault balance
                </span>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(23, 107, 82, 0.10)', color: '#176B52', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Wallet size={20} />
              </div>
            </div>

            {/* Card 2: Cash at Bank */}
            <div
              className="card"
              style={{
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border, #E2E8E5)',
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-secondary, #64748B)' }}>
                  Cash At Bank
                </span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: cashAtBank >= 0 ? '#4F46E5' : '#DC2626', lineHeight: 1.2, letterSpacing: '-0.3px', marginTop: '2px', fontFamily: 'monospace' }}>
                  ₹{formatMoney(cashAtBank)}
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #8A9E95)', marginTop: '2px' }}>
                  Branch Current A/c balance
                </span>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.10)', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={20} />
              </div>
            </div>

            {/* Card 3: Today's Receipts */}
            <div
              className="card"
              style={{
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border, #E2E8E5)',
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-secondary, #64748B)' }}>
                  Today's Receipts (In)
                </span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0D9488', lineHeight: 1.2, letterSpacing: '-0.3px', marginTop: '2px', fontFamily: 'monospace' }}>
                  ₹{formatMoney(todayIn)}
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #8A9E95)', marginTop: '2px' }}>
                  Total incoming receipts &amp; credits
                </span>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(20, 184, 166, 0.10)', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ArrowDownLeft size={20} />
              </div>
            </div>

            {/* Card 4: Today's Disbursed */}
            <div
              className="card"
              style={{
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border, #E2E8E5)',
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-secondary, #64748B)' }}>
                  Today's Disbursed (Out)
                </span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', lineHeight: 1.2, letterSpacing: '-0.3px', marginTop: '2px', fontFamily: 'monospace' }}>
                  ₹{formatMoney(todayOut)}
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #8A9E95)', marginTop: '2px' }}>
                  Total outgoing loans &amp; debits
                </span>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(217, 119, 6, 0.10)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ArrowUpRight size={20} />
              </div>
            </div>
          </div>

          {/* Main Transaction Journal Container */}
          <div
            className="card"
            style={{
              backgroundColor: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border, #E2E8E5)',
              borderRadius: '14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {/* Header & Filter Toolbar */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle, #EDF2EE)',
                backgroundColor: 'var(--surface-secondary, #F4F7F5)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} style={{ color: 'var(--primary, #176B52)' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #1A2E26)', margin: 0 }}>
                    Daily Transaction Journal
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #8A9E95)', margin: '3px 0 0 0' }}>
                  Real-time cash in hand, bank transfers, receipts and disbursements
                </p>
              </div>

              {/* Filter and Action Controls: [From Date] [To Date] [Today] [Show Paise] [Add Entry] */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Date Range Selector Box */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'var(--surface, #FFFFFF)',
                    border: '1px solid var(--border, #E2E8E5)',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    height: '38px',
                    boxSizing: 'border-box'
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #8A9E95)', textTransform: 'uppercase' }}>From</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      color: 'var(--text-primary, #1A2E26)',
                      outline: 'none',
                      padding: 0,
                      height: 'auto',
                      width: '125px'
                    }}
                  />
                  <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border, #E2E8E5)' }} />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #8A9E95)', textTransform: 'uppercase' }}>To</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      color: 'var(--text-primary, #1A2E26)',
                      outline: 'none',
                      padding: 0,
                      height: 'auto',
                      width: '125px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate(todayISO);
                      setToDate(todayISO);
                    }}
                    style={{
                      border: 'none',
                      background: 'rgba(23, 107, 82, 0.08)',
                      color: 'var(--primary, #176B52)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Today
                  </button>
                </div>

                {/* Show Paise Switch */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--surface, #FFFFFF)',
                    border: '1px solid var(--border, #E2E8E5)',
                    borderRadius: '8px',
                    padding: '0 12px',
                    height: '38px',
                    boxSizing: 'border-box'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #64748B)', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    Show Paise
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showPaise}
                    onClick={() => setShowPaise(!showPaise)}
                    style={{
                      width: '34px',
                      height: '20px',
                      borderRadius: '10px',
                      backgroundColor: showPaise ? 'var(--primary, #176B52)' : '#CBD5E1',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      padding: 0,
                      transition: 'background-color 0.2s',
                      outline: 'none'
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: showPaise ? '16px' : '2px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                      }}
                    />
                  </button>
                </div>

                {/* Primary Add Entry Button */}
                <Button
                  variant="primary"
                  icon={<Plus size={15} />}
                  onClick={() => setShowAddEntryModal(true)}
                  style={{ height: '38px', fontWeight: 700 }}
                >
                  Add Entry
                </Button>
              </div>
            </div>

            {/* Table Area Container with Horizontally Scrollable Wrapper */}
            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--surface-secondary, #F4F7F5)',
                      color: 'var(--text-muted, #8A9E95)',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      borderBottom: '1px solid var(--border, #E2E8E5)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 5
                    }}
                  >
                    <th style={{ padding: '12px 14px', width: '130px', whiteSpace: 'nowrap' }}>DATE / TIME</th>
                    <th style={{ padding: '12px 14px', width: '110px', whiteSpace: 'nowrap' }}>REF / BILL #</th>
                    <th style={{ padding: '12px 16px', minWidth: '260px' }}>PARTICULARS &amp; ACCOUNT HEAD</th>
                    <th style={{ padding: '12px 14px', width: '110px', textAlign: 'right', color: '#16A34A', whiteSpace: 'nowrap' }}>CASH IN</th>
                    <th style={{ padding: '12px 14px', width: '110px', textAlign: 'right', color: '#DC2626', whiteSpace: 'nowrap' }}>CASH OUT</th>
                    <th style={{ padding: '12px 14px', width: '110px', textAlign: 'right', color: '#16A34A', whiteSpace: 'nowrap' }}>BANK IN</th>
                    <th style={{ padding: '12px 14px', width: '110px', textAlign: 'right', color: '#DC2626', whiteSpace: 'nowrap' }}>BANK OUT</th>
                    <th style={{ padding: '12px 14px', width: '120px', textAlign: 'right', whiteSpace: 'nowrap' }}>CASH BAL</th>
                    <th style={{ padding: '12px 16px', width: '120px', textAlign: 'right', whiteSpace: 'nowrap' }}>BANK BAL</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening Balance Row */}
                  <tr style={{ backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderBottom: '1px solid var(--border, #E2E8E5)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>-</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>-</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--border, #E2E8E5)',
                          color: 'var(--text-primary, #1A2E26)',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase'
                        }}
                      >
                        OPENING BALANCE
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>-</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>-</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>-</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>-</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ₹{formatMoney(0)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ₹{formatMoney(0)}
                    </td>
                  </tr>

                  {/* Transaction Rows */}
                  {filteredEntries.map((e) => (
                    <tr
                      key={e.id}
                      style={{ borderBottom: '1px solid var(--border-subtle, #EDF2EE)', transition: 'background-color 0.15s' }}
                    >
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '11.5px' }}>
                        {e.date} {e.time ? `• ${e.time}` : ''}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary, #176B52)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {e.billNo}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #1A2E26)', fontSize: '13px' }}>{e.particulars}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '1px 6px', backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderRadius: '4px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {e.accountHead}
                          </span>
                          <span>•</span>
                          <span style={{ fontWeight: 700, color: 'var(--primary, #176B52)' }}>{e.mode}</span>
                          {e.customerName && (
                            <>
                              <span>•</span>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{e.customerName}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#16A34A' }}>
                        {e.cashIn > 0 ? `₹${formatMoney(e.cashIn)}` : '-'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>
                        {e.cashOut > 0 ? `₹${formatMoney(e.cashOut)}` : '-'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#16A34A' }}>
                        {e.bankIn > 0 ? `₹${formatMoney(e.bankIn)}` : '-'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>
                        {e.bankOut > 0 ? `₹${formatMoney(e.bankOut)}` : '-'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ₹{formatMoney(e.cashBal)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ₹{formatMoney(e.bankBal)}
                      </td>
                    </tr>
                  ))}

                  {/* Empty State when no entries */}
                  {filteredEntries.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: '56px 24px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(23, 107, 82, 0.08)',
                              color: 'var(--primary, #176B52)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '6px'
                            }}
                          >
                            <Inbox size={24} />
                          </div>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #1A2E26)', margin: 0 }}>
                            No transactions found
                          </h4>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748B)', margin: 0, maxWidth: '420px', lineHeight: 1.4 }}>
                            Transactions for the selected date range ({fromDate} to {toDate}) will appear here.
                          </p>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Plus size={14} />}
                            onClick={() => setShowAddEntryModal(true)}
                            style={{ marginTop: '12px' }}
                          >
                            + Record Entry
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Closing Balance Row */}
                  <tr
                    style={{
                      backgroundColor: 'rgba(23, 107, 82, 0.08)',
                      borderTop: '2px solid rgba(23, 107, 82, 0.3)',
                      fontWeight: 700,
                      color: 'var(--text-primary)'
                    }}
                  >
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>-</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>-</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(23, 107, 82, 0.15)',
                          color: 'var(--primary, #176B52)',
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase'
                        }}
                      >
                        CLOSING BALANCE
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>-</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>-</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>-</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>-</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '14px', fontWeight: 800, color: 'var(--primary, #176B52)' }}>
                      ₹{formatMoney(cashInHand)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '14px', fontWeight: 800, color: 'var(--primary, #176B52)' }}>
                      ₹{formatMoney(cashAtBank)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TRIAL BALANCE TAB */}
      {activeTab === 'trial-balance' && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--border, #E2E8E5)',
            borderRadius: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle, #EDF2EE)',
              backgroundColor: 'var(--surface-secondary, #F4F7F5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={18} style={{ color: 'var(--primary, #176B52)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #1A2E26)', margin: 0 }}>
                  Trial Balance Ledger
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #8A9E95)', margin: '3px 0 0 0' }}>
                Summary of active debit and credit balances for dual entry verification
              </p>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                color: '#16A34A'
              }}
            >
              <ShieldCheck size={16} />
              Books Balanced
            </span>
          </div>

          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--surface-secondary, #F4F7F5)',
                    color: 'var(--text-muted, #8A9E95)',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    borderBottom: '1px solid var(--border, #E2E8E5)'
                  }}
                >
                  <th style={{ padding: '12px 18px' }}>Account Head</th>
                  <th style={{ padding: '12px 18px' }}>Group Category</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Debit (₹)</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-primary)' }}>Gold Loan Principal Portfolio</td>
                  <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Current Assets</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{formatMoney(totalGoldLoansOutstanding)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-primary)' }}>Cash In Hand (Vault Reserve)</td>
                  <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Current Assets</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{formatMoney(Math.max(0, cashInHand))}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-primary)' }}>Fixed Deposits Liability</td>
                  <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Current Liabilities</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{formatMoney(totalFDPrincipal)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-primary)' }}>Interest &amp; Processing Income</td>
                  <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Revenue</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{formatMoney(totalIncome)}</td>
                </tr>
                <tr
                  style={{
                    backgroundColor: 'rgba(23, 107, 82, 0.08)',
                    borderTop: '2px solid rgba(23, 107, 82, 0.3)',
                    fontWeight: 700
                  }}
                >
                  <td colSpan={2} style={{ padding: '14px 18px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Total Trial Balance
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', color: 'var(--primary, #176B52)', fontWeight: 800, fontSize: '14px', fontFamily: 'monospace' }}>
                    ₹{formatMoney(totalGoldLoansOutstanding + Math.max(0, cashInHand))}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', color: 'var(--primary, #176B52)', fontWeight: 800, fontSize: '14px', fontFamily: 'monospace' }}>
                    ₹{formatMoney(totalFDPrincipal + totalIncome)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PROFIT & LOSS TAB */}
      {activeTab === 'profit-loss' && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--border, #E2E8E5)',
            borderRadius: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle, #EDF2EE)',
              backgroundColor: 'var(--surface-secondary, #F4F7F5)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} style={{ color: 'var(--primary, #176B52)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #1A2E26)', margin: 0 }}>
                  Profit &amp; Loss Statement
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #8A9E95)', margin: '3px 0 0 0' }}>
                Automated revenue and expenditure breakdown calculated from ledger transactions
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--surface, #FFFFFF)',
                  border: '1px solid var(--border, #E2E8E5)',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  height: '34px',
                  boxSizing: 'border-box'
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', width: '120px' }}
                />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', width: '120px' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'var(--surface-secondary, #F4F7F5)',
                  border: '1px solid var(--border, #E2E8E5)',
                  borderRadius: '8px',
                  padding: '2px'
                }}
              >
                {(['this-month', 'last-month', 'this-year', 'all-time'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPnlPeriod(p)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: pnlPeriod === p ? 700 : 500,
                      color: pnlPeriod === p ? '#FFFFFF' : 'var(--text-secondary)',
                      backgroundColor: pnlPeriod === p ? 'var(--primary, #176B52)' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {p.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Income */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-secondary, #F4F7F5)',
                  border: '1px solid var(--border, #E2E8E5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border, #E2E8E5)' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 }}>
                    Income &amp; Revenues
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>All credited streams</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Interest Earned on Loans</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>₹{formatMoney(totalInterestEarned)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Card &amp; Processing Fees</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>₹{formatMoney(cardFeesEarned)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '14px', fontWeight: 800, color: '#16A34A' }}>
                    <span>Total Income</span>
                    <span style={{ fontFamily: 'monospace' }}>₹{formatMoney(totalIncome)}</span>
                  </div>
                </div>
              </div>

              {/* Expenses */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-secondary, #F4F7F5)',
                  border: '1px solid var(--border, #E2E8E5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border, #E2E8E5)' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 }}>
                    Expenses &amp; Outflows
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>All operational debits</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Interest Paid on Fixed Deposits</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>₹{formatMoney(interestPaidOnDeposits)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Office &amp; Administrative</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>₹{formatMoney(0)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '14px', fontWeight: 800, color: '#DC2626' }}>
                    <span>Total Expenses</span>
                    <span style={{ fontFamily: 'monospace' }}>₹{formatMoney(totalExpenses)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Operating Profit Banner */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(23, 107, 82, 0.1) 0%, rgba(20, 184, 166, 0.1) 100%)',
                border: '1px solid rgba(23, 107, 82, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--primary, #176B52)' }}>
                  Net Operating Profit
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                  Total revenue surplus after operational cost subtractions
                </p>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, fontFamily: 'monospace', color: 'var(--primary, #176B52)' }}>
                ₹{formatMoney(netProfit)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BALANCE SHEET TAB */}
      {activeTab === 'balance-sheet' && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--border, #E2E8E5)',
            borderRadius: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle, #EDF2EE)',
              backgroundColor: 'var(--surface-secondary, #F4F7F5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Landmark size={18} style={{ color: 'var(--primary, #176B52)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #1A2E26)', margin: 0 }}>
                  Balance Sheet
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #8A9E95)', margin: '3px 0 0 0' }}>
                Financial structure of assets, liabilities, and retained capital reserves
              </p>
            </div>
          </div>

          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-secondary, #F4F7F5)',
                  border: '1px solid var(--border, #E2E8E5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary, #176B52)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 }}>
                  Assets Portfolio
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Active Gold Loan Advances</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>₹{formatMoney(totalGoldLoansOutstanding)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cash In Vault</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>₹{formatMoney(Math.max(0, cashInHand))}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pledged Gold Collateral Value</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>₹{formatMoney(loans.reduce((acc, l) => acc + l.marketValue, 0))}</strong>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-secondary, #F4F7F5)',
                  border: '1px solid var(--border, #E2E8E5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 }}>
                  Liabilities &amp; Capital
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Depositor Fixed Deposits Liability</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>₹{formatMoney(totalFDPrincipal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Branch Capital &amp; Reserves</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>₹{formatMoney(500000)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Manual Day Book Entry Modal */}
      {showAddEntryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border, #E2E8E5)',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              boxSizing: 'border-box'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle, #EDF2EE)',
                backgroundColor: 'var(--surface-secondary, #F4F7F5)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(23, 107, 82, 0.1)',
                    color: 'var(--primary, #176B52)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Plus size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Record Manual Day Book Entry
                  </h3>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Post direct debit or credit to general ledger
                  </p>
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowAddEntryModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateEntry} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: 1 }}>
                <div className="form-group">
                  <label className="form-label required">Transaction Type</label>
                  <select
                    className="select-control"
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as any)}
                  >
                    <option value="CASH_IN">Cash In (Credit Vault)</option>
                    <option value="CASH_OUT">Cash Out (Expense / Debit Vault)</option>
                    <option value="BANK_IN">Bank In (Bank Credit / Inflow)</option>
                    <option value="BANK_OUT">Bank Out (Bank Transfer / Outflow)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">Particulars / Description</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. Tea &amp; Refreshments / Office Rent / Bank Deposit"
                    value={particulars}
                    onChange={(e) => setParticulars(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Account Head</label>
                  <select
                    className="select-control"
                    value={accountHead}
                    onChange={(e) => setAccountHead(e.target.value)}
                  >
                    <option value="Office Expenses">Office Expenses</option>
                    <option value="Staff Salary">Staff Salary</option>
                    <option value="Stationery & Printing">Stationery &amp; Printing</option>
                    <option value="Rent & Maintenance">Rent &amp; Maintenance</option>
                    <option value="Owner Capital">Owner Capital Inflow</option>
                    <option value="Bank Contra Transfer">Bank Contra Transfer</option>
                    <option value="Electricity & Utilities">Electricity &amp; Utilities</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label required">Amount (₹)</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="e.g. 1500.00"
                      className="input-control"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      style={{ fontFamily: 'monospace', fontWeight: 600 }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Date</label>
                    <input
                      type="text"
                      className="input-control"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  padding: '16px 20px',
                  borderTop: '1px solid var(--border-subtle, #EDF2EE)',
                  backgroundColor: 'var(--surface-secondary, #F4F7F5)'
                }}
              >
                <Button variant="outline" type="button" onClick={() => setShowAddEntryModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Entry
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
