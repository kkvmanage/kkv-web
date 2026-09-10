import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, RotateCcw, Edit3, Eye, User } from 'lucide-react';
import { ViewCustomerModal } from '../components/common/ViewCustomerModal';
import { Customer } from '../types';
import { formatIdProofDisplay } from '../utils/kycValidation';
import { getCanonicalCustomerId, isMatchingCustomerId } from '../utils/customerUtils';
import { PageHeader, Card, StatusBadge, Button } from '../components/ui';

export const SearchCustomer: React.FC = () => {
  const {
    customers,
    loans,
    fixedDeposits,
    setSelectedProfileCustomerId,
    setCurrentPage,
    startEditCustomer
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING'>('ALL');
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchTerm);
  };

  const handleClear = () => {
    setSearchTerm('');
    setActiveQuery('');
    setStatusFilter('ALL');
  };

  const activeCustomers = useMemo(() => {
    return customers.filter((c) => !c.isDeleted);
  }, [customers]);

  const sampleCustomerChips = useMemo(() => {
    return activeCustomers.slice(0, 4).map((c) => ({
      id: c.id,
      canonicalId: getCanonicalCustomerId(c),
      name: c.name,
      customer: c
    }));
  }, [activeCustomers]);

  const filteredCustomers = useMemo(() => {
    const query = (activeQuery || searchTerm).toLowerCase().trim();

    return activeCustomers.filter((c) => {
      const canonicalId = getCanonicalCustomerId(c).toLowerCase();
      const numIdStr = c.customerId ? c.customerId.toString().toLowerCase() : '';
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();

      const matchesLoanNo = loans.some(
        (l) => isMatchingCustomerId(l.customerId, c) && l.loanNo.toLowerCase().includes(query)
      );
      const matchesFDNo = fixedDeposits.some(
        (f) => isMatchingCustomerId(f.customerId, c) && f.fdNo.toLowerCase().includes(query)
      );

      const matchesSearch =
        !query ||
        canonicalId.includes(query) ||
        numIdStr.includes(query) ||
        c.id.toLowerCase().includes(query) ||
        isMatchingCustomerId(query, c) ||
        name.includes(query) ||
        phone.includes(query) ||
        (c.idNumber && c.idNumber.toLowerCase().includes(query)) ||
        (c.occupation && c.occupation.toLowerCase().includes(query)) ||
        matchesLoanNo ||
        matchesFDNo;

      const matchesFilter = statusFilter === 'ALL' || c.status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [activeCustomers, activeQuery, searchTerm, statusFilter, loans, fixedDeposits]);

  const topMatchCustomer = useMemo(() => {
    const query = (activeQuery || searchTerm).trim();
    if (!query || filteredCustomers.length === 0) return null;
    return filteredCustomers[0];
  }, [activeQuery, searchTerm, filteredCustomers]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedProfileCustomerId(c.id);
    setCurrentPage('customer-profile');
  };

  return (
    <div className="page-content">
      {/* PAGE HEADER */}
      <PageHeader
        title="Search Customers"
        subtitle="Master customer directory — Search by Customer ID, Name, Mobile, Loan No, or FD No."
        icon={<Search size={20} />}
      />

      {/* SEARCH BAR */}
      <Card style={{ marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            Search Master Customer Directory
          </label>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <input
                type="text"
                className="input-control"
                style={{ height: '40px', paddingLeft: '36px', fontSize: '13.5px' }}
                placeholder="Search by Customer ID, Name, Mobile, Loan No, or FD No..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <Search
                size={15}
                style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
              />
            </div>

            <select
              className="select-control"
              style={{ width: '155px', height: '40px', fontSize: '13px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending KYC</option>
            </select>

            <Button type="submit" variant="primary" icon={<Search size={14} />}>Search</Button>

            {(searchTerm || activeQuery || statusFilter !== 'ALL') && (
              <Button type="button" variant="secondary" icon={<RotateCcw size={13} />} onClick={handleClear}>
                Reset
              </Button>
            )}
          </div>

          {/* Quick Pick Chips */}
          {sampleCustomerChips.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Quick Pick:</span>
              {sampleCustomerChips.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => { setSearchTerm(ch.canonicalId); setActiveQuery(ch.canonicalId); }}
                  style={{
                    cursor: 'pointer',
                    padding: '3px 10px',
                    fontSize: '11.5px',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    backgroundColor: 'var(--surface-secondary)',
                    color: 'var(--primary)',
                    fontWeight: 600
                  }}
                >
                  <strong>{ch.canonicalId}</strong> — {ch.name}
                </button>
              ))}
            </div>
          )}
        </form>
      </Card>

      {/* CUSTOMER FOUND HIGHLIGHT CARD */}
      {topMatchCustomer && (activeQuery || searchTerm) && (() => {
        const c = topMatchCustomer;
        const custCanonicalId = getCanonicalCustomerId(c);
        const custLoans = loans.filter((l) => isMatchingCustomerId(l.customerId, c) && l.status !== 'CLOSED');
        const custFDs = fixedDeposits.filter((f) => isMatchingCustomerId(f.customerId, c) && f.status === 'ACTIVE');

        return (
          <Card style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'var(--surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--primary)', overflow: 'hidden', flexShrink: 0 }}>
                  {c.customerPhoto ? (
                    <img src={c.customerPhoto} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={24} color="var(--primary)" />
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <StatusBadge status="VERIFIED" label="Customer Found" />
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>{c.name}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span>ID: <strong style={{ color: 'var(--primary)' }}>{custCanonicalId}</strong></span>
                    <span>•</span>
                    <span>+91 {c.phone}</span>
                    <span>•</span>
                    <span style={{ color: 'var(--success, #16a34a)', fontWeight: 700 }}>{custLoans.length} Active Loan(s)</span>
                    <span>•</span>
                    <span style={{ color: 'var(--gold, #C9A227)', fontWeight: 700 }}>{custFDs.length} Active FD(s)</span>
                  </div>
                </div>
              </div>
              <Button variant="primary" onClick={() => handleSelectCustomer(c)}>
                Select Customer →
              </Button>
            </div>
          </Card>
        );
      })()}

      {/* SEARCH RESULTS TABLE */}
      <Card noPadding>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface-secondary)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Customer Directory</h3>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              {filteredCustomers.length} of {activeCustomers.length} customers
            </span>
          </div>
          <StatusBadge status="ACTIVE" label={`${activeCustomers.length} Total`} />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
                {['Customer ID', 'Customer Name', 'Phone', 'ID Proof', 'Loans', 'Fixed Deposits', 'Actions'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-secondary)', textAlign: i === 6 ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)' }}>
                    No customer records found matching your search query.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const custCanonicalId = getCanonicalCustomerId(c);
                  const loanCount = loans.filter((l) => isMatchingCustomerId(l.customerId, c) && l.status !== 'CLOSED').length;
                  const fdCount = fixedDeposits.filter((f) => isMatchingCustomerId(f.customerId, c) && f.status === 'ACTIVE').length;

                  return (
                    <tr
                      key={`search-cust-${c.id}`}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background-color 0.12s ease' }}
                      className="data-table-row"
                    >
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary)', fontSize: '12px' }}>
                        {custCanonicalId}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {c.customerPhoto ? (
                            <img src={c.customerPhoto} alt={c.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--border)', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-secondary)', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>+91 {c.phone}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: '12px' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{c.idProof}:</strong>{' '}
                          <span style={{ color: 'var(--text-secondary)' }}>{formatIdProofDisplay(c.idProof, c.idNumber)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <StatusBadge status={loanCount > 0 ? 'ACTIVE' : 'CLOSED'} label={`${loanCount} Active`} />
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <StatusBadge status={fdCount > 0 ? 'ACTIVE' : 'CLOSED'} label={`${fdCount} Active`} />
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button variant="secondary" size="sm" icon={<Edit3 size={12} />} title="Edit Customer" onClick={() => startEditCustomer(c.id)} />
                          <Button variant="primary" size="sm" icon={<Eye size={12} />} onClick={() => handleSelectCustomer(c)}>
                            Overview
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View Customer Modal */}
      {viewingCustomer && (
        <ViewCustomerModal
          isOpen={Boolean(viewingCustomer)}
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
          onEdit={() => {
            const custId = viewingCustomer.id;
            setViewingCustomer(null);
            startEditCustomer(custId);
          }}
        />
      )}
    </div>
  );
};
