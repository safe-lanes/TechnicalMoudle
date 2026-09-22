export interface HydrationJob {
  juuid?: string | null;
  vesselId?: string | null;
  jobNo?: string | null;
  componentId?: string | null;
  componentCode?: string | null;
  [key: string]: unknown;
}

export interface HydrationWorkOrder {
  jobId?: string | null;
  vesselId?: string | null;
  templateCode?: string | null;
  component?: string | null;
  componentCode?: string | null;
}

export interface HydrationJobIndexes<T extends HydrationJob> {
  byVesselJobAndComponentCode: Map<string, T>;
  byVesselJobAndComponentId: Map<string, T>;
  uniqueByVesselAndJob: Map<string, T>;
}

export function buildHydrationJobIndexes<T extends HydrationJob>(jobs: T[]): HydrationJobIndexes<T> {
  const byVesselJobAndComponentCode = new Map<string, T>();
  const byVesselJobAndComponentId = new Map<string, T>();
  const jobsByVesselAndNumber = new Map<string, T[]>();

  for (const job of jobs) {
    if (job.vesselId && job.jobNo) {
      const baseKey = `${job.vesselId}:${job.jobNo}`;
      const matches = jobsByVesselAndNumber.get(baseKey) ?? [];
      matches.push(job);
      jobsByVesselAndNumber.set(baseKey, matches);
      if (job.componentCode) {
        byVesselJobAndComponentCode.set(`${baseKey}:${job.componentCode}`, job);
      }
      if (job.componentId) {
        byVesselJobAndComponentId.set(`${baseKey}:${job.componentId}`, job);
      }
    }
  }

  const uniqueByVesselAndJob = new Map<string, T>();
  for (const [key, matches] of jobsByVesselAndNumber) {
    if (matches.length === 1) uniqueByVesselAndJob.set(key, matches[0]);
  }

  return {
    byVesselJobAndComponentCode,
    byVesselJobAndComponentId,
    uniqueByVesselAndJob,
  };
}

export function resolveWorkOrderHydrationJob<T extends HydrationJob>(
  workOrder: HydrationWorkOrder,
  jobsById: Map<string, T>,
  indexes: HydrationJobIndexes<T>,
): T | null {
  if (workOrder.jobId) {
    return jobsById.get(workOrder.jobId) ?? null;
  }
  if (workOrder.vesselId && workOrder.templateCode) {
    const baseKey = `${workOrder.vesselId}:${workOrder.templateCode}`;
    if (workOrder.componentCode) {
      const byCode = indexes.byVesselJobAndComponentCode.get(`${baseKey}:${workOrder.componentCode}`);
      if (byCode) return byCode;
    }
    if (workOrder.component) {
      const byId = indexes.byVesselJobAndComponentId.get(`${baseKey}:${workOrder.component}`);
      if (byId) return byId;
    }
    return indexes.uniqueByVesselAndJob.get(baseKey) ?? null;
  }
  return null;
}