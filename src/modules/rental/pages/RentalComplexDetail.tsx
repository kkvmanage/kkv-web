import React, { useState, useEffect } from 'react';
import {
  Store,
  ArrowLeft,
  Plus,
  Edit2,
  Receipt,
  Phone,
  CreditCard
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { rentalApi } from '../services/rentalApi';
import { RentalComplex, RentalShop, RentalPayment, RentalExpense } from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { ShopModal } from '../components/ShopModal';
import { PaymentModal } from '../components/PaymentModal';
import { ExpenseModal } from '../components/ExpenseModal';
import { ComplexModal } from '../components/ComplexModal';

interface RentalComplexDetailProps {
  complexId?: string;
  onBack?: () => void;
  onSelectShop?: (shopId: string) => void;
}

export const RentalComplexDetail: React.FC<RentalComplexDetailProps> = ({
  complexId: propComplexId,
  onBack,
  onSelectShop
}) => {
  const { setCurrentPage, showToast } = useApp();

  const getCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const complexId = propComplexId || (window as any).__selectedRentalComplexId;

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [complex, setComplex] = useState<RentalComplex | null>(null);
  const [shops, setShops] = useState<RentalShop[]>([]);
  const [allComplexes, setAllComplexes] = useState<RentalComplex[]>([]);
  const [payments, setPayments] = useState<RentalPayment[]>([]);
  const [expenses, setExpenses] = useState<RentalExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<RentalShop | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetShopIdForPayment, setTargetShopIdForPayment] = useState<string | undefined>(undefined);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isEditComplexModalOpen, setIsEditComplexModalOpen] = useState(false);

  const fetchComplexData = async () => {
    if (!complexId) {
      setCurrentPage('rental-complexes' as any);
      return;
    }
    setLoading(true);
    try {
      const [cRes, sRes, allCRes, pRes, eRes] = await Promise.all([
        rentalApi.getComplexById(complexId),
        rentalApi.getShops({ complexId }),
        rentalApi.getComplexes(),
        rentalApi.getPayments({ complexId, paymentMonth: selectedMonth }),
        rentalApi.getExpenses({ complexId, startDate: `${selectedMonth}-01`, endDate: `${selectedMonth}-31` })
      ]);

      if (cRes.success && cRes.data) setComplex(cRes.data);
      if (sRes.success && sRes.data) setShops(sRes.data);
      if (allCRes.success && allCRes.data) setAllComplexes(allCRes.data);
      if (pRes.success && pRes.data) setPayments(pRes.data);
      if (eRes.success && eRes.data) setExpenses(eRes.data);
    } catch (err) {
      console.error('Error fetching complex detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplexData();
  }, [complexId, selectedMonth]);

  const handleSaveShop = async (data: any) => {
    if (editingShop) {
      const res = await rentalApi.updateShop(editingShop.shopId, data);
      if (res.success) {
        showToast(res.message || 'Shop updated', 'success');
        await fetchComplexData();
      } else {
        throw new Error(res.message || 'Failed to update shop');
      }
    } else {
      const res = await rentalApi.createShop(data);
      if (res.success) {
        showToast(res.message || 'Shop created', 'success');
        await fetchComplexData();
      } else {
        throw new Error(res.message || 'Failed to create shop');
      }
    }
  };

  const handleSaveExpense = async (data: any) => {
    const res = await rentalApi.createExpense(data);
    if (res.success) {
      showToast(res.message || 'Expense recorded', 'success');
      await fetchComplexData();
    } else {
      throw new Error(res.message || 'Failed to record expense');
    }
  };

  const handleSaveComplex = async (data: any) => {
    if (!complex) return;
    const res = await rentalApi.updateComplex(complex.complexId, data);
    if (res.success) {
      showToast(res.message || 'Complex updated', 'success');
      await fetchComplexData();
    } else {
      throw new Error(res.message || 'Failed to update complex');
    }
  };

  if (!complex && !loading) {
    return (
      <div className="page-content" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p>Complex not found.</p>
        <button type="button" className="btn btn-primary" onClick={() => setCurrentPage('rental-complexes' as any)}>
          Back to Complexes
        </button>
      </div>
    );
  }

  const activeShops = shops.filter((s) => s.status === 'ACTIVE');
  const expectedRent = activeShops.reduce((sum, s) => sum + s.monthlyRent, 0);
  const collectedRent = payments.reduce((sum, p) => sum + p.amountReceived, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.expenseAmount, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let pendingRent = 0;
  activeShops.forEach((s) => {
    const sPayments = payments.filter((p) => p.shopId === s.shopId);
    const sCovered = sPayments.reduce((sum, p) => sum + p.amountReceived + p.advanceUsed, 0);
    const unpaid = Math.max(0, s.monthlyRent - sCovered);

    const cleanMonth = selectedMonth.slice(0, 7);
    const [yearStr, monthPart] = cleanMonth.split('-');
    const year = parseInt(yearStr, 10) || today.getFullYear();
    const monthIndex = (parseInt(monthPart, 10) || (today.getMonth() + 1)) - 1;
    const maxDays = new Date(year, monthIndex + 1, 0).getDate();
    const dueDay = Math.min(Math.max(1, Math.round(Number(s.rentDueDay) || 10)), maxDays);
    const dueDate = new Date(year, monthIndex, dueDay);
    dueDate.setHours(0, 0, 0, 0);

    if (today.getTime() >= dueDate.getTime()) {
      pendingRent += unpaid;
    }
  });

  const netRevenue = collectedRent - totalExpenses;

  return (
    <div className="page-content">
      {/* Back Button & Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => (onBack ? onBack() : setCurrentPage('rental-complexes' as any))}
        >
          <ArrowLeft size={14} />
          <span>All Complexes</span>
        </button>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          {complex?.complexName}
        </span>
      </div>

      <RentalHeader
        title={`${complex?.complexName || 'Complex'} (${complex?.complexId || ''})`}
        subtitle={`📍 ${complex?.location || ''} • ${shops.length} Shops total`}
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
              className="btn btn-sm btn-secondary"
              onClick={() => setIsEditComplexModalOpen(true)}
            >
              <Edit2 size={13} />
              <span>Edit Complex</span>
            </button>

            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setIsExpenseModalOpen(true)}
            >
              <Receipt size={13} />
              <span>Record Expense</span>
            </button>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setEditingShop(null);
                setIsShopModalOpen(true);
              }}
            >
              <Plus size={14} />
              <span>+ Add Shop</span>
            </button>
          </div>
        }
      />

      {/* Complex Performance Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        <div className="card" style={{ padding: '14px 16px', backgroundColor: 'rgba(23, 107, 82, 0.05)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            EXPECTED RENT ({selectedMonth})
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            ₹{expectedRent.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            COLLECTED THIS MONTH
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
            ₹{collectedRent.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', backgroundColor: pendingRent > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: pendingRent > 0 ? '#dc2626' : 'var(--text-muted)', textTransform: 'uppercase' }}>
            PENDING BALANCE
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: pendingRent > 0 ? '#dc2626' : 'var(--text-primary)', marginTop: '4px' }}>
            ₹{pendingRent.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', backgroundColor: 'rgba(234, 179, 8, 0.08)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#ca8a04', textTransform: 'uppercase' }}>
            EXPENSES THIS MONTH
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ca8a04', marginTop: '4px' }}>
            ₹{totalExpenses.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', backgroundColor: 'var(--primary-soft)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-brand, #176B52)', textTransform: 'uppercase' }}>
            NET REVENUE
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-brand, #176B52)', marginTop: '4px' }}>
            ₹{netRevenue.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Shops Table */}
      <div className="card" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Shops in {complex?.complexName}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Real-time payment and balance status for {selectedMonth}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              setEditingShop(null);
              setIsShopModalOpen(true);
            }}
          >
            <Plus size={13} />
            <span>Add Shop</span>
          </button>
        </div>

        {shops.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Store size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No shops created inside this complex yet.</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ margin: '14px auto 0' }}
              onClick={() => {
                setEditingShop(null);
                setIsShopModalOpen(true);
              }}
            >
              <Plus size={14} />
              <span>Add First Shop</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>SHOP NO.</th>
                  <th>SHOP NAME</th>
                  <th>TENANT</th>
                  <th>MOBILE</th>
                  <th style={{ textAlign: 'right' }}>MONTHLY RENT</th>
                  <th style={{ textAlign: 'right' }}>PAID ({selectedMonth})</th>
                  <th style={{ textAlign: 'right' }}>BALANCE</th>
                  <th style={{ textAlign: 'right' }}>ADVANCE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => {
                  const sPayments = payments.filter((p) => p.shopId === shop.shopId);
                  const sPaid = sPayments.reduce((sum, p) => sum + p.amountReceived, 0);
                  const sAdvUsed = sPayments.reduce((sum, p) => sum + p.advanceUsed, 0);
                  const sCovered = sPaid + sAdvUsed;
                  const balance = Math.max(0, shop.monthlyRent - sCovered);

                  let status = 'PENDING';
                  if (sCovered >= shop.monthlyRent && shop.monthlyRent > 0) status = 'PAID';
                  else if (sCovered > 0) status = 'PARTIAL';

                  return (
                    <tr key={shop.shopId}>
                      <td style={{ fontWeight: 800 }}>{shop.shopNumber}</td>
                      <td style={{ fontWeight: 600 }}>{shop.shopName}</td>
                      <td>{shop.tenantName}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                          <Phone size={11} />
                          {shop.mobileNumber}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{shop.monthlyRent.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', color: sPaid > 0 ? '#16a34a' : 'var(--text-muted)', fontWeight: 700 }}>
                        ₹{sPaid.toLocaleString('en-IN')}
                        {sAdvUsed > 0 && (
                          <span style={{ display: 'block', fontSize: '10px', color: '#2563eb' }}>
                            (+₹{sAdvUsed} Adv)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                        ₹{balance.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', color: shop.availableAdvance > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                        ₹{shop.availableAdvance.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '9.5px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            backgroundColor:
                              status === 'PAID'
                                ? 'rgba(34, 197, 94, 0.12)'
                                : status === 'PARTIAL'
                                ? 'rgba(234, 179, 8, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                            color:
                              status === 'PAID'
                                ? '#16a34a'
                                : status === 'PARTIAL'
                                ? '#ca8a04'
                                : '#dc2626'
                          }}
                        >
                          {status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{ padding: '2px 8px', fontSize: '10.5px' }}
                            onClick={() => {
                              setTargetShopIdForPayment(shop.shopId);
                              setIsPaymentModalOpen(true);
                            }}
                            title="Record Payment"
                          >
                            <CreditCard size={11} />
                            <span>Pay</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '10.5px' }}
                            onClick={() => {
                              if (onSelectShop) {
                                onSelectShop(shop.shopId);
                              } else {
                                (window as any).__selectedRentalShopId = shop.shopId;
                                setCurrentPage('rental-shop-detail' as any);
                              }
                            }}
                            title="View Shop Details & History"
                          >
                            History
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            style={{ padding: '2px 6px' }}
                            onClick={() => {
                              setEditingShop(shop);
                              setIsShopModalOpen(true);
                            }}
                            title="Edit Shop"
                          >
                            <Edit2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ShopModal
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
        onSave={handleSaveShop}
        complexes={allComplexes}
        shopToEdit={editingShop}
        defaultComplexId={complexId}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setTargetShopIdForPayment(undefined);
        }}
        onSuccess={fetchComplexData}
        complexes={allComplexes}
        shops={shops}
        defaultComplexId={complexId}
        defaultShopId={targetShopIdForPayment}
      />

      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSave={handleSaveExpense}
        complexes={allComplexes}
        shops={shops}
        defaultComplexId={complexId}
        defaultScope="COMPLEX"
      />


      <ComplexModal
        isOpen={isEditComplexModalOpen}
        onClose={() => setIsEditComplexModalOpen(false)}
        onSave={handleSaveComplex}
        complexToEdit={complex}
      />
    </div>
  );
};
