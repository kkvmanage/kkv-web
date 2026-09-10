import React from 'react';

export type StatColorTheme = 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'gold' | 'neutral' | 'indigo' | 'emerald' | 'teal' | 'amber' | 'rose' | string;

export interface StatCardProps {
  label?: string;
  title?: string;
  value: string | number;
  subValue?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  colorTheme?: StatColorTheme;
  variant?: StatColorTheme;
  valueColor?: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  title,
  value,
  subValue,
  subtitle,
  icon,
  colorTheme,
  variant = 'primary',
  valueColor,
  onClick,
  className = '',
  style
}) => {
  const displayLabel = label || title || '';
  const displaySubValue = subtitle || subValue;
  const activeTheme = colorTheme || variant;

  const getThemeStyles = () => {
    switch (activeTheme) {
      case 'primary':
        return {
          bg: 'rgba(23, 107, 82, 0.05)',
          border: 'rgba(23, 107, 82, 0.15)',
          valueColor: '#176B52',
          labelColor: 'var(--text-secondary, #64748B)',
          iconBg: 'rgba(23, 107, 82, 0.12)',
          iconColor: '#176B52'
        };
      case 'success':
      case 'emerald':
        return {
          bg: 'rgba(22, 163, 74, 0.05)',
          border: 'rgba(22, 163, 74, 0.18)',
          valueColor: '#16A34A',
          labelColor: 'var(--text-secondary, #64748B)',
          iconBg: 'rgba(22, 163, 74, 0.12)',
          iconColor: '#16A34A'
        };
      case 'info':
      case 'indigo':
        return {
          bg: 'rgba(99, 102, 241, 0.05)',
          border: 'rgba(99, 102, 241, 0.18)',
          valueColor: '#4F46E5',
          labelColor: 'var(--text-secondary, #64748B)',
          iconBg: 'rgba(99, 102, 241, 0.12)',
          iconColor: '#4F46E5'
        };
      case 'teal':
        return {
          bg: 'rgba(20, 184, 166, 0.05)',
          border: 'rgba(20, 184, 166, 0.18)',
          valueColor: '#0D9488',
          labelColor: 'var(--text-secondary, #64748B)',
          iconBg: 'rgba(20, 184, 166, 0.12)',
          iconColor: '#0D9488'
        };
      case 'warning':
      case 'amber':
        return {
          bg: 'rgba(217, 119, 6, 0.05)',
          border: 'rgba(217, 119, 6, 0.18)',
          valueColor: '#D97706',
          labelColor: 'var(--text-secondary, #64748B)',
          iconBg: 'rgba(217, 119, 6, 0.12)',
          iconColor: '#D97706'
        };
      case 'danger':
      case 'rose':
        return {
          bg: 'rgba(220, 38, 38, 0.05)',
          border: 'rgba(220, 38, 38, 0.18)',
          valueColor: '#DC2626',
          labelColor: 'var(--text-secondary, #64748B)',
          iconBg: 'rgba(220, 38, 38, 0.12)',
          iconColor: '#DC2626'
        };
      case 'gold':
        return {
          bg: 'rgba(201, 162, 39, 0.06)',
          border: 'rgba(201, 162, 39, 0.22)',
          valueColor: '#9A7B1C',
          labelColor: 'var(--text-secondary, #64748B)',
          iconBg: 'rgba(201, 162, 39, 0.14)',
          iconColor: '#9A7B1C'
        };
      case 'neutral':
      default:
        return {
          bg: 'var(--surface, #FFFFFF)',
          border: 'var(--border, #E2E8E5)',
          valueColor: 'var(--text-primary, #1A2E26)',
          labelColor: 'var(--text-secondary, #64748B)',
          iconBg: 'var(--surface-secondary, #F4F7F5)',
          iconColor: 'var(--text-secondary, #64748B)'
        };
    }
  };

  const theme = getThemeStyles();

  return (
    <div
      className={`stat-card ${className}`}
      onClick={onClick}
      style={{
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
        boxSizing: 'border-box',
        minWidth: 0,
        ...style
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            color: theme.labelColor,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {displayLabel}
        </span>

        <div
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: valueColor || theme.valueColor,
            lineHeight: 1.15,
            letterSpacing: '-0.3px',
            wordBreak: 'break-word'
          }}
        >
          {value}
        </div>

        {displaySubValue && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted, #8A9E95)',
              marginTop: '2px',
              lineHeight: 1.3
            }}
          >
            {displaySubValue}
          </span>
        )}
      </div>

      {icon && (
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: theme.iconBg,
            color: theme.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
};

export interface StatGridProps {
  columns?: number | { sm?: number; md?: number; lg?: number; xl?: number };
  cols?: number;
  gap?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const StatGrid: React.FC<StatGridProps> = ({
  columns = 4,
  cols,
  gap = 12,
  children,
  className = '',
  style
}) => {
  const activeCols = cols || (typeof columns === 'number' ? columns : 4);

  const getGridTemplate = () => {
    return `repeat(auto-fit, minmax(${activeCols > 2 ? '200px' : '280px'}, 1fr))`;
  };

  return (
    <div
      className={`stat-grid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: getGridTemplate(),
        gap: `${gap}px`,
        marginBottom: '16px',
        width: '100%',
        ...style
      }}
    >
      {children}
    </div>
  );
};
