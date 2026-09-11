import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TrendingUp,
  Clock,
  Info,
  RotateCcw,
  Save,
  Lock,
  History,
  Percent,
  Sliders
} from 'lucide-react';

export const FDConfigurationSection: React.FC = () => {
  const {
    masterControlSettings,
    updateMasterControlSettings,
    userRole,
    showToast
  } = useApp();

  const isAuthorized = userRole === 'ADMIN';

  // Form State initialized from Master Control Settings
  const [interestRate, setInterestRate] = useState<number | ''>(masterControlSettings?.fdInterestRate ?? 12);
  const [effectiveFromDate, setEffectiveFromDate] = useState<string>(
    masterControlSettings?.fdInterestRateEffectiveFrom || new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
  );
  const [defaultTenure, setDefaultTenure] = useState<number | ''>(masterControlSettings?.fdDefaultTenureMonths ?? 12);
  const [allowedTenures, setAllowedTenures] = useState<number[]>(
    masterControlSettings?.fdAllowedTenures ?? [6, 12, 24, 36, 60]
  );
  const [minAmount, setMinAmount] = useState<number | ''>(masterControlSettings?.fdMinimumAmount ?? 5000);
  const [maxAmount, setMaxAmount] = useState<number | ''>(masterControlSettings?.fdMaximumAmount ?? 10000000);
  const [payoutFrequency, setPayoutFrequency] = useState<string>(
    masterControlSettings?.fdPayoutFrequency || 'Monthly'
  );
  const [calculationMethod, setCalculationMethod] = useState<string>(
    masterControlSettings?.fdCalculationMethod || 'MONTHLY_DIVIDEND'
  );
  const [renewalPolicy, setRenewalPolicy] = useState<string>(
    masterControlSettings?.fdRenewalPolicy || 'MANUAL'
  );
  const [lockinPeriod, setLockinPeriod] = useState<number | ''>(
    masterControlSettings?.fdLockinPeriodMonths ?? 3
  );
  const [allowedReceivingMethods, setAllowedReceivingMethods] = useState<string[]>(
    masterControlSettings?.fdAllowedReceivingMethods ?? ['Cash', 'Bank', 'UPI']
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Sync state if masterControlSettings change from server
  useEffect(() => {
    if (masterControlSettings) {
      if (masterControlSettings.fdInterestRate !== undefined) setInterestRate(masterControlSettings.fdInterestRate);
      if (masterControlSettings.fdInterestRateEffectiveFrom) setEffectiveFromDate(masterControlSettings.fdInterestRateEffectiveFrom);
      if (masterControlSettings.fdDefaultTenureMonths !== undefined) setDefaultTenure(masterControlSettings.fdDefaultTenureMonths);
      if (masterControlSettings.fdAllowedTenures) setAllowedTenures(masterControlSettings.fdAllowedTenures);
      if (masterControlSettings.fdMinimumAmount !== undefined) setMinAmount(masterControlSettings.fdMinimumAmount);
      if (masterControlSettings.fdMaximumAmount !== undefined) setMaxAmount(masterControlSettings.fdMaximumAmount);
      if (masterControlSettings.fdPayoutFrequency) setPayoutFrequency(masterControlSettings.fdPayoutFrequency);
      if (masterControlSettings.fdCalculationMethod) setCalculationMethod(masterControlSettings.fdCalculationMethod);
      if (masterControlSettings.fdRenewalPolicy) setRenewalPolicy(masterControlSettings.fdRenewalPolicy);
      if (masterControlSettings.fdLockinPeriodMonths !== undefined) setLockinPeriod(masterControlSettings.fdLockinPeriodMonths);
      if (masterControlSettings.fdAllowedReceivingMethods) setAllowedReceivingMethods(masterControlSettings.fdAllowedReceivingMethods);
    }
  }, [masterControlSettings]);

  const handleResetToSaved = () => {
    if (masterControlSettings) {
      setInterestRate(masterControlSettings.fdInterestRate ?? 12);
      setEffectiveFromDate(masterControlSettings.fdInterestRateEffectiveFrom || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
      setDefaultTenure(masterControlSettings.fdDefaultTenureMonths ?? 12);
      setAllowedTenures(masterControlSettings.fdAllowedTenures ?? [6, 12, 24, 36, 60]);
      setMinAmount(masterControlSettings.fdMinimumAmount ?? 5000);
      setMaxAmount(masterControlSettings.fdMaximumAmount ?? 10000000);
      setPayoutFrequency(masterControlSettings.fdPayoutFrequency || 'Monthly');
      setCalculationMethod(masterControlSettings.fdCalculationMethod || 'MONTHLY_DIVIDEND');
      setRenewalPolicy(masterControlSettings.fdRenewalPolicy || 'MANUAL');
      setLockinPeriod(masterControlSettings.fdLockinPeriodMonths ?? 3);
      setAllowedReceivingMethods(masterControlSettings.fdAllowedReceivingMethods ?? ['Cash', 'Bank', 'UPI']);
      showToast('Form reset to saved master values.', 'info');
    }
  };

  const toggleTenureOption = (months: number) => {
    if (!isAuthorized) return;
    if (allowedTenures.includes(months)) {
      if (allowedTenures.length <= 1) {
        showToast('At least one tenure option must remain active.', 'error');
        return;
      }
      setAllowedTenures(allowedTenures.filter(m => m !== months));
    } else {
      setAllowedTenures([...allowedTenures, months].sort((a, b) => a - b));
    }
  };

  const toggleReceivingMethod = (method: string) => {
    if (!isAuthorized) return;
    if (allowedReceivingMethods.includes(method)) {
      if (allowedReceivingMethods.length <= 1) {
        showToast('At least one receiving payment method must remain active.', 'error');
        return;
      }
      setAllowedReceivingMethods(allowedReceivingMethods.filter(m => m !== method));
    } else {
      setAllowedReceivingMethods([...allowedReceivingMethods, method]);
    }
  };

  const handleSaveConfiguration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) {
      showToast('Permission Denied: Only Master Admin can modify Fixed Deposit Configuration.', 'error');
      return;
    }

    const numRate = interestRate === '' ? NaN : Number(interestRate);
    const numTenure = defaultTenure === '' ? NaN : Number(defaultTenure);
    const numMinAmount = minAmount === '' ? NaN : Number(minAmount);
    const numMaxAmount = maxAmount === '' ? NaN : Number(maxAmount);
    const numLockin = lockinPeriod === '' ? 0 : Number(lockinPeriod);

    if (isNaN(numRate) || numRate <= 0 || numRate > 100) {
      showToast('Please enter a valid interest rate between 0.1% and 100% per annum.', 'error');
      return;
    }

    if (isNaN(numTenure) || numTenure < 1) {
      showToast('Please enter a valid default tenure of at least 1 month.', 'error');
      return;
    }

    if (isNaN(numMinAmount) || numMinAmount < 0) {
      showToast('Minimum deposit amount cannot be negative.', 'error');
      return;
    }

    if (isNaN(numMaxAmount) || numMaxAmount < numMinAmount) {
      showToast('Maximum deposit amount cannot be less than minimum deposit amount.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      updateMasterControlSettings({
        fdInterestRate: numRate,
        fdInterestRateEffectiveFrom: effectiveFromDate,
        fdDefaultTenureMonths: numTenure,
        fdAllowedTenures: allowedTenures,
        fdMinimumAmount: numMinAmount,
        fdMaximumAmount: numMaxAmount,
        fdPayoutFrequency: payoutFrequency,
        fdCalculationMethod: calculationMethod,
        fdRenewalPolicy: renewalPolicy,
        fdLockinPeriodMonths: numLockin,
        fdAllowedReceivingMethods: allowedReceivingMethods
      });
    } finally {
      setIsSaving(false);
    }
  };

  const rateHistory = masterControlSettings?.fdInterestRateHistory || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          <strong>Single Source of Truth:</strong> Changes to Fixed Deposit interest rates, tenures, limits, and payout frequencies apply dynamically to <strong>NEW Fixed Deposits</strong>.
          Existing historical deposits permanently preserve their original contractual snapshot and terms.
        </div>
      </div>

      {!isAuthorized && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#be123c',
            fontSize: '12.5px',
            fontWeight: 600
          }}
        >
          <Lock size={16} />
          <span>Read-Only Mode: You are viewing FD Configuration as a Staff user. Only Master Admin can modify and save these parameters.</span>
        </div>
      )}

      <form onSubmit={handleSaveConfiguration} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ── SECTION 1: INTEREST RATE & RETURN POLICIES ── */}
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
              <TrendingUp size={20} color="var(--color-primary-dark, #059669)" />
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
                  FD INTEREST &amp; PRICING RULES
                </h3>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
                  Master annual return rate and effective dates for new Fixed Deposits
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setShowHistoryModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700 }}
            >
              <History size={14} /> View Rate Change History ({rateHistory.length})
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label required" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                  DEFAULT INTEREST RATE (% P.A.)
                </label>
                <span className="badge badge-success" style={{ fontSize: '10px' }}>
                  Current: {typeof interestRate === 'number' ? interestRate.toFixed(2) : (interestRate || 0)}% p.a.
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max="100"
                  className="input-control"
                  style={{ fontWeight: 800, fontSize: '15px', paddingRight: '36px' }}
                  value={interestRate}
                  disabled={!isAuthorized}
                  onChange={(e) => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <Percent
                  size={15}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Base rate applied to new deposits. Monthly dividend = (Principal × Rate) / 1200.
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                EFFECTIVE FROM DATE
              </label>
              <input
                type="text"
                className="input-control"
                value={effectiveFromDate}
                disabled={!isAuthorized}
                onChange={(e) => setEffectiveFromDate(e.target.value)}
                placeholder="DD-MM-YYYY"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Date from which this configuration takes effect for newly issued term contracts.
              </span>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: TENURE & DEPOSIT LIMITS ── */}
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
              <Clock size={18} color="var(--color-primary-dark, #059669)" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
                TENURE &amp; DEPOSIT PRINCIPAL BOUNDS
              </h3>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                DEFAULT TENURE (MONTHS)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                className="input-control"
                style={{ fontWeight: 700 }}
                value={defaultTenure}
                disabled={!isAuthorized}
                onChange={(e) => setDefaultTenure(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Pre-filled default duration on the Staff New Deposit creation page.
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                MINIMUM DEPOSIT AMOUNT (₹)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input-control"
                  style={{ fontWeight: 700, paddingLeft: '32px' }}
                  value={minAmount}
                  disabled={!isAuthorized}
                  onChange={(e) => setMinAmount(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 700,
                    color: 'var(--text-muted)'
                  }}
                >
                  ₹
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Minimum principal required to issue an FD contract (e.g. ₹5,000 or ₹10,000).
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                MAXIMUM DEPOSIT AMOUNT (₹)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min={minAmount || 0}
                  step="any"
                  className="input-control"
                  style={{ fontWeight: 700, paddingLeft: '32px' }}
                  value={maxAmount}
                  disabled={!isAuthorized}
                  onChange={(e) => setMaxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 700,
                    color: 'var(--text-muted)'
                  }}
                >
                  ₹
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Upper ceiling for single fixed deposit issuance (e.g. ₹1,00,00,000).
              </span>
            </div>
          </div>

          {/* Allowed Tenure Presets */}
          <div style={{ borderTop: '1px solid var(--border-light, #e2e8f0)', paddingTop: '14px', marginTop: '14px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              ALLOWED TENURE PRESETS (MONTHS)
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[6, 12, 18, 24, 36, 48, 60, 120].map((t) => {
                const isSelected = allowedTenures.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTenureOption(t)}
                    disabled={!isAuthorized}
                    className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      borderRadius: 'var(--radius-full)',
                      padding: '5px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: isAuthorized ? 'pointer' : 'default'
                    }}
                  >
                    {isSelected ? '✓ ' : ''}{t} Months ({t / 12 >= 1 ? `${t / 12} Yr${t / 12 > 1 ? 's' : ''}` : `${t} Mo`})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── SECTION 3: PAYOUT FREQUENCY & CALCULATION STRATEGY ── */}
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
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              borderBottom: '1px solid var(--border-light, #e2e8f0)',
              paddingBottom: '12px'
            }}
          >
            <Sliders size={20} color="var(--color-primary-dark, #059669)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
                PAYOUT FREQUENCY &amp; CALCULATION RULES
              </h3>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
                Define interest payout schedules, calculation formulas, and auto-renewal mechanisms
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                DEFAULT PAYOUT FREQUENCY
              </label>
              <select
                className="input-control"
                value={payoutFrequency}
                disabled={!isAuthorized}
                onChange={(e) => setPayoutFrequency(e.target.value)}
                style={{ height: '38px', fontSize: '12.5px' }}
              >
                <option value="Monthly">Monthly Dividend (Standard)</option>
                <option value="Quarterly">Quarterly Dividend</option>
                <option value="Annual">Annual Dividend</option>
                <option value="At Maturity">Cumulative (At Maturity)</option>
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Default dividend distribution schedule assigned during deposit setup.
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                INTEREST CALCULATION METHOD
              </label>
              <select
                className="input-control"
                value={calculationMethod}
                disabled={!isAuthorized}
                onChange={(e) => setCalculationMethod(e.target.value)}
                style={{ height: '38px', fontSize: '12.5px' }}
              >
                <option value="MONTHLY_DIVIDEND">Monthly Dividend (Simple / Non-compounding)</option>
                <option value="QUARTERLY_COMPOUNDING">Quarterly Compounding</option>
                <option value="CUMULATIVE_AT_MATURITY">Cumulative at Maturity</option>
                <option value="SIMPLE">Standard Simple Interest</option>
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Mathematical model used for maturity returns and recurring dividend generation.
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                AUTO-RENEWAL POLICY
              </label>
              <select
                className="input-control"
                value={renewalPolicy}
                disabled={!isAuthorized}
                onChange={(e) => setRenewalPolicy(e.target.value)}
                style={{ height: '38px', fontSize: '12.5px' }}
              >
                <option value="MANUAL">Manual Settlement (No Auto-Renew)</option>
                <option value="AUTO_RENEW_PRINCIPAL">Auto-Renew Principal Only (Pay Interest)</option>
                <option value="AUTO_RENEW_ALL">Auto-Renew Principal + Accumulated Interest</option>
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Default contract rollover behavior upon reaching maturity date.
              </span>
            </div>
          </div>

          {/* Supported Receiving Payment Methods */}
          <div style={{ borderTop: '1px solid var(--border-light, #e2e8f0)', paddingTop: '14px', marginTop: '16px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              SUPPORTED RECEIVING &amp; PAYOUT PAYMENT METHODS
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['Cash', 'Bank', 'UPI'].map((m) => {
                const isSelected = allowedReceivingMethods.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleReceivingMethod(m)}
                    disabled={!isAuthorized}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 16px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: isAuthorized ? 'pointer' : 'default'
                    }}
                  >
                    {isSelected ? '✓ ' : ''}{m === 'Bank' ? 'Bank Transfer (NEFT/RTGS)' : m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isAuthorized && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetToSaved}
              disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700 }}
            >
              <RotateCcw size={15} /> Reset
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13.5px',
                fontWeight: 800,
                padding: '10px 24px',
                backgroundColor: 'var(--color-primary-dark, #059669)'
              }}
            >
              <Save size={16} />
              {isSaving ? 'Saving Changes...' : 'Save FD Configuration'}
            </button>
          </div>
        )}
      </form>

      {/* ── RATE CHANGE HISTORY MODAL ── */}
      {showHistoryModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="modal-content card"
            style={{
              width: '100%',
              maxWidth: '750px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={20} color="var(--color-primary-dark, #059669)" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Master FD Interest Rate History</h3>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setShowHistoryModal(false)}
                style={{ padding: '4px 10px' }}
              >
                ✕ Close
              </button>
            </div>

            {rateHistory.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No historical rate changes recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rateHistory.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      border: '1px solid var(--border-light, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '14px',
                      backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-success" style={{ fontSize: '12px', fontWeight: 800 }}>
                          {item.rate.toFixed(2)}% P.A.
                        </span>
                        {item.previousRate !== undefined && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            (Was: {item.previousRate.toFixed(2)}% P.A.)
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Effective: {item.effectiveFrom}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-dark)' }}>
                      {item.notes || 'Master interest rate adjusted.'}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span>Changed By: <strong>{item.changedBy || 'Master Admin'}</strong></span>
                      <span>Recorded At: {item.changedAt ? new Date(item.changedAt).toLocaleString('en-IN') : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
