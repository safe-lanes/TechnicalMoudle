import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ObjectStorageService, objectStorageClient, parseObjectPath, ObjectNotFoundError } from '../../../objectStorage';

// ── GET /download/docs/:filename ──
// Note: This endpoint is at /download/docs, not /technical/api - mounted separately

export async function downloadDoc(req: Request, res: Response) {
  const filename = req.params.filename;
  const allowedFiles = ['STORAGE_ANALYSIS.md', 'LOCAL_DEVELOPMENT_SETUP.md'];
  if (!allowedFiles.includes(filename)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const filePath = path.resolve(process.cwd(), filename);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/markdown');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
}

// ── POST /upload-document ──

export async function uploadDocument(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { documentType } = req.body;
  const file = req.file;

  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    return res.status(500).json({ error: 'Object storage not configured' });
  }

  const timestamp = Date.now();
  const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
  const entityId = `uploads/${documentType}_${timestamp}${fileExtension}`;
  const fullPath = `${privateDir}/${entityId}`;

  const { bucketName, objectName } = parseObjectPath(fullPath);

  const bucket = objectStorageClient.bucket(bucketName);
  await bucket.file(objectName).save(file.buffer, {
    metadata: { contentType: file.mimetype },
  });

  const fileKey = `/objects/${entityId}`;
  res.json({
    success: true,
    fileName: file.originalname,
    fileKey,
    uploadedAt: new Date().toISOString()
  });
}

// ── GET /documents/:fileKey(*) ──

export async function getDocument(req: Request, res: Response) {
  const fileKey = '/' + req.params.fileKey;
  const objectStorageService = new ObjectStorageService();

  const objectFile = await objectStorageService.getObjectEntityFile(fileKey);
  const [metadata] = await objectFile.getMetadata();
  const [fileContent] = await objectFile.download();
  const base64Content = fileContent.toString('base64');
  const mimeType = metadata.contentType || 'application/octet-stream';

  res.json({
    success: true,
    dataUrl: `data:${mimeType};base64,${base64Content}`,
    fileName: objectFile.name.substring(objectFile.name.lastIndexOf('/') + 1)
  });
}

// ── DELETE /documents/:fileKey(*) ──

export async function deleteDocument(req: Request, res: Response) {
  const fileKey = '/' + req.params.fileKey;
  const objectStorageService = new ObjectStorageService();

  const objectFile = await objectStorageService.getObjectEntityFile(fileKey);
  await objectFile.delete();

  res.json({ success: true, message: 'Document deleted successfully' });
}
