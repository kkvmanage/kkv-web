import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { isAdminRole } from './config/permissions';

// Core Page Views
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { AddCustomer } from './pages/AddCustomer';
import { SearchCustomer } from './pages/SearchCustomer';
import { CustomerProfile } from './pages/CustomerProfile';
import { LoanIssue } from './pages/LoanIssue';
import { LoanDisplay } from './pages/LoanDisplay';
import { LoanReceipts } from './pages/LoanReceipts';
import { ReceiptDisplay } from './pages/ReceiptDisplay';
import { AllReceipts } from './pages/AllReceipts';
import { PendingLoans } from './pages/PendingLoans';
import { TotalLoans } from './pages/TotalLoans';
import { RCRenewalReminders } from './pages/RCRenewalReminders';
import { BillBalance } from './pages/BillBalance';
import { FixedDeposits } from './pages/FixedDeposits';
import { Accounts } from './pages/Accounts';
import { DailyReminders } from './pages/DailyReminders';
import { AdminPanel } from './pages/AdminPanel';
import { Settings } from './pages/Settings';
import { NotificationCenter } from './components/notifications/NotificationCenter';

// Rental Management Page Views
import { RentalDashboard } from './modules/rental/pages/RentalDashboard';
import { RentalComplexes } from './modules/rental/pages/RentalComplexes';
import { RentalComplexDetail } from './modules/rental/pages/RentalComplexDetail';
import { RentalShops } from './modules/rental/pages/RentalShops';
import { RentalShopDetail } from './modules/rental/pages/RentalShopDetail';
import { RentalPayments } from './modules/rental/pages/RentalPayments';
import { RentalDayBook } from './modules/rental/pages/RentalDayBook';
import { RentalExpenses } from './modules/rental/pages/RentalExpenses';
import { RentalReports } from './modules/rental/pages/RentalReports';

import { LoginView } from './components/auth/LoginView';
import { AccessDenied } from './components/auth/AccessDenied';
import { ForceChangePasswordModal } from './components/auth/ForceChangePasswordModal';

export const App: React.FC = () => {
  const {
    currentPage,
    setCurrentPage,
    toasts,
    userRole,
    currentUser,
    authLoading,
    hasPermission,
    loginWithCredentials,
    isNotificationOpen,
    setIsNotificationOpen
  } = useApp();

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both email/staff ID and password.');
      return;
    }

    setIsLoggingIn(true);
    const res = await loginWithCredentials(loginEmail.trim(), loginPassword.trim());
    setIsLoggingIn(false);

    if (!res.success) {
      setLoginError(res.message || 'Incorrect email or password.');
    }
  };

  const getHomeRoute = () => {
    return userRole === 'RENTAL_STAFF' ? 'rental-dashboard' : 'dashboard';
  };

  // ── Route & Permission Guard ───────────────────────────────────────────────
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        if (userRole === 'RENTAL_STAFF') {
          return <RentalDashboard onNavigate={(page: string) => setCurrentPage(page as any)} />;
        }
        return <Dashboard />;

      case 'customers':
      case 'customers-add':
      case 'add-customer-form':
      case 'edit-customer':
      case 'search-customer':
      case 'customer-profile':
        if (!hasPermission('customers', 'view')) {
          return <AccessDenied requestedArea="Customer Management" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        if (currentPage === 'customers') return <Customers />;
        if (currentPage === 'edit-customer') {
          if (!hasPermission('customers', 'update') && !hasPermission('customers', 'create')) {
            return <AccessDenied requestedArea="Edit Customer" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
          }
          return <AddCustomer mode="edit" />;
        }
        if (currentPage === 'customers-add' || currentPage === 'add-customer-form') {
          if (!hasPermission('customers', 'create')) {
            return <AccessDenied requestedArea="Create Customer" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
          }
          return <AddCustomer mode="add" />;
        }
        if (currentPage === 'search-customer') return <SearchCustomer />;
        return <CustomerProfile />;

      case 'loan-issue':
      case 'loan-display':
      case 'all-receipts':
      case 'total-loans':
      case 'rc-renewal-reminders':
      case 'bill-balance':
        if (!hasPermission('loans', 'view')) {
          return <AccessDenied requestedArea="Loan Management" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        if (currentPage === 'loan-issue') {
          if (!hasPermission('loans', 'create')) {
            return <AccessDenied requestedArea="Issue New Loan" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
          }
          return <LoanIssue />;
        }
        if (currentPage === 'loan-display') return <LoanDisplay />;
        if (currentPage === 'all-receipts') return <AllReceipts />;
        if (currentPage === 'total-loans') return <TotalLoans />;
        if (currentPage === 'rc-renewal-reminders') return <RCRenewalReminders />;
        return <BillBalance />;

      case 'loan-receipts':
      case 'receipt-display':
        if (!hasPermission('receipts', 'view')) {
          return <AccessDenied requestedArea="Loan Receipts" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        if (currentPage === 'loan-receipts') return <LoanReceipts />;
        return <ReceiptDisplay />;

      case 'pending-loans':
        if (!hasPermission('loans', 'approve')) {
          return <AccessDenied requestedArea="Pending Loans Approval" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <PendingLoans />;

      case 'new-deposit':
      case 'deposit-display':
      case 'fd-customers':
      case 'fd-customers-deposits':
      case 'deposit-interest':
      case 'interest-display':
      case 'interest-pending':
      case 'deposit-withdrawal':
      case 'withdrawal-display':
        if (!hasPermission('fd', 'view')) {
          return <AccessDenied requestedArea="Fixed Deposits" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        if (currentPage === 'new-deposit' && !hasPermission('fd', 'create')) {
          return <AccessDenied requestedArea="New Fixed Deposit" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <FixedDeposits />;

      case 'day-book':
      case 'trial-balance':
      case 'profit-loss':
      case 'balance-sheet':
      case 'accounts':
        if (!hasPermission('accounting', 'view')) {
          return <AccessDenied requestedArea="Accounting & Ledgers" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <Accounts />;

      case 'daily-reminders':
        return <DailyReminders />;

      case 'notifications':
        return <NotificationCenter isFullPage={true} />;

      // ── Rental Management Domain ──
      case 'rental':
      case 'rental-dashboard':
        if (!hasPermission('rental', 'view')) {
          return <AccessDenied requestedArea="Rental Dashboard" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <RentalDashboard onNavigate={(page: string) => setCurrentPage(page as any)} />;

      case 'rental-complexes':
        if (!hasPermission('rental', 'view')) {
          return <AccessDenied requestedArea="Rental Complexes" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <RentalComplexes onSelectComplex={() => setCurrentPage('rental-complex-detail')} />;

      case 'rental-complex-detail':
        if (!hasPermission('rental', 'view')) {
          return <AccessDenied requestedArea="Complex Details" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <RentalComplexDetail onBack={() => setCurrentPage('rental-complexes')} />;

      case 'rental-shops':
        if (!hasPermission('rental', 'view')) {
          return <AccessDenied requestedArea="Rental Shops" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <RentalShops onSelectShop={() => setCurrentPage('rental-shop-detail')} />;

      case 'rental-shop-detail':
        if (!hasPermission('rental', 'view')) {
          return <AccessDenied requestedArea="Shop Details" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <RentalShopDetail onBack={() => setCurrentPage('rental-shops')} />;

      case 'rental-payments':
        if (!hasPermission('rental', 'view')) {
          return <AccessDenied requestedArea="Rent Collection & Payments" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <RentalPayments />;

      case 'rental-daybook':
        if (!hasPermission('rental', 'view')) {
          return <AccessDenied requestedArea="Rental Day Book" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <RentalDayBook />;

      case 'rental-expenses':
        if (!hasPermission('rental', 'view')) {
          return <AccessDenied requestedArea="Rental Expenses" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <RentalExpenses />;

      case 'rental-reports':
        if (!hasPermission('rental', 'view')) {
          return <AccessDenied requestedArea="Rental Reports" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <RentalReports />;

      // ── System & Admin Domain ──
      case 'backup-restore':
        if (!hasPermission('backupRestore', 'view') && !isAdminRole(userRole)) {
          return <AccessDenied requestedArea="Backup & Restore" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <AdminPanel />;

      case 'admin-panel':
        if (!hasPermission('staffManagement', 'view') && !isAdminRole(userRole)) {
          return <AccessDenied requestedArea="Admin Panel" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <AdminPanel />;

      case 'settings':
        if (!hasPermission('settings', 'view') && !isAdminRole(userRole)) {
          return <AccessDenied requestedArea="Branch Settings & Master Control" onNavigateHome={() => setCurrentPage(getHomeRoute())} />;
        }
        return <Settings />;

      default:
        return userRole === 'RENTAL_STAFF' ? (
          <RentalDashboard onNavigate={(page: string) => setCurrentPage(page as any)} />
        ) : (
          <Dashboard />
        );
    }
  };

  return (
    <div className="app-layout">
      {/* Toast Notification Container */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 9999,
          maxWidth: '380px'
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              backgroundColor:
                t.type === 'error'
                  ? 'rgba(201, 106, 106, 0.12)'
                  : t.type === 'warning'
                    ? 'rgba(210, 168, 74, 0.12)'
                    : t.type === 'success'
                      ? 'rgba(47, 111, 91, 0.15)'
                      : 'var(--bg-card)',
              color:
                t.type === 'error'
                  ? '#C96A6A'
                  : t.type === 'warning'
                    ? '#D2A84A'
                    : t.type === 'success'
                      ? '#4FAF86'
                      : 'var(--text-primary)',
              border: `1px solid ${t.type === 'error'
                ? 'rgba(201, 106, 106, 0.4)'
                : t.type === 'warning'
                  ? 'rgba(210, 168, 74, 0.4)'
                  : t.type === 'success'
                    ? 'rgba(47, 111, 91, 0.4)'
                    : 'var(--border-light)'
                }`,
              borderRadius: 'var(--radius-md)',
              padding: '11px 18px',
              boxShadow: 'var(--shadow-lg)',
              fontSize: '13.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backdropFilter: 'blur(8px)',
              animation: 'slideInRight 0.2s ease'
            }}
          >
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* ── CUSTOM JWT AUTHENTICATION SCREEN ── */}
      {(!userRole || !currentUser) && (
        <LoginView
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          loginError={loginError}
          isLoggingIn={isLoggingIn}
          authLoading={authLoading}
          handleLogin={handleLogin}
        />
      )}

      {/* ── AUTHENTICATED APP WORKSPACE ── */}
      {userRole !== null && currentUser !== null && (
        <>
          {/* Main Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="main-content">
            <Topbar />
            <main style={{ minHeight: 'calc(100vh - var(--topbar-height))', display: 'flex', flexDirection: 'column' }}>
              {renderPage()}
            </main>
          </div>

          {/* Centralized Notification Center Modal / Flyout */}
          {isNotificationOpen && (
            <NotificationCenter isFullPage={false} onClose={() => setIsNotificationOpen(false)} />
          )}

          {/* Force Change Password Modal for newly created staff */}
          {currentUser?.mustChangePassword && (
            <ForceChangePasswordModal />
          )}
        </>
      )}
    </div>
  );
};

export const AppContent = App;
export default App;
