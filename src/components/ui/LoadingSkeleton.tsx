import React from 'react';

export interface LoadingSkeletonProps {
  variant?: 'table' | 'card' | 'stat-grid' | 'form' | 'line';
  count?: number;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'card',
  count = 1,
  height,
  className = '',
  style
}) => {
  const renderItem = (idx: number) => {
    switch (variant) {
      case 'stat-grid':
        return (
          <div
            key={idx}
            style={{
              padding: '16px',
              backgroundColor: 'var(--surface-secondary, #F4F7F5)',
              border: '1px solid var(--border-subtle, #EDF2EE)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'pulse 1.5s infinite ease-in-out'
            }}
          >
            <div style={{ width: '40%', height: '10px', backgroundColor: 'var(--border, #E2E8E5)', borderRadius: '4px' }} />
            <div style={{ width: '60%', height: '22px', backgroundColor: 'var(--border, #E2E8E5)', borderRadius: '4px' }} />
          </div>
        );

      case 'table':
        return (
          <div
            key={idx}
            style={{
              padding: '16px',
              backgroundColor: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border, #E2E8E5)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'pulse 1.5s infinite ease-in-out'
            }}
          >
            <div style={{ width: '100%', height: '32px', backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderRadius: '6px' }} />
            {Array.from({ length: 4 }).map((_, rIdx) => (
              <div
                key={rIdx}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-subtle, #EDF2EE)'
                }}
              >
                <div style={{ flex: 1, height: '14px', backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderRadius: '4px' }} />
                <div style={{ flex: 2, height: '14px', backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderRadius: '4px' }} />
                <div style={{ flex: 1, height: '14px', backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderRadius: '4px' }} />
                <div style={{ flex: 1, height: '14px', backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        );

      case 'line':
        return (
          <div
            key={idx}
            style={{
              width: '100%',
              height: height || '16px',
              backgroundColor: 'var(--surface-secondary, #F4F7F5)',
              borderRadius: '4px',
              animation: 'pulse 1.5s infinite ease-in-out',
              ...style
            }}
          />
        );

      case 'card':
      default:
        return (
          <div
            key={idx}
            style={{
              padding: '20px',
              backgroundColor: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border, #E2E8E5)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'pulse 1.5s infinite ease-in-out',
              height: height || 'auto',
              ...style
            }}
          >
            <div style={{ width: '35%', height: '14px', backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderRadius: '4px' }} />
            <div style={{ width: '100%', height: '40px', backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderRadius: '6px' }} />
            <div style={{ width: '70%', height: '12px', backgroundColor: 'var(--surface-secondary, #F4F7F5)', borderRadius: '4px' }} />
          </div>
        );
    }
  };

  return (
    <div
      className={`skeleton-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: variant === 'stat-grid' ? 'row' : 'column',
        gap: '12px',
        width: '100%'
      }}
    >
      {Array.from({ length: count }).map((_, idx) => renderItem(idx))}
    </div>
  );
};
