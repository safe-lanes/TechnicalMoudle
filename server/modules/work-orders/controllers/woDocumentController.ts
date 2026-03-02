import { Request, Response } from 'express';
import * as woDocService from '../services/woDocumentService';

export async function listDocuments(req: Request, res: Response) {
  const { workOrderId } = req.params;
  const documents = await woDocService.listDocuments(workOrderId);
  res.json(documents);
}

export async function uploadDocument(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { workOrderId } = req.params;
  const { documentType, vesselId } = req.body;

  if (!documentType) {
    return res.status(400).json({ error: 'documentType is required' });
  }
  if (!vesselId) {
    return res.status(400).json({ error: 'vesselId is required' });
  }

  const user = (req as any).user;
  const uploadedBy = user?.username || user?.fullName || 'Unknown';

  const document = await woDocService.uploadDocument(
    workOrderId,
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
  await woDocService.deleteDocument(documentId);
  res.json({ success: true, message: 'Document deleted successfully' });
}
