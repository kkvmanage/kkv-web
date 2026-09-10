import React from 'react';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  hint,
  error,
  children,
  className = '',
  style
}) => {
  return (
    <div
      className={`form-group ${error ? 'has-error' : ''} ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        width: '100%',
        ...style
      }}
    >
      {label && (
        <label
          className={`form-label ${required ? 'required' : ''}`}
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: error ? '#DC2626' : 'var(--text-secondary, #64748B)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>{label}</span>
          {required && <span style={{ color: '#DC2626', fontWeight: 800 }}>*</span>}
        </label>
      )}

      {children}

      {error && (
        <span
          style={{
            fontSize: '11px',
            color: '#DC2626',
            marginTop: '2px',
            lineHeight: 1.2
          }}
        >
          {error}
        </span>
      )}

      {hint && !error && (
        <span
          style={{
            fontSize: '10.5px',
            color: 'var(--text-muted, #8A9E95)',
            marginTop: '2px',
            lineHeight: 1.2
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
};
