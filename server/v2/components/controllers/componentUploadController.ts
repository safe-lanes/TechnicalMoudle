import type { Request, Response } from "express";
import type { ComponentUploadService } from "../services/componentUploadService";

export class ComponentUploadController {
  constructor(private uploadService: ComponentUploadService) {}

  async upload(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const result = await this.uploadService.processUpload(req.file);
    res.json(result);
  }
}
