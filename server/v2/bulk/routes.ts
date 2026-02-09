import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { BulkRepository } from './repositories/bulkRepository';
import { BulkSheetService } from './services/bulkSheetService';
import { BulkDryRunService } from './services/bulkDryRunService';
import { BulkImportService } from './services/bulkImportService';
import { BulkHistoryService } from './services/bulkHistoryService';
import { BulkUndoService } from './services/bulkUndoService';
import { BulkTemplateService } from './services/bulkTemplateService';
import { BulkController } from './controllers/bulkController';
import { BulkNotFoundError, BulkValidationError, BulkConflictError, BulkImportError } from './services/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((error: any) => {
      if (error instanceof BulkNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof BulkValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof BulkConflictError) {
        return res.status(409).json({ error: error.message, conflicts: error.conflicts });
      }
      if (error instanceof BulkImportError) {
        return res.status(500).json({ error: error.message });
      }
      console.error('V2 Bulk Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    });
  };
}

export function createBulkRouter(): Router {
  const repository = new BulkRepository();
  const sheetService = new BulkSheetService();
  const dryRunService = new BulkDryRunService(repository);
  const historyService = new BulkHistoryService();
  const importService = new BulkImportService(repository, historyService);
  const undoService = new BulkUndoService(repository, historyService);
  const templateService = new BulkTemplateService();

  const controller = new BulkController(
    sheetService,
    dryRunService,
    importService,
    historyService,
    undoService,
    templateService
  );

  const router = Router();

  router.get('/template', asyncHandler((req, res) => controller.getTemplate(req, res)));
  router.post('/sheets', upload.single('file'), asyncHandler((req, res) => controller.getSheets(req, res)));
  router.post('/dry-run', upload.single('file'), asyncHandler((req, res) => controller.dryRun(req, res)));
  router.post('/import', asyncHandler((req, res) => controller.doImport(req, res)));
  router.get('/history', asyncHandler((req, res) => controller.getHistory(req, res)));
  router.get('/history/:id/download-original', asyncHandler((req, res) => controller.downloadOriginal(req, res)));
  router.get('/history/:id/:fileType', asyncHandler((req, res) => controller.getHistoryFile(req, res)));
  router.post('/undo/:historyId', asyncHandler((req, res) => controller.undoImport(req, res)));

  return router;
}
