import { getApiMode } from './componentApiV2';

const V2_JOBS_BASE = '/technical/api/v2/jobs';
const LEGACY_JOBS_BASE = '/technical/api/jobs';
const V2_HISTORY_BASE = '/technical/api/v2/job-maintenance-history';
const LEGACY_HISTORY_BASE = '/technical/api/job-maintenance-history';

export function getJobsListUrl(vesselId?: string, componentId?: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_JOBS_BASE : LEGACY_JOBS_BASE;
  const params = new URLSearchParams();
  if (vesselId) params.set('vesselId', vesselId);
  if (componentId) params.set('componentId', componentId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function getJobsListQueryKey(vesselId?: string, componentId?: string): string[] {
  return [getJobsListUrl(vesselId, componentId)];
}

export function getJobByIdUrl(id: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_JOBS_BASE : LEGACY_JOBS_BASE;
  return `${base}/${id}`;
}

export function getJobContextUrl(jobId: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_JOBS_BASE : LEGACY_JOBS_BASE;
  return `${base}/${jobId}/context`;
}

export function getJobContextQueryKey(jobId: string): string[] {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_JOBS_BASE : LEGACY_JOBS_BASE;
  return [`${base}/${jobId}/context`];
}

export function getCreateJobUrl(): string {
  const mode = getApiMode();
  return mode === 'v2' ? V2_JOBS_BASE : LEGACY_JOBS_BASE;
}

export function getUpdateJobUrl(id: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_JOBS_BASE : LEGACY_JOBS_BASE;
  return `${base}/${id}`;
}

export function getDeleteJobUrl(id: string): string {
  return getUpdateJobUrl(id);
}

export function getGenerateWoUrl(jobId: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_JOBS_BASE : LEGACY_JOBS_BASE;
  return `${base}/${jobId}/generate-wo`;
}

export function getJobMaintenanceHistoryUrl(jobId: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_HISTORY_BASE : LEGACY_HISTORY_BASE;
  return `${base}/${jobId}`;
}

export function getJobMaintenanceHistoryQueryKey(jobId: string): string[] {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_HISTORY_BASE : LEGACY_HISTORY_BASE;
  return [`${base}/${jobId}`];
}

export function getJobsBaseUrl(): string {
  const mode = getApiMode();
  return mode === 'v2' ? V2_JOBS_BASE : LEGACY_JOBS_BASE;
}

export function getJobsInvalidationPrefix(): string {
  const mode = getApiMode();
  return mode === 'v2' ? V2_JOBS_BASE : LEGACY_JOBS_BASE;
}
