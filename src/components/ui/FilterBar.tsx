import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface FilterBarProps {
  children: React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  onReset,
  resetLabel = 'Reset',
  actions,
  className = '',
  style
}) => {
  return (
    <div
      className={`card filter-bar-container ${className}`}
      style={{
        padding: '12px 16px',
        marginBottom: '16px',
        backgroundColor: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border, #E2E8E5)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        ...style
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          flex: 1,
          minWidth: 0
        }}
      >
        {children}

        {onReset && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReset}
            icon={<RotateCcw size={12} />}
            title="Reset all filters"
            style={{ padding: '0 10px', height: '34px' }}
          >
            <span>{resetLabel}</span>
          </Button>
        )}
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
};
