import type { Request, Response } from "express";
import type { JobListService } from "../services/jobListService";
import type { JobContextService } from "../services/jobContextService";
import type { JobMutationService } from "../services/jobMutationService";
import type { JobHistoryService } from "../services/jobHistoryService";

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    fullName: string;
    email: string;
    role: string;
    vesselId: string | null;
    isActive: boolean;
  };
}

export class JobController {
  constructor(
    private listService: JobListService,
    private contextService: JobContextService,
    private mutationService: JobMutationService,
    private historyService: JobHistoryService
  ) {}

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const vesselId = req.query.vesselId as string | undefined;
    const componentId = req.query.componentId as string | undefined;
    const jobs = await this.listService.getJobs(vesselId, componentId);
    res.json(jobs);
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const job = await this.listService.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(job);
  }

  async getContext(req: AuthenticatedRequest, res: Response): Promise<void> {
    const context = await this.contextService.getJobContext(req.params.id);
    if (!context) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(context);
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await this.mutationService.createJob(req.body);
    if (result.error) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.job);
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await this.mutationService.updateJob(req.params.id, req.body);
    if (result.error) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }
    res.json(result.job);
  }

  async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    await this.mutationService.deleteJob(req.params.id);
    res.json({ success: true });
  }

  async getMaintenanceHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user ? { role: req.user.role, vesselId: req.user.vesselId || undefined } : undefined;
    const result = await this.historyService.getMaintenanceHistory(req.params.jobId, user);
    if (result.error) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }
    res.json(result.data);
  }

  async generateWorkOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const jobId = req.params.id;
    const { reason, activeComponentCode } = req.body;

    if (!reason || !['Planning', 'Breakdown', 'Other'].includes(reason)) {
      res.status(400).json({ error: "Invalid reason. Must be 'Planning', 'Breakdown', or 'Other'" });
      return;
    }

    const { jobDueScanner } = await import("../../services/jobDueScanner");
    const result = await jobDueScanner.generateWorkOrderForJob(jobId, reason, activeComponentCode);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result.workOrder);
  }
}
