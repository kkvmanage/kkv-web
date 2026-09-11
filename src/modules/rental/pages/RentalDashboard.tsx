import React, { useState, useEffect } from 'react';
import {
  Building2,
  Store,
  Wallet,
  TrendingUp,
  Clock,
  PiggyBank,
  Plus,
  ArrowUpRight,
  Receipt,
  BookOpen
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { rentalApi } from '../services/rentalApi';
import { RentalDashboardData, RentalComplex, RentalShop } from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { RentalStatCard } from '../components/RentalStatCard';
import { RentalCharts } from '../components/RentalCharts';
import { PaymentModal } from '../components/PaymentModal';
import { ExpenseModal } from '../components/ExpenseModal';
import { ComplexModal } from '../components/ComplexModal';
import { ShopModal } from '../components/ShopModal';

interface RentalDashboardProps {
  onNavigate?: (page: string) => void;
  onSelectComplex?: (complexId: string) => void;
  onSelectShop?: (shopId: string) => void;
}

export const RentalDashboard: React.FC<RentalDashboardProps> = ({
  onNavigate,
  onSelectComplex,
  onSelectShop
}) => {
  const { setCurrentPage, showToast } = useApp();

  const getCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [dashboardData, setDashboardData] = useState<RentalDashboardData | null>(null);
  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [shops, setShops] = useState<RentalShop[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isComplexModalOpen, setIsComplexModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, compRes, shopRes] = await Promise.all([
        rentalApi.getDashboard(selectedMonth),
        rentalApi.getComplexes(),
        rentalApi.getShops()
      ]);

      if (dashRes.success && dashRes.data) {
        setDashboardData(dashRes.data);
      }
      if (compRes.success && compRes.data) {
        setComplexes(compRes.data);
      }
      if (shopRes.success && shopRes.data) {
        setShops(shopRes.data);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedMonth]);

  const handleSaveComplex = async (data: any) => {
    const res = await rentalApi.createComplex(data);
    if (res.success) {
      showToast(res.message || 'Complex created successfully', 'success');
      await fetchDashboard();
    } else {
      throw new Error(res.message || 'Failed to create complex');
    }
  };

  const handleSaveShop = async (data: any) => {
    const res = await rentalApi.createShop(data);
    if (res.success) {
      showToast(res.message || 'Shop created successfully', 'success');
      await fetchDashboard();
    } else {
      throw new Error(res.message || 'Failed to create shop');
    }
  };

  const handleSaveExpense = async (data: any) => {
    const res = await rentalApi.createExpense(data);
    if (res.success) {
      showToast(res.message || 'Expense recorded successfully', 'success');
      await fetchDashboard();
    } else {
      throw new Error(res.message || 'Failed to record expense');
    }
  };

  return (
    <div className="page-content">
      <RentalHeader
        title="Complex Rental Management"
        subtitle="Manage commercial complexes, shops, monthly rent collections, advances, and expenses"
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>MONTH:</span>
              <input
                type="month"
                className="input-control"
                style={{ width: '140px', height: '32px', fontSize: '12px', padding: '4px 8px' }}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setIsPaymentModalOpen(true)}
            >
              <Plus size={14} />
              <span>Record Rent</span>
            </button>

            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setIsExpenseModalOpen(true)}
            >
              <Receipt size={14} />
              <span>Record Expense</span>
            </button>

            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setCurrentPage('rental-daybook')}
            >
              <BookOpen size={14} />
              <span>Day Book</span>
            </button>
          </div>
        }
      />

      {loading && !dashboardData ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spin-animation" style={{ display: 'inline-block', fontSize: '24px', marginBottom: '10px' }}>
            ⏳
          </div>
          <p style={{ fontSize: '13px', fontWeight: 600 }}>Loading Rental Dashboard...</p>
        </div>
      ) : (
        dashboardData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Stat Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <RentalStatCard
                label="TOTAL COMPLEXES"
                value={dashboardData.totalComplexes}
                icon={<Building2 size={20} />}
                variant="primary"
              />

              <RentalStatCard
                label="TOTAL SHOPS"
                value={dashboardData.totalShops}
                icon={<Store size={20} />}
                variant="default"
              />

              <RentalStatCard
                label="EXPECTED RENT"
                value={`₹${dashboardData.expectedMonthlyRent.toLocaleString('en-IN')}`}
                icon={<Wallet size={20} />}
                variant="default"
              />

              <RentalStatCard
                label="COLLECTED THIS MONTH"
                value={`₹${dashboardData.collectedThisMonth.toLocaleString('en-IN')}`}
                icon={<TrendingUp size={20} />}
                variant="success"
              />

              <RentalStatCard
                label="PENDING RENT"
                value={`₹${dashboardData.pendingRent.toLocaleString('en-IN')}`}
                icon={<Clock size={20} />}
                variant={dashboardData.pendingRent > 0 ? 'danger' : 'default'}
              />

              <RentalStatCard
                label="AVAILABLE ADVANCE"
                value={`₹${dashboardData.availableAdvance.toLocaleString('en-IN')}`}
                icon={<PiggyBank size={20} />}
                variant="info"
              />

              <RentalStatCard
                label="TODAY'S COLLECTION"
                value={`₹${dashboardData.todaysCollection.toLocaleString('en-IN')}`}
                icon={<TrendingUp size={20} />}
                variant="success"
              />

              <RentalStatCard
                label="THIS MONTH EXPENSES"
                value={`₹${dashboardData.thisMonthExpenses.toLocaleString('en-IN')}`}
                icon={<Receipt size={20} />}
                variant={dashboardData.thisMonthExpenses > 0 ? 'warning' : 'default'}
              />

              <RentalStatCard
                label="NET RENTAL COLLECTION"
                value={`₹${dashboardData.netCollection.toLocaleString('en-IN')}`}
                icon={<Wallet size={20} />}
                variant="primary"
              />
            </div>

            {/* Charts Section */}
            <RentalCharts data={dashboardData} />

            {/* Complex Performance Table */}
            <div className="card" style={{ padding: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Complex Performance ({selectedMonth})
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Breakdown of monthly expected, collected, pending, and net rental revenue
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setIsComplexModalOpen(true)}
                >
                  <Plus size={13} />
                  <span>New Complex</span>
                </button>
              </div>

              {dashboardData.complexStats.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No complexes found. Click <strong>+ New Complex</strong> to create your first complex.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>COMPLEX NAME</th>
                        <th>LOCATION</th>
                        <th style={{ textAlign: 'center' }}>SHOPS</th>
                        <th style={{ textAlign: 'right' }}>EXPECTED</th>
                        <th style={{ textAlign: 'right' }}>COLLECTED</th>
                        <th style={{ textAlign: 'right' }}>PENDING</th>
                        <th style={{ textAlign: 'right' }}>EXPENSES</th>
                        <th style={{ textAlign: 'right' }}>NET REVENUE</th>
                        <th style={{ textAlign: 'center' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.complexStats.map((c) => (
                        <tr key={c.complexId}>
                          <td style={{ fontWeight: 700 }}>{c.complexName}</td>
                          <td>{c.location}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.totalShops}</td>
                          <td style={{ textAlign: 'right' }}>₹{c.expectedRent.toLocaleString('en-IN')}</td>
                          <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                            ₹{c.collected.toLocaleString('en-IN')}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              color: c.pending > 0 ? '#dc2626' : 'var(--text-muted)',
                              fontWeight: c.pending > 0 ? 700 : 400
                            }}
                          >
                            ₹{c.pending.toLocaleString('en-IN')}
                          </td>
                          <td style={{ textAlign: 'right', color: '#ea580c' }}>
                            ₹{c.expenses.toLocaleString('en-IN')}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#176B52' }}>
                            ₹{c.net.toLocaleString('en-IN')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                              onClick={() => {
                                if (onSelectComplex) {
                                  onSelectComplex(c.complexId);
                                } else {
                                  (window as any).__selectedRentalComplexId = c.complexId;
                                  setCurrentPage('rental-complex-detail' as any);
                                }
                              }}
                            >
                              <span>View</span>
                              <ArrowUpRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Payments & Expenses Dual Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
              {/* Recent Rent Payments */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Recent Rent Collections
                  </h4>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: '10.5px', padding: '2px 8px' }}
                    onClick={() => (onNavigate ? onNavigate('rental-payments') : setCurrentPage('rental-payments' as any))}
                  >
                    View All
                  </button>
                </div>

                {dashboardData.recentPayments.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                    No payments recorded yet.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ fontSize: '11.5px' }}>
                      <thead>
                        <tr>
                          <th>SHOP</th>
                          <th>TENANT</th>
                          <th>MODE</th>
                          <th style={{ textAlign: 'right' }}>AMOUNT</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.recentPayments.slice(0, 5).map((p) => (
                          <tr key={p.paymentId}>
                            <td
                              style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--color-primary, #176B52)' }}
                              onClick={() => {
                                if (onSelectShop) {
                                  onSelectShop(p.shopId);
                                } else {
                                  (window as any).__selectedRentalShopId = p.shopId;
                                  setCurrentPage('rental-shop-detail' as any);
                                }
                              }}
                              title="View Shop History"
                            >
                              {p.shopNumber || p.shopId}
                            </td>
                            <td>{p.tenantName || '-'}</td>
                            <td>
                              <span style={{ fontSize: '10px', background: 'var(--bg-surface-secondary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                {p.paymentMode}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                              ₹{p.amountReceived.toLocaleString('en-IN')}
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: '9.5px',
                                  padding: '2px 6px',
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Expenses */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Recent Expenses
                  </h4>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: '10.5px', padding: '2px 8px' }}
                    onClick={() => (onNavigate ? onNavigate('rental-expenses') : setCurrentPage('rental-expenses' as any))}
                  >
                    View All
                  </button>
                </div>

                {dashboardData.recentExpenses.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                    No expenses recorded yet.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ fontSize: '11.5px' }}>
                      <thead>
                        <tr>
                          <th>SCOPE</th>
                          <th>CATEGORY</th>
                          <th>REASON</th>
                          <th>DATE</th>
                          <th style={{ textAlign: 'right' }}>AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.recentExpenses.slice(0, 5).map((e: any) => (
                          <tr key={e.expenseId}>
                            <td>
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  backgroundColor: e.expenseScope === 'COMPLEX' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                                  color: e.expenseScope === 'COMPLEX' ? '#2563eb' : '#7c3aed'
                                }}
                              >
                                {e.expenseScope || 'COMPLEX'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{e.category}</td>
                            <td>{e.expenseReason}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{e.expenseDate}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                              ₹{e.expenseAmount.toLocaleString('en-IN', {
                                minimumFractionDigits: Number.isInteger(e.expenseAmount) ? 0 : 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* Modals */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={fetchDashboard}
        complexes={complexes}
        shops={shops}
      />

      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSave={handleSaveExpense}
        complexes={complexes}
        shops={shops}
      />

      <ComplexModal
        isOpen={isComplexModalOpen}
        onClose={() => setIsComplexModalOpen(false)}
        onSave={handleSaveComplex}
      />

      <ShopModal
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
        onSave={handleSaveShop}
        complexes={complexes}
      />
    </div>
  );
};
