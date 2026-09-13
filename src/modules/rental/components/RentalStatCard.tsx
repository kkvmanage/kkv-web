import React from 'react';

interface RentalStatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const RentalStatCard: React.FC<RentalStatCardProps> = ({
  label,
  value,
  subValue,
  icon,
  variant = 'default',
  onClick,
  style
}) => {
  const getColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: 'var(--primary-soft)',
          border: 'var(--border-subtle)',
          iconColor: 'var(--text-brand, #176B52)',
          text: 'var(--text-brand, #176B52)'
        };
      case 'success':
        return {
          bg: 'rgba(34, 197, 94, 0.10)',
          border: 'rgba(34, 197, 94, 0.25)',
          iconColor: '#22c55e',
          text: '#22c55e'
        };
      case 'warning':
        return {
          bg: 'rgba(234, 179, 8, 0.10)',
          border: 'rgba(234, 179, 8, 0.25)',
          iconColor: '#f59e0b',
          text: '#f59e0b'
        };
      case 'danger':
        return {
          bg: 'rgba(239, 68, 68, 0.10)',
          border: 'rgba(239, 68, 68, 0.25)',
          iconColor: '#ef4444',
          text: '#ef4444'
        };
      case 'info':
        return {
          bg: 'rgba(59, 130, 246, 0.10)',
          border: 'rgba(59, 130, 246, 0.25)',
          iconColor: '#3b82f6',
          text: '#3b82f6'
        };
      default:
        return {
          bg: 'var(--bg-card)',
          border: 'var(--border-subtle)',
          iconColor: 'var(--text-muted)',
          text: 'var(--text-primary)'
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className="card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bg,
        borderColor: colors.border,
        boxShadow: 'var(--shadow-sm)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--transition-fast)',
        ...style
      }}
    >
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '4px'
          }}
        >
          {label}
        </span>
        <div style={{ fontSize: '20px', fontWeight: 800, color: colors.text }}>
          {value}
        </div>
        {subValue && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
            {subValue}
          </span>
        )}
      </div>

      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.iconColor,
          flexShrink: 0
        }}
      >
        {icon}
      </div>
    </div>
  );
};
