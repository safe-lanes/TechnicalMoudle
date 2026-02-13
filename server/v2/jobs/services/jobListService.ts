import { JobRepository } from '../repositories/jobRepository';
import type { Job, JobComponentLink } from '../../../../shared/v2/jobs/schema';

export class JobListService {
  constructor(private repo: JobRepository) {}

  async getJobs(vesselId?: string, componentId?: string): Promise<any[]> {
    const jobs = await this.repo.findJobs(vesselId, componentId);

    let jobLinksMap = new Map<string, string[]>();
    let jobLinkTrackingMap = new Map<string, any>();

    if (vesselId) {
      const allLinks = await this.repo.findLinksByVessel(vesselId);
      for (const link of allLinks) {
        const existing = jobLinksMap.get(link.jobId) || [];
        existing.push(link.componentCode!);
        jobLinksMap.set(link.jobId, existing);
        jobLinkTrackingMap.set(`${link.jobId}:${link.componentId}`, link);
      }
    } else if (jobs.length > 0) {
      const vesselIds = Array.from(new Set(jobs.map(j => j.vesselId).filter(Boolean)));
      for (const vid of vesselIds) {
        const links = await this.repo.findLinksByVessel(vid as string);
        for (const link of links) {
          const existing = jobLinksMap.get(link.jobId) || [];
          existing.push(link.componentCode!);
          jobLinksMap.set(link.jobId, existing);
          jobLinkTrackingMap.set(`${link.jobId}:${link.componentId}`, link);
        }
      }
    }

    const componentCacheById = new Map<string, any>();
    const componentCacheByCode = new Map<string, any>();

    const getComponentCached = async (compId: string) => {
      if (!componentCacheById.has(compId)) {
        componentCacheById.set(compId, await this.repo.findComponentById(compId));
      }
      return componentCacheById.get(compId);
    };

    const getComponentByCodeCached = async (code: string, vesselId: string) => {
      const key = `${vesselId}:${code}`;
      if (!componentCacheByCode.has(key)) {
        componentCacheByCode.set(key, await this.repo.findComponentByCode(code, vesselId));
      }
      return componentCacheByCode.get(key);
    };

    const hydratedJobs = await Promise.all(jobs.map(async (job) => {
      const linkedComponentCodes = jobLinksMap.get(job.juuid) || [];

      if (job.componentCode && !linkedComponentCodes.includes(job.componentCode)) {
        linkedComponentCodes.push(job.componentCode);
      }

      const componentTracking: Record<string, any> = {};
      const entries = Array.from(jobLinkTrackingMap.entries());
      for (const [linkKey, link] of entries) {
        if (linkKey.startsWith(`${job.juuid}:`)) {
          const compCode = (link as any).componentCode;
          if (compCode) {
            componentTracking[compCode] = {
              lastDoneDate: (link as any).lastDoneDate || null,
              nextDueDate: (link as any).nextDueDate || null,
              lastDoneRH: (link as any).lastDoneRH || null,
              nextDueRH: (link as any).nextDueRH || null,
            };
          }
        }
      }

      let hydratedJob: any = {
        ...job,
        linkedComponentCodes,
        componentTracking,
      };

      const hasMultipleComponents = Object.keys(componentTracking).length > 1;
      if (hasMultipleComponents) {
        hydratedJob.lastDoneDate = null;
        hydratedJob.nextDueDate = null;
        hydratedJob.lastDoneRH = null;
        hydratedJob.nextDueRH = null;
      } else if (componentId) {
        const linkKey = `${job.juuid}:${componentId}`;
        const componentLink = jobLinkTrackingMap.get(linkKey);
        if (componentLink) {
          if (componentLink.lastDoneDate) hydratedJob.lastDoneDate = componentLink.lastDoneDate;
          if (componentLink.nextDueDate) hydratedJob.nextDueDate = componentLink.nextDueDate;
          if (componentLink.lastDoneRH) hydratedJob.lastDoneRH = componentLink.lastDoneRH;
          if (componentLink.nextDueRH) hydratedJob.nextDueRH = componentLink.nextDueRH;
        }
      }

      if (job.maintenanceBasis === 'Running Hours' && job.componentId) {
        const component = await getComponentCached(job.componentId);
        if (component) {
          let currentRH = parseFloat(component.currentCumulativeRH || component.runningHours || '0');
          if (component.parentId && job.vesselId) {
            const parentComponent = await getComponentByCodeCached(component.parentId, job.vesselId);
            if (parentComponent) {
              currentRH = parseFloat(parentComponent.currentCumulativeRH || parentComponent.runningHours || '0');
            }
          }
          hydratedJob.componentCurrentRH = currentRH.toFixed(2);
        }
      }

      return hydratedJob;
    }));

    return hydratedJobs;
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.repo.findById(id);
  }
}
