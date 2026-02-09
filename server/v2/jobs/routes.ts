import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { JobController } from "./controllers/jobController";

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((error: any) => {
      console.error("V2 Jobs Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    });
  };
}

export function createJobRouter(controller: JobController): Router {
  const router = Router();

  router.get('/', asyncHandler((req, res) => controller.list(req as any, res)));
  router.post('/', asyncHandler((req, res) => controller.create(req as any, res)));

  router.get('/:id', asyncHandler((req, res) => controller.getById(req as any, res)));
  router.patch('/:id', asyncHandler((req, res) => controller.update(req as any, res)));
  router.delete('/:id', asyncHandler((req, res) => controller.remove(req as any, res)));

  router.get('/:id/context', asyncHandler((req, res) => controller.getContext(req as any, res)));
  router.post('/:id/generate-wo', asyncHandler((req, res) => controller.generateWorkOrder(req as any, res)));

  return router;
}

export function createJobHistoryRouter(controller: JobController): Router {
  const router = Router();

  router.get('/:jobId', asyncHandler((req, res) => controller.getMaintenanceHistory(req as any, res)));

  return router;
}
