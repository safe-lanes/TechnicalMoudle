import { Request, Response } from 'express';
import * as uploadService from '../services/componentUploadService';

// POST /components/upload — bulk upload CSV/XLSX
export async function upload(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const result = await uploadService.processUpload(req.file);
    res.json(result);
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process upload: ' + error.message });
  }
}
