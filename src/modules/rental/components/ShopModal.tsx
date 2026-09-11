import React, { useState, useEffect } from 'react';
import { X, Store } from 'lucide-react';
import { RentalShop, RentalComplex, RentalStatus } from '../types/rental.types';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    complexId: string;
    shopNumber: string;
    shopName: string;
    tenantName: string;
    mobileNumber: string;
    monthlyRent: number;
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
  const [shopName, setShopName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [monthlyRent, setMonthlyRent] = useState<number | string>('');
  const [status, setStatus] = useState<RentalStatus>('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (shopToEdit) {
      setComplexId(shopToEdit.complexId);
      setShopNumber(shopToEdit.shopNumber);
      setShopName(shopToEdit.shopName);
      setTenantName(shopToEdit.tenantName);
      setMobileNumber(shopToEdit.mobileNumber);
      setMonthlyRent(shopToEdit.monthlyRent);
      setStatus(shopToEdit.status);
    } else {
      setComplexId(defaultComplexId || complexes[0]?.complexId || '');
      setShopNumber('');
      setShopName('');
      setTenantName('');
      setMobileNumber('');
      setMonthlyRent('');
      setStatus('ACTIVE');
    }
    setError('');
  }, [shopToEdit, isOpen, defaultComplexId, complexes]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complexId) {
      setError('Please select a complex');
      return;
    }
    if (!shopNumber.trim()) {
      setError('Shop number is required (e.g. Shop 12, G-01)');
      return;
    }
    if (!shopName.trim()) {
      setError('Shop name is required');
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

    setLoading(true);
    setError('');
    try {
      await onSave({
        complexId,
        shopNumber: shopNumber.trim(),
        shopName: shopName.trim(),
        tenantName: tenantName.trim(),
        mobileNumber: cleanMobile,
        monthlyRent: rentVal,
        status
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save shop');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '500px', padding: 0 }}>
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
            <Store size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {shopToEdit ? `Edit Shop (${shopToEdit.shopId})` : 'Add New Shop'}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  SHOP NUMBER *
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Shop 12, G-01"
                  value={shopNumber}
                  onChange={(e) => setShopNumber(e.target.value)}
                  required
                />
              </div>

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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  TENANT NAME *
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Arun, Kumar"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                />
              </div>

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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
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

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)'
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
