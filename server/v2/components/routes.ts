import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { z } from "zod";
import type { ComponentController } from "./controllers/componentController";
import type { ComponentUploadController } from "./controllers/componentUploadController";
import { NotFoundError, ValidationError, ForbiddenError } from "./services/errors";
import { requireAuth, requirePMSAdmin } from "../../middleware/auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((error: any) => {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof ForbiddenError) {
        return res.status(403).json({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error("V2 Component Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    });
  };
}

export function createComponentRouter(
  controller: ComponentController,
  uploadController: ComponentUploadController
): Router {
  const router = Router();

  router.get('/component/all', asyncHandler((req, res) => controller.listAll(req as any, res)));
  router.get('/component/by-id/:id', asyncHandler((req, res) => controller.getById(req as any, res)));
  router.post('/component', asyncHandler((req, res) => controller.create(req as any, res)));
  router.patch('/component/:id', asyncHandler((req, res) => controller.update(req as any, res)));
  router.delete('/component/:id', asyncHandler((req, res) => controller.remove(req as any, res)));
  router.post('/component/:id/inactivate', asyncHandler((req, res) => controller.inactivate(req as any, res)));
  router.post('/component/upload', upload.single('file'), asyncHandler((req, res) => uploadController.upload(req, res)));

  router.get('/component/:componentId/documents', requireAuth, asyncHandler((req, res) => controller.listDocuments(req as any, res)));
  router.post('/component/:componentId/documents', requirePMSAdmin, upload.single('file'), asyncHandler((req, res) => controller.createDocument(req as any, res)));
  router.put('/component/documents/:id', requirePMSAdmin, asyncHandler((req, res) => controller.updateDocument(req as any, res)));
  router.delete('/component/documents/:id', requirePMSAdmin, asyncHandler((req, res) => controller.removeDocument(req as any, res)));
  router.get('/component/documents/:id/download', requireAuth, asyncHandler((req, res) => controller.downloadDocument(req as any, res)));

  router.get('/component/:componentId/class-regulatory', requireAuth, asyncHandler((req, res) => controller.listClassRegulatory(req as any, res)));
  router.post('/component/:componentId/class-regulatory', requirePMSAdmin, asyncHandler((req, res) => controller.createClassRegulatory(req as any, res)));
  router.put('/component/class-regulatory/:id', requirePMSAdmin, asyncHandler((req, res) => controller.updateClassRegulatory(req as any, res)));
  router.delete('/component/class-regulatory/:id', requirePMSAdmin, asyncHandler((req, res) => controller.removeClassRegulatory(req as any, res)));

  router.get('/component/:componentId/requisitions', requireAuth, asyncHandler((req, res) => controller.listRequisitions(req as any, res)));
  router.get('/component/requisitions/all', requireAuth, asyncHandler((req, res) => controller.listAllRequisitions(req as any, res)));
  router.get('/component/requisitions/item/:id', requireAuth, asyncHandler((req, res) => controller.getRequisitionItem(req as any, res)));
  router.post('/component/:componentId/requisitions', requireAuth, asyncHandler((req, res) => controller.createRequisition(req as any, res)));
  router.put('/component/requisitions/:id', requireAuth, asyncHandler((req, res) => controller.updateRequisition(req as any, res)));
  router.delete('/component/requisitions/:id', requirePMSAdmin, asyncHandler((req, res) => controller.removeRequisition(req as any, res)));

  router.get('/component/maintenance-history/all', asyncHandler((req, res) => controller.listAllMaintenanceHistory(req as any, res)));
  router.get('/component/:componentId/maintenance-history', requireAuth, asyncHandler((req, res) => controller.listMaintenanceHistory(req as any, res)));
  router.get('/component/maintenance-history/item/:id', requireAuth, asyncHandler((req, res) => controller.getMaintenanceHistoryItem(req as any, res)));

  router.get('/component/:vesselId', asyncHandler((req, res) => controller.list(req as any, res)));

  return router;
}
