import { JobRepository } from "./repositories/jobRepository";
import { JobListService } from "./services/jobListService";
import { JobContextService } from "./services/jobContextService";
import { JobMutationService } from "./services/jobMutationService";
import { JobHistoryService } from "./services/jobHistoryService";
import { JobController } from "./controllers/jobController";
import { createJobRouter, createJobHistoryRouter } from "./routes";

export function createV2JobModule() {
  const repository = new JobRepository();
  const listService = new JobListService(repository);
  const contextService = new JobContextService(repository);
  const mutationService = new JobMutationService(repository);
  const historyService = new JobHistoryService(repository);
  const controller = new JobController(listService, contextService, mutationService, historyService);
  const router = createJobRouter(controller);
  const historyRouter = createJobHistoryRouter(controller);

  return { router, historyRouter };
}
