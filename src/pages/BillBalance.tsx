import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlertCircle, DollarSign, Plus, X, Search, FileText, Check } from 'lucide-react';
import { PageHeader, StatGrid, StatCard, FilterBar, DataTable, StatusBadge, Button, FormField, ColumnDef } from '../components/ui';

interface BillBalanceEntry {
  id: string;
  billNo: string;
  loanNo: string;
  customerName: string;
  phone: string;
  date: string;
  balanceAmount: number;
  reason: string;
  status: 'OPEN' | 'CLEARED';
}

export const BillBalance: React.FC = () => {
  const { showToast } = useApp();
  const [entries, setEntries] = useState<BillBalanceEntry[]>(() => {
    try {
      const saved = localStorage.getItem('kkv_bill_balances');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('kkv_bill_balances', JSON.stringify(entries));
    } catch (e) {
      console.error(e);
    }
  }, [entries]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLoanNo, setNewLoanNo] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newReason, setNewReason] = useState('');

  const openEntries = entries.filter((e) => e.status === 'OPEN');
  const totalOwed = openEntries.reduce((sum, e) => sum + e.balanceAmount, 0);

  const filteredEntries = entries.filter((e) => {
    const term = searchTerm.toLowerCase().trim();
    return (
      !term ||
      e.billNo.toLowerCase().includes(term) ||
      e.loanNo.toLowerCase().includes(term) ||
      e.customerName.toLowerCase().includes(term) ||
      e.phone.includes(term) ||
      e.reason.toLowerCase().includes(term)
    );
  });

  const handleClearBalance = (id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'CLEARED' } : e))
    );
    showToast('Bill balance settled and cleared!', 'success');
  };

  const handleAddBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.trim() || !newLoanNo.trim() || !newAmount || Number(newAmount) <= 0) {
      showToast('Please enter customer, loan number, and valid balance amount.', 'error');
      return;
    }

    const newEntry: BillBalanceEntry = {
      id: `bb-${Date.now()}`,
      billNo: `BILL-${Math.floor(100 + Math.random() * 900)}`,
      loanNo: newLoanNo.trim(),
      customerName: newCustomer.trim(),
      phone: '+91 98400 00000',
      date: new Date().toLocaleDateString('en-GB'),
      balanceAmount: Number(newAmount),
      reason: newReason.trim() || 'Short payment adjustment',
      status: 'OPEN'
    };
    setEntries((prev) => [newEntry, ...prev]);
    setShowAddModal(false);
    setNewCustomer('');
    setNewLoanNo('');
    setNewAmount('');
    setNewReason('');
    showToast('Bill balance entry tracked successfully!', 'success');
  };

  const columns: ColumnDef<BillBalanceEntry>[] = [
    {
      key: 'billNo',
      label: 'BILL / TRACKING #',
      render: (e) => (
        <strong style={{ color: 'var(--primary, #176B52)' }}>{e.billNo}</strong>
      )
    },
    {
      key: 'loanNo',
      label: 'LOAN ACCOUNT',
      render: (e) => <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{e.loanNo}</span>
    },
    {
      key: 'customerName',
      label: 'BORROWER',
      render: (e) => <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{e.customerName}</span>
    },
    {
      key: 'balanceAmount',
      label: 'BALANCE DUE',
      align: 'right',
      render: (e) => (
        <strong style={{ color: e.status === 'OPEN' ? '#D97706' : 'var(--text-muted)', fontWeight: 800 }}>
          ₹{e.balanceAmount.toLocaleString('en-IN')}
        </strong>
      )
    },
    {
      key: 'reason',
      label: 'ADJUSTMENT REASON',
      render: (e) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{e.reason}</span>
    },
    {
      key: 'date',
      label: 'RECORDED DATE',
      render: (e) => <span style={{ color: 'var(--text-muted)' }}>{e.date}</span>
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (e) => (
        <StatusBadge
          status={e.status === 'OPEN' ? 'PENDING' : 'PAID'}
          label={e.status === 'OPEN' ? 'Open Balance' : 'Cleared'}
          dot
        />
      )
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      align: 'right',
      render: (e) => (
        e.status === 'OPEN' ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Check size={12} />}
            onClick={() => handleClearBalance(e.id)}
            style={{ fontSize: '11px', height: '28px', color: '#16A34A', borderColor: 'rgba(22, 163, 74, 0.3)' }}
          >
            Mark Cleared
          </Button>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Settled</span>
        )
      )
    }
  ];

  return (
    <div className="page-content">
      <PageHeader
        title="Bill Balance Tracker"
        subtitle="Manage customer side-balances, short payments, and fee adjustments across loan settlements"
        icon={<FileText size={17} />}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowAddModal(true)}
          >
            + Track Bill Balance
          </Button>
        }
      />

      {/* Summary Stat Cards */}
      <StatGrid columns={2}>
        <StatCard
          label="Open Balances Count"
          value={openEntries.length}
          subValue="Pending customer side-balances"
          colorTheme={openEntries.length > 0 ? 'warning' : 'neutral'}
          icon={<AlertCircle size={18} />}
        />
        <StatCard
          label="Total Unsettled Amount"
          value={`₹${totalOwed.toLocaleString('en-IN')}`}
          subValue="Accumulated short payments"
          colorTheme="primary"
          icon={<DollarSign size={18} />}
        />
      </StatGrid>

      {/* Filter Toolbar */}
      <FilterBar onReset={searchTerm ? () => setSearchTerm('') : undefined}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
          <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-control"
            style={{ paddingLeft: '34px', height: '36px', fontSize: '12.5px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search bill #, loan account, borrower name..."
          />
        </div>
      </FilterBar>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredEntries}
        keyExtractor={(e) => e.id}
        emptyTitle="No bill balances recorded"
        emptyDescription="All customer adjustments and balances are settled."
        emptyAction={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => setShowAddModal(true)}
            style={{ marginTop: '8px' }}
          >
            Track First Balance
          </Button>
        }
      />

      {/* Add Bill Balance Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 35, 28, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              backgroundColor: 'var(--surface, #FFFFFF)',
              borderRadius: 'var(--radius-lg, 14px)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>

            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
              Track New Bill Balance
            </h3>

            <form onSubmit={handleAddBalance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FormField label="Borrower Name" required>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Loan Account No" required>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. GL-2026-0042"
                  value={newLoanNo}
                  onChange={(e) => setNewLoanNo(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Balance Amount (₹)" required>
                <input
                  type="number"
                  className="input-control"
                  placeholder="e.g. 500"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  min={1}
                />
              </FormField>

              <FormField label="Reason / Notes">
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Short cash payment at redemption"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                />
              </FormField>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Balance Entry
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
