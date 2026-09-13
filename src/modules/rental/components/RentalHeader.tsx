import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import { SyncSummary } from '../types/rental.types';

interface RentalHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const RentalHeader: React.FC<RentalHeaderProps> = ({ title, subtitle, actions }) => {
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchSyncStatus = async () => {
    try {
      const res = await rentalApi.getSyncStatus();
      if (res && res.success && res.data) {
        setSyncSummary(res.data);
      } else {
        setSyncSummary(null);
      }
    } catch {
      setSyncSummary(null);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRetrySync = async () => {
    setIsRetrying(true);
    try {
      await rentalApi.retrySync();
      await fetchSyncStatus();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-subtle)'
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🏢</span>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            {title}
          </h1>
        </div>
        {subtitle && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Google Drive / Sheets Sync Badge */}
        {syncSummary && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor:
                syncSummary.pending > 0 || syncSummary.failed > 0
                  ? 'rgba(234, 179, 8, 0.12)'
                  : 'rgba(34, 197, 94, 0.12)',
              color:
                syncSummary.pending > 0 || syncSummary.failed > 0
                  ? '#ca8a04'
                  : '#16a34a',
              border: `1px solid ${
                syncSummary.pending > 0 || syncSummary.failed > 0
                  ? 'rgba(234, 179, 8, 0.3)'
                  : 'rgba(34, 197, 94, 0.3)'
              }`
            }}
            title={
              syncSummary.isConfigured
                ? `Google Sheets Sync: ${syncSummary.synced} synced, ${syncSummary.pending} pending, ${syncSummary.failed} failed`
                : 'Primary Database Active (Local). Google Drive credentials pending in .env.'
            }
          >
            <span style={{ fontSize: '12px' }}>
              {syncSummary.pending === 0 && syncSummary.failed === 0 ? '🟢' : '🟡'}
            </span>
            <span>
              {syncSummary.pending === 0 && syncSummary.failed === 0
                ? 'Sheets Synced'
                : `${syncSummary.pending + syncSummary.failed} Sync Pending`}
            </span>
            {(syncSummary.pending > 0 || syncSummary.failed > 0) && (
              <button
                type="button"
                onClick={handleRetrySync}
                disabled={isRetrying}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'inherit'
                }}
                title="Retry Google Drive Sync"
              >
                <RefreshCw size={12} className={isRetrying ? 'spin-animation' : ''} />
              </button>
            )}
          </div>
        )}

        {actions}
      </div>
    </div>
  );
};
