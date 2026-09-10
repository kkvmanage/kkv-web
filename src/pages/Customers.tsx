import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserPlus, RotateCcw, Edit3, Eye } from 'lucide-react';
import { SearchInput } from '../components/common/SearchInput';
import { ViewCustomerModal } from '../components/common/ViewCustomerModal';
import { Customer } from '../types';
import { formatIdProofDisplay } from '../utils/kycValidation';
import { isMatchingCustomerId } from '../utils/customerUtils';

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

  const handleClear = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
  };

  return (
    <div className="page-content">
      {/* Toolbar Card */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          {/* Left: Add Customer Button -> Navigates to Dedicated /customers/add/new Route */}
          <button className="btn btn-primary" onClick={() => setCurrentPage('add-customer-form')}>
            <UserPlus size={16} />
            <span>Add Customer</span>
          </button>

          {/* Center Search & Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '600px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search name, phone, ID..."
              />
            </div>

            <select
              className="select-control"
              style={{ width: '150px', height: '38px', fontSize: '13px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All customers</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending KYC</option>
            </select>

            <button className="btn btn-secondary btn-sm" style={{ height: '38px' }} onClick={handleClear}>
              <RotateCcw size={14} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customers List Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-dark)' }}>Borrower Database</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {filteredCustomers.length} of {customers.length} registered borrowers
            </span>
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>PROFILE PHOTO / AVATAR</th>
                <th>PHONE</th>
                <th>GENDER</th>
                <th>OCCUPATION</th>
                <th>ID PROOF</th>
                <th>LOANS</th>
                <th style={{ textAlign: 'center', width: '120px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No customers found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, index) => {
                  const loanCount = loans.filter((l) => isMatchingCustomerId(l.customerId, c)).length;
                  return (
                    <tr
                      key={`cust-row-${c.id}-${index}`}
                      onClick={() => handleViewCustomer(c)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view customer details"
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {c.customerPhoto ? (
                            <img
                              src={c.customerPhoto}
                              alt={c.name}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1.5px solid var(--color-primary-accent, #059669)',
                                flexShrink: 0
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
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
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>{c.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.id}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>+91 {c.phone}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>
                          {c.gender}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{c.occupation}</td>
                      <td>
                        <div style={{ fontSize: '12px' }}>
                          <strong style={{ color: 'var(--color-primary-dark)' }}>{c.idProof}:</strong>{' '}
                          <span>{formatIdProofDisplay(c.idProof, c.idNumber)}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-success">
                          {loanCount} {loanCount === 1 ? 'LOAN' : 'LOANS'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="icon-button"
                            style={{ width: '28px', height: '28px' }}
                            title="View Customer Profile"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewCustomer(c);
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            style={{ width: '28px', height: '28px' }}
                            title="Edit Customer"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditCustomer(c.id);
                            }}
                          >
                            <Edit3 size={13} />
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

