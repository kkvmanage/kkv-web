import React, { useState, useEffect } from 'react';
import { X, CreditCard } from 'lucide-react';
import { RentalComplex, RentalShop, PaymentMode } from '../types/rental.types';
import { rentalApi } from '../services/rentalApi';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  complexes: RentalComplex[];
  shops: RentalShop[];
  defaultComplexId?: string;
  defaultShopId?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  complexes,
  shops,
  defaultComplexId,
  defaultShopId
}) => {
  const getToday = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const [selectedComplexId, setSelectedComplexId] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [paymentMonth, setPaymentMonth] = useState(getCurrentMonth());
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [advanceToUse, setAdvanceToUse] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [gpayAmount, setGpayAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [notes, setNotes] = useState('');

  const [shopStatusData, setShopStatusData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const filteredShops = shops.filter(
    (s) => s.status === 'ACTIVE' && (!selectedComplexId || s.complexId === selectedComplexId)
  );

  const selectedShop = shops.find((s) => s.shopId === selectedShopId);

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      const initialComplex = defaultComplexId || complexes[0]?.complexId || '';
      setSelectedComplexId(initialComplex);

      const validShops = shops.filter((s) => s.status === 'ACTIVE' && s.complexId === initialComplex);
      const initialShop = defaultShopId || validShops[0]?.shopId || '';
      setSelectedShopId(initialShop);

      setPaymentMonth(getCurrentMonth());
      setAmountReceived('');
      setAdvanceToUse('');
      setPaymentMode('CASH');
      setCashAmount('');
      setGpayAmount('');
      setPaymentDate(getToday());
      setNotes('');
      setError('');
    }
  }, [isOpen, defaultComplexId, defaultShopId, complexes, shops]);

  // Load live shop monthly status whenever shop or month changes
  useEffect(() => {
    if (selectedShopId && paymentMonth) {
      rentalApi
        .getShopMonthlyStatus(selectedShopId, paymentMonth)
        .then((res) => {
          if (res.success && res.data) {
            setShopStatusData(res.data);
            // Default amount received to outstanding balance if empty
            if (amountReceived === '' && res.data.outstandingBalance > 0) {
              setAmountReceived(String(res.data.outstandingBalance));
            }
          }
        })
        .catch(() => {});
    } else {
      setShopStatusData(null);
    }
  }, [selectedShopId, paymentMonth]);

  // Update split amounts when amount received or payment mode changes
  useEffect(() => {
    if (amountReceived === '') {
      if (paymentMode === 'CASH') {
        setCashAmount('');
        setGpayAmount('0');
      } else if (paymentMode === 'GPAY') {
        setCashAmount('0');
        setGpayAmount('');
      }
      return;
    }

    const amt = parseFloat(amountReceived) || 0;
    if (paymentMode === 'CASH') {
      setCashAmount(amountReceived);
      setGpayAmount('0');
    } else if (paymentMode === 'GPAY') {
      setCashAmount('0');
      setGpayAmount(amountReceived);
    } else if (paymentMode === 'BOTH') {
      // Keep split if already entered, or split 50-50
      if (!cashAmount && !gpayAmount && amt > 0) {
        const half = Number((amt / 2).toFixed(2));
        setCashAmount(String(half));
        setGpayAmount(String(Number((amt - half).toFixed(2))));
      }
    }
  }, [amountReceived, paymentMode]);

  if (!isOpen) return null;

  // Calculate live preview
  const numMonthlyRent = selectedShop?.monthlyRent || 0;
  const numAmountReceived = Number(amountReceived) || 0;
  const numAdvanceToUse = Number(advanceToUse) || 0;
  const availableAdvance = selectedShop?.availableAdvance || 0;

  const priorPaid = shopStatusData ? shopStatusData.amountPaid + shopStatusData.advanceUsed : 0;
  const dueBeforeThis = Math.max(0, numMonthlyRent - priorPaid);

  const actualAdvanceUsed = Math.min(numAdvanceToUse, dueBeforeThis);
  const dueAfterAdvance = Math.max(0, dueBeforeThis - actualAdvanceUsed);

  const rentCovered = Math.min(numAmountReceived, dueAfterAdvance);
  const advanceGenerated = Math.max(0, numAmountReceived - dueAfterAdvance);
  const finalBalance = Math.max(0, dueAfterAdvance - rentCovered);

  const totalCoveredAfter = priorPaid + actualAdvanceUsed + rentCovered;
  const previewStatus = totalCoveredAfter >= numMonthlyRent ? 'PAID' : totalCoveredAfter > 0 ? 'PARTIAL' : 'PENDING';

  const numCash = Number(cashAmount) || 0;
  const numGpay = Number(gpayAmount) || 0;
  const isSplitMismatch = paymentMode === 'BOTH' && Math.abs(numCash + numGpay - numAmountReceived) > 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedComplexId || !selectedShopId) {
      setError('Please select complex and shop');
      return;
    }

    if (numAmountReceived === 0 && numAdvanceToUse === 0) {
      setError('Amount received or advance to use must be greater than zero');
      return;
    }

    if (numAdvanceToUse > availableAdvance) {
      setError(`Advance to use (₹${numAdvanceToUse}) cannot exceed available advance (₹${availableAdvance})`);
      return;
    }

    if (paymentMode === 'BOTH' && isSplitMismatch) {
      setError(`Cash amount (₹${numCash}) + GPay amount (₹${numGpay}) must equal total received (₹${numAmountReceived})`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await rentalApi.createPayment({
        complexId: selectedComplexId,
        shopId: selectedShopId,
        paymentMonth,
        amountReceived: numAmountReceived,
        advanceToUse: numAdvanceToUse,
        paymentMode,
        cashAmount: paymentMode === 'CASH' ? numAmountReceived : paymentMode === 'GPAY' ? 0 : numCash,
        gpayAmount: paymentMode === 'GPAY' ? numAmountReceived : paymentMode === 'CASH' ? 0 : numGpay,
        paymentDate,
        mobileNumber: selectedShop?.mobileNumber,
        notes
      });

      if (!res.success) {
        setError(res.message || 'Failed to record payment');
        setIsSubmitting(false);
        return;
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error processing payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '580px', padding: 0 }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Record Rent Payment
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
            {/* Complex & Shop Selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  COMPLEX *
                </label>
                <select
                  className="select-control"
                  value={selectedComplexId}
                  onChange={(e) => {
                    setSelectedComplexId(e.target.value);
                    const validShops = shops.filter((s) => s.status === 'ACTIVE' && s.complexId === e.target.value);
                    setSelectedShopId(validShops[0]?.shopId || '');
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
                  SHOP *
                </label>
                <select
                  className="select-control"
                  value={selectedShopId}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                  required
                >
                  <option value="">-- Select Shop --</option>
                  {filteredShops.map((s) => (
                    <option key={s.shopId} value={s.shopId}>
                      {s.shopNumber} - {s.shopName} (₹{s.monthlyRent})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tenant Info Card */}
            {selectedShop && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px'
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>
                    Tenant Details
                  </span>
                  <strong>{selectedShop.tenantName}</strong> ({selectedShop.mobileNumber})
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>
                    Monthly Rent / Avail. Advance
                  </span>
                  <span style={{ color: 'var(--text-brand, #176B52)', fontWeight: 800 }}>₹{selectedShop.monthlyRent.toLocaleString('en-IN')}</span>
                  {selectedShop.availableAdvance > 0 && (
                    <span style={{ color: '#2563eb', fontWeight: 700, marginLeft: '6px', fontSize: '11px' }}>
                      (Adv: ₹{selectedShop.availableAdvance.toLocaleString('en-IN')})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Month & Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  PAYMENT MONTH *
                </label>
                <input
                  type="month"
                  className="input-control"
                  value={paymentMonth}
                  onChange={(e) => setPaymentMonth(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  PAYMENT DATE *
                </label>
                <input
                  type="date"
                  className="input-control"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Advance to Use & Amount Received */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  USE ADVANCE (MAX ₹{availableAdvance})
                </label>
                <input
                  type="number"
                  step="any"
                  className="input-control"
                  placeholder="0"
                  min="0"
                  max={availableAdvance}
                  value={advanceToUse}
                  onChange={(e) => setAdvanceToUse(e.target.value)}
                  disabled={availableAdvance <= 0}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  AMOUNT RECEIVED (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  className="input-control"
                  placeholder="e.g. 15000"
                  min="0"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  required
                />
              </div>
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
                    name="paymentMode"
                    value="CASH"
                    checked={paymentMode === 'CASH'}
                    onChange={() => setPaymentMode('CASH')}
                  />
                  <span>Cash</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="paymentMode"
                    value="GPAY"
                    checked={paymentMode === 'GPAY'}
                    onChange={() => setPaymentMode('GPAY')}
                  />
                  <span>GPay / UPI</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="paymentMode"
                    value="BOTH"
                    checked={paymentMode === 'BOTH'}
                    onChange={() => setPaymentMode('BOTH')}
                  />
                  <span>Both (Cash + GPay)</span>
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
                    CASH AMOUNT (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="input-control"
                    placeholder="0"
                    min="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    GPAY AMOUNT (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="input-control"
                    placeholder="0"
                    min="0"
                    value={gpayAmount}
                    onChange={(e) => setGpayAmount(e.target.value)}
                    required
                  />
                </div>
                {isSplitMismatch && (
                  <span style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                    ⚠️ Split sum (₹{numCash + numGpay}) does not equal total amount received (₹{numAmountReceived})
                  </span>
                )}
              </div>
            )}

            {/* Calculation Preview Breakdown */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(23, 107, 82, 0.05)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(23, 107, 82, 0.2)',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                fontSize: '11.5px'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>RENT DUE</span>
                <strong>₹{dueBeforeThis.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>OUTSTANDING</span>
                <strong style={{ color: finalBalance > 0 ? '#dc2626' : '#16a34a' }}>
                  ₹{finalBalance.toLocaleString('en-IN')}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>ADVANCE GEN.</span>
                <strong style={{ color: '#2563eb' }}>₹{advanceGenerated.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>PREVIEW STATUS</span>
                <strong style={{ color: previewStatus === 'PAID' ? '#16a34a' : previewStatus === 'PARTIAL' ? '#d97706' : '#dc2626' }}>
                  {previewStatus}
                </strong>
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                NOTES / REMARKS (OPTIONAL)
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. Paid via GPay Ref #1234, cash collected at shop"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Actions */}
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
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || (paymentMode === 'BOTH' && isSplitMismatch)}
            >
              {isSubmitting ? 'Recording Payment...' : `Save Payment (₹${numAmountReceived.toLocaleString('en-IN')})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
