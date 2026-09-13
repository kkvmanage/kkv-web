import React, { useState, useEffect } from 'react';
import { X, Store, IndianRupee, Lock } from 'lucide-react';
import { RentalShop, RentalComplex, RentalStatus, PaymentMode } from '../types/rental.types';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    complexId: string;
    shopNumber: string;
    doorNumber: string;
    shopName: string;
    tenantName: string;
    mobileNumber: string;
    ebNumber?: string;
    monthlyRent: number;
    rentDueDay?: number;
    advanceAmount?: number;
    advancePaymentMode?: PaymentMode | string;
    status?: RentalStatus;
  }) => Promise<void>;
  complexes: RentalComplex[];
  shopToEdit?: RentalShop | null;
  defaultComplexId?: string;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  onSave,
  complexes,
  shopToEdit,
  defaultComplexId
}) => {
  const [complexId, setComplexId] = useState('');
  const [shopNumber, setShopNumber] = useState('');
  const [doorNumber, setDoorNumber] = useState('');
  const [shopName, setShopName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [ebNumber, setEbNumber] = useState('');
  const [monthlyRent, setMonthlyRent] = useState<number | string>('');
  const [rentDueDay, setRentDueDay] = useState<number | string>(10);
  const [advanceAmount, setAdvanceAmount] = useState<number | string>('');
  const [advancePaymentMode, setAdvancePaymentMode] = useState<PaymentMode>('CASH');
  const [status, setStatus] = useState<RentalStatus>('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = Boolean(shopToEdit);

  useEffect(() => {
    if (shopToEdit) {
      setComplexId(shopToEdit.complexId);
      setShopNumber(shopToEdit.shopNumber || '');
      setDoorNumber(shopToEdit.doorNumber || '');
      setShopName(shopToEdit.shopName || '');
      setTenantName(shopToEdit.tenantName || '');
      setMobileNumber(shopToEdit.mobileNumber || '');
      setEbNumber(shopToEdit.ebNumber || '');
      setMonthlyRent(shopToEdit.monthlyRent ?? '');
      setRentDueDay(shopToEdit.rentDueDay ?? 10);
      // advanceAmount is locked in edit mode — show original value but don't allow mutation
      setAdvanceAmount(shopToEdit.advanceAmount ?? shopToEdit.availableAdvance ?? 0);
      setStatus(shopToEdit.status || 'ACTIVE');
    } else {
      setComplexId(defaultComplexId || complexes[0]?.complexId || '');
      setShopNumber('');
      setDoorNumber('');
      setShopName('');
      setTenantName('');
      setMobileNumber('');
      setEbNumber('');
      setMonthlyRent('');
      setRentDueDay(10);
      setAdvanceAmount('');
      setAdvancePaymentMode('CASH');
      setStatus('ACTIVE');
    }
    setError('');
  }, [shopToEdit, isOpen, defaultComplexId, complexes]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complexId) {
      setError('Please select a complex');
      return;
    }
    const targetComplex = complexes.find(c => c.complexId === complexId);
    if (!isEditMode && targetComplex && targetComplex.status === 'INACTIVE') {
      setError(`Cannot add a shop to disabled/inactive complex "${targetComplex.complexName}". Please enable the complex first.`);
      return;
    }
    if (!shopNumber.trim()) {
      setError('Shop number is required (e.g. SHOP-08, G-01)');
      return;
    }
    if (!doorNumber.trim()) {
      setError('Door number is required (e.g. 24B, 12A, G-01)');
      return;
    }
    if (!shopName.trim()) {
      setError('Shop / Business name is required');
      return;
    }
    if (!tenantName.trim()) {
      setError('Tenant name is required');
      return;
    }

    const cleanMobile = mobileNumber.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    const rentVal = Number(monthlyRent);
    if (isNaN(rentVal) || rentVal < 0) {
      setError('Monthly rent must be a non-negative amount');
      return;
    }

    const dueDayVal = Number(rentDueDay);
    if (isNaN(dueDayVal) || dueDayVal < 1 || dueDayVal > 31) {
      setError('Rent due day must be between 1 and 31 (e.g. 10 = 10th of every month)');
      return;
    }

    // Only validate and send advance for new shops; edit mode omits it entirely
    let advVal: number | undefined = undefined;
    if (!isEditMode) {
      advVal = advanceAmount === '' ? 0 : Number(advanceAmount);
      if (isNaN(advVal) || advVal < 0) {
        setError('Advance amount must be a non-negative amount');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      await onSave({
        complexId,
        shopNumber: shopNumber.trim(),
        doorNumber: doorNumber.trim(),
        shopName: shopName.trim(),
        tenantName: tenantName.trim(),
        mobileNumber: cleanMobile,
        ebNumber: ebNumber.trim() || undefined,
        monthlyRent: rentVal,
        rentDueDay: Math.round(dueDayVal),
        // advanceAmount is intentionally omitted on edit so backend preserves original
        ...(isEditMode
          ? {}
          : {
              advanceAmount: advVal,
              advancePaymentMode: advVal && advVal > 0 ? advancePaymentMode : undefined,
            }),
        status
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save shop');
    } finally {
      setLoading(false);
    }
  };

  const parsedAdvance = Number(advanceAmount) || 0;

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* modal-content already has: max-height:90vh, overflow:hidden, display:flex, flex-direction:column */}
      <div className="modal-content" style={{ maxWidth: '560px', padding: 0 }}>

        {/* ── Fixed Header ── */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {shopToEdit ? `Edit Shop (${shopToEdit.shopId})` : 'Add New Shop'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <form
          id="shop-modal-form"
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <div className="modal-body">
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
              {/* Select Complex */}
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  SELECT COMPLEX *
                </label>
                <select
                  className="select-control"
                  value={complexId}
                  onChange={(e) => setComplexId(e.target.value)}
                  required
                >
                  <option value="">-- Select Complex --</option>
                  {complexes.map((c) => (
                    <option key={c.complexId} value={c.complexId}>
                      {c.complexName} ({c.location}) - {c.complexId}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row: Shop Number | Door Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    SHOP NUMBER *
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. SHOP-08, G-01"
                    value={shopNumber}
                    onChange={(e) => setShopNumber(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    DOOR NUMBER *
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. 24B, 12A, G-01"
                    value={doorNumber}
                    onChange={(e) => setDoorNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Row: Shop / Business Name | Tenant Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    SHOP / BUSINESS NAME *
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. ABC Mobiles, Modern Tailors"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    TENANT NAME *
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. Arun Kumar"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Row: Mobile Number | EB Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    MOBILE NUMBER *
                  </label>
                  <input
                    type="tel"
                    className="input-control"
                    placeholder="10 digit mobile"
                    maxLength={10}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    EB NUMBER
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. EB-45871234 / 1234567890"
                    value={ebNumber}
                    onChange={(e) => setEbNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Row: Monthly Rent | Rent Due Day | Advance Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                    MONTHLY RENT (₹) *
                  </label>
                  <input
                    type="number"
                    className="input-control"
                    placeholder="e.g. 15000"
                    min="0"
                    step="any"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label
                    className="form-label"
                    style={{ fontSize: '11px', fontWeight: 700 }}
                    title="Day of each month when rent becomes due (1-31)"
                  >
                    RENT DUE DAY *
                  </label>
                  <input
                    type="number"
                    className="input-control"
                    placeholder="10"
                    min="1"
                    max="31"
                    value={rentDueDay}
                    onChange={(e) => setRentDueDay(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ADVANCE AMOUNT (₹)
                    {isEditMode && <Lock size={10} color="var(--text-muted)" />}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      className="input-control"
                      placeholder="e.g. 50000"
                      min="0"
                      step="any"
                      value={advanceAmount}
                      readOnly={isEditMode}
                      disabled={isEditMode}
                      style={isEditMode ? {
                        backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.04))',
                        cursor: 'not-allowed',
                        opacity: 0.7
                      } : undefined}
                    />
                  </div>
                  {isEditMode && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                      Original advance — locked after creation
                    </span>
                  )}
                </div>
              </div>

              {/* Advance Payment Method — only on Create when advance > 0 */}
              {!isEditMode && parsedAdvance > 0 && (
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: 'rgba(37, 99, 235, 0.05)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <IndianRupee size={14} color="#2563eb" />
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>
                      ADVANCE PAYMENT METHOD (₹{parsedAdvance.toLocaleString('en-IN')})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['CASH', 'GPAY', 'BOTH'] as PaymentMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`btn btn-sm ${advancePaymentMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, fontSize: '11.5px', fontWeight: 700, padding: '6px 0' }}
                        onClick={() => setAdvancePaymentMode(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                    * This advance will be safely logged as a Security Deposit in the Rental Day Book.
                  </span>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  STATUS
                </label>
                <select
                  className="select-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RentalStatus)}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Fixed Footer ── */}
          <div
            className="modal-footer"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : shopToEdit ? 'Update Shop' : 'Create Shop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
