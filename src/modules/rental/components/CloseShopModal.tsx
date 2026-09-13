import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Store, User, Building2 } from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import { RentalShop, ShopSettlementSummary } from '../types/rental.types';

interface CloseShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shop: RentalShop | null;
}

export const CloseShopModal: React.FC<CloseShopModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  shop
}) => {
  const [loading, setLoading] = useState(false);
  const [fetchingSettlement, setFetchingSettlement] = useState(false);
  const [settlement, setSettlement] = useState<ShopSettlementSummary | null>(null);
  const [closingReason, setClosingReason] = useState('Tenancy Completed');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && shop) {
      setError('');
      setClosingReason('Tenancy Completed');
      setSettlementNotes('');
      fetchSettlement();
    } else {
      setSettlement(null);
      setError('');
    }
  }, [isOpen, shop]);

  const fetchSettlement = async () => {
    if (!shop) return;
    setFetchingSettlement(true);
    try {
      const res = await rentalApi.getShopSettlement(shop.shopId);
      if (res.success && res.data) {
        setSettlement(res.data);
      } else {
        setError(res.message || 'Failed to load shop settlement details');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching settlement details');
    } finally {
      setFetchingSettlement(false);
    }
  };

  if (!isOpen || !shop) return null;

  const handleCloseShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    setLoading(true);
    setError('');

    try {
      const res = await rentalApi.closeShop(shop.shopId, {
        reason: closingReason,
        notes: settlementNotes
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || 'Failed to close shop');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while closing the shop');
    } finally {
      setLoading(false);
    }
  };

  const pendingRent = settlement?.pendingRent ?? 0;
  const originalAdvance = settlement?.originalAdvance ?? (shop.advanceAmount || shop.availableAdvance || 0);
  const advanceAdjusted = settlement?.advanceAdjusted ?? Math.max(0, originalAdvance - (shop.availableAdvance || 0));
  const availableAdvance = settlement?.availableAdvance ?? (shop.availableAdvance || 0);
  const refundableAdvance = settlement?.refundableAdvance ?? Math.max(0, availableAdvance - pendingRent);
  const hasOutstanding = pendingRent > 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card, #1e222d)',
          border: '1px solid var(--border-color, #2e3545)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
          color: 'var(--text-primary, #e2e8f0)',
          padding: '0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color, #2e3545)',
            backgroundColor: 'rgba(218, 165, 32, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}
            >
              <Store size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
                Close Shop & Tenancy Settlement
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
                Financial settlement review before shop closure
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
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

        {/* Content */}
        <form onSubmit={handleCloseShop} style={{ padding: '20px 24px' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '13px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          {fetchingSettlement ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Calculating authoritative financial settlement...
            </div>
          ) : (
            <>
              {/* Shop & Tenant Info Header */}
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color, #2e3545)',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  marginBottom: '18px'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12.5px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', display: 'block' }}>COMPLEX</span>
                    <strong style={{ color: 'var(--text-primary, #ffffff)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Building2 size={13} color="var(--color-gold-light, #daa520)" />
                      {shop.complexName || settlement?.complexName || shop.complexId}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', display: 'block' }}>SHOP / UNIT</span>
                    <strong style={{ color: 'var(--color-gold-light, #daa520)' }}>
                      {shop.shopNumber} {shop.doorNumber ? `(Door ${shop.doorNumber})` : ''}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', display: 'block' }}>BUSINESS NAME</span>
                    <strong style={{ color: 'var(--text-primary, #ffffff)' }}>{shop.shopName}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', display: 'block' }}>TENANT</span>
                    <strong style={{ color: 'var(--text-primary, #ffffff)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} />
                      {shop.tenantName} ({shop.mobileNumber})
                    </strong>
                  </div>
                </div>
              </div>

              {/* Financial Settlement Breakdown */}
              <div
                style={{
                  border: '1px solid var(--border-color, #2e3545)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: '18px'
                }}
              >
                <div
                  style={{
                    backgroundColor: 'rgba(218, 165, 32, 0.08)',
                    padding: '10px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: 'var(--color-gold-light, #daa520)',
                    borderBottom: '1px solid var(--border-color, #2e3545)'
                  }}
                >
                  Financial Settlement Summary
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Monthly Rent:</span>
                    <span style={{ fontWeight: 600 }}>₹{shop.monthlyRent.toLocaleString('en-IN')}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Pending Rent Dues:</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: pendingRent > 0 ? '#ef4444' : '#10b981'
                      }}
                    >
                      ₹{pendingRent.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-color, #2e3545)', margin: '4px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Original Advance Received:</span>
                    <span>₹{originalAdvance.toLocaleString('en-IN')}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Advance Already Adjusted:</span>
                    <span style={{ color: advanceAdjusted > 0 ? '#f59e0b' : 'inherit' }}>
                      - ₹{advanceAdjusted.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Current Available Advance:</span>
                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                      ₹{availableAdvance.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: '6px',
                      padding: '12px 14px',
                      backgroundColor: 'rgba(218, 165, 32, 0.1)',
                      border: '1px solid rgba(218, 165, 32, 0.3)',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-gold-light, #daa520)', textTransform: 'uppercase' }}>
                        Refundable Advance Balance
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                        (Available Advance − Outstanding Dues)
                      </div>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-gold-light, #daa520)' }}>
                      ₹{refundableAdvance.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Outstanding Status Message */}
              {hasOutstanding ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#f59e0b',
                    fontSize: '12.5px',
                    marginBottom: '16px',
                    display: 'flex',
                    gap: '10px'
                  }}
                >
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Outstanding Rent Detected (₹{pendingRent.toLocaleString('en-IN')})</strong>
                    <div style={{ marginTop: '2px', fontSize: '11.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                      Closing this shop will record the closure settlement with ₹{pendingRent.toLocaleString('en-IN')} pending debt and ₹{refundableAdvance.toLocaleString('en-IN')} net refundable advance. Historical rent and receipt records will remain preserved.
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    fontSize: '12.5px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <CheckCircle size={16} />
                  <span><strong>Zero Outstanding Balance.</strong> All rent dues are fully settled.</span>
                </div>
              )}

              {/* Closure Details Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Closing Reason <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    className="select-control"
                    value={closingReason}
                    onChange={(e) => setClosingReason(e.target.value)}
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                    required
                  >
                    <option value="Tenancy Completed">Tenancy Completed / Lease Expired</option>
                    <option value="Tenant Vacated">Tenant Vacated Premises</option>
                    <option value="Mutual Agreement">Mutual Agreement / Surrender</option>
                    <option value="Business Relocation">Business Relocation</option>
                    <option value="Default / Eviction">Default / Eviction</option>
                    <option value="Complex Renovation">Complex Renovation / Reconstruction</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Settlement Notes & Remarks (Optional)
                  </label>
                  <textarea
                    className="input-control"
                    rows={2}
                    placeholder="e.g., Security deposit to be refunded via NEFT after key handover..."
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    style={{ width: '100%', resize: 'vertical', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              {/* Safety Notice */}
              <div
                style={{
                  fontSize: '11.5px',
                  color: 'var(--text-muted, #64748b)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color, #2e3545)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  marginBottom: '20px',
                  lineHeight: '1.4'
                }}
              >
                🔒 <strong>Data Protection:</strong> Closing this shop stops future monthly rent generation and removes it from active pending collections. All historical rent records, receipts, day book entries, and reports remain 100% intact.
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={loading || fetchingSettlement}
                  style={{
                    minWidth: '140px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Store size={15} />
                  <span>{loading ? 'Closing Shop...' : 'Confirm Close Shop'}</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
