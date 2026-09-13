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
  AlertCircle
} from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import {
  PendingRentItem,
  PendingRentSummary,
  RentalComplex,
  RentalShop
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'DUE' | 'PARTIAL'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [items, setItems] = useState<PendingRentItem[]>([]);
  const [summary, setSummary] = useState<PendingRentSummary>({
    totalPendingRent: 0,
    totalOverdueRent: 0,
    totalDueTodayRent: 0,
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

  // Sorting State
  type SortField = 'dueDate' | 'pendingAmount' | 'complexName' | 'shopNumber' | 'daysOverdue' | 'monthlyRent';
  const [sortField, setSortField] = useState<SortField>('daysOverdue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchPendingRent = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [res, compRes, shopRes] = await Promise.all([
        rentalApi.getPendingRent({
          month,
          complexId: complexId || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchTerm || undefined
        }),
        rentalApi.getComplexes(),
        rentalApi.getShops()
      ]);

      if (res.success && res.data) {
        setItems(res.data.items || []);
        setSummary(
          res.data.summary || {
            totalPendingRent: 0,
            totalOverdueRent: 0,
            totalDueTodayRent: 0,
            totalPendingShops: 0,
            totalOverdueShops: 0,
            totalDueTodayShops: 0,
            totalPartialShops: 0
          }
        );
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
      setErrorMessage(err.message || 'Failed to communicate with the server.');
      showToast('Failed to load pending rent data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRent();
  }, [month, complexId, statusFilter]);

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
  }, [month, complexId, statusFilter, searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPendingRent();
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

  const isFilterActive = Boolean(
    complexId || searchTerm.trim() || statusFilter !== 'ALL' || month !== getCurrentMonth()
  );

  return (
    <div className="page-content" style={{ maxWidth: '100%', padding: '20px' }}>
      {/* 1. Header Section */}
      <RentalHeader
        title="Pending Rent"
        subtitle="Track due and overdue rent across complexes and shops."
        actions={
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={fetchPendingRent}
            title="Refresh pending records"
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* 2. Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
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
                minHeight: '88px',
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
              subValue={summary.totalPartialShops > 0 ? 'Partial payments recorded' : 'No partial payments'}
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
          padding: '12px 16px',
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
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: '1 1 300px',
              minWidth: '240px',
              position: 'relative'
            }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
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
                  onClick={() => {
                    setSearchTerm('');
                    fetchPendingRent();
                  }}
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
          </form>

          {/* Filter Dropdowns */}
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
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                COMPLEX:
              </span>
              <select
                className="input-control"
                style={{ height: '38px', fontSize: '12px', minWidth: '160px' }}
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

            {/* Month Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                MONTH:
              </span>
              <input
                type="month"
                className="input-control"
                style={{ height: '38px', fontSize: '12px', width: '140px' }}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>

            {/* Status Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                STATUS:
              </span>
              <select
                className="input-control"
                style={{ height: '38px', fontSize: '12px', minWidth: '130px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">All Statuses</option>
                <option value="OVERDUE">Overdue</option>
                <option value="DUE">Due Today</option>
                <option value="PARTIAL">Partially Paid</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {isFilterActive && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ height: '38px', fontSize: '12px', padding: '0 12px' }}
                onClick={handleResetFilters}
                title="Clear all filters"
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
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            style={{ borderColor: '#dc2626', color: '#dc2626' }}
            onClick={fetchPendingRent}
          >
            Retry
          </button>
        </div>
      )}

      {/* 5. Main Content: Table on Desktop/Tablet, Responsive Cards on Mobile */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {loading ? (
          /* Table Skeleton Loader */
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Array.from({ length: 5 }).map((_, rIdx) => (
                <div
                  key={rIdx}
                  style={{
                    height: '46px',
                    backgroundColor: rIdx % 2 === 0 ? 'rgba(0,0,0,0.03)' : 'transparent',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 14px',
                    gap: '16px'
                  }}
                >
                  <div style={{ width: '20%', height: '14px', backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: '3px' }} />
                  <div style={{ width: '18%', height: '14px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px' }} />
                  <div style={{ width: '15%', height: '14px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px' }} />
                  <div style={{ width: '12%', height: '14px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '3px' }} />
                  <div style={{ width: '10%', height: '14px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '3px', marginLeft: 'auto' }} />
                  <div style={{ width: '10%', height: '24px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '4px' }} />
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
                fontSize: '15px',
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
            {/* Desktop & Tablet Table */}
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
                        width: '18%'
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
                        width: '17%'
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

                    {/* RENT */}
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
                        RENT {renderSortIndicator('monthlyRent')}
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
                        width: '8%'
                      }}
                    >
                      PAID
                    </th>

                    {/* PENDING */}
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
                        width: '10%'
                      }}
                      onClick={() => handleSort('pendingAmount')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        PENDING {renderSortIndicator('pendingAmount')}
                      </div>
                    </th>

                    {/* OVERDUE */}
                    <th
                      style={{
                        padding: '12px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        width: '8%'
                      }}
                      onClick={() => handleSort('daysOverdue')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        OVERDUE {renderSortIndicator('daysOverdue')}
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
                        width: '8%'
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
                        width: '11%'
                      }}
                    >
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedItems.map((item) => {
                    const isOverdue = item.daysOverdue > 0;
                    const isPartial = item.status === 'PARTIAL';

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
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Phone size={10} style={{ opacity: 0.6 }} />
                              <span>{item.mobileNumber}</span>
                            </div>
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
                              color: 'var(--text-muted)',
                              marginTop: '1px'
                            }}
                          >
                            Day {item.rentDueDay} of month
                          </div>
                        </td>

                        {/* 5. RENT */}
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

                        {/* 7. PENDING */}
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
                              color: '#dc2626'
                            }}
                          >
                            {formatCurrency(item.pendingAmount)}
                          </span>
                        </td>

                        {/* 8. OVERDUE */}
                        <td
                          style={{
                            padding: '12px 14px',
                            verticalAlign: 'middle',
                            textAlign: 'center'
                          }}
                        >
                          {isOverdue ? (
                            <span
                              className="badge badge-danger"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 7px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px'
                              }}
                            >
                              {item.daysOverdue} {item.daysOverdue === 1 ? 'DAY' : 'DAYS'}
                            </span>
                          ) : (
                            <span
                              className="badge badge-warning"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 7px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px'
                              }}
                            >
                              TODAY
                            </span>
                          )}
                        </td>

                        {/* 9. STATUS */}
                        <td
                          style={{
                            padding: '12px 14px',
                            verticalAlign: 'middle',
                            textAlign: 'center'
                          }}
                        >
                          {isPartial ? (
                            <span
                              className="badge badge-info"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 7px'
                              }}
                            >
                              PARTIAL
                            </span>
                          ) : isOverdue ? (
                            <span
                              className="badge badge-danger"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 7px'
                              }}
                            >
                              OVERDUE
                            </span>
                          ) : (
                            <span
                              className="badge badge-warning"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 7px'
                              }}
                            >
                              DUE
                            </span>
                          )}
                        </td>

                        {/* 10. ACTION */}
                        <td
                          style={{
                            padding: '12px 14px',
                            verticalAlign: 'middle',
                            textAlign: 'center'
                          }}
                        >
                          {hasPermission('rental', 'create') ? (
                            <button
                              type="button"
                              className="btn btn-xs btn-primary"
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onClick={() => handleOpenCollect(item)}
                              title={`Collect rent for ${item.shopNumber}`}
                            >
                              <CreditCard size={12} />
                              <span>Collect Rent</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>View Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Rental Cards (< 768px) */}
            <div className="hidden-on-desktop" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedItems.map((item) => {
                  const isOverdue = item.daysOverdue > 0;
                  const isPartial = item.status === 'PARTIAL';

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
                          marginBottom: '8px',
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
                          {isOverdue ? (
                            <span className="badge badge-danger" style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px' }}>
                              {item.daysOverdue}D
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px' }}>
                              TODAY
                            </span>
                          )}
                          <span
                            className={`badge ${isPartial ? 'badge-info' : isOverdue ? 'badge-danger' : 'badge-warning'}`}
                            style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px' }}
                          >
                            {item.status}
                          </span>
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
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <Phone size={9} />
                              {item.mobileNumber}
                            </div>
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
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', display: 'block' }}>PENDING</span>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: '#dc2626' }}>
                            {formatCurrency(item.pendingAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Card Footer: Action Button */}
                      {hasPermission('rental', 'create') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            height: '36px'
                          }}
                          onClick={() => handleOpenCollect(item)}
                        >
                          <CreditCard size={14} />
                          <span>Collect Rent</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 6. Payment Modal Integration */}
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
    </div>
  );
};
