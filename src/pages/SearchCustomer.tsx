import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, RotateCcw, Edit3, Eye, User } from 'lucide-react';
import { ViewCustomerModal } from '../components/common/ViewCustomerModal';
import { Customer } from '../types';
import { formatIdProofDisplay } from '../utils/kycValidation';
import { getCanonicalCustomerId, isMatchingCustomerId } from '../utils/customerUtils';

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

  // ── Quick Chips for Quick Testing ──────────────────────────────────────────
  const sampleCustomerChips = useMemo(() => {
    return activeCustomers.slice(0, 4).map((c) => ({
      id: c.id,
      canonicalId: getCanonicalCustomerId(c),
      name: c.name,
      phone: c.phone,
      customer: c
    }));
  }, [activeCustomers]);

  // ── Filtered Customers (prioritizing Customer ID, Name, Phone, Loan No, FD No) ─
  const filteredCustomers = useMemo(() => {
    const query = (activeQuery || searchTerm).toLowerCase().trim();

    return activeCustomers.filter((c) => {
      const canonicalId = getCanonicalCustomerId(c).toLowerCase();
      const numIdStr = c.customerId ? c.customerId.toString().toLowerCase() : '';
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();

      // Check if user searched for a loan number directly (e.g. GL-001)
      const matchesLoanNo = loans.some(
        (l) => isMatchingCustomerId(l.customerId, c) && l.loanNo.toLowerCase().includes(query)
      );

      // Check if user searched for an FD number directly (e.g. FD-001)
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

  // Top Customer Match for the highlight card
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
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-dark)' }}>
          Search Customers
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
          Master customer directory &mdash; Search by Customer ID, Name, Mobile, Loan No, or FD No.
        </p>
      </div>

      {/* SEARCH BAR CARD */}
      <div
        className="card"
        style={{
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            SEARCH MASTER CUSTOMER DIRECTORY
          </label>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <input
                type="text"
                className="input-control"
                style={{
                  height: '46px',
                  paddingLeft: '44px',
                  paddingRight: '16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md, 8px)'
                }}
                placeholder="Search Customer ID (e.g. CUST-0006), Name, Mobile, Loan No, or FD No..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none'
                }}
              />
            </div>

            <select
              className="select-control"
              style={{ width: '160px', height: '46px', fontSize: '13.5px', borderRadius: 'var(--radius-md, 8px)' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending KYC</option>
            </select>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: '46px', padding: '0 24px', fontSize: '14px', fontWeight: 700, gap: '8px' }}
            >
              <Search size={16} />
              <span>Search</span>
            </button>

            {(searchTerm || activeQuery || statusFilter !== 'ALL') && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '46px', padding: '0 18px' }}
                onClick={handleClear}
              >
                <RotateCcw size={15} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Quick Pick Chips */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Quick Pick:</span>
            {sampleCustomerChips.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setSearchTerm(ch.canonicalId);
                  setActiveQuery(ch.canonicalId);
                }}
                className="badge badge-info"
                style={{ cursor: 'pointer', padding: '5px 10px', fontSize: '11.5px', border: 'none' }}
              >
                <strong>{ch.canonicalId}</strong> &mdash; {ch.name}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 3: CUSTOMER FOUND HIGHLIGHT CARD (When Query Matches)
          ════════════════════════════════════════════════════════════════════════ */}
      {topMatchCustomer && (activeQuery || searchTerm) && (() => {
        const c = topMatchCustomer;
        const custCanonicalId = getCanonicalCustomerId(c);
        const custLoans = loans.filter((l) => isMatchingCustomerId(l.customerId, c) && l.status !== 'CLOSED');
        const custFDs = fixedDeposits.filter((f) => isMatchingCustomerId(f.customerId, c) && f.status === 'ACTIVE');

        return (
          <div
            className="card"
            style={{
              padding: '20px 24px',
              marginBottom: '24px',
              borderLeft: '5px solid var(--color-primary-accent, #059669)',
              backgroundColor: 'var(--bg-card)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--badge-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--badge-success-text)', border: '1px solid var(--badge-success-border)', overflow: 'hidden' }}>
                  {c.customerPhoto ? (
                    <img src={c.customerPhoto} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={28} />
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '11px' }}>
                      CUSTOMER FOUND
                    </span>
                    <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>✓ Verified</span>
                  </div>
                  <h3 style={{ fontSize: '19px', fontWeight: 900, color: 'var(--color-primary-dark)', margin: '4px 0 2px 0' }}>
                    {c.name}
                  </h3>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>Customer ID: <strong style={{ color: 'var(--color-primary-dark)' }}>{custCanonicalId}</strong></span>
                    <span>&bull;</span>
                    <span>Mobile: <strong>+91 {c.phone}</strong></span>
                    <span>&bull;</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary-accent, #059669)' }}>{custLoans.length} Active Loan(s)</span>
                    <span>&bull;</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>{custFDs.length} Active FD(s)</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSelectCustomer(c)}
                style={{ fontWeight: 800, padding: '10px 22px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Select Customer &rarr;</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* SEARCH RESULTS TABLE CARD */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-secondary, #f8fafc)'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-dark)' }}>
              Customer Directory Results
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Found {filteredCustomers.length} matching borrower profiles
            </span>
          </div>

          <span className="badge badge-info" style={{ fontSize: '12px' }}>
            Total Customers: {activeCustomers.length}
          </span>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>CUSTOMER ID</th>
                <th>CUSTOMER NAME</th>
                <th>PHONE</th>
                <th>ID PROOF</th>
                <th>LOANS</th>
                <th>FIXED DEPOSITS</th>
                <th style={{ textAlign: 'center', width: '160px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No customer records found matching your search query.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const custCanonicalId = getCanonicalCustomerId(c);
                  const loanCount = loans.filter((l) => isMatchingCustomerId(l.customerId, c) && l.status !== 'CLOSED').length;
                  const fdCount = fixedDeposits.filter((f) => isMatchingCustomerId(f.customerId, c) && f.status === 'ACTIVE').length;

                  return (
                    <tr key={`search-cust-${c.id}`}>
                      <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                        <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 800 }}>
                          {custCanonicalId}
                        </span>
                      </td>
                      <td>
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
                                border: '1.5px solid var(--color-primary-accent, #059669)',
                                flexShrink: 0
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-light-accent, #e6f4f1)',
                                color: 'var(--color-primary-dark, #163f35)',
                                fontWeight: 700,
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>+91 {c.phone}</td>
                      <td>
                        <div style={{ fontSize: '12px' }}>
                          <strong style={{ color: 'var(--color-primary-dark)' }}>{c.idProof}:</strong>{' '}
                          <span>{formatIdProofDisplay(c.idProof, c.idNumber)}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: '11px' }}>
                          {loanCount} Active
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-gold" style={{ fontSize: '11px' }}>
                          {fdCount} Active
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ height: '30px', padding: '0 8px', fontSize: '11.5px', gap: '4px' }}
                            title="Edit Customer Profile"
                            onClick={() => startEditCustomer(c.id)}
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ height: '30px', padding: '0 12px', fontSize: '11.5px', gap: '4px', fontWeight: 700 }}
                            title="View Customer Overview"
                            onClick={() => handleSelectCustomer(c)}
                          >
                            <Eye size={12} />
                            <span>Overview &rarr;</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Customer Quick Modal */}
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
