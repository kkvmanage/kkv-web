import React, { useState, useEffect } from 'react';
import { X, Receipt, Banknote, Smartphone, ArrowLeftRight } from 'lucide-react';
import {
  RentalExpense,
  RentalComplex,
  RentalShop,
  ExpenseCategory,
  ExpenseScope,
  PaymentMode
} from '../types/rental.types';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    complexId?: string | null;
    expenseScope?: ExpenseScope;
    shopId?: string | null;
    expenseDate: string;
    category?: ExpenseCategory | string;
    expenseReason: string;
    expenseAmount: number;
    paymentMode: PaymentMode;
    cashAmount?: number;
    gpayAmount?: number;
    receiptUrl?: string;
    notes?: string;
  }) => Promise<void>;
  complexes?: RentalComplex[];
  shops?: RentalShop[];
  expenseToEdit?: RentalExpense | null;
  defaultComplexId?: string;
  defaultScope?: ExpenseScope;
  defaultShopId?: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  expenseToEdit,
  defaultComplexId,
  defaultScope,
  defaultShopId
}) => {
  const getToday = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [expenseDate, setExpenseDate] = useState(getToday());
  const [expenseReason, setExpenseReason] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [gpayAmount, setGpayAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Retain historical complex/shop/category if editing an existing record
  const [historicalComplexId, setHistoricalComplexId] = useState<string | null>(null);
  const [historicalShopId, setHistoricalShopId] = useState<string | null>(null);
  const [historicalScope, setHistoricalScope] = useState<ExpenseScope | undefined>(undefined);
  const [category, setCategory] = useState<string>('General');

  useEffect(() => {
    if (expenseToEdit) {
      setExpenseDate(expenseToEdit.expenseDate || getToday());
      setExpenseReason(expenseToEdit.expenseReason || '');
      setExpenseAmount(
        expenseToEdit.expenseAmount !== undefined && expenseToEdit.expenseAmount !== null
          ? String(expenseToEdit.expenseAmount)
          : ''
      );
      setPaymentMode(expenseToEdit.paymentMode || 'CASH');
      setCashAmount(
        expenseToEdit.cashAmount !== undefined && expenseToEdit.cashAmount !== null
          ? String(expenseToEdit.cashAmount)
          : ''
      );
      setGpayAmount(
        expenseToEdit.gpayAmount !== undefined && expenseToEdit.gpayAmount !== null
          ? String(expenseToEdit.gpayAmount)
          : ''
      );
      setNotes(expenseToEdit.notes || '');
      setCategory(expenseToEdit.category || 'General');
      setHistoricalComplexId(expenseToEdit.complexId || null);
      setHistoricalShopId(expenseToEdit.shopId || null);
      setHistoricalScope(expenseToEdit.expenseScope);
    } else {
      setExpenseDate(getToday());
      setExpenseReason('');
      setExpenseAmount('');
      setPaymentMode('CASH');
      setCashAmount('');
      setGpayAmount('');
      setNotes('');
      setCategory('General');
      setHistoricalComplexId(defaultComplexId || null);
      setHistoricalShopId(defaultShopId || null);
      setHistoricalScope(defaultScope);
    }
    setError('');
  }, [expenseToEdit, isOpen, defaultComplexId, defaultScope, defaultShopId]);

  // Keep single payment mode amounts aligned automatically
  useEffect(() => {
    if (paymentMode === 'CASH') {
      setCashAmount(expenseAmount);
      setGpayAmount('');
    } else if (paymentMode === 'GPAY') {
      setCashAmount('');
      setGpayAmount(expenseAmount);
    }
  }, [expenseAmount, paymentMode]);

  if (!isOpen) return null;

  const numAmt = parseFloat(expenseAmount) || 0;
  const numCash = parseFloat(cashAmount) || 0;
  const numGpay = parseFloat(gpayAmount) || 0;
  const splitSum = numCash + numGpay;
  const isSplitMismatch = paymentMode === 'BOTH' && Math.abs(splitSum - numAmt) > 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!expenseDate) {
      setError('Expense date is required');
      return;
    }

    if (!expenseReason.trim()) {
      setError('Please enter what the expense was for / reason');
      return;
    }

    if (isNaN(numAmt) || numAmt <= 0) {
      setError('Please enter a valid expense amount greater than zero');
      return;
    }

    if (paymentMode === 'BOTH') {
      if (numCash < 0 || numGpay < 0) {
        setError('Cash and GPay amounts cannot be negative');
        return;
      }
      if (isSplitMismatch) {
        setError(
          `Split payment amounts (Cash: ₹${numCash.toLocaleString('en-IN')} + GPay: ₹${numGpay.toLocaleString('en-IN')} = ₹${splitSum.toLocaleString('en-IN')}) must equal the total expense amount (₹${numAmt.toLocaleString('en-IN')}).`
        );
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      await onSave({
        complexId: historicalComplexId || undefined,
        shopId: historicalShopId || undefined,
        expenseScope: historicalScope,
        category,
        expenseDate,
        expenseReason: expenseReason.trim(),
        expenseAmount: numAmt,
        paymentMode,
        cashAmount: paymentMode === 'CASH' ? numAmt : paymentMode === 'GPAY' ? 0 : numCash,
        gpayAmount: paymentMode === 'GPAY' ? numAmt : paymentMode === 'CASH' ? 0 : numGpay,
        notes: notes.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: 0,
          borderRadius: 'var(--radius-lg, 12px)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl, 0 20px 30px rgba(0,0,0,0.25))',
          backgroundColor: 'var(--bg-card, #ffffff)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Receipt size={18} color="#dc2626" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                {expenseToEdit ? 'Edit Rental Expense' : 'Record Rental Expense'}
              </h3>
              <p style={{ fontSize: '11px', margin: 0, color: 'var(--text-muted, #64748b)' }}>
                {expenseToEdit ? `Updating ${expenseToEdit.expenseId}` : 'Add general operating expense for rental management'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body & Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto'
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md, 8px)',
                color: '#dc2626',
                fontSize: '12px',
                fontWeight: 600,
                lineHeight: 1.4
              }}
            >
              {error}
            </div>
          )}

          {/* Expense Date */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 700,
                color: 'var(--text-secondary, #475569)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}
            >
              Expense Date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="date"
              className="input-control"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
              style={{
                width: '100%',
                height: '40px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                backgroundColor: 'var(--input-bg, var(--bg-card))',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Expense Reason / Description */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 700,
                color: 'var(--text-secondary, #475569)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}
            >
              Description / Reason <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="e.g. Staff tea, cleaning materials, electricity repair..."
              value={expenseReason}
              onChange={(e) => setExpenseReason(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                height: '40px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                backgroundColor: 'var(--input-bg, var(--bg-card))',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Expense Amount */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 700,
                color: 'var(--text-secondary, #475569)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}
            >
              Expense Amount (₹) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: 'var(--text-muted, #64748b)'
                }}
              >
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                className="input-control"
                placeholder="0.00"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
                style={{
                  width: '100%',
                  height: '40px',
                  paddingLeft: '28px',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  backgroundColor: 'var(--input-bg, var(--bg-card))',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          {/* Payment Mode Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 700,
                color: 'var(--text-secondary, #475569)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}
            >
              Payment Mode <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px'
              }}
            >
              <button
                type="button"
                onClick={() => setPaymentMode('CASH')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: paymentMode === 'CASH' ? '2px solid #16a34a' : '1px solid var(--border-subtle, #e2e8f0)',
                  backgroundColor: paymentMode === 'CASH' ? 'rgba(22, 163, 74, 0.08)' : 'var(--bg-surface, #f8fafc)',
                  color: paymentMode === 'CASH' ? '#16a34a' : 'var(--text-secondary, #475569)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Banknote size={15} />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('GPAY')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: paymentMode === 'GPAY' ? '2px solid #2563eb' : '1px solid var(--border-subtle, #e2e8f0)',
                  backgroundColor: paymentMode === 'GPAY' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface, #f8fafc)',
                  color: paymentMode === 'GPAY' ? '#2563eb' : 'var(--text-secondary, #475569)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Smartphone size={15} />
                <span>GPay / UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('BOTH')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: paymentMode === 'BOTH' ? '2px solid #9333ea' : '1px solid var(--border-subtle, #e2e8f0)',
                  backgroundColor: paymentMode === 'BOTH' ? 'rgba(147, 51, 234, 0.08)' : 'var(--bg-surface, #f8fafc)',
                  color: paymentMode === 'BOTH' ? '#9333ea' : 'var(--text-secondary, #475569)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <ArrowLeftRight size={15} />
                <span>Both (Split)</span>
              </button>
            </div>
          </div>

          {/* Split Payment Fields (When BOTH is chosen) */}
          {paymentMode === 'BOTH' && (
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)'
                }}
              >
                <span>SPLIT BREAKDOWN</span>
                <span
                  style={{
                    color: isSplitMismatch ? '#dc2626' : '#16a34a',
                    fontWeight: 800
                  }}
                >
                  ₹{splitSum.toLocaleString('en-IN')} / ₹{numAmt.toLocaleString('en-IN')}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      marginBottom: '4px'
                    }}
                  >
                    Cash Amount (₹) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input-control"
                    placeholder="0.00"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '36px',
                      fontSize: '13px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      marginBottom: '4px'
                    }}
                  >
                    GPay / UPI Amount (₹) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input-control"
                    placeholder="0.00"
                    value={gpayAmount}
                    onChange={(e) => setGpayAmount(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '36px',
                      fontSize: '13px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              {isSplitMismatch && (
                <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                  ⚠️ Cash + GPay must equal the total expense of ₹{numAmt.toLocaleString('en-IN')}. Current difference: ₹{Math.abs(numAmt - splitSum).toLocaleString('en-IN')}.
                </div>
              )}
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'var(--text-muted, #64748b)',
                marginBottom: '4px'
              }}
            >
              Notes / Remarks <span style={{ fontSize: '10.5px' }}>(Optional)</span>
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="e.g. Paid to Ramu Plumber / Bill attached"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                fontSize: '12.5px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                backgroundColor: 'var(--input-bg, var(--bg-card))',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Form Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle, #e2e8f0)'
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || isSplitMismatch}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary-accent, #0f766e)'
              }}
            >
              {loading ? 'Saving...' : expenseToEdit ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
