import React from 'react';

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  headerRight?: React.ReactNode;
  headerBorder?: boolean;
  padding?: string | number;
  noPadding?: boolean;
  elevated?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon,
  badge,
  actions,
  headerRight,
  headerBorder = true,
  padding = '18px 22px',
  noPadding = false,
  elevated = false,
  children,
  className = '',
  style,
  onClick
}) => {
  const displayActions = actions || headerRight;
  const hasHeader = title || subtitle || icon || badge || displayActions;

  return (
    <div
      className={`card ${elevated ? 'card-elevated' : ''} ${className}`}
      onClick={onClick}
      style={{
        backgroundColor: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border, #E2E8E5)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: elevated
          ? '0 4px 16px rgba(15, 45, 35, 0.08)'
          : '0 1px 3px rgba(0, 0, 0, 0.03)',
        padding: noPadding ? 0 : (typeof padding === 'number' ? `${padding}px` : padding),
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
        ...style
      }}
    >
      {hasHeader && (
        <div
          className="card-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: headerBorder ? '16px' : '10px',
            paddingBottom: headerBorder ? '12px' : '0px',
            borderBottom: headerBorder ? '1px solid var(--border-subtle, #EDF2EE)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {icon && (
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--primary-soft, rgba(23, 107, 82, 0.08))',
                  color: 'var(--primary, #176B52)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {icon}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {typeof title === 'string' ? (
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--text-primary, #1A2E26)',
                      margin: 0
                    }}
                  >
                    {title}
                  </h3>
                ) : (
                  title
                )}
                {badge && <div>{badge}</div>}
              </div>
              {subtitle && (
                <span
                  style={{
                    fontSize: '11.5px',
                    color: 'var(--text-muted, #8A9E95)',
                    marginTop: '2px'
                  }}
                >
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          {displayActions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {displayActions}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
};
