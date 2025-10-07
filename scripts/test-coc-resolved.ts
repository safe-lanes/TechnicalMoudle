#!/usr/bin/env tsx
import { PersistentFileStorage } from '../server/persistentStorage';

async function testCoCResolved() {
  const storage = new PersistentFileStorage('test-data.json');
  
  console.log('Testing CoC Defects retrieval...\n');
  
  // Test 1: Get all CoC defects
  const allCoCDefects = await storage.getDefects({ is_coc: true });
  console.log(`✅ Total CoC defects: ${allCoCDefects.length}`);
  
  // Test 2: Get active CoC defects
  const activeCoCDefects = await storage.getDefects({ 
    is_coc: true, 
    statusView: 'active' 
  });
  console.log(`✅ Active CoC defects: ${activeCoCDefects.length}`);
  
  // Test 3: Get resolved CoC defects
  const resolvedCoCDefects = await storage.getDefects({ 
    is_coc: true, 
    statusView: 'resolved' 
  });
  console.log(`✅ Resolved CoC defects: ${resolvedCoCDefects.length}`);
  
  // Show details of resolved CoC defects
  if (resolvedCoCDefects.length > 0) {
    console.log('\nResolved CoC defects details:');
    resolvedCoCDefects.forEach(defect => {
      console.log(`  - ID: ${defect.id}, Status: ${defect.status}, Category: ${defect.category}, is_coc: ${defect.is_coc}`);
    });
  } else {
    console.log('\n⚠️  No resolved CoC defects found!');
  }
  
  // Test 4: Verify that the resolved defect #2 appears correctly
  const defect2 = await storage.getDefect('2');
  if (defect2) {
    console.log(`\n✅ Defect #2 details: 
    - Category: ${defect2.category}
    - Status: ${defect2.status}
    - is_coc: ${defect2.is_coc}
    - Should appear in resolved CoC: ${defect2.is_coc && ['Closed', 'Cancelled'].includes(defect2.status)}`);
  }
}

testCoCResolved().catch(console.error);