import React, { useState, useEffect } from 'react';
import {
  Store,
  Plus,
  Search,
  Edit2,
  Phone,
  CreditCard,
  Ban,
  CheckCircle2,
  ArrowLeft,
  Building2,
  X
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { rentalApi } from '../services/rentalApi';
import { RentalShop, RentalComplex, RentalStatus } from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { ShopModal } from '../components/ShopModal';
import { PaymentModal } from '../components/PaymentModal';

interface RentalShopsProps {
  onSelectShop?: (shopId: string) => void;
  initialComplexId?: string;
}

export const RentalShops: React.FC<RentalShopsProps> = ({ onSelectShop, initialComplexId }) => {
  const { setCurrentPage, showToast } = useApp();

  const getInitialComplexId = () => {
    if (initialComplexId) return initialComplexId;
    if ((window as any).__selectedRentalComplexId) return (window as any).__selectedRentalComplexId;
    try {
      const stored = sessionStorage.getItem('kkv_selected_rental_complex_id');
      if (stored) return stored;
    } catch (e) {}
    try {
      const param = new URLSearchParams(window.location.search).get('complexId');
      if (param) return param;
    } catch (e) {}
    return '';
  };

  const [shops, setShops] = useState<RentalShop[]>([]);
  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedComplexFilter, setSelectedComplexFilter] = useState(getInitialComplexId);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RentalStatus>('ALL');

  // Modals
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<RentalShop | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetShopIdForPayment, setTargetShopIdForPayment] = useState<string | undefined>(undefined);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        rentalApi.getShops(),
        rentalApi.getComplexes()
      ]);
      if (sRes.success && sRes.data) setShops(sRes.data);
      if (cRes.success && cRes.data) setComplexes(cRes.data);
    } catch (err) {
      console.error('Error fetching shops:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      fetchShops();
    };
    window.addEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
    window.addEventListener('kkv_rental_data_changed', handleRefresh);
    return () => {
      window.removeEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
      window.removeEventListener('kkv_rental_data_changed', handleRefresh);
    };
  }, []);

  // Update complex filter if prop changes or window context changes
  useEffect(() => {
    const ctxId = initialComplexId || (window as any).__selectedRentalComplexId || '';
    if (ctxId && ctxId !== selectedComplexFilter) {
      setSelectedComplexFilter(ctxId);
    }
  }, [initialComplexId]);

  const handleComplexFilterChange = (complexId: string) => {
    setSelectedComplexFilter(complexId);
    (window as any).__selectedRentalComplexId = complexId;
    try {
      if (complexId) {
        sessionStorage.setItem('kkv_selected_rental_complex_id', complexId);
        const url = new URL(window.location.href);
        url.searchParams.set('complexId', complexId);
        window.history.replaceState({}, '', url.toString());
      } else {
        sessionStorage.removeItem('kkv_selected_rental_complex_id');
        const url = new URL(window.location.href);
        url.searchParams.delete('complexId');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {}
  };

  const clearComplexFilter = () => {
    handleComplexFilterChange('');
  };

  const handleSaveShop = async (data: any) => {
    if (editingShop) {
      const res = await rentalApi.updateShop(editingShop.shopId, data);
      if (res.success) {
        showToast(res.message || 'Shop updated', 'success');
        await fetchShops();
      } else {
        throw new Error(res.message || 'Failed to update shop');
      }
    } else {
      const res = await rentalApi.createShop(data);
      if (res.success) {
        showToast(res.message || 'Shop created', 'success');
        await fetchShops();
      } else {
        throw new Error(res.message || 'Failed to create shop');
      }
    }
  };

  const handleToggleStatus = async (shop: RentalShop) => {
    const newStatus: RentalStatus = shop.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await rentalApi.updateShop(shop.shopId, { status: newStatus });
      if (res.success) {
        showToast(`Shop ${shop.shopNumber} marked as ${newStatus}`, 'success');
        await fetchShops();
      } else {
        showToast(res.message || 'Status update failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error updating status', 'error');
    }
  };

  const filtered = shops.filter((s) => {
    const matchesSearch =
      s.shopNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.shopName.toLowerCase().includes(search.toLowerCase()) ||
      s.tenantName.toLowerCase().includes(search.toLowerCase()) ||
      s.mobileNumber.includes(search) ||
      (s.complexName && s.complexName.toLowerCase().includes(search.toLowerCase()));

    const matchesComplex = !selectedComplexFilter || s.complexId === selectedComplexFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

    return matchesSearch && matchesComplex && matchesStatus;
  });

  const activeComplexObj = complexes.find((c) => c.complexId === selectedComplexFilter);

  return (
    <div className="page-content">
      <RentalHeader
        title="Commercial Shops & Tenants"
        subtitle="Manage shop units across complexes, tenant contact details, monthly rents, and advances"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingShop(null);
              setIsShopModalOpen(true);
            }}
          >
            <Plus size={15} />
            <span>+ Add Shop</span>
          </button>
        }
      />

      {/* Active Complex Filter Context Banner */}
      {selectedComplexFilter && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            backgroundColor: 'rgba(218, 165, 32, 0.08)',
            border: '1px solid rgba(218, 165, 32, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 16px',
            marginBottom: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} color="var(--color-gold-light)" />
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Showing shops for complex:</span>
            <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              {activeComplexObj?.complexName || selectedComplexFilter}
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({selectedComplexFilter})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setCurrentPage('rental-complexes')}
              style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Return to Complexes list"
            >
              <ArrowLeft size={12} />
              <span>Back to Complexes</span>
            </button>

            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={clearComplexFilter}
              style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Clear complex filter to view all shops"
            >
              <X size={12} />
              <span>Clear Filter</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="input-control"
            placeholder="Search by shop no., name, tenant, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="select-control"
            style={{ width: '180px', height: '34px', fontSize: '12px' }}
            value={selectedComplexFilter}
            onChange={(e) => handleComplexFilterChange(e.target.value)}
          >
            <option value="">All Complexes</option>
            {complexes.map((c) => (
              <option key={c.complexId} value={c.complexId}>
                {c.complexName}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: '4px' }}>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st)}
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ padding: '18px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading shops...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Store size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            {selectedComplexFilter ? (
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  No shops found for this complex.
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {activeComplexObj
                    ? `No shops are currently registered under "${activeComplexObj.complexName}".`
                    : 'No shops found matching the selected complex.'}
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setEditingShop(null);
                      setIsShopModalOpen(true);
                    }}
                  >
                    <Plus size={14} />
                    <span>+ Add Shop</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={clearComplexFilter}
                  >
                    <span>View All Shops</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 14px 0', fontWeight: 600, fontSize: '13px' }}>
                  No shops found matching your criteria
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingShop(null);
                    setIsShopModalOpen(true);
                  }}
                >
                  <Plus size={14} />
                  <span>+ Add Shop</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>SHOP NO.</th>
                  <th>COMPLEX</th>
                  <th>BUSINESS / SHOP NAME</th>
                  <th>TENANT NAME</th>
                  <th>MOBILE</th>
                  <th style={{ textAlign: 'right' }}>MONTHLY RENT</th>
                  <th style={{ textAlign: 'right' }}>AVAIL. ADVANCE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((shop) => (
                  <tr key={shop.shopId}>
                    <td style={{ fontWeight: 800, color: 'var(--color-gold-light)' }}>
                      {shop.shopNumber}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{shop.complexName}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{shop.shopName}</td>
                    <td>{shop.tenantName}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        <Phone size={11} />
                        {shop.mobileNumber}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#176B52' }}>
                      ₹{shop.monthlyRent.toLocaleString('en-IN')}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: shop.availableAdvance > 0 ? 700 : 400,
                        color: shop.availableAdvance > 0 ? '#2563eb' : 'var(--text-muted)'
                      }}
                    >
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
                            shop.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: shop.status === 'ACTIVE' ? '#16a34a' : '#dc2626'
                        }}
                      >
                        {shop.status}
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
                          title="Record Rent Payment"
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
                          title="View Payment History"
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

                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{
                            padding: '2px 6px',
                            color: shop.status === 'ACTIVE' ? '#dc2626' : '#16a34a'
                          }}
                          onClick={() => handleToggleStatus(shop)}
                          title={shop.status === 'ACTIVE' ? 'Deactivate Shop' : 'Activate Shop'}
                        >
                          {shop.status === 'ACTIVE' ? <Ban size={11} /> : <CheckCircle2 size={11} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
        complexes={complexes}
        shopToEdit={editingShop}
        defaultComplexId={selectedComplexFilter}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setTargetShopIdForPayment(undefined);
        }}
        onSuccess={fetchShops}
        complexes={complexes}
        shops={shops}
        defaultShopId={targetShopIdForPayment}
      />
    </div>
  );
};
