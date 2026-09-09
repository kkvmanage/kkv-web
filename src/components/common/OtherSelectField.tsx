import React, { useState, useEffect } from 'react';

export interface OtherSelectFieldProps {
  /** The label shown above the dropdown */
  label: string;
  /** Current selected value of the main dropdown */
  value: string;
  /** Current custom "Other" text value */
  customValue: string;
  /** Options list (should include "Other" as the last meaningful option) */
  options: { value: string; label: string }[];
  /** Called whenever either the main selection or the custom text changes */
  onChange: (value: string, customValue: string) => void;
  /** Whether "Other" input is required (defaults true) */
  required?: boolean;
  /** Placeholder for the custom specify-relation text input */
  customPlaceholder?: string;
  /** Label for the "specify" field */
  customLabel?: string;
  /** Max length for the custom text */
  maxCustomLength?: number;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Optional CSS class override */
  className?: string;
}

const OTHER_VALUE = 'Other';

export const OtherSelectField: React.FC<OtherSelectFieldProps> = ({
  label,
  value,
  customValue,
  options,
  onChange,
  required: _required = true,
  customPlaceholder = 'Enter relationship (e.g. Uncle, Aunt, Cousin, Guardian)',
  customLabel = 'Specify Relation',
  maxCustomLength = 50,
  disabled = false,
  className = ''
}) => {
  const [customTouched, setCustomTouched] = useState(false);
  const isOther = value === OTHER_VALUE;
  const customError =
    isOther && customTouched && !customValue.trim()
      ? 'Please specify the relationship.'
      : '';

  // Reset touched state when user leaves "Other" mode
  useEffect(() => {
    if (!isOther) {
      setCustomTouched(false);
    }
  }, [isOther]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    if (newVal !== OTHER_VALUE) {
      // Switching away from Other — clear custom value
      onChange(newVal, '');
    } else {
      onChange(newVal, customValue);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow letters, spaces, and hyphens
    const raw = e.target.value.replace(/[^a-zA-Z\s\-]/g, '').slice(0, maxCustomLength);
    onChange(value, raw);
  };

  return (
    <div className={`other-select-field-wrapper ${className}`}>
      {/* Main dropdown */}
      <div className="form-group" style={{ marginBottom: isOther ? '10px' : '0' }}>
        <label className="form-label">{label}</label>
        <select
          className="input-control"
          value={value}
          disabled={disabled}
          onChange={handleSelectChange}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Animated "Specify Relation" field — shown only when Other is selected */}
      {isOther && (
        <div
          className="form-group"
          style={{
            marginTop: '4px',
            padding: '10px 12px',
            backgroundColor: 'rgba(23, 107, 82, 0.04)',
            border: '1px solid var(--border-light, #DDE5DF)',
            borderRadius: '8px',
            borderLeft: '3px solid var(--color-primary-accent, #176B52)',
            animation: 'fadeSlideIn 0.18s ease-out',
          }}
        >
          <label
            className="form-label required"
            style={{ color: 'var(--color-primary-accent, #176B52)', fontWeight: 700, fontSize: '11px' }}
          >
            {customLabel}
          </label>
          <input
            type="text"
            className="input-control"
            placeholder={customPlaceholder}
            value={customValue}
            disabled={disabled}
            maxLength={maxCustomLength}
            style={{
              borderColor: customError ? 'var(--color-danger, #ef4444)' : undefined,
              marginTop: '4px'
            }}
            onChange={handleCustomChange}
            onBlur={() => setCustomTouched(true)}
          />
          {customError && (
            <small
              style={{
                color: 'var(--color-danger, #ef4444)',
                fontSize: '11px',
                marginTop: '4px',
                display: 'block',
                fontWeight: 600
              }}
            >
              {customError}
            </small>
          )}
          {!customError && (
            <small style={{ color: 'var(--text-secondary, #66756D)', fontSize: '10px', marginTop: '3px', display: 'block' }}>
              e.g. Uncle, Aunt, Cousin, Guardian, Grandfather
            </small>
          )}
        </div>
      )}

      {/* Inline style tag for animation (avoids needing global CSS) */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

/** Utility: resolve the final display value to save/show */
export function resolveRelation(value: string, customValue: string): string {
  if (value === 'Other' && customValue.trim()) return customValue.trim();
  return value;
}

/** Standard relation options for nominee / guarantor */
export const RELATION_OPTIONS: { value: string; label: string }[] = [
  { value: '-', label: '- Select -' },
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Husband', label: 'Husband' },
  { value: 'Wife', label: 'Wife' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Son', label: 'Son' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Other', label: 'Other' },
];

export const NOMINEE_RELATION_OPTIONS: { value: string; label: string }[] = [
  { value: '-', label: '- Select Relation -' },
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Husband', label: 'Husband' },
  { value: 'Wife', label: 'Wife' },
  { value: 'Son', label: 'Son' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Other', label: 'Other' },
];

export const GUARANTOR_RELATION_OPTIONS: { value: string; label: string }[] = [
  { value: '-', label: '- Select Relation -' },
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Husband', label: 'Husband' },
  { value: 'Wife', label: 'Wife' },
  { value: 'Son', label: 'Son' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Other', label: 'Other' },
];

