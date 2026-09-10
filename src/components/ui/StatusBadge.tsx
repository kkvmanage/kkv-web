import React from 'react';

export type StatusType =
  | 'ACTIVE'
  | 'PAID'
  | 'PARTIAL'
  | 'PENDING'
  | 'OVERDUE'
  | 'CLOSED'
  | 'DISABLED'
  | 'DEFAULTED'
  | 'VERIFIED'
  | 'RENEWED'
  | 'INACTIVE'
  | 'CANCELLED'
  | 'UNVERIFIED'
  | 'SUCCESS'
  | 'FAILED'
  | string;

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  dot = false,
  className = '',
  style
}) => {
  const normalized = (status || '').toUpperCase().trim();
  const displayLabel = label || status;

  const getStatusStyles = () => {
    switch (normalized) {
      case 'ACTIVE':
      case 'PAID':
      case 'VERIFIED':
      case 'SUCCESS':
        return {
          bg: 'rgba(22, 163, 74, 0.10)',
          color: '#16A34A',
          border: 'rgba(22, 163, 74, 0.25)',
          dotColor: '#16A34A'
        };
      case 'PARTIAL':
      case 'PENDING':
      case 'RENEWED':
      case 'UNVERIFIED':
        return {
          bg: 'rgba(217, 119, 6, 0.10)',
          color: '#D97706',
          border: 'rgba(217, 119, 6, 0.25)',
          dotColor: '#D97706'
        };
      case 'OVERDUE':
      case 'DEFAULTED':
      case 'FAILED':
      case 'CANCELLED':
        return {
          bg: 'rgba(220, 38, 38, 0.10)',
          color: '#DC2626',
          border: 'rgba(220, 38, 38, 0.25)',
          dotColor: '#DC2626'
        };
      case 'CLOSED':
      case 'DISABLED':
      case 'INACTIVE':
        return {
          bg: 'rgba(100, 116, 139, 0.10)',
          color: '#64748B',
          border: 'rgba(100, 116, 139, 0.25)',
          dotColor: '#64748B'
        };
      default:
        return {
          bg: 'rgba(23, 107, 82, 0.08)',
          color: '#176B52',
          border: 'rgba(23, 107, 82, 0.20)',
          dotColor: '#176B52'
        };
    }
  };

  const currentTheme = getStatusStyles();
  const isSmall = size === 'sm';

  return (
    <span
      className={`status-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: isSmall ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--radius-full, 9999px)',
        fontSize: isSmall ? '10.5px' : '11.5px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
        lineHeight: 1.2,
        backgroundColor: currentTheme.bg,
        color: currentTheme.color,
        border: `1px solid ${currentTheme.border}`,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...style
      }}
    >
      {dot && (
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: currentTheme.dotColor,
            flexShrink: 0
          }}
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
};
