import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Bell, Plus, PhoneCall, CheckCircle2 } from 'lucide-react';
import { PageHeader, Card, StatusBadge, Button } from '../components/ui';

interface DailyReminderItem {
  id: string;
  customer: string;
  loanFd: string;
  reminderType: 'Monthly Interest' | 'FD Maturity Payout' | 'Pledge Renewal' | 'Document Verification';
  dueDate: string;
  status: 'PENDING' | 'COMPLETED' | 'OVERDUE';
}

export const DailyReminders: React.FC = () => {
  const { showToast } = useApp();
  const [reminders, setReminders] = useState<DailyReminderItem[]>(() => {
    try {
      const saved = localStorage.getItem('kkv_daily_reminders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('kkv_daily_reminders', JSON.stringify(reminders));
    } catch (e) {
      console.error(e);
    }
  }, [reminders]);

  const [newCustomer, setNewCustomer] = useState('');
  const [newLoanFd, setNewLoanFd] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.trim()) return;

    setReminders((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        customer: newCustomer,
        loanFd: newLoanFd || 'General Notice',
        reminderType: 'Monthly Interest',
        dueDate: 'Today',
        status: 'PENDING'
      }
    ]);
    setNewCustomer('');
    setNewLoanFd('');
    showToast('Reminder added successfully!', 'success');
  };

  const handleAction = (r: DailyReminderItem) => {
    setReminders((prev) =>
      prev.map((item) => (item.id === r.id ? { ...item, status: 'COMPLETED' } : item))
    );
    showToast(`Notice initiated for ${r.customer}!`, 'success');
  };

  const pendingCount = reminders.filter((r) => r.status === 'PENDING').length;
  const overdueCount = reminders.filter((r) => r.status === 'OVERDUE').length;

  return (
    <div className="page-content">
      <PageHeader
        title="Daily Follow-ups & Customer Reminders"
        subtitle="Actionable borrower contact tasks, interest collection alerts, and maturity payouts"
        icon={<Bell size={20} />}
      />

      {/* Quick Add Bar */}
      <Card style={{ marginBottom: '20px' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '5px' }}>
              Customer Name &amp; Phone
            </label>
            <input
              type="text"
              className="input-control"
              style={{ height: '38px', fontSize: '13px' }}
              placeholder="e.g. Ramesh Kumar, 9876543210"
              value={newCustomer}
              onChange={(e) => setNewCustomer(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '5px' }}>
              Loan / FD Reference
            </label>
            <input
              type="text"
              className="input-control"
              style={{ height: '38px', fontSize: '13px' }}
              placeholder="e.g. GL-001 or FD-005"
              value={newLoanFd}
              onChange={(e) => setNewLoanFd(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" icon={<Plus size={14} />}>
            Add Task
          </Button>
        </form>
      </Card>

      {/* Summary row */}
      {reminders.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {reminders.length} task(s) total
          </span>
          {pendingCount > 0 && <StatusBadge status="PENDING" label={`${pendingCount} Pending`} />}
          {overdueCount > 0 && <StatusBadge status="OVERDUE" label={`${overdueCount} Overdue`} />}
        </div>
      )}

      {/* Tasks Table */}
      <Card noPadding>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
                {['Customer', 'Loan / FD', 'Reminder Type', 'Due Date', 'Status', 'Action'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-secondary)', textAlign: i === 5 ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reminders.length > 0 ? (
                reminders.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="data-table-row">
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.customer}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--primary)' }}>{r.loanFd}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <StatusBadge status="PENDING" label={r.reminderType} />
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--text-secondary)' }}>{r.dueDate}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <Button
                        variant={r.status === 'COMPLETED' ? 'secondary' : 'primary'}
                        size="sm"
                        icon={r.status === 'COMPLETED' ? <CheckCircle2 size={13} /> : <PhoneCall size={13} />}
                        onClick={() => handleAction(r)}
                      >
                        {r.status === 'COMPLETED' ? 'Done' : 'Contact'}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)' }}>
                    <Bell size={32} style={{ opacity: 0.3, marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                    No daily follow-up tasks recorded. Add a task above to track follow-ups.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
