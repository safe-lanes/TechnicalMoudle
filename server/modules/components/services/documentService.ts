import * as fs from 'fs';
import * as path from 'path';
import * as repo from '../repositories/componentRepository';
import { objectStorageClient, ObjectNotFoundError } from '../../../objectStorage';
import { insertComponentDocumentSchema } from '@shared/schema';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors';

interface UserInfo {
  username: string;
  role: string;
  vesselId?: string;
}

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), '.private', 'component-docs');

function useObjectStorage(): boolean {
  return !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
}

function saveToLocalFS(buffer: Buffer, fileKey: string): string {
  const fullPath = path.join(LOCAL_STORAGE_DIR, fileKey);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, buffer);
  return fileKey;
}

function readFromLocalFS(fileKey: string): Buffer {
  const fullPath = path.join(LOCAL_STORAGE_DIR, fileKey);
  if (!fs.existsSync(fullPath)) {
    throw new NotFoundError('Document file not found in local storage');
  }
  return fs.readFileSync(fullPath);
}

function deleteFromLocalFS(fileKey: string): void {
  const fullPath = path.join(LOCAL_STORAGE_DIR, fileKey);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

export async function listDocuments(componentId: string, user: UserInfo) {
  const component = await repo.findById(componentId);
  if (!component) throw new NotFoundError('Component not found');

  if (user.role === 'Ship' && user.vesselId) {
    if (component.vesselCode !== user.vesselId) {
      throw new ForbiddenError('Cannot access documents for components from other vessels');
    }
  }

  const documents = await repo.findDocuments(componentId);

  return documents.filter((doc: any) => {
    if (user.role === 'PMS Admin' || user.role === 'Sail Admin' || user.role === 'Office') return true;
    if (user.role === 'Ship') return doc.canShipView;
    return false;
  });
}

export async function createDocument(body: any, file: Express.Multer.File, user: UserInfo) {
  const component = await repo.findById(body.componentId);
  if (!component) throw new ValidationError('Invalid componentId - component not found');

  if (component.componentCode !== body.componentCode) {
    throw new ValidationError('componentCode mismatch - does not match component\'s code');
  }

  if (component.vesselCode !== body.vesselCode) {
    throw new ValidationError('vesselCode mismatch - does not match component\'s vessel');
  }

  const timestamp = Date.now();
  const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileKey = `${component.componentCode}/${timestamp}_${safeFileName}`;
  const fileSize = file.size;
  const storageBackend: 'object' | 'local' = useObjectStorage() ? 'object' : 'local';

  if (storageBackend === 'object') {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
    try {
      const bucket = objectStorageClient.bucket(bucketId);
      const storageFile = bucket.file(`.private/documents/${fileKey}`);
      await storageFile.save(file.buffer, {
        metadata: { contentType: file.mimetype }
      });
      console.log(`📤 Uploaded file to object storage: ${fileKey}`);
    } catch (storageError) {
      console.error('❌ Object storage upload failed:', storageError);
      throw new Error('Failed to upload file to object storage');
    }
  } else {
    saveToLocalFS(file.buffer, fileKey);
    console.log(`📤 Saved file to local storage: ${fileKey}`);
  }

  const coercedBody = {
    componentId: component.cuuid,
    componentCode: component.componentCode,
    vesselCode: component.vesselCode,
    fleetEquipmentCode: body.fleetEquipmentCode || null,
    fileName: body.fileName,
    fileType: body.fileType,
    version: body.version || '1.0',
    canShipView: body.canShipView === 'true' || body.canShipView === true,
    canShipDownload: body.canShipDownload === 'true' || body.canShipDownload === true,
    isActive: body.isActive === 'true' || body.isActive === true || body.isActive === undefined,
    notes: body.notes || null,
    uploadedBy: user.username,
    fileKey,
    fileSize,
    storageBackend
  };

  const documentData = insertComponentDocumentSchema.parse(coercedBody);

  try {
    return await repo.createDocument(documentData);
  } catch (dbError) {
    console.error('Failed to create document in database, rolling back file upload:', dbError);
    try {
      if (storageBackend === 'object') {
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
        const bucket = objectStorageClient.bucket(bucketId);
        const storageFile = bucket.file(`.private/documents/${fileKey}`);
        await storageFile.delete();
      } else {
        deleteFromLocalFS(fileKey);
      }
    } catch (deleteError) {
      console.error('Failed to cleanup uploaded file after DB error:', deleteError);
    }
    throw new Error('Failed to create document record');
  }
}

export async function updateDocument(id: number, body: any) {
  const parseBoolean = (value: any): boolean | undefined => {
    if (value === undefined || value === null) return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  };

  const updateData: any = {};
  if (body.version !== undefined) updateData.version = body.version;
  const parsedCanShipView = parseBoolean(body.canShipView);
  if (parsedCanShipView !== undefined) updateData.canShipView = parsedCanShipView;
  const parsedCanShipDownload = parseBoolean(body.canShipDownload);
  if (parsedCanShipDownload !== undefined) updateData.canShipDownload = parsedCanShipDownload;
  const parsedIsActive = parseBoolean(body.isActive);
  if (parsedIsActive !== undefined) updateData.isActive = parsedIsActive;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const updateSchema = insertComponentDocumentSchema.pick({
    version: true,
    canShipView: true,
    canShipDownload: true,
    isActive: true,
    notes: true
  }).partial();

  const validatedData = updateSchema.parse(updateData);
  return repo.updateDocument(id, validatedData);
}

export async function deleteDocument(id: number) {
  const document = await repo.findDocument(id);
  if (document) {
    try {
      if (document.storageBackend === 'local' || !useObjectStorage()) {
        deleteFromLocalFS(document.fileKey);
      } else {
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
        const bucket = objectStorageClient.bucket(bucketId);
        const storageFile = bucket.file(`.private/documents/${document.fileKey}`);
        await storageFile.delete();
      }
      console.log(`🗑️ Deleted file from storage: ${document.fileKey}`);
    } catch (err) {
      console.error('Failed to delete file from storage (continuing with DB cleanup):', err);
    }
  }
  await repo.deleteDocument(id);
}

export async function downloadDocument(id: number, user: UserInfo): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
  const document = await repo.findDocument(id);
  if (!document) throw new NotFoundError('Document not found');

  if (user.role === 'Ship' && user.vesselId) {
    if (user.vesselId !== document.vesselCode) {
      throw new ForbiddenError('Cannot access documents from other vessels');
    }
  }

  if (user.role === 'Ship' && !document.canShipDownload) {
    throw new ForbiddenError('Insufficient permissions to download this document');
  }

  let fileBuffer: Buffer;

  if (document.storageBackend === 'local' || !useObjectStorage()) {
    fileBuffer = readFromLocalFS(document.fileKey);
    console.log(`📤 Serving file from local storage: ${document.fileKey}`);
  } else {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      throw new Error('Object storage not configured');
    }
    try {
      const bucket = objectStorageClient.bucket(bucketId);
      const storageFile = bucket.file(`.private/documents/${document.fileKey}`);
      [fileBuffer] = await storageFile.download();
      console.log(`📤 Serving file from object storage: ${document.fileKey}`);
    } catch (objectError) {
      if (objectError instanceof ObjectNotFoundError) {
        throw new NotFoundError('Document file not found in storage');
      }
      console.error('Failed to download from object storage:', objectError);
      throw new NotFoundError('Document file not found in object storage');
    }
  }

  return {
    buffer: fileBuffer,
    fileName: document.fileName,
    contentType: 'application/octet-stream'
  };
}
