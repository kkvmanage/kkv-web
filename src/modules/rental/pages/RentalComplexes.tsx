import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, Edit2, CheckCircle2, Ban, ArrowRight, Trash2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { isAdminRole } from '../../../config/permissions';
import { rentalApi } from '../services/rentalApi';
import { RentalComplex, RentalShop, RentalStatus } from '../types/rental.types';
import { RentalHeader } from '../components/RentalHeader';
import { ComplexModal } from '../components/ComplexModal';
import { SafeDeleteModal } from '../components/SafeDeleteModal';

interface RentalComplexesProps {
  onSelectComplex?: (complexId: string) => void;
  onManageShops?: (complexId: string) => void;
}

export const RentalComplexes: React.FC<RentalComplexesProps> = ({ onSelectComplex, onManageShops }) => {
  const { setCurrentPage, showToast, userRole, currentUser } = useApp();
  const isAdmin = userRole === 'ADMIN' || currentUser?.role === 'ADMIN' || (userRole ? isAdminRole(userRole) : false);

  const [complexes, setComplexes] = useState<RentalComplex[]>([]);
  const [shops, setShops] = useState<RentalShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RentalStatus>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComplex, setEditingComplex] = useState<RentalComplex | null>(null);
  const [complexToDelete, setComplexToDelete] = useState<RentalComplex | null>(null);

  const fetchComplexes = async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        rentalApi.getComplexes(),
        rentalApi.getShops()
      ]);
      if (cRes.success && cRes.data) setComplexes(cRes.data);
      if (sRes.success && sRes.data) setShops(sRes.data);
    } catch (err) {
      console.error('Error fetching complexes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplexes();
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      fetchComplexes();
    };
    window.addEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
    window.addEventListener('kkv_rental_data_changed', handleRefresh);
    return () => {
      window.removeEventListener('SYSTEM_RESTORE_COMPLETED', handleRefresh);
      window.removeEventListener('kkv_rental_data_changed', handleRefresh);
    };
  }, []);

  const handleManageShops = (complexId: string) => {
    (window as any).__selectedRentalComplexId = complexId;
    try {
      sessionStorage.setItem('kkv_selected_rental_complex_id', complexId);
    } catch (e) {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('complexId', complexId);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}

    if (onManageShops) {
      onManageShops(complexId);
    } else {
      setCurrentPage('rental-shops');
    }
  };

  const handleSelectComplex = (complexId: string) => {
    (window as any).__selectedRentalComplexId = complexId;
    try {
      sessionStorage.setItem('kkv_selected_rental_complex_id', complexId);
    } catch (e) {}
    if (onSelectComplex) {
      onSelectComplex(complexId);
    } else {
      setCurrentPage('rental-complex-detail');
    }
  };

  useEffect(() => {
    fetchComplexes();
  }, []);

  const handleSaveComplex = async (data: { complexName: string; location: string; status: RentalStatus }) => {
    if (editingComplex) {
      const res = await rentalApi.updateComplex(editingComplex.complexId, data);
      if (res.success) {
        showToast(res.message || 'Complex updated successfully', 'success');
        await fetchComplexes();
      } else {
        throw new Error(res.message || 'Failed to update complex');
      }
    } else {
      const res = await rentalApi.createComplex(data);
      if (res.success) {
        showToast(res.message || 'Complex created successfully', 'success');
        await fetchComplexes();
      } else {
        throw new Error(res.message || 'Failed to create complex');
      }
    }
  };

  const handleToggleStatus = async (complex: RentalComplex) => {
    const newStatus: RentalStatus = complex.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await rentalApi.updateComplex(complex.complexId, { status: newStatus });
      if (res.success) {
        showToast(`Complex ${complex.complexName} marked as ${newStatus}`, 'success');
        await fetchComplexes();
      } else {
        showToast(res.message || 'Status update failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error updating status', 'error');
    }
  };

  const filtered = complexes.filter((c) => {
    const matchesSearch =
      c.complexName.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase()) ||
      c.complexId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-content">
      <RentalHeader
        title="Commercial Complexes"
        subtitle="Manage all real estate complexes and physical shopping centers"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingComplex(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={15} />
            <span>+ Add Complex</span>
          </button>
        }
      />

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="input-control"
            placeholder="Search by complex name, location, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(st)}
              style={{ padding: '4px 12px', fontSize: '11px' }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Complexes Cards Grid */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading complexes...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Building2 size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>No complexes found</p>
          <p style={{ fontSize: '12px', margin: '4px 0 16px 0' }}>
            {search ? 'Try adjusting your search query' : 'Get started by creating your first commercial complex'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ margin: '0 auto' }}
            onClick={() => {
              setEditingComplex(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={14} />
            <span>Create Complex</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filtered.map((complex) => {
            const complexShops = shops.filter((s) => s.complexId === complex.complexId);
            const activeShops = complexShops.filter((s) => s.status === 'ACTIVE');
            const totalRent = activeShops.reduce((sum, s) => sum + s.monthlyRent, 0);

            return (
              <div
                key={complex.complexId}
                className="card"
                style={{
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  borderColor: complex.status === 'ACTIVE' ? 'var(--border-subtle)' : 'rgba(239, 68, 68, 0.2)',
                  opacity: complex.status === 'ACTIVE' ? 1 : 0.8
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: 'var(--color-gold)',
                          letterSpacing: '0.5px',
                          display: 'block'
                        }}
                      >
                        {complex.complexId}
                      </span>
                      <h3
                        style={{ fontSize: '16px', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--text-primary)', cursor: 'pointer' }}
                        onClick={() => handleSelectComplex(complex.complexId)}
                        title={`View ${complex.complexName} details`}
                      >
                        {complex.complexName}
                      </h3>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 700,
                        backgroundColor:
                          complex.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: complex.status === 'ACTIVE' ? '#16a34a' : '#dc2626'
                      }}
                    >
                      {complex.status}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                    📍 {complex.location}
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-surface-secondary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '11.5px'
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>TOTAL SHOPS</span>
                      <strong>{complexShops.length}</strong> ({activeShops.length} Active)
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>MONTHLY RENT</span>
                      <strong style={{ color: 'var(--text-brand, #176B52)' }}>₹{totalRent.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => {
                        setEditingComplex(complex);
                        setIsModalOpen(true);
                      }}
                      title="Edit Complex"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        color: complex.status === 'ACTIVE' ? '#dc2626' : '#16a34a'
                      }}
                      onClick={() => handleToggleStatus(complex)}
                      title={complex.status === 'ACTIVE' ? 'Deactivate Complex' : 'Activate Complex'}
                    >
                      {complex.status === 'ACTIVE' ? <Ban size={12} /> : <CheckCircle2 size={12} />}
                      <span>{complex.status === 'ACTIVE' ? 'Disable' : 'Enable'}</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          color: '#ef4444'
                        }}
                        onClick={() => setComplexToDelete(complex)}
                        title="Delete Complex (Only allowed if no shops or financial history exist)"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    style={{ padding: '4px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => handleManageShops(complex.complexId)}
                    title={`Manage shops and tenants for ${complex.complexName}`}
                  >
                    <span>Manage Shops</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create Modal */}
      <ComplexModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveComplex}
        complexToEdit={editingComplex}
      />

      {/* Safe Delete Modal */}
      {complexToDelete && (
        <SafeDeleteModal
          isOpen={!!complexToDelete}
          onClose={() => setComplexToDelete(null)}
          entityType="COMPLEX"
          entityId={complexToDelete.complexId}
          entityName={complexToDelete.complexName}
          subtitle={`Location: ${complexToDelete.location}`}
          onDeleted={() => {
            showToast(`Complex ${complexToDelete.complexName} permanently deleted`, 'success');
            fetchComplexes();
          }}
          onDisableComplex={async () => {
            await handleToggleStatus(complexToDelete);
          }}
        />
      )}
    </div>
  );
};
