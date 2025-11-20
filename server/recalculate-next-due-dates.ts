import { readFileSync, writeFileSync } from 'fs';
import { calculateNextDueDate } from '../shared/dateUtils';

/**
 * Migration script to recalculate missing nextDueDate values
 * for all Calendar-based jobs after the date normalization fix
 */

interface Job {
  id: string;
  jobNo: string;
  maintenanceBasis?: string;
  lastDoneDate?: string;
  frequencyValue?: string;
  frequencyUnit?: string;
  nextDueDate?: string;
  [key: string]: any;
}

interface DataStore {
  jobs?: Record<string, Job>;
  [key: string]: any;
}

const DATA_FILE = '/home/runner/workspace/test-data.json';

console.log('🔄 Starting Next Due Date Recalculation...\n');

// Load data
const rawData = readFileSync(DATA_FILE, 'utf-8');
const data: DataStore = JSON.parse(rawData);

if (!data.jobs) {
  console.error('❌ No jobs found in data file');
  process.exit(1);
}

const jobs = Object.values(data.jobs);
console.log(`📊 Total jobs: ${jobs.length}`);

let calendarJobs = 0;
let recalculated = 0;
let skipped = 0;
let failed = 0;

for (const job of jobs) {
  // Only process Calendar-based jobs
  if (job.maintenanceBasis !== 'Calendar') {
    continue;
  }

  calendarJobs++;

  // Check if we have the required fields
  if (!job.lastDoneDate || !job.frequencyValue || !job.frequencyUnit) {
    console.log(`⚠️  Skipping ${job.jobNo}: Missing required fields (lastDoneDate: ${job.lastDoneDate}, freq: ${job.frequencyValue} ${job.frequencyUnit})`);
    skipped++;
    continue;
  }

  // Calculate next due date
  const calculatedNextDue = calculateNextDueDate(
    job.lastDoneDate,
    job.frequencyValue,
    job.frequencyUnit
  );

  if (calculatedNextDue) {
    // Update the job
    job.nextDueDate = calculatedNextDue;
    console.log(`✅ ${job.jobNo}: Last Done = ${job.lastDoneDate}, Frequency = ${job.frequencyValue} ${job.frequencyUnit} → Next Due = ${calculatedNextDue}`);
    recalculated++;
  } else {
    console.log(`❌ ${job.jobNo}: Failed to calculate (lastDoneDate: ${job.lastDoneDate}, freq: ${job.frequencyValue} ${job.frequencyUnit})`);
    failed++;
  }
}

// Write updated data back
console.log('\n💾 Writing updated data back to:', DATA_FILE);
writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');

// Summary
console.log('\n✅ Migration complete!');
console.log(`   Total jobs: ${jobs.length}`);
console.log(`   Calendar-based jobs: ${calendarJobs}`);
console.log(`   Recalculated: ${recalculated}`);
console.log(`   Skipped (missing data): ${skipped}`);
console.log(`   Failed: ${failed}`);

if (failed > 0) {
  console.log('\n⚠️  Some jobs failed to recalculate. Review the logs above for details.');
  process.exit(1);
}

console.log('\n🎉 All Calendar-based jobs now have correct nextDueDate values!');
