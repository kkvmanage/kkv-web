import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserPlus, Users, CheckCircle2, Clock, Edit3, Eye, Search, User } from 'lucide-react';
import { ViewCustomerModal } from '../components/common/ViewCustomerModal';
import { Customer } from '../types';
import { formatIdProofDisplay } from '../utils/kycValidation';
import { isMatchingCustomerId } from '../utils/customerUtils';
import { PageHeader, StatGrid, StatCard, FilterBar, DataTable, StatusBadge, Button, ColumnDef } from '../components/ui';

export const Customers: React.FC = () => {
  const { customers, loans, setCurrentPage, setSelectedProfileCustomerId, startEditCustomer } = useApp();
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING'>('ALL');

  // Filter active non-deleted customers
  const activeCustomers = customers.filter((c) => !c.isDeleted);

  // Lock background body scroll while modal is active
  useEffect(() => {
    if (viewingCustomer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewingCustomer]);

  const handleViewCustomer = (customer: Customer) => {
    setViewingCustomer(customer);
    if (setSelectedProfileCustomerId) {
      setSelectedProfileCustomerId(customer.id);
    }
  };

  const filteredCustomers = activeCustomers.filter((c) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.phone.includes(query) ||
      c.id.toLowerCase().includes(query) ||
      (c.idNumber && c.idNumber.toLowerCase().includes(query)) ||
      (c.occupation && c.occupation.toLowerCase().includes(query));
    const matchesFilter = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const verifiedCount = activeCustomers.filter(c => c.status === 'VERIFIED').length;
  const pendingCount = activeCustomers.filter(c => c.status !== 'VERIFIED').length;

  const handleClear = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
  };

  const columns: ColumnDef<Customer>[] = [
    {
      key: 'name',
      label: 'BORROWER & ID',
      render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {c.customerPhoto ? (
            <img
              src={c.customerPhoto}
              alt={c.name}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1.5px solid var(--primary, #176B52)',
                flexShrink: 0
              }}
            />
          ) : (
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-soft, rgba(23, 107, 82, 0.08))',
                color: 'var(--primary, #176B52)',
                fontWeight: 700,
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {c.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary, #1A2E26)' }}>{c.name}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #8A9E95)' }}>{c.id}</span>
          </div>
        </div>
      )
    },
    {
      key: 'phone',
      label: 'MOBILE NUMBER',
      render: (c) => <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>+91 {c.phone}</span>
    },
    {
      key: 'gender',
      label: 'GENDER',
      render: (c) => (
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {c.gender || '—'}
        </span>
      )
    },
    {
      key: 'occupation',
      label: 'OCCUPATION',
      render: (c) => <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{c.occupation || '—'}</span>
    },
    {
      key: 'idProof',
      label: 'ID PROOF',
      render: (c) => (
        <div style={{ fontSize: '11.5px' }}>
          <strong style={{ color: 'var(--primary, #176B52)' }}>{c.idProof}:</strong>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>{formatIdProofDisplay(c.idProof, c.idNumber)}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'KYC STATUS',
      render: (c) => (
        <StatusBadge
          status={c.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING'}
          label={c.status === 'VERIFIED' ? 'Verified' : 'Pending KYC'}
          dot
        />
      )
    },
    {
      key: 'loans',
      label: 'ACTIVE LOANS',
      render: (c) => {
        const loanCount = loans.filter((l) => isMatchingCustomerId(l.customerId, c)).length;
        return (
          <StatusBadge
            status={loanCount > 0 ? 'ACTIVE' : 'INACTIVE'}
            label={`${loanCount} ${loanCount === 1 ? 'LOAN' : 'LOANS'}`}
          />
        );
      }
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      align: 'right',
      render: (c) => (
        <div style={{ display: 'inline-flex', gap: '6px' }}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            style={{ padding: '0 6px', height: '28px', color: 'var(--primary, #176B52)' }}
            title="View Customer Profile"
            onClick={(e) => {
              e.stopPropagation();
              handleViewCustomer(c);
            }}
          >
            <Eye size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            style={{ padding: '0 6px', height: '28px', color: 'var(--text-secondary)' }}
            title="Edit Customer"
            onClick={(e) => {
              e.stopPropagation();
              startEditCustomer(c.id);
            }}
          >
            <Edit3 size={13} />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="page-content">
      <PageHeader
        title="Customer Management"
        subtitle="Manage borrower profiles, KYC information, identity verifications, and customer credit records"
        icon={<Users size={17} />}
        actions={
          <Button
            variant="primary"
            icon={<UserPlus size={15} />}
            onClick={() => setCurrentPage('add-customer-form')}
          >
            + Add Customer
          </Button>
        }
      />

      {/* Summary Stat Cards */}
      <StatGrid columns={3}>
        <StatCard
          label="Total Registered Borrowers"
          value={activeCustomers.length}
          subValue="All customer master profiles"
          colorTheme="primary"
          icon={<Users size={18} />}
        />
        <StatCard
          label="KYC Verified"
          value={verifiedCount}
          subValue="Verified ID and Address"
          colorTheme="success"
          icon={<CheckCircle2 size={18} />}
        />
        <StatCard
          label="Pending Verification"
          value={pendingCount}
          subValue="Requires documentation check"
          colorTheme={pendingCount > 0 ? 'warning' : 'neutral'}
          icon={<Clock size={18} />}
        />
      </StatGrid>

      {/* Filter Toolbar */}
      <FilterBar onReset={searchTerm || statusFilter !== 'ALL' ? handleClear : undefined}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
          <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-control"
            style={{ paddingLeft: '34px', height: '36px', fontSize: '12.5px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search borrower name, phone, customer ID, Aadhaar..."
          />
        </div>

        <select
          className="select-control"
          style={{ width: '160px', height: '36px', fontSize: '12px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="ALL">All KYC Statuses</option>
          <option value="VERIFIED">Verified Only</option>
          <option value="PENDING">Pending KYC Only</option>
        </select>
      </FilterBar>

      {/* Customers Data Table */}
      <DataTable
        columns={columns}
        data={filteredCustomers}
        keyExtractor={(c, idx) => `cust-${c.id}-${idx}`}
        onRowClick={handleViewCustomer}
        emptyTitle="No borrowers found"
        emptyDescription="No registered borrowers matched your search or status criteria."
        emptyIcon={<User size={24} />}
        emptyAction={
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus size={14} />}
            onClick={() => setCurrentPage('add-customer-form')}
            style={{ marginTop: '8px' }}
          >
            + Add New Customer
          </Button>
        }
      />

      {/* View Customer Details Modal */}
      <ViewCustomerModal
        isOpen={!!viewingCustomer}
        customer={viewingCustomer}
        onClose={() => setViewingCustomer(null)}
        onEdit={(cust) => {
          setViewingCustomer(null);
          startEditCustomer(cust.id);
        }}
      />
    </div>
  );
};
