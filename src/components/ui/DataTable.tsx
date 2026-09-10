import React from 'react';
import { EmptyState } from './EmptyState';
import { LoadingSkeleton } from './LoadingSkeleton';

export interface ColumnDef<T> {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or filter parameters.',
  emptyIcon,
  emptyAction,
  onRowClick,
  footer,
  className = '',
  style
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingSkeleton variant="table" />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
      />
    );
  }

  return (
    <div
      className={`table-responsive data-table-wrapper ${className}`}
      style={{
        width: '100%',
        overflowX: 'auto',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--border, #E2E8E5)',
        backgroundColor: 'var(--surface, #FFFFFF)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        ...style
      }}
    >
      <table
        className="table data-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12.5px',
          textAlign: 'left'
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--surface-secondary, #F4F7F5)',
              borderBottom: '1px solid var(--border, #E2E8E5)'
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '10px 14px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: 'var(--text-secondary, #64748B)',
                  textAlign: col.align || 'left',
                  width: col.width,
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid var(--border, #E2E8E5)'
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={keyExtractor(row, idx)}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                borderBottom: idx === data.length - 1 && !footer ? 'none' : '1px solid var(--border-subtle, #EDF2EE)',
                transition: 'background-color 0.12s ease',
                backgroundColor: 'transparent'
              }}
              className="data-table-row"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '11px 14px',
                    color: 'var(--text-primary, #1A2E26)',
                    textAlign: col.align || 'left',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {col.render ? col.render(row, idx) : (row as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--surface-secondary, #F4F7F5)',
                  borderTop: '1px solid var(--border, #E2E8E5)'
                }}
              >
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
