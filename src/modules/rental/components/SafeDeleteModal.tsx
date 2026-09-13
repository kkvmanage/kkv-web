import React, { useState, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Building2,
  Store,
  Ban,
  Archive,
  X,
  Loader2
} from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import { ComplexDeleteCheck, ShopDeleteCheck } from '../types/rental.types';

interface SafeDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'COMPLEX' | 'SHOP';
  entityId: string;
  entityName: string;
  subtitle?: string;
  onDeleted: () => void;
  onDisableComplex?: (complexId: string) => void;
  onCloseShop?: (shopId: string) => void;
}

export const SafeDeleteModal: React.FC<SafeDeleteModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  subtitle,
  onDeleted,
  onDisableComplex,
  onCloseShop
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [complexCheck, setComplexCheck] = useState<ComplexDeleteCheck | null>(null);
  const [shopCheck, setShopCheck] = useState<ShopDeleteCheck | null>(null);

  useEffect(() => {
    if (!isOpen || !entityId) return;

    let mounted = true;
    setLoading(true);
    setError('');
    setComplexCheck(null);
    setShopCheck(null);

    const performCheck = async () => {
      try {
        if (entityType === 'COMPLEX') {
          const res = await rentalApi.getComplexDeleteCheck(entityId);
          if (mounted) {
            if (res.success && res.data) {
              setComplexCheck(res.data);
            } else {
              setError(res.message || 'Failed to inspect complex dependencies');
            }
          }
        } else {
          const res = await rentalApi.getShopDeleteCheck(entityId);
          if (mounted) {
            if (res.success && res.data) {
              setShopCheck(res.data);
            } else {
              setError(res.message || 'Failed to inspect shop dependencies');
            }
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Error checking dependencies');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    performCheck();

    return () => {
      mounted = false;
    };
  }, [isOpen, entityType, entityId]);

  if (!isOpen) return null;

  const canDelete = entityType === 'COMPLEX' ? complexCheck?.canDelete : shopCheck?.canDelete;

  const handlePermanentDelete = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (entityType === 'COMPLEX') {
        const res = await rentalApi.deleteComplex(entityId);
        if (res.success) {
          onDeleted();
          onClose();
        } else {
          setError(res.message || 'Failed to delete complex');
        }
      } else {
        const res = await rentalApi.deleteShop(entityId);
        if (res.success) {
          onDeleted();
          onClose();
        } else {
          setError(res.message || 'Failed to delete shop');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Deletion error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        style={{
          maxWidth: '520px',
          padding: 0,
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: canDelete
              ? 'rgba(239, 68, 68, 0.06)'
              : 'rgba(245, 158, 11, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {loading ? (
              <Loader2 size={20} className="animate-spin" color="var(--primary)" />
            ) : canDelete ? (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Trash2 size={18} color="#dc2626" />
              </div>
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ShieldAlert size={18} color="#d97706" />
              </div>
            )}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {loading
                  ? `Checking ${entityType === 'COMPLEX' ? 'Complex' : 'Shop'} History...`
                  : canDelete
                  ? `Delete ${entityType === 'COMPLEX' ? 'Complex' : 'Shop'}?`
                  : `Cannot Permanently Delete ${entityType === 'COMPLEX' ? 'Complex' : 'Shop'}`}
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {entityType === 'COMPLEX' ? 'Commercial Complex' : 'Shop & Tenancy Record'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
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

          {/* Entity Summary Card */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--bg-surface-secondary)',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {entityType === 'COMPLEX' ? (
                <Building2 size={24} color="var(--primary)" />
              ) : (
                <Store size={24} color="var(--primary)" />
              )}
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                  {entityName}
                </strong>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  ID: {entityId} {subtitle ? `• ${subtitle}` : ''}
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: '12.5px', margin: 0 }}>Inspecting financial records and dependencies...</p>
            </div>
          ) : canDelete ? (
            /* ALLOWED: Empty Unused Entity */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#166534',
                  lineHeight: 1.5
                }}
              >
                ✅ <strong>Zero History Found:</strong> No rent payments, security deposits, receipts, expenses, or active tenancies are attached to this record.
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                This will <strong>permanently remove</strong> this {entityType === 'COMPLEX' ? 'complex' : 'shop'} from the system. This action cannot be undone.
              </p>
            </div>
          ) : (
            /* BLOCKED: Entity With Financial or Rental History */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#991b1b',
                  lineHeight: 1.5
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontWeight: 700 }}>
                  <AlertTriangle size={14} />
                  <span>Financial History Must Be Preserved</span>
                </div>
                {entityType === 'COMPLEX'
                  ? complexCheck?.reason
                  : shopCheck?.reason}
              </div>

              {/* Dependency Breakdown Grid */}
              {entityType === 'COMPLEX' && complexCheck?.dependencies && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                    padding: '10px',
                    backgroundColor: 'var(--bg-surface-secondary)',
                    borderRadius: '8px',
                    fontSize: '11.5px'
                  }}
                >
                  <div style={{ padding: '6px 8px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>TOTAL SHOPS</span>
                    <strong>{complexCheck.dependencies.shopsCount}</strong> ({complexCheck.dependencies.activeShopsCount} Active)
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>SECURITY DEPOSITS HELD</span>
                    <strong style={{ color: '#2563EB' }}>₹{complexCheck.dependencies.securityDepositsHeld.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>RENT PAYMENTS</span>
                    <strong>{complexCheck.dependencies.paymentsCount} records</strong>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>EXPENSES / DAY BOOK</span>
                    <strong>{complexCheck.dependencies.expensesCount + complexCheck.dependencies.dayBookEntriesCount} records</strong>
                  </div>
                </div>
              )}

              {entityType === 'SHOP' && shopCheck?.dependencies && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                    padding: '10px',
                    backgroundColor: 'var(--bg-surface-secondary)',
                    borderRadius: '8px',
                    fontSize: '11.5px'
                  }}
                >
                  <div style={{ padding: '6px 8px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>SECURITY DEPOSIT</span>
                    <strong style={{ color: '#2563EB' }}>
                      ₹{shopCheck.dependencies.securityDepositBalance.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>PENDING RENT</span>
                    <strong style={{ color: shopCheck.dependencies.pendingRent > 0 ? '#dc2626' : '#16a34a' }}>
                      ₹{shopCheck.dependencies.pendingRent.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>RENT PAYMENTS</span>
                    <strong>{shopCheck.dependencies.paymentsCount} record(s)</strong>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>DAY BOOK / EXPENSES</span>
                    <strong>{shopCheck.dependencies.dayBookEntriesCount + shopCheck.dependencies.expensesCount} record(s)</strong>
                  </div>
                </div>
              )}

              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                💡 Tip: Use {entityType === 'COMPLEX' ? 'Disable Complex' : 'Close Shop'} to safely manage operational status while keeping tax and audit books intact.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            backgroundColor: 'var(--bg-surface-secondary)'
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>

          {canDelete ? (
            <button
              type="button"
              className="btn btn-danger"
              style={{
                backgroundColor: '#dc2626',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700
              }}
              onClick={handlePermanentDelete}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  <span>Delete Permanently</span>
                </>
              )}
            </button>
          ) : (
            <>
              {entityType === 'COMPLEX' && onDisableComplex && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    onClose();
                    onDisableComplex(entityId);
                  }}
                >
                  <Ban size={14} />
                  <span>Disable Complex</span>
                </button>
              )}

              {entityType === 'SHOP' && onCloseShop && shopCheck?.dependencies.status !== 'CLOSED' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    onClose();
                    onCloseShop(entityId);
                  }}
                >
                  <Archive size={14} />
                  <span>Close Shop & Settle</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
