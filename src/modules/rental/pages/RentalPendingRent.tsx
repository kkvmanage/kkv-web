import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  Calendar,
  Search,
  RotateCcw,
  CheckCircle2,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Phone,
  Wallet,
  X,
  AlertCircle,
  History,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import {
  PendingRentItem,
  PendingRentSummary,
  RentalComplex,
  RentalShop,
  RentalPayment
} from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { RentalStatCard } from '../components/RentalStatCard';
import { PaymentModal } from '../components/PaymentModal';
import { useApp } from '../../../context/AppContext';

export const RentalPendingRent: React.FC = () => {
  const { hasPermission, showToast } = useApp();

  const getCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  // Check URL search parameters or session storage for deep linking
  const getInitialFilters = () => {
    let initialComplex = '';
    let initialMonth = getCurrentMonth();

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlComplex = searchParams.get('complexId');
      const urlMonth = searchParams.get('month');

      if (urlComplex) initialComplex = urlComplex;
      if (urlMonth) initialMonth = urlMonth;
    } catch {
      // Ignore URL parsing failure
    }

    return { initialComplex, initialMonth };
  };

  const { initialComplex, initialMonth } = getInitialFilters();

  const [month, setMonth] = useState<string>(initialMonth);
  const [complexId, setComplexId] = useState<string>(initialComplex);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'DUE' | 'PARTIAL' | 'PAID'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [items, setItems] = useState<PendingRentItem[]>([]);
  const [summary, setSummary] = useState<PendingRentSummary>({
    totalPendingRent: 0,
    totalOverdueRent: 0,
    totalDueTodayRent: 0,
    totalPartialRent: 0,
    totalPendingShops: 0,
    totalOverdueShops: 0,
    totalDueTodayShops: 0,
    totalPartialShops: 0
  });

  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [shops, setShops] = useState<RentalShop[]>([]);

  // Collect Rent Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetComplexId, setTargetComplexId] = useState<string>('');
  const [targetShopId, setTargetShopId] = useState<string>('');

  // Payment History Modal State
  const [historyShop, setHistoryShop] = useState<PendingRentItem | null>(null);
  const [historyPayments, setHistoryPayments] = useState<RentalPayment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Shop Details Modal State
  const [detailsShop, setDetailsShop] = useState<PendingRentItem | null>(null);

  // Sorting State
  type SortField = 'dueDate' | 'pendingAmount' | 'complexName' | 'shopNumber' | 'daysOverdue' | 'monthlyRent' | 'paidAmount';
  const [sortField, setSortField] = useState<SortField>('daysOverdue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchPendingRent = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [res, compRes, shopRes] = await Promise.all([
        rentalApi.getPendingRent({
          month,
          complexId: complexId || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: debouncedSearch || undefined
        }),
        rentalApi.getComplexes(),
        rentalApi.getShops()
      ]);

      if (res.success && res.data) {
        setItems(res.data.items || []);
        const s = res.data.summary;
        setSummary({
          totalPendingRent: s?.totalPendingRent ?? s?.totalPendingAmount ?? 0,
          totalOverdueRent: s?.totalOverdueRent ?? s?.overdueAmount ?? 0,
          totalDueTodayRent: s?.totalDueTodayRent ?? s?.dueTodayAmount ?? 0,
          totalPartialRent: s?.totalPartialRent ?? s?.partiallyPaidAmount ?? 0,
          totalPendingShops: s?.totalPendingShops ?? s?.pendingShops ?? 0,
          totalOverdueShops: s?.totalOverdueShops ?? s?.overdueShops ?? 0,
          totalDueTodayShops: s?.totalDueTodayShops ?? s?.dueTodayShops ?? 0,
          totalPartialShops: s?.totalPartialShops ?? s?.partiallyPaidShops ?? 0
        });
      } else {
        setErrorMessage(res.message || 'Unable to load pending rent records.');
      }

      if (compRes.success && compRes.data) {
        setComplexes(compRes.data);
      }
      if (shopRes.success && shopRes.data) {
        setShops(shopRes.data);
      }
    } catch (err: any) {
      console.error('[RentalPendingRent] Error fetching pending rent data:', err);
      setErrorMessage(err.message || "We couldn't retrieve the latest rental data.");
      showToast('Failed to load pending rent data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRent();
  }, [month, complexId, statusFilter, debouncedSearch]);

  // Global data change listener
  useEffect(() => {
    const handleDataChanged = () => {
      fetchPendingRent();
    };
    window.addEventListener('kkv_rental_data_changed', handleDataChanged);
    window.addEventListener('SYSTEM_RESTORE_COMPLETED', handleDataChanged);
    return () => {
      window.removeEventListener('kkv_rental_data_changed', handleDataChanged);
      window.removeEventListener('SYSTEM_RESTORE_COMPLETED', handleDataChanged);
    };
  }, [month, complexId, statusFilter, debouncedSearch]);

  const handlePrevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newY = prevDate.getFullYear();
    const newM = String(prevDate.getMonth() + 1).padStart(2, '0');
    setMonth(`${newY}-${newM}`);
  };

  const handleNextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const newY = nextDate.getFullYear();
    const newM = String(nextDate.getMonth() + 1).padStart(2, '0');
    setMonth(`${newY}-${newM}`);
  };

  const handleResetFilters = () => {
    setMonth(getCurrentMonth());
    setComplexId('');
    setStatusFilter('ALL');
    setSearchTerm('');
  };

  const handleOpenCollect = (shop: PendingRentItem) => {
    setTargetComplexId(shop.complexId);
    setTargetShopId(shop.shopId);
    setIsPaymentModalOpen(true);
  };

  const handleViewHistory = async (shop: PendingRentItem) => {
    setHistoryShop(shop);
    setLoadingHistory(true);
    try {
      const res = await rentalApi.getPayments({ shopId: shop.shopId });
      if (res.success && res.data) {
        setHistoryPayments(res.data);
      } else {
        setHistoryPayments([]);
      }
    } catch {
      setHistoryPayments([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'daysOverdue' || field === 'pendingAmount' ? 'desc' : 'asc');
    }
  };

  const sortedItems = useMemo(() => {
    const list = [...items];
    return list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'daysOverdue') {
        comparison = a.daysOverdue - b.daysOverdue;
      } else if (sortField === 'pendingAmount') {
        comparison = a.pendingAmount - b.pendingAmount;
      } else if (sortField === 'paidAmount') {
        comparison = a.paidAmount - b.paidAmount;
      } else if (sortField === 'monthlyRent') {
        comparison = a.monthlyRent - b.monthlyRent;
      } else if (sortField === 'dueDate') {
        comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortField === 'complexName') {
        comparison = a.complexName.localeCompare(b.complexName);
      } else if (sortField === 'shopNumber') {
        comparison = a.shopNumber.localeCompare(b.shopNumber, undefined, { numeric: true });
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [items, sortField, sortOrder]);

  const renderSortIndicator = (field: SortField) => {
    const isActive = sortField === field;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}>
        {!isActive ? (
          <ArrowUpDown size={11} style={{ opacity: 0.35 }} />
        ) : sortOrder === 'asc' ? (
          <ArrowUp size={12} style={{ color: 'var(--primary-color)' }} />
        ) : (
          <ArrowDown size={12} style={{ color: 'var(--primary-color)' }} />
        )}
      </span>
    );
  };

  const formatCurrency = (val: number) => {
    return `₹${(Number(val) || 0).toLocaleString('en-IN')}`;
  };

  const formatDueDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10) - 1;
        const day = parts[2];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${monthNames[monthNum] || parts[1]} ${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatMonthLabel = (mStr: string) => {
    if (!mStr) return '';
    try {
      const [y, m] = mStr.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const mIndex = parseInt(m, 10) - 1;
      return `${monthNames[mIndex] || m} ${y}`;
    } catch {
      return mStr;
    }
  };

  const isFilterActive = Boolean(
    complexId || searchTerm.trim() || statusFilter !== 'ALL' || month !== getCurrentMonth()
  );

  return (
    <div className="page-content" style={{ maxWidth: '100%', padding: '20px' }}>
      {/* 1. Header Section */}
      <RentalHeader
        title="Pending Rent"
        subtitle={`Track due and overdue rent across complexes and shops for ${formatMonthLabel(month)}.`}
        actions={
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={fetchPendingRent}
            title="Refresh pending records"
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} className={loading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* 2. Summary KPI Cards (4 Cards updating automatically on filters) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}
      >
        {loading ? (
          // Skeleton Cards
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="card"
              style={{
                padding: '16px 18px',
                minHeight: '92px',
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ width: '65%' }}>
                <div style={{ height: '11px', width: '50%', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '4px', marginBottom: '8px' }} />
                <div style={{ height: '22px', width: '80%', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '4px', marginBottom: '6px' }} />
                <div style={{ height: '11px', width: '60%', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px' }} />
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.05)' }} />
            </div>
          ))
        ) : (
          <>
            <RentalStatCard
              label="TOTAL PENDING RENT"
              value={formatCurrency(summary.totalPendingRent)}
              subValue={`${summary.totalPendingShops} ${summary.totalPendingShops === 1 ? 'shop' : 'shops'} currently unpaid`}
              icon={<Clock size={19} />}
              variant={summary.totalPendingRent > 0 ? 'danger' : 'default'}
            />

            <RentalStatCard
              label="OVERDUE RENT"
              value={formatCurrency(summary.totalOverdueRent)}
              subValue={`${summary.totalOverdueShops} ${summary.totalOverdueShops === 1 ? 'shop' : 'shops'} past due date`}
              icon={<AlertTriangle size={19} />}
              variant={summary.totalOverdueRent > 0 ? 'danger' : 'default'}
            />

            <RentalStatCard
              label="DUE TODAY"
              value={formatCurrency(summary.totalDueTodayRent)}
              subValue={`${summary.totalDueTodayShops} ${summary.totalDueTodayShops === 1 ? 'shop' : 'shops'} due today`}
              icon={<Calendar size={19} />}
              variant={summary.totalDueTodayRent > 0 ? 'warning' : 'default'}
            />

            <RentalStatCard
              label="PARTIALLY PAID"
              value={`${summary.totalPartialShops} ${summary.totalPartialShops === 1 ? 'Shop' : 'Shops'}`}
              subValue={
                summary.totalPartialShops > 0
                  ? `${formatCurrency(summary.totalPartialRent || 0)} remaining`
                  : 'No partial payments'
              }
              icon={<Wallet size={19} />}
              variant={summary.totalPartialShops > 0 ? 'info' : 'default'}
            />
          </>
        )}
      </div>

      {/* 3. Filters Toolbar */}
      <div
        className="card"
        style={{
          padding: '14px 16px',
          marginBottom: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: '1 1 280px',
              minWidth: '220px',
              position: 'relative'
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '11px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              className="input-control"
              placeholder="Search complex, shop, tenant, mobile..."
              style={{
                paddingLeft: '34px',
                paddingRight: searchTerm ? '32px' : '12px',
                height: '38px',
                fontSize: '13px',
                width: '100%'
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns & Month Controls */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center'
            }}
          >
            {/* Complex Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
                COMPLEX:
              </span>
              <select
                className="input-control"
                style={{ height: '38px', fontSize: '12px', minWidth: '150px' }}
                value={complexId}
                onChange={(e) => setComplexId(e.target.value)}
              >
                <option value="">All Complexes</option>
                {complexes.map((c) => (
                  <option key={c.complexId} value={c.complexId}>
                    {c.complexName}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selector with Quick Prev/Next Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.3px', marginRight: '2px' }}>
                MONTH:
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ height: '38px', width: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={handlePrevMonth}
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="month"
                className="input-control"
                style={{ height: '38px', fontSize: '12px', width: '135px' }}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ height: '38px', width: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={handleNextMonth}
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Status Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
                STATUS:
              </span>
              <select
                className="input-control"
                style={{ height: '38px', fontSize: '12px', minWidth: '130px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">All Pending</option>
                <option value="OVERDUE">Overdue</option>
                <option value="DUE">Due Today</option>
                <option value="PARTIAL">Partially Paid</option>
                <option value="PENDING">Not Paid / Unpaid</option>
                <option value="PAID">Paid (Collected)</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {isFilterActive && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ height: '38px', fontSize: '12px', padding: '0 12px' }}
                onClick={handleResetFilters}
                title="Clear all active filters"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Error Banner (if API fails) */}
      {errorMessage && (
        <div
          className="card"
          style={{
            padding: '14px 18px',
            marginBottom: '20px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626' }}>
            <AlertCircle size={18} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>Unable to load pending rent</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{errorMessage}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            style={{ borderColor: '#dc2626', color: '#dc2626', fontWeight: 600 }}
            onClick={fetchPendingRent}
          >
            Retry
          </button>
        </div>
      )}

      {/* 5. Main Content: Responsive Table on Desktop/Tablet, Clean Stacked Cards on Mobile */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {loading ? (
          /* Table Skeleton Loader */
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Array.from({ length: 6 }).map((_, rIdx) => (
                <div
                  key={rIdx}
                  style={{
                    height: '48px',
                    backgroundColor: rIdx % 2 === 0 ? 'rgba(0,0,0,0.03)' : 'transparent',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 14px',
                    gap: '16px'
                  }}
                >
                  <div style={{ width: '18%', height: '14px', backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: '3px' }} />
                  <div style={{ width: '16%', height: '14px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px' }} />
                  <div style={{ width: '15%', height: '14px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px' }} />
                  <div style={{ width: '12%', height: '14px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '3px' }} />
                  <div style={{ width: '10%', height: '14px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '3px', marginLeft: 'auto' }} />
                  <div style={{ width: '12%', height: '26px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          </div>
        ) : sortedItems.length === 0 ? (
          /* Professional Empty State */
          <div style={{ padding: '64px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16a34a',
                marginBottom: '12px'
              }}
            >
              <CheckCircle2 size={26} />
            </div>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '4px'
              }}
            >
              No Pending Rent
            </h3>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                maxWidth: '380px',
                margin: '0 auto'
              }}
            >
              All currently due rents have been collected.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table (>= 768px) */}
            <div className="table-responsive hidden-on-mobile">
              <table
                className="table"
                style={{
                  margin: 0,
                  width: '100%',
                  borderCollapse: 'collapse'
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-table-header, rgba(0,0,0,0.02))' }}>
                    {/* COMPLEX */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        width: '16%'
                      }}
                      onClick={() => handleSort('complexName')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        COMPLEX {renderSortIndicator('complexName')}
                      </div>
                    </th>

                    {/* SHOP */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        width: '15%'
                      }}
                      onClick={() => handleSort('shopNumber')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        SHOP {renderSortIndicator('shopNumber')}
                      </div>
                    </th>

                    {/* TENANT */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        width: '14%'
                      }}
                    >
                      TENANT
                    </th>

                    {/* DUE DATE */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        width: '11%'
                      }}
                      onClick={() => handleSort('dueDate')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        DUE DATE {renderSortIndicator('dueDate')}
                      </div>
                    </th>

                    {/* MONTHLY RENT */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        textAlign: 'right',
                        cursor: 'pointer',
                        userSelect: 'none',
                        width: '9%'
                      }}
                      onClick={() => handleSort('monthlyRent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        MONTHLY RENT {renderSortIndicator('monthlyRent')}
                      </div>
                    </th>

                    {/* PAID */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        textAlign: 'right',
                        cursor: 'pointer',
                        userSelect: 'none',
                        width: '8%'
                      }}
                      onClick={() => handleSort('paidAmount')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        PAID {renderSortIndicator('paidAmount')}
                      </div>
                    </th>

                    {/* BALANCE */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        textAlign: 'right',
                        cursor: 'pointer',
                        userSelect: 'none',
                        width: '9%'
                      }}
                      onClick={() => handleSort('pendingAmount')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        BALANCE {renderSortIndicator('pendingAmount')}
                      </div>
                    </th>

                    {/* STATUS */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        width: '9%'
                      }}
                    >
                      STATUS
                    </th>

                    {/* ACTION */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        width: '9%'
                      }}
                    >
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedItems.map((item) => {
                    const isOverdue = item.status === 'OVERDUE' || item.daysOverdue > 0;
                    const isDueToday = item.status === 'DUE';
                    const isPartial = item.status === 'PARTIAL' || (item.totalCovered > 0 && item.pendingAmount > 0);
                    const isPaid = item.status === 'PAID';

                    return (
                      <tr
                        key={`${item.complexId}-${item.shopId}`}
                        style={{
                          borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.05))',
                          transition: 'background-color var(--transition-fast)'
                        }}
                      >
                        {/* 1. COMPLEX */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              lineHeight: '1.3'
                            }}
                          >
                            {item.complexName}
                          </div>
                          {item.location && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                                lineHeight: '1.2'
                              }}
                            >
                              {item.location}
                            </div>
                          )}
                        </td>

                        {/* 2. SHOP */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              lineHeight: '1.3'
                            }}
                          >
                            {item.shopNumber}
                          </div>
                          {item.shopName && (
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                marginTop: '1px',
                                lineHeight: '1.2'
                              }}
                            >
                              {item.shopName}
                            </div>
                          )}
                          {item.doorNumber && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '1px',
                                lineHeight: '1.2'
                              }}
                            >
                              Door: {item.doorNumber}
                            </div>
                          )}
                        </td>

                        {/* 3. TENANT */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              lineHeight: '1.3'
                            }}
                          >
                            {item.tenantName || '-'}
                          </div>
                          {item.mobileNumber && (
                            <a
                              href={`tel:${item.mobileNumber}`}
                              style={{
                                fontSize: '11px',
                                color: 'var(--primary-color)',
                                marginTop: '2px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                textDecoration: 'none'
                              }}
                            >
                              <Phone size={10} style={{ opacity: 0.7 }} />
                              <span>{item.mobileNumber}</span>
                            </a>
                          )}
                        </td>

                        {/* 4. DUE DATE */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              lineHeight: '1.3'
                            }}
                          >
                            {formatDueDate(item.dueDate)}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: isOverdue ? '#dc2626' : 'var(--text-muted)',
                              marginTop: '1px',
                              fontWeight: isOverdue ? 600 : 400
                            }}
                          >
                            {isOverdue ? `${item.daysOverdue} days overdue` : `Day ${item.rentDueDay} of month`}
                          </div>
                        </td>

                        {/* 5. MONTHLY RENT */}
                        <td
                          style={{
                            padding: '12px 14px',
                            verticalAlign: 'middle',
                            textAlign: 'right',
                            fontWeight: 500,
                            fontSize: '13px',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {formatCurrency(item.monthlyRent)}
                        </td>

                        {/* 6. PAID */}
                        <td
                          style={{
                            padding: '12px 14px',
                            verticalAlign: 'middle',
                            textAlign: 'right',
                            fontSize: '13px'
                          }}
                        >
                          {item.totalCovered > 0 ? (
                            <div>
                              <span style={{ fontWeight: 600, color: '#16a34a' }}>
                                {formatCurrency(item.totalCovered)}
                              </span>
                              {item.advanceUsed > 0 && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  (Adv: {formatCurrency(item.advanceUsed)})
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>₹0</span>
                          )}
                        </td>

                        {/* 7. BALANCE / PENDING */}
                        <td
                          style={{
                            padding: '12px 14px',
                            verticalAlign: 'middle',
                            textAlign: 'right'
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '14px',
                              color: isPaid ? '#16a34a' : '#dc2626'
                            }}
                          >
                            {formatCurrency(item.pendingAmount)}
                          </span>
                        </td>

                        {/* 8. STATUS */}
                        <td
                          style={{
                            padding: '12px 14px',
                            verticalAlign: 'middle',
                            textAlign: 'center'
                          }}
                        >
                          {isPaid ? (
                            <span
                              className="badge badge-success"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                              }}
                            >
                              PAID
                            </span>
                          ) : isOverdue ? (
                            <span
                              className="badge badge-danger"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                              }}
                            >
                              OVERDUE
                            </span>
                          ) : isDueToday ? (
                            <span
                              className="badge badge-warning"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                              }}
                            >
                              DUE TODAY
                            </span>
                          ) : isPartial ? (
                            <span
                              className="badge badge-info"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                              }}
                            >
                              PARTIALLY PAID
                            </span>
                          ) : (
                            <span
                              className="badge badge-secondary"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                              }}
                            >
                              PENDING
                            </span>
                          )}
                        </td>

                        {/* 9. ACTION */}
                        <td
                          style={{
                            padding: '12px 14px',
                            verticalAlign: 'middle',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {!isPaid && hasPermission('rental', 'create') && (
                              <button
                                type="button"
                                className="btn btn-xs btn-primary"
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '4px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                onClick={() => handleOpenCollect(item)}
                                title={`Collect rent for ${item.shopNumber}`}
                              >
                                <CreditCard size={12} />
                                <span>Collect</span>
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn btn-xs btn-outline"
                              style={{
                                fontSize: '11px',
                                padding: '4px 6px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              onClick={() => handleViewHistory(item)}
                              title="View Payment History"
                            >
                              <History size={12} />
                            </button>

                            <button
                              type="button"
                              className="btn btn-xs btn-outline"
                              style={{
                                fontSize: '11px',
                                padding: '4px 6px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              onClick={() => setDetailsShop(item)}
                              title="View Shop Details"
                            >
                              <Info size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Rental Cards (< 768px, optimized for 320px, 360px, 390px, 430px) */}
            <div className="hidden-on-desktop" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedItems.map((item) => {
                  const isOverdue = item.status === 'OVERDUE' || item.daysOverdue > 0;
                  const isDueToday = item.status === 'DUE';
                  const isPartial = item.status === 'PARTIAL' || (item.totalCovered > 0 && item.pendingAmount > 0);
                  const isPaid = item.status === 'PAID';

                  return (
                    <div
                      key={`mob-${item.complexId}-${item.shopId}`}
                      className="card"
                      style={{
                        padding: '14px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-card)'
                      }}
                    >
                      {/* Mobile Card Top: Complex & Badges */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '8px',
                          marginBottom: '10px',
                          borderBottom: '1px solid rgba(0,0,0,0.05)',
                          paddingBottom: '8px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {item.complexName}
                          </div>
                          {item.location && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.location}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {isPaid ? (
                            <span className="badge badge-success" style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px' }}>
                              PAID
                            </span>
                          ) : isOverdue ? (
                            <span className="badge badge-danger" style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px' }}>
                              {item.daysOverdue}D OVERDUE
                            </span>
                          ) : isDueToday ? (
                            <span className="badge badge-warning" style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px' }}>
                              DUE TODAY
                            </span>
                          ) : isPartial ? (
                            <span className="badge badge-info" style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px' }}>
                              PARTIAL
                            </span>
                          ) : (
                            <span className="badge badge-secondary" style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px' }}>
                              PENDING
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mobile Card Middle: Shop & Tenant Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            SHOP
                          </span>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                            {item.shopNumber}
                          </div>
                          {item.shopName && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {item.shopName}
                            </div>
                          )}
                          {item.doorNumber && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Door: {item.doorNumber}
                            </div>
                          )}
                        </div>

                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            TENANT
                          </span>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                            {item.tenantName || '-'}
                          </div>
                          {item.mobileNumber && (
                            <a
                              href={`tel:${item.mobileNumber}`}
                              style={{
                                fontSize: '11px',
                                color: 'var(--primary-color)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                textDecoration: 'none'
                              }}
                            >
                              <Phone size={9} />
                              {item.mobileNumber}
                            </a>
                          )}
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Due: {formatDueDate(item.dueDate)}
                          </div>
                        </div>
                      </div>

                      {/* Mobile Card Financial Summary Bar */}
                      <div
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.03)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '10px'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>RENT</span>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{formatCurrency(item.monthlyRent)}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>PAID</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: item.totalCovered > 0 ? '#16a34a' : 'inherit' }}>
                            {formatCurrency(item.totalCovered)}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: isPaid ? '#16a34a' : '#dc2626', display: 'block' }}>
                            BALANCE
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: isPaid ? '#16a34a' : '#dc2626' }}>
                            {formatCurrency(item.pendingAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Card Footer: Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {!isPaid && hasPermission('rental', 'create') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              height: '36px',
                              fontSize: '12px'
                            }}
                            onClick={() => handleOpenCollect(item)}
                          >
                            <CreditCard size={14} />
                            <span>Collect Rent</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            height: '36px',
                            padding: '0 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            fontSize: '11px'
                          }}
                          onClick={() => handleViewHistory(item)}
                          title="Payment History"
                        >
                          <History size={13} />
                          <span>History</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            height: '36px',
                            padding: '0 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            fontSize: '11px'
                          }}
                          onClick={() => setDetailsShop(item)}
                          title="Shop Details"
                        >
                          <Info size={13} />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 6. Collect Rent Modal Integration */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setTargetComplexId('');
          setTargetShopId('');
        }}
        onSuccess={async () => {
          await fetchPendingRent();
        }}
        complexes={complexes}
        shops={shops}
        defaultComplexId={targetComplexId}
        defaultShopId={targetShopId}
      />

      {/* 7. Payment History Modal */}
      {historyShop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px'
          }}
          onClick={() => setHistoryShop(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '650px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--bg-card)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Payment History — {historyShop.shopNumber}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {historyShop.complexName} • {historyShop.tenantName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryShop(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                  <RotateCcw size={20} className="spin-animation" style={{ color: 'var(--primary-color)' }} />
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Loading payment records...
                  </div>
                </div>
              ) : historyPayments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  <History size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>No Payment History Found</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    No recorded payments for {historyShop.shopNumber} yet.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {historyPayments.map((p) => (
                    <div
                      key={p.id || p.paymentId}
                      style={{
                        padding: '12px 14px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-table-header, rgba(0,0,0,0.01))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                          Month: {p.paymentMonth}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Paid: {p.paymentDate || '-'} • Mode: {p.paymentMode} {p.paymentId ? `• ID: ${p.paymentId}` : ''}
                        </div>
                        {p.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                            {p.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#16a34a' }}>
                          {formatCurrency(p.amountReceived)}
                        </div>
                        {p.advanceUsed > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            Adv Used: {formatCurrency(p.advanceUsed)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'var(--bg-table-header, rgba(0,0,0,0.02))'
              }}
            >
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setHistoryShop(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Shop & Tenant Details Modal */}
      {detailsShop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px'
          }}
          onClick={() => setDetailsShop(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--bg-card)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Shop Details — {detailsShop.shopNumber}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {detailsShop.complexName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsShop(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Complex
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {detailsShop.complexName}
                  </div>
                  {detailsShop.location && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{detailsShop.location}</div>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Shop Number
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {detailsShop.shopNumber} {detailsShop.doorNumber ? `(Door ${detailsShop.doorNumber})` : ''}
                  </div>
                  {detailsShop.shopName && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{detailsShop.shopName}</div>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Tenant Name
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {detailsShop.tenantName || '-'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Mobile Number
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {detailsShop.mobileNumber ? (
                      <a
                        href={`tel:${detailsShop.mobileNumber}`}
                        style={{ color: 'var(--primary-color)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Phone size={11} />
                        {detailsShop.mobileNumber}
                      </a>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Monthly Rent
                  </span>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {formatCurrency(detailsShop.monthlyRent)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Rent Due Day
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    Day {detailsShop.rentDueDay} of every month
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    EB Number
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {detailsShop.ebNumber || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Current Due Date
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {formatDueDate(detailsShop.dueDate)}
                  </div>
                </div>
              </div>

              {/* Financial Box */}
              <div
                style={{
                  backgroundColor: 'var(--bg-table-header, rgba(0,0,0,0.03))',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                    Paid in {month}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>
                    {formatCurrency(detailsShop.paidAmount)}
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                    Pending Balance
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: detailsShop.pendingAmount > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(detailsShop.pendingAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-table-header, rgba(0,0,0,0.02))'
              }}
            >
              {detailsShop.pendingAmount > 0 && hasPermission('rental', 'create') ? (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    const target = detailsShop;
                    setDetailsShop(null);
                    handleOpenCollect(target);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <CreditCard size={14} />
                  <span>Collect Rent</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setDetailsShop(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
