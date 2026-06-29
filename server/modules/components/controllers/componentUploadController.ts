import { Request, Response } from 'express';
import * as uploadService from '../services/componentUploadService';
import { captureTenantFromReq } from '../../../utils/tenantConnectionManager';

// POST /components/upload — bulk upload CSV/XLSX
export async function upload(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // multer broke the ALS chain; re-enter the tenant context (req.tenantTuid stashed pre-multer).
    const result = await captureTenantFromReq(req)(() => uploadService.processUpload(req.file!));
    res.json(result);
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process upload: ' + error.message });
  }
}
