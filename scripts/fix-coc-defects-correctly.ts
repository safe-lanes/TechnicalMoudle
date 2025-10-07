#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';

// Load the test-data.json file
const dataPath = path.join(process.cwd(), 'test-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Fix existing defects - only set is_coc=true for defects with category='COC'
let fixed = 0;
for (const id in data.defects) {
  const defect = data.defects[id];
  const shouldBeCoc = defect.category === 'COC' || defect.defectCategory === 'COC';
  
  if (defect.is_coc !== shouldBeCoc) {
    defect.is_coc = shouldBeCoc;
    fixed++;
    console.log(`Fixed defect ${id}: category='${defect.category}', defectCategory='${defect.defectCategory}', is_coc=${defect.is_coc}`);
  }
}

// Write the fixed data back to the file
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`\n✅ Fixed ${fixed} defects in test-data.json`);

// Summary
const cocDefects = Object.values(data.defects).filter((d: any) => d.is_coc === true);
const resolvedCocDefects = cocDefects.filter((d: any) => ['Closed', 'Cancelled'].includes(d.status));
const activeCocDefects = cocDefects.filter((d: any) => ['Open', 'Pending', 'In-Progress', 'Awaiting Parts', 'Deferred'].includes(d.status));

console.log(`\nSummary:`);
console.log(`- Total CoC defects: ${cocDefects.length}`);
console.log(`- Active CoC defects: ${activeCocDefects.length}`);
console.log(`- Resolved CoC defects: ${resolvedCocDefects.length}`);