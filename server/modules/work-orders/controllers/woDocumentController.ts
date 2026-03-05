import { Request, Response } from 'express';
import * as woDocService from '../services/woDocumentService';
import * as woRepo from '../repositories/workOrderRepository';
import { findById as findDocById } from '../repositories/documentRepository';
import { NotFoundError } from '../../shared/errors';
import { isCompletedStatus } from '../../../utils/workOrderStatus';

async function resolveWorkOrder(idOrUuid: string) {
  const wo = await woRepo.findById(idOrUuid);
  if (!wo) throw new NotFoundError('Work order not found');
  return wo;
}

export async function listDocuments(req: Request, res: Response) {
  const wo = await resolveWorkOrder(req.params.workOrderId);
  const documents = await woDocService.listDocuments(wo.wouuid);
  res.json(documents);
}

export async function uploadDocument(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { documentType, vesselId } = req.body;

  if (!documentType) {
    return res.status(400).json({ error: 'documentType is required' });
  }
  if (!vesselId) {
    return res.status(400).json({ error: 'vesselId is required' });
  }

  const wo = await resolveWorkOrder(req.params.workOrderId);

  if (isCompletedStatus(wo.status)) {
    return res.status(403).json({ error: 'Editing is not allowed because the Work Order is completed.' });
  }

  const user = (req as any).user;
  const uploadedBy = user?.username || user?.fullName || 'Unknown';

  const document = await woDocService.uploadDocument(
    wo.wouuid,
    vesselId,
    documentType,
    req.file,
    uploadedBy
  );

  res.status(201).json(document);
}

export async function downloadDocument(req: Request, res: Response) {
  const { documentId } = req.params;
  const { buffer, fileName, contentType } = await woDocService.downloadDocument(documentId);

  const base64Content = buffer.toString('base64');
  res.json({
    success: true,
    dataUrl: `data:${contentType};base64,${base64Content}`,
    fileName,
  });
}

export async function deleteDocument(req: Request, res: Response) {
  const { documentId } = req.params;

  const doc = await findDocById(documentId);
  if (doc && doc.workOrderUuid) {
    const wo = await woRepo.findById(doc.workOrderUuid);
    if (wo && isCompletedStatus(wo.status)) {
      return res.status(403).json({ error: 'Editing is not allowed because the Work Order is completed.' });
    }
  }

  await woDocService.deleteDocument(documentId);
  res.json({ success: true, message: 'Document deleted successfully' });
}
