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

  // ─── Core CRUD ──────────────────────────────────────────────
  // GET  /                         → list all components (optional ?vesselId= filter)
  // POST /                         → create a component
  // POST /upload                   → bulk upload components (multipart)
  router.get('/', asyncHandler((req, res) => controller.listAll(req as any, res)));
  router.post('/', asyncHandler((req, res) => controller.create(req as any, res)));
  router.post('/upload', upload.single('file'), asyncHandler((req, res) => uploadController.upload(req, res)));

  // GET  /vessel/:vesselId         → list components for a specific vessel
  router.get('/vessel/:vesselId', asyncHandler((req, res) => controller.list(req as any, res)));

  // ─── Document sub-resources (by document ID) ───────────────
  // GET    /documents/:id/download → download document file
  // PUT    /documents/:id          → update document metadata
  // DELETE /documents/:id          → delete document
  router.get('/documents/:id/download', requireAuth, asyncHandler((req, res) => controller.downloadDocument(req as any, res)));
  router.put('/documents/:id', requirePMSAdmin, asyncHandler((req, res) => controller.updateDocument(req as any, res)));
  router.delete('/documents/:id', requirePMSAdmin, asyncHandler((req, res) => controller.removeDocument(req as any, res)));

  // ─── Class/Regulatory sub-resources (by item ID) ───────────
  // PUT    /class-regulatory/:id   → update class/regulatory item
  // DELETE /class-regulatory/:id   → delete class/regulatory item
  router.put('/class-regulatory/:id', requirePMSAdmin, asyncHandler((req, res) => controller.updateClassRegulatory(req as any, res)));
  router.delete('/class-regulatory/:id', requirePMSAdmin, asyncHandler((req, res) => controller.removeClassRegulatory(req as any, res)));

  // ─── Requisition sub-resources (by item ID + collection) ───
  // GET    /requisitions           → list all requisitions (optional ?vesselId= filter)
  // GET    /requisitions/:id       → get single requisition
  // PUT    /requisitions/:id       → update requisition
  // DELETE /requisitions/:id       → delete requisition
  router.get('/requisitions', requireAuth, asyncHandler((req, res) => controller.listAllRequisitions(req as any, res)));
  router.get('/requisitions/:id', requireAuth, asyncHandler((req, res) => controller.getRequisitionItem(req as any, res)));
  router.put('/requisitions/:id', requireAuth, asyncHandler((req, res) => controller.updateRequisition(req as any, res)));
  router.delete('/requisitions/:id', requirePMSAdmin, asyncHandler((req, res) => controller.removeRequisition(req as any, res)));

  // ─── Maintenance History sub-resources (collection + item) ─
  // GET    /maintenance-history     → list all maintenance history
  // GET    /maintenance-history/:id → get single maintenance history item
  router.get('/maintenance-history', asyncHandler((req, res) => controller.listAllMaintenanceHistory(req as any, res)));
  router.get('/maintenance-history/:id', requireAuth, asyncHandler((req, res) => controller.getMaintenanceHistoryItem(req as any, res)));

  // ─── Component-scoped sub-resources (nested under /:componentId) ─
  // GET    /:componentId/documents             → list component's documents
  // POST   /:componentId/documents             → upload document to component
  // GET    /:componentId/class-regulatory       → list component's class/regulatory items
  // POST   /:componentId/class-regulatory       → create class/regulatory item for component
  // GET    /:componentId/requisitions           → list component's requisitions
  // POST   /:componentId/requisitions           → create requisition for component
  // GET    /:componentId/maintenance-history    → list component's maintenance history
  router.get('/:componentId/documents', requireAuth, asyncHandler((req, res) => controller.listDocuments(req as any, res)));
  router.post('/:componentId/documents', requirePMSAdmin, upload.single('file'), asyncHandler((req, res) => controller.createDocument(req as any, res)));
  router.get('/:componentId/class-regulatory', requireAuth, asyncHandler((req, res) => controller.listClassRegulatory(req as any, res)));
  router.post('/:componentId/class-regulatory', requirePMSAdmin, asyncHandler((req, res) => controller.createClassRegulatory(req as any, res)));
  router.get('/:componentId/requisitions', requireAuth, asyncHandler((req, res) => controller.listRequisitions(req as any, res)));
  router.post('/:componentId/requisitions', requireAuth, asyncHandler((req, res) => controller.createRequisition(req as any, res)));
  router.get('/:componentId/maintenance-history', requireAuth, asyncHandler((req, res) => controller.listMaintenanceHistory(req as any, res)));

  // ─── Single component operations (MUST be last — /:id is a catch-all) ─
  // GET    /:id                    → get component by ID
  // PATCH  /:id                    → update component
  // DELETE /:id                    → delete component
  // PATCH  /:id/status             → inactivate component (with cascade option)
  router.get('/:id', asyncHandler((req, res) => controller.getById(req as any, res)));
  router.patch('/:id', asyncHandler((req, res) => controller.update(req as any, res)));
  router.delete('/:id', asyncHandler((req, res) => controller.remove(req as any, res)));
  router.patch('/:id/status', asyncHandler((req, res) => controller.inactivate(req as any, res)));

  return router;
}
