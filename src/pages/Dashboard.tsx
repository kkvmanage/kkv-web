import React, { useState } from 'react';
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
  ArrowUpRight
} from 'lucide-react';
import { PageHeader, StatGrid, StatCard, Card, DataTable, StatusBadge, Button, ColumnDef } from '../components/ui';
import { Receipt } from '../types';

export const Dashboard: React.FC = () => {
  const { loans, receipts, setCurrentPage, customers } = useApp();
  const [hideValues, setHideValues] = useState<boolean>(false);

  const totalDisbursed = loans.reduce((acc, l) => acc + l.principal, 0);
  const totalCollected = receipts
    .filter(r => r.kind === 'REPAYMENT' || r.kind === 'INTEREST PAYMENT' || r.kind === 'LOAN CLOSURE')
    .reduce((acc, r) => acc + r.amount, 0);
  const totalOutstanding = loans.reduce((acc, l) => acc + l.outstandingPrincipal, 0);

  const formatAmount = (val: number) => {
    return hideValues ? '₹XXXXXX' : `₹${val.toLocaleString('en-IN')}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const activeCount = loans.filter(l => l.status === 'ACTIVE').length;
  const overdueCount = loans.filter(
    l => l.status === 'OVERDUE' || (l.nextDueDate && new Date(l.nextDueDate.split('-').reverse().join('-')) < new Date())
  ).length;
  const closedCount = loans.filter(l => l.status === 'CLOSED').length;
  const totalLoanCount = loans.length;

  const recentReceiptsColumns: ColumnDef<Receipt>[] = [
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
        title={`${getGreeting()}, Branch Manager`}
        subtitle="Real-time vault gold weight, active pledges, repayment collections, and branch cash summary"
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

      {/* 4 Financial Stat Cards */}
      <StatGrid columns={4}>
        <StatCard
          label="Total Disbursed"
          value={formatAmount(totalDisbursed)}
          subValue={`${totalLoanCount} Total Issued Loans`}
          colorTheme="primary"
          icon={<Coins size={18} />}
        />
        <StatCard
          label="Collected Receipts"
          value={formatAmount(totalCollected)}
          subValue="Interest & Principal Repayments"
          colorTheme="success"
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Outstanding Portfolio"
          value={formatAmount(totalOutstanding)}
          subValue={`${activeCount} Active Loan Accounts`}
          colorTheme="warning"
          icon={<CreditCard size={18} />}
        />
        <StatCard
          label="Active Borrowers"
          value={customers.length}
          subValue="Registered Customer Master"
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
          subtitle="Monthly financial overview of principal disbursements and interest collections"
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
                d="M 20 100 L 100 70 L 180 85 L 260 40 L 340 60 L 420 25"
                fill="none"
                stroke="var(--primary, #176B52)"
                strokeWidth="2.5"
              />
              {/* Collected Line */}
              <path
                d="M 20 105 L 100 90 L 180 75 L 260 60 L 340 50 L 420 30"
                fill="none"
                stroke="#16A34A"
                strokeWidth="2.5"
              />

              {/* Data Dots */}
              {[
                { x: 20, y1: 100, y2: 105 },
                { x: 100, y1: 70, y2: 90 },
                { x: 180, y1: 85, y2: 75 },
                { x: 260, y1: 40, y2: 60 },
                { x: 340, y1: 60, y2: 50 },
                { x: 420, y1: 25, y2: 30 }
              ].map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y1} r="3.5" fill="var(--primary, #176B52)" />
                  <circle cx={pt.x} cy={pt.y2} r="3.5" fill="#16A34A" />
                </g>
              ))}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
            <span>Aug</span>
          </div>
        </Card>

        {/* Loan Portfolio Status Card */}
        <Card
          title="Loan Portfolio Distribution"
          subtitle={`${totalLoanCount} Total loan contracts categorized by repayment status`}
          headerBorder
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '10px 0' }}>
            <div style={{ position: 'relative', width: '110px', height: '110px' }}>
              <svg width="110" height="110" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--surface-secondary, #F4F7F5)"
                  strokeWidth="3.8"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--primary, #176B52)"
                  strokeWidth="3.8"
                  strokeDasharray="70, 100"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="3.8"
                  strokeDasharray="20, 100"
                  strokeDashoffset="-70"
                />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{totalLoanCount}</span>
                <p style={{ fontSize: '8.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>CONTRACTS</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary, #176B52)' }}></span>
                  Active
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>{activeCount}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706' }}></span>
                  Overdue
                </span>
                <strong style={{ color: '#D97706' }}>{overdueCount}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
                  Closed
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>{closedCount}</strong>
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
            data={receipts.slice(0, 5)}
            keyExtractor={(r, i) => `rcpt-${r.id || i}`}
            emptyTitle="No recent transaction receipts"
            emptyDescription="Disbursements and repayment vouchers will be recorded here."
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
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: overdueCount > 0 ? '#D97706' : 'inherit' }}>
                {overdueCount} Alerts
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
