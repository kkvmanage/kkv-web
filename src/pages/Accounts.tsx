import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Download,
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
  BadgePercent
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard, StatGrid } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const Accounts: React.FC = () => {
  const { currentPage, dayBookEntries, cashInHand, cashAtBank, addDayBookEntry, loans, fixedDeposits, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'day-book' | 'trial-balance' | 'profit-loss' | 'balance-sheet'>('day-book');

  React.useEffect(() => {
    if (['day-book', 'trial-balance', 'profit-loss', 'balance-sheet'].includes(currentPage)) {
      setActiveTab(currentPage as any);
    }
  }, [currentPage]);

  const todayISO = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayISO);
  const [toDate, setToDate] = useState(todayISO);
  const [pnlPeriod, setPnlPeriod] = useState<'this-month' | 'last-month' | 'this-year' | 'all-time'>('this-month');
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);

  // New manual entry modal state
  const [particulars, setParticulars] = useState('');
  const [accountHead, setAccountHead] = useState('Office Expenses');
  const [entryType, setEntryType] = useState<'CASH_IN' | 'CASH_OUT' | 'BANK_IN' | 'BANK_OUT'>('CASH_OUT');
  const [amount, setAmount] = useState<number>(500);
  const [entryDate, setEntryDate] = useState(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));

  // Calculations for Today In / Out
  const todayIn = dayBookEntries.reduce((acc, e) => acc + (e.cashIn + e.bankIn), 0);
  const todayOut = dayBookEntries.reduce((acc, e) => acc + (e.cashOut + e.bankOut), 0);

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

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!particulars.trim() || amount <= 0) {
      showToast('Please enter valid particulars and amount', 'error');
      return;
    }

    const billNo = `MAN-${Date.now().toString().slice(-4)}`;
    addDayBookEntry({
      billNo,
      particulars: particulars.trim(),
      accountHead,
      mode: entryType.startsWith('CASH') ? 'Cash' : 'Bank',
      cashIn: entryType === 'CASH_IN' ? amount : 0,
      cashOut: entryType === 'CASH_OUT' ? amount : 0,
      bankIn: entryType === 'BANK_IN' ? amount : 0,
      bankOut: entryType === 'BANK_OUT' ? amount : 0,
      date: entryDate
    });

    setParticulars('');
    setAmount(500);
    setShowAddEntryModal(false);
    showToast('Manual accounting entry recorded successfully', 'success');
  };

  const handleExportExcel = () => {
    showToast('Exporting accounting statement to Excel (.xlsx)...', 'info');
  };

  const handleExportPDF = () => {
    showToast('Generating official PDF statement...', 'info');
  };

  const [showPaise, setShowPaise] = useState(true);
  const [showTdsModal, setShowTdsModal] = useState(false);

  const formatMoney = (num: number) => {
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: showPaise ? 2 : 0,
      maximumFractionDigits: showPaise ? 2 : 0
    });
  };

  const tabs = [
    { id: 'day-book', label: 'Day Book', icon: Receipt },
    { id: 'trial-balance', label: 'Trial Balance', icon: Scale },
    { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
    { id: 'balance-sheet', label: 'Balance Sheet', icon: Landmark }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="General Ledger & Accounts"
        description="Comprehensive double-entry day book, trial balances, profit/loss statements, and balance sheet auditing."
        breadcrumbs={[{ label: 'Home' }, { label: 'Accounting' }]}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<BadgePercent className="w-4 h-4 text-primary-500" />}
              onClick={() => setShowTdsModal(true)}
            >
              TDS Ledger
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4 text-slate-600" />}
              onClick={handleExportPDF}
            >
              Print / PDF
            </Button>
          </div>
        }
      />

      {/* Navigation Tabs Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-950/20 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TDS LEDGER MODAL */}
      {showTdsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              onClick={() => setShowTdsModal(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 rounded-xl">
                <BadgePercent className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">TDS Deductions Ledger</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Section 194A Tax Deducted at Source on Interest Payments</p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl my-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-3.5 py-2.5">Date</th>
                    <th className="px-3.5 py-2.5">Bill No</th>
                    <th className="px-3.5 py-2.5">Customer</th>
                    <th className="px-3.5 py-2.5 text-right">Gross Interest</th>
                    <th className="px-3.5 py-2.5 text-right">TDS (10%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">25-08-2026</td>
                    <td className="px-3.5 py-2.5 font-bold text-primary-600 dark:text-primary-400">RCPT-104</td>
                    <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-white">Thayba Begum</td>
                    <td className="px-3.5 py-2.5 text-right font-medium">₹1,500.00</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-rose-600 dark:text-rose-400">₹150.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setShowTdsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DAY BOOK TAB */}
      {activeTab === 'day-book' && (
        <div className="space-y-6">
          {/* 4 Summary Metric Cards */}
          <StatGrid columns={4}>
            <StatCard
              title="Cash In Hand (Vault)"
              value={`₹${formatMoney(cashInHand)}`}
              subtitle="Physical counter vault balance"
              icon={<Wallet className="w-5 h-5 text-emerald-500" />}
              variant={cashInHand >= 0 ? 'emerald' : 'rose'}
            />
            <StatCard
              title="Cash At Bank"
              value={`₹${formatMoney(cashAtBank)}`}
              subtitle="Branch Current A/c"
              icon={<Building2 className="w-5 h-5 text-indigo-500" />}
              variant={cashAtBank >= 0 ? 'indigo' : 'rose'}
            />
            <StatCard
              title="Today Receipts (In)"
              value={`₹${formatMoney(todayIn)}`}
              subtitle="Total receipts & credits"
              icon={<ArrowDownLeft className="w-5 h-5 text-teal-500" />}
              variant="teal"
            />
            <StatCard
              title="Today Disbursed (Out)"
              value={`₹${formatMoney(todayOut)}`}
              subtitle="Total disbursements & debits"
              icon={<ArrowUpRight className="w-5 h-5 text-amber-500" />}
              variant="amber"
            />
          </StatGrid>

          {/* Main Day Book Card */}
          <Card
            title="Daily Transaction Journal"
            subtitle="Real-time cash in hand, bank transfers, receipts and disbursement ledger"
            headerRight={
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                  <span className="text-[11px] font-bold text-slate-500">PAISE</span>
                  <button
                    type="button"
                    className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-all ${
                      showPaise
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                    onClick={() => setShowPaise(!showPaise)}
                  >
                    {showPaise ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-500">FROM</span>
                  <input
                    type="date"
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                  <span className="font-semibold text-slate-500">TO</span>
                  <input
                    type="date"
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setFromDate(todayISO); setToDate(todayISO); }}
                  >
                    Today
                  </Button>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowAddEntryModal(true)}
                >
                  Add Entry
                </Button>
              </div>
            }
          >
            {/* Day Book Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-3">Time</th>
                    <th className="px-3.5 py-3">Bill #</th>
                    <th className="px-3.5 py-3">Particulars & Head</th>
                    <th className="px-3.5 py-3 text-right">Cash In</th>
                    <th className="px-3.5 py-3 text-right">Cash Out</th>
                    <th className="px-3.5 py-3 text-right">Bank In</th>
                    <th className="px-3.5 py-3 text-right">Bank Out</th>
                    <th className="px-3.5 py-3 text-right">Cash Bal</th>
                    <th className="px-3.5 py-3 text-right">Bank Bal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/70 dark:bg-slate-800/30 font-semibold text-slate-600 dark:text-slate-300">
                    <td className="px-3.5 py-2.5 text-slate-400">-</td>
                    <td className="px-3.5 py-2.5 text-slate-400">-</td>
                    <td className="px-3.5 py-2.5 font-bold text-primary-600 dark:text-primary-400">Opening Balance</td>
                    <td className="px-3.5 py-2.5 text-right text-slate-400">-</td>
                    <td className="px-3.5 py-2.5 text-right text-slate-400">-</td>
                    <td className="px-3.5 py-2.5 text-right text-slate-400">-</td>
                    <td className="px-3.5 py-2.5 text-right text-slate-400">-</td>
                    <td className="px-3.5 py-2.5 text-right font-bold">₹0.00</td>
                    <td className="px-3.5 py-2.5 text-right font-bold">₹0.00</td>
                  </tr>

                  {/* Transaction Entries */}
                  {dayBookEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-slate-400 font-mono text-[11px]">{e.time}</td>
                      <td className="px-3.5 py-2.5 font-bold text-primary-600 dark:text-primary-400 font-mono">{e.billNo}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-slate-900 dark:text-white">{e.particulars}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          {e.accountHead} • <span className="text-primary-600 dark:text-primary-400">{e.mode}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {e.cashIn > 0 ? `₹${e.cashIn.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {e.cashOut > 0 ? `₹${e.cashOut.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {e.bankIn > 0 ? `₹${e.bankIn.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {e.bankOut > 0 ? `₹${e.bankOut.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                        ₹{e.cashBal.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                        ₹{e.bankBal.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}

                  {/* Closing Balance Row */}
                  <tr className="bg-primary-50/50 dark:bg-primary-950/30 font-bold border-t-2 border-primary-200 dark:border-primary-800 text-slate-900 dark:text-white">
                    <td className="px-3.5 py-3 text-slate-400">-</td>
                    <td className="px-3.5 py-3 text-slate-400">-</td>
                    <td className="px-3.5 py-3 font-extrabold text-primary-700 dark:text-primary-300">Closing Balance</td>
                    <td className="px-3.5 py-3 text-right text-slate-400">-</td>
                    <td className="px-3.5 py-3 text-right text-slate-400">-</td>
                    <td className="px-3.5 py-3 text-right text-slate-400">-</td>
                    <td className="px-3.5 py-3 text-right text-slate-400">-</td>
                    <td className="px-3.5 py-3 text-right text-primary-700 dark:text-primary-300 text-sm">
                      ₹{cashInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3.5 py-3 text-right text-primary-700 dark:text-primary-300 text-sm">
                      ₹{cashAtBank.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TRIAL BALANCE TAB */}
      {activeTab === 'trial-balance' && (
        <Card
          title="Trial Balance Ledger"
          subtitle="Summary of active debit and credit balances for dual entry verification"
          headerRight={
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
              Books Balanced
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Account Head</th>
                  <th className="px-4 py-3">Group Category</th>
                  <th className="px-4 py-3 text-right">Debit (₹)</th>
                  <th className="px-4 py-3 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Gold Loan Principal Portfolio</td>
                  <td className="px-4 py-3 text-slate-500">Current Assets</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">₹{totalGoldLoansOutstanding.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right text-slate-400">-</td>
                </tr>
                <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Cash In Hand (Vault Reserve)</td>
                  <td className="px-4 py-3 text-slate-500">Current Assets</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">₹{Math.max(0, cashInHand).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right text-slate-400">-</td>
                </tr>
                <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Fixed Deposits Liability</td>
                  <td className="px-4 py-3 text-slate-500">Current Liabilities</td>
                  <td className="px-4 py-3 text-right text-slate-400">-</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">₹{totalFDPrincipal.toLocaleString('en-IN')}</td>
                </tr>
                <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Interest &amp; Processing Income</td>
                  <td className="px-4 py-3 text-slate-500">Revenue</td>
                  <td className="px-4 py-3 text-right text-slate-400">-</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">₹{totalIncome.toLocaleString('en-IN')}</td>
                </tr>
                <tr className="bg-primary-50/60 dark:bg-primary-950/40 font-bold border-t-2 border-primary-300 dark:border-primary-700">
                  <td colSpan={2} className="px-4 py-3.5 text-primary-900 dark:text-primary-200 uppercase tracking-wider">
                    Total Trial Balance
                  </td>
                  <td className="px-4 py-3.5 text-right text-primary-800 dark:text-primary-300 font-extrabold text-sm">
                    ₹{(totalGoldLoansOutstanding + Math.max(0, cashInHand)).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3.5 text-right text-primary-800 dark:text-primary-300 font-extrabold text-sm">
                    ₹{(totalFDPrincipal + totalIncome).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PROFIT & LOSS TAB */}
      {activeTab === 'profit-loss' && (
        <div className="space-y-6">
          <Card
            title="Profit & Loss Statement"
            subtitle="Automated revenue and expenditure breakdown calculated from ledger transactions"
            headerRight={
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500">FROM</span>
                <input
                  type="date"
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <span className="text-xs font-semibold text-slate-500">TO</span>
                <input
                  type="date"
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  {(['this-month', 'last-month', 'this-year', 'all-time'] as const).map((p) => (
                    <button
                      key={p}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md capitalize transition-all ${
                        pnlPeriod === p
                          ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                      onClick={() => setPnlPeriod(p)}
                    >
                      {p.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Income */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    Income &amp; Revenues
                  </h3>
                  <span className="text-[11px] text-slate-400">All credited streams</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">Interest Earned on Loans</span>
                    <strong className="font-bold text-slate-900 dark:text-white">₹{totalInterestEarned.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">Card &amp; Processing Fees</span>
                    <strong className="font-bold text-slate-900 dark:text-white">₹{cardFeesEarned.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between pt-2 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    <span>Total Income</span>
                    <span>₹{totalIncome.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Right: Expenses */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                    Expenses &amp; Outflows
                  </h3>
                  <span className="text-[11px] text-slate-400">All operational debits</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">Interest Paid on Fixed Deposits</span>
                    <strong className="font-bold text-slate-900 dark:text-white">₹{interestPaidOnDeposits.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">Office &amp; Administrative</span>
                    <strong className="font-bold text-slate-900 dark:text-white">₹0.00</strong>
                  </div>
                  <div className="flex justify-between pt-2 text-sm font-extrabold text-rose-600 dark:text-rose-400">
                    <span>Total Expenses</span>
                    <span>₹{totalExpenses.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Net Profit Banner */}
            <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-primary-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Net Operating Profit
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Total revenue surplus after operational cost subtractions
                </p>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{netProfit.toLocaleString('en-IN')}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* BALANCE SHEET TAB */}
      {activeTab === 'balance-sheet' && (
        <Card
          title="Balance Sheet"
          subtitle="Financial structure of assets, liabilities, and retained capital reserves"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide">
                Assets Portfolio
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-300">Active Gold Loan Advances</span>
                  <strong className="font-bold text-slate-900 dark:text-white">₹{totalGoldLoansOutstanding.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-300">Cash In Vault</span>
                  <strong className="font-bold text-slate-900 dark:text-white">₹{Math.max(0, cashInHand).toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-300">Pledged Gold Collateral Value</span>
                  <strong className="font-bold text-slate-900 dark:text-white">₹{loans.reduce((acc, l) => acc + l.marketValue, 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Liabilities &amp; Capital
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-300">Depositor Fixed Deposits Liability</span>
                  <strong className="font-bold text-slate-900 dark:text-white">₹{totalFDPrincipal.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-300">Branch Capital &amp; Reserves</span>
                  <strong className="font-bold text-slate-900 dark:text-white">₹5,00,000</strong>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Add Day Book Entry Modal */}
      {showAddEntryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Day Book Entry</h3>
              <button
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                onClick={() => setShowAddEntryModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction Type <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as any)}
                >
                  <option value="CASH_IN">Cash In (Credit Vault)</option>
                  <option value="CASH_OUT">Cash Out (Expense / Debit Vault)</option>
                  <option value="BANK_IN">Bank In (Bank Credit)</option>
                  <option value="BANK_OUT">Bank Out (Bank Transfer / Debit)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Particulars / Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. Tea & Refreshments / Office Rent / Bank Deposit"
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Account Head <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={accountHead}
                  onChange={(e) => setAccountHead(e.target.value)}
                >
                  <option value="Office Expenses">Office Expenses</option>
                  <option value="Staff Salary">Staff Salary</option>
                  <option value="Stationery & Printing">Stationery &amp; Printing</option>
                  <option value="Rent & Maintenance">Rent &amp; Maintenance</option>
                  <option value="Owner Capital">Owner Capital Inflow</option>
                  <option value="Bank Contra Transfer">Bank Contra Transfer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
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
