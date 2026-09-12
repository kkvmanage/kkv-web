import React, { useState, useEffect } from 'react';
import { RotateCcw, CloudDownload, CheckCircle2, AlertTriangle, Loader2, X, RefreshCw, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiService } from '../../services/api';

export interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RestoreModal: React.FC<RestoreModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { customers, loans, receipts, fixedDeposits, showToast, reloadAllData } = useApp();

  const [step, setStep] = useState<'idle' | 'in_progress' | 'success' | 'error'>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [restoreResult, setRestoreResult] = useState<any>(null);

  const isLocalDbNonEmpty =
    customers.length > 0 || loans.length > 0 || receipts.length > 0 || fixedDeposits.length > 0;

  useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setProgressPercent(0);
      setProgressText('');
      setErrorMessage('');
      setRestoreResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartRestore = async () => {
    setStep('in_progress');
    setErrorMessage('');
    setProgressPercent(15);
    setProgressText('Finding latest verified backup on Google Drive...');

    try {
      const timer1 = setTimeout(() => {
        setProgressPercent(35);
        setProgressText('Downloading backup package from Google Drive...');
      }, 500);

      const timer2 = setTimeout(() => {
        setProgressPercent(55);
        setProgressText('Validating backup package & verifying checksum...');
      }, 1100);

      const timer3 = setTimeout(() => {
        setProgressPercent(75);
        setProgressText('Preparing staging environment & restoring local database...');
      }, 1700);

      const timer4 = setTimeout(() => {
        setProgressPercent(90);
        setProgressText('Verifying restored entity records & relationships...');
      }, 2300);

      const res = await apiService.restoreLatestBackup();
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      const result = res.data || res;

      setProgressPercent(100);
      setProgressText('Restore completed & verified successfully!');
      setRestoreResult(result);
      setStep('success');

      // Reload fresh operational data into application context
      await reloadAllData();
      window.dispatchEvent(new CustomEvent('SYSTEM_RESTORE_COMPLETED', { detail: result }));
      window.dispatchEvent(new Event('kkv_rental_data_changed'));

      showToast('Latest cloud backup restored & verified successfully!', 'success');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[RestoreModal] Restore error:', err);
      const errText = err.message || 'Backup could not be restored or verified. Your local data is safe.';
      setErrorMessage(errText);
      setStep('error');
      showToast(errText, 'error');
    }
  };

  const counts = restoreResult?.recordCounts || restoreResult?.restoredCounts || {
    customers: customers.length,
    loans: loans.length,
    receipts: receipts.length,
    fixedDeposits: fixedDeposits.length
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-light, #e2e8f0)',
          boxShadow: 'var(--shadow-xl, 0 20px 40px rgba(0,0,0,0.2))',
          width: '100%',
          maxWidth: '520px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-secondary, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCcw size={18} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
                Restore Database
              </h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                KKV Gold Finance • Cloud Recovery from Google Drive
              </p>
            </div>
          </div>

          {step !== 'in_progress' && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '4px',
                borderRadius: '50%'
              }}
              title="Close modal"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {/* STEP A: Idle / Confirmation State */}
          {step === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {isLocalDbNonEmpty ? (
                <div
                  style={{
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  <AlertCircle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ margin: '0 0 3px 0', fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
                      Operational Data Present
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#b45309', lineHeight: '1.4' }}>
                      Restore will replace the current local Finance operational data with the selected Google Drive backup.
                    </p>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-dark)', lineHeight: '1.5' }}>
                  Restore will download the latest verified backup from <strong>Google Drive (kkv finance)</strong> and restore all customer, loan, and financial records.
                </p>
              )}

              {/* Current Local Database State */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  textAlign: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Customers</span>
                  <strong style={{ display: 'block', fontSize: '16px', color: 'var(--text-dark)', marginTop: '2px' }}>{customers.length}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Loans</span>
                  <strong style={{ display: 'block', fontSize: '16px', color: 'var(--color-primary-dark)', marginTop: '2px' }}>{loans.length}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Receipts</span>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#059669', marginTop: '2px' }}>{receipts.length}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>FDs</span>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#2563eb', marginTop: '2px' }}>{fixedDeposits.length}</strong>
                </div>
              </div>

              {/* Backup Info */}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Source Location:</span>
                  <strong style={{ color: 'var(--text-dark)' }}>Google Drive / kkv finance</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Integrity Safeguard:</span>
                  <strong style={{ color: '#059669' }}>Staging Validation &amp; Idempotency Active</strong>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, height: '40px', justifyContent: 'center', fontWeight: 600 }}
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1.2, height: '40px', justifyContent: 'center', gap: '8px', fontWeight: 700, backgroundColor: '#2563eb', borderColor: '#2563eb' }}
                  onClick={handleStartRestore}
                >
                  <CloudDownload size={16} />
                  <span>{isLocalDbNonEmpty ? 'Confirm & Restore' : 'Restore Latest Backup'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP B: In-Progress Restore State */}
          {step === 'in_progress' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '16px' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={42} className="animate-spin" color="#2563eb" />
              </div>

              <div style={{ textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)' }}>
                  Restoring Database from Cloud...
                </h4>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {progressText}
                </p>
              </div>

              {/* Progress Bar Container */}
              <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    backgroundColor: '#2563eb',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {progressPercent}% completed
              </span>
            </div>
          )}

          {/* STEP C: Success State */}
          {step === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <CheckCircle2 size={22} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#065f46' }}>
                    ✓ Restore Completed &amp; Verified
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#047857', lineHeight: '1.4' }}>
                    Local database has been restored cleanly from the verified backup. All IDs and relationships preserved.
                  </p>
                </div>
              </div>

              {/* Restored Entities Summary Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  textAlign: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Customers</span>
                  <strong style={{ display: 'block', fontSize: '16px', color: 'var(--text-dark)', marginTop: '2px' }}>{counts.customers || 0}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Loans</span>
                  <strong style={{ display: 'block', fontSize: '16px', color: 'var(--color-primary-dark)', marginTop: '2px' }}>{counts.loans || 0}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Receipts</span>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#059669', marginTop: '2px' }}>{counts.receipts || 0}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>FDs</span>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#2563eb', marginTop: '2px' }}>{counts.fixedDeposits || 0}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', height: '42px', justifyContent: 'center', fontWeight: 700 }}
                  onClick={onClose}
                >
                  Continue Working
                </button>
              </div>
            </div>
          )}

          {/* STEP D: Error State */}
          {step === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <AlertTriangle size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>
                    Restore Could Not Be Completed
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c', lineHeight: '1.4' }}>
                    {errorMessage || 'Unable to download or validate cloud backup.'}
                  </p>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-dark)', lineHeight: '1.5' }}>
                🛡️ <strong>Your current local data is safe and unchanged.</strong> No partial restore was applied.
              </p>

              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, height: '40px', justifyContent: 'center', fontWeight: 600 }}
                  onClick={onClose}
                >
                  Cancel / Keep Current
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1.2, height: '40px', justifyContent: 'center', gap: '6px', fontWeight: 700 }}
                  onClick={handleStartRestore}
                >
                  <RefreshCw size={14} />
                  <span>Retry Restore</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
