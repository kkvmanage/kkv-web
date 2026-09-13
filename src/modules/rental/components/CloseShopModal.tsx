import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Store, User, Building2, ShieldCheck, Banknote } from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import { RentalShop, ShopSettlementSummary, PaymentMode } from '../types/rental.types';

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

  // Refund fields
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundPaymentMode, setRefundPaymentMode] = useState<PaymentMode>('CASH');
  const [refundNotes, setRefundNotes] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && shop) {
      setError('');
      setClosingReason('Tenancy Completed');
      setSettlementNotes('');
      setRefundAmount('');
      setRefundPaymentMode('CASH');
      setRefundNotes('');
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
        // Pre-fill refund amount with refundable deposit
        const refundable = res.data.refundableDeposit ?? 0;
        if (refundable > 0) {
          setRefundAmount(String(refundable));
        }
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

  const securityDepositAmount = settlement?.securityDepositAmount ?? (shop.advanceAmount || 0);
  const securityDepositBalance = settlement?.securityDepositBalance ?? (shop.availableAdvance || 0);
  const pendingRent = settlement?.pendingRent ?? 0;
  const refundableDeposit = settlement?.refundableDeposit ?? securityDepositBalance;
  const hasOutstanding = pendingRent > 0;
  const numRefundAmount = Number(refundAmount) || 0;
  const isRefundExceedingBalance = numRefundAmount > securityDepositBalance;

  const handleCloseShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    if (isRefundExceedingBalance) {
      setError(`Refund amount (₹${numRefundAmount.toLocaleString('en-IN')}) cannot exceed the security deposit balance (₹${securityDepositBalance.toLocaleString('en-IN')})`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await rentalApi.closeShop(shop.shopId, {
        reason: closingReason,
        notes: settlementNotes,
        refundAmount: numRefundAmount > 0 ? numRefundAmount : undefined,
        refundPaymentMode: numRefundAmount > 0 ? refundPaymentMode : undefined,
        refundNotes: refundNotes.trim() || undefined
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

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px'
  };

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
          maxWidth: '580px',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card, #1e222d)',
          border: '1px solid var(--border-color, #2e3545)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
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
                Close Shop &amp; Tenancy Settlement
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
                Security deposit refund &amp; closure confirmation
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
              {/* Shop & Tenant Info */}
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color, #2e3545)',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  marginBottom: '16px'
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
                  marginBottom: '16px'
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
                    borderBottom: '1px solid var(--border-color, #2e3545)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ShieldCheck size={14} />
                  Security Deposit &amp; Rent Settlement
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={rowStyle}>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Monthly Rent:</span>
                    <span style={{ fontWeight: 600 }}>₹{shop.monthlyRent.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Outstanding Rent Dues:</span>
                    <span style={{ fontWeight: 700, color: pendingRent > 0 ? '#ef4444' : '#10b981' }}>
                      ₹{pendingRent.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-color, #2e3545)', margin: '4px 0' }} />

                  <div style={rowStyle}>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Original Security Deposit:</span>
                    <span>₹{securityDepositAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Current Deposit Balance:</span>
                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                      ₹{securityDepositBalance.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Refundable highlight */}
                  <div
                    style={{
                      marginTop: '4px',
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
                        Refundable Security Deposit
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                        Current balance held for tenant
                      </div>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-gold-light, #daa520)' }}>
                      ₹{refundableDeposit.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Outstanding Rent Warning */}
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
                    <strong>Outstanding Rent: ₹{pendingRent.toLocaleString('en-IN')}</strong>
                    <div style={{ marginTop: '2px', fontSize: '11.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                      There is unpaid rent. The security deposit is NOT automatically deducted — adjust the refund amount manually if an authorized deduction is agreed upon.
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

              {/* Security Deposit Refund Section */}
              <div
                style={{
                  border: '1px solid var(--border-color, #2e3545)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: '16px'
                }}
              >
                <div
                  style={{
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    padding: '10px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: '#60a5fa',
                    borderBottom: '1px solid var(--border-color, #2e3545)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Banknote size={14} />
                  Security Deposit Refund (Optional)
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
                    Enter the amount being refunded to the tenant now. Leave at <strong>0</strong> if the refund will be processed separately. This creates a <strong>Security Deposit Refund</strong> entry in the Day Book.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        REFUND AMOUNT (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={securityDepositBalance}
                        className="input-control"
                        placeholder="0"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '13px',
                          borderColor: isRefundExceedingBalance ? '#ef4444' : undefined
                        }}
                      />
                      {isRefundExceedingBalance && (
                        <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '3px' }}>
                          Cannot exceed deposit balance ₹{securityDepositBalance.toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        REFUND METHOD
                      </label>
                      <select
                        className="select-control"
                        value={refundPaymentMode}
                        onChange={(e) => setRefundPaymentMode(e.target.value as PaymentMode)}
                        style={{ width: '100%', height: '36px', fontSize: '13px' }}
                        disabled={numRefundAmount <= 0}
                      >
                        <option value="CASH">Cash</option>
                        <option value="GPAY">GPay / Bank Transfer</option>
                        <option value="BOTH">Cash + GPay</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                      REFUND NOTES (Optional)
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Refunded via NEFT #REF12345, deduction for damages agreed"
                      value={refundNotes}
                      onChange={(e) => setRefundNotes(e.target.value)}
                      style={{ width: '100%', fontSize: '12.5px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Closure Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
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
                    Settlement Notes &amp; Remarks (Optional)
                  </label>
                  <textarea
                    className="input-control"
                    rows={2}
                    placeholder="e.g., Keys returned, meter reading noted, property inspection completed..."
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
                🔒 <strong>Data Protection:</strong> Closing this shop archives the tenancy. All historical rent records, receipts, day book entries, and reports remain 100% intact. A security deposit refund entry will be recorded in the Day Book if a refund amount is specified.
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
                  disabled={loading || fetchingSettlement || isRefundExceedingBalance}
                  style={{
                    minWidth: '160px',
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
