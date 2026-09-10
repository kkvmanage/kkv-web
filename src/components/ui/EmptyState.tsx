import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  style
}) => {
  return (
    <div
      className={`empty-state-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        backgroundColor: 'var(--surface, #FFFFFF)',
        border: '1px dashed var(--border, #E2E8E5)',
        borderRadius: 'var(--radius-lg, 12px)',
        width: '100%',
        boxSizing: 'border-box',
        ...style
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: 'var(--primary-soft, rgba(23, 107, 82, 0.08))',
          color: 'var(--primary, #176B52)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
          opacity: 0.9
        }}
      >
        {icon || <Inbox size={24} />}
      </div>

      <h4
        style={{
          fontSize: '15px',
          fontWeight: 700,
          color: 'var(--text-primary, #1A2E26)',
          margin: '0 0 4px 0'
        }}
      >
        {title}
      </h4>

      {description && (
        <p
          style={{
            fontSize: '12.5px',
            color: 'var(--text-secondary, #64748B)',
            margin: '0 0 16px 0',
            maxWidth: '420px',
            lineHeight: 1.4
          }}
        >
          {description}
        </p>
      )}

      {action && <div>{action}</div>}
    </div>
  );
};
