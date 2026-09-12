import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Trash2,
  Edit2,
  RotateCcw,
  AlertTriangle,
  Building2,
  Store
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { rentalApi } from '../services/rentalApi';
import { RentalExpense, RentalComplex, RentalShop, ExpenseCategory, ExpenseScope } from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { ExpenseModal } from '../components/ExpenseModal';

const CATEGORIES: ExpenseCategory[] = [
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
];

export const RentalExpenses: React.FC = () => {
  const { showToast } = useApp();

  const [expenses, setExpenses] = useState<RentalExpense[]>([]);
  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [shops, setShops] = useState<RentalShop[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedComplex, setSelectedComplex] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RentalExpense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const [eRes, cRes, sRes] = await Promise.all([
        rentalApi.getExpenses({
          complexId: selectedComplex || undefined,
          scope: (selectedScope as ExpenseScope) || undefined,
          category: (selectedCategory as ExpenseCategory) || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: search || undefined
        }),
        rentalApi.getComplexes(),
        rentalApi.getShops()
      ]);

      if (eRes.success && eRes.data) {
        let list = eRes.data;
        if (selectedPaymentMode) {
          list = list.filter((e) => e.paymentMode === selectedPaymentMode);
        }
        setExpenses(list);
      }
      if (cRes.success && cRes.data) setComplexes(cRes.data);
      if (sRes.success && sRes.data) setShops(sRes.data);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedComplex, selectedScope, selectedCategory, selectedPaymentMode, startDate, endDate]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchExpenses();
    };
    window.addEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
    window.addEventListener('kkv_rental_data_changed', handleRefresh);
    return () => {
      window.removeEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
      window.removeEventListener('kkv_rental_data_changed', handleRefresh);
    };
  }, [selectedComplex, selectedScope, selectedCategory, selectedPaymentMode, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExpenses();
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedComplex('');
    setSelectedScope('');
    setSelectedCategory('');
    setSelectedPaymentMode('');
    setStartDate('');
    setEndDate('');
  };

  const handleSaveExpense = async (data: any) => {
    if (editingExpense) {
      const res = await rentalApi.updateExpense(editingExpense.expenseId, data);
      if (res.success) {
        showToast(res.message || 'Expense updated', 'success');
        await fetchExpenses();
      } else {
        throw new Error(res.message || 'Failed to update expense');
      }
    } else {
      const res = await rentalApi.createExpense(data);
      if (res.success) {
        showToast(res.message || 'Expense recorded', 'success');
        await fetchExpenses();
      } else {
        throw new Error(res.message || 'Failed to record expense');
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingExpenseId) return;
    try {
      const res = await rentalApi.deleteExpense(deletingExpenseId);
      if (res.success) {
        showToast('Expense deleted successfully', 'success');
        setDeletingExpenseId(null);
        await fetchExpenses();
      } else {
        showToast(res.message || 'Delete failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error deleting expense', 'error');
    }
  };

  const formatAmount = (val: number) => {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
      maximumFractionDigits: 2
    });
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + (Number(e.expenseAmount) || 0), 0);
  const complexExpensesAmount = expenses
    .filter((e) => e.expenseScope === 'COMPLEX' || !e.shopId)
    .reduce((sum, e) => sum + (Number(e.expenseAmount) || 0), 0);
  const shopExpensesAmount = expenses
    .filter((e) => e.expenseScope === 'SHOP' && e.shopId)
    .reduce((sum, e) => sum + (Number(e.expenseAmount) || 0), 0);
  const totalCash = expenses.reduce((sum, e) => sum + (Number(e.cashAmount) || 0), 0);
  const totalGPay = expenses.reduce((sum, e) => sum + (Number(e.gpayAmount) || 0), 0);

  return (
    <div className="page-content">
      <RentalHeader
        title="Complex & Shop Expenses"
        subtitle="Manage overall complex maintenance, staff expenses, utilities, emergency repairs, and shop-specific costs"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingExpense(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={15} />
            <span>+ Record Expense</span>
          </button>
        }
      />

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        <div className="card" style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.06)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            TOTAL EXPENSES
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
            ₹{formatAmount(totalExpenseAmount)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {expenses.length} Total Records
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', backgroundColor: 'rgba(147, 51, 234, 0.06)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase' }}>
            COMPLEX OPERATING EXPENSES
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#9333ea', marginTop: '2px' }}>
            ₹{formatAmount(complexExpensesAmount)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            General Facility / Common
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', backgroundColor: 'rgba(245, 158, 11, 0.06)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
            SHOP SPECIFIC EXPENSES
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
            ₹{formatAmount(shopExpensesAmount)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Tenant & Shop Units
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', backgroundColor: 'rgba(34, 197, 94, 0.06)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            PAID IN CASH
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
            ₹{formatAmount(totalCash)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Cash Drawer Outflow
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', backgroundColor: 'rgba(37, 99, 235, 0.06)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
            PAID VIA GPAY / UPI
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
            ₹{formatAmount(totalGPay)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Online Bank Outflow
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: '220px', gap: '6px' }}>
            <input
              type="text"
              className="input-control"
              placeholder="Search by Expense ID, Reason, Category, Paid To..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '0 12px' }}>
              <Search size={14} />
            </button>
          </form>

          <select
            className="select-control"
            style={{ width: '150px', height: '34px', fontSize: '12px' }}
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

          <select
            className="select-control"
            style={{ width: '140px', height: '34px', fontSize: '12px' }}
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
          >
            <option value="">All Scopes</option>
            <option value="COMPLEX">Complex Expense</option>
            <option value="SHOP">Shop Expense</option>
            <option value="RENTAL">General Rental</option>
          </select>

          <select
            className="select-control"
            style={{ width: '160px', height: '34px', fontSize: '12px' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            className="select-control"
            style={{ width: '130px', height: '34px', fontSize: '12px' }}
            value={selectedPaymentMode}
            onChange={(e) => setSelectedPaymentMode(e.target.value)}
          >
            <option value="">All Modes</option>
            <option value="CASH">CASH</option>
            <option value="GPAY">GPAY / UPI</option>
            <option value="BOTH">BOTH (Split)</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From:</span>
            <input
              type="date"
              className="input-control"
              style={{ width: '130px', height: '34px', fontSize: '12px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>To:</span>
            <input
              type="date"
              className="input-control"
              style={{ width: '130px', height: '34px', fontSize: '12px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleResetFilters}
            title="Reset Filters"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card" style={{ padding: '18px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Receipt size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No expenses found matching the criteria</p>
          </div>
        ) : (
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
                  <th>REASON / DETAILS</th>
                  <th style={{ textAlign: 'right' }}>AMOUNT</th>
                  <th>PAYMENT MODE</th>
                  <th>PAID TO / NOTES</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const isComplexScope = e.expenseScope === 'COMPLEX' || (!e.shopId && e.expenseScope !== 'SHOP');
                  return (
                    <tr key={e.expenseId}>
                      <td style={{ fontWeight: 800, color: 'var(--color-gold-light)' }}>{e.expenseId}</td>
                      <td>{e.expenseDate}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: isComplexScope ? 'rgba(147, 51, 234, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            color: isComplexScope ? '#a855f7' : '#f59e0b'
                          }}
                        >
                          {isComplexScope ? <Building2 size={11} /> : <Store size={11} />}
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
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {e.shopNumber || 'Shop ' + e.shopId}
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>{e.category}</td>
                      <td>{e.expenseReason}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                        ₹{formatAmount(e.expenseAmount)}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '10.5px',
                            background: 'var(--bg-surface-secondary)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}
                        >
                          {e.paymentMode}
                          {e.paymentMode === 'BOTH' && ` (C: ₹${formatAmount(e.cashAmount)} G: ₹${formatAmount(e.gpayAmount)})`}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {e.paidTo ? <strong>{e.paidTo} - </strong> : null}
                        {e.notes || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            style={{ padding: '2px 6px' }}
                            onClick={() => {
                              setEditingExpense(e);
                              setIsModalOpen(true);
                            }}
                            title="Edit Expense"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            style={{ padding: '2px 6px', color: '#dc2626' }}
                            onClick={() => setDeletingExpenseId(e.expenseId)}
                            title="Delete Expense"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveExpense}
        complexes={complexes}
        shops={shops}
        expenseToEdit={editingExpense}
      />

      {/* Delete Confirmation Modal */}
      {deletingExpenseId && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px', padding: '20px', textAlign: 'center' }}>
            <AlertTriangle size={36} color="#dc2626" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
              Confirm Expense Deletion
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
              Are you sure you want to delete expense <strong>{deletingExpenseId}</strong>? This action will be recorded in the audit trail.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingExpenseId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ backgroundColor: '#dc2626', color: '#fff' }}
                onClick={handleConfirmDelete}
              >
                Delete Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

