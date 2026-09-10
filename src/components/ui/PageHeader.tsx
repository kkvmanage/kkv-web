import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; onClick?: () => void }>;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  icon,
  badge,
  actions,
  action,
  breadcrumbs,
  className = ''
}) => {
  const displaySubtitle = subtitle || description;
  const displayActions = actions || action;

  return (
    <div
      className={`page-header-container ${className}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '18px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--border-subtle, #EDF2EE)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted, #8A9E95)', marginBottom: '2px' }}>
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span>/</span>}
                {bc.onClick ? (
                  <button
                    type="button"
                    onClick={bc.onClick}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--text-secondary, #64748B)',
                      cursor: 'pointer',
                      fontSize: 'inherit',
                      fontWeight: 500
                    }}
                  >
                    {bc.label}
                  </button>
                ) : (
                  <span>{bc.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {icon && (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
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
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 800,
              margin: 0,
              color: 'var(--text-primary, #1A2E26)',
              letterSpacing: '-0.2px',
              lineHeight: 1.2
            }}
          >
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>

        {displaySubtitle && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary, #64748B)',
              margin: 0,
              lineHeight: 1.4
            }}
          >
            {displaySubtitle}
          </p>
        )}
      </div>

      {displayActions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {displayActions}
        </div>
      )}
    </div>
  );
};
