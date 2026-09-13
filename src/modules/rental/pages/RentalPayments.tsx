import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  RotateCcw
} from 'lucide-react';
import { rentalApi } from '../services/rentalApi';
import { RentalPayment, RentalComplex, RentalShop, PaymentMode, PaymentStatus } from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { PaymentModal } from '../components/PaymentModal';

export const RentalPayments: React.FC = () => {

  const [payments, setPayments] = useState<RentalPayment[]>([]);
  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [shops, setShops] = useState<RentalShop[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedComplex, setSelectedComplex] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | PaymentStatus>('ALL');
  const [selectedMode, setSelectedMode] = useState<'ALL' | PaymentMode>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, sRes] = await Promise.all([
        rentalApi.getPayments({
          complexId: selectedComplex || undefined,
          paymentMonth: selectedMonth || undefined,
          paymentStatus: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          paymentMode: selectedMode !== 'ALL' ? selectedMode : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: search || undefined
        }),
        rentalApi.getComplexes(),
        rentalApi.getShops()
      ]);

      if (pRes.success && pRes.data) setPayments(pRes.data);
      if (cRes.success && cRes.data) setComplexes(cRes.data);
      if (sRes.success && sRes.data) setShops(sRes.data);
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [selectedComplex, selectedMonth, selectedStatus, selectedMode, startDate, endDate]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchPayments();
    };
    window.addEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
    window.addEventListener('kkv_rental_data_changed', handleRefresh);
    return () => {
      window.removeEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
      window.removeEventListener('kkv_rental_data_changed', handleRefresh);
    };
  }, [selectedComplex, selectedMonth, selectedStatus, selectedMode, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedComplex('');
    setSelectedMonth('');
    setSelectedStatus('ALL');
    setSelectedMode('ALL');
    setStartDate('');
    setEndDate('');
  };

  const totalCollected = payments.reduce((sum, p) => sum + p.amountReceived, 0);
  const totalCash = payments.reduce((sum, p) => sum + p.cashAmount, 0);
  const totalGPay = payments.reduce((sum, p) => sum + p.gpayAmount, 0);

  return (
    <div className="page-content">
      <RentalHeader
        title="Rent Payments Ledger"
        subtitle="Chronological transaction record of all commercial rent collections, split modes, and receipts"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsPaymentModalOpen(true)}
          >
            <Plus size={15} />
            <span>+ Record Rent Payment</span>
          </button>
        }
      />

      {/* Summary Chips */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        <div className="card" style={{ padding: '12px 16px', backgroundColor: 'var(--primary-soft)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            FILTERED TOTAL COLLECTED
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-brand, #176B52)', marginTop: '2px' }}>
            ₹{totalCollected.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', backgroundColor: 'rgba(34, 197, 94, 0.06)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            CASH RECEIVED
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
            ₹{totalCash.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', backgroundColor: 'rgba(37, 99, 235, 0.06)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
            GPAY / UPI RECEIVED
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
            ₹{totalGPay.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', backgroundColor: 'var(--bg-card)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            TRANSACTIONS COUNT
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
            {payments.length}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: '220px', gap: '6px' }}>
            <input
              type="text"
              className="input-control"
              placeholder="Search by Payment ID, Shop, Tenant, Mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '0 12px' }}>
              <Search size={14} />
            </button>
          </form>

          <select
            className="select-control"
            style={{ width: '160px', height: '34px', fontSize: '12px' }}
            value={selectedComplex}
            onChange={(e) => setSelectedComplex(e.target.value)}
          >
            <option value="">All Complexes</option>
            {complexes.map((c) => (
              <option key={c.complexId} value={c.complexId}>
                {c.complexName}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Month:</span>
            <input
              type="month"
              className="input-control"
              style={{ width: '140px', height: '34px', fontSize: '12px' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <select
            className="select-control"
            style={{ width: '120px', height: '34px', fontSize: '12px' }}
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as any)}
          >
            <option value="ALL">All Modes</option>
            <option value="CASH">Cash</option>
            <option value="GPAY">GPay</option>
            <option value="BOTH">Both</option>
          </select>

          <select
            className="select-control"
            style={{ width: '120px', height: '34px', fontSize: '12px' }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
          >
            <option value="ALL">All Status</option>
            <option value="PAID">PAID</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="PENDING">PENDING</option>
          </select>

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleResetFilters}
            title="Reset Filters"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ padding: '18px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading payments...
          </div>
        ) : payments.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CreditCard size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No rent payments found matching criteria</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>PAYMENT ID</th>
                  <th>COMPLEX</th>
                  <th>SHOP</th>
                  <th>TENANT</th>
                  <th>MONTH</th>
                  <th>PAYMENT DATE</th>
                  <th style={{ textAlign: 'right' }}>AMOUNT PAID</th>
                  <th style={{ textAlign: 'right' }}>ADV. USED</th>
                  <th style={{ textAlign: 'right' }}>ADV. GEN.</th>
                  <th style={{ textAlign: 'right' }}>BALANCE</th>
                  <th>MODE</th>
                  <th>STATUS</th>
                  <th>NOTES</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.paymentId}>
                    <td style={{ fontWeight: 800, color: 'var(--color-gold-light)' }}>
                      {p.paymentId}
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.complexName}</td>
                    <td style={{ fontWeight: 700 }}>{p.shopNumber}</td>
                    <td>{p.tenantName}</td>
                    <td style={{ fontWeight: 600 }}>{p.paymentMonth}</td>
                    <td>{p.paymentDate}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                      ₹{p.amountReceived.toLocaleString('en-IN')}
                    </td>
                    <td style={{ textAlign: 'right', color: p.advanceUsed > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                      {p.advanceUsed > 0 ? `₹${p.advanceUsed.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right', color: p.advanceGenerated > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                      {p.advanceGenerated > 0 ? `₹${p.advanceGenerated.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: p.balanceAfterPayment > 0 ? '#dc2626' : '#16a34a'
                      }}
                    >
                      ₹{p.balanceAfterPayment.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '10px',
                          background: 'var(--bg-surface-secondary)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600
                        }}
                        title={p.paymentMode === 'BOTH' ? `Cash: ₹${p.cashAmount} | GPay: ₹${p.gpayAmount}` : p.paymentMode}
                      >
                        {p.paymentMode}
                        {p.paymentMode === 'BOTH' && ` (C:${p.cashAmount} G:${p.gpayAmount})`}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '9.5px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          backgroundColor:
                            p.paymentStatus === 'PAID'
                              ? 'rgba(34, 197, 94, 0.12)'
                              : p.paymentStatus === 'PARTIAL'
                              ? 'rgba(234, 179, 8, 0.12)'
                              : 'rgba(239, 68, 68, 0.12)',
                          color:
                            p.paymentStatus === 'PAID'
                              ? '#16a34a'
                              : p.paymentStatus === 'PARTIAL'
                              ? '#ca8a04'
                              : '#dc2626'
                        }}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{p.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={fetchPayments}
        complexes={complexes}
        shops={shops}
      />
    </div>
  );
};
