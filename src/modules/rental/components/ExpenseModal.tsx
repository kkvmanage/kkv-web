import React, { useState, useEffect } from 'react';
import { X, Receipt, Building2, Store, FileText } from 'lucide-react';
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
    complexId: string;
    expenseScope: ExpenseScope;
    shopId?: string;
    expenseDate: string;
    category: ExpenseCategory;
    expenseReason: string;
    expenseAmount: number;
    paymentMode: PaymentMode;
    cashAmount?: number;
    gpayAmount?: number;
    receiptUrl?: string;
    notes?: string;
  }) => Promise<void>;
  complexes: RentalComplex[];
  shops: RentalShop[];
  expenseToEdit?: RentalExpense | null;
  defaultComplexId?: string;
  defaultScope?: ExpenseScope;
  defaultShopId?: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Staff Food / Tea',
  'Cleaning',
  'Maintenance',
  'Security',
  'Electricity',
  'Water',
  'Plumbing',
  'Electrical',
  'Lift Maintenance',
  'Generator / Fuel',
  'Labour',
  'Technician',
  'Office Expense',
  'Transportation',
  'Stationery',
  'Waste Management',
  'Emergency Expense',
  'Miscellaneous',
  'Repair',
  'Other'
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  complexes,
  shops,
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

  const [complexId, setComplexId] = useState('');
  const [expenseScope, setExpenseScope] = useState<ExpenseScope>('COMPLEX');
  const [shopId, setShopId] = useState('');
  const [expenseDate, setExpenseDate] = useState(getToday());
  const [category, setCategory] = useState<ExpenseCategory>('Staff Food / Tea');
  const [expenseReason, setExpenseReason] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [gpayAmount, setGpayAmount] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredShops = shops.filter((s) => s.complexId === complexId && s.status === 'ACTIVE');

  useEffect(() => {
    if (expenseToEdit) {
      setComplexId(expenseToEdit.complexId);
      setExpenseScope(expenseToEdit.expenseScope || (expenseToEdit.shopId ? 'SHOP' : 'COMPLEX'));
      setShopId(expenseToEdit.shopId || '');
      setExpenseDate(expenseToEdit.expenseDate);
      setCategory(expenseToEdit.category || 'Maintenance');
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
      setReceiptUrl(expenseToEdit.receiptUrl || '');
      setNotes(expenseToEdit.notes || '');
    } else {
      const initComplex = defaultComplexId || complexes[0]?.complexId || '';
      setComplexId(initComplex);
      const initScope = defaultScope || (defaultShopId ? 'SHOP' : 'COMPLEX');
      setExpenseScope(initScope);
      setShopId(defaultShopId || '');
      setExpenseDate(getToday());
      setCategory('Staff Food / Tea');
      setExpenseReason('');
      setExpenseAmount('');
      setPaymentMode('CASH');
      setCashAmount('');
      setGpayAmount('');
      setReceiptUrl('');
      setNotes('');
    }
    setError('');
  }, [expenseToEdit, isOpen, defaultComplexId, defaultScope, defaultShopId, complexes]);

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
  const isSplitMismatch = paymentMode === 'BOTH' && Math.abs(numCash + numGpay - numAmt) > 0.01;

  const getReasonPlaceholder = () => {
    switch (category) {
      case 'Staff Food / Tea':
        return 'e.g. Tea & snacks for security and maintenance staff';
      case 'Cleaning':
        return 'e.g. Cleaning materials, floor wash chemicals, mops';
      case 'Generator / Fuel':
        return 'e.g. 20L diesel purchased for emergency power backup generator';
      case 'Plumbing':
        return 'e.g. Common bathroom valve replacement and pipe leakage fix';
      case 'Electrical':
        return 'e.g. Replacement of corridor LED lights and circuit breaker';
      case 'Lift Maintenance':
        return 'e.g. Monthly lift servicing charges & lubrication';
      case 'Security':
        return 'e.g. Security guard monthly uniform & equipment';
      case 'Electricity':
        return 'e.g. Common area & pump motor EB meter bill';
      case 'Water':
        return 'e.g. Drinking water cans & water tanker delivery';
      case 'Labour':
        return 'e.g. Daily wage labour for terrace drain clearing';
      case 'Technician':
        return 'e.g. Motor pump technician visit fee';
      case 'Office Expense':
        return 'e.g. Manager office stationery, register books & files';
      case 'Waste Management':
        return 'e.g. Monthly commercial garbage clearance payment';
      case 'Emergency Expense':
        return 'e.g. Emergency water pipe burst repair at night';
      default:
        return 'e.g. Plumber payment for common bathroom repair';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complexId) {
      setError('Please select a complex');
      return;
    }

    if (expenseScope === 'SHOP' && !shopId) {
      setError('Please select a Shop/Tenant for shop-level expenses');
      return;
    }

    if (!category) {
      setError('Please select an expense category');
      return;
    }

    if (!expenseReason.trim()) {
      setError('Please enter an expense reason or description');
      return;
    }

    if (numAmt <= 0) {
      setError('Expense amount must be greater than zero');
      return;
    }

    if (paymentMode === 'BOTH' && isSplitMismatch) {
      setError(
        `Cash amount (₹${numCash}) + GPay amount (₹${numGpay}) must equal total expense (₹${numAmt})`
      );
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onSave({
        complexId,
        expenseScope,
        shopId: expenseScope === 'SHOP' ? shopId : undefined,
        expenseDate,
        category,
        expenseReason: expenseReason.trim(),
        expenseAmount: numAmt,
        paymentMode,
        cashAmount: paymentMode === 'CASH' ? numAmt : paymentMode === 'GPAY' ? 0 : numCash,
        gpayAmount: paymentMode === 'GPAY' ? numAmt : paymentMode === 'CASH' ? 0 : numGpay,
        receiptUrl: receiptUrl.trim() || undefined,
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
      <div className="modal-content" style={{ maxWidth: '560px', padding: 0 }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {expenseToEdit ? `Edit Expense (${expenseToEdit.expenseId})` : 'Record Complex & Facility Expense'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#dc2626',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Expense Scope Selector */}
            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
                EXPENSE SCOPE *
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '8px',
                  backgroundColor: 'var(--bg-surface-secondary, #f1f5f9)',
                  padding: '4px',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpenseScope('COMPLEX');
                    setShopId('');
                  }}
                  style={{
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    backgroundColor: expenseScope === 'COMPLEX' ? 'var(--primary, #176B52)' : 'transparent',
                    color: expenseScope === 'COMPLEX' ? '#ffffff' : 'var(--text-secondary, #475569)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Building2 size={13} />
                  <span>Complex Expense</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExpenseScope('SHOP')}
                  style={{
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    backgroundColor: expenseScope === 'SHOP' ? 'var(--primary, #176B52)' : 'transparent',
                    color: expenseScope === 'SHOP' ? '#ffffff' : 'var(--text-secondary, #475569)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Store size={13} />
                  <span>Shop / Tenant</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExpenseScope('RENTAL')}
                  style={{
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    backgroundColor: expenseScope === 'RENTAL' ? 'var(--primary, #176B52)' : 'transparent',
                    color: expenseScope === 'RENTAL' ? '#ffffff' : 'var(--text-secondary, #475569)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <FileText size={13} />
                  <span>Rental-related</span>
                </button>
              </div>
            </div>

            {/* Complex and Shop Dropdowns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  COMPLEX / BRANCH *
                </label>
                <select
                  className="select-control"
                  value={complexId}
                  onChange={(e) => {
                    setComplexId(e.target.value);
                    setShopId('');
                  }}
                  required
                >
                  <option value="">-- Select Complex --</option>
                  {complexes.map((c) => (
                    <option key={c.complexId} value={c.complexId}>
                      {c.complexName} ({c.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  {expenseScope === 'SHOP' ? 'SHOP / TENANT *' : 'SHOP / TENANT'}
                </label>
                {expenseScope === 'COMPLEX' || expenseScope === 'RENTAL' ? (
                  <div
                    style={{
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '12px',
                      color: 'var(--text-muted, #64748b)',
                      fontWeight: 600
                    }}
                  >
                    🏢 General Complex Expense
                  </div>
                ) : (
                  <select
                    className="select-control"
                    value={shopId}
                    onChange={(e) => setShopId(e.target.value)}
                    required={expenseScope === 'SHOP'}
                  >
                    <option value="">-- Select Shop / Tenant --</option>
                    {filteredShops.map((s) => (
                      <option key={s.shopId} value={s.shopId}>
                        {s.shopNumber} - {s.shopName} ({s.tenantName})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Category and Date Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  EXPENSE CATEGORY *
                </label>
                <select
                  className="select-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  required
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  EXPENSE DATE *
                </label>
                <input
                  type="date"
                  className="input-control"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Expense Description / Reason */}
            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                EXPENSE DESCRIPTION / REASON *
              </label>
              <input
                type="text"
                className="input-control"
                placeholder={getReasonPlaceholder()}
                value={expenseReason}
                onChange={(e) => setExpenseReason(e.target.value)}
                required
              />
            </div>

            {/* Expense Amount */}
            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                EXPENSE AMOUNT (₹) *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                className="input-control"
                placeholder="e.g. 546.75 or 1500"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
                style={{ fontSize: '15px', fontWeight: 800 }}
              />
            </div>

            {/* Payment Mode Selection */}
            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
                PAYMENT MODE
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="expensePaymentMode"
                    value="CASH"
                    checked={paymentMode === 'CASH'}
                    onChange={() => setPaymentMode('CASH')}
                  />
                  <span>Cash</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="expensePaymentMode"
                    value="GPAY"
                    checked={paymentMode === 'GPAY'}
                    onChange={() => setPaymentMode('GPAY')}
                  />
                  <span>GPay / UPI</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="expensePaymentMode"
                    value="BOTH"
                    checked={paymentMode === 'BOTH'}
                    onChange={() => setPaymentMode('BOTH')}
                  />
                  <span>Both (Split Payment)</span>
                </label>
              </div>
            </div>

            {/* Split Fields if BOTH */}
            {paymentMode === 'BOTH' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(23, 107, 82, 0.04)',
                  borderRadius: 'var(--radius-md)',
                  border: isSplitMismatch ? '1px solid #ef4444' : '1px solid rgba(23, 107, 82, 0.2)'
                }}
              >
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    CASH PAID (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input-control"
                    placeholder="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    GPAY PAID (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input-control"
                    placeholder="0"
                    value={gpayAmount}
                    onChange={(e) => setGpayAmount(e.target.value)}
                    required
                  />
                </div>
                {isSplitMismatch && (
                  <span style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                    ⚠️ Split sum (₹{numCash + numGpay}) does not equal total expense (₹{numAmt})
                  </span>
                )}
              </div>
            )}

            {/* Receipt URL / Reference */}
            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                RECEIPT / INVOICE ATTACHMENT (OPTIONAL)
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. Receipt #REC-8841 or https://invoice-link.pdf"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                NOTES / REMARKS (OPTIONAL)
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. Paid directly to technician, bill approved by complex manager"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (paymentMode === 'BOTH' && isSplitMismatch)}
            >
              {loading
                ? 'Saving...'
                : expenseToEdit
                ? 'Update Expense'
                : numAmt > 0
                ? `Record Expense (₹${numAmt.toLocaleString('en-IN')})`
                : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
