import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AppNotification } from '../../types';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  X,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { calculateNotificationCounts } from '../../utils/notificationUtils';

interface NotificationCenterProps {
  isFullPage?: boolean;
  onClose?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isFullPage = false,
  onClose
}) => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    setIsNotificationOpen,
    setCurrentPage,
    setSelectedLoan,
    loans,
    isRentalPortal
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'DUE' | 'UPCOMING' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const counts = useMemo(() => calculateNotificationCounts(notifications), [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Category / Tab filter
      if (isRentalPortal) {
        if (activeCategory === 'OVERDUE' && n.type !== 'RENT_OVERDUE' && n.type !== 'OVERDUE') return false;
        if (activeCategory === 'DUE' && n.type !== 'RENT_DUE' && n.type !== 'DUE') return false;
        if (activeCategory === 'DEPOSIT' && !n.type.includes('DEPOSIT')) return false;
        if (activeCategory === 'UNREAD' && (n.read || n.type === 'PAID' || n.type === 'RENT_PAYMENT')) return false;
      } else {
        if (activeCategory === 'LOAN' && n.category !== 'LOAN') return false;
        if (activeCategory === 'FIXED_DEPOSIT' && n.category !== 'FIXED_DEPOSIT') return false;
        if (activeCategory === 'UNREAD' && (n.read || n.type === 'PAID')) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'OVERDUE' && n.type !== 'OVERDUE' && n.type !== 'RENT_OVERDUE') return false;
        if (statusFilter === 'DUE' && n.type !== 'DUE' && n.type !== 'RENT_DUE') return false;
        if (statusFilter === 'UPCOMING' && n.type !== 'UPCOMING') return false;
        if (statusFilter === 'PAID' && n.type !== 'PAID' && n.type !== 'RENT_PAYMENT') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          (n.customerName && n.customerName.toLowerCase().includes(q)) ||
          (n.customerId && n.customerId.toLowerCase().includes(q)) ||
          (n.entityId && n.entityId.toLowerCase().includes(q)) ||
          (n.complexName && n.complexName.toLowerCase().includes(q)) ||
          (n.dueDate && n.dueDate.includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [notifications, activeCategory, statusFilter, searchQuery, isRentalPortal]);

  const handleAction = (n: AppNotification) => {
    markNotificationAsRead(n.id);
    if (onClose) onClose();
    setIsNotificationOpen(false);

    if (n.category === 'RENTAL' || n.module === 'RENTAL') {
      if (n.type === 'RENT_DUE' || n.type === 'RENT_OVERDUE' || n.type === 'RENT_PARTIAL') {
        if (n.shopId) (window as any).__selectedRentalShopId = n.shopId;
        setCurrentPage('rental-pending-rent' as any);
      } else if (n.type === 'RENT_PAYMENT') {
        if (n.shopId) (window as any).__selectedRentalShopId = n.shopId;
        setCurrentPage('rental-payments' as any);
      } else if (n.type === 'SECURITY_DEPOSIT_RECEIVED' || n.type === 'SECURITY_DEPOSIT_REFUND') {
        setCurrentPage('rental-day-book' as any);
      } else if (
        n.type === 'SECURITY_DEPOSIT_REFUND_PENDING' ||
        n.type === 'SHOP_CLOSED' ||
        n.type === 'SHOP_CREATED' ||
        n.type === 'SHOP_SETTLEMENT'
      ) {
        if (n.shopId) (window as any).__selectedRentalShopId = n.shopId;
        setCurrentPage('rental-shops' as any);
      } else if (n.type === 'RENTAL_EXPENSE') {
        setCurrentPage('rental-expenses' as any);
      } else if (n.type === 'COMPLEX_STATUS') {
        setCurrentPage('rental-complexes' as any);
      } else {
        setCurrentPage('rental-dashboard' as any);
      }
      return;
    }

    if (n.category === 'LOAN') {
      const matchedLoan = loans.find((l) => l.loanNo === n.entityId || l.id === n.entityDbId);
      if (matchedLoan) {
        setSelectedLoan(matchedLoan);
      }
      setCurrentPage('loan-display');
    } else if (n.category === 'FIXED_DEPOSIT') {
      if (n.type === 'DUE' || n.type === 'OVERDUE') {
        setCurrentPage('deposit-interest');
      } else if (n.type === 'RENEWAL') {
        setCurrentPage('deposit-withdrawal');
      } else {
        setCurrentPage('deposit-display');
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return '#dc2626';
      case 'HIGH':
        return '#ea580c';
      case 'MEDIUM':
        return '#d97706';
      default:
        return '#0284c7';
    }
  };

  const getTypeBadge = (n: AppNotification) => {
    switch (n.type) {
      case 'OVERDUE':
      case 'RENT_OVERDUE':
        return (
          <span
            className="badge badge-danger"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800 }}
          >
            <AlertTriangle size={12} />
            OVERDUE {n.daysOverdue ? `(${n.daysOverdue}d)` : ''}
          </span>
        );
      case 'DUE':
      case 'RENT_DUE':
        return (
          <span
            className="badge badge-warning"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800 }}
          >
            <Clock size={12} />
            DUE TODAY
          </span>
        );
      case 'RENT_PARTIAL':
        return (
          <span
            className="badge badge-warning"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800 }}
          >
            <Clock size={12} />
            PARTIAL DUE
          </span>
        );
      case 'UPCOMING':
        return (
          <span
            className="badge badge-info"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}
          >
            <Clock size={12} />
            UPCOMING {n.daysRemaining !== undefined ? `(${n.daysRemaining}d)` : ''}
          </span>
        );
      case 'PAID':
      case 'RENT_PAYMENT':
        return (
          <span
            className="badge badge-success"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800 }}
          >
            <CheckCircle2 size={12} />
            PAID
          </span>
        );
      case 'SECURITY_DEPOSIT_RECEIVED':
        return (
          <span
            className="badge badge-info"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800 }}
          >
            <CheckCircle2 size={12} />
            DEPOSIT RECEIVED
          </span>
        );
      case 'SECURITY_DEPOSIT_REFUND':
        return (
          <span
            className="badge badge-success"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800 }}
          >
            <CheckCircle2 size={12} />
            DEPOSIT REFUNDED
          </span>
        );
      case 'SECURITY_DEPOSIT_REFUND_PENDING':
        return (
          <span
            className="badge badge-warning"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800 }}
          >
            <Clock size={12} />
            REFUND PENDING
          </span>
        );
      case 'SHOP_CLOSED':
      case 'SHOP_SETTLEMENT':
        return (
          <span
            className="badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: '#64748b',
              color: '#ffffff'
            }}
          >
            CLOSED
          </span>
        );
      case 'SHOP_CREATED':
        return (
          <span
            className="badge badge-info"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800 }}
          >
            NEW SHOP
          </span>
        );
      case 'RENTAL_EXPENSE':
        return (
          <span
            className="badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: '#94a3b8',
              color: '#ffffff'
            }}
          >
            EXPENSE
          </span>
        );
      case 'MATURITY':
        return (
          <span
            className="badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: '#7c3aed',
              color: '#ffffff'
            }}
          >
            <Sparkles size={12} />
            MATURITY
          </span>
        );
      case 'RENEWAL':
        return (
          <span
            className="badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: '#0284c7',
              color: '#ffffff'
            }}
          >
            <RefreshCw size={12} />
            RENEWAL
          </span>
        );
      default:
        return null;
    }
  };

  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: isFullPage ? 'none' : '85vh',
        backgroundColor: 'var(--bg-surface, #ffffff)',
        color: 'var(--text-dark, #1e293b)'
      }}
    >
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: isFullPage ? '24px 28px 16px 28px' : '18px 20px',
          borderBottom: '1px solid var(--border-light, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(217, 119, 6, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary-accent, #059669)'
            }}
          >
            <Bell size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: isFullPage ? '20px' : '17px', fontWeight: 800 }}>
                {isRentalPortal ? 'Rental Notification Center' : 'Notification Center'}
              </h2>
              {unreadNotificationCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--color-danger, #ef4444)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}
                >
                  {unreadNotificationCount} unread
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
              {isRentalPortal
                ? 'Real-time rent dues, overdue alerts, security deposits, and settlements'
                : 'Real-time due events, interest schedules, renewals, and collections'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {unreadNotificationCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', fontWeight: 700, gap: '6px' }}
              onClick={markAllNotificationsAsRead}
            >
              <CheckCircle2 size={14} />
              <span>Mark All as Read</span>
            </button>
          )}
          {!isFullPage && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '6px',
                borderRadius: '6px'
              }}
              title="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* ── SUMMARY STATS BAR ────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
          borderBottom: '1px solid var(--border-light, #e2e8f0)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
          gap: '10px'
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid var(--border-light)',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            TOTAL
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
            {counts.total}
          </div>
        </div>

        {isRentalPortal ? (
          <>
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                RENTAL
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#6366f1' }}>{counts.total}</div>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                LOANS
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0284c7' }}>{counts.loans}</div>
            </div>
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                FIXED DEPOSITS
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}>
                {counts.fixedDeposits}
              </div>
            </div>
          </>
        )}

        <div
          style={{
            padding: '8px 12px',
            backgroundColor: counts.overdue > 0 ? '#fef2f2' : '#ffffff',
            borderRadius: '8px',
            border: counts.overdue > 0 ? '1px solid #fecaca' : '1px solid var(--border-light)',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: counts.overdue > 0 ? '#dc2626' : 'var(--text-muted)',
              letterSpacing: '0.05em'
            }}
          >
            OVERDUE
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 800,
              color: counts.overdue > 0 ? '#dc2626' : 'var(--text-muted)'
            }}
          >
            {counts.overdue}
          </div>
        </div>
      </div>

      {/* ── CATEGORY TABS & SEARCH ───────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-light, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Main Category Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(isRentalPortal
            ? [
                { id: 'ALL', label: 'All', count: counts.total },
                { id: 'OVERDUE', label: 'Overdue Rent', count: counts.overdue },
                { id: 'DEPOSIT', label: 'Security Deposits', count: counts.rental },
                { id: 'UNREAD', label: 'Unread', count: counts.unread }
              ]
            : [
                { id: 'ALL', label: 'All', count: counts.total },
                { id: 'LOAN', label: 'Loans', count: counts.loans },
                { id: 'FIXED_DEPOSIT', label: 'Fixed Deposits', count: counts.fixedDeposits },
                { id: 'UNREAD', label: 'Unread', count: counts.unread }
              ]
          ).map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  border: '1.5px solid',
                  borderColor: isActive ? 'var(--color-primary-accent, #059669)' : 'var(--border-light, #e2e8f0)',
                  backgroundColor: isActive ? 'var(--color-primary-accent, #059669)' : '#ffffff',
                  color: isActive ? '#ffffff' : 'var(--text-dark, #334155)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-surface-secondary, #e2e8f0)',
                    color: isActive ? '#ffffff' : 'var(--text-secondary, #64748b)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 800
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Subfilters */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <input
              type="text"
              className="input-control"
              style={{ height: '34px', paddingLeft: '32px', fontSize: '12.5px' }}
              placeholder={
                isRentalPortal
                  ? 'Search rental notifications by shop, tenant, complex...'
                  : 'Search notifications by name, loan, FD, customer ID...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {(['ALL', 'OVERDUE', 'DUE', 'UPCOMING', 'PAID'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: statusFilter === st ? 'var(--color-primary-dark)' : 'var(--border-light)',
                  backgroundColor: statusFilter === st ? 'var(--color-primary-dark)' : 'transparent',
                  color: statusFilter === st ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {st === 'ALL' ? 'All Status' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── NOTIFICATION LIST ────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isFullPage ? '20px 28px' : '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {filteredNotifications.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
              borderRadius: '12px',
              border: '1px dashed var(--border-light, #e2e8f0)',
              color: 'var(--text-muted)'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <CheckCircle2 size={24} color="var(--color-primary-accent, #059669)" />
            </div>
            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-dark, #1e293b)' }}>
              {isRentalPortal ? 'No Rental Notifications' : 'No notifications to display'}
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              {isRentalPortal
                ? "You're all caught up. No rental alerts or pending items."
                : activeCategory === 'UNREAD'
                ? 'All alerts have been read and reviewed.'
                : 'No alerts match your current filter criteria.'}
            </div>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const isUnread = !n.read && n.type !== 'PAID' && n.type !== 'RENT_PAYMENT';
            return (
              <div
                key={n.id}
                onClick={() => !n.read && markNotificationAsRead(n.id)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: isUnread
                    ? '1.5px solid var(--color-primary-accent, #059669)'
                    : '1px solid var(--border-light, #e2e8f0)',
                  backgroundColor: isUnread
                    ? 'rgba(5, 150, 105, 0.04)'
                    : '#ffffff',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                {/* Top row: Category Badge, Type Badge, Priority Dot, Read Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        backgroundColor:
                          n.category === 'RENTAL' || n.module === 'RENTAL'
                            ? 'rgba(99, 102, 241, 0.12)'
                            : n.category === 'LOAN'
                            ? 'rgba(2, 132, 199, 0.12)'
                            : 'rgba(5, 150, 105, 0.12)',
                        color:
                          n.category === 'RENTAL' || n.module === 'RENTAL'
                            ? '#6366f1'
                            : n.category === 'LOAN'
                            ? '#0284c7'
                            : 'var(--color-primary-accent, #059669)',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {n.category === 'RENTAL' || n.module === 'RENTAL' ? 'RENTAL' : n.category === 'LOAN' ? 'LOAN' : 'FIXED DEPOSIT'}
                    </span>
                    {getTypeBadge(n)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: getPriorityColor(n.priority)
                      }}
                    >
                      ● {n.priority}
                    </span>
                    {isUnread && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-primary-accent, #059669)'
                        }}
                        title="Unread"
                      />
                    )}
                  </div>
                </div>

                {/* Main Content */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-dark)' }}>
                      {n.title}
                    </div>
                    {n.amount !== undefined && n.amount > 0 && (
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-primary-dark)' }}>
                        ₹{n.amount.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #475569)', marginTop: '2px', lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                </div>

                {/* Bottom Row: Customer / Tenant & Entity Info + Action Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {n.category === 'RENTAL' || n.module === 'RENTAL' ? (
                      <>
                        <span>
                          Shop: <strong style={{ color: 'var(--text-dark)' }}>{n.entityId}</strong>
                        </span>
                        {n.customerName && (
                          <span>
                            Tenant: <strong style={{ color: 'var(--text-dark)' }}>{n.customerName}</strong>
                          </span>
                        )}
                        {n.complexName && (
                          <span>
                            Complex: <strong>{n.complexName}</strong>
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span>
                          Customer: <strong style={{ color: 'var(--text-dark)' }}>{n.customerName}</strong> ({n.customerId})
                        </span>
                        <span>
                          Ref: <strong style={{ color: 'var(--color-primary-dark)' }}>{n.entityId}</strong>
                        </span>
                      </>
                    )}
                    {n.dueDate && (
                      <span>
                        Due: <strong>{n.dueDate}</strong>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '11.5px', fontWeight: 800, padding: '4px 12px', height: '28px', gap: '4px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(n);
                      }}
                    >
                      <span>{n.actionLabel || 'View Details'}</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (isFullPage) {
    return (
      <div className="page-content" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: '600px' }}>
          {content}
        </div>
      </div>
    );
  }

  // Floating Modal / Flyout Dropdown Mode
  return (
    <div
      className="notification-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 2000,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-start'
      }}
      onClick={onClose}
    >
      <div
        className="notification-flyout-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '100vh',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
};
