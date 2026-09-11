import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Coins,
  TrendingUp,
  CreditCard,
  Users,
  Eye,
  EyeOff,
  Plus,
  FileText,
  AlertCircle,
  LayoutDashboard,
  Receipt as ReceiptIcon,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { PageHeader, StatGrid, StatCard, Card, DataTable, StatusBadge, Button, ColumnDef } from '../components/ui';
import { DashboardSummaryData } from '../types';
import { apiService } from '../services/api';


export const Dashboard: React.FC = () => {
  const { setCurrentPage, currentUser, userRole, loans, receipts, customers } = useApp();
  const [hideValues, setHideValues] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiService.getDashboardSummary();
      if (res && res.data) {
        setSummaryData(res.data);
      } else {
        throw new Error('Invalid dashboard response format');
      }
    } catch (err: any) {
      console.warn('[Dashboard] Failed to fetch backend summary, calculating fallback from local cache:', err);
      // If network fails, only calculate from local synchronized records, never fake mock data
      const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE');
      const totalDisbursed = loans.reduce((acc, l) => acc + (l.principal || 0), 0);
      const totalCollected = receipts
        .filter((r) => r.kind !== 'NEW LOAN')
        .reduce((acc, r) => acc + (r.amount || 0), 0);
      const totalOutstanding = activeLoans.reduce((acc, l) => acc + (l.outstandingPrincipal || 0), 0);
      const activeBorrowerIds = new Set(activeLoans.map((l) => l.customerId).filter(Boolean));

      const fallbackSummary: DashboardSummaryData = {
        totalDisbursed,
        totalCollected,
        totalOutstanding,
        activeBorrowers: activeBorrowerIds.size,
        totalCustomers: customers.length,
        activeLoansCount: loans.filter((l) => l.status === 'ACTIVE').length,
        overdueLoansCount: loans.filter((l) => l.status === 'OVERDUE').length,
        closedLoansCount: loans.filter((l) => l.status === 'CLOSED').length,
        totalLoansCount: loans.length,
        activeFDsCount: 0,
        cashInHand: 0,
        cashAtBank: 0,
        monthlyTrends: [],
        statusDistribution: {
          active: loans.filter((l) => l.status === 'ACTIVE').length,
          overdue: loans.filter((l) => l.status === 'OVERDUE').length,
          closed: loans.filter((l) => l.status === 'CLOSED').length,
          total: loans.length,
          activePercent: loans.length > 0 ? Math.round((loans.filter((l) => l.status === 'ACTIVE').length / loans.length) * 100) : 0,
          overduePercent: loans.length > 0 ? Math.round((loans.filter((l) => l.status === 'OVERDUE').length / loans.length) * 100) : 0,
          closedPercent: loans.length > 0 ? Math.round((loans.filter((l) => l.status === 'CLOSED').length / loans.length) * 100) : 0
        },
        recentTransactions: receipts.slice(0, 5).map((r) => ({
          id: r.id || `RCPT-${r.receiptNo}`,
          receiptNo: r.receiptNo,
          kind: r.kind,
          customerName: r.customerName || 'Customer',
          loanNo: r.loanNo || '—',
          amount: r.amount,
          date: r.date,
          paymentMode: r.paymentMode
        }))
      };

      setSummaryData(fallbackSummary);
      if (loans.length === 0 && receipts.length === 0) {
        setError('Unable to reach server. Please ensure backend is running.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loans, receipts, customers]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatAmount = (val: number) => {
    if (hideValues) return '₹XXXXXX';
    const isInteger = Number.isInteger(val);
    return `₹${val.toLocaleString('en-IN', {
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getUserTitle = () => {
    if (userRole === 'ADMIN') return 'Administrator';
    if (userRole === 'RENTAL_STAFF') return 'Rental Manager';
    return 'Branch Staff';
  };

  // ── Compute Real Trend Path Coordinates ─────────────────────────────────────
  const monthlyTrends = summaryData?.monthlyTrends || [];
  const maxTrendVal = Math.max(
    ...monthlyTrends.map((t) => Math.max(t.disbursed, t.collected)),
    1 // Prevent div by zero
  );

  const hasTrendData = monthlyTrends.some((t) => t.disbursed > 0 || t.collected > 0);

  // Map 6 trend points to SVG coordinates (width 500, height 130)
  const trendXPoints = [40, 120, 200, 280, 360, 440];
  const trendPoints = monthlyTrends.map((t, idx) => {
    const x = trendXPoints[idx] || 40 + idx * 80;
    // Y: 110 (baseline) to 20 (peak)
    const yDisbursed = hasTrendData ? 110 - Math.round((t.disbursed / maxTrendVal) * 85) : 110;
    const yCollected = hasTrendData ? 110 - Math.round((t.collected / maxTrendVal) * 85) : 110;
    return { x, yDisbursed, yCollected, ...t };
  });

  const disbursedPathD = trendPoints.length > 0
    ? `M ${trendPoints.map((p) => `${p.x} ${p.yDisbursed}`).join(' L ')}`
    : 'M 40 110 L 440 110';

  const collectedPathD = trendPoints.length > 0
    ? `M ${trendPoints.map((p) => `${p.x} ${p.yCollected}`).join(' L ')}`
    : 'M 40 110 L 440 110';

  // ── Loan Portfolio Distribution ─────────────────────────────────────────────
  const dist = summaryData?.statusDistribution || {
    active: 0,
    overdue: 0,
    closed: 0,
    total: 0,
    activePercent: 0,
    overduePercent: 0,
    closedPercent: 0
  };

  const totalContracts = dist.total;
  const activePct = dist.activePercent;
  const overduePct = dist.overduePercent;
  const closedPct = dist.closedPercent;

  const recentTransactions = summaryData?.recentTransactions || [];

  const recentReceiptsColumns: ColumnDef<any>[] = [
    {
      key: 'receiptNo',
      label: 'VOUCHER #',
      render: (r) => (
        <span style={{ fontWeight: 700, color: 'var(--primary, #176B52)' }}>
          #{r.receiptNo}
        </span>
      )
    },
    {
      key: 'kind',
      label: 'TRANSACTION TYPE',
      render: (r) => (
        <StatusBadge
          status={r.kind === 'NEW LOAN' ? 'ACTIVE' : r.kind === 'LOAN CLOSURE' ? 'CLOSED' : 'PAID'}
          label={r.kind}
        />
      )
    },
    {
      key: 'customerName',
      label: 'BORROWER',
      render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.customerName}</span>
    },
    {
      key: 'loanNo',
      label: 'LOAN ACCOUNT',
      render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{r.loanNo}</span>
    },
    {
      key: 'amount',
      label: 'AMOUNT',
      align: 'right',
      render: (r) => (
        <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
          {formatAmount(r.amount)}
        </strong>
      )
    },
    {
      key: 'date',
      label: 'DATE',
      render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.date}</span>
    }
  ];

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <PageHeader
        title={`${getGreeting()}, ${currentUser?.displayName || currentUser?.fullName || getUserTitle()}`}
        subtitle="Real-time loan portfolio, pledge records, repayment collections, and cash balances"
        icon={<LayoutDashboard size={18} />}

        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={hideValues ? <Eye size={14} /> : <EyeOff size={14} />}
              onClick={() => setHideValues(!hideValues)}
            >
              {hideValues ? 'Show Amounts' : 'Hide Amounts'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
            >
              {refreshing ? 'Syncing...' : 'Refresh'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setCurrentPage('loan-issue')}
            >
              + Issue Loan
            </Button>
          </div>
        }
      />

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626', fontSize: '13px', fontWeight: 600 }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => fetchDashboardData(true)}>
            Retry Connection
          </Button>
        </div>
      )}

      {/* 4 Financial Stat Cards */}
      <StatGrid columns={4}>
        <StatCard
          label="Total Disbursed"
          value={loading ? '...' : formatAmount(summaryData?.totalDisbursed || 0)}
          subValue={`${summaryData?.totalLoansCount || 0} Total Issued Loans`}
          colorTheme="primary"
          icon={<Coins size={18} />}
        />
        <StatCard
          label="Collected Receipts"
          value={loading ? '...' : formatAmount(summaryData?.totalCollected || 0)}
          subValue="Interest & Principal Repayments"
          colorTheme="success"
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Outstanding Portfolio"
          value={loading ? '...' : formatAmount(summaryData?.totalOutstanding || 0)}
          subValue={`${summaryData?.activeLoansCount || 0} Active Loan Accounts`}
          colorTheme="warning"
          icon={<CreditCard size={18} />}
        />
        <StatCard
          label="Active Borrowers"
          value={loading ? '...' : String(summaryData?.activeBorrowers || 0)}
          subValue={`${summaryData?.totalCustomers || 0} Registered Customer Master`}
          colorTheme="info"
          icon={<Users size={18} />}
        />
      </StatGrid>

      {/* Middle Row: Disbursement Trends & Loan Status Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Disbursement vs Collection Card */}
        <Card
          title="Disbursement & Collections Trend"
          subtitle={
            hasTrendData
              ? 'Monthly financial overview of principal disbursements and interest collections'
              : 'No loan activity recorded in the selected historical period'
          }
          headerBorder
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginBottom: '12px', fontSize: '11.5px', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary, #176B52)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary, #176B52)' }}></span>
              Disbursed
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
              Collected
            </span>
          </div>

          <div style={{ width: '100%', height: '140px', position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 500 130" preserveAspectRatio="none">
              <line x1="0" y1="110" x2="500" y2="110" stroke="var(--border-subtle, #EDF2EE)" strokeDasharray="4 4" />
              <line x1="0" y1="65" x2="500" y2="65" stroke="var(--border-subtle, #EDF2EE)" strokeDasharray="4 4" />
              <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border-subtle, #EDF2EE)" strokeDasharray="4 4" />

              {/* Disbursed Line */}
              <path
                d={disbursedPathD}
                fill="none"
                stroke="var(--primary, #176B52)"
                strokeWidth="2.5"
              />
              {/* Collected Line */}
              <path
                d={collectedPathD}
                fill="none"
                stroke="#16A34A"
                strokeWidth="2.5"
              />

              {/* Data Dots */}
              {trendPoints.map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.yDisbursed} r="3.5" fill="var(--primary, #176B52)" />
                  <circle cx={pt.x} cy={pt.yCollected} r="3.5" fill="#16A34A" />
                </g>
              ))}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {monthlyTrends.length > 0 ? (
              monthlyTrends.map((t) => <span key={t.monthKey}>{t.monthShort}</span>)
            ) : (
              <>
                <span>M-5</span>
                <span>M-4</span>
                <span>M-3</span>
                <span>M-2</span>
                <span>M-1</span>
                <span>Current</span>
              </>
            )}
          </div>
        </Card>

        {/* Loan Portfolio Status Card */}
        <Card
          title="Loan Portfolio Distribution"
          subtitle={`${totalContracts} Total loan contracts categorized by repayment status`}
          headerBorder
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '10px 0' }}>
            <div style={{ position: 'relative', width: '110px', height: '110px' }}>
              <svg width="110" height="110" viewBox="0 0 36 36">
                {/* Background Ring */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--surface-secondary, #F4F7F5)"
                  strokeWidth="3.8"
                />
                {totalContracts > 0 && activePct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--primary, #176B52)"
                    strokeWidth="3.8"
                    strokeDasharray={`${activePct}, 100`}
                    strokeDashoffset="0"
                  />
                )}
                {totalContracts > 0 && overduePct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#D97706"
                    strokeWidth="3.8"
                    strokeDasharray={`${overduePct}, 100`}
                    strokeDashoffset={`-${activePct}`}
                  />
                )}
                {totalContracts > 0 && closedPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="3.8"
                    strokeDasharray={`${closedPct}, 100`}
                    strokeDashoffset={`-${activePct + overduePct}`}
                  />
                )}
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{totalContracts}</span>
                <p style={{ fontSize: '8.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>CONTRACTS</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary, #176B52)' }}></span>
                  Active
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {dist.active} {totalContracts > 0 && `(${activePct}%)`}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706' }}></span>
                  Overdue
                </span>
                <strong style={{ color: '#D97706' }}>
                  {dist.overdue} {totalContracts > 0 && `(${overduePct}%)`}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
                  Closed
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {dist.closed} {totalContracts > 0 && `(${closedPct}%)`}
                </strong>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Row: Recent Transaction Activity & Quick Action Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '16px'
        }}
      >
        {/* Recent Activity Table */}
        <Card
          title="Recent Financial Transactions"
          subtitle="Latest loan disbursements and payment receipts"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage('all-receipts')}
            >
              View All Receipts
            </Button>
          }
          headerBorder
          padding={0}
        >
          <DataTable
            columns={recentReceiptsColumns}
            data={recentTransactions}
            keyExtractor={(r, i) => `rcpt-${r.id || i}`}
            emptyTitle="No recent transaction receipts"
            emptyDescription="Disbursements and repayment vouchers will appear here automatically."
          />
        </Card>

        {/* Quick Operations Panel */}
        <Card
          title="Operational Quick Actions"
          subtitle="Common everyday workflows"
          headerBorder
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button
              variant="primary"
              onClick={() => setCurrentPage('loan-issue')}
              fullWidth
              style={{ justifyContent: 'space-between', height: '42px', padding: '0 14px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} />
                <span>Issue New Gold Loan</span>
              </span>
              <ArrowUpRight size={15} />
            </Button>

            <Button
              variant="secondary"
              onClick={() => setCurrentPage('loan-receipts')}
              fullWidth
              style={{ justifyContent: 'space-between', height: '42px', padding: '0 14px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} />
                <span>Record Loan Repayment</span>
              </span>
              <ArrowUpRight size={15} />
            </Button>

            <Button
              variant="secondary"
              onClick={() => setCurrentPage('pending-loans')}
              fullWidth
              style={{ justifyContent: 'space-between', height: '42px', padding: '0 14px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>Pending Loans Queue</span>
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: (summaryData?.overdueLoansCount || 0) > 0 ? '#D97706' : 'inherit' }}>
                {summaryData?.overdueLoansCount || 0} Alerts
              </span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => setCurrentPage('day-book')}
              fullWidth
              style={{ justifyContent: 'space-between', height: '42px', padding: '0 14px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ReceiptIcon size={16} />
                <span>Daily Ledger / Day Book</span>
              </span>
              <ArrowUpRight size={15} />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

