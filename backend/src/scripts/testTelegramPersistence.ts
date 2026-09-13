import { TelegramParser } from '../telegram/telegram.parser.js';
import { telegramCache } from '../telegram/telegram.cache.js';
import { telegramRepository } from '../telegram/telegram.repository.js';
import { localAuthService } from '../services/localAuth.service.js';
import { counterService } from '../services/counter.service.js';

async function runPersistenceTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING TELEGRAM BOT API PERSISTENCE LAYER TESTS');
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

  // Initial cleanup of any leftover test records
  telegramCache.deleteRecord('CUSTOMER', 'KKV-TEST-001', true);
  telegramCache.deleteRecord('LOAN', 'GL-TEST-999', true);

  // ── TEST 1: Serialization & Envelope Parsing ──────────────────────────────
  console.log('[Test 1] Testing Envelope Parsing & Deterministic Serialization...');
  const sampleCustomer = {
    customerId: 'KKV-TEST-001',
    name: 'Ramesh Kumar',
    phone: '9876543210',
    address: 'Komarapalayam, Tamil Nadu',
    activeLoansCount: 0
  };

  const envelope = TelegramParser.createEnvelope(
    'CUSTOMER',
    'KKV-TEST-001',
    sampleCustomer,
    {
      version: 1,
      actor: { uid: 'uid_admin_001', email: 'admin@kkvgoldfinance.com', role: 'ADMIN' }
    }
  );

  const serialized = TelegramParser.serialize(envelope);
  assert(serialized.includes('KKV_APP_RECORD'), 'Serialized string contains envelope marker');
  assert(serialized.includes('CUSTOMER'), 'Serialized string contains entity type');
  assert(serialized.includes('KKV-TEST-001'), 'Serialized string contains entity ID');

  const parsed = TelegramParser.parse(serialized);
  assert(parsed !== null, 'Envelope parsed successfully');
  assert(parsed?.type === 'CUSTOMER', 'Parsed entity type matches');
  assert(parsed?.id === 'KKV-TEST-001', 'Parsed record ID matches');
  assert(parsed?.data.name === 'Ramesh Kumar', 'Parsed data payload matches');
  assert(parsed?.version === 1, 'Parsed version matches');

  // ── TEST 2: Local Memory & Cache Management ───────────────────────────────
  console.log('\n[Test 2] Testing Telegram In-Memory Cache & Indexing...');
  telegramCache.setRecord(envelope, 101, false);

  const cached = telegramCache.getRecord('CUSTOMER', 'KKV-TEST-001');
  assert(cached !== null, 'Retrieved record from cache');
  assert(cached?.data.phone === '9876543210', 'Cached record payload matches');

  const allCustomers = telegramCache.getAllRecords('CUSTOMER');
  assert(allCustomers.length >= 1, `Found ${allCustomers.length} customer(s) in cache`);

  // ── TEST 3: Repository CRUD & Optimistic Concurrency ───────────────────────
  console.log('\n[Test 3] Testing Repository Operations & Optimistic Locking...');
  const sampleLoan = {
    loanNo: 'GL-TEST-999',
    customerId: 'KKV-TEST-001',
    principal: 50000,
    interestRate: 1.5,
    status: 'ACTIVE'
  };

  const createdLoan = await telegramRepository.createRecord('LOAN', 'GL-TEST-999', sampleLoan);
  assert(createdLoan.version === 1, 'Created loan record with initial version 1');

  // Update loan record
  const updatedLoan = await telegramRepository.updateRecord('LOAN', 'GL-TEST-999', {
    ...sampleLoan,
    principal: 45000
  }, { expectedVersion: 1 });
  assert(updatedLoan.version === 2, 'Updated loan with version 2');
  assert(updatedLoan.data.principal === 45000, 'Updated loan principal verified');

  // Test optimistic locking conflict (passing stale version 1 when current is 2)
  try {
    await telegramRepository.updateRecord('LOAN', 'GL-TEST-999', {
      ...sampleLoan,
      principal: 40000
    }, { expectedVersion: 1 });
    assert(false, 'Expected version conflict error was not thrown');
  } catch (err: any) {
    assert(err.statusCode === 409 || err.code === 'CONCURRENCY_CONFLICT', 'Caught 409 Concurrency Conflict on stale version');
  }

  // ── TEST 4: Local Authentication Store & RBAC ─────────────────────────────
  console.log('\n[Test 4] Testing Local Auth Store, Bcrypt Password & Default Seeds...');
  await localAuthService.seedDefaultUsers();

  const adminUser = localAuthService.findUserByEmail('admin@kkvgoldfinance.com');
  assert(adminUser !== null, 'Master Admin user found in local auth store');
  assert(adminUser?.role === 'ADMIN', 'Master Admin role verified');
  assert(adminUser?.permissions.customers.delete === true, 'Admin has customer deletion permission');

  const staffUser = localAuthService.findUserByEmail('staff@kkvgoldfinance.com');
  assert(staffUser !== null, 'Staff user found in local auth store');
  assert(staffUser?.role === 'STAFF', 'Staff role verified');
  assert(staffUser?.permissions.customers.delete === false, 'Staff customer deletion correctly restricted');

  const rentalUser = localAuthService.findUserByEmail('rental@kkvgoldfinance.com');
  assert(rentalUser !== null, 'Rental Staff user found in local auth store');
  assert(rentalUser?.role === 'RENTAL_STAFF', 'Rental Staff role verified');
  assert(rentalUser?.permissions.rental.manageComplexes === true, 'Rental Staff has rental management permission');

  // ── TEST 5: Sequence & Counter Tracking ───────────────────────────────────
  console.log('\n[Test 5] Testing Sequence & Counter Generation...');
  const nextSeq1 = await counterService.getNextSequence('test_seq');
  const nextSeq2 = await counterService.getNextSequence('test_seq');
  assert(nextSeq2 === nextSeq1 + 1, `Sequential counter increment verified (${nextSeq1} -> ${nextSeq2})`);

  // ── Clean up test records ─────────────────────────────────────────────────
  telegramCache.deleteRecord('CUSTOMER', 'KKV-TEST-001', true);
  telegramCache.deleteRecord('LOAN', 'GL-TEST-999', true);

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPersistenceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
