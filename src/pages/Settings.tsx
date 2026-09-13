import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Save,
  Percent,
  Building,
  Shield,
  Printer,
  UserPlus,
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  Edit2,
  Clock,
  Coins,
  X,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserProfile, UserRole, UserPermissions } from '../types';
import {
  MASTER_ADMIN_EMAIL,
  getDefaultPermissionsForRole,
  normalizePermissions,
  isAdminRole
} from '../config/permissions';
import { LoanConfigurationSection } from '../components/admin/LoanConfigurationSection';

export const PERMISSION_MODULES = [
  {
    key: 'customers',
    label: 'Customers',
    description: 'Profiles, KYC verification, customer search',
    actions: ['view', 'create', 'update', 'delete']
  },
  {
    key: 'loans',
    label: 'Loan Operations',
    description: 'Gold & silver loans, disbursements, pledges, close loan',
    actions: ['view', 'create', 'update', 'delete', 'approve']
  },
  {
    key: 'receipts',
    label: 'Receipts & Repayments',
    description: 'Repayment receipts, interest collections, payment vouchers',
    actions: ['view', 'create', 'update', 'delete']
  },
  {
    key: 'fd',
    label: 'Fixed Deposits',
    description: 'Deposit contracts, interest payouts, withdrawals',
    actions: ['view', 'create', 'update', 'delete']
  },
  {
    key: 'accounting',
    label: 'Accounting & Ledgers',
    description: 'Day Book, trial balance, profit & loss, balance sheet',
    actions: ['view', 'create', 'update', 'delete']
  },
  {
    key: 'rental',
    label: 'Rental Management',
    description: 'Commercial complexes, shops, tenants, rent collections',
    actions: ['view', 'create', 'update', 'delete', 'approve']
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    description: 'Audit statements, financial summaries, CSV/PDF export',
    actions: ['view', 'export']
  },
  {
    key: 'staffManagement',
    label: 'Staff Management',
    description: 'Manage staff accounts, roles, security permissions',
    actions: ['view', 'create', 'update', 'delete']
  },
  {
    key: 'settings',
    label: 'Branch Settings',
    description: 'Branch configuration, interest rates, master controls',
    actions: ['view', 'update']
  }
];

export const Settings: React.FC = () => {
  const {
    showToast,
    userRole,
    staffList,
    fetchStaffList,
    createStaffAccount,
    updateStaffProfile,
    toggleStaffStatus,
    resetStaffPassword,
    deleteStaffAccount,
    fetchStaffAuditLogs,
    masterControlSettings,
    updateMasterControlSettings,
    updateFDInterestRate,
    setCurrentPage
  } = useApp();

  const isMasterAdmin = isAdminRole(userRole);

  const [activeTab, setActiveTab] = useState<'branch' | 'financial' | 'loan-types' | 'security' | 'printer'>('branch');

  const [branchName, setBranchName] = useState('KKV GOLD FINANCE - MAIN BRANCH');
  const [address, setAddress] = useState('104 G.S.T Road, Chennai - 600045');
  const [phone, setPhone] = useState('+91 44 2233 4455');
  const [gstin, setGstin] = useState('33AAAAA0000A1Z5');

  // Financial Lending & Valuation Parameters
  const [goldRate22ct, setGoldRate22ct] = useState(() => String(masterControlSettings?.goldRate22ct || 6400));
  const [defaultInterestRate, setDefaultInterestRate] = useState(() => String(masterControlSettings?.goldLoanMonthlyRate || 2.0));
  const [cardFeeAmount, setCardFeeAmount] = useState(() => String(masterControlSettings?.defaultCardFee || 10));

  // FD Master Defaults State
  const [fdRateInput, setFdRateInput] = useState(() => String(masterControlSettings?.fdInterestRate ?? 12));
  const [fdTenureInput, setFdTenureInput] = useState(() => String(masterControlSettings?.fdDefaultTenureMonths ?? 12));
  const [fdMinAmountInput, setFdMinAmountInput] = useState(() => String(masterControlSettings?.fdMinimumAmount ?? 5000));
  const [fdRenewalPolicyInput, setFdRenewalPolicyInput] = useState(() => masterControlSettings?.fdRenewalPolicy || 'MANUAL');
  const [fdCalculationMethodInput, setFdCalculationMethodInput] = useState(() => masterControlSettings?.fdCalculationMethod || 'MONTHLY_DIVIDEND');
  const [fdRateEffectiveDate, setFdRateEffectiveDate] = useState(() =>
    masterControlSettings?.fdInterestRateEffectiveFrom || new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
  );
  const [fdRateNotes, setFdRateNotes] = useState('');
  const [showFdRateConfirmModal, setShowFdRateConfirmModal] = useState(false);

  const [printerFormat, setPrinterFormat] = useState('A4 Laser Standard');

  useEffect(() => {
    if (masterControlSettings?.goldRate22ct) {
      setGoldRate22ct(String(masterControlSettings.goldRate22ct));
    }
    if (masterControlSettings?.goldLoanMonthlyRate) {
      setDefaultInterestRate(String(masterControlSettings.goldLoanMonthlyRate));
    }
    if (masterControlSettings?.defaultCardFee !== undefined) {
      setCardFeeAmount(String(masterControlSettings.defaultCardFee));
    }
    if (masterControlSettings?.fdInterestRate !== undefined) {
      setFdRateInput(String(masterControlSettings.fdInterestRate));
    }
    if (masterControlSettings?.fdDefaultTenureMonths !== undefined) {
      setFdTenureInput(String(masterControlSettings.fdDefaultTenureMonths));
    }
    if (masterControlSettings?.fdMinimumAmount !== undefined) {
      setFdMinAmountInput(String(masterControlSettings.fdMinimumAmount));
    }
    if (masterControlSettings?.fdRenewalPolicy) {
      setFdRenewalPolicyInput(masterControlSettings.fdRenewalPolicy);
    }
    if (masterControlSettings?.fdCalculationMethod) {
      setFdCalculationMethodInput(masterControlSettings.fdCalculationMethod);
    }
  }, [masterControlSettings]);

  // Staff Search & Filter State
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [managingStaff, setManagingStaff] = useState<UserProfile | null>(null);

  // Add Staff Form State
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<'STAFF' | 'RENTAL_STAFF'>('STAFF');
  const [addPhone, setAddPhone] = useState('');
  const [addDepartment, setAddDepartment] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addConfirmPassword, setAddConfirmPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showAddConfirmPassword, setShowAddConfirmPassword] = useState(false);
  const [customPerms, setCustomPerms] = useState<UserPermissions>(getDefaultPermissionsForRole('STAFF'));
  const [createdStaffSummary, setCreatedStaffSummary] = useState<{
    name: string;
    staffId: string;
    email: string;
    role: string;
  } | null>(null);

  // Edit Staff State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<'STAFF' | 'RENTAL_STAFF'>('STAFF');
  const [editPerms, setEditPerms] = useState<UserPermissions>(getDefaultPermissionsForRole('STAFF'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Password Modal State
  const [resetStaffTarget, setResetStaffTarget] = useState<UserProfile | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    if (activeTab === 'security') {
      fetchStaffList();
      fetchStaffAuditLogs();
    }
  }, [activeTab]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Branch settings saved successfully!', 'success');
  };

  const handleSaveFinancial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMasterAdmin) {
      showToast('Permission denied. Only Master Admin can modify financial settings.', 'error');
      return;
    }

    const rate = Number(goldRate22ct) || 6400;
    const loanRate = Number(defaultInterestRate) || 2.0;
    const fee = Number(cardFeeAmount) || 10;
    const newFdRate = parseFloat(fdRateInput);

    // If FD rate has been changed, trigger confirmation modal for audit safety
    const currentFdRate = masterControlSettings?.fdInterestRate ?? 12;
    if (!isNaN(newFdRate) && newFdRate !== currentFdRate) {
      setShowFdRateConfirmModal(true);
      return;
    }

    updateMasterControlSettings({
      goldRate22ct: rate,
      goldLoanMonthlyRate: loanRate,
      defaultCardFee: fee,
      fdInterestRate: !isNaN(newFdRate) ? newFdRate : (masterControlSettings?.fdInterestRate ?? 12),
      fdDefaultTenureMonths: Number(fdTenureInput) || 12,
      fdMinimumAmount: Number(fdMinAmountInput) || 5000,
      fdRenewalPolicy: fdRenewalPolicyInput,
      fdCalculationMethod: fdCalculationMethodInput
    });
    showToast('Master Control financial parameters saved successfully!', 'success');
  };

  const handleConfirmFdRateChange = () => {
    const numRate = parseFloat(fdRateInput);
    if (isNaN(numRate) || numRate <= 0 || numRate > 36) {
      showToast('Please enter a valid interest rate between 0.25% and 36.00% p.a.', 'error');
      return;
    }

    const ok = updateFDInterestRate(numRate, fdRateEffectiveDate, fdRateNotes);
    if (ok) {
      // Also save the gold, loan and FD parameters
      updateMasterControlSettings({
        goldRate22ct: Number(goldRate22ct) || 6400,
        goldLoanMonthlyRate: Number(defaultInterestRate) || 2.0,
        defaultCardFee: Number(cardFeeAmount) || 10,
        fdInterestRate: numRate,
        fdDefaultTenureMonths: Number(fdTenureInput) || 12,
        fdMinimumAmount: Number(fdMinAmountInput) || 5000,
        fdRenewalPolicy: fdRenewalPolicyInput,
        fdCalculationMethod: fdCalculationMethodInput
      });
      setShowFdRateConfirmModal(false);
      setFdRateNotes('');
    }
  };

  const handleRoleChangeForAdd = (role: 'STAFF' | 'RENTAL_STAFF') => {
    setAddRole(role);
    setCustomPerms(getDefaultPermissionsForRole(role));
  };

  const handleRoleChangeForEdit = (role: 'STAFF' | 'RENTAL_STAFF') => {
    setEditRole(role);
    setEditPerms(getDefaultPermissionsForRole(role));
  };

  const handleOpenAddStaff = () => {
    setAddName('');
    setAddEmail('');
    setAddRole('STAFF');
    setAddPhone('');
    setAddDepartment('Finance Operations');
    setAddPassword('');
    setAddConfirmPassword('');
    setShowAddPassword(false);
    setShowAddConfirmPassword(false);
    setCreatedStaffSummary(null);
    setCustomPerms(getDefaultPermissionsForRole('STAFF'));
    setIsAddStaffModalOpen(true);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) {
      showToast('Please enter full name and email address.', 'warning');
      return;
    }

    if (!addPassword) {
      showToast('Initial password is required.', 'warning');
      return;
    }

    if (addPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'warning');
      return;
    }

    if (addPassword !== addConfirmPassword) {
      showToast('Passwords do not match. Please verify and retry.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const res = await createStaffAccount({
      email: addEmail.trim().toLowerCase(),
      displayName: addName.trim(),
      fullName: addName.trim(),
      role: addRole,
      phone: addPhone.trim(),
      department: addDepartment.trim() || (addRole === 'RENTAL_STAFF' ? 'Rental Management' : 'Finance Operations'),
      permissions: customPerms,
      password: addPassword.trim()
    });
    setIsSubmitting(false);

    if (res.success) {
      setCreatedStaffSummary({
        name: addName.trim(),
        staffId: res.data?.staffId || 'KKV-STAFF-NEW',
        email: addEmail.trim().toLowerCase(),
        role: addRole
      });
    }
  };

  const handleOpenManageStaff = (staff: UserProfile) => {
    setManagingStaff(staff);
    setEditName(staff.displayName || staff.fullName || '');
    setEditPhone(staff.phone || '');
    setEditDepartment((staff as any).department || '');
    const currentRole = staff.role === 'RENTAL_STAFF' ? 'RENTAL_STAFF' : 'STAFF';
    setEditRole(currentRole);
    setEditPerms(normalizePermissions(staff.permissions, currentRole));
  };

  const handleSaveEditStaff = async () => {
    if (!managingStaff) return;
    setIsSubmitting(true);
    const res = await updateStaffProfile(managingStaff.uid, {
      displayName: editName.trim(),
      fullName: editName.trim(),
      phone: editPhone.trim(),
      department: editDepartment.trim(),
      role: isAdminRole(managingStaff.role) ? 'ADMIN' : editRole,
      permissions: editPerms
    });
    setIsSubmitting(false);
    if (res.success) {
      setManagingStaff(null);
    }
  };

  const handleOpenResetPasswordModal = (staff: UserProfile) => {
    setResetStaffTarget(staff);
    setResetNewPassword('');
    setResetConfirmPassword('');
    setShowResetNewPassword(false);
    setShowResetConfirmPassword(false);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaffTarget) return;

    if (!resetNewPassword) {
      showToast('New password is required.', 'warning');
      return;
    }

    if (resetNewPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'warning');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      showToast('Passwords do not match. Please verify and retry.', 'warning');
      return;
    }

    setIsResettingPassword(true);
    const targetId = resetStaffTarget.uid || resetStaffTarget.id || resetStaffTarget.staffId || '';
    const res = await resetStaffPassword(targetId, resetNewPassword.trim());
    setIsResettingPassword(false);

    if (res.success) {
      setResetStaffTarget(null);
      setResetNewPassword('');
      setResetConfirmPassword('');
    }
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.displayName.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(staffSearch.toLowerCase()) ||
      ((s.staffId || '').toLowerCase().includes(staffSearch.toLowerCase()));
    const matchesRole = staffRoleFilter === 'ALL' || s.role === staffRoleFilter;
    return matchesSearch && matchesRole;
  });

  const fdHistory = masterControlSettings?.fdInterestRateHistory || [];

  if (!isMasterAdmin) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ padding: '40px 32px', textAlign: 'center', maxWidth: '520px', width: '100%' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Shield size={28} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
            Settings and system configuration are restricted strictly to <strong>Master Admin</strong>. Operational staff accounts do not have permission to access this area.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCurrentPage('dashboard')}
            style={{ margin: '0 auto' }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* ════════════════════════════════════════════════════════════════════════
          SETTINGS NAVIGATION TABS
          ════════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${activeTab === 'branch' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('branch')}
        >
          <Building size={14} />
          <span>Branch Profile</span>
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'printer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('printer')}
        >
          <Printer size={14} />
          <span>Voucher Printer</span>
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'security' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('security')}
        >
          <Shield size={14} />
          <span>Security &amp; Staff</span>
        </button>
      </div>

      {/* ── LOAN TYPES TAB ── */}
      {activeTab === 'loan-types' && (
        <div>
          <LoanConfigurationSection />
        </div>
      )}

      {/* ── 1. BRANCH PROFILE TAB ── */}
      {activeTab === 'branch' && (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  <Building size={18} color="var(--color-primary-accent)" />
                  <span>Branch &amp; Company Profile</span>
                </h2>
                <p className="card-description">Official header details displayed on disbursement receipts and FD certificates</p>
              </div>
              <span className="badge badge-success">Branch #01 Active</span>
            </div>

            <div className="grid-2" style={{ marginBottom: '14px' }}>
              <div className="form-group">
                <label className="form-label required">Branch Business Title</label>
                <input
                  type="text"
                  className="input-control"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Official Phone</label>
                <input
                  type="text"
                  className="input-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label required">Branch Address &amp; Pincode</label>
                <input
                  type="text"
                  className="input-control"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">GSTIN / Registration No</label>
                <input
                  type="text"
                  className="input-control"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              All settings apply across all branch cash counters and appraisal desks.
            </span>
            <button type="submit" className="btn btn-primary btn-lg">
              <Save size={16} />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* ── 2. GOLD RATES & RATES TAB ── */}
      {activeTab === 'financial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <form onSubmit={handleSaveFinancial} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '22px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-dark)', letterSpacing: '0.01em' }}>
                    CENTRAL MASTER CONTROL
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                    Authoritative global single source of truth for gold valuation, loan defaults, and Fixed Deposit parameters.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px' }}>
                    Config Version: v{masterControlSettings?.configurationVersion || 1}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* ════════════════════════════════════════════════════════════════════════
                    SECTION 1: GOLD & VALUATION
                    ════════════════════════════════════════════════════════════════════════ */}
                <div style={{ padding: '18px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Coins size={18} color="var(--color-gold-primary, #dfb83d)" />
                    <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      GOLD &amp; VALUATION
                    </h3>
                  </div>

                  <div className="form-group" style={{ margin: 0, maxWidth: '400px' }}>
                    <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>
                      22CT GOLD RATE (₹ / GRAM) *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
                      <input
                        type="number"
                        className="input-control"
                        style={{ paddingLeft: '28px', height: '38px', fontSize: '14px', fontWeight: 700 }}
                        value={goldRate22ct}
                        onChange={(e) => setGoldRate22ct(e.target.value)}
                        required
                        disabled={!isMasterAdmin}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Used for gold/ornament market valuation and collateral calculations across new Gold Loans.
                    </span>
                  </div>
                </div>

                {/* ════════════════════════════════════════════════════════════════════════
                    SECTION 2: LOAN DEFAULTS
                    ════════════════════════════════════════════════════════════════════════ */}
                <div style={{ padding: '18px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Percent size={18} color="var(--color-primary-accent, #10B981)" />
                    <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      LOAN DEFAULTS
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>
                        DEFAULT MONTHLY LOAN INTEREST (%) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input-control"
                        style={{ height: '38px', fontSize: '13.5px' }}
                        value={defaultInterestRate}
                        onChange={(e) => setDefaultInterestRate(e.target.value)}
                        required
                        disabled={!isMasterAdmin}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Default global base interest percentage per month for loans inheriting Master Control.
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>
                        CARD PROCESSING FEE (₹)
                      </label>
                      <input
                        type="number"
                        className="input-control"
                        style={{ height: '38px', fontSize: '13.5px' }}
                        value={cardFeeAmount}
                        onChange={(e) => setCardFeeAmount(e.target.value)}
                        required
                        disabled={!isMasterAdmin}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Default global card and passbook issuance processing fee.
                      </span>
                    </div>
                  </div>
                </div>

                {/* ════════════════════════════════════════════════════════════════════════
                    SECTION 3: FIXED DEPOSIT DEFAULTS
                    ════════════════════════════════════════════════════════════════════════ */}
                <div style={{ padding: '18px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Percent size={18} color="var(--color-primary-dark, #176B52)" />
                      <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        FIXED DEPOSIT DEFAULTS
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11.5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)', fontWeight: 700 }}>
                        Active Default: {(masterControlSettings?.fdInterestRate ?? 12).toFixed(2)}% p.a.
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>
                        DEFAULT FD INTEREST RATE (% P.A.) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-control"
                        style={{ height: '38px', fontSize: '14px', fontWeight: 700 }}
                        value={fdRateInput}
                        onChange={(e) => setFdRateInput(e.target.value)}
                        required
                        disabled={!isMasterAdmin}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Default annual rate applied to NEW Fixed Deposits.
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>
                        DEFAULT FD TENURE (MONTHS) *
                      </label>
                      <input
                        type="number"
                        className="input-control"
                        style={{ height: '38px', fontSize: '13.5px' }}
                        value={fdTenureInput}
                        onChange={(e) => setFdTenureInput(e.target.value)}
                        min={1}
                        max={120}
                        required
                        disabled={!isMasterAdmin}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Default deposit tenure for new deposit creation.
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>
                        MINIMUM FD AMOUNT (₹) *
                      </label>
                      <input
                        type="number"
                        className="input-control"
                        style={{ height: '38px', fontSize: '13.5px' }}
                        value={fdMinAmountInput}
                        onChange={(e) => setFdMinAmountInput(e.target.value)}
                        min={0}
                        required
                        disabled={!isMasterAdmin}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Minimum allowable deposit principal for new FD accounts.
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                        RENEWAL POLICY
                      </label>
                      <select
                        className="input-control"
                        style={{ height: '38px', fontSize: '13px' }}
                        value={fdRenewalPolicyInput}
                        onChange={(e) => setFdRenewalPolicyInput(e.target.value)}
                        disabled={!isMasterAdmin}
                      >
                        <option value="MANUAL">Manual Renewal on Maturity</option>
                        <option value="AUTO_RENEW_PRINCIPAL">Auto-Renew Principal Only</option>
                        <option value="AUTO_RENEW_ALL">Auto-Renew Principal + Interest</option>
                      </select>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Default maturity rollover policy for Fixed Deposits.
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                        PAYOUT / COMPOUNDING METHOD
                      </label>
                      <select
                        className="input-control"
                        style={{ height: '38px', fontSize: '13px' }}
                        value={fdCalculationMethodInput}
                        onChange={(e) => setFdCalculationMethodInput(e.target.value)}
                        disabled={!isMasterAdmin}
                      >
                        <option value="MONTHLY_DIVIDEND">Monthly Dividend Payout</option>
                        <option value="QUARTERLY_COMPOUNDING">Quarterly Compounding</option>
                        <option value="CUMULATIVE_AT_MATURITY">Cumulative at Maturity</option>
                        <option value="SIMPLE">Simple Interest</option>
                      </select>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Default interest calculation schedule.
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                        EFFECTIVE DATE
                      </label>
                      <input
                        type="text"
                        className="input-control"
                        style={{ height: '38px', fontSize: '13px' }}
                        value={fdRateEffectiveDate}
                        onChange={(e) => setFdRateEffectiveDate(e.target.value)}
                        placeholder="DD-MM-YYYY"
                        disabled={!isMasterAdmin}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Date from which this new default rate applies to new deposits.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '22px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '12px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  {isMasterAdmin ? 'Changes here affect future loan collateral valuations and new deposit contracts.' : '🔒 View Only Mode — Master Admin permission required to edit.'}
                </span>
                {isMasterAdmin && (
                  <button type="submit" className="btn btn-primary" style={{ fontWeight: 700, padding: '9px 24px' }}>
                    <Save size={16} />
                    <span>Save Settings</span>
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* ════════════════════════════════════════════════════════════════════════
              SECTION 4: FD INTEREST RATE HISTORY & AUDIT TRAIL
              ════════════════════════════════════════════════════════════════════════ */}
          {fdHistory.length > 0 && (
            <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Clock size={16} color="var(--color-primary-accent)" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-dark)' }}>
                  FD INTEREST RATE HISTORY &amp; AUDIT TRAIL
                </h3>
              </div>

              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '12.5px', minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th>EFFECTIVE DATE</th>
                      <th>NEW RATE (% P.A.)</th>
                      <th>PREVIOUS RATE</th>
                      <th>CHANGED BY</th>
                      <th>NOTES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fdHistory.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong style={{ color: 'var(--text-dark)' }}>{item.effectiveFrom}</strong>
                          {item.effectiveTo && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                              to {item.effectiveTo}
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                            {item.rate.toFixed(2)}%
                          </span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {item.previousRate !== undefined ? `${item.previousRate.toFixed(2)}%` : '—'}
                          </span>
                        </td>
                        <td>
                          <span>{item.changedBy || 'Master Admin'}</span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-secondary)' }}>{item.notes || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. VOUCHER PRINTER TAB ── */}
      {activeTab === 'printer' && (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  <Printer size={18} color="var(--color-primary-accent)" />
                  <span>Receipt Voucher &amp; Certificate Template</span>
                </h2>
                <p className="card-description">Configure print paper format and signature labels</p>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Default Printer Layout</label>
                <select
                  className="select-control"
                  value={printerFormat}
                  onChange={(e) => setPrinterFormat(e.target.value)}
                >
                  <option value="A4 Laser Standard">A4 Laser Standard (Dual Copy)</option>
                  <option value="Thermal Roll 80mm">Thermal Roll 80mm</option>
                  <option value="Dot Matrix Continuous">Dot Matrix Continuous Slip</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Auto-Print On Disbursement</label>
                <select className="select-control">
                  <option value="yes">Yes (Immediate Print Dialog)</option>
                  <option value="no">No (Manual Print Click)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              All settings apply across all branch cash counters and appraisal desks.
            </span>
            <button type="submit" className="btn btn-primary btn-lg">
              <Save size={16} />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* ── 4. SECURITY & STAFF MANAGEMENT (Master Admin Protected) ── */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Master Account Banner Card */}
          <div
            className="card"
            style={{
              border: '1px solid rgba(201, 162, 39, 0.4)',
              background: 'linear-gradient(135deg, rgba(201, 162, 39, 0.08) 0%, rgba(13, 40, 24, 0.5) 100%)',
              padding: '20px 24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-gold-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--color-gold-primary)'
                  }}
                >
                  <Shield size={22} color="var(--color-gold-primary)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      PRIMARY MASTER ACCOUNT
                    </h3>
                    <span
                      style={{
                        fontSize: '11px',
                        background: 'var(--color-gold-subtle)',
                        color: 'var(--color-gold-light)',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 800,
                        border: '1px solid rgba(201, 162, 39, 0.3)'
                      }}
                    >
                      👑 MASTER ADMIN
                    </span>
                    <span className="badge badge-success">● ACTIVE</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Email: <strong style={{ color: 'var(--text-primary)' }}>{MASTER_ADMIN_EMAIL}</strong>
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-gold-light)', fontWeight: 600 }}>
                  🔒 Protected Root System Account (Full Application Control)
                </span>
              </div>
            </div>
          </div>

          {/* Staff Directory Section */}
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 className="card-title">
                  <Shield size={18} color="var(--color-primary-accent)" />
                  <span>Staff &amp; Role-Based Access Control</span>
                </h2>
                <p className="card-description">
                  Manage operator, manager, and administrative branch accounts and configure custom feature permissions
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    fetchStaffList();
                    fetchStaffAuditLogs();
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
                {isMasterAdmin && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleOpenAddStaff}
                  >
                    <UserPlus size={14} />
                    <span>+ Add Staff</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search
                  size={15}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  className="input-control"
                  style={{ paddingLeft: '34px', height: '36px' }}
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(['ALL', 'STAFF', 'RENTAL_STAFF'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`btn btn-sm ${staffRoleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '11.5px', padding: '4px 12px', borderRadius: 'var(--radius-full)' }}
                    onClick={() => setStaffRoleFilter(r)}
                  >
                    {r === 'RENTAL_STAFF' ? 'RENTAL STAFF' : r}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff Table */}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff ID</th>
                    <th>Staff Name &amp; Email</th>
                    <th>Mobile</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Created Date</th>
                    <th>Last Login</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No staff members found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((staff) => {
                      const isMaster = staff.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
                      const staffId = staff.staffId || staff.id || staff.uid;
                      const department = (staff as any).department || (staff.role === 'RENTAL_STAFF' ? 'Rental Management' : 'Finance Operations');
                      return (
                        <tr key={staff.uid}>
                          <td>
                            <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--color-gold-light)', letterSpacing: '0.02em' }}>
                              {staffId}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {staff.displayName} {isMaster && '👑'}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {staff.email}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {staff.phone || (staff as any).phoneNumber || '—'}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '4px',
                                backgroundColor:
                                  staff.role === 'ADMIN'
                                    ? 'var(--color-gold-subtle)'
                                    : staff.role === 'RENTAL_STAFF'
                                    ? 'rgba(201, 162, 39, 0.15)'
                                    : 'rgba(59, 130, 246, 0.15)',
                                color:
                                  staff.role === 'ADMIN'
                                    ? 'var(--color-gold-light)'
                                    : staff.role === 'RENTAL_STAFF'
                                    ? 'var(--color-gold-light)'
                                    : '#60a5fa'
                              }}
                            >
                              {staff.role === 'RENTAL_STAFF' ? 'RENTAL STAFF' : staff.role}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {department}
                            </span>
                          </td>
                          <td>
                            {staff.isActive ? (
                              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle size={10} /> Active
                              </span>
                            ) : (
                              <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <XCircle size={10} /> Inactive
                              </span>
                            )}
                          </td>
                          <td>{staff.createdAt ? new Date(staff.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                          <td>{staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleDateString('en-GB') : 'Never'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleOpenManageStaff(staff)}
                                title="Edit Role &amp; Permissions"
                              >
                                <Edit2 size={12} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleOpenResetPasswordModal(staff)}
                                title="Reset Staff Password"
                              >
                                <Key size={12} />
                                <span>Reset Pass</span>
                              </button>
                              {!isMaster && (
                                <button
                                  type="button"
                                  className={`btn btn-xs ${staff.isActive ? 'btn-secondary' : 'btn-primary'}`}
                                  onClick={() => toggleStaffStatus(staff.uid, !staff.isActive)}
                                  title={staff.isActive ? 'Deactivate Account' : 'Activate Account'}
                                >
                                  {staff.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                              {!isMaster && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  style={{ color: '#ef4444' }}
                                  onClick={() => deleteStaffAccount(staff.uid)}
                                  title="Delete Staff"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL: CHANGE DEFAULT FD INTEREST RATE CONFIRMATION
          ════════════════════════════════════════════════════════════════════════ */}
      {showFdRateConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              border: '1px solid var(--border-light)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Percent size={18} color="var(--color-primary-accent)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
                  CHANGE DEFAULT FD INTEREST RATE?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFdRateConfirmModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Current Default Rate:</span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--text-dark)' }}>{(masterControlSettings?.fdInterestRate ?? 12).toFixed(2)}% p.a.</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>New Default Rate:</span>
                  <strong style={{ fontSize: '14px', color: 'var(--color-primary-dark)' }}>{parseFloat(fdRateInput).toFixed(2)}% p.a.</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Effective Date:</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-dark)' }}>{fdRateEffectiveDate}</strong>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Reason / Regulatory Reference Notes (Optional)
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Revised quarterly benchmark interest policy"
                  value={fdRateNotes}
                  onChange={(e) => setFdRateNotes(e.target.value)}
                  style={{ height: '36px', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ padding: '10px 14px', backgroundColor: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)', borderRadius: '8px', fontSize: '12px', border: '1px solid rgba(210, 168, 74, 0.3)' }}>
                <strong>Important Policy Notice:</strong> This change applies <strong>ONLY to NEW Fixed Deposits</strong> created on or after the effective date. Existing FD contracts retain their original contractual interest rate and dividend payout schedules.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowFdRateConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmFdRateChange}
                style={{ fontWeight: 700 }}
              >
                Confirm &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD STAFF ── */}
      {isAddStaffModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="var(--color-primary-accent)" />
                <h3 className="card-title" style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Create New Staff Account</h3>
              </div>
              <button type="button" onClick={() => setIsAddStaffModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {createdStaffSummary ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px 18px', borderRadius: '10px', color: '#10B981' }}>
                  <CheckCircle size={22} />
                  <div>
                    <strong style={{ fontSize: '14px', display: 'block' }}>Staff Account Created Successfully!</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Permanent login credentials have been saved securely in MongoDB.</span>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: 'var(--color-gold-light)', textTransform: 'uppercase' }}>
                    Created Account Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Full Name</span>
                      <strong>{createdStaffSummary.name}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Staff ID</span>
                      <strong style={{ color: 'var(--color-gold-light)' }}>{createdStaffSummary.staffId}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Email</span>
                      <strong>{createdStaffSummary.email}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Assigned Role</span>
                      <strong style={{ color: '#60a5fa' }}>{createdStaffSummary.role}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(210, 168, 74, 0.1)', border: '1px solid rgba(210, 168, 74, 0.3)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  🔒 <strong>Credential Notice:</strong> Ask the staff member to use the password provided during account creation. Login identifier supports either <strong>Email</strong> or <strong>Staff ID ({createdStaffSummary.staffId})</strong>.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleOpenAddStaff}
                  >
                    + Create Another Staff
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setIsAddStaffModalOpen(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Section 1: Staff Account */}
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 800, color: 'var(--color-gold-light)', textTransform: 'uppercase' }}>
                    1. Staff Account Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>Full Name</label>
                      <input type="text" className="input-control" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Ramesh Kumar" required />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>Email Address</label>
                      <input type="email" className="input-control" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="staff@kkvgoldfinance.com" required />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Mobile Number</label>
                      <input type="tel" className="input-control" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="9876543210" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>Role</label>
                      <select className="select-control" value={addRole} onChange={(e) => handleRoleChangeForAdd(e.target.value as any)}>
                        <option value="STAFF">STAFF (Finance Operations &amp; Cash Counter)</option>
                        <option value="RENTAL_STAFF">RENTAL_STAFF (Commercial Complexes &amp; Rent Collections)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Department</label>
                      <input type="text" className="input-control" value={addDepartment} onChange={(e) => setAddDepartment(e.target.value)} placeholder="e.g. Finance Operations / Rental Management" />
                    </div>
                  </div>
                </div>

                {/* Section 2: Login Credentials */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 800, color: 'var(--color-gold-light)', textTransform: 'uppercase' }}>
                    2. Login Credentials
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>Initial Password *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showAddPassword ? 'text' : 'password'}
                          className="input-control"
                          style={{ paddingRight: '36px' }}
                          value={addPassword}
                          onChange={(e) => setAddPassword(e.target.value)}
                          placeholder="Min 8 characters"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowAddPassword(!showAddPassword)}
                          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>Confirm Password *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showAddConfirmPassword ? 'text' : 'password'}
                          className="input-control"
                          style={{ paddingRight: '36px' }}
                          value={addConfirmPassword}
                          onChange={(e) => setAddConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowAddConfirmPassword(!showAddConfirmPassword)}
                          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          {showAddConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                    🔒 Password is automatically encrypted using bcrypt (10 rounds) and stored securely in MongoDB.
                  </span>
                </div>

                {/* Section 3: Granular Permission Matrix */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', margin: 0, color: 'var(--color-gold-light)' }}>
                      3. MODULE-BASED ACCESS PERMISSIONS
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Fine-tune allowed actions per module
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                    {PERMISSION_MODULES.map((mod) => {
                      const modPerms = (customPerms as any)[mod.key] || {};
                      const allActive = mod.actions.every((act) => Boolean(modPerms[act]));
                      return (
                        <div
                          key={mod.key}
                          style={{
                            backgroundColor: 'var(--bg-surface-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '10px 12px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>{mod.label}</span>
                              <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: 0 }}>{mod.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = { ...((customPerms as any)[mod.key] || {}) };
                                mod.actions.forEach((act) => {
                                  updated[act] = !allActive;
                                });
                                setCustomPerms({
                                  ...customPerms,
                                  [mod.key]: updated
                                });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: allActive ? 'var(--color-gold-light)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 6px'
                              }}
                            >
                              {allActive ? 'Clear All' : 'Select All'}
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {mod.actions.map((act) => {
                              const isChecked = Boolean(modPerms[act]);
                              return (
                                <button
                                  key={act}
                                  type="button"
                                  onClick={() => {
                                    const cur = (customPerms as any)[mod.key] || {};
                                    setCustomPerms({
                                      ...customPerms,
                                      [mod.key]: {
                                        ...cur,
                                        [act]: !isChecked
                                      }
                                    });
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    border: isChecked ? '1px solid var(--color-gold-primary)' : '1px solid var(--border-subtle)',
                                    backgroundColor: isChecked ? 'var(--color-gold-subtle)' : 'transparent',
                                    color: isChecked ? 'var(--color-gold-light)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontWeight: isChecked ? 700 : 500
                                  }}
                                >
                                  <span>{isChecked ? '✓' : '○'}</span>
                                  <span style={{ textTransform: 'capitalize' }}>{act}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddStaffModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Staff'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: RESET PASSWORD (ADMIN ACTION) ── */}
      {resetStaffTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '460px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="var(--color-gold-primary)" />
                <h3 className="card-title" style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Reset Staff Password</h3>
              </div>
              <button type="button" onClick={() => setResetStaffTarget(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Target Staff Summary Box */}
              <div style={{ backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Staff Name:</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{resetStaffTarget.displayName || resetStaffTarget.fullName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Staff ID:</span>
                  <strong style={{ fontSize: '12.5px', color: 'var(--color-gold-light)' }}>{resetStaffTarget.staffId || resetStaffTarget.id || resetStaffTarget.uid}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Email:</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{resetStaffTarget.email}</span>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>New Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showResetNewPassword ? 'text' : 'password'}
                    className="input-control"
                    style={{ paddingRight: '36px' }}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showResetNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>Confirm New Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showResetConfirmPassword ? 'text' : 'password'}
                    className="input-control"
                    style={{ paddingRight: '36px' }}
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showResetConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Once reset, the previous password will immediately stop working and the new password will become the valid login credential.
              </span>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResetStaffTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isResettingPassword}>
                  {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MANAGE / EDIT STAFF ── */}
      {managingStaff && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="var(--color-primary-accent)" />
                <h3 className="card-title" style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Manage Staff: {managingStaff.displayName}</h3>
              </div>
              <button type="button" onClick={() => setManagingStaff(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>Full Name</label>
                  <input type="text" className="input-control" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Phone Number</label>
                  <input type="tel" className="input-control" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Department</label>
                  <input type="text" className="input-control" value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label required" style={{ fontSize: '12px', fontWeight: 700 }}>Assigned Role</label>
                  <select className="select-control" value={editRole} onChange={(e) => handleRoleChangeForEdit(e.target.value as any)}>
                    <option value="STAFF">STAFF (Finance &amp; Operations)</option>
                    <option value="RENTAL_STAFF">RENTAL_STAFF (Complex &amp; Shop Rentals Only)</option>
                  </select>
                </div>
              </div>

              {/* Granular Permission Matrix for Editing */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', margin: 0, color: 'var(--color-gold-light)' }}>
                    MODULE-BASED ACCESS PERMISSIONS
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Fine-tune allowed actions per module
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto', paddingRight: '4px' }}>
                  {PERMISSION_MODULES.map((mod) => {
                    const modPerms = (editPerms as any)[mod.key] || {};
                    const allActive = mod.actions.every((act) => Boolean(modPerms[act]));
                    return (
                      <div
                        key={mod.key}
                        style={{
                          backgroundColor: 'var(--bg-surface-secondary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '10px 12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>{mod.label}</span>
                            <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: 0 }}>{mod.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...((editPerms as any)[mod.key] || {}) };
                              mod.actions.forEach((act) => {
                                updated[act] = !allActive;
                              });
                              setEditPerms({
                                ...editPerms,
                                [mod.key]: updated
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: allActive ? 'var(--color-gold-light)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px'
                            }}
                          >
                            {allActive ? 'Clear All' : 'Select All'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {mod.actions.map((act) => {
                            const isChecked = Boolean(modPerms[act]);
                            return (
                              <button
                                key={act}
                                type="button"
                                onClick={() => {
                                  const cur = (editPerms as any)[mod.key] || {};
                                  setEditPerms({
                                    ...editPerms,
                                    [mod.key]: {
                                      ...cur,
                                      [act]: !isChecked
                                    }
                                  });
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: isChecked ? '1px solid var(--color-gold-primary)' : '1px solid var(--border-subtle)',
                                  backgroundColor: isChecked ? 'var(--color-gold-subtle)' : 'transparent',
                                  color: isChecked ? 'var(--color-gold-light)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontWeight: isChecked ? 700 : 500
                                }}
                              >
                                <span>{isChecked ? '✓' : '○'}</span>
                                <span style={{ textTransform: 'capitalize' }}>{act}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setManagingStaff(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={handleSaveEditStaff}>{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
