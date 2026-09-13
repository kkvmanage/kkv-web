import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  RefreshCw,
  Search,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  CreditCard,
  Clock,
  Database,
  X
} from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import { AdminRentalSummary } from '../types/rental.types';
import { useApp } from '../../../context/AppContext';

export const RentalAdminView: React.FC = () => {
  const { setCurrentPage } = useApp();
  // ── Month Filter State ───────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().substring(0, 7); // e.g. "2026-09"
  });

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'payments' | 'expenses' | 'pending' | 'statement'>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedComplexFilter, setSelectedComplexFilter] = useState<string>('ALL');

  // ── Data State ──────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<AdminRentalSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [syncStatusInfo, setSyncStatusInfo] = useState<any | null>(null);

  const currentVersionRef = useRef<number | undefined>(undefined);
  currentVersionRef.current = summary?.version;

  // ── Read-Only Detail Modals / Drawers ────────────────────────────────────────
  const [selectedComplexId, setSelectedComplexId] = useState<string | null>(null);
  const [complexDetailData, setComplexDetailData] = useState<any | null>(null);
  const [complexDetailLoading, setComplexDetailLoading] = useState<boolean>(false);

  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [shopDetailData, setShopDetailData] = useState<any | null>(null);
  const [shopDetailLoading, setShopDetailLoading] = useState<boolean>(false);

  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<any | null>(null);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<any | null>(null);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const handleResetRentalData = async () => {
    if (resetConfirmText.trim() !== 'RESET RENTAL DATA') {
      alert('Please type "RESET RENTAL DATA" exactly to confirm.');
      return;
    }
    setIsResetting(true);
    try {
      const res = await rentalApi.resetRentalData();
      if (res.success) {
        setShowResetModal(false);
        setResetConfirmText('');
        await fetchSummary(true);
      } else {
        alert(res.message || 'Failed to reset rental records');
      }
    } catch (err: any) {
      alert(err?.message || 'Error resetting rental data');
    } finally {
      setIsResetting(false);
    }
  };

  // ── Fetch Summary ───────────────────────────────────────────────────────────
  const fetchSummary = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [res, syncRes] = await Promise.all([
        rentalApi.getAdminSummary(
          selectedMonth,
          selectedComplexFilter !== 'ALL' ? selectedComplexFilter : undefined,
          searchQuery || undefined
        ),
        rentalApi.getAdminSyncStatus().catch(() => null)
      ]);

      if (res.success && res.data) {
        setSummary(res.data);
        setLastRefreshedAt(new Date());
      } else {
        setError(res.message || 'Failed to fetch synchronized rental data');
      }

      if (syncRes && syncRes.success && syncRes.data) {
        setSyncStatusInfo(syncRes.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Network error occurred while fetching rental data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedMonth, selectedComplexFilter]);

  // ── 2-Minute Background Auto-Sync Poller ──────────────────────────────────
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const syncRes = await rentalApi.getAdminSyncStatus();
        if (syncRes.success && syncRes.data) {
          setSyncStatusInfo(syncRes.data);
          const serverVersion = syncRes.data.version;
          if (serverVersion && serverVersion !== currentVersionRef.current) {
            // Version updated by Rental staff/Drive worker; seamlessly refresh summary
            const summaryRes = await rentalApi.getAdminSummary(
              selectedMonth,
              selectedComplexFilter !== 'ALL' ? selectedComplexFilter : undefined,
              searchQuery || undefined
            );
            if (summaryRes.success && summaryRes.data) {
              setSummary(summaryRes.data);
              setLastRefreshedAt(new Date());
            }
          }
        }
      } catch (e) {
        console.warn('[RentalAdminView] 2-min auto-sync check error:', e);
      }
    }, 120000); // 2 minutes

    return () => clearInterval(timer);
  }, [selectedMonth, selectedComplexFilter, searchQuery]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const formatMonthLabel = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    } catch {
      return monthStr;
    }
  };

  // ── Load Complex Details ────────────────────────────────────────────────────
  const openComplexDrawer = async (complexId: string) => {
    setSelectedComplexId(complexId);
    setComplexDetailLoading(true);
    setComplexDetailData(null);
    try {
      const res = await rentalApi.getAdminComplexDetails(complexId, selectedMonth);
      if (res.success && res.data) {
        setComplexDetailData(res.data);
      }
    } catch (err) {
      console.warn('Failed to load complex details:', err);
    } finally {
      setComplexDetailLoading(false);
    }
  };

  // ── Load Shop Details ───────────────────────────────────────────────────────
  const openShopDrawer = async (shopId: string) => {
    setSelectedShopId(shopId);
    setShopDetailLoading(true);
    setShopDetailData(null);
    try {
      const res = await rentalApi.getAdminShopDetails(shopId, selectedMonth);
      if (res.success && res.data) {
        setShopDetailData(res.data);
      }
    } catch (err) {
      console.warn('Failed to load shop details:', err);
    } finally {
      setShopDetailLoading(false);
    }
  };

  // Available complexes for filter
  const complexOptions = useMemo(() => {
    if (!summary?.complexPerformance) return [];
    return summary.complexPerformance.map((c) => ({
      id: c.complexId,
      name: c.complexName
    }));
  }, [summary]);

  const activeSyncState = syncStatusInfo?.status || summary?.syncStatus || 'SYNCED';
  const isDelayed = activeSyncState === 'SYNC_DELAYED' || activeSyncState === 'DELAYED';
  const isPending = activeSyncState === 'SYNC_PENDING' || activeSyncState === 'PENDING';
  const displayVersion = syncStatusInfo?.version || summary?.version || 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── TOP ACTION & SYNC STATUS BAR ─────────────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '18px 24px',
          borderRadius: '16px',
          border: '1px solid #DDE5DF',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(23, 107, 82, 0.12)',
              color: '#176B52',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#1F2D26', margin: 0 }}>
                Complex Rental Management
              </h3>
              
              {/* Live Sync Badge */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: '6px',
                  backgroundColor: isDelayed ? '#FEE2E2' : (isPending ? '#FEF3C7' : '#DEF7EC'),
                  color: isDelayed ? '#991B1B' : (isPending ? '#92400E' : '#03543F'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: isDelayed ? '#DC2626' : (isPending ? '#D97706' : '#059669')
                  }}
                />
                {isDelayed ? 'Sync Delayed' : (isPending ? 'Sync Pending' : 'Live Synced')}
              </span>

              {/* Source Tag */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#176B52',
                  backgroundColor: 'rgba(23, 107, 82, 0.08)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Database size={11} />
                <span>Authoritative Rental Database</span>
              </span>

              {/* Version Tag */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#4B5563',
                  backgroundColor: '#F3F4F6',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}
              >
                v{displayVersion}
              </span>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#66756D',
                  backgroundColor: '#F3F4F6',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}
              >
                READ-ONLY
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#66756D', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>Authoritative synchronized rental records from Rental Staff Application.</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#4B5563' }}>
                <Clock size={12} />
                Last refreshed: {lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{ color: '#059669', fontSize: '11px', fontWeight: 600 }}>
                &bull; Auto-sync poller: Active (2m)
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F8FAF9', borderRadius: '10px', border: '1px solid #DDE5DF', padding: '2px' }}>
            <button
              type="button"
              className="btn btn-icon btn-sm"
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{ border: 'none', background: 'transparent', height: '32px', width: '32px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#1F2D26', padding: '0 8px', minWidth: '130px', textAlign: 'center' }}>
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              type="button"
              className="btn btn-icon btn-sm"
              onClick={handleNextMonth}
              title="Next Month"
              style={{ border: 'none', background: 'transparent', height: '32px', width: '32px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Refresh Live Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchSummary(false)}
            disabled={refreshing || loading}
            style={{ fontSize: '13px', height: '38px', gap: '6px', fontWeight: 700 }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin-animation' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Rental Data'}</span>
          </button>

          {/* Reset Rental Records Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setResetConfirmText('');
              setShowResetModal(true);
            }}
            style={{
              color: '#DC2626',
              borderColor: '#FCA5A5',
              backgroundColor: '#FEF2F2',
              fontSize: '13px',
              height: '38px',
              fontWeight: 700
            }}
            title="Clean/Reset test rental records safely"
          >
            <span>Reset Rental Data</span>
          </button>

          {/* Launch Staff Portal Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCurrentPage('rental-dashboard')}
            style={{
              backgroundColor: '#176B52',
              color: '#FFFFFF',
              fontWeight: 800,
              borderRadius: '10px',
              height: '38px',
              padding: '0 16px',
              gap: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Launch Rental Operational Portal"
          >
            <span>Open Rental Portal</span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* ── SYNC DELAYED WARNING BANNER (NON-DESTRUCTIVE) ─────────────────────── */}
      {isDelayed && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '12px',
            color: '#92400E',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>
              <strong>Google Drive Sync Delayed:</strong> Rental staff entries are safely queued and persisted locally. Background worker is retrying cloud sync. All figures below reflect the latest cached state.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => fetchSummary(false)}
            style={{ backgroundColor: '#D97706', color: '#FFF', border: 'none', padding: '4px 12px', borderRadius: '6px', fontWeight: 700 }}
          >
            Check Status
          </button>
        </div>
      )}

      {/* ── ERROR NOTICE (IF ANY) ────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#FEE2E2',
            border: '1px solid #F87171',
            borderRadius: '12px',
            color: '#991B1B',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => fetchSummary()}
            style={{ backgroundColor: '#991B1B', color: '#FFF', border: 'none', padding: '4px 12px', borderRadius: '6px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 8 HIGH-LEVEL STAT CARDS ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-label">TOTAL COMPLEXES</span>
            <span className="stat-card-value">{summary?.totalComplexes ?? 0}</span>
          </div>
          <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52' }}>
            <Building2 size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-label">TOTAL SHOPS</span>
            <span className="stat-card-value">{summary?.totalShops ?? 0}</span>
          </div>
          <div className="stat-card-icon" style={{ backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0D9488' }}>
            <Building2 size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-label">EXPECTED MONTHLY RENT</span>
            <span className="stat-card-value">₹{(summary?.expectedMonthlyRent || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="stat-card-icon" style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#B48909' }}>
            <DollarSign size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-label">COLLECTED THIS MONTH</span>
            <span className="stat-card-value" style={{ color: '#059669' }}>
              ₹{(summary?.collectedThisMonth || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="stat-card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#059669' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-label">PENDING RENT</span>
            <span className="stat-card-value" style={{ color: (summary?.pendingRent || 0) > 0 ? '#DC2626' : '#1F2D26' }}>
              ₹{(summary?.pendingRent || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="stat-card-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#DC2626' }}>
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-label">AVAILABLE ADVANCE</span>
            <span className="stat-card-value" style={{ color: '#2563EB' }}>
              ₹{((summary?.availableAdvance ?? summary?.advanceAmount) || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="stat-card-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563EB' }}>
            <Wallet size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-label">TOTAL EXPENSES</span>
            <span className="stat-card-value" style={{ color: '#D97706' }}>
              ₹{(summary?.totalExpenses || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="stat-card-icon" style={{ backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#D97706' }}>
            <DollarSign size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-label">NET RENTAL COLLECTION</span>
            <span className="stat-card-value" style={{ color: '#176B52', fontWeight: 900 }}>
              ₹{(summary?.netCollection || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.15)', color: '#176B52' }}>
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* ── TODAY'S METRICS & PAYMENT MODE SPLIT ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Today's Activity & Collection Rate */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid #DDE5DF' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#1F2D26', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Receipt size={16} style={{ color: '#176B52' }} />
            <span>Today's Activity & Collection Rate</span>
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
            <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Today's Collection</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
                ₹{(summary?.todaysCollection || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Today's Expenses</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#D97706', marginTop: '4px' }}>
                ₹{(summary?.todaysExpenses || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Collection Rate</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#176B52', marginTop: '4px' }}>
                {summary?.collectionRate ?? 0}%
              </div>
            </div>
          </div>
        </div>

        {/* Payment Mode Split */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid #DDE5DF' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#1F2D26', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CreditCard size={16} style={{ color: '#176B52' }} />
            <span>Payment Mode Breakdown ({formatMonthLabel(selectedMonth)})</span>
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
            <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Cash Collection</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#1F2D26', marginTop: '4px' }}>
                ₹{(summary?.paymentModeSplit?.cashTotal || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '10.5px', color: '#66756D', marginTop: '2px' }}>
                {summary?.paymentModeSplit?.cashCount || 0} txn(s)
              </div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>GPay / UPI</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#2563EB', marginTop: '4px' }}>
                ₹{(summary?.paymentModeSplit?.gpayTotal || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '10.5px', color: '#66756D', marginTop: '2px' }}>
                {summary?.paymentModeSplit?.gpayCount || 0} txn(s)
              </div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Split (Both)</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#7C3AED', marginTop: '4px' }}>
                {summary?.paymentModeSplit?.bothCount || 0} txn(s)
              </div>
              <div style={{ fontSize: '10.5px', color: '#66756D', marginTop: '2px' }}>
                Mixed Modes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUB-NAVIGATION TABS & SEARCH/FILTERS ──────────────────────────────── */}
      <div className="card" style={{ padding: '14px 20px', borderRadius: '14px', border: '1px solid #DDE5DF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Subtabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${activeSubTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('overview')}
              style={{ fontSize: '13px', padding: '6px 14px', fontWeight: 700 }}
            >
              Complex Performance ({summary?.complexPerformance?.length || 0})
            </button>
            <button
              type="button"
              className={`btn ${activeSubTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('payments')}
              style={{ fontSize: '13px', padding: '6px 14px', fontWeight: 700 }}
            >
              Recent Payments ({summary?.recentPayments?.length || 0})
            </button>
            <button
              type="button"
              className={`btn ${activeSubTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('expenses')}
              style={{ fontSize: '13px', padding: '6px 14px', fontWeight: 700 }}
            >
              Rental Expenses ({summary?.recentExpenses?.length || 0})
            </button>
            <button
              type="button"
              className={`btn ${activeSubTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('pending')}
              style={{ fontSize: '13px', padding: '6px 14px', fontWeight: 700 }}
            >
              Pending Rent ({summary?.pendingRentList?.length || 0})
            </button>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {complexOptions.length > 0 && (
              <select
                className="input-control"
                style={{ height: '36px', fontSize: '12.5px', padding: '0 10px', minWidth: '160px' }}
                value={selectedComplexFilter}
                onChange={(e) => setSelectedComplexFilter(e.target.value)}
              >
                <option value="ALL">All Complexes</option>
                {complexOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <div style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                className="input-control"
                style={{ paddingLeft: '34px', height: '36px', fontSize: '12.5px' }}
                placeholder="Search shop, tenant, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchSummary();
                }}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#66756D' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── SUBTAB 1: COMPLEX-WISE PERFORMANCE ───────────────────────────────── */}
      {activeSubTab === 'overview' && (
        <div className="card" style={{ padding: '20px', borderRadius: '14px', border: '1px solid #DDE5DF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#1F2D26', margin: 0 }}>
              COMPLEX-WISE PERFORMANCE BREAKDOWN ({formatMonthLabel(selectedMonth)})
            </h4>
            <span style={{ fontSize: '12px', color: '#66756D' }}>
              Showing {summary?.complexPerformance?.length || 0} registered complex(es)
            </span>
          </div>

          {(!summary?.complexPerformance || summary.complexPerformance.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#66756D' }}>
              <Building2 size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                {summary?.syncStatus === 'NO_DATA' ? 'No complexes registered yet in Rental system.' : 'No complexes found matching your filter.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAF9', borderBottom: '2px solid #DDE5DF', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>COMPLEX</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>SHOPS</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>EXPECTED</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>COLLECTED</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>PENDING</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>ADVANCE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>EXPENSES</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>NET COLLECTION</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>RATE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.complexPerformance.map((c) => (
                    <tr key={c.complexId} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 800, color: '#1F2D26' }}>{c.complexName}</div>
                        <div style={{ fontSize: '11px', color: '#66756D' }}>{c.complexId} &bull; {c.location || 'Salem'}</div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(23, 107, 82, 0.08)', color: '#176B52', fontWeight: 800, fontSize: '12px' }}>
                          {c.totalShops || 0}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                        ₹{(c.expectedRent || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                        ₹{(c.collected || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: (c.pending || 0) > 0 ? '#DC2626' : '#1F2D26' }}>
                        ₹{(c.pending || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>
                        ₹{(c.advance || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>
                        ₹{(c.expenses || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, color: '#176B52' }}>
                        ₹{((c.netCollection ?? c.net) || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: (c.collectionRate || 0) >= 80 ? '#059669' : '#D97706' }}>
                          {c.collectionRate ?? 0}%
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openComplexDrawer(c.complexId)}
                          style={{ fontSize: '12px', padding: '4px 10px', gap: '4px' }}
                          title="View complex read-only breakdown and shops"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUBTAB 2: RECENT RENT PAYMENTS ───────────────────────────────────── */}
      {activeSubTab === 'payments' && (
        <div className="card" style={{ padding: '20px', borderRadius: '14px', border: '1px solid #DDE5DF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#1F2D26', margin: 0 }}>
              RECENT RENT PAYMENTS
            </h4>
            <span style={{ fontSize: '12px', color: '#66756D' }}>
              Showing latest {summary?.recentPayments?.length || 0} transaction(s)
            </span>
          </div>

          {(!summary?.recentPayments || summary.recentPayments.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#66756D' }}>
              <Receipt size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '14px' }}>No payments recorded for this criteria.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAF9', borderBottom: '2px solid #DDE5DF', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>PAYMENT ID</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>DATE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>COMPLEX / SHOP</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>TENANT</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>RENT MONTH</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>MODE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>BALANCE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentPayments.map((p) => (
                    <tr key={p.paymentId} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '12px', fontWeight: 800, color: '#176B52' }}>
                        {p.paymentId}
                      </td>
                      <td style={{ padding: '12px', color: '#1F2D26' }}>
                        {p.paymentDate}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#1F2D26' }}>{p.complexName}</div>
                        <div style={{ fontSize: '11px', color: '#66756D' }}>Shop: {p.shopNumber}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#1F2D26' }}>{p.tenantName}</div>
                        {p.mobileNumber && <div style={{ fontSize: '11px', color: '#66756D' }}>+91 {p.mobileNumber}</div>}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#1F2D26' }}>
                        {p.paymentMonth}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, color: '#059669' }}>
                        ₹{(p.amountReceived || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F3F4F6', color: '#374151' }}>
                          {p.paymentMode}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: (p.balance || 0) > 0 ? '#DC2626' : '#059669' }}>
                        ₹{(p.balance || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: (p.paymentStatus === 'PAID') ? '#DEF7EC' : '#FEF08A',
                            color: (p.paymentStatus === 'PAID') ? '#03543F' : '#854D0E'
                          }}
                        >
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedPaymentDetail(p)}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          <Eye size={13} />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUBTAB 3: RENTAL EXPENSES ────────────────────────────────────────── */}
      {activeSubTab === 'expenses' && (
        <div className="card" style={{ padding: '20px', borderRadius: '14px', border: '1px solid #DDE5DF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#1F2D26', margin: 0 }}>
              RENTAL EXPENSES LEDGER
            </h4>
            <span style={{ fontSize: '12px', color: '#66756D' }}>
              Showing latest {summary?.recentExpenses?.length || 0} expense(s)
            </span>
          </div>

          {(!summary?.recentExpenses || summary.recentExpenses.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#66756D' }}>
              <DollarSign size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '14px' }}>No expenses recorded for this criteria.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAF9', borderBottom: '2px solid #DDE5DF', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>EXPENSE ID</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>SCOPE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>DATE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>COMPLEX</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>CATEGORY</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>REASON</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>MODE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentExpenses.map((e: any) => (
                    <tr key={e.expenseId} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '12px', fontWeight: 800, color: '#D97706' }}>
                        {e.expenseId}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: e.expenseScope === 'COMPLEX' ? '#DBEAFE' : '#F3E8FF',
                            color: e.expenseScope === 'COMPLEX' ? '#1D4ED8' : '#6D28D9'
                          }}
                        >
                          {e.expenseScope || 'COMPLEX'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#1F2D26' }}>
                        {e.expenseDate}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#1F2D26' }}>
                        {e.complexName}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                          {e.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#374151' }}>
                        {e.expenseReason}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, color: '#DC2626' }}>
                        ₹{(e.expenseAmount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: Number.isInteger(e.expenseAmount) ? 0 : 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F3F4F6', color: '#374151' }}>
                          {e.paymentMode}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedExpenseDetail(e)}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUBTAB 4: PENDING RENT & TENANTS ──────────────────────────────────── */}
      {activeSubTab === 'pending' && (
        <div className="card" style={{ padding: '20px', borderRadius: '14px', border: '1px solid #DDE5DF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#1F2D26', margin: 0 }}>
                PENDING RENT & TENANT BALANCES ({formatMonthLabel(selectedMonth)})
              </h4>
              <p style={{ fontSize: '12px', color: '#66756D', margin: '2px 0 0' }}>
                Sorted by highest outstanding balance first.
              </p>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#DC2626' }}>
              Total Pending: ₹{(summary?.pendingRent || 0).toLocaleString('en-IN')}
            </div>
          </div>

          {(!summary?.pendingRentList || summary.pendingRentList.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#059669' }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 8px', opacity: 0.8 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                All active shops have fully cleared their rent for {formatMonthLabel(selectedMonth)}!
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAF9', borderBottom: '2px solid #DDE5DF', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>TENANT / SHOP</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>COMPLEX</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>MOBILE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>MONTHLY RENT</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>PAID THIS MONTH</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>PENDING BALANCE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>ADVANCE AVAILABLE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.pendingRentList.map((item) => (
                    <tr key={item.shopId} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 800, color: '#1F2D26' }}>{item.tenantName}</div>
                        <div style={{ fontSize: '11px', color: '#66756D' }}>Shop: {item.shopNumber} ({item.shopName})</div>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#1F2D26' }}>
                        {item.complexName}
                      </td>
                      <td style={{ padding: '12px', color: '#374151' }}>
                        +91 {item.mobileNumber}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                        ₹{(item.monthlyRent || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                        ₹{(item.collectedThisMonth || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, color: item.isDue === false ? 'var(--text-muted)' : '#DC2626' }}>
                        ₹{(item.pendingBalance || 0).toLocaleString('en-IN')}
                        <div style={{ fontSize: '10px', fontWeight: 700, color: item.isDue === false ? '#0284c7' : (item.daysOverdue && item.daysOverdue > 0 ? '#dc2626' : '#d97706') }}>
                          {item.isDue === false ? `Upcoming (${item.dueDate || 'Not due'})` : (item.daysOverdue && item.daysOverdue > 0 ? `${item.daysOverdue}d Overdue` : 'Due Today')}
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>
                        ₹{(item.availableAdvance || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openShopDrawer(item.shopId)}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          <Eye size={13} />
                          <span>Shop Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── READ-ONLY COMPLEX DETAIL DRAWER / MODAL ──────────────────────────── */}
      {selectedComplexId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setSelectedComplexId(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              backgroundColor: '#FFFFFF',
              height: '100%',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E5E7EB', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#176B52' }}>
                  {complexDetailData?.complexId || selectedComplexId}
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#1F2D26', margin: '2px 0 4px' }}>
                  {complexDetailData?.complexName || 'Complex Details'}
                </h3>
                <p style={{ fontSize: '13px', color: '#66756D', margin: 0 }}>
                  Location: {complexDetailData?.location || 'N/A'} &bull; Status: <strong style={{ color: '#059669' }}>{complexDetailData?.status || 'ACTIVE'}</strong>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => setSelectedComplexId(null)}
                style={{ borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            {complexDetailLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <RefreshCw size={28} className="spin-animation" style={{ margin: '0 auto 10px', color: '#176B52' }} />
                <p style={{ fontSize: '13px', color: '#66756D' }}>Loading complex details...</p>
              </div>
            ) : complexDetailData ? (
              <>
                {/* Financial Overview for selected month */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Expected Rent</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#1F2D26', marginTop: '4px' }}>
                      ₹{(complexDetailData.expectedRent || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Collected ({formatMonthLabel(selectedMonth)})</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                      ₹{(complexDetailData.collected || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Pending</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: complexDetailData.pending > 0 ? '#DC2626' : '#1F2D26', marginTop: '4px' }}>
                      ₹{(complexDetailData.pending || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Available Advance</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
                      ₹{(complexDetailData.advance || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Total Expenses</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
                      ₹{(complexDetailData.expenses || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Net Collection</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#176B52', marginTop: '4px' }}>
                      ₹{(complexDetailData.netCollection || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Registered Shops List */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#1F2D26', marginBottom: '12px' }}>
                    SHOPS IN THIS COMPLEX ({complexDetailData.shops?.length || 0})
                  </h4>

                  {(!complexDetailData.shops || complexDetailData.shops.length === 0) ? (
                    <p style={{ fontSize: '13px', color: '#66756D' }}>No shops registered in this complex yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {complexDetailData.shops.map((s: any) => (
                        <div
                          key={s.shopId}
                          style={{
                            padding: '14px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#FAFAFA'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '14px', color: '#1F2D26' }}>{s.shopNumber} - {s.shopName}</strong>
                              <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#DEF7EC', color: '#03543F', fontWeight: 800 }}>
                                {s.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#4B5563', marginTop: '3px' }}>
                              Tenant: <strong>{s.tenantName}</strong> &bull; Mobile: +91 {s.mobileNumber}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                              Monthly Rent: ₹{s.monthlyRent?.toLocaleString('en-IN')} &bull; Current Month Balance:{' '}
                              <strong style={{ color: s.currentMonthBalance > 0 ? '#DC2626' : '#059669' }}>
                                ₹{(s.currentMonthBalance || 0).toLocaleString('en-IN')}
                              </strong>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openShopDrawer(s.shopId)}
                            style={{ fontSize: '12px' }}
                          >
                            <Eye size={13} />
                            <span>View Shop</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p style={{ color: '#DC2626' }}>Failed to load complex information.</p>
            )}
          </div>
        </div>
      )}

      {/* ── READ-ONLY SHOP DETAIL DRAWER / MODAL ─────────────────────────────── */}
      {selectedShopId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setSelectedShopId(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '640px',
              backgroundColor: '#FFFFFF',
              height: '100%',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E5E7EB', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#176B52' }}>
                  {shopDetailData?.shopId || selectedShopId} &bull; {shopDetailData?.complexName}
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#1F2D26', margin: '2px 0 4px' }}>
                  {shopDetailData ? `${shopDetailData.shopNumber} - ${shopDetailData.shopName}` : 'Shop Details'}
                </h3>
                <p style={{ fontSize: '13px', color: '#66756D', margin: 0 }}>
                  Tenant: <strong>{shopDetailData?.tenantName}</strong> &bull; +91 {shopDetailData?.mobileNumber}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => setSelectedShopId(null)}
                style={{ borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            {shopDetailLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <RefreshCw size={28} className="spin-animation" style={{ margin: '0 auto 10px', color: '#176B52' }} />
                <p style={{ fontSize: '13px', color: '#66756D' }}>Loading shop details...</p>
              </div>
            ) : shopDetailData ? (
              <>
                {/* Shop Current Month Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Monthly Rent</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#1F2D26', marginTop: '4px' }}>
                      ₹{(shopDetailData.monthlyRent || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Available Advance</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
                      ₹{(shopDetailData.availableAdvance || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Paid ({formatMonthLabel(selectedMonth)})</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                      ₹{(shopDetailData.currentMonth?.paid || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#F8FAF9', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#66756D', fontWeight: 700 }}>Pending Balance</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: (shopDetailData.currentMonth?.balance || 0) > 0 ? '#DC2626' : '#059669', marginTop: '4px' }}>
                      ₹{(shopDetailData.currentMonth?.balance || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Shop Payment History */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#1F2D26', marginBottom: '12px' }}>
                    PAYMENT HISTORY ({shopDetailData.payments?.length || 0})
                  </h4>

                  {(!shopDetailData.payments || shopDetailData.payments.length === 0) ? (
                    <p style={{ fontSize: '13px', color: '#66756D' }}>No payment records found for this shop.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {shopDetailData.payments.map((p: any) => (
                        <div
                          key={p.paymentId}
                          style={{
                            padding: '12px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12.5px'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, color: '#176B52' }}>{p.paymentId} &bull; Month: {p.paymentMonth}</div>
                            <div style={{ color: '#66756D', marginTop: '2px' }}>
                              Date: {p.paymentDate} &bull; Mode: <strong>{p.paymentMode}</strong>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                              ₹{(p.amountReceived || 0).toLocaleString('en-IN')}
                            </div>
                            <div style={{ fontSize: '11px', color: p.balance > 0 ? '#DC2626' : '#059669' }}>
                              Bal: ₹{(p.balance || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p style={{ color: '#DC2626' }}>Failed to load shop details.</p>
            )}
          </div>
        </div>
      )}

      {/* ── PAYMENT RECEIPT MODAL ────────────────────────────────────────────── */}
      {selectedPaymentDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setSelectedPaymentDetail(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#176B52' }}>RENT PAYMENT RECEIPT</span>
                <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#1F2D26', margin: '2px 0 0' }}>
                  {selectedPaymentDetail.paymentId}
                </h4>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => setSelectedPaymentDetail(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '18px 0', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#66756D' }}>Payment Date:</span>
                <strong>{selectedPaymentDetail.paymentDate}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#66756D' }}>Rent Month:</span>
                <strong>{selectedPaymentDetail.paymentMonth}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#66756D' }}>Complex:</span>
                <strong>{selectedPaymentDetail.complexName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#66756D' }}>Shop:</span>
                <strong>{selectedPaymentDetail.shopNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#66756D' }}>Tenant Name:</span>
                <strong>{selectedPaymentDetail.tenantName}</strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #E5E7EB', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                <span style={{ fontWeight: 800, color: '#1F2D26' }}>Total Amount Received:</span>
                <strong style={{ color: '#059669' }}>₹{(selectedPaymentDetail.amountReceived || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#66756D' }}>
                <span>Payment Mode:</span>
                <span>{selectedPaymentDetail.paymentMode}</span>
              </div>
              {selectedPaymentDetail.cashAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#66756D' }}>
                  <span>Cash Portion:</span>
                  <span>₹{selectedPaymentDetail.cashAmount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              {selectedPaymentDetail.gpayAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#66756D' }}>
                  <span>GPay / UPI Portion:</span>
                  <span>₹{selectedPaymentDetail.gpayAmount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              {selectedPaymentDetail.advanceUsed > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#2563EB' }}>
                  <span>Advance Used:</span>
                  <span>₹{selectedPaymentDetail.advanceUsed?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#66756D' }}>Remaining Balance:</span>
                <strong style={{ color: selectedPaymentDetail.balance > 0 ? '#DC2626' : '#059669' }}>
                  ₹{(selectedPaymentDetail.balance || 0).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: '14px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedPaymentDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPENSE DETAIL MODAL ─────────────────────────────────────────────── */}
      {selectedExpenseDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setSelectedExpenseDetail(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#D97706' }}>RENTAL EXPENSE DETAIL</span>
                <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#1F2D26', margin: '2px 0 0' }}>
                  {selectedExpenseDetail.expenseId}
                </h4>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => setSelectedExpenseDetail(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '18px 0', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#66756D' }}>Date:</span>
                <strong>{selectedExpenseDetail.expenseDate}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#66756D' }}>Complex:</span>
                <strong>{selectedExpenseDetail.complexName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#66756D' }}>Category:</span>
                <strong>{selectedExpenseDetail.category}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#66756D' }}>Reason:</span>
                <strong>{selectedExpenseDetail.expenseReason}</strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #E5E7EB', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                <span style={{ fontWeight: 800, color: '#1F2D26' }}>Amount:</span>
                <strong style={{ color: '#DC2626' }}>₹{(selectedExpenseDetail.expenseAmount || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#66756D' }}>
                <span>Payment Mode:</span>
                <span>{selectedExpenseDetail.paymentMode}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: '14px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedExpenseDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET RENTAL DATA CONFIRMATION MODAL ────────────────────────────── */}
      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '26px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: '17px', fontWeight: 900, color: '#1F2D26', margin: 0 }}>
                  Reset Rental Management Records
                </h4>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0' }}>
                  Safely resets rental complexes, shops, collections, and expenses only.
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#374151',
                lineHeight: '1.5',
                marginBottom: '16px'
              }}
            >
              <div style={{ fontWeight: 700, color: '#047857', marginBottom: '4px' }}>
                ✓ Preserved &amp; Unaffected:
              </div>
              <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <li>Gold Loan portfolios, customer loans, &amp; pledges</li>
                <li>Customer database &amp; KYC records</li>
                <li>Fixed Deposits &amp; accounting entries</li>
                <li>Admin &amp; Staff credentials and permissions</li>
              </ul>
              <div style={{ fontWeight: 700, color: '#DC2626' }}>
                ⚠ Will be cleared to 0 (Clean Slate):
              </div>
              <ul style={{ margin: '0 0 0 16px', padding: 0 }}>
                <li>Rental complexes, shops, tenants</li>
                <li>Rent collections, advance balances, &amp; expenses</li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                Type <span style={{ color: '#DC2626', fontFamily: 'monospace' }}>RESET RENTAL DATA</span> to confirm:
              </label>
              <input
                type="text"
                className="input-control"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET RENTAL DATA"
                style={{ width: '100%', fontFamily: 'monospace', textTransform: 'uppercase' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText('');
                }}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleResetRentalData}
                disabled={resetConfirmText.trim() !== 'RESET RENTAL DATA' || isResetting}
                style={{
                  backgroundColor: '#DC2626',
                  borderColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 800
                }}
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset Rental Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
