import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Trash2,
  Edit2,
  RotateCcw,
  AlertTriangle,
  Banknote,
  Smartphone,
  ArrowLeftRight
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { rentalApi } from '../services/rentalApi';
import { RentalExpense, RentalComplex, RentalShop, PaymentMode } from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { ExpenseModal } from '../components/ExpenseModal';

export const RentalExpenses: React.FC = () => {
  const { showToast } = useApp();

  const [expenses, setExpenses] = useState<RentalExpense[]>([]);
  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [shops, setShops] = useState<RentalShop[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
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
          paymentMode: (selectedPaymentMode as PaymentMode) || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: search || undefined
        }),
        rentalApi.getComplexes(),
        rentalApi.getShops()
      ]);

      if (eRes.success && eRes.data) {
        setExpenses(eRes.data);
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
  }, [selectedPaymentMode, startDate, endDate]);

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
  }, [selectedPaymentMode, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExpenses();
  };

  const handleResetFilters = () => {
    setSearch('');
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
  const totalCash = expenses.reduce((sum, e) => sum + (Number(e.cashAmount) || 0), 0);
  const totalGPay = expenses.reduce((sum, e) => sum + (Number(e.gpayAmount) || 0), 0);

  return (
    <div className="page-content">
      <RentalHeader
        title="Rental Expenses"
        subtitle="Record and manage operating expenses for the rental business."
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '16px'
        }}
      >
        <div className="card" style={{ padding: '14px 18px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderLeft: '4px solid #dc2626' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            TOTAL EXPENSES
          </span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
            ₹{formatAmount(totalExpenseAmount)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
            {expenses.length} Total Records
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', backgroundColor: 'rgba(34, 197, 94, 0.05)', borderLeft: '4px solid #16a34a' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            PAID IN CASH
          </span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
            ₹{formatAmount(totalCash)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Cash Outflow
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', backgroundColor: 'rgba(37, 99, 235, 0.05)', borderLeft: '4px solid #2563eb' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            PAID VIA GPAY / UPI
          </span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
            ₹{formatAmount(totalGPay)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Digital Bank Outflow
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: '220px', gap: '6px' }}>
            <input
              type="text"
              className="input-control"
              placeholder="Search description, reason, expense ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: '12.5px' }}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '0 12px' }}>
              <Search size={14} />
            </button>
          </form>

          <select
            className="select-control"
            style={{ width: '150px', height: '36px', fontSize: '12.5px' }}
            value={selectedPaymentMode}
            onChange={(e) => setSelectedPaymentMode(e.target.value)}
          >
            <option value="">All Payment Modes</option>
            <option value="CASH">Cash Only</option>
            <option value="GPAY">GPay / UPI Only</option>
            <option value="BOTH">Both (Split)</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>From:</span>
            <input
              type="date"
              className="input-control"
              style={{ width: '135px', height: '36px', fontSize: '12px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>To:</span>
            <input
              type="date"
              className="input-control"
              style={{ width: '135px', height: '36px', fontSize: '12px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleResetFilters}
            title="Reset Filters"
            style={{ height: '36px' }}
          >
            <RotateCcw size={13} />
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
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px'
              }}
            >
              <Receipt size={28} color="#dc2626" style={{ opacity: 0.8 }} />
            </div>
            <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
              No Rental Expenses
            </h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              Record your first rental operating expense.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingExpense(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={14} />
              <span>Record Expense</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ fontSize: '12.5px' }}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>EXPENSE ID</th>
                  <th style={{ width: '110px' }}>DATE</th>
                  <th>DESCRIPTION / REASON</th>
                  <th style={{ textAlign: 'right', width: '120px' }}>AMOUNT</th>
                  <th style={{ width: '160px' }}>PAYMENT MODE</th>
                  <th>RECORDED BY / NOTES</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.expenseId}>
                    <td style={{ fontWeight: 800, color: 'var(--color-gold-light, #b45309)' }}>
                      {e.expenseId}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.expenseDate}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {e.expenseReason}
                      </div>
                      {e.category && e.category !== 'General' && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Category: {e.category}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: '13px' }}>
                      ₹{formatAmount(e.expenseAmount)}
                    </td>
                    <td>
                      {e.paymentMode === 'CASH' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(22, 163, 74, 0.1)',
                            color: '#16a34a'
                          }}
                        >
                          <Banknote size={12} />
                          Cash
                        </span>
                      ) : e.paymentMode === 'GPAY' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(37, 99, 235, 0.1)',
                            color: '#2563eb'
                          }}
                        >
                          <Smartphone size={12} />
                          GPay / UPI
                        </span>
                      ) : (
                        <div>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(147, 51, 234, 0.1)',
                              color: '#9333ea'
                            }}
                          >
                            <ArrowLeftRight size={12} />
                            Both (Split)
                          </span>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Cash: ₹{formatAmount(e.cashAmount)} | UPI: ₹{formatAmount(e.gpayAmount)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                      {e.notes ? (
                        <div>{e.notes}</div>
                      ) : null}
                      {e.createdBy ? (
                        <span style={{ fontSize: '10.5px', opacity: 0.75 }}>By: {e.createdBy}</span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '4px 8px' }}
                          onClick={() => {
                            setEditingExpense(e);
                            setIsModalOpen(true);
                          }}
                          title="Edit Expense"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '4px 8px', color: '#dc2626' }}
                          onClick={() => setDeletingExpenseId(e.expenseId)}
                          title="Delete Expense"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
