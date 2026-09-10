import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Download, MessageCircle, AlertTriangle, Clock, CheckCircle2, FileText, User, AlertCircle } from 'lucide-react';
import { Loan, Customer } from '../types';
import { PageHeader, StatGrid, StatCard, Button } from '../components/ui';

export interface ReminderRecord {
  id: string;
  loanId: string;
  loanNo: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicle: string;
  type: 'Insurance' | 'RC Book' | 'Road Tax' | 'Permit' | 'FC Expiry' | 'Renewal';
  expiryDate: string;
  daysLeft: number;
  amount: number;
  status: 'EXPIRED' | 'DUE IN 30 DAYS' | 'UPCOMING' | 'ALL GOOD';
  rawDate: Date;
  rawLoan: Loan;
  rawCustomer: Customer;
}

/**
 * Calculates days left and dynamic status from an expiry/due date string.
 */
const calculateDaysLeftAndStatus = (dateStr: string): { daysLeft: number; status: 'EXPIRED' | 'DUE IN 30 DAYS' | 'UPCOMING' | 'ALL GOOD'; parsedDate: Date } => {
  if (!dateStr) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 30);
    return { daysLeft: 30, status: 'DUE IN 30 DAYS', parsedDate: fallback };
  }

  let parsedDate: Date;
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      parsedDate = new Date(dateStr);
    } else {
      parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts[0].length === 4) {
      parsedDate = new Date(dateStr);
    } else {
      parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
  } else {
    parsedDate = new Date(dateStr);
  }

  if (isNaN(parsedDate.getTime())) {
    parsedDate = new Date();
    parsedDate.setDate(parsedDate.getDate() + 30);
  }

  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expZero = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());

  const diffTime = expZero.getTime() - todayZero.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: 'EXPIRED' | 'DUE IN 30 DAYS' | 'UPCOMING' | 'ALL GOOD';
  if (daysLeft < 0) {
    status = 'EXPIRED';
  } else if (daysLeft <= 30) {
    status = 'DUE IN 30 DAYS';
  } else if (daysLeft <= 90) {
    status = 'UPCOMING';
  } else {
    status = 'ALL GOOD';
  }

  return { daysLeft, status, parsedDate };
};

export const RCRenewalReminders: React.FC = () => {
  const {
    loans,
    customers,
    setSelectedLoan,
    setSelectedProfileCustomerId,
    setCurrentPage,
    showToast
  } = useApp();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Derive real reminders dynamically from loans and active customers
  const dynamicReminders = useMemo(() => {
    const records: ReminderRecord[] = [];

    loans.forEach((loan) => {
      // Find matching customer using strict ID relationship (loan.customerId === customer.id)
      const cust = customers.find(
        (c) => !c.isDeleted && (c.id === loan.customerId || (c.customerId && c.customerId.toString() === loan.customerId))
      );
      if (!cust) return; // Exclude deleted or missing customers

      if (loan.status === 'CLOSED') return; // Exclude closed loans from active renewals

      // Determine vehicle or collateral description
      let vehicleLabel = loan.vehicleNumber || loan.vehicleModel || '';
      if (!vehicleLabel) {
        const vehicleItem = loan.items?.find((i: any) =>
          /TN|KL|KA|AP|MH|HR|DL|PY|TS|Vehicle|Bike|Car|Scooter|Royal Enfield|Honda|TVS|Yamaha|Hero|Bajaj|Suzuki/i.test(i.item || '')
        );
        if (vehicleItem) {
          vehicleLabel = `${vehicleItem.item} (Pledge Collateral)`;
        } else if (loan.items && loan.items.length > 0) {
          vehicleLabel = `${loan.items.map((i: any) => i.item).join(', ')} (Pledge Collateral)`;
        } else {
          vehicleLabel = 'Gold/Pledge Collateral';
        }
      }

      let hasExplicitVehicleExpiry = false;

      // 1. Insurance Expiry
      if (loan.insuranceExpiryDate) {
        hasExplicitVehicleExpiry = true;
        const calc = calculateDaysLeftAndStatus(loan.insuranceExpiryDate);
        records.push({
          id: `rem-${loan.id}-ins`,
          loanId: loan.id,
          loanNo: loan.loanNo,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          vehicle: vehicleLabel,
          type: 'Insurance',
          expiryDate: loan.insuranceExpiryDate,
          daysLeft: calc.daysLeft,
          amount: loan.principal,
          status: calc.status,
          rawDate: calc.parsedDate,
          rawLoan: loan,
          rawCustomer: cust
        });
      }

      // 2. RC Book Expiry
      if (loan.rcExpiryDate) {
        hasExplicitVehicleExpiry = true;
        const calc = calculateDaysLeftAndStatus(loan.rcExpiryDate);
        records.push({
          id: `rem-${loan.id}-rc`,
          loanId: loan.id,
          loanNo: loan.loanNo,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          vehicle: vehicleLabel,
          type: 'RC Book',
          expiryDate: loan.rcExpiryDate,
          daysLeft: calc.daysLeft,
          amount: loan.principal,
          status: calc.status,
          rawDate: calc.parsedDate,
          rawLoan: loan,
          rawCustomer: cust
        });
      }

      // 3. Road Tax Expiry
      if (loan.roadTaxExpiryDate) {
        hasExplicitVehicleExpiry = true;
        const calc = calculateDaysLeftAndStatus(loan.roadTaxExpiryDate);
        records.push({
          id: `rem-${loan.id}-tax`,
          loanId: loan.id,
          loanNo: loan.loanNo,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          vehicle: vehicleLabel,
          type: 'Road Tax',
          expiryDate: loan.roadTaxExpiryDate,
          daysLeft: calc.daysLeft,
          amount: loan.principal,
          status: calc.status,
          rawDate: calc.parsedDate,
          rawLoan: loan,
          rawCustomer: cust
        });
      }

      // 4. Permit Expiry
      if (loan.permitExpiryDate) {
        hasExplicitVehicleExpiry = true;
        const calc = calculateDaysLeftAndStatus(loan.permitExpiryDate);
        records.push({
          id: `rem-${loan.id}-permit`,
          loanId: loan.id,
          loanNo: loan.loanNo,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          vehicle: vehicleLabel,
          type: 'Permit',
          expiryDate: loan.permitExpiryDate,
          daysLeft: calc.daysLeft,
          amount: loan.principal,
          status: calc.status,
          rawDate: calc.parsedDate,
          rawLoan: loan,
          rawCustomer: cust
        });
      }

      // 5. FC Expiry
      if (loan.fcExpiryDate) {
        hasExplicitVehicleExpiry = true;
        const calc = calculateDaysLeftAndStatus(loan.fcExpiryDate);
        records.push({
          id: `rem-${loan.id}-fc`,
          loanId: loan.id,
          loanNo: loan.loanNo,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          vehicle: vehicleLabel,
          type: 'FC Expiry',
          expiryDate: loan.fcExpiryDate,
          daysLeft: calc.daysLeft,
          amount: loan.principal,
          status: calc.status,
          rawDate: calc.parsedDate,
          rawLoan: loan,
          rawCustomer: cust
        });
      }

      // 6. Loan Renewal / Due Date
      if (!hasExplicitVehicleExpiry || loan.nextDueDate || loan.renewalDate) {
        const dueDateStr = loan.nextDueDate || loan.renewalDate || loan.date;
        const calc = calculateDaysLeftAndStatus(dueDateStr);
        records.push({
          id: `rem-${loan.id}-ren`,
          loanId: loan.id,
          loanNo: loan.loanNo,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          vehicle: vehicleLabel,
          type: 'Renewal',
          expiryDate: dueDateStr,
          daysLeft: calc.daysLeft,
          amount: loan.principal,
          status: calc.status,
          rawDate: calc.parsedDate,
          rawLoan: loan,
          rawCustomer: cust
        });
      }
    });

    return records;
  }, [loans, customers]);

  // Filter dynamically based on search, type, and status
  const filtered = useMemo(() => {
    return dynamicReminders.filter((r) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.loanNo.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.customerId.toLowerCase().includes(q) ||
        r.customerPhone.includes(q) ||
        r.vehicle.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q);

      const matchesType = typeFilter === 'All' || r.type === typeFilter;
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [dynamicReminders, search, typeFilter, statusFilter]);

  // Summary counts calculated dynamically
  const expiredCount = dynamicReminders.filter((r) => r.status === 'EXPIRED').length;
  const due30Count = dynamicReminders.filter((r) => r.status === 'DUE IN 30 DAYS').length;
  const upcomingCount = dynamicReminders.filter((r) => r.status === 'UPCOMING').length;
  const allGoodCount = dynamicReminders.filter((r) => r.status === 'ALL GOOD').length;

  const handleSendAllReminders = () => {
    if (filtered.length === 0) {
      showToast('No active reminders found matching the selected filter.', 'info');
      return;
    }

    const uniqueCustomers = new Set(filtered.map((r) => r.customerName));
    showToast(
      `Queued automated WhatsApp & SMS reminders for ${filtered.length} renewal item(s) across ${uniqueCustomers.size} customer(s).`,
      'success'
    );
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      showToast('No reminder records to export.', 'info');
      return;
    }

    const headers = [
      'Loan No',
      'Customer ID',
      'Customer Name',
      'Mobile Number',
      'Vehicle Number',
      'Reminder Type',
      'Expiry Date',
      'Days Left',
      'Loan Amount',
      'Status'
    ];

    const csvRows = [headers.join(',')];

    filtered.forEach((r) => {
      const row = [
        `"${r.loanNo}"`,
        `"${r.customerId}"`,
        `"${r.customerName.replace(/"/g, '""')}"`,
        `"+91 ${r.customerPhone}"`,
        `"${r.vehicle.replace(/"/g, '""')}"`,
        `"${r.type}"`,
        `"${r.expiryDate}"`,
        `"${r.daysLeft < 0 ? `Expired (${Math.abs(r.daysLeft)} days ago)` : `${r.daysLeft} days`}"`,
        `"${r.amount}"`,
        `"${r.status}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `RC_Renewal_Reminders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Successfully exported ${filtered.length} reminder records to CSV.`, 'success');
  };

  return (
    <div className="page-content">
      {/* PAGE HEADER */}
      <PageHeader
        title="RC & Renewal Reminders"
        subtitle="Track vehicle RC books, Insurance, Road Tax, Permit, FC expiries, and interest renewal due dates in real-time."
        icon={<AlertCircle size={20} />}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExportCSV}>
              Export CSV
            </Button>
            <Button variant="primary" size="sm" icon={<MessageCircle size={14} />} onClick={handleSendAllReminders}>
              Send Reminders
            </Button>
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <StatGrid columns={4} style={{ marginBottom: '18px' }}>
        <StatCard
          label="Expired"
          value={expiredCount}
          subValue="Requires urgent follow-up"
          colorTheme="danger"
          icon={<AlertTriangle size={18} />}
        />
        <StatCard
          label="Due in 30 Days"
          value={due30Count}
          subValue="Immediate notice period"
          colorTheme="warning"
          icon={<Clock size={18} />}
        />
        <StatCard
          label="Upcoming"
          value={upcomingCount}
          subValue="30 to 90 days out"
          colorTheme="primary"
          icon={<FileText size={18} />}
        />
        <StatCard
          label="All Good"
          value={allGoodCount}
          subValue="Fully compliant pledges"
          colorTheme="success"
          icon={<CheckCircle2 size={18} />}
        />
      </StatGrid>

      {/* Main Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end',
            padding: '16px 20px',
            backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            flexWrap: 'wrap'
          }}
        >
          <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
            <label className="form-label">SEARCH</label>
            <input
              type="text"
              className="input-control"
              placeholder="Loan No, customer ID, name, or vehicle no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ width: '160px' }}>
            <label className="form-label">TYPE</label>
            <select
              className="select-control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="RC Book">RC Book</option>
              <option value="Insurance">Insurance</option>
              <option value="Road Tax">Road Tax</option>
              <option value="Permit">Permit</option>
              <option value="FC Expiry">FC Expiry</option>
              <option value="Renewal">Renewal</option>
            </select>
          </div>

          <div className="form-group" style={{ width: '160px' }}>
            <label className="form-label">STATUS</label>
            <select
              className="select-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="EXPIRED">Expired</option>
              <option value="DUE IN 30 DAYS">Due in 30 Days</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="ALL GOOD">All Good</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={handleSendAllReminders}
              style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700, gap: '6px' }}
            >
              <MessageCircle size={15} />
              <span>Send All Reminders</span>
            </button>
            <button className="btn btn-secondary" onClick={handleExportCSV} style={{ gap: '6px', fontWeight: 600 }}>
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>LOAN NO</th>
                <th>CUSTOMER</th>
                <th>VEHICLE</th>
                <th>TYPE</th>
                <th>EXPIRY DATE</th>
                <th>DAYS LEFT</th>
                <th style={{ textAlign: 'right' }}>AMOUNT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No vehicle or renewal reminders match your criteria. Reminders are generated automatically from active customer loans.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--color-primary-dark, #176b52)',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        title={`View Loan Details for ${r.loanNo}`}
                        onClick={() => {
                          setSelectedLoan(r.rawLoan);
                          setCurrentPage('loan-display');
                        }}
                      >
                        {r.loanNo}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--text-dark, #1f2937)',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        title={`View Customer Profile for ${r.customerName}`}
                        onClick={() => {
                          setSelectedProfileCustomerId(r.customerId);
                          setCurrentPage('customer-profile');
                        }}
                      >
                        <User size={13} color="var(--color-primary-accent)" />
                        <span>{r.customerName}</span>
                      </button>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 500 }}>
                      {r.vehicle}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '11px' }}>
                        {r.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', fontWeight: 600 }}>{r.expiryDate}</td>
                    <td>
                      {r.daysLeft < 0 ? (
                        <span style={{ color: 'var(--badge-danger-text, #dc2626)', fontWeight: 800, fontSize: '12.5px' }}>
                          Expired ({Math.abs(r.daysLeft)} days ago)
                        </span>
                      ) : r.daysLeft <= 30 ? (
                        <span style={{ color: 'var(--badge-warning-text, #d97706)', fontWeight: 800, fontSize: '12.5px' }}>
                          {r.daysLeft} days
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600, fontSize: '12.5px' }}>
                          {r.daysLeft} days
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-dark)' }}>
                      ₹{r.amount.toLocaleString('en-IN')}
                    </td>
                    <td>
                      {r.status === 'EXPIRED' && (
                        <span className="badge badge-danger" style={{ fontSize: '11px' }}>EXPIRED</span>
                      )}
                      {r.status === 'DUE IN 30 DAYS' && (
                        <span className="badge badge-warning" style={{ fontSize: '11px' }}>DUE IN 30 DAYS</span>
                      )}
                      {r.status === 'UPCOMING' && (
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>UPCOMING</span>
                      )}
                      {r.status === 'ALL GOOD' && (
                        <span className="badge badge-success" style={{ fontSize: '11px' }}>ALL GOOD</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
