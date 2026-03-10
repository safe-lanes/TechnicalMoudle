import * as repo from '../repositories/componentRepository';
import { objectStorageClient, ObjectNotFoundError } from '../../../objectStorage';
import { insertComponentDocumentSchema } from '@shared/schema';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors';

interface UserInfo {
  username: string;
  role: string;
  vesselId?: string;
}

export async function listDocuments(componentId: string, user: UserInfo) {
  // Verify the component exists and check vessel access
  const component = await repo.findById(componentId);
  if (!component) throw new NotFoundError('Component not found');

  // For Ship users, enforce vessel scoping
  if (user.role === 'Ship' && user.vesselId) {
    if (component.vesselCode !== user.vesselId) {
      throw new ForbiddenError('Cannot access documents for components from other vessels');
    }
  }

  const documents = await repo.findDocuments(componentId);

  // Filter documents based on user role and permissions
  return documents.filter((doc: any) => {
    if (user.role === 'PMS Admin' || user.role === 'Sail Admin' || user.role === 'Office') return true;
    if (user.role === 'Ship') return doc.canShipView;
    return false;
  });
}

export async function createDocument(body: any, file: Express.Multer.File, user: UserInfo) {
  // Validate componentId exists
  const component = await repo.findById(body.componentId);
  if (!component) throw new ValidationError('Invalid componentId - component not found');

  // Verify componentCode matches
  if (component.componentCode !== body.componentCode) {
    throw new ValidationError('componentCode mismatch - does not match component\'s code');
  }

  // Verify vesselCode matches
  if (component.vesselCode !== body.vesselCode) {
    throw new ValidationError('vesselCode mismatch - does not match component\'s vessel');
  }

  // Upload file to object storage
  const timestamp = Date.now();
  const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileKey = `${component.componentCode}/${timestamp}_${safeFileName}`;
  const fileSize = file.size;
  const storageBackend: 'object' = 'object';

  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    console.error('❌ Object storage not configured - DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set');
    throw new Error('Object storage not configured. Please set up object storage in the Replit Object Storage panel.');
  }

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

  // Coerce types explicitly
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
    // Rollback: delete uploaded file if DB insert fails
    console.error('Failed to create document in database, rolling back file upload:', dbError);
    try {
      const bucket = objectStorageClient.bucket(bucketId);
      const storageFile = bucket.file(`.private/documents/${fileKey}`);
      await storageFile.delete();
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
  await repo.deleteDocument(id);
}

export async function downloadDocument(id: number, user: UserInfo): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
  const document = await repo.findDocument(id);
  if (!document) throw new NotFoundError('Document not found');

  // Verify vessel access for Ship users
  if (user.role === 'Ship' && user.vesselId) {
    if (user.vesselId !== document.vesselCode) {
      throw new ForbiddenError('Cannot access documents from other vessels');
    }
  }

  // Check download permissions for Ship users
  if (user.role === 'Ship' && !document.canShipDownload) {
    throw new ForbiddenError('Insufficient permissions to download this document');
  }

  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    console.error('❌ Object storage not configured - DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set');
    throw new Error('Object storage not configured. Please set up object storage in the Replit Object Storage panel.');
  }

  let fileBuffer: Buffer;
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

  return {
    buffer: fileBuffer,
    fileName: document.fileName,
    contentType: 'application/octet-stream'
  };
}
