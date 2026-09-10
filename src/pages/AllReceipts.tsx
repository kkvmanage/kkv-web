import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Receipt } from '../types';
import { FileSpreadsheet, FileText, Eye, Copy, Search, Receipt as ReceiptIcon, TrendingUp, DollarSign } from 'lucide-react';
import { PageHeader, StatGrid, StatCard, FilterBar, DataTable, StatusBadge, Button, ColumnDef } from '../components/ui';

export const AllReceipts: React.FC = () => {
  const { receipts, setSelectedReceipt, setCurrentPage, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('ALL');

  const filteredReceipts = receipts.filter((r) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      r.receiptNo.toString().includes(term) ||
      r.loanNo.toLowerCase().includes(term) ||
      r.customerName.toLowerCase().includes(term) ||
      r.kind.toLowerCase().includes(term);

    const matchesKind = kindFilter === 'ALL' || r.kind === kindFilter;
    return matchesSearch && matchesKind;
  });

  const totalCollected = receipts
    .filter(r => r.kind !== 'NEW LOAN')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const totalDisbursed = receipts
    .filter(r => r.kind === 'NEW LOAN')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const handleViewReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setCurrentPage('receipt-display');
  };

  const handleExportExcel = () => {
    showToast('Exporting receipts to Excel spreadsheet (.XLSX)...', 'info');
  };

  const handleExportPDF = () => {
    showToast('Compiling receipts report PDF document...', 'info');
  };

  const handleCopy = (receipt: Receipt) => {
    navigator.clipboard.writeText(`Receipt #${receipt.receiptNo} | Loan: ${receipt.loanNo} | Customer: ${receipt.customerName} | Amount: ₹${receipt.amount}`);
    showToast(`Copied details for Receipt #${receipt.receiptNo}`, 'success');
  };

  const columns: ColumnDef<Receipt>[] = [
    {
      key: 'receiptNo',
      label: 'RECEIPT #',
      render: (r) => (
        <strong style={{ color: 'var(--primary, #176B52)' }}>
          #{r.receiptNo}
        </strong>
      )
    },
    {
      key: 'kind',
      label: 'TRANSACTION KIND',
      render: (r) => (
        <StatusBadge
          status={r.kind === 'NEW LOAN' ? 'ACTIVE' : r.kind === 'LOAN CLOSURE' ? 'CLOSED' : 'PAID'}
          label={r.kind}
        />
      )
    },
    {
      key: 'loanType',
      label: 'LOAN TYPE',
      render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.loanType || 'Gold Loan'}</span>
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
      label: 'VOUCHER AMOUNT',
      align: 'right',
      render: (r) => (
        <strong style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
          ₹{(r.amount || 0).toLocaleString('en-IN')}
        </strong>
      )
    },
    {
      key: 'date',
      label: 'PAYMENT DATE',
      render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.date}</span>
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      align: 'right',
      render: (r) => (
        <div style={{ display: 'inline-flex', gap: '6px' }}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            style={{ padding: '0 6px', height: '28px', color: 'var(--primary, #176B52)' }}
            title="View Receipt Document"
            onClick={(e) => {
              e.stopPropagation();
              handleViewReceipt(r);
            }}
          >
            <Eye size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            style={{ padding: '0 6px', height: '28px', color: 'var(--text-secondary)' }}
            title="Copy Receipt Summary"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(r);
            }}
          >
            <Copy size={13} />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="page-content">
      <PageHeader
        title="All Payment Receipts"
        subtitle="Official chronological register of all loan disbursements, repayments, interest collections, and closures"
        icon={<ReceiptIcon size={17} />}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileSpreadsheet size={14} />}
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileText size={14} />}
              onClick={handleExportPDF}
            >
              Export PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<ReceiptIcon size={14} />}
              onClick={() => setCurrentPage('loan-receipts')}
            >
              + Issue Receipt
            </Button>
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <StatGrid columns={3}>
        <StatCard
          label="Total Receipts Recorded"
          value={receipts.length}
          subValue="All transaction vouchers"
          colorTheme="primary"
          icon={<ReceiptIcon size={18} />}
        />
        <StatCard
          label="Repayments & Interest Collected"
          value={`₹${totalCollected.toLocaleString('en-IN')}`}
          subValue="Credits to branch accounts"
          colorTheme="success"
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Principal Disbursed"
          value={`₹${totalDisbursed.toLocaleString('en-IN')}`}
          subValue="Disbursements via new loans"
          colorTheme="info"
          icon={<DollarSign size={18} />}
        />
      </StatGrid>

      {/* Filter Toolbar */}
      <FilterBar onReset={searchTerm || kindFilter !== 'ALL' ? () => { setSearchTerm(''); setKindFilter('ALL'); } : undefined}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
          <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-control"
            style={{ paddingLeft: '34px', height: '36px', fontSize: '12.5px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search receipt #, loan account, borrower name, kind..."
          />
        </div>

        <select
          className="select-control"
          style={{ width: '180px', height: '36px', fontSize: '12px' }}
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
        >
          <option value="ALL">All Transaction Kinds</option>
          <option value="NEW LOAN">New Loan Disbursement</option>
          <option value="INTEREST PAYMENT">Interest Payment</option>
          <option value="REPAYMENT">Part Principal Repayment</option>
          <option value="LOAN CLOSURE">Loan Closure</option>
        </select>
      </FilterBar>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredReceipts}
        keyExtractor={(r, idx) => `all-rcpt-${r.id || idx}`}
        onRowClick={handleViewReceipt}
        emptyTitle="No receipts found"
        emptyDescription="No payment vouchers match your search or filter criteria."
      />
    </div>
  );
};
