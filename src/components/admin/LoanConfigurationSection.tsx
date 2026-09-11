import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { LoanTypeConfig, RepaymentSystemConfig, CalculationStrategy } from '../../types';
import {
  Plus,
  Edit2,
  CheckCircle2,
  Ban,
  AlertTriangle,
  Info,
  Layers,
  Calculator,
  X,
  Search,
  CreditCard,
  Percent,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';

export const formatInterestProfileLabel = (id?: string): string => {
  switch (id) {
    case 'gold-bands':
      return 'Gold Amount Bands';
    case 'silver-bands':
      return 'Silver Amount Bands';
    case 'pronote-interest':
      return 'Pronote Interest';
    case 'fixed-rate':
      return 'Fixed Rate';
    default:
      return id ? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Standard Rate';
  }
};

export const LoanConfigurationSection: React.FC = () => {
  const {
    masterControlSettings,
    addLoanType,
    updateLoanType,
    toggleLoanTypeStatus,
    toggleLoanTypeVisibility,
    deleteLoanType,
    addRepaymentSystem,
    updateRepaymentSystem,
    toggleRepaymentSystemStatus,
    userRole
  } = useApp();

  const isAuthorized = userRole === 'ADMIN';

  const loanTypes = masterControlSettings?.loanTypes || [];
  const repaymentSystems = masterControlSettings?.repaymentSystems || [];

  // Loan Type Search & Filter States
  const [loanTypeSearch, setLoanTypeSearch] = useState('');
  const [loanTypeFilter, setLoanTypeFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Loan Type Modal States
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<LoanTypeConfig | null>(null);
  const [disablingType, setDisablingType] = useState<LoanTypeConfig | null>(null);
  const [deletingType, setDeletingType] = useState<LoanTypeConfig | null>(null);

  // Loan Type Form Fields
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [typeActive, setTypeActive] = useState(true);
  const [typeShowOnIssue, setTypeShowOnIssue] = useState(true);
  const [typeCardFeeEnabled, setTypeCardFeeEnabled] = useState(true);
  const [typeCardFeeAmount, setTypeCardFeeAmount] = useState<number | ''>(50);
  const [typeInterestProfile, setTypeInterestProfile] = useState<'gold-bands' | 'silver-bands' | 'pronote-interest' | 'fixed-rate'>('gold-bands');
  const [typeDefaultMonthlyRate, setTypeDefaultMonthlyRate] = useState<number | ''>(2.0);
  const [typeRepaymentSystemId, setTypeRepaymentSystemId] = useState<string>('monthly-interest-only');

  // Repayment System Modal States
  const [isAddRepaymentModalOpen, setIsAddRepaymentModalOpen] = useState(false);
  const [editingRepayment, setEditingRepayment] = useState<RepaymentSystemConfig | null>(null);
  const [disablingRepayment, setDisablingRepayment] = useState<RepaymentSystemConfig | null>(null);
  const [repaymentName, setRepaymentName] = useState('');
  const [repaymentDescription, setRepaymentDescription] = useState('');
  const [repaymentStrategy, setRepaymentStrategy] = useState<CalculationStrategy>('MONTHLY_INTEREST_ONLY');
  const [repaymentActive, setRepaymentActive] = useState(true);

  // Form Error states
  const [formError, setFormError] = useState('');

  // ── Filtered Loan Types ────────────────────────────────────────────────────
  const filteredLoanTypes = useMemo(() => {
    return loanTypes.filter((t) => {
      // Status filter
      if (loanTypeFilter === 'ACTIVE' && !t.active) return false;
      if (loanTypeFilter === 'DISABLED' && t.active) return false;

      // Search query
      if (loanTypeSearch.trim()) {
        const q = loanTypeSearch.toLowerCase().trim();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesDesc = (t.description || '').toLowerCase().includes(q);
        const matchesId = t.id.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesId) return false;
      }

      return true;
    });
  }, [loanTypes, loanTypeFilter, loanTypeSearch]);

  const activeCount = useMemo(() => loanTypes.filter((t) => t.active).length, [loanTypes]);
  const disabledCount = useMemo(() => loanTypes.filter((t) => !t.active).length, [loanTypes]);

  // ── Loan Type Handlers ──────────────────────────────────────────────────────
  const handleOpenAddType = () => {
    setTypeName('');
    setTypeDescription('');
    setTypeActive(true);
    setTypeShowOnIssue(true);
    setTypeCardFeeEnabled(true);
    setTypeCardFeeAmount(50);
    setTypeInterestProfile('gold-bands');
    setTypeDefaultMonthlyRate(2.0);
    setTypeRepaymentSystemId(repaymentSystems[0]?.id || 'monthly-interest-only');
    setFormError('');
    setIsAddTypeModalOpen(true);
  };

  const handleOpenEditType = (item: LoanTypeConfig) => {
    setEditingType(item);
    setTypeName(item.name);
    setTypeDescription(item.description || '');
    setTypeActive(item.active);
    setTypeShowOnIssue(item.showOnLoanIssue ?? true);
    setTypeCardFeeEnabled(item.cardFeeEnabled ?? true);
    setTypeCardFeeAmount(item.cardFee ?? 50);
    setTypeInterestProfile((item.interestProfileId as any) || 'gold-bands');
    setTypeDefaultMonthlyRate(item.defaultMonthlyRate ?? 2.0);
    setTypeRepaymentSystemId(item.repaymentSystemId || repaymentSystems[0]?.id || 'monthly-interest-only');
    setFormError('');
  };

  const handleSaveType = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmed = typeName.trim();
    if (!trimmed) {
      setFormError('Loan type name is required.');
      return;
    }

    const rateNum = Number(typeDefaultMonthlyRate);
    if (!typeDefaultMonthlyRate || isNaN(rateNum) || rateNum <= 0) {
      setFormError('Default Rate % / Month is required and must be greater than 0.');
      return;
    }

    const selectedRepay = repaymentSystems.find((r) => r.id === typeRepaymentSystemId);
    const resolvedStrategy = selectedRepay?.calculationStrategy || 'MONTHLY_INTEREST_ONLY';

    if (editingType) {
      const res = updateLoanType(editingType.id, {
        name: trimmed,
        description: typeDescription,
        active: typeActive,
        showOnLoanIssue: typeShowOnIssue,
        useMasterDefaults: false,
        cardFeeEnabled: typeCardFeeEnabled,
        cardFee: Number(typeCardFeeAmount) || 0,
        interestProfileId: typeInterestProfile,
        defaultMonthlyRate: rateNum,
        repaymentSystemId: typeRepaymentSystemId,
        calculationStrategy: resolvedStrategy
      });
      if (res.success) {
        setEditingType(null);
      } else {
        setFormError(res.message || 'Failed to update loan type.');
      }
    } else {
      const res = addLoanType({
        name: trimmed,
        description: typeDescription,
        active: typeActive,
        showOnLoanIssue: typeShowOnIssue,
        useMasterDefaults: false,
        cardFeeEnabled: typeCardFeeEnabled,
        cardFee: Number(typeCardFeeAmount) || 0,
        interestProfileId: typeInterestProfile,
        defaultMonthlyRate: rateNum,
        repaymentSystemId: typeRepaymentSystemId,
        calculationStrategy: resolvedStrategy
      });
      if (res.success) {
        setIsAddTypeModalOpen(false);
      } else {
        setFormError(res.message || 'Failed to add loan type.');
      }
    }
  };

  const handleConfirmToggleType = () => {
    if (!disablingType) return;
    toggleLoanTypeStatus(disablingType.id);
    setDisablingType(null);
  };

  const handleConfirmDeleteType = () => {
    if (!deletingType) return;
    const res = deleteLoanType(deletingType.id);
    if (res.success) {
      setDeletingType(null);
    } else {
      setFormError(res.message || 'Cannot delete this loan type.');
    }
  };

  // ── Repayment System Handlers ────────────────────────────────────────────────
  const handleOpenAddRepayment = () => {
    setRepaymentName('');
    setRepaymentDescription('');
    setRepaymentStrategy('MONTHLY_INTEREST_ONLY');
    setRepaymentActive(true);
    setFormError('');
    setIsAddRepaymentModalOpen(true);
  };

  const handleOpenEditRepayment = (item: RepaymentSystemConfig) => {
    setEditingRepayment(item);
    setRepaymentName(item.name);
    setRepaymentDescription(item.description || '');
    setRepaymentStrategy(item.calculationStrategy);
    setRepaymentActive(item.active);
    setFormError('');
  };

  const handleSaveRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (editingRepayment) {
      const res = updateRepaymentSystem(editingRepayment.id, {
        name: repaymentName,
        description: repaymentDescription,
        calculationStrategy: repaymentStrategy,
        active: repaymentActive
      });
      if (res.success) {
        setEditingRepayment(null);
      } else {
        setFormError(res.message || 'Failed to update repayment system.');
      }
    } else {
      const res = addRepaymentSystem({
        name: repaymentName,
        description: repaymentDescription,
        calculationStrategy: repaymentStrategy,
        active: repaymentActive
      });
      if (res.success) {
        setIsAddRepaymentModalOpen(false);
      } else {
        setFormError(res.message || 'Failed to add repayment system.');
      }
    }
  };

  const handleConfirmToggleRepayment = () => {
    if (!disablingRepayment) return;
    toggleRepaymentSystemStatus(disablingRepayment.id);
    setDisablingRepayment(null);
  };

  const formatStrategyLabel = (strategy: CalculationStrategy) => {
    switch (strategy) {
      case 'MONTHLY_INTEREST_ONLY':
        return 'Monthly Interest Only (Principal at maturity)';
      case 'EMI':
        return 'EMI (Equated Principal + Interest)';
      case 'BULLET':
        return 'Bullet Repayment (Principal + Interest at maturity)';
      default:
        return strategy;
    }
  };

  const formatInterestProfileLabel = (profileId?: string) => {
    switch (profileId) {
      case 'silver-bands':
        return 'Silver Monthly Interest Bands';
      case 'fixed-rate':
        return 'Fixed Monthly Rate (%/mo)';
      case 'gold-bands':
      default:
        return 'Gold Monthly Interest Bands';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Informational Callout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'var(--bg-surface-secondary, rgba(16, 185, 129, 0.08))',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 'var(--radius-md, 8px)',
          padding: '14px 18px'
        }}
      >
        <Info size={20} color="var(--color-primary-dark, #059669)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '13px', color: 'var(--text-dark, #1e293b)' }}>
          <strong>Single Source of Truth:</strong> Changes to loan types, card processing fees, interest profiles, and visibility apply dynamically to <strong>NEW loans in Loan Issue</strong>.
          Existing loans permanently preserve their contractual snapshot and calculation terms.
        </div>
      </div>

      {/* ── SECTION 1: DYNAMIC LOAN TYPES MANAGEMENT ── */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-light, #e2e8f0)',
            paddingBottom: '12px',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} color="var(--color-primary-dark, #059669)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
                LOAN TYPES
              </h3>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
                Configure loan products, pricing policies, card processing fees, and Loan Issue visibility
              </span>
            </div>
          </div>

          {isAuthorized && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleOpenAddType}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}
            >
              <Plus size={15} /> + Add Loan Type
            </button>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-xs ${loanTypeFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}
              onClick={() => setLoanTypeFilter('ALL')}
            >
              All ({loanTypes.length})
            </button>
            <button
              type="button"
              className={`btn btn-xs ${loanTypeFilter === 'ACTIVE' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}
              onClick={() => setLoanTypeFilter('ACTIVE')}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              className={`btn btn-xs ${loanTypeFilter === 'DISABLED' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}
              onClick={() => setLoanTypeFilter('DISABLED')}
            >
              Disabled ({disabledCount})
            </button>
          </div>

          <div style={{ position: 'relative', width: '260px' }}>
            <input
              type="text"
              className="input-control"
              placeholder="Search loan types..."
              value={loanTypeSearch}
              onChange={(e) => setLoanTypeSearch(e.target.value)}
              style={{ height: '32px', fontSize: '11.5px', paddingLeft: '30px' }}
            />
            <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {filteredLoanTypes.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: '8px', border: '1px dashed var(--border-light)' }}>
            No loan types found matching your filter criteria.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredLoanTypes.map((item) => {
              const repay = repaymentSystems.find((r) => r.id === item.repaymentSystemId);
              return (
                <div
                  key={item.id}
                  style={{
                    border: `1.5px solid ${item.active ? 'var(--border-light, #e2e8f0)' : '#fca5a5'}`,
                    backgroundColor: item.active ? 'var(--bg-surface, #ffffff)' : '#fff5f5',
                    borderRadius: 'var(--radius-md, 10px)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    {/* Header: Title and Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
                          {item.name}
                        </h4>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #94a3b8)', fontFamily: 'monospace' }}>
                          ID: {item.id}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: item.active ? '#dcfce7' : '#fee2e2',
                            color: item.active ? '#15803d' : '#b91c1c'
                          }}
                        >
                          {item.active ? 'ACTIVE' : 'DISABLED'}
                        </span>

                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: item.showOnLoanIssue !== false ? '#f1f5f9' : '#f1f5f9',
                            color: item.showOnLoanIssue !== false ? '#334155' : '#94a3b8'
                          }}
                        >
                          {item.showOnLoanIssue !== false ? 'ISSUE: ON' : 'ISSUE: OFF'}
                        </span>
                      </div>
                    </div>

                    {item.description && (
                      <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted, #64748b)', lineHeight: '1.45' }}>
                        {item.description}
                      </p>
                    )}

                    {/* Product Policy Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                      {/* Card Fee Badge */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: item.cardFeeEnabled !== false ? 'rgba(5, 150, 105, 0.08)' : '#f1f5f9',
                          color: item.cardFeeEnabled !== false ? '#065f46' : '#64748b',
                          border: `1px solid ${item.cardFeeEnabled !== false ? 'rgba(5, 150, 105, 0.2)' : '#e2e8f0'}`,
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        <CreditCard size={13} />
                        <span>Card Fee: {item.cardFeeEnabled !== false ? `₹${item.cardFee ?? 50}` : 'OFF'}</span>
                      </div>

                      {/* Interest Rate Badge */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          color: '#1d4ed8',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        <Percent size={13} />
                        <span>Interest: {item.defaultMonthlyRate ?? 2}% / Month</span>
                      </div>

                      {/* Interest Profile Badge */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#f8fafc',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        <Layers size={13} />
                        <span>Profile: {formatInterestProfileLabel(item.interestProfileId)}</span>
                      </div>

                      {/* Repayment System */}
                      {repay && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: '#faf5ff',
                            color: '#7e22ce',
                            border: '1px solid #e9d5ff',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          <Calculator size={13} />
                          <span>Repayment: {repay.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Version & Last Updated info */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: 'var(--text-muted, #64748b)', borderTop: '1px dashed var(--border-light, #f1f5f9)', paddingTop: '6px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary-dark, #059669)' }}>
                        Config Version: V{item.configurationVersion || 1}
                      </span>
                      <span>
                        Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-GB') : 'Initial'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  {isAuthorized && (
                    <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border-light, #f1f5f9)', paddingTop: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-xs btn-secondary"
                        onClick={() => handleOpenEditType(item)}
                        style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontSize: '11px', height: '28px' }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>

                      <button
                        type="button"
                        className={`btn btn-xs ${item.showOnLoanIssue !== false ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => toggleLoanTypeVisibility(item.id)}
                        style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontSize: '11px', height: '28px' }}
                        title={item.showOnLoanIssue !== false ? 'Hide from Loan Issue dropdown' : 'Show on Loan Issue dropdown'}
                      >
                        {item.showOnLoanIssue !== false ? <EyeOff size={12} /> : <Eye size={12} />}
                        {item.showOnLoanIssue !== false ? 'Hide' : 'Show'}
                      </button>

                      <button
                        type="button"
                        className={`btn btn-xs ${item.active ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => {
                          if (item.active) {
                            setDisablingType(item);
                          } else {
                            toggleLoanTypeStatus(item.id);
                          }
                        }}
                        style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontSize: '11px', height: '28px' }}
                      >
                        {item.active ? <Ban size={12} /> : <CheckCircle2 size={12} />}
                        {item.active ? 'Disable' : 'Enable'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-xs btn-secondary"
                        onClick={() => setDeletingType(item)}
                        style={{ color: '#dc2626', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '0 6px', height: '28px' }}
                        title="Delete Loan Type (Allowed only if completely unused)"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 2: REPAYMENT SYSTEMS ── */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-light, #e2e8f0)',
            paddingBottom: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={18} color="var(--color-primary-dark, #059669)" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
              REPAYMENT SYSTEMS
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-surface-subtle, #f1f5f9)',
                color: 'var(--text-muted, #64748b)'
              }}
            >
              {repaymentSystems.length} configured
            </span>
          </div>

          {isAuthorized && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleOpenAddRepayment}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}
            >
              <Plus size={14} /> Add Repayment System
            </button>
          )}
        </div>

        {repaymentSystems.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No repayment systems configured.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
            {repaymentSystems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: `1px solid ${item.active ? 'var(--border-light, #e2e8f0)' : '#fca5a5'}`,
                  backgroundColor: item.active ? 'var(--bg-surface, #ffffff)' : '#fff5f5',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
                      {item.name}
                    </h4>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: item.active ? '#dcfce7' : '#fee2e2',
                        color: item.active ? '#15803d' : '#b91c1c'
                      }}
                    >
                      {item.active ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        display: 'inline-block'
                      }}
                    >
                      Strategy: {item.calculationStrategy}
                    </span>
                  </div>

                  {item.description && (
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted, #64748b)', lineHeight: '1.4' }}>
                      {item.description}
                    </p>
                  )}

                  <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted, #94a3b8)', fontFamily: 'monospace' }}>
                    ID: {item.id}
                  </div>
                </div>

                {isAuthorized && (
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-light, #f1f5f9)', paddingTop: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-xs btn-secondary"
                      onClick={() => handleOpenEditRepayment(item)}
                      style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${item.active ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => {
                        if (item.active) {
                          setDisablingRepayment(item);
                        } else {
                          toggleRepaymentSystemStatus(item.id);
                        }
                      }}
                      style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                    >
                      {item.active ? <Ban size={12} /> : <CheckCircle2 size={12} />}
                      {item.active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL: ADD / EDIT LOAN TYPE ── */}
      {(isAddTypeModalOpen || editingType) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 12px)',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.15))'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="var(--color-primary-dark, #059669)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
                  {editingType ? 'EDIT LOAN TYPE' : 'ADD NEW LOAN TYPE'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddTypeModalOpen(false);
                  setEditingType(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {editingType && (
              <div
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  color: '#854d0e',
                  lineHeight: '1.45'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong>⚠️ Configuration Change Notice:</strong>
                  <span style={{ fontWeight: 800 }}>Current Version: V{editingType.configurationVersion || 1}</span>
                </div>
                Changes will apply to NEW loans. Existing loans will retain their saved contractual configuration.
              </div>
            )}

            {formError && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  color: '#991b1b',
                  fontWeight: 600
                }}
              >
                ⚠ {formError}
              </div>
            )}

            <form onSubmit={handleSaveType} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Name */}
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  LOAN TYPE NAME <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Vehicle Gold Loan"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  maxLength={60}
                  autoFocus
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  DESCRIPTION
                </label>
                <textarea
                  className="input-control"
                  placeholder="Gold-backed vehicle finance product..."
                  rows={2}
                  value={typeDescription}
                  onChange={(e) => setTypeDescription(e.target.value)}
                  maxLength={200}
                />
              </div>

              {/* Status and Visibility in 2 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                    SHOW ON LOAN ISSUE
                  </label>
                  <select
                    className="input-control"
                    value={typeShowOnIssue ? 'ON' : 'OFF'}
                    onChange={(e) => setTypeShowOnIssue(e.target.value === 'ON')}
                  >
                    <option value="ON">ON (Visible in Dropdown)</option>
                    <option value="OFF">OFF (Hidden from Dropdown)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                    STATUS
                  </label>
                  <select
                    className="input-control"
                    value={typeActive ? 'ACTIVE' : 'DISABLED'}
                    onChange={(e) => setTypeActive(e.target.value === 'ACTIVE')}
                  >
                    <option value="ACTIVE">ACTIVE (Enabled)</option>
                    <option value="DISABLED">DISABLED (Archived)</option>
                  </select>
                </div>
              </div>

              {/* Card Processing Fee Configuration */}
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-light, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--color-primary-dark, #059669)', textTransform: 'uppercase' }}>
                  💳 Card Processing Fee Policy
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>CARD FEE ENABLED</label>
                    <select
                      className="input-control"
                      value={typeCardFeeEnabled ? 'ON' : 'OFF'}
                      onChange={(e) => setTypeCardFeeEnabled(e.target.value === 'ON')}
                    >
                      <option value="ON">ON (Charge card fee)</option>
                      <option value="OFF">OFF (No card fee)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>CARD FEE AMOUNT (₹)</label>
                    <input
                      type="number"
                      step="any"
                      className="input-control"
                      value={typeCardFeeAmount}
                      disabled={!typeCardFeeEnabled}
                      onChange={(e) => setTypeCardFeeAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 50"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Interest Profile & Repayment System */}
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-light, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--color-primary-dark, #059669)', textTransform: 'uppercase' }}>
                  📊 Interest Calculation &amp; Repayment Strategy
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>INTEREST PROFILE *</label>
                    <select
                      className="input-control"
                      value={typeInterestProfile}
                      onChange={(e) => setTypeInterestProfile(e.target.value as any)}
                    >
                      <option value="gold-bands">Gold Amount Bands</option>
                      <option value="silver-bands">Silver Amount Bands</option>
                      <option value="pronote-interest">Pronote Interest</option>
                      <option value="fixed-rate">Fixed Monthly Rate (%/mo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>DEFAULT RATE % / MONTH *</label>
                    <input
                      type="number"
                      step="any"
                      className="input-control"
                      value={typeDefaultMonthlyRate}
                      onChange={(e) => setTypeDefaultMonthlyRate(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="2.0"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>REPAYMENT SYSTEM *</label>
                  <select
                    className="input-control"
                    value={typeRepaymentSystemId}
                    onChange={(e) => setTypeRepaymentSystemId(e.target.value)}
                  >
                    {repaymentSystems.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.calculationStrategy})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsAddTypeModalOpen(false);
                    setEditingType(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingType ? 'Save Changes' : 'Save Loan Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT REPAYMENT SYSTEM ── */}
      {(isAddRepaymentModalOpen || editingRepayment) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 12px)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.1))'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
                {editingRepayment ? 'EDIT REPAYMENT SYSTEM' : 'ADD REPAYMENT SYSTEM'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddRepaymentModalOpen(false);
                  setEditingRepayment(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  color: '#991b1b',
                  fontWeight: 600
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveRepayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  System Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Standard EMI (Monthly)"
                  value={repaymentName}
                  onChange={(e) => setRepaymentName(e.target.value)}
                  maxLength={60}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Interest Calculation Strategy <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="input-control"
                  value={repaymentStrategy}
                  onChange={(e) => setRepaymentStrategy(e.target.value as CalculationStrategy)}
                  required
                >
                  <option value="MONTHLY_INTEREST_ONLY">Monthly Interest Only (Principal due on closure)</option>
                  <option value="EMI">EMI (Equated Monthly Installment)</option>
                  <option value="BULLET">Bullet Repayment (Full Principal + Accrued Interest at maturity)</option>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '4px', display: 'block' }}>
                  {formatStrategyLabel(repaymentStrategy)}
                </span>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Description (Optional)
                </label>
                <textarea
                  className="input-control"
                  placeholder="Describe repayment frequency, terms..."
                  rows={2}
                  value={repaymentDescription}
                  onChange={(e) => setRepaymentDescription(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Status
                </label>
                <select
                  className="input-control"
                  value={repaymentActive ? 'ACTIVE' : 'DISABLED'}
                  onChange={(e) => setRepaymentActive(e.target.value === 'ACTIVE')}
                >
                  <option value="ACTIVE">ACTIVE (Available for new loans)</option>
                  <option value="DISABLED">DISABLED (Hidden from new loans)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsAddRepaymentModalOpen(false);
                    setEditingRepayment(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRepayment ? 'Save Changes' : 'Save Repayment System'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM DISABLE LOAN TYPE ── */}
      {disablingType && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 12px)',
              width: '100%',
              maxWidth: '430px',
              padding: '24px',
              boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.15))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={18} color="#dc2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#991b1b' }}>
                DISABLE LOAN TYPE?
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-dark, #334155)', lineHeight: '1.5', margin: '0 0 16px' }}>
              Are you sure you want to disable <strong>"{disablingType.name}"</strong>?
              <br /><br />
              Existing loans using this type will <strong>not be changed</strong> and will continue to display normally.
              The type will only be hidden for future loan creations in Loan Issue.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDisablingType(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmToggleType}
              >
                Disable Loan Type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM DELETE LOAN TYPE ── */}
      {deletingType && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 12px)',
              width: '100%',
              maxWidth: '430px',
              padding: '24px',
              boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.15))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Trash2 size={18} color="#dc2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#991b1b' }}>
                DELETE LOAN TYPE?
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-dark, #334155)', lineHeight: '1.5', margin: '0 0 16px' }}>
              Are you sure you want to permanently delete <strong>"{deletingType.name}"</strong>?
              <br /><br />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Note: Deletion is only allowed if no historical loan records reference this type. Otherwise, please use <strong>Disable</strong>.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingType(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteType}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM DISABLE REPAYMENT SYSTEM ── */}
      {disablingRepayment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 12px)',
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.1))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={18} color="#dc2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#991b1b' }}>
                DISABLE REPAYMENT SYSTEM?
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-dark, #334155)', lineHeight: '1.5', margin: '0 0 16px' }}>
              Are you sure you want to disable <strong>"{disablingRepayment.name}"</strong>?
              <br /><br />
              Existing loans will continue using their contractual calculation strategy (<strong>{disablingRepayment.calculationStrategy}</strong>). Only new loans will be prevented from selecting this repayment system.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDisablingRepayment(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmToggleRepayment}
              >
                Disable Repayment System
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
