#!/usr/bin/env npx tsx
/**
 * Module 4: Jobs Migration Validation Script
 * Validates that jobs data was correctly migrated to PostgreSQL
 * 
 * Usage: npx tsx scripts/validate-module4-migration.ts
 */

import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { jobs } from '../shared/schema';

const DATA_FILE = path.join(process.cwd(), 'test-data.json');

interface ValidationResult {
  table: string;
  sourceCount: number;
  dbCount: number;
  matched: boolean;
  issues: string[];
}

async function loadFileData(): Promise<any> {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Data file not found: ${DATA_FILE}`);
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 4: Jobs Migration Validation');
  console.log('='.repeat(60));

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('\nLoading data from test-data.json...');
    const fileData = await loadFileData();

    console.log('Connecting to PostgreSQL...');
    const db = await getDb();

    const results: ValidationResult[] = [];

    // Validate Jobs
    const vesselJobsData = fileData.jobs || {};
    const fleetJobsData = fileData.fleetJobs || {};
    const vesselJobsList = Object.values(vesselJobsData) as any[];
    const fleetJobsList = Object.values(fleetJobsData) as any[];
    const totalSourceJobs = vesselJobsList.length + fleetJobsList.length;

    const dbJobs = await db.select().from(jobs);
    const vesselDbJobs = dbJobs.filter((j: any) => j.dataScope === 'vessel');
    const fleetDbJobs = dbJobs.filter((j: any) => j.dataScope === 'fleet');

    const jobsIssues: string[] = [];
    
    // Check vessel jobs count
    if (vesselDbJobs.length < vesselJobsList.length) {
      jobsIssues.push(`Missing vessel jobs: expected ${vesselJobsList.length}, found ${vesselDbJobs.length}`);
    }
    
    // Check fleet jobs count
    if (fleetDbJobs.length < fleetJobsList.length) {
      jobsIssues.push(`Missing fleet jobs: expected ${fleetJobsList.length}, found ${fleetDbJobs.length}`);
    }

    // Sample validation: check that first few jobs exist and have correct data
    for (const sourceJob of vesselJobsList.slice(0, 5)) {
      const dbJob = dbJobs.find((j: any) => j.id === sourceJob.id);
      if (!dbJob) {
        jobsIssues.push(`Job ${sourceJob.id} (${sourceJob.jobNo}) not found in database`);
      } else {
        // Validate key fields
        if (dbJob.jobNo !== sourceJob.jobNo) {
          jobsIssues.push(`Job ${sourceJob.id}: jobNo mismatch (${dbJob.jobNo} vs ${sourceJob.jobNo})`);
        }
        if (dbJob.componentId !== sourceJob.componentId) {
          jobsIssues.push(`Job ${sourceJob.id}: componentId mismatch`);
        }
      }
    }

    results.push({
      table: 'jobs',
      sourceCount: totalSourceJobs,
      dbCount: dbJobs.length,
      matched: dbJobs.length >= totalSourceJobs && jobsIssues.length === 0,
      issues: jobsIssues,
    });

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('Validation Results');
    console.log('='.repeat(60));

    let allPassed = true;

    for (const result of results) {
      const status = result.matched ? '✅ PASS' : '❌ FAIL';
      console.log(`\n${result.table}: ${status}`);
      console.log(`  Source records: ${result.sourceCount}`);
      console.log(`  Database records: ${result.dbCount}`);
      
      if (result.issues.length > 0) {
        console.log('  Issues:');
        for (const issue of result.issues) {
          console.log(`    - ${issue}`);
        }
        allPassed = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('✅ ALL VALIDATIONS PASSED');
    } else {
      console.log('❌ SOME VALIDATIONS FAILED');
    }
    console.log('='.repeat(60));

    process.exit(allPassed ? 0 : 1);

  } catch (error: any) {
    console.error('\n' + '='.repeat(60));
    console.error('VALIDATION FAILED');
    console.error('='.repeat(60));
    console.error('\nError:', error.message || error);
    process.exit(1);
  }
}

main();
