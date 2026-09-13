import { env } from '../config/env.js';
import { localAuthService } from '../services/localAuth.service.js';
import { hasPermission } from '../middleware/auth.middleware.js';
import { ADMIN_DEFAULT_PERMISSIONS, STAFF_DEFAULT_PERMISSIONS, RENTAL_STAFF_DEFAULT_PERMISSIONS } from '../models/User.js';
import app from '../app.js';
import http from 'http';

let server: http.Server;
const TEST_PORT = 8089;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    console.log(`✓ ${msg}`);
  }
}

async function startTestServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

async function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function postJson(url: string, data: any, token?: string): Promise<{ status: number; ok: boolean; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

async function getJson(url: string, token?: string): Promise<{ status: number; ok: boolean; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'GET',
    headers
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 RUNNING KKV RBAC & API AUTHORIZATION SUITE');
  console.log('========================================\n');

  // 1. Test hasPermission unit logic
  console.log('--- Step 1: Unit Permission Mapping Verification ---');
  assert(hasPermission(ADMIN_DEFAULT_PERMISSIONS, 'dashboard', 'view', 'ADMIN') === true, 'Admin can view dashboard');
  assert(hasPermission(ADMIN_DEFAULT_PERMISSIONS, 'fd', 'view', 'ADMIN') === true, 'Admin can view fd');
  assert(hasPermission(ADMIN_DEFAULT_PERMISSIONS, 'fixedDeposits', 'withdraw', 'ADMIN') === true, 'Admin can withdraw fixedDeposits');
  
  assert(hasPermission(STAFF_DEFAULT_PERMISSIONS, 'dashboard', 'view', 'STAFF') === true, 'Staff can view dashboard');
  assert(hasPermission(STAFF_DEFAULT_PERMISSIONS, 'fd', 'view', 'STAFF') === true, 'Staff can view fd via alias');
  assert(hasPermission(STAFF_DEFAULT_PERMISSIONS, 'fixedDeposits', 'view', 'STAFF') === true, 'Staff can view fixedDeposits');
  assert(hasPermission(STAFF_DEFAULT_PERMISSIONS, 'fixedDeposits', 'withdraw', 'STAFF') === true, 'Staff can withdraw fixedDeposits');
  assert(hasPermission(STAFF_DEFAULT_PERMISSIONS, 'customers', 'view', 'STAFF') === true, 'Staff can view customers');
  assert(hasPermission(STAFF_DEFAULT_PERMISSIONS, 'customers', 'create', 'STAFF') === true, 'Staff can create customers');
  assert(hasPermission(STAFF_DEFAULT_PERMISSIONS, 'customers', 'delete', 'STAFF') === false, 'Staff CANNOT delete customers');
  assert(hasPermission(STAFF_DEFAULT_PERMISSIONS, 'rental', 'view', 'STAFF') === false, 'Staff CANNOT view rental by default');

  assert(hasPermission(RENTAL_STAFF_DEFAULT_PERMISSIONS, 'dashboard', 'view', 'RENTAL_STAFF') === true, 'Rental Staff can view dashboard');
  assert(hasPermission(RENTAL_STAFF_DEFAULT_PERMISSIONS, 'rental', 'view', 'RENTAL_STAFF') === true, 'Rental Staff can view rental');
  assert(hasPermission(RENTAL_STAFF_DEFAULT_PERMISSIONS, 'customers', 'view', 'RENTAL_STAFF') === false, 'Rental Staff CANNOT view customers');
  assert(hasPermission(RENTAL_STAFF_DEFAULT_PERMISSIONS, 'loans', 'view', 'RENTAL_STAFF') === false, 'Rental Staff CANNOT view loans');
  assert(hasPermission(RENTAL_STAFF_DEFAULT_PERMISSIONS, 'fixedDeposits', 'view', 'RENTAL_STAFF') === false, 'Rental Staff CANNOT view fixedDeposits');

  // 2. Start HTTP server and test real API flow
  console.log('\n--- Step 2: HTTP Integration Flow Tests ---');
  await startTestServer();
  await localAuthService.seedDefaultUsers();

  // Test unauthenticated access (Must return 401)
  const unauthDash = await getJson(`${BASE_URL}/dashboard/summary`);
  assert(unauthDash.status === 401, 'Unauthenticated /dashboard/summary returns 401');
  assert(unauthDash.json.error === 'UNAUTHORIZED', 'Unauthenticated error code is UNAUTHORIZED');

  const unauthWithdrawals = await getJson(`${BASE_URL}/fd/withdrawals`);
  assert(unauthWithdrawals.status === 401, 'Unauthenticated /fd/withdrawals returns 401');

  // 3. Test Admin Login & Access
  console.log('\n--- Step 3: Admin Full Access Verification ---');
  const adminLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: 'admin@kkvgoldfinance.com',
    password: 'Admin@123456'
  });
  assert(adminLogin.status === 200 && adminLogin.json.success === true, 'Admin login succeeds with 200');
  assert(adminLogin.json.token !== undefined, 'Admin login returns JWT token');
  assert(adminLogin.json.role === 'ADMIN', 'Admin role is ADMIN');
  assert(adminLogin.json.user.passwordHash === undefined, 'Admin user object does not expose passwordHash');
  const adminToken = adminLogin.json.token;

  const adminDash = await getJson(`${BASE_URL}/dashboard/summary`, adminToken);
  assert(adminDash.status === 200 && adminDash.json.success === true, 'Admin gets /dashboard/summary with 200');
  assert(typeof adminDash.json.data?.totalLoansCount === 'number', 'Admin dashboard has valid data.totalLoansCount');
  assert(typeof adminDash.json.data?.totalDisbursed === 'number', 'Admin dashboard has valid data.totalDisbursed');

  const adminWithdrawals = await getJson(`${BASE_URL}/fd/withdrawals`, adminToken);
  assert(adminWithdrawals.status === 200 && adminWithdrawals.json.success === true, 'Admin gets /fd/withdrawals with 200');

  const adminCustomers = await getJson(`${BASE_URL}/customers`, adminToken);
  assert(adminCustomers.status === 200 && adminCustomers.json.success === true, 'Admin gets /customers with 200');

  const adminLoans = await getJson(`${BASE_URL}/loans`, adminToken);
  assert(adminLoans.status === 200 && adminLoans.json.success === true, 'Admin gets /loans with 200');

  const adminSettings = await getJson(`${BASE_URL}/admin/settings`, adminToken);
  assert(adminSettings.status === 200 && adminSettings.json.success === true, 'Admin gets /admin/settings with 200');

  // 4. Test Staff Login & Scoped Access
  console.log('\n--- Step 4: Staff Scoped Access & Permission Verification ---');
  const staffLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: 'staff@kkvgoldfinance.com',
    password: 'Staff@123456'
  });
  assert(staffLogin.status === 200 && staffLogin.json.success === true, 'Staff login succeeds with 200');
  assert(staffLogin.json.token !== undefined, 'Staff login returns JWT token');
  assert(staffLogin.json.role === 'STAFF', 'Staff role is STAFF');
  assert(staffLogin.json.user.passwordHash === undefined, 'Staff user object does not expose passwordHash');
  const staffToken = staffLogin.json.token;

  const staffDash = await getJson(`${BASE_URL}/dashboard/summary`, staffToken);
  assert(staffDash.status === 200 && staffDash.json.success === true, 'Staff gets /dashboard/summary with 200');
  assert(typeof staffDash.json.data?.totalLoansCount === 'number', 'Staff dashboard data is valid');

  const staffWithdrawals = await getJson(`${BASE_URL}/fd/withdrawals`, staffToken);
  assert(staffWithdrawals.status === 200 && staffWithdrawals.json.success === true, 'Staff gets /fd/withdrawals with 200');

  const staffCustomers = await getJson(`${BASE_URL}/customers`, staffToken);
  assert(staffCustomers.status === 200 && staffCustomers.json.success === true, 'Staff gets /customers with 200');

  const staffLoans = await getJson(`${BASE_URL}/loans`, staffToken);
  assert(staffLoans.status === 200 && staffLoans.json.success === true, 'Staff gets /loans with 200');

  // Staff restricted endpoints (MUST return 403)
  const staffAdminSettings = await getJson(`${BASE_URL}/admin/settings`, staffToken);
  assert(staffAdminSettings.status === 403, 'Staff is FORBIDDEN (403) from /admin/settings');
  assert(staffAdminSettings.json.error === 'FORBIDDEN', 'Staff 403 error code is FORBIDDEN');

  // 5. Test Rental Staff Login & Scoped Access
  console.log('\n--- Step 5: Rental Staff Scoped Access Verification ---');
  const rentalLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: 'rental@kkvgoldfinance.com',
    password: 'Rental@123456'
  });
  assert(rentalLogin.status === 200 && rentalLogin.json.success === true, 'Rental Staff login succeeds with 200');
  assert(rentalLogin.json.token !== undefined, 'Rental Staff login returns JWT token');
  assert(rentalLogin.json.role === 'RENTAL_STAFF', 'Rental Staff role is RENTAL_STAFF');
  const rentalToken = rentalLogin.json.token;

  const rentalDash = await getJson(`${BASE_URL}/dashboard/summary`, rentalToken);
  assert(rentalDash.status === 200 && rentalDash.json.success === true, 'Rental Staff gets /dashboard/summary with 200');

  const rentalComplexes = await getJson(`${BASE_URL}/rental/complexes`, rentalToken);
  assert(rentalComplexes.status === 200 && rentalComplexes.json.success === true, 'Rental Staff gets /rental/complexes with 200');

  const rentalShops = await getJson(`${BASE_URL}/rental/shops`, rentalToken);
  assert(rentalShops.status === 200 && rentalShops.json.success === true, 'Rental Staff gets /rental/shops with 200');

  // Rental restricted finance endpoints (MUST return 403)
  const rentalLoans = await getJson(`${BASE_URL}/loans`, rentalToken);
  assert(rentalLoans.status === 403, 'Rental Staff is FORBIDDEN (403) from /loans');
  assert(rentalLoans.json.error === 'FORBIDDEN', 'Rental 403 error code is FORBIDDEN');

  const rentalFD = await getJson(`${BASE_URL}/fd/deposits`, rentalToken);
  assert(rentalFD.status === 403, 'Rental Staff is FORBIDDEN (403) from /fd/deposits');

  const rentalAdminSettings = await getJson(`${BASE_URL}/admin/settings`, rentalToken);
  assert(rentalAdminSettings.status === 403, 'Rental Staff is FORBIDDEN (403) from /admin/settings');

  await stopTestServer();
  console.log('\n========================================');
  console.log('🎉 ALL RBAC & API TESTS PASSED SUCCESSFULLY!');
  console.log('========================================\n');
}

runTests().catch(async (err) => {
  console.error('Test suite failed:', err);
  await stopTestServer();
  process.exit(1);
});
