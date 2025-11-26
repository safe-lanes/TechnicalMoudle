import { storage } from "../storage";
import type { Job, InsertJob } from "@shared/schema";
import { calculateNextDueDate } from "@shared/dateUtils";
import { nanoid } from "nanoid";

/**
 * Job Service
 * Handles all business logic related to job templates (maintenance task definitions)
 * Separated from routes for better maintainability and testability
 */

export class JobService {
  /**
   * Get all jobs for a vessel, optionally filtered by component
   */
  async getJobs(vesselId?: string, componentId?: string): Promise<Job[]> {
    return storage.getJobs(vesselId, componentId);
  }

  /**
   * Get a single job by ID
   */
  async getJob(id: string): Promise<Job | undefined> {
    return storage.getJob(id);
  }

  /**
   * Create a new job with validation and auto-generated fields
   */
  async createJob(jobData: InsertJob): Promise<Job> {
    // Validate maintenance basis and frequency
    if (jobData.maintenanceBasis === 'Calendar') {
      if (!jobData.frequencyValue || !jobData.frequencyUnit) {
        throw new Error('Calendar-based jobs require frequencyValue and frequencyUnit');
      }
    } else if (jobData.maintenanceBasis === 'Running Hours') {
      if (!jobData.intervalRunningHour) {
        throw new Error('Running Hours-based jobs require intervalRunningHour');
      }
    }

    // Auto-generate job number if not provided
    if (!jobData.jobNo && jobData.componentId) {
      const component = await storage.getComponent(jobData.componentId);
      if (!component) {
        throw new Error(`Component ${jobData.componentId} not found`);
      }
      
      // Generate job number: JOB-{componentCode}-{sequence}
      const existingJobs = await this.getJobs(jobData.vesselId || undefined, jobData.componentId);
      const sequence = String(existingJobs.length + 1).padStart(2, '0');
      jobData.jobNo = `JOB-${component.componentCode}-${sequence}`;
    }

    // Calculate nextDueDate for Calendar-based jobs
    // CRITICAL: Always recalculate to ensure consistency after date normalization
    if (jobData.maintenanceBasis === 'Calendar' && jobData.lastDoneDate) {
      const nextDue = calculateNextDueDate(
        jobData.lastDoneDate,
        jobData.frequencyValue,
        jobData.frequencyUnit
      );
      if (nextDue) {
        jobData.nextDueDate = nextDue;
      } else {
        console.error(`Failed to calculate nextDueDate for job`, {
          lastDoneDate: jobData.lastDoneDate,
          frequencyValue: jobData.frequencyValue,
          frequencyUnit: jobData.frequencyUnit
        });
      }
    }

    return storage.createJob(jobData);
  }

  /**
   * Update an existing job with Rule #15 - Job Frequency Change Impact
   * 
   * When frequency is changed:
   * - If active WO exists: keep current due date, apply new frequency from next cycle
   * - If no active WO: apply new frequency immediately for next WO generation
   */
  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job> {
    const existingJob = await this.getJob(id);
    if (!existingJob) {
      throw new Error(`Job ${id} not found`);
    }

    // Rule #15: Check if frequency-related fields are being changed
    const isFrequencyChange = 
      (updates.frequencyValue !== undefined && updates.frequencyValue !== existingJob.frequencyValue) ||
      (updates.frequencyUnit !== undefined && updates.frequencyUnit !== existingJob.frequencyUnit) ||
      (updates.intervalRunningHour !== undefined && updates.intervalRunningHour !== existingJob.intervalRunningHour);

    if (isFrequencyChange) {
      // Check for active work orders linked to this job
      const activeWorkOrders = await storage.getWorkOrdersByJobId(id);
      const hasActiveWO = activeWorkOrders.some(wo => 
        wo.status !== 'Completed' && 
        wo.status !== 'Rejected'
      );

      if (hasActiveWO) {
        // Rule #15: Active WO exists - keep current due date, apply new frequency from next cycle
        // Store new frequency but DON'T recalculate nextDueDate now
        console.log(`[RULE #15] Job ${id} frequency changed with active WO - preserving current due date, new frequency takes effect on next cycle`);
        
        // Remove lastDoneDate from updates to prevent nextDueDate recalculation
        // The new frequency will only be used after the current WO is completed
        if (updates.lastDoneDate === undefined) {
          delete updates.lastDoneDate;
        }
        
        // Don't recalculate nextDueDate - it will be recalculated when the current WO is completed
        // The job stores the new frequency, but keeps the old nextDueDate until WO completion
        return storage.updateJob(id, updates);
      } else {
        // Rule #15: No active WO - apply new frequency immediately
        console.log(`[RULE #15] Job ${id} frequency changed with no active WO - recalculating next due date immediately`);
      }
    }

    // Recalculate nextDueDate if Calendar-based and relevant fields changed
    // CRITICAL: Guard against overwriting valid nextDueDate with null
    if (
      (updates.maintenanceBasis === 'Calendar' || existingJob.maintenanceBasis === 'Calendar') &&
      (updates.lastDoneDate || updates.frequencyValue || updates.frequencyUnit)
    ) {
      const lastDone = updates.lastDoneDate || existingJob.lastDoneDate;
      const freqValue = updates.frequencyValue || existingJob.frequencyValue;
      const freqUnit = updates.frequencyUnit || existingJob.frequencyUnit;

      if (lastDone && freqValue && freqUnit) {
        const nextDue = calculateNextDueDate(lastDone, freqValue, freqUnit);
        if (nextDue) {
          updates.nextDueDate = nextDue;
        } else {
          // GUARD: Don't overwrite existing nextDueDate with null if calculation fails
          console.error(`Failed to recalculate nextDueDate for job ${id}`, {
            lastDone,
            freqValue,
            freqUnit,
            preservingExisting: existingJob.nextDueDate
          });
        }
      }
    }

    // For Running Hours jobs, recalculate nextDueRH if interval changed and no active WO
    if (
      (updates.maintenanceBasis === 'Running Hours' || existingJob.maintenanceBasis === 'Running Hours') &&
      updates.intervalRunningHour
    ) {
      const lastDoneRH = parseFloat(existingJob.lastDoneRH || '0');
      const newInterval = updates.intervalRunningHour;
      if (lastDoneRH > 0 && newInterval > 0) {
        updates.nextDueRH = String(lastDoneRH + newInterval);
        console.log(`[RULE #15] Job ${id} RH interval changed - new nextDueRH: ${updates.nextDueRH}`);
      }
    }

    return storage.updateJob(id, updates);
  }

  /**
   * Delete a job (and optionally its associated work orders)
   */
  async deleteJob(id: string): Promise<void> {
    return storage.deleteJob(id);
  }

  /**
   * Bulk create jobs (used during upload/import)
   */
  async bulkCreateJobs(jobs: InsertJob[]): Promise<Job[]> {
    // Validate all jobs before creating
    for (const job of jobs) {
      if (job.maintenanceBasis === 'Calendar') {
        if (!job.frequencyValue || !job.frequencyUnit) {
          throw new Error(`Job ${job.jobNo} is Calendar-based but missing frequency data`);
        }
      }
    }

    // Process in batches for better performance
    return storage.bulkCreateJobs(jobs);
  }

  /**
   * Bulk update jobs (used during upload/import in update mode)
   */
  async bulkUpdateJobs(jobs: Array<{ jobNo: string; data: Partial<Job> }>): Promise<Job[]> {
    return storage.bulkUpdateJobs(jobs);
  }

  /**
   * Bulk upsert jobs (create or update based on jobNo)
   */
  async bulkUpsertJobs(jobs: InsertJob[]): Promise<{ created: number; updated: number }> {
    return storage.bulkUpsertJobs(jobs);
  }

  /**
   * Get all Calendar-based jobs that are due for work order generation
   */
  async getDueCalendarJobs(vesselId?: string): Promise<Job[]> {
    const allJobs = await this.getJobs(vesselId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allJobs.filter(job => {
      if (job.maintenanceBasis !== 'Calendar') return false;
      if (!job.nextDueDate) return false;

      // Parse DD-MMM-YYYY format
      const parts = job.nextDueDate.split('-');
      if (parts.length !== 3) return false;

      const monthMap: { [key: string]: number } = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };

      const day = parseInt(parts[0], 10);
      const month = monthMap[parts[1]];
      const year = parseInt(parts[2], 10);

      if (isNaN(day) || month === undefined || isNaN(year)) return false;

      const dueDate = new Date(year, month, day);
      dueDate.setHours(0, 0, 0, 0);

      return dueDate <= today;
    });
  }

  /**
   * Validate job data before creation/update
   */
  validateJobData(jobData: Partial<InsertJob>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!jobData.jobTitle) {
      errors.push('Job title is required');
    }

    if (!jobData.componentId) {
      errors.push('Component ID is required');
    }

    if (!jobData.maintenanceBasis) {
      errors.push('Maintenance basis is required');
    }

    if (jobData.maintenanceBasis === 'Calendar') {
      if (!jobData.frequencyValue) {
        errors.push('Frequency value is required for Calendar-based jobs');
      } else if (typeof jobData.frequencyValue === 'string') {
        const val = parseInt(jobData.frequencyValue, 10);
        if (isNaN(val) || val <= 0) {
          errors.push('Frequency value must be a positive integer');
        }
      }

      if (!jobData.frequencyUnit) {
        errors.push('Frequency unit is required for Calendar-based jobs');
      }
    }

    if (jobData.maintenanceBasis === 'Running Hours') {
      if (!jobData.intervalRunningHour) {
        errors.push('Interval running hour is required for Running Hours-based jobs');
      } else if (jobData.intervalRunningHour <= 0) {
        errors.push('Interval running hour must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const jobService = new JobService();
