import React from 'react';
import { RentalDashboardData } from '../types/rental.types';

interface RentalChartsProps {
  data: RentalDashboardData;
}

export const RentalCharts: React.FC<RentalChartsProps> = ({ data }) => {
  const maxMonthlyVal = Math.max(
    ...data.monthlyTrend.map((m) => Math.max(m.expected, m.collected, m.expenses, 1000)),
    1000
  );

  const totalSplit = data.paymentModeSplit.total || 1;
  const cashPercent = Math.round((data.paymentModeSplit.cashTotal / totalSplit) * 100);
  const gpayPercent = 100 - cashPercent;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
      {/* Monthly Collection Trend */}
      <div className="card" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Monthly Rent Collection Trend
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last 6 Months Performance</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', fontSize: '10px', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-brand, #176B52)' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--color-primary-accent, #176B52)', borderRadius: '2px' }} />
              Collected
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#dc2626', borderRadius: '2px' }} />
              Expenses
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '160px', paddingTop: '10px', gap: '8px' }}>
          {data.monthlyTrend.map((item) => {
            const collectedHeight = Math.max(8, Math.round((item.collected / maxMonthlyVal) * 120));
            const expenseHeight = Math.max(4, Math.round((item.expenses / maxMonthlyVal) * 120));

            return (
              <div
                key={item.month}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  height: '100%',
                  justifyContent: 'flex-end',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px' }}>
                  {/* Collected Bar */}
                  <div
                    style={{
                      width: '14px',
                      height: `${collectedHeight}px`,
                      backgroundColor: 'var(--color-primary-accent, #176B52)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s ease'
                    }}
                    title={`Collected: ₹${item.collected.toLocaleString('en-IN')}`}
                  />
                  {/* Expense Bar */}
                  <div
                    style={{
                      width: '10px',
                      height: `${expenseHeight}px`,
                      backgroundColor: '#ef4444',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s ease'
                    }}
                    title={`Expenses: ₹${item.expenses.toLocaleString('en-IN')}`}
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {item.month.substring(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cash vs GPay Payment Mode Split */}
      <div className="card" style={{ padding: '18px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Payment Mode Split (This Month)
          </h4>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cash vs Digital (GPay / UPI)</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center', height: '140px' }}>
          {/* Progress Bar */}
          <div
            style={{
              height: '24px',
              width: '100%',
              backgroundColor: 'var(--bg-surface-secondary)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              display: 'flex'
            }}
          >
            <div
              style={{
                width: `${cashPercent}%`,
                backgroundColor: 'var(--color-primary-accent, #176B52)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 800,
                transition: 'width 0.4s ease'
              }}
              title={`Cash: ₹${data.paymentModeSplit.cashTotal.toLocaleString('en-IN')}`}
            >
              {cashPercent > 12 ? `${cashPercent}%` : ''}
            </div>
            <div
              style={{
                width: `${gpayPercent}%`,
                backgroundColor: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 800,
                transition: 'width 0.4s ease'
              }}
              title={`GPay / UPI: ₹${data.paymentModeSplit.gpayTotal.toLocaleString('en-IN')}`}
            >
              {gpayPercent > 12 ? `${gpayPercent}%` : ''}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--primary-soft)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-brand, #176B52)', fontWeight: 700 }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--color-primary-accent, #176B52)', borderRadius: '50%' }} />
                Cash Collections
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                ₹{data.paymentModeSplit.cashTotal.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cashPercent}% of total</span>
            </div>

            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(37, 99, 235, 0.10)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(37, 99, 235, 0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '50%' }} />
                GPay / UPI Collections
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                ₹{data.paymentModeSplit.gpayTotal.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{gpayPercent}% of total</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
