import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Loan } from '../types';
import { Grid, FileSpreadsheet, Printer, CheckCircle2, Clock, Coins, Eye, Search, DollarSign } from 'lucide-react';
import { PageHeader, StatGrid, StatCard, FilterBar, DataTable, StatusBadge, Button, ColumnDef } from '../components/ui';

export const TotalLoans: React.FC = () => {
  const { loans, setSelectedLoan, setCurrentPage, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED' | 'PENDING'>('ALL');

  const totalLoansCount = loans.length;
  const activeLoansCount = loans.filter((l) => l.status === 'ACTIVE').length;
  const closedLoansCount = loans.filter((l) => l.status === 'CLOSED').length;
  const totalPrincipal = loans.reduce((a, b) => a + (b.principal || 0), 0);
  const outstandingAmount = loans.reduce((a, b) => a + (b.status === 'CLOSED' ? 0 : (b.outstandingPrincipal ?? b.principal ?? 0)), 0);

  const filteredLoans = loans.filter((l) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      l.loanNo.toLowerCase().includes(term) ||
      l.customerName.toLowerCase().includes(term) ||
      l.customerPhone.includes(term) ||
      (l.customerId && l.customerId.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    setCurrentPage('loan-display');
  };

  const columns: ColumnDef<Loan>[] = [
    {
      key: 'loanNo',
      label: 'LOAN NO & TYPE',
      render: (l) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong style={{ color: 'var(--primary, #176B52)', fontWeight: 800 }}>{l.loanNo}</strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.loanType || 'Gold Loan'}</span>
        </div>
      )
    },
    {
      key: 'customerName',
      label: 'BORROWER & PHONE',
      render: (l) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{l.customerName}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+91 {l.customerPhone}</span>
        </div>
      )
    },
    {
      key: 'principal',
      label: 'PRINCIPAL',
      align: 'right',
      render: (l) => <span>₹{(l.principal || 0).toLocaleString('en-IN')}</span>
    },
    {
      key: 'interestRate',
      label: 'RATE/MO',
      align: 'center',
      render: (l) => <span style={{ fontWeight: 600 }}>{l.interestRate}%</span>
    },
    {
      key: 'outstandingPrincipal',
      label: 'OUTSTANDING',
      align: 'right',
      render: (l) => (
        <strong style={{ color: l.status === 'CLOSED' ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 800 }}>
          ₹{(l.status === 'CLOSED' ? 0 : (l.outstandingPrincipal ?? l.principal ?? 0)).toLocaleString('en-IN')}
        </strong>
      )
    },
    {
      key: 'date',
      label: 'ISSUE DATE',
      render: (l) => <span style={{ color: 'var(--text-muted)' }}>{l.date}</span>
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (l) => (
        <StatusBadge
          status={l.status === 'ACTIVE' ? 'ACTIVE' : l.status === 'CLOSED' ? 'CLOSED' : 'PENDING'}
          dot
        />
      )
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      align: 'right',
      render: (l) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          style={{ padding: '0 6px', height: '28px', color: 'var(--primary, #176B52)' }}
          title="View Loan Details"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenLoan(l);
          }}
        >
          <Eye size={14} />
        </Button>
      )
    }
  ];

  return (
    <div className="page-content">
      <PageHeader
        title="Total Loans Portfolio Registry"
        subtitle="Comprehensive ledger of all historical and active gold loan pledge contracts"
        icon={<Grid size={17} />}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileSpreadsheet size={14} />}
              onClick={() => showToast('Exporting master portfolio to CSV...', 'info')}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer size={14} />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </div>
        }
      />

      {/* Summary Metrics */}
      <StatGrid columns={5}>
        <StatCard
          label="Total Loans"
          value={totalLoansCount}
          subValue="All-time contracts"
          colorTheme="primary"
          icon={<Grid size={18} />}
        />
        <StatCard
          label="Active Loans"
          value={activeLoansCount}
          subValue="Currently open"
          colorTheme="success"
          icon={<CheckCircle2 size={18} />}
        />
        <StatCard
          label="Closed Loans"
          value={closedLoansCount}
          subValue="Redeemed & settled"
          colorTheme="neutral"
          icon={<Clock size={18} />}
        />
        <StatCard
          label="Total Disbursed"
          value={`₹${totalPrincipal.toLocaleString('en-IN')}`}
          subValue="Cumulative volume"
          colorTheme="info"
          icon={<Coins size={18} />}
        />
        <StatCard
          label="Outstanding Balance"
          value={`₹${outstandingAmount.toLocaleString('en-IN')}`}
          subValue="Active principal"
          colorTheme="warning"
          icon={<DollarSign size={18} />}
        />
      </StatGrid>

      {/* Filter Toolbar */}
      <FilterBar onReset={searchTerm || statusFilter !== 'ALL' ? () => { setSearchTerm(''); setStatusFilter('ALL'); } : undefined}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
          <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-control"
            style={{ paddingLeft: '34px', height: '36px', fontSize: '12.5px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search loan #, borrower name, phone, ID..."
          />
        </div>

        <select
          className="select-control"
          style={{ width: '160px', height: '36px', fontSize: '12px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="CLOSED">Closed Only</option>
          <option value="PENDING">Pending Only</option>
        </select>
      </FilterBar>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredLoans}
        keyExtractor={(l, idx) => `tot-loan-${l.id || idx}`}
        onRowClick={handleOpenLoan}
        emptyTitle="No loans found"
        emptyDescription="No loans match your search or filter parameters."
      />
    </div>
  );
};
