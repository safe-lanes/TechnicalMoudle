import { JobRepository } from '../repositories/jobRepository';

export class JobHistoryService {
  constructor(private repo: JobRepository) {}

  async getMaintenanceHistory(jobId: string, user?: { role: string; vesselId?: string }): Promise<{ data?: any[]; error?: string; status?: number }> {
    const job = await this.repo.findById(jobId);
    if (!job) return { error: 'Job not found', status: 404 };

    if (user?.role === 'Ship' && user.vesselId) {
      if (job.vesselId !== user.vesselId) {
        return { error: 'Cannot access maintenance history for jobs from other vessels', status: 403 };
      }
    }

    let history = await this.repo.findHistoryByJobId(jobId);
    if (history.length === 0 && job.jobNo) {
      history = await this.repo.findHistoryByJobNo(job.jobNo);
    }

    return { data: history };
  }
}
