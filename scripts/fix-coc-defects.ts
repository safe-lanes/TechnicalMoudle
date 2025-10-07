#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';

// Load the test-data.json file
const dataPath = path.join(process.cwd(), 'test-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Fix existing defects by adding is_coc field based on category
let fixed = false;
for (const id in data.defects) {
  const defect = data.defects[id];
  
  // Add is_coc field if it doesn't exist
  if (defect.is_coc === undefined) {
    // Set is_coc to true if category is 'COC' or defectCategory is 'COC'
    defect.is_coc = defect.category === 'COC' || defect.defectCategory === 'COC';
    fixed = true;
    console.log(`Fixed defect ${id}: category='${defect.category}', is_coc=${defect.is_coc}`);
  }
}

if (fixed) {
  // Write the fixed data back to the file
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log('✅ Fixed CoC defects in test-data.json');
} else {
  console.log('✅ All defects already have is_coc field');
}