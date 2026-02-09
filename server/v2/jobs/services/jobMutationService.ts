import { JobRepository } from '../repositories/jobRepository';
import { insertJobSchema } from '../../../../shared/v2/jobs/schema';
import type { Job, InsertJob } from '../../../../shared/v2/jobs/schema';
import { normalizeDateToDDMMMYYYY, calculateNextDueDate } from '../utils/dateUtils';
import { generateJobNumber } from '../utils/jobNumbering';

export class JobMutationService {
  constructor(private repo: JobRepository) {}

  async createJob(body: any): Promise<{ job?: Job; error?: string; status?: number }> {
    let jobData: any;
    try {
      jobData = insertJobSchema.parse(body);
    } catch (err: any) {
      return { error: 'Invalid job data', status: 400 };
    }

    let component: any = null;
    if (jobData.componentId) {
      component = await this.repo.findComponentById(jobData.componentId);

      if (!component && jobData.componentCode && jobData.vesselId) {
        component = await this.repo.findComponentByCode(jobData.componentCode, jobData.vesselId);
        if (component) {
          jobData = { ...jobData, componentId: component.id };
        }
      }

      if (!component) {
        return { error: 'Component not found', status: 400 };
      }
      if (!component.parentId) {
        return { error: 'Jobs can only be assigned to sub-components. Parent components cannot have jobs directly assigned to them. Please select a sub-component.', status: 400 };
      }

      if (component.componentCode) {
        jobData = { ...jobData, componentCode: component.componentCode };
      }
    }

    if (!jobData.jobNo) {
      const generatedJobNo = await generateJobNumber();
      jobData = { ...jobData, jobNo: generatedJobNo };
    }

    if (jobData.maintenanceBasis === 'Calendar' && !jobData.nextDueDate) {
      const rawLastDone = jobData.lastDoneDate || component?.installationDate;
      if (rawLastDone && jobData.frequencyValue && jobData.frequencyUnit) {
        const lastDone = normalizeDateToDDMMMYYYY(rawLastDone);
        if (lastDone) {
          const calculatedNextDue = calculateNextDueDate(lastDone, jobData.frequencyValue, jobData.frequencyUnit);
          if (calculatedNextDue) {
            jobData = { ...jobData, nextDueDate: calculatedNextDue };
          }
        }
      }
    }

    if (jobData.maintenanceBasis === 'Running Hours') {
      const intervalRH = Number(jobData.intervalRunningHour);
      if (isNaN(intervalRH) || intervalRH <= 0) {
        return { error: 'Running Hours jobs require a valid numeric intervalRunningHour greater than 0', status: 400 };
      }

      const rawLastDoneRH = jobData.lastDoneRH || (component?.runningHours ? String(component.runningHours) : null);
      if (!rawLastDoneRH) {
        return { error: 'Running Hours jobs require lastDoneRH or component must have runningHours to calculate nextDueRH', status: 400 };
      }

      const lastRH = Number(rawLastDoneRH);
      if (isNaN(lastRH)) {
        return { error: 'lastDoneRH must be a valid number', status: 400 };
      }

      jobData = { ...jobData, nextDueRH: String(lastRH + intervalRH), lastDoneRH: String(lastRH) };
    }

    const job = await this.repo.create(jobData);
    return { job, status: 201 };
  }

  async updateJob(id: string, body: any): Promise<{ job?: Job; error?: string; status?: number }> {
    let updateData = { ...body };

    let component: any = null;
    if (body.componentId) {
      component = await this.repo.findComponentById(body.componentId);
      if (!component) return { error: 'Component not found', status: 400 };
      if (!component.parentId) {
        return { error: 'Jobs can only be assigned to sub-components. Parent components cannot have jobs directly assigned to them. Please select a sub-component.', status: 400 };
      }
    }

    const existingJob = await this.repo.findById(id);
    if (!existingJob) return { error: 'Job not found', status: 404 };

    const mergedData = { ...existingJob, ...updateData };

    const calendarFieldsChanged = updateData.lastDoneDate !== undefined ||
      updateData.frequencyValue !== undefined ||
      updateData.frequencyUnit !== undefined ||
      updateData.maintenanceBasis !== undefined;

    if (mergedData.maintenanceBasis === 'Calendar' && calendarFieldsChanged) {
      if (!component && mergedData.componentId) {
        component = await this.repo.findComponentById(mergedData.componentId);
      }
      const rawLastDone = mergedData.lastDoneDate || component?.installationDate;
      if (rawLastDone && mergedData.frequencyValue && mergedData.frequencyUnit) {
        const lastDone = normalizeDateToDDMMMYYYY(rawLastDone);
        if (lastDone) {
          const calculatedNextDue = calculateNextDueDate(lastDone, mergedData.frequencyValue, mergedData.frequencyUnit);
          if (calculatedNextDue) {
            updateData.nextDueDate = calculatedNextDue;
          }
        }
      }
    } else if (updateData.maintenanceBasis === 'Running Hours' && existingJob.maintenanceBasis === 'Calendar') {
      updateData.nextDueDate = null;
    }

    const rhFieldsChanged = updateData.lastDoneRH !== undefined ||
      updateData.intervalRunningHour !== undefined ||
      updateData.maintenanceBasis !== undefined;

    if (mergedData.maintenanceBasis === 'Running Hours') {
      const intervalRH = Number(mergedData.intervalRunningHour);
      if (isNaN(intervalRH) || intervalRH <= 0) {
        return { error: 'Running Hours jobs require a valid numeric intervalRunningHour greater than 0', status: 400 };
      }

      if (!component && mergedData.componentId) {
        component = await this.repo.findComponentById(mergedData.componentId);
      }

      const rawLastDoneRH = mergedData.lastDoneRH || (component?.runningHours ? String(component.runningHours) : null);
      if (!rawLastDoneRH) {
        return { error: 'Running Hours jobs require lastDoneRH or component must have runningHours to calculate nextDueRH', status: 400 };
      }

      const lastRH = Number(rawLastDoneRH);
      if (isNaN(lastRH)) {
        return { error: 'lastDoneRH must be a valid number', status: 400 };
      }

      if (rhFieldsChanged) {
        updateData.nextDueRH = String(lastRH + intervalRH);
        if (!mergedData.lastDoneRH) {
          updateData.lastDoneRH = String(lastRH);
        }
      }
    } else if (updateData.maintenanceBasis === 'Calendar' && existingJob.maintenanceBasis === 'Running Hours') {
      updateData.nextDueRH = null;
    }

    const job = await this.repo.update(id, updateData);
    return { job };
  }

  async deleteJob(id: string): Promise<void> {
    await this.repo.remove(id);
  }
}
