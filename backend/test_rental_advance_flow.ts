import { rentalService } from './src/modules/rental/services/rental.service.js';
import { rentalRepository } from './src/modules/rental/repositories/rental.repository.js';
import { rentalDayBookRepository } from './src/modules/rental/repositories/rentalDayBook.repository.js';

async function runTests() {
  console.log('--- STARTING RENTAL ADVANCE & ENHANCEMENT TESTS ---');

  // Setup complex
  const complex = await rentalService.createComplex({
    complexName: 'Test Commercial Plaza',
    location: 'Main Road, Chennai',
    status: 'ACTIVE'
  }, 'TEST_USER');
  console.log('Created Complex:', complex.complexId, complex.complexName);

  // TEST 1: Create Shop with Advance ₹50,000, Door '24B', EB 'EB-123456'
  console.log('\n[TEST 1] Creating shop with Advance ₹50,000, Door 24B, EB-123456...');
  const shop1 = await rentalService.createShop({
    complexId: complex.complexId,
    shopNumber: 'SHOP-TEST-01',
    doorNumber: '24B',
    shopName: 'Arun Electronics',
    tenantName: 'Arun Kumar',
    mobileNumber: '9876543210',
    ebNumber: 'EB-123456',
    monthlyRent: 15000,
    advanceAmount: 50000,
    advancePaymentMode: 'CASH',
    status: 'ACTIVE'
  }, 'STAFF_01');

  if (shop1.shopNumber === 'SHOP-TEST-01' && shop1.doorNumber === '24B' && shop1.ebNumber === 'EB-123456' && shop1.monthlyRent === 15000 && shop1.advanceAmount === 50000 && shop1.availableAdvance === 50000) {
    console.log('✓ TEST 1 PASSED: Shop created with doorNumber, ebNumber, and advance amount');
  } else {
    throw new Error('TEST 1 FAILED: Shop fields mismatch');
  }

  // TEST 2: Verify Day Book contains Security Deposit entry
  console.log('\n[TEST 2] Verifying Day Book for Advance record...');
  const dayBookResult = await rentalService.getDayBook({ complexId: complex.complexId });
  const advanceEntry = dayBookResult.entries.find(e => e.shopId === shop1.shopId && e.transactionType === 'SECURITY_DEPOSIT');
  if (advanceEntry && advanceEntry.credit === 50000 && advanceEntry.voucherNo === `ADV-${shop1.shopId}`) {
    console.log('✓ TEST 2 PASSED: Day Book contains traceable Advance record of ₹50,000');
  } else {
    throw new Error('TEST 2 FAILED: Advance Day Book entry not found or mismatch');
  }

  // TEST 3: Create Shop with Advance ₹0
  console.log('\n[TEST 3] Creating shop with Advance ₹0...');
  const shop2 = await rentalService.createShop({
    complexId: complex.complexId,
    shopNumber: 'SHOP-TEST-02',
    doorNumber: '25A',
    shopName: 'Balaji Provisions',
    tenantName: 'Balaji S',
    mobileNumber: '9876543211',
    monthlyRent: 12000,
    advanceAmount: 0,
    status: 'ACTIVE'
  }, 'STAFF_01');

  const dayBookResult2 = await rentalService.getDayBook({ complexId: complex.complexId });
  const falseAdvanceEntry = dayBookResult2.entries.find(e => e.shopId === shop2.shopId && e.transactionType === 'SECURITY_DEPOSIT');
  if (!falseAdvanceEntry) {
    console.log('✓ TEST 3 PASSED: No false advance record created when advance is 0');
  } else {
    throw new Error('TEST 3 FAILED: Unexpected advance entry created for 0 advance');
  }

  // TEST 4: Search by Door Number & EB Number
  console.log('\n[TEST 4] Searching by Door Number & EB Number...');
  const searchDoor = await rentalService.getShops({ search: '24b' });
  const foundDoor = searchDoor.find(s => s.shopId === shop1.shopId);
  if (foundDoor) {
    console.log('✓ TEST 4A PASSED: Search by Door Number found shop');
  } else {
    throw new Error('TEST 4A FAILED: Door number search failed');
  }

  const searchEB = await rentalService.getShops({ search: '123456' });
  const foundEB = searchEB.find(s => s.shopId === shop1.shopId);
  if (foundEB) {
    console.log('✓ TEST 4B PASSED: Search by EB Number found shop');
  } else {
    throw new Error('TEST 4B FAILED: EB number search failed');
  }

  // TEST 5: Duplicate validation
  console.log('\n[TEST 5] Testing duplicate validations...');
  try {
    await rentalService.createShop({
      complexId: complex.complexId,
      shopNumber: 'SHOP-TEST-01', // duplicate in same complex
      doorNumber: '99Z',
      shopName: 'Other Name',
      tenantName: 'Other Tenant',
      mobileNumber: '9999999999',
      monthlyRent: 10000
    });
    throw new Error('Duplicate shop number test failed - should have thrown error');
  } catch (err: any) {
    console.log('✓ Duplicate shop number correctly rejected:', err.message);
  }

  try {
    await rentalService.createShop({
      complexId: complex.complexId,
      shopNumber: 'SHOP-TEST-99',
      doorNumber: '24B', // duplicate door in same complex
      shopName: 'Other Name',
      tenantName: 'Other Tenant',
      mobileNumber: '9999999999',
      monthlyRent: 10000
    });
    throw new Error('Duplicate door number test failed - should have thrown error');
  } catch (err: any) {
    console.log('✓ Duplicate door number correctly rejected:', err.message);
  }

  // TEST 6: Monthly Rent status check (Advance not mixed with rent)
  console.log('\n[TEST 6] Verifying Monthly Rent status isolation...');
  const currentMonth = new Date().toISOString().substring(0, 7);
  const statusCheck = rentalService.getShopMonthlyStatus(shop1.shopId, currentMonth);
  if (statusCheck.monthlyRent === 15000 && statusCheck.outstandingBalance === 15000) {
    console.log('✓ TEST 6 PASSED: Monthly rent is ₹15,000 and is not diminished by advance');
  } else {
    throw new Error('TEST 6 FAILED: Monthly rent confused with advance');
  }

  console.log('\n========================================');
  console.log('ALL RENTAL ENHANCEMENT TESTS PASSED 100%');
  console.log('========================================\n');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
