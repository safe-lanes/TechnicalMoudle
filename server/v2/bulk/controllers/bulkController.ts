import type { Request, Response } from 'express';
import type { BulkSheetService } from '../services/bulkSheetService';
import type { BulkDryRunService } from '../services/bulkDryRunService';
import type { BulkImportService } from '../services/bulkImportService';
import type { BulkHistoryService } from '../services/bulkHistoryService';
import type { BulkUndoService } from '../services/bulkUndoService';
import type { BulkTemplateService } from '../services/bulkTemplateService';
import { objectStorageClient } from '../../../objectStorage';

export class BulkController {
  constructor(
    private sheetService: BulkSheetService,
    private dryRunService: BulkDryRunService,
    private importService: BulkImportService,
    private historyService: BulkHistoryService,
    private undoService: BulkUndoService,
    private templateService: BulkTemplateService
  ) {}

  async getSheets(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const sheets = this.sheetService.getSheets({
      buffer: file.buffer,
      originalname: file.originalname,
    });
    res.json({ sheets });
  }

  async dryRun(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { type = 'components', mode = 'add', vesselId, sheetName } = req.body;

    const { fileToken, results } = await this.dryRunService.dryRun(
      { buffer: file.buffer, originalname: file.originalname },
      type,
      mode,
      vesselId,
      sheetName
    );

    res.json({ fileToken, ...results });
  }

  async doImport(req: Request, res: Response): Promise<void> {
    const { fileToken, mode = 'add', vesselId, archiveMissing, rowIndices } = req.body;

    if (!fileToken) {
      res.status(400).json({ error: 'fileToken is required' });
      return;
    }

    const userId = (req as any).user?.id || 'system';

    const { historyId, result } = await this.importService.doImport({
      fileToken,
      mode,
      vesselId,
      userId,
      archiveMissing,
      rowIndices,
    });

    res.json({ historyId, ...result });
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    const { type, limit = '50', offset = '0' } = req.query;
    const result = await this.historyService.getHistoryList(
      type as string | undefined,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );
    res.json(result);
  }

  async getHistoryFile(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const history = await this.historyService.getHistoryById(id);
    if (!history) {
      res.status(404).json({ error: 'History record not found' });
      return;
    }
    res.json(history);
  }

  async downloadOriginal(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const history = await this.historyService.getHistoryById(id);

    if (!history) {
      res.status(404).json({ error: 'History record not found' });
      return;
    }

    if (!history.storedFilePath) {
      res.status(404).json({ error: 'Original file not available' });
      return;
    }

    try {
      const { bucketName, objectName } = parseObjectPath(history.storedFilePath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({ error: 'Original file not found in storage' });
        return;
      }

      const ext = history.originalName?.substring(history.originalName.lastIndexOf('.')) || '.xlsx';
      const filename = `${history.originalName || `import-${id}${ext}`}`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      const [buffer] = await file.download();
      res.send(buffer);
    } catch (error: any) {
      res.status(404).json({ error: 'Original file not found' });
    }
  }

  async undoImport(req: Request, res: Response): Promise<void> {
    const { historyId } = req.params;
    const result = await this.undoService.undoImport(historyId);
    res.json(result);
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    const buffer = this.templateService.generateComponentTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="component-import-template.xlsx"');
    res.send(buffer);
  }
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith('/')) path = `/${path}`;
  const parts = path.split('/');
  const bucketName = parts[1];
  const objectName = parts.slice(2).join('/');
  return { bucketName, objectName };
}
