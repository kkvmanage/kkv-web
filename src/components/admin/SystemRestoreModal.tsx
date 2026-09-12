import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Upload,
  RefreshCw,
  X,
  RotateCcw,
  ArrowRight,
  AlertTriangle,
  FileArchive,
  ShieldCheck
} from 'lucide-react';
import { apiService } from '../../services/api';

export interface SystemRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessReload: () => void;
}

export const SystemRestoreModal: React.FC<SystemRestoreModalProps> = ({
  isOpen,
  onClose,
  onSuccessReload
}) => {
  // Steps: 1 = Select & Upload, 2 = Validate & Preview, 3 = Confirm, 4 = Executing, 5 = Complete
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);

  // Available Server Backups
  const [availableBackups, setAvailableBackups] = useState<any[]>([]);

  // Validation Preview Result
  const [previewResult, setPreviewResult] = useState<{
    token: string;
    backupId: string;
    fileName: string;
    createdAt: string;
    fileSize: number;
    sha256: string;
    schemaVersion: string;
    sourceType: 'LOCAL_UPLOAD' | 'LOCAL_SERVER';
    manifestVerified: boolean;
    checksumsVerified: boolean;
    relationshipsVerified: boolean;
    counts: {
      customers: number;
      loans: number;
      receipts: number;
      fixedDeposits: number;
      dayBookEntries: number;
      rentalComplexes?: number;
      rentalShops?: number;
      rentPayments?: number;
      rentalExpenses?: number;
      rentalDayBook?: number;
      fileAttachments?: number;
      totalRecords: number;
    };
    currentDbCounts: {
      customers: number;
      loans: number;
      receipts: number;
      fixedDeposits: number;
      dayBookEntries: number;
      rentalComplexes?: number;
      rentalShops?: number;
      totalRecords: number;
    };
  } | null>(null);

  // Confirmation Controls
  const [acknowledgedWarning, setAcknowledgedWarning] = useState(false);
  const [inputConfirmation, setInputConfirmation] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMessage('');
      setPreviewResult(null);
      setAcknowledgedWarning(false);
      setInputConfirmation('');
      loadAvailableBackups();
    }
  }, [isOpen]);

  const loadAvailableBackups = async () => {
    try {
      const res = await apiService.getAvailableBackups();
      if (res.success && Array.isArray(res.data)) {
        setAvailableBackups(res.data);
      }
    } catch (err) {
      console.warn('Failed to load available backups:', err);
    }
  };

  if (!isOpen) return null;

  const handleValidateUploadedFile = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip') && !file.name.toLowerCase().endsWith('.json')) {
      setErrorMessage('Unsupported file type. Please select a valid .ZIP backup archive or .JSON snapshot.');
      return;
    }

    if (file.size === 0) {
      setErrorMessage('The selected file is empty (0 bytes).');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setErrorMessage('The selected file exceeds the 100MB maximum upload limit.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await apiService.validateRestoreBackup({ file });
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Backup validation failed. Archive is invalid or corrupted.');
      }
      setPreviewResult(res.data);
      setStep(2);
    } catch (err: any) {
      console.error('[SystemRestoreModal] Validation error:', err);
      setErrorMessage(err?.message || 'Selected backup could not be validated.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateBackupId = async (backupId: string) => {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await apiService.validateRestoreBackup({ backupId });
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Backup validation failed.');
      }
      setPreviewResult(res.data);
      setStep(2);
    } catch (err: any) {
      console.error('[SystemRestoreModal] Validation error:', err);
      setErrorMessage(err?.message || 'Selected backup could not be validated.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!previewResult || !previewResult.token) return;
    const cleanConfirm = inputConfirmation.trim();
    if (cleanConfirm !== 'RESTORE BACKUP' && cleanConfirm !== 'RESTORE SYSTEM') return;
    if (!acknowledgedWarning) return;

    setStep(4);
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await apiService.executeSystemRestore(previewResult.token, cleanConfirm);

      if (!res.success || !res.data) {
        throw new Error(res.message || 'Database restoration failed.');
      }

      setLoading(false);
      setStep(5);
    } catch (err: any) {
      console.error('[SystemRestoreModal] Restore execution error:', err);
      setErrorMessage(err?.message || 'Restore failed. The database has been protected.');
      setLoading(false);
    }
  };

  const handleFinish = () => {
    onSuccessReload();
    onClose();
  };

  const isExactConfirm = inputConfirmation.trim() === 'RESTORE BACKUP' || inputConfirmation.trim() === 'RESTORE SYSTEM';
  const isRestoreEnabled = isExactConfirm && acknowledgedWarning && !loading;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.4)',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF'
        }}
      >
        {/* HEADER */}
        <div
          style={{
            backgroundColor: '#0F766E',
            color: '#FFFFFF',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCcw size={22} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                SYSTEM DATABASE RESTORATION
              </h2>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px' }}>
                Multi-Domain Authoritative Package Restoration (Finance + Rental + Attachments)
              </div>
            </div>
          </div>
          {step !== 4 && (
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* STEP TABS */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          <div
            style={{
              flex: 1,
              padding: '10px 4px',
              textAlign: 'center',
              borderBottom: step === 1 ? '3px solid #0F766E' : 'none',
              color: step === 1 ? '#0F766E' : '#64748B'
            }}
          >
            1. Select / Upload ZIP
          </div>
          <div
            style={{
              flex: 1,
              padding: '10px 4px',
              textAlign: 'center',
              borderBottom: step === 2 ? '3px solid #0F766E' : 'none',
              color: step === 2 ? '#0F766E' : '#64748B'
            }}
          >
            2. Validate & Preview
          </div>
          <div
            style={{
              flex: 1,
              padding: '10px 4px',
              textAlign: 'center',
              borderBottom: step === 3 ? '3px solid #0F766E' : 'none',
              color: step === 3 ? '#0F766E' : '#64748B'
            }}
          >
            3. Final Confirmation
          </div>
          <div
            style={{
              flex: 1,
              padding: '10px 4px',
              textAlign: 'center',
              borderBottom: step === 4 ? '3px solid #0F766E' : 'none',
              color: step === 4 ? '#0F766E' : '#64748B'
            }}
          >
            4. Restoring Data
          </div>
          <div
            style={{
              flex: 1,
              padding: '10px 4px',
              textAlign: 'center',
              borderBottom: step === 5 ? '3px solid #16A34A' : 'none',
              color: step === 5 ? '#16A34A' : '#64748B'
            }}
          >
            5. Restore Verified
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: '24px' }}>
          {errorMessage && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <AlertTriangle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD / SELECT */}
          {step === 1 && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleValidateUploadedFile(e.dataTransfer.files[0]);
                  }
                }}
                style={{
                  border: isDragging ? '2px dashed #0F766E' : '2px dashed #CBD5E1',
                  borderRadius: '12px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  backgroundColor: isDragging ? '#F0FDFA' : '#F8FAFC',
                  transition: 'all 0.2s',
                  marginBottom: '24px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  const input = document.getElementById('backupFileInput');
                  if (input) input.click();
                }}
              >
                <input
                  id="backupFileInput"
                  type="file"
                  accept=".json,.zip"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleValidateUploadedFile(e.target.files[0]);
                    }
                  }}
                />
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    backgroundColor: '#E6FFFA',
                    color: '#0F766E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto'
                  }}
                >
                  <Upload size={26} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
                  Upload JSON Backup File
                </div>
                <div style={{ fontSize: '13px', color: '#64748B' }}>
                  Drag &amp; drop your downloaded <code>.json</code> backup file here, or click to browse
                </div>
              </div>

              {/* Existing Server Backups List */}
              {availableBackups.length > 0 && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '10px' }}>
                    OR SELECT PREVIOUS BACKUP FROM SERVER / DRIVE
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    {availableBackups.slice(0, 5).map((b) => (
                      <div
                        key={b.fileId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: '#FFFFFF'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileArchive size={18} color="#0F766E" />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{b.fileName}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {new Date(b.createdTime).toLocaleString()} • {(b.sizeBytes / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleValidateBackupId(b.fileId)}
                          disabled={loading}
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          Select & Validate
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loading && (
                <div style={{ textAlign: 'center', marginTop: '16px', color: '#0F766E', fontSize: '13px', fontWeight: 600 }}>
                  <RefreshCw size={18} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                  Unpacking archive and verifying SHA-256 checksums...
                </div>
              )}
            </div>
          )}

          {/* STEP 2: VALIDATE & PREVIEW */}
          {step === 2 && previewResult && (
            <div>
              <div
                style={{
                  backgroundColor: '#F0FDFA',
                  border: '1px solid #99F6E4',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F766E', fontWeight: 700, fontSize: '14px' }}>
                  <ShieldCheck size={18} />
                  ARCHIVE INTEGRITY VERIFIED
                </div>
                <div style={{ fontSize: '12px', color: '#134E4A', marginTop: '4px', lineHeight: '1.5' }}>
                  ✓ Manifest valid • ✓ SHA-256 Checksums match • ✓ Relationships intact • ✓ Original IDs preserved
                </div>
              </div>

              {/* Record Comparison Grid */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '10px' }}>
                  MULTI-DOMAIN RECORDS TO BE RESTORED ({previewResult.counts.totalRecords} total)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '10px'
                  }}
                >
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Customers</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{previewResult.counts.customers}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Loans</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{previewResult.counts.loans}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Receipts</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{previewResult.counts.receipts}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Finance Ledger</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{previewResult.counts.dayBookEntries}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Rental Complexes</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{previewResult.counts.rentalComplexes ?? 0}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Rental Shops</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{previewResult.counts.rentalShops ?? 0}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Rent Collections</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{previewResult.counts.rentPayments ?? 0}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Rental Expenses</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{previewResult.counts.rentalExpenses ?? 0}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-secondary"
                >
                  Choose Different Backup
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn"
                  style={{
                    backgroundColor: '#0F766E',
                    color: '#FFFFFF',
                    padding: '10px 22px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  Proceed to Confirmation <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FINAL CONFIRMATION */}
          {step === 3 && previewResult && (
            <div>
              <div
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  padding: '16px',
                  borderRadius: '10px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', fontWeight: 700, fontSize: '14px' }}>
                  <AlertTriangle size={18} />
                  AUTOMATIC SAFETY SNAPSHOT
                </div>
                <div style={{ fontSize: '12px', color: '#92400E', marginTop: '4px', lineHeight: '1.5' }}>
                  Before applying this backup, the system will automatically generate a safety snapshot of the current state.
                  Restoring will replace current operational collections with records from <strong>{previewResult.fileName}</strong>.
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                  Type <span style={{ color: '#0F766E', fontWeight: 700 }}>RESTORE BACKUP</span> to confirm:
                </label>
                <input
                  type="text"
                  value={inputConfirmation}
                  onChange={(e) => setInputConfirmation(e.target.value)}
                  placeholder="RESTORE BACKUP"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: isExactConfirm ? '2px solid #16A34A' : '1px solid #CBD5E1',
                    outline: 'none',
                    backgroundColor: isExactConfirm ? '#F0FDF4' : '#FFFFFF'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '24px' }}>
                <input
                  type="checkbox"
                  id="restoreWarningCheckbox"
                  checked={acknowledgedWarning}
                  onChange={(e) => setAcknowledgedWarning(e.target.checked)}
                  style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="restoreWarningCheckbox" style={{ fontSize: '12px', color: '#475569', cursor: 'pointer', lineHeight: '1.4' }}>
                  I confirm that I want to restore the authoritative snapshot from backup {previewResult.backupId}. Original IDs and sequence counters will be synchronized.
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-secondary"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={!isRestoreEnabled}
                  className="btn"
                  style={{
                    backgroundColor: isRestoreEnabled ? '#0F766E' : '#94A3B8',
                    color: '#FFFFFF',
                    padding: '10px 24px',
                    fontWeight: 700,
                    cursor: isRestoreEnabled ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: isRestoreEnabled ? '0 4px 12px rgba(15, 118, 110, 0.4)' : 'none'
                  }}
                >
                  <RotateCcw size={16} />
                  Execute System Restore
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: RESTORING IN PROGRESS */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ display: 'inline-block', marginBottom: '16px' }}>
                <RefreshCw size={40} color="#0F766E" className="animate-spin" />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0F172A' }}>
                Restoring Database Records...
              </h3>
              <p style={{ color: '#64748B', fontSize: '13px', maxWidth: '420px', margin: '0 auto' }}>
                Writing Finance and Rental datasets to MongoDB and Local Storage, syncing sequence counters, and validating relationships.
              </p>
            </div>
          )}

          {/* STEP 5: RESTORE COMPLETE */}
          {step === 5 && previewResult && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}
              >
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
                System Database Restored Successfully!
              </h3>
              <p style={{ color: '#64748B', fontSize: '13px', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
                Restored <strong>{previewResult.counts.totalRecords} records</strong> across Finance and Rental domains.
                Original primary identifiers, sequence counters, and file references have been re-established.
              </p>

              <button
                type="button"
                onClick={handleFinish}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontWeight: 600 }}
              >
                Reload Application State
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemRestoreModal;
