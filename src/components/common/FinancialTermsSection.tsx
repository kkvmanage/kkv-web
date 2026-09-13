import React from 'react';

export const BANK_MODE_OPTIONS = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque'] as const;
export type BankModeType = typeof BANK_MODE_OPTIONS[number];

export interface FinancialTermsSectionProps {
  principal: number | '';
  onPrincipalChange: (val: number | '') => void;
  disbursementMethod: 'Cash' | 'Bank' | 'Cash + Bank';
  onDisbursementMethodChange: (method: 'Cash' | 'Bank' | 'Cash + Bank') => void;
  bankMode: string;
  onBankModeChange: (mode: string) => void;
  splitCashAmount: number | '';
  onSplitCashAmountChange: (val: number | '') => void;
  splitBankAmount: number | '';
  onSplitBankAmountChange: (val: number | '') => void;
  interestRate: number;
  deductAdvanceInterest: boolean;
  onDeductAdvanceInterestChange: (val: boolean) => void;
  advanceDays: number;
  onAdvanceDaysChange: (val: number) => void;
  advanceInterestAmount: number;
  advanceReceivingMethod: 'Cash' | 'Bank' | 'Cash + Bank';
  onAdvanceReceivingMethodChange: (val: 'Cash' | 'Bank' | 'Cash + Bank') => void;
  cardFeeEnabled: boolean;
  onCardFeeEnabledChange?: (val: boolean) => void;
  cardFeeAmount: number;
  onCardFeeAmountChange?: (val: number) => void;
  cardFeeMode: 'Cash' | 'Bank';
  onCardFeeModeChange: (val: 'Cash' | 'Bank') => void;
  cardFeeBankMode: string;
  onCardFeeBankModeChange: (val: string) => void;
}

export const FinancialTermsSection: React.FC<FinancialTermsSectionProps> = ({
  principal,
  onPrincipalChange,
  disbursementMethod,
  onDisbursementMethodChange,
  bankMode,
  onBankModeChange,
  splitCashAmount,
  onSplitCashAmountChange,
  splitBankAmount,
  onSplitBankAmountChange,
  interestRate,
  deductAdvanceInterest,
  onDeductAdvanceInterestChange,
  advanceDays,
  onAdvanceDaysChange,
  advanceInterestAmount,
  advanceReceivingMethod,
  onAdvanceReceivingMethodChange,
  cardFeeEnabled,
  onCardFeeEnabledChange,
  cardFeeAmount,
  cardFeeMode,
  onCardFeeModeChange,
  cardFeeBankMode,
  onCardFeeBankModeChange
}) => {
  const numericPrincipal = typeof principal === 'number' ? principal : 0;
  const cashVal = Number(splitCashAmount) || 0;
  const bankVal = Number(splitBankAmount) || 0;
  const splitTotal = cashVal + bankVal;
  const isSplitValid =
    disbursementMethod !== 'Cash + Bank' ||
    (cashVal > 0 && bankVal > 0 && splitTotal === numericPrincipal);

  // Sync split amounts when principal or method changes
  const handleMethodChange = (newMethod: 'Cash' | 'Bank' | 'Cash + Bank') => {
    onDisbursementMethodChange(newMethod);
    if (newMethod === 'Cash') {
      onSplitCashAmountChange(numericPrincipal);
      onSplitBankAmountChange(0);
    } else if (newMethod === 'Bank') {
      onSplitBankAmountChange(numericPrincipal);
      onSplitCashAmountChange(0);
      if (!bankMode || !BANK_MODE_OPTIONS.includes(bankMode as any)) {
        onBankModeChange('UPI');
      }
    } else if (newMethod === 'Cash + Bank') {
      const half = Math.round(numericPrincipal / 2);
      onSplitCashAmountChange(half);
      onSplitBankAmountChange(numericPrincipal - half);
      if (!bankMode || !BANK_MODE_OPTIONS.includes(bankMode as any)) {
        onBankModeChange('UPI');
      }
    }
  };

  const handlePrincipalInput = (val: number | '') => {
    onPrincipalChange(val);
    const numVal = typeof val === 'number' ? val : 0;
    if (disbursementMethod === 'Cash') {
      onSplitCashAmountChange(numVal);
      onSplitBankAmountChange(0);
    } else if (disbursementMethod === 'Bank') {
      onSplitBankAmountChange(numVal);
      onSplitCashAmountChange(0);
    } else if (disbursementMethod === 'Cash + Bank') {
      const half = Math.round(numVal / 2);
      onSplitCashAmountChange(half);
      onSplitBankAmountChange(numVal - half);
    }
  };

  // Card Fee deduction
  const effectiveCardFee = cardFeeEnabled ? (Number(cardFeeAmount) || 0) : 0;

  // Net Amount Disbursed
  const netAmountDisbursed = Math.max(
    0,
    numericPrincipal - (deductAdvanceInterest ? advanceInterestAmount : 0) - effectiveCardFee
  );

  return (
    <div className="fi-card">
      <div className="fi-section-header">
        <div className="fi-section-title-group">
          <span className="fi-section-icon">💰</span>
          <div>
            <h3 className="fi-section-title">Financial Terms &amp; Disbursement</h3>
            <p className="fi-section-desc">Principal, interest rate, disbursement method, and deductions</p>
          </div>
        </div>
      </div>

      <div className="fi-rows fi-rows--lg">
        {/* ROW 1: Principal & Disbursement Method */}
        <div className="fi-grid-2">
          <div className="fi-field">
            <label className="fi-label">
              Principal Amount (INR) <span className="fi-req">*</span>
            </label>
            <input
              type="number"
              className="input-control fi-input"
              placeholder="e.g. 100000"
              value={principal}
              onChange={(e) => handlePrincipalInput(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div className="fi-field">
            <label className="fi-label">
              Disbursement Method <span className="fi-req">*</span>
            </label>
            <select
              className="input-control fi-select"
              value={disbursementMethod}
              onChange={(e) => handleMethodChange(e.target.value as any)}
            >
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
              <option value="Cash + Bank">Cash + Bank</option>
            </select>
          </div>
        </div>

        {/* METHOD A: CASH ONLY */}
        {disbursementMethod === 'Cash' && (
          <div className="fi-grid-2">
            <div className="fi-field">
              <label className="fi-label">Cash Amount (₹)</label>
              <input
                type="number"
                className="input-control fi-input fi-input--readonly"
                value={numericPrincipal}
                readOnly
              />
              <span className="fi-hint">Auto-equals full principal amount</span>
            </div>
          </div>
        )}

        {/* METHOD B: BANK ONLY */}
        {disbursementMethod === 'Bank' && (
          <div className="fi-grid-2">
            <div className="fi-field">
              <label className="fi-label">
                Bank Mode <span className="fi-req">*</span>
              </label>
              <select
                className="input-control fi-select"
                value={bankMode}
                onChange={(e) => onBankModeChange(e.target.value)}
              >
                {BANK_MODE_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            <div className="fi-field">
              <label className="fi-label">Bank Amount (₹)</label>
              <input
                type="number"
                className="input-control fi-input fi-input--readonly"
                value={numericPrincipal}
                readOnly
              />
              <span className="fi-hint">Auto-equals full principal amount</span>
            </div>
          </div>
        )}

        {/* METHOD C: CASH + BANK */}
        {disbursementMethod === 'Cash + Bank' && (
          <div className="fi-rows">
            <div className="fi-grid-2">
              <div className="fi-field">
                <label className="fi-label">
                  Bank Mode <span className="fi-req">*</span>
                </label>
                <select
                  className="input-control fi-select"
                  value={bankMode}
                  onChange={(e) => onBankModeChange(e.target.value)}
                >
                  {BANK_MODE_OPTIONS.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="fi-grid-3">
              <div className="fi-field">
                <label className="fi-label">
                  Cash Amount (₹) <span className="fi-req">*</span>
                </label>
                <input
                  type="number"
                  className="input-control fi-input"
                  value={splitCashAmount}
                  placeholder="Cash portion"
                  onChange={(e) =>
                    onSplitCashAmountChange(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>

              <div className="fi-field">
                <label className="fi-label">
                  Bank Amount (₹) <span className="fi-req">*</span>
                </label>
                <input
                  type="number"
                  className="input-control fi-input"
                  value={splitBankAmount}
                  placeholder="Bank portion"
                  onChange={(e) =>
                    onSplitBankAmountChange(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>

              <div className="fi-field">
                <label className="fi-label">Total Amount (₹)</label>
                <div
                  className="fi-readonly-display"
                  style={{
                    color: isSplitValid ? 'var(--color-success, #4FAF86)' : '#EF4444',
                    fontWeight: 800
                  }}
                >
                  ₹{splitTotal.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {!isSplitValid && (
              <div className="fi-error" style={{ fontSize: '12px', fontWeight: 700 }}>
                ⚠️ Cash + Bank amount must equal the Principal Amount (₹
                {numericPrincipal.toLocaleString('en-IN')}). Cash and Bank amounts must both be &gt; 0.
              </div>
            )}
          </div>
        )}

        {/* INTEREST RATE (ADMIN CONTROLLED) */}
        <div className="fi-grid-2">
          <div className="fi-field">
            <div className="fi-label-sub">
              <label className="fi-label">Interest Rate</label>
              <span className="fi-label-badge">Auto / Admin Controlled</span>
            </div>
            <input
              type="text"
              className="input-control fi-input fi-input--readonly"
              value={`${interestRate}% per month`}
              readOnly
              disabled
            />
            <span className="fi-hint">Rate dynamically fetched from Admin Master Control</span>
          </div>
        </div>

        {/* DEDUCT ADVANCE INTEREST */}
        <div className="fi-accent-box fi-accent-box--amber">
          <label className="fi-checkbox-row">
            <input
              type="checkbox"
              checked={deductAdvanceInterest}
              onChange={(e) => {
                onDeductAdvanceInterestChange(e.target.checked);
                if (e.target.checked && advanceDays === 0) {
                  onAdvanceDaysChange(30);
                }
              }}
            />
            <span className="fi-checkbox-label">Deduct Advance Interest at Disbursement</span>
          </label>

          {deductAdvanceInterest && (
            <div className="fi-rows" style={{ marginTop: '8px' }}>
              <div className="fi-grid-2">
                <div className="fi-field">
                  <label className="fi-label">Days of Advance Interest</label>
                  <input
                    type="number"
                    className="input-control fi-input"
                    min={1}
                    max={365}
                    value={advanceDays}
                    onChange={(e) => onAdvanceDaysChange(Number(e.target.value) || 0)}
                  />
                </div>

                <div className="fi-field">
                  <label className="fi-label">Advance Interest Amount (₹)</label>
                  <input
                    type="text"
                    className="input-control fi-input fi-input--readonly"
                    readOnly
                    value={`₹${advanceInterestAmount.toLocaleString('en-IN')}`}
                  />
                  <span className="fi-hint">Auto-calculated: ({interestRate}%/mo for {advanceDays} days)</span>
                </div>
              </div>

              <div className="fi-field" style={{ maxWidth: '300px' }}>
                <label className="fi-label">Receiving Method</label>
                <select
                  className="input-control fi-select"
                  value={advanceReceivingMethod}
                  onChange={(e) => onAdvanceReceivingMethodChange(e.target.value as any)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="Cash + Bank">Cash + Bank</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* CARD FEE SECTION */}
        <div className={`fi-accent-box ${cardFeeEnabled ? 'fi-accent-box--green' : ''}`} style={{ borderColor: cardFeeEnabled ? undefined : 'var(--border-subtle, #e2e8f0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '18px', marginTop: '2px' }}>💳</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  CARD PROCESSING FEE
                </div>
                <label className="fi-checkbox-row" style={{ margin: 0, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cardFeeEnabled}
                    onChange={(e) => onCardFeeEnabledChange && onCardFeeEnabledChange(e.target.checked)}
                  />
                  <span className="fi-checkbox-label" style={{ fontWeight: 700, fontSize: '13px' }}>
                    Apply Card Processing Fee
                  </span>
                </label>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', marginLeft: '24px' }}>
                  🔒 Configured by Master Admin
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', minWidth: '60px' }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  color: cardFeeEnabled ? 'var(--color-primary-dark, #163f35)' : 'var(--text-muted)'
                }}
              >
                {cardFeeEnabled ? `₹${cardFeeAmount.toLocaleString('en-IN')}` : '₹0'}
              </div>
            </div>
          </div>

          {cardFeeEnabled ? (
            <div className="fi-rows" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle, #e2e8f0)' }}>
              <div className="fi-grid-3">
                <div className="fi-field">
                  <label className="fi-label">Collection Method</label>
                  <select
                    className="input-control fi-select"
                    value={cardFeeMode}
                    onChange={(e) => onCardFeeModeChange(e.target.value as any)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>

                {cardFeeMode === 'Bank' && (
                  <div className="fi-field">
                    <label className="fi-label">Bank Mode</label>
                    <select
                      className="input-control fi-select"
                      value={cardFeeBankMode}
                      onChange={(e) => onCardFeeBankModeChange(e.target.value)}
                    >
                      {BANK_MODE_OPTIONS.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="fi-field">
                  <div className="fi-label-sub">
                    <label className="fi-label">Fee Amount (₹)</label>
                    <span className="fi-label-badge" style={{ backgroundColor: 'var(--bg-surface-secondary)', color: 'var(--text-muted)', fontSize: '10px' }}>
                      Read-Only
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input-control fi-input fi-input--readonly"
                    readOnly
                    disabled
                    value={`₹${cardFeeAmount.toLocaleString('en-IN')}`}
                    style={{ fontWeight: 700, color: 'var(--text-primary)', cursor: 'not-allowed', backgroundColor: 'var(--bg-surface-secondary)' }}
                  />
                  <span className="fi-hint">Fee configured by Master Admin in Rates &amp; Payments.</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>ℹ️</span>
              <span>Card processing fee will not be deducted for this transaction.</span>
            </div>
          )}
        </div>

        {/* LOAN DISBURSEMENT SUMMARY */}
        <div
          style={{
            background: 'var(--bg-surface-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--fi-radius)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--text-muted)'
            }}
          >
            LOAN DISBURSEMENT SUMMARY
          </div>

          <div className="fi-divider" style={{ margin: '4px 0 8px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Principal Amount</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                ₹{numericPrincipal.toLocaleString('en-IN')}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Disbursement Method</span>
              <strong style={{ color: 'var(--color-primary-dark)' }}>
                {disbursementMethod === 'Cash'
                  ? 'Cash'
                  : disbursementMethod === 'Bank'
                  ? `Bank (${bankMode})`
                  : `Cash + Bank (${bankMode})`}
              </strong>
            </div>

            {deductAdvanceInterest && advanceInterestAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Advance Interest Deduction ({advanceDays} days)</span>
                <strong style={{ color: '#EF4444' }}>
                  - ₹{advanceInterestAmount.toLocaleString('en-IN')}
                </strong>
              </div>
            )}

            {cardFeeEnabled && effectiveCardFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Card Fee Deduction</span>
                <strong style={{ color: '#EF4444' }}>
                  - ₹{effectiveCardFee.toLocaleString('en-IN')}
                </strong>
              </div>
            )}
          </div>

          <div className="fi-divider" style={{ margin: '8px 0 4px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              NET AMOUNT DISBURSED
            </span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-primary-dark)' }}>
              ₹{netAmountDisbursed.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
