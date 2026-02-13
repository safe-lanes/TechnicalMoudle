import type { Request, Response } from "express";
import type { ComponentService } from "../services/componentService";
import type { DocumentStorageService } from "../services/documentStorageService";
import { insertComponentDocumentSchema, insertComponentClassRegulatorySchema, insertComponentRequisitionSchema } from "@shared/v2/components/schema";

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    fullName: string;
    email: string;
    role: string;
    vesselId: string | null;
    isActive: boolean;
  };
}

export class ComponentController {
  constructor(
    private service: ComponentService,
    private documentStorage: DocumentStorageService
  ) {}

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const components = await this.service.getByVesselId(req.params.vesselId);
    console.log(`V2 GET /vessel/${req.params.vesselId} returning ${components.length} components`);
    res.json(components);
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const component = await this.service.getById(req.params.id);
    res.json(component);
  }

  async listAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const vesselId = req.query.vesselId as string | undefined;
    const components = await this.service.getAll(vesselId);
    res.json(components);
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = req.body;
    const userId = req.user?.username || 'unknown';
    const component = await this.service.create(data, userId);
    console.log('[V2_API_CREATE] New component:', {
      id: component.id,
      code: component.componentCode,
      parentId: component.parentId,
      vesselId: component.vesselId
    });
    res.status(201).json(component);
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    console.log(`V2 PATCH /component/${req.params.id} with:`, JSON.stringify(req.body, null, 2).substring(0, 500));
    const data = req.body;
    const userId = req.user?.username || 'unknown';
    const component = await this.service.validateAndUpdate(req.params.id, data, userId);
    console.log(`V2 Updated component:`, component.componentCode, '| vesselId:', component.vesselId, '| parentId:', component.parentId);
    res.json(component);
  }

  async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    await this.service.remove(req.params.id);
    res.json({ success: true });
  }

  async inactivate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { cascadeInactivate, userId } = req.body;
    const result = await this.service.inactivate(
      req.params.id,
      userId || 'system',
      cascadeInactivate === true
    );

    if (!result.success) {
      if (result.activeChildrenCount && result.activeChildrenCount > 0) {
        res.status(400).json({
          success: false,
          error: result.message,
          code: 'ACTIVE_CHILDREN',
          activeChildrenCount: result.activeChildrenCount
        });
        return;
      }
      res.status(400).json({ success: false, error: result.message });
      return;
    }

    res.json(result);
  }

  async listDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = { role: req.user!.role, vesselId: req.user!.vesselId };
    const documents = await this.service.getDocuments(req.params.componentId, user);
    res.json(documents);
  }

  async createDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.file) {
      res.status(400).json({ error: "File upload required - cannot create document without a file" });
      return;
    }

    const componentId = req.params.componentId || req.body.componentId;
    const component = await this.service.getById(componentId);
    if (!component) {
      res.status(400).json({ error: "Invalid componentId - component not found" });
      return;
    }

    if (component.componentCode !== req.body.componentCode) {
      res.status(400).json({
        error: "componentCode mismatch - does not match component's code",
        componentCode: component.componentCode,
        providedCode: req.body.componentCode
      });
      return;
    }

    if (component.vesselId !== req.body.vesselId) {
      res.status(400).json({
        error: "vesselId mismatch - does not match component's vessel",
        componentVessel: component.vesselId,
        providedVessel: req.body.vesselId
      });
      return;
    }

    const timestamp = Date.now();
    const safeFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `${component.componentCode}/${timestamp}_${safeFileName}`;
    const fileSize = req.file.size;
    const storageBackend: 'object' = 'object';

    try {
      await this.documentStorage.uploadFile(req.file.buffer, req.file.mimetype, fileKey);
    } catch (storageError: any) {
      console.error("V2 Object storage upload failed:", storageError);
      if (storageError.message?.includes('Object storage not configured')) {
        res.status(500).json({ error: storageError.message });
      } else {
        res.status(500).json({ error: "Failed to upload file to object storage" });
      }
      return;
    }

    const coercedBody = {
      componentId: component.cuuid,
      componentCode: component.componentCode,
      vesselId: component.vesselId,
      fleetEquipmentCode: req.body.fleetEquipmentCode || null,
      fileName: req.body.fileName,
      fileType: req.body.fileType,
      version: req.body.version || "1.0",
      canShipView: req.body.canShipView === 'true' || req.body.canShipView === true,
      canShipDownload: req.body.canShipDownload === 'true' || req.body.canShipDownload === true,
      isActive: req.body.isActive === 'true' || req.body.isActive === true || req.body.isActive === undefined,
      notes: req.body.notes || null,
      uploadedBy: req.user!.username,
      fileKey,
      fileSize,
      storageBackend
    };

    const documentData = insertComponentDocumentSchema.parse(coercedBody);

    try {
      const document = await this.service.createDocumentRecord(documentData);
      res.json(document);
    } catch (dbError) {
      console.error("V2 Failed to create document in database, rolling back file upload:", dbError);
      try {
        await this.documentStorage.deleteFile(fileKey);
      } catch (deleteError) {
        console.error("V2 Failed to cleanup uploaded file after DB error:", deleteError);
      }
      res.status(500).json({ error: "Failed to create document record" });
    }
  }

  async updateDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    const updateSchema = insertComponentDocumentSchema.pick({
      version: true,
      canShipView: true,
      canShipDownload: true,
      isActive: true,
      notes: true
    }).partial();

    const parseBoolean = (value: any): boolean | undefined => {
      if (value === undefined || value === null) return undefined;
      if (value === true || value === 'true') return true;
      if (value === false || value === 'false') return false;
      return undefined;
    };

    const updateData: any = {};

    if (req.body.version !== undefined) {
      updateData.version = req.body.version;
    }
    const parsedCanShipView = parseBoolean(req.body.canShipView);
    if (parsedCanShipView !== undefined) {
      updateData.canShipView = parsedCanShipView;
    }
    const parsedCanShipDownload = parseBoolean(req.body.canShipDownload);
    if (parsedCanShipDownload !== undefined) {
      updateData.canShipDownload = parsedCanShipDownload;
    }
    const parsedIsActive = parseBoolean(req.body.isActive);
    if (parsedIsActive !== undefined) {
      updateData.isActive = parsedIsActive;
    }
    if (req.body.notes !== undefined) {
      updateData.notes = req.body.notes;
    }

    const validatedData = updateSchema.parse(updateData);
    const document = await this.service.updateDocumentRecord(parseInt(req.params.id), validatedData);
    res.json(document);
  }

  async removeDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    await this.service.removeDocumentRecord(parseInt(req.params.id));
    res.json({ success: true });
  }

  async downloadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    const document = await this.service.getDocumentById(parseInt(req.params.id));
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    if (req.user!.role === "Ship" && req.user!.vesselId) {
      if (req.user!.vesselId !== document.vesselId) {
        res.status(403).json({ error: "Cannot access documents from other vessels" });
        return;
      }
    }

    if (req.user!.role === "Ship" && !document.canShipDownload) {
      res.status(403).json({ error: "Insufficient permissions to download this document" });
      return;
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await this.documentStorage.downloadFile(document.fileKey);
    } catch (objectError: any) {
      console.error("V2 Failed to download from object storage:", objectError);
      if (objectError.message?.includes('Object storage not configured')) {
        res.status(500).json({ error: objectError.message });
      } else {
        res.status(404).json({ error: "Document file not found in object storage" });
      }
      return;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(fileBuffer);
  }

  async listClassRegulatory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = { role: req.user!.role, vesselId: req.user!.vesselId };
    const items = await this.service.getClassRegulatory(req.params.componentId, user);
    res.json(items);
  }

  async createClassRegulatory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const validatedData = insertComponentClassRegulatorySchema.parse({
      ...req.body,
      createdBy: req.user!.username,
      updatedBy: req.user!.username
    });
    const item = await this.service.createClassRegulatoryRecord(validatedData);
    res.json(item);
  }

  async updateClassRegulatory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const validatedData = insertComponentClassRegulatorySchema.partial().parse({
      ...req.body,
      updatedBy: req.user!.username
    });
    const item = await this.service.updateClassRegulatoryRecord(parseInt(req.params.id), validatedData);
    res.json(item);
  }

  async removeClassRegulatory(req: AuthenticatedRequest, res: Response): Promise<void> {
    await this.service.removeClassRegulatoryRecord(parseInt(req.params.id));
    res.json({ success: true });
  }

  async listRequisitions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = { role: req.user!.role, vesselId: req.user!.vesselId };
    const requisitions = await this.service.getRequisitions(req.params.componentId, user);
    res.json(requisitions);
  }

  async listAllRequisitions(req: AuthenticatedRequest, res: Response): Promise<void> {
    let vesselId = req.query.vesselId as string | undefined;
    if (req.user!.role === "Ship" && req.user!.vesselId) {
      vesselId = req.user!.vesselId;
    }
    const requisitions = await this.service.getAllRequisitions(vesselId);
    res.json(requisitions);
  }

  async getRequisitionItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const item = await this.service.getRequisitionItemById(parseInt(req.params.id), {
      role: req.user!.role,
      vesselId: req.user!.vesselId
    });
    res.json(item);
  }

  async createRequisition(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.user!.role === "Ship" && req.user!.vesselId) {
      if (req.body.vesselId && req.body.vesselId !== req.user!.vesselId) {
        res.status(403).json({
          error: "Cannot create requisitions for other vessels",
          assignedVessel: req.user!.vesselId,
          requestedVessel: req.body.vesselId
        });
        return;
      }
      req.body.vesselId = req.user!.vesselId;
    }

    const validatedData = insertComponentRequisitionSchema.parse({
      ...req.body,
      requestedBy: req.body.requestedBy || req.user!.username
    });

    const result = await this.service.createRequisitionRecord(validatedData);
    res.status(201).json(result);
  }

  async updateRequisition(req: AuthenticatedRequest, res: Response): Promise<void> {
    const existing = await this.service.getRequisitionItemById(parseInt(req.params.id), {
      role: req.user!.role,
      vesselId: req.user!.vesselId
    });

    const validatedData = insertComponentRequisitionSchema.partial().parse(req.body);

    if (req.user!.role !== "PMS Admin") {
      delete (validatedData as any).vesselId;
      delete (validatedData as any).componentId;
    }

    const result = await this.service.updateRequisitionRecord(parseInt(req.params.id), validatedData);
    res.json(result);
  }

  async removeRequisition(req: AuthenticatedRequest, res: Response): Promise<void> {
    await this.service.removeRequisitionRecord(parseInt(req.params.id));
    res.json({ success: true });
  }

  async listMaintenanceHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = { role: req.user!.role, vesselId: req.user!.vesselId };
    const history = await this.service.getMaintenanceHistory(req.params.componentId, user);
    res.json(history);
  }

  async listAllMaintenanceHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const history = await this.service.getAllMaintenanceHistory();
    res.json(history);
  }

  async getMaintenanceHistoryItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = { role: req.user!.role, vesselId: req.user!.vesselId };
    const item = await this.service.getMaintenanceHistoryItem(parseInt(req.params.id), user);
    res.json(item);
  }
}
