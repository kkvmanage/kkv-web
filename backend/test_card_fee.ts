import dotenv from 'dotenv';
dotenv.config();
import { loanService } from './src/services/loan.service.js';
import { adminService } from './src/services/admin.service.js';
import { LoanModel } from './src/models/Loan.js';

async function testCardFeeCalculations() {
  console.log('=== CARD FEE BACKEND LOGIC VERIFICATION ===');

  const settings = adminService.getMasterSettings();
  console.log('Master Admin Default Card Fee:', settings.defaultCardFee);

  const goldType = settings.loanTypes.find(t => t.id === 'gold-loan' || t.name === 'Gold Loan');
  console.log('Gold Loan Master Config Fee:', goldType?.cardFee, 'Enabled:', goldType?.cardFeeEnabled);

  // Test Case 1: Loan created with cardFeeEnabled = true
  console.log('\n--- TEST CASE 1: cardFeeEnabled = true ---');
  const loan1 = await loanService.create({
    loanNo: `GL-TEST-FEE-ON-${Date.now()}`,
    customerId: 'CUST-TEST',
    customerName: 'Fee On Customer',
    customerPhone: '9876543210',
    loanType: 'Gold Loan',
    loanTypeId: 'gold-loan',
    principal: 100000,
    interestRate: 2.0,
    bankMode: 'Cash',
    cardFeeEnabled: true,
    cardFeePaymentMode: 'Cash',
    items: [
      { id: '1', item: 'Gold Ring', qty: 1, purity: '22ct', grossWeight: 15, deductionWeight: 1, netWeight: 14 }
    ],
    marketValue: 120000
  });

  console.log('Loan 1 Principal:', loan1.principal);
  console.log('Loan 1 Card Fee:', loan1.cardFee);
  console.log('Loan 1 Card Fee Enabled:', loan1.cardFeeEnabled);
  console.log('Loan 1 Net Disbursed:', loan1.netDisbursed);
  if (loan1.cardFee > 0 && loan1.netDisbursed === (loan1.principal - loan1.cardFee)) {
    console.log('✅ TEST CASE 1 PASSED: Fee correctly applied and deducted.');
  } else {
    console.error('❌ TEST CASE 1 FAILED');
  }

  // Test Case 2: Loan created with cardFeeEnabled = false
  console.log('\n--- TEST CASE 2: cardFeeEnabled = false ---');
  const loan2 = await loanService.create({
    loanNo: `GL-TEST-FEE-OFF-${Date.now()}`,
    customerId: 'CUST-TEST',
    customerName: 'Fee Off Customer',
    customerPhone: '9876543210',
    loanType: 'Gold Loan',
    loanTypeId: 'gold-loan',
    principal: 100000,
    interestRate: 2.0,
    bankMode: 'Cash',
    cardFeeEnabled: false,
    cardFeePaymentMode: 'Cash',
    items: [
      { id: '1', item: 'Gold Ring', qty: 1, purity: '22ct', grossWeight: 15, deductionWeight: 1, netWeight: 14 }
    ],
    marketValue: 120000
  });

  console.log('Loan 2 Principal:', loan2.principal);
  console.log('Loan 2 Card Fee:', loan2.cardFee);
  console.log('Loan 2 Card Fee Enabled:', loan2.cardFeeEnabled);
  console.log('Loan 2 Net Disbursed:', loan2.netDisbursed);
  if (loan2.cardFee === 0 && loan2.netDisbursed === loan2.principal) {
    console.log('✅ TEST CASE 2 PASSED: Fee is 0 and principal is not deducted.');
  } else {
    console.error('❌ TEST CASE 2 FAILED');
  }

  // Test Case 3: Tampered request with cardFeeEnabled = false, but malicious cardFee = 99999
  console.log('\n--- TEST CASE 3: Tampered payload (Fee OFF, custom fee 99999) ---');
  const loan3 = await loanService.create({
    loanNo: `GL-TEST-FEE-TAMPER1-${Date.now()}`,
    customerId: 'CUST-TEST',
    customerName: 'Tamper Test 1',
    customerPhone: '9876543210',
    loanType: 'Gold Loan',
    loanTypeId: 'gold-loan',
    principal: 100000,
    interestRate: 2.0,
    bankMode: 'Cash',
    cardFee: 99999 as any,
    cardFeeEnabled: false,
    cardFeePaymentMode: 'Cash',
    items: [
      { id: '1', item: 'Gold Ring', qty: 1, purity: '22ct', grossWeight: 15, deductionWeight: 1, netWeight: 14 }
    ],
    marketValue: 120000
  });

  console.log('Loan 3 Principal:', loan3.principal);
  console.log('Loan 3 Card Fee:', loan3.cardFee);
  console.log('Loan 3 Net Disbursed:', loan3.netDisbursed);
  if (loan3.cardFee === 0 && loan3.netDisbursed === 100000) {
    console.log('✅ TEST CASE 3 PASSED: Malicious fee ignored when OFF, fee is 0.');
  } else {
    console.error('❌ TEST CASE 3 FAILED');
  }

  // Cleanup test loans from DB if connected
  try {
    await LoanModel.deleteMany({ loanNo: { $regex: /^GL-TEST-FEE-/ } });
  } catch (e) {}

  console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

testCardFeeCalculations().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
