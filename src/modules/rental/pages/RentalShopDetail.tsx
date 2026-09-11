import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CreditCard,
  Receipt,
  Plus,
  Edit2
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { rentalApi } from '../services/rentalApi';
import { RentalShop, RentalComplex, RentalPayment, RentalExpense } from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { PaymentModal } from '../components/PaymentModal';
import { ExpenseModal } from '../components/ExpenseModal';
import { ShopModal } from '../components/ShopModal';

interface RentalShopDetailProps {
  shopId?: string;
  onBack?: () => void;
}

export const RentalShopDetail: React.FC<RentalShopDetailProps> = ({
  shopId: propShopId,
  onBack
}) => {
  const { setCurrentPage, showToast } = useApp();

  const shopId = propShopId || (window as any).__selectedRentalShopId;

  const [shop, setShop] = useState<RentalShop | null>(null);
  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [payments, setPayments] = useState<RentalPayment[]>([]);
  const [expenses, setExpenses] = useState<RentalExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isEditShopModalOpen, setIsEditShopModalOpen] = useState(false);

  const fetchShopData = async () => {
    if (!shopId) {
      setCurrentPage('rental-shops' as any);
      return;
    }
    setLoading(true);
    try {
      const [sRes, cRes, pRes, eRes] = await Promise.all([
        rentalApi.getShopById(shopId),
        rentalApi.getComplexes(),
        rentalApi.getPayments({ shopId }),
        rentalApi.getExpenses({ shopId })
      ]);

      if (sRes.success && sRes.data) setShop(sRes.data);
      if (cRes.success && cRes.data) setComplexes(cRes.data);
      if (pRes.success && pRes.data) setPayments(pRes.data);
      if (eRes.success && eRes.data) setExpenses(eRes.data);
    } catch (err) {
      console.error('Error fetching shop detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData();
  }, [shopId]);

  const handleSaveShop = async (data: any) => {
    if (!shop) return;
    const res = await rentalApi.updateShop(shop.shopId, data);
    if (res.success) {
      showToast(res.message || 'Shop updated', 'success');
      await fetchShopData();
    } else {
      throw new Error(res.message || 'Failed to update shop');
    }
  };

  const handleSaveExpense = async (data: any) => {
    const res = await rentalApi.createExpense(data);
    if (res.success) {
      showToast(res.message || 'Expense recorded', 'success');
      await fetchShopData();
    } else {
      throw new Error(res.message || 'Failed to record expense');
    }
  };

  if (!shop && !loading) {
    return (
      <div className="page-content" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p>Shop not found.</p>
        <button type="button" className="btn btn-primary" onClick={() => setCurrentPage('rental-shops' as any)}>
          Back to Shops
        </button>
      </div>
    );
  }

  const totalCollected = payments.reduce((sum, p) => sum + p.amountReceived, 0);
  const totalShopExpenses = expenses.reduce((sum, e) => sum + e.expenseAmount, 0);

  return (
    <div className="page-content">
      {/* Navigation Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => (onBack ? onBack() : setCurrentPage('rental-shops' as any))}
        >
          <ArrowLeft size={14} />
          <span>All Shops</span>
        </button>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          {shop?.shopNumber} - {shop?.shopName}
        </span>
      </div>

      <RentalHeader
        title={`${shop?.shopNumber || ''} — ${shop?.shopName || 'Shop Detail'}`}
        subtitle={`Tenant: ${shop?.tenantName || ''} • Complex: ${shop?.complexName || ''}`}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setIsEditShopModalOpen(true)}
            >
              <Edit2 size={13} />
              <span>Edit Shop</span>
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
              onClick={() => setIsPaymentModalOpen(true)}
            >
              <CreditCard size={14} />
              <span>Record Rent</span>
            </button>
          </div>
        }
      />

      {/* Shop Info Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        <div className="card" style={{ padding: '14px 16px', backgroundColor: 'var(--bg-surface-secondary)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            MONTHLY RENT
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#176B52', marginTop: '4px' }}>
            ₹{shop?.monthlyRent.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', backgroundColor: 'rgba(37, 99, 235, 0.08)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
            AVAILABLE ADVANCE
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
            ₹{shop?.availableAdvance.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            TOTAL RENT PAID
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
            ₹{totalCollected.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', backgroundColor: 'rgba(234, 88, 12, 0.08)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase' }}>
            SHOP EXPENSES
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ea580c', marginTop: '4px' }}>
            ₹{totalShopExpenses.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            TENANT CONTACT
          </span>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
            {shop?.tenantName}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>📞 {shop?.mobileNumber}</span>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="card" style={{ padding: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Payment History
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Complete chronological ledger of all rent collections, advance usage, and receipts
            </span>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setIsPaymentModalOpen(true)}
          >
            <Plus size={13} />
            <span>Record Payment</span>
          </button>
        </div>

        {payments.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            No payment records found for this shop yet.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>PAYMENT ID</th>
                  <th>MONTH</th>
                  <th>PAYMENT DATE</th>
                  <th style={{ textAlign: 'right' }}>AMOUNT PAID</th>
                  <th style={{ textAlign: 'right' }}>ADVANCE USED</th>
                  <th style={{ textAlign: 'right' }}>ADVANCE GEN.</th>
                  <th style={{ textAlign: 'right' }}>BALANCE</th>
                  <th>MODE</th>
                  <th>STATUS</th>
                  <th>NOTES</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.paymentId}>
                    <td style={{ fontWeight: 700, color: 'var(--color-gold-light)' }}>{p.paymentId}</td>
                    <td style={{ fontWeight: 600 }}>{p.paymentMonth}</td>
                    <td>{p.paymentDate}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                      ₹{p.amountReceived.toLocaleString('en-IN')}
                    </td>
                    <td style={{ textAlign: 'right', color: p.advanceUsed > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                      ₹{p.advanceUsed.toLocaleString('en-IN')}
                    </td>
                    <td style={{ textAlign: 'right', color: p.advanceGenerated > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                      ₹{p.advanceGenerated.toLocaleString('en-IN')}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: p.balanceAfterPayment > 0 ? '#dc2626' : '#16a34a' }}>
                      ₹{p.balanceAfterPayment.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span style={{ fontSize: '10px', background: 'var(--bg-surface-secondary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        {p.paymentMode}
                        {p.paymentMode === 'BOTH' && ` (C:₹${p.cashAmount} G:₹${p.gpayAmount})`}
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

      {/* Expense History for Shop */}
      {expenses.length > 0 && (
        <div className="card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
            Shop Specific Expenses
          </h3>
          <div className="table-responsive">
            <table className="table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>EXPENSE ID</th>
                  <th>DATE</th>
                  <th>CATEGORY</th>
                  <th>REASON</th>
                  <th style={{ textAlign: 'right' }}>AMOUNT</th>
                  <th>MODE</th>
                  <th>NOTES</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.expenseId}>
                    <td style={{ fontWeight: 700 }}>{e.expenseId}</td>
                    <td>{e.expenseDate}</td>
                    <td style={{ fontWeight: 600 }}>{e.category}</td>
                    <td>{e.expenseReason}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                      ₹{e.expenseAmount.toLocaleString('en-IN')}
                    </td>
                    <td>{e.paymentMode}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{e.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {shop && (
        <>
          <ShopModal
            isOpen={isEditShopModalOpen}
            onClose={() => setIsEditShopModalOpen(false)}
            onSave={handleSaveShop}
            complexes={complexes}
            shopToEdit={shop}
          />

          <PaymentModal
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            onSuccess={fetchShopData}
            complexes={complexes}
            shops={[shop]}
            defaultComplexId={shop.complexId}
            defaultShopId={shop.shopId}
          />

          <ExpenseModal
            isOpen={isExpenseModalOpen}
            onClose={() => setIsExpenseModalOpen(false)}
            onSave={handleSaveExpense}
            complexes={complexes}
            shops={[shop]}
            defaultComplexId={shop.complexId}
            defaultShopId={shop.shopId}
            defaultScope="SHOP"
          />

        </>
      )}
    </div>
  );
};
