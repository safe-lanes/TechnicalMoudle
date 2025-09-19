#!/usr/bin/env tsx
import { DatabaseVerification } from './verification';
import { nanoid } from 'nanoid';

async function runDatabaseVerification() {
  console.log('========================================');
  console.log('Database Verification Tests');
  console.log('Test Run ID:', nanoid(8));
  console.log('Timestamp:', new Date().toISOString());
  console.log('========================================\n');

  const dbVerifier = new DatabaseVerification();
  
  try {
    console.log('Running database verification tests...\n');
    
    // Check database connection
    console.log('1. Checking database connection...');
    try {
      const results = await dbVerifier.runAllVerifications();
      
      console.log('\n=== VERIFICATION RESULTS ===\n');
      
      // Component Hierarchy
      console.log('✓ Component Hierarchy Check:');
      if (results.results.componentHierarchy.valid) {
        console.log('  ✓ All components have valid hierarchy');
      } else {
        console.log('  ✗ Issues found:');
        results.results.componentHierarchy.errors.forEach(e => console.log(`    - ${e}`));
      }
      
      // Running Hours
      console.log('\n✓ Running Hours Consistency:');
      if (results.results.runningHours.valid) {
        console.log('  ✓ Running hours data is consistent');
      } else {
        console.log('  ✗ Issues found:');
        results.results.runningHours.errors.forEach(e => console.log(`    - ${e}`));
      }
      
      // Spares Inventory
      console.log('\n✓ Spares Inventory Check:');
      if (results.results.sparesInventory.valid) {
        console.log('  ✓ Spares inventory is valid');
      } else {
        console.log('  ✗ Issues found:');
        results.results.sparesInventory.errors.forEach(e => console.log(`    - ${e}`));
      }
      
      // Work Order Status
      console.log('\n✓ Work Order Status Check:');
      if (results.results.workOrderStatus.valid) {
        console.log('  ✓ Work order statuses are consistent');
      } else {
        console.log('  ✗ Issues found:');
        results.results.workOrderStatus.errors.forEach(e => console.log(`    - ${e}`));
      }
      
      // Change Requests
      console.log('\n✓ Change Request Integrity:');
      if (results.results.changeRequests.valid) {
        console.log('  ✓ Change requests are valid');
      } else {
        console.log('  ✗ Issues found:');
        results.results.changeRequests.errors.forEach(e => console.log(`    - ${e}`));
      }
      
      // Overall Summary
      console.log('\n========================================');
      console.log('OVERALL SUMMARY');
      console.log('========================================');
      
      const totalChecks = Object.keys(results.results).length;
      const passedChecks = Object.values(results.results).filter(r => r.valid).length;
      const totalErrors = Object.values(results.results).reduce((sum, r) => sum + r.errors.length, 0);
      
      console.log(`Total Checks: ${totalChecks}`);
      console.log(`Passed: ${passedChecks}`);
      console.log(`Failed: ${totalChecks - passedChecks}`);
      console.log(`Total Errors Found: ${totalErrors}`);
      
      if (results.valid) {
        console.log('\n✅ ALL DATABASE VERIFICATION TESTS PASSED');
      } else {
        console.log('\n❌ SOME DATABASE VERIFICATION TESTS FAILED');
        console.log('Please review the errors above for details.');
      }
      
      // Clean up test data if any
      console.log('\n2. Cleaning up test data...');
      await dbVerifier.cleanupTestData('test_');
      console.log('  ✓ Test data cleanup completed');
      
    } catch (error) {
      console.error('❌ Database verification failed:', error.message);
      console.error('This might indicate a database connection issue or schema problem.');
    }
    
  } catch (error) {
    console.error('Fatal error during verification:', error);
    process.exit(1);
  } finally {
    await dbVerifier.close();
    console.log('\n✓ Database connection closed');
  }
  
  console.log('\n========================================');
  console.log('Database Verification Complete');
  console.log('========================================');
}

// Run if executed directly
runDatabaseVerification()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });

export { runDatabaseVerification };