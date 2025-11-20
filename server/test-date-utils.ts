/**
 * Unit tests for date utilities to prevent regressions
 * Run with: npx tsx server/test-date-utils.ts
 */

import { normalizeDateToDDMMMYYYY, calculateNextDueDate } from '../shared/dateUtils';

interface TestCase {
  name: string;
  input: any;
  expected: any;
}

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${message}`);
    failedTests++;
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual === expected) {
    console.log(`  ✅ ${message}: ${actual}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${message}`);
    console.log(`     Expected: ${expected}`);
    console.log(`     Actual:   ${actual}`);
    failedTests++;
  }
}

console.log('\n🧪 Testing Date Utilities\n');

// Test normalizeDateToDDMMMYYYY
console.log('📋 Testing normalizeDateToDDMMMYYYY:\n');

console.log('  Excel Serial Numbers:');
assertEquals(normalizeDateToDDMMMYYYY(45610), '14-Nov-2024', 'Excel 45610 → 14-Nov-2024');
assertEquals(normalizeDateToDDMMMYYYY(45430), '18-May-2024', 'Excel 45430 → 18-May-2024');
assertEquals(normalizeDateToDDMMMYYYY(45339), '17-Feb-2024', 'Excel 45339 → 17-Feb-2024');

console.log('\n  Excel 1900 Leap Year Bug Fix (>= 60 gets -1 adjustment):');
assertEquals(normalizeDateToDDMMMYYYY(59), '28-Feb-1900', 'Serial 59 → 28-Feb-1900 (no adjustment)');
assertEquals(normalizeDateToDDMMMYYYY(60), '28-Feb-1900', 'Serial 60 → 28-Feb-1900 (60-1=59, skip phantom Feb 29)');
assertEquals(normalizeDateToDDMMMYYYY(61), '01-Mar-1900', 'Serial 61 → 01-Mar-1900 (61-1=60, Excel Mar 1 → real Mar 1)');
assertEquals(normalizeDateToDDMMMYYYY(62), '02-Mar-1900', 'Serial 62 → 02-Mar-1900 (62-1=61, correction applied)');

console.log('\n  DD-MMM-YYYY format (already normalized):');
assertEquals(normalizeDateToDDMMMYYYY('13-Nov-2024'), '13-Nov-2024', 'Already normalized');
assertEquals(normalizeDateToDDMMMYYYY('01-Jan-2025'), '01-Jan-2025', 'Already normalized');

console.log('\n  ISO Date Strings:');
assertEquals(normalizeDateToDDMMMYYYY('2024-11-13'), '13-Nov-2024', 'ISO → DD-MMM-YYYY');
assertEquals(normalizeDateToDDMMMYYYY('2024-05-17'), '17-May-2024', 'ISO → DD-MMM-YYYY');

console.log('\n  Invalid Inputs:');
assertEquals(normalizeDateToDDMMMYYYY(null), null, 'null → null');
assertEquals(normalizeDateToDDMMMYYYY(undefined), null, 'undefined → null');
assertEquals(normalizeDateToDDMMMYYYY(''), null, 'empty string → null');

// Test calculateNextDueDate
console.log('\n\n📋 Testing calculateNextDueDate:\n');

console.log('  Input Format Flexibility:');
assertEquals(calculateNextDueDate('14-Nov-2024', '12', 'Months'), '14-Nov-2025', 'DD-MMM-YYYY format');
assertEquals(calculateNextDueDate('2024-11-14', '12', 'Months'), '14-Nov-2025', 'ISO format');
assertEquals(calculateNextDueDate(45610, '12', 'Months'), '14-Nov-2025', 'Excel serial (45610 → 14-Nov-2024)');
assertEquals(calculateNextDueDate('14-Nov-2024', 12, 'Months'), '14-Nov-2025', 'Numeric interval');

console.log('\n  Frequency Units:');
const baseDate = '01-Jan-2024';
assertEquals(calculateNextDueDate(baseDate, '7', 'Days'), '08-Jan-2024', '7 Days');
assertEquals(calculateNextDueDate(baseDate, '1', 'Weeks'), '08-Jan-2024', '1 Week');
assertEquals(calculateNextDueDate(baseDate, '1', 'Months'), '01-Feb-2024', '1 Month');
assertEquals(calculateNextDueDate(baseDate, '6', 'Months'), '01-Jul-2024', '6 Months');
assertEquals(calculateNextDueDate(baseDate, '12', 'Months'), '01-Jan-2025', '12 Months');
assertEquals(calculateNextDueDate(baseDate, '1', 'Years'), '01-Jan-2025', '1 Year');

console.log('\n  Case-insensitive units:');
assertEquals(calculateNextDueDate(baseDate, '1', 'months'), '01-Feb-2024', 'lowercase');
assertEquals(calculateNextDueDate(baseDate, '1', 'MONTHS'), '01-Feb-2024', 'UPPERCASE');

console.log('\n  Real-world Maritime Examples:');
assertEquals(calculateNextDueDate('17-Feb-2024', '3', 'Months'), '17-May-2024', 'Quarterly');
assertEquals(calculateNextDueDate('18-May-2024', '6', 'Months'), '18-Nov-2024', 'Semi-annual');
assertEquals(calculateNextDueDate('14-Nov-2024', '12', 'Months'), '14-Nov-2025', 'Annual');
assertEquals(calculateNextDueDate('09-Nov-2025', '24', 'Months'), '09-Nov-2027', 'Biennial');
assertEquals(calculateNextDueDate('19-May-2024', '1', 'Months'), '19-Jun-2024', 'Monthly');
assertEquals(calculateNextDueDate('18-Jan-2024', '2', 'Months'), '18-Mar-2024', 'Bi-monthly');

console.log('\n  Invalid Inputs:');
assertEquals(calculateNextDueDate(null, '12', 'Months'), null, 'null date');
assertEquals(calculateNextDueDate('13-Nov-2024', null, 'Months'), null, 'null interval');
assertEquals(calculateNextDueDate('13-Nov-2024', '12', null), null, 'null unit');
assertEquals(calculateNextDueDate('13-Nov-2024', '0', 'Months'), null, 'zero interval');
assertEquals(calculateNextDueDate('13-Nov-2024', '-1', 'Months'), null, 'negative interval');
assertEquals(calculateNextDueDate('13-Nov-2024', '12', 'Invalid'), null, 'invalid unit');
assertEquals(calculateNextDueDate('invalid-date', '12', 'Months'), null, 'invalid date');

console.log('\n  Date Boundary Cases:');
assertEquals(calculateNextDueDate('31-Jan-2024', '1', 'Months'), '29-Feb-2024', 'Leap year month-end');
assertEquals(calculateNextDueDate('31-Dec-2024', '1', 'Days'), '01-Jan-2025', 'Year transition');

// Summary
console.log('\n\n' + '='.repeat(60));
console.log(`📊 Test Results:`);
console.log(`   ✅ Passed: ${passedTests}`);
console.log(`   ❌ Failed: ${failedTests}`);
console.log(`   Total:  ${passedTests + failedTests}`);
console.log('='.repeat(60));

if (failedTests > 0) {
  console.log('\n⚠️  Some tests failed! Review the failures above.\n');
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed! Date utilities are working correctly.\n');
  process.exit(0);
}
