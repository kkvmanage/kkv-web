import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Receipt,
  CreditCard
} from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import {
  MonthlyRentReportItem,
  RentalExpense,
  PaymentModeReportData,
  RentalComplex
} from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';

type ReportTab = 'monthly' | 'expenses' | 'payment-modes';

export const RentalReports: React.FC = () => {
  const getCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const [activeTab, setActiveTab] = useState<ReportTab>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedComplex, setSelectedComplex] = useState('');
  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [loading, setLoading] = useState(false);

  // Report Data States
  const [monthlyData, setMonthlyData] = useState<MonthlyRentReportItem[]>([]);
  const [expenseData, setExpenseData] = useState<RentalExpense[]>([]);
  const [paymentModeData, setPaymentModeData] = useState<PaymentModeReportData | null>(null);

  // Expense filters
  const [expenseScope, setExpenseScope] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchComplexes = async () => {
    const res = await rentalApi.getComplexes();
    if (res.success && res.data) setComplexes(res.data);
  };

  useEffect(() => {
    fetchComplexes();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'monthly') {
        const res = await rentalApi.getMonthlyReport(selectedMonth, selectedComplex || undefined);
        if (res.success && res.data) setMonthlyData(res.data);
      } else if (activeTab === 'expenses') {
        const res = await rentalApi.getExpenses({
          complexId: selectedComplex || undefined,
          scope: (expenseScope as any) || undefined,
          category: (expenseCategory as any) || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        });
        if (res.success && res.data) setExpenseData(res.data);
      } else if (activeTab === 'payment-modes') {
        const res = await rentalApi.getPaymentModeReport(selectedMonth, selectedComplex || undefined);
        if (res.success && res.data) setPaymentModeData(res.data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab, selectedMonth, selectedComplex, expenseScope, expenseCategory, startDate, endDate]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchComplexes();
      fetchReportData();
    };
    window.addEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
    window.addEventListener('kkv_rental_data_changed', handleRefresh);
    return () => {
      window.removeEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
      window.removeEventListener('kkv_rental_data_changed', handleRefresh);
    };
  }, [activeTab, selectedMonth, selectedComplex, expenseScope, expenseCategory, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  // Totals for Monthly Report
  const totalExpected = monthlyData.reduce((sum, r) => sum + r.expectedRent, 0);
  const totalCollected = monthlyData.reduce((sum, r) => sum + r.collected, 0);
  const totalPending = monthlyData.reduce((sum, r) => sum + r.pending, 0);
  const totalAdvance = monthlyData.reduce((sum, r) => sum + r.advance, 0);
  const totalExpenses = monthlyData.reduce((sum, r) => sum + r.expenses, 0);
  const totalNet = monthlyData.reduce((sum, r) => sum + r.netCollection, 0);

  return (
    <div className="page-content">
      <RentalHeader
        title="Rental Analytics & Financial Reports"
        subtitle="Exportable monthly financial statements, maintenance expense audits, and payment mode breakdowns"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={handlePrint}>
              <Printer size={14} />
              <span>Print / PDF</span>
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('monthly')}
          style={{ padding: '6px 14px', fontSize: '12px' }}
        >
          <FileText size={13} />
          <span>Monthly Rent Report</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('expenses')}
          style={{ padding: '6px 14px', fontSize: '12px' }}
        >
          <Receipt size={13} />
          <span>Expense Audit Report</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'payment-modes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('payment-modes')}
          style={{ padding: '6px 14px', fontSize: '12px' }}
        >
          <CreditCard size={13} />
          <span>Cash vs GPay Split Report</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>COMPLEX:</span>
          <select
            className="select-control"
            style={{ width: '160px', height: '32px', fontSize: '12px' }}
            value={selectedComplex}
            onChange={(e) => setSelectedComplex(e.target.value)}
          >
            <option value="">All Complexes</option>
            {complexes.map((c) => (
              <option key={c.complexId} value={c.complexId}>
                {c.complexName}
              </option>
            ))}
          </select>
        </div>

        {(activeTab === 'monthly' || activeTab === 'payment-modes') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>MONTH:</span>
            <input
              type="month"
              className="input-control"
              style={{ width: '140px', height: '32px', fontSize: '12px' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        )}

        {activeTab === 'expenses' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Scope:</span>
              <select
                className="select-control"
                style={{ width: '130px', height: '32px', fontSize: '12px' }}
                value={expenseScope}
                onChange={(e) => setExpenseScope(e.target.value)}
              >
                <option value="">All Scopes</option>
                <option value="COMPLEX">Complex Expense</option>
                <option value="SHOP">Shop Expense</option>
                <option value="RENTAL">General Rental</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Category:</span>
              <select
                className="select-control"
                style={{ width: '150px', height: '32px', fontSize: '12px' }}
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {[
                  'Electricity',
                  'Maintenance',
                  'Cleaning',
                  'Plumbing',
                  'Repair',
                  'Water',
                  'Security',
                  'Transport',
                  'Staff Food / Tea',
                  'Cleaning Materials',
                  'Security Expenses',
                  'EB Expenses',
                  'Lift Maintenance',
                  'Generator / Diesel',
                  'Garbage Disposal',
                  'Stationery & Office',
                  'Technician / Labour',
                  'Emergency Repairs',
                  'Other'
                ].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From:</span>
              <input
                type="date"
                className="input-control"
                style={{ width: '130px', height: '32px', fontSize: '12px' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>To:</span>
              <input
                type="date"
                className="input-control"
                style={{ width: '130px', height: '32px', fontSize: '12px' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {/* Report Content */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading financial report data...
        </div>
      ) : activeTab === 'monthly' ? (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '14px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
              Commercial Property Monthly Revenue & Collection Statement
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Generated from Primary Financial Database on {new Date().toLocaleDateString('en-IN')}
            </span>
          </div>

          <div className="table-responsive">
            <table className="table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>COMPLEX NAME</th>
                  <th>LOCATION</th>
                  <th style={{ textAlign: 'center' }}>SHOPS</th>
                  <th style={{ textAlign: 'right' }}>EXPECTED RENT</th>
                  <th style={{ textAlign: 'right' }}>COLLECTED</th>
                  <th style={{ textAlign: 'right' }}>PENDING</th>
                  <th style={{ textAlign: 'right' }}>SECURITY DEPOSIT</th>
                  <th style={{ textAlign: 'right' }}>EXPENSES</th>
                  <th style={{ textAlign: 'right' }}>NET REVENUE</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((item) => (
                  <tr key={item.complexId}>
                    <td style={{ fontWeight: 700 }}>{item.complexName}</td>
                    <td>{item.location}</td>
                    <td style={{ textAlign: 'center' }}>{item.totalShops}</td>
                    <td style={{ textAlign: 'right' }}>₹{item.expectedRent.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(item.expectedRent) ? 0 : 2 })}</td>
                    <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                      ₹{item.collected.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(item.collected) ? 0 : 2 })}
                    </td>
                    <td style={{ textAlign: 'right', color: item.pending > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: item.pending > 0 ? 700 : 400 }}>
                      ₹{item.pending.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(item.pending) ? 0 : 2 })}
                    </td>
                    <td style={{ textAlign: 'right', color: item.advance > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                      ₹{item.advance.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(item.advance) ? 0 : 2 })}
                    </td>
                    <td style={{ textAlign: 'right', color: '#ea580c' }}>
                      ₹{item.expenses.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(item.expenses) ? 0 : 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-brand, #176B52)' }}>
                      ₹{item.netCollection.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(item.netCollection) ? 0 : 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 800, backgroundColor: 'var(--bg-surface-secondary)' }}>
                  <td colSpan={3}>TOTALS</td>
                  <td style={{ textAlign: 'right' }}>₹{totalExpected.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(totalExpected) ? 0 : 2 })}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(totalCollected) ? 0 : 2 })}</td>
                  <td style={{ textAlign: 'right', color: totalPending > 0 ? '#dc2626' : 'inherit' }}>
                    ₹{totalPending.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(totalPending) ? 0 : 2 })}
                  </td>
                  <td style={{ textAlign: 'right', color: '#2563eb' }}>₹{totalAdvance.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(totalAdvance) ? 0 : 2 })}</td>
                  <td style={{ textAlign: 'right', color: '#ea580c' }}>₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(totalExpenses) ? 0 : 2 })}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-brand, #176B52)', fontSize: '13px' }}>
                    ₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(totalNet) ? 0 : 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : activeTab === 'expenses' ? (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '14px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
              Maintenance & Expense Audit Statement
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Total Expenses: ₹{expenseData.reduce((s, e) => s + (Number(e.expenseAmount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({expenseData.length} entries)
            </span>
          </div>

          <div className="table-responsive">
            <table className="table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>EXPENSE ID</th>
                  <th>DATE</th>
                  <th>SCOPE</th>
                  <th>COMPLEX</th>
                  <th>SHOP / UNIT</th>
                  <th>CATEGORY</th>
                  <th>REASON</th>
                  <th style={{ textAlign: 'right' }}>AMOUNT</th>
                  <th>PAYMENT MODE</th>
                  <th>PAID TO / NOTES</th>
                </tr>
              </thead>
              <tbody>
                {expenseData.map((e) => {
                  const isComplexScope = e.expenseScope === 'COMPLEX' || (!e.shopId && e.expenseScope !== 'SHOP');
                  return (
                    <tr key={e.expenseId}>
                      <td style={{ fontWeight: 700, color: 'var(--color-gold-light)' }}>{e.expenseId}</td>
                      <td>{e.expenseDate}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isComplexScope ? 'rgba(147, 51, 234, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            color: isComplexScope ? '#a855f7' : '#f59e0b'
                          }}
                        >
                          {isComplexScope ? 'Complex' : 'Shop'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{e.complexName}</td>
                      <td>
                        {isComplexScope ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
                            General Complex Expense
                          </span>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{e.shopNumber || 'Shop ' + e.shopId}</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>{e.category}</td>
                      <td>{e.expenseReason}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                        ₹{Number(e.expenseAmount).toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(Number(e.expenseAmount)) ? 0 : 2 })}
                      </td>
                      <td>{e.paymentMode}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {e.paidTo ? <strong>{e.paidTo} - </strong> : null}
                        {e.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        paymentModeData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                Cash Collections
              </h3>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a' }}>
                ₹{paymentModeData.cash.total.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                {paymentModeData.cash.count} cash transactions
              </span>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                GPay / UPI Digital Collections
              </h3>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb' }}>
                ₹{paymentModeData.gpay.total.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                {paymentModeData.gpay.count} digital transactions
              </span>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                Total Revenue
              </h3>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-brand, #176B52)' }}>
                ₹{paymentModeData.totalAmount.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                {paymentModeData.totalTransactions} total transactions recorded
              </span>
            </div>
          </div>
        )
      )}
    </div>
  );
};
