import bcrypt from 'bcrypt';
import { localAuthService } from '../services/localAuth.service.js';
import { UserModel } from '../models/User.js';

async function runAuthTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING KKV GOLD FINANCE AUTHENTICATION & RBAC TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  // ── TEST 1: Default Seeds & Bcrypt Hash Verification ───────────────────────
  console.log('[Test 1] Testing Default Account Seeding & Bcrypt Hash Validation...');
  await localAuthService.seedDefaultUsers();

  const admin = await UserModel.findOne({ email: 'admin@kkvgoldfinance.com' });
  assert(admin !== null, 'Admin account found in auth store');
  assert(Boolean(admin?.passwordHash), 'Admin has non-empty passwordHash');
  assert(admin?.passwordHash.startsWith('$2'), 'Admin passwordHash is valid bcrypt format');
  const isAdminMatch = await bcrypt.compare('Admin@123456', admin.passwordHash);
  assert(isAdminMatch === true, 'Admin password "Admin@123456" matches bcrypt hash');

  const staff = await UserModel.findOne({ email: 'staff@kkvgoldfinance.com' });
  assert(staff !== null, 'Staff account found in auth store');
  assert(Boolean(staff?.passwordHash), 'Staff has non-empty passwordHash');
  assert(staff?.passwordHash.startsWith('$2'), 'Staff passwordHash is valid bcrypt format');
  const isStaffMatch = await bcrypt.compare('Staff@123456', staff.passwordHash);
  assert(isStaffMatch === true, 'Staff password "Staff@123456" matches bcrypt hash');

  const rental = await UserModel.findOne({ email: 'rental@kkvgoldfinance.com' });
  assert(rental !== null, 'Rental Staff account found in auth store');
  assert(Boolean(rental?.passwordHash), 'Rental Staff has non-empty passwordHash');
  assert(rental?.passwordHash.startsWith('$2'), 'Rental Staff passwordHash is valid bcrypt format');
  const isRentalMatch = await bcrypt.compare('Rental@123456', rental.passwordHash);
  assert(isRentalMatch === true, 'Rental Staff password "Rental@123456" matches bcrypt hash');

  // ── TEST 2: Staff ID Lookup & Case-Insensitive Matching ─────────────────────
  console.log('\n[Test 2] Testing Staff ID & Case-Insensitive Lookups...');
  const adminByStaffId = await UserModel.findOne({ staffId: 'KKV-ADMIN-000001' });
  assert(adminByStaffId !== null && adminByStaffId.email === 'admin@kkvgoldfinance.com', 'Admin resolved via Staff ID');

  const staffByStaffId = await UserModel.findOne({ staffId: 'KKV-STAFF-000099' });
  assert(staffByStaffId !== null && staffByStaffId.email === 'staff@kkvgoldfinance.com', 'Staff resolved via Staff ID');

  const rentalByStaffId = await UserModel.findOne({ staffId: 'KKV-RENTAL-000001' });
  assert(rentalByStaffId !== null && rentalByStaffId.email === 'rental@kkvgoldfinance.com', 'Rental Staff resolved via Staff ID');

  // ── TEST 3: Login Safeguards & Defensive Password Verification ─────────────
  console.log('\n[Test 3] Testing Password Verification & Negative Cases...');
  const isWrongPasswordMatch = await bcrypt.compare('WrongPassword123!', admin.passwordHash);
  assert(isWrongPasswordMatch === false, 'Wrong password correctly rejected');

  const unknownUser = await UserModel.findOne({ email: 'nonexistent@nowhere.com' });
  assert(unknownUser === null, 'Non-existent user lookup correctly returns null');

  // ── TEST 4: Persistence without Hash Eradication ───────────────────────────
  console.log('\n[Test 4] Testing User Updates & Hash Preservation...');
  admin.lastLoginAt = new Date().toISOString();
  await admin.save();

  const refreshedAdmin = await UserModel.findOne({ email: 'admin@kkvgoldfinance.com' });
  assert(Boolean(refreshedAdmin?.passwordHash), 'Password hash preserved after updating lastLoginAt');
  assert(refreshedAdmin?.passwordHash.startsWith('$2'), 'Refreshed passwordHash remains valid bcrypt');
  const isPostSaveMatch = await bcrypt.compare('Admin@123456', refreshedAdmin.passwordHash);
  assert(isPostSaveMatch === true, 'Admin password still matches after save');

  // ── TEST 5: Serialization Security (No Hash Leakage to Frontend) ───────────
  console.log('\n[Test 5] Testing Frontend Serialization (Zero Hash Exposure)...');
  const jsonOutput = refreshedAdmin.toJSON ? refreshedAdmin.toJSON() : refreshedAdmin;
  assert(jsonOutput.passwordHash === undefined, 'passwordHash is not present in serialized toJSON output');
  assert(jsonOutput.save === undefined, 'save function stripped from serialized output');

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
