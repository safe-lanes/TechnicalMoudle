/**
 * Data migration script to fix corrupted Excel date values in jobs
 * Converts dates like "01-Jan-45610" (where 45610 is an Excel serial) to proper "01-Dec-2024" format
 */

import fs from 'fs';
import path from 'path';
import { normalizeDateToDDMMMYYYY } from '../shared/dateUtils';

const DATA_FILE_PATH = path.join(process.cwd(), 'test-data.json');

function extractExcelSerialFromCorruptedDate(dateStr: string): number | null {
  // Match pattern: DD-MMM-YYYYY where YYYYY > 10000 (indicates Excel serial was used as year)
  const match = dateStr.match(/^\d{1,2}-[A-Za-z]{3}-(\d{5,})$/);
  if (match) {
    const serial = parseInt(match[1]);
    if (serial > 10000) {
      return serial;
    }
  }
  return null;
}

function fixCorruptedDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  // Check if date is corrupted (year > 10000)
  const excelSerial = extractExcelSerialFromCorruptedDate(dateStr);
  
  if (excelSerial) {
    console.log(`  🔧 Fixing corrupted date: ${dateStr} (Excel serial: ${excelSerial})`);
    try {
      // Use normalizeDateToDDMMMYYYY to convert the serial number
      const fixedDate = normalizeDateToDDMMMYYYY(excelSerial);
      console.log(`  ✅ Fixed to: ${fixedDate}`);
      return fixedDate;
    } catch (error) {
      console.error(`  ❌ Failed to fix date: ${error}`);
      return dateStr; // Keep original if conversion fails
    }
  }
  
  // Date is already in correct format
  return dateStr;
}

async function migrateData() {
  console.log('🚀 Starting data migration to fix corrupted Excel dates...\n');
  
  // Read the data file
  console.log(`📂 Reading data from: ${DATA_FILE_PATH}`);
  const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
  const data = JSON.parse(rawData);
  
  // Track statistics
  let totalJobs = 0;
  let fixedDates = 0;
  
  // Process jobs
  if (data.jobs && typeof data.jobs === 'object') {
    const jobEntries = Object.entries(data.jobs);
    totalJobs = jobEntries.length;
    
    console.log(`\n📊 Found ${totalJobs} jobs to process\n`);
    
    for (const [jobId, job] of jobEntries) {
      const typedJob = job as any;
      let jobFixed = false;
      
      // Fix lastDoneDate
      if (typedJob.lastDoneDate) {
        const originalDate = typedJob.lastDoneDate;
        const fixedDate = fixCorruptedDate(typedJob.lastDoneDate);
        if (fixedDate !== originalDate) {
          typedJob.lastDoneDate = fixedDate;
          jobFixed = true;
          fixedDates++;
        }
      }
      
      // Fix nextDueDate
      if (typedJob.nextDueDate) {
        const originalDate = typedJob.nextDueDate;
        const fixedDate = fixCorruptedDate(typedJob.nextDueDate);
        if (fixedDate !== originalDate) {
          typedJob.nextDueDate = fixedDate;
          jobFixed = true;
          fixedDates++;
        }
      }
      
      if (jobFixed) {
        console.log(`  Job ${typedJob.jobNo || jobId}: Fixed`);
      }
    }
  }
  
  // Write the fixed data back
  console.log(`\n💾 Writing fixed data back to: ${DATA_FILE_PATH}`);
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log(`\n✅ Migration complete!`);
  console.log(`   Total jobs: ${totalJobs}`);
  console.log(`   Fixed dates: ${fixedDates}`);
  console.log(`\n🎉 All corrupted dates have been normalized to DD-MMM-YYYY format!`);
}

// Run the migration
migrateData().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
