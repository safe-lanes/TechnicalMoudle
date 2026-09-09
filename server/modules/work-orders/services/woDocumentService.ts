import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import * as docRepo from '../repositories/documentRepository';
import { ObjectStorageService, parseObjectPath } from '../../../objectStorage';
import { ValidationError, NotFoundError } from '../../shared/errors';
import { FileSyncProcessor } from '../../sync/fileSyncProcessor';
import { logFieldChanges } from '../../sync';
import type { WorkOrderDocument } from '@shared/schema';

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.csv'];

const MAX_RAW_FILE_SIZE = 25 * 1024 * 1024;
const TARGET_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DOCS_PER_TYPE = 5;

const VALID_DOC_TYPES = ['riskAssessment', 'safetyChecklist', 'operationalForm', 'other', 'postponement', 'postponementRiskAssessment'];

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), '.private', 'wo-docs');

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : '';
}

function isImageMime(mimetype: string): boolean {
  return mimetype === 'image/jpeg' || mimetype === 'image/png';
}

function useObjectStorage(): boolean {
  return !!process.env.PRIVATE_OBJECT_DIR;
}

async function compressImage(buffer: Buffer, mimetype: string): Promise<Buffer> {
  let processor = sharp(buffer);

  const metadata = await processor.metadata();
  const maxDimension = 2048;
  if (metadata.width && metadata.width > maxDimension) {
    processor = processor.resize({ width: maxDimension, withoutEnlargement: true });
  }

  if (mimetype === 'image/jpeg') {
    let quality = 85;
    let result = await processor.jpeg({ quality }).toBuffer();
    while (result.length > TARGET_FILE_SIZE && quality > 30) {
      quality -= 10;
      result = await sharp(buffer).resize({ width: maxDimension, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
    }
    return result;
  }

  let result = await processor.png({ compressionLevel: 9, quality: 80 }).toBuffer();
  if (result.length > TARGET_FILE_SIZE) {
    result = await sharp(buffer)
      .resize({ width: maxDimension, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
  return result;
}

async function saveToLocalFS(buffer: Buffer, relativePath: string): Promise<string> {
  const fullPath = path.join(LOCAL_STORAGE_DIR, relativePath);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, buffer);
  return `local://${relativePath}`;
}

async function readFromLocalFS(fileKey: string): Promise<Buffer> {
  const relativePath = fileKey.replace('local://', '');
  const fullPath = path.join(LOCAL_STORAGE_DIR, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new NotFoundError('Document file not found in local storage');
  }
  return fs.readFileSync(fullPath);
}

async function deleteFromLocalFS(fileKey: string): Promise<void> {
  const relativePath = fileKey.replace('local://', '');
  const fullPath = path.join(LOCAL_STORAGE_DIR, relativePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

async function saveToObjectStorage(buffer: Buffer, storageFileName: string, folder: string): Promise<string> {
  const objectService = new ObjectStorageService();
  const storagePath = await objectService.uploadBuffer(buffer, storageFileName, folder);
  return objectService.normalizeObjectEntityPath(storagePath);
}

async function readFromObjectStorage(fileKey: string): Promise<Buffer> {
  const objectService = new ObjectStorageService();
  const objectFile = await objectService.getObjectEntityFile(fileKey);
  const [fileBuffer] = await objectFile.download();
  return fileBuffer;
}

async function deleteFromObjectStorage(fileKey: string): Promise<void> {
  const objectService = new ObjectStorageService();
  const objectFile = await objectService.getObjectEntityFile(fileKey);
  await objectFile.delete();
}

export async function listDocuments(workOrderId: string): Promise<WorkOrderDocument[]> {
  return docRepo.findByWorkOrderId(workOrderId);
}

export async function uploadDocument(
  workOrderId: string,
  vesselId: string,
  documentType: string,
  file: Express.Multer.File,
  uploadedBy: string
): Promise<WorkOrderDocument> {
  if (!VALID_DOC_TYPES.includes(documentType)) {
    throw new ValidationError(`Invalid document type. Must be one of: ${VALID_DOC_TYPES.join(', ')}`);
  }

  const ext = getFileExtension(file.originalname);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new ValidationError(`File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    throw new ValidationError(`MIME type not allowed: ${file.mimetype}`);
  }

  if (file.size > MAX_RAW_FILE_SIZE) {
    throw new ValidationError(`File too large. Maximum upload size is ${MAX_RAW_FILE_SIZE / (1024 * 1024)} MB.`);
  }

  const currentCount = await docRepo.countByWorkOrderAndType(workOrderId, documentType);
  if (currentCount >= MAX_DOCS_PER_TYPE) {
    throw new ValidationError(`Maximum of ${MAX_DOCS_PER_TYPE} documents per type reached.`);
  }

  let fileBuffer = file.buffer;

  if (isImageMime(file.mimetype)) {
    try {
      fileBuffer = await compressImage(file.buffer, file.mimetype);
      console.log(`Compressed image from ${file.size} to ${fileBuffer.length} bytes`);
    } catch (compErr) {
      console.error('Image compression failed, using original:', compErr);
    }
  }

  if (fileBuffer.length > TARGET_FILE_SIZE) {
    console.warn(`File still ${(fileBuffer.length / (1024 * 1024)).toFixed(1)} MB after compression`);
  }

  const docId = randomUUID();
  const safeFileName = sanitizeFileName(file.originalname);
  const storageFileName = `${docId}_${safeFileName}`;
  const relativePath = `${workOrderId}/${storageFileName}`;
  const storageBackend = useObjectStorage() ? 'object' : 'local';
  let fileKey: string;

  try {
    if (storageBackend === 'object') {
      fileKey = await saveToObjectStorage(fileBuffer, storageFileName, `wo-docs/${workOrderId}`);
    } else {
      fileKey = await saveToLocalFS(fileBuffer, relativePath);
    }
    console.log(`Uploaded WO document (${storageBackend}): ${fileKey}`);
  } catch (storageError) {
    console.error('Storage upload failed:', storageError);
    throw new Error('Failed to upload file to storage');
  }

  try {
    const doc = await docRepo.create({
      id: docId,
      workOrderId,
      vesselId,
      documentType,
      fileName: file.originalname,
      fileKey,
      fileType: file.mimetype,
      fileSize: fileBuffer.length,
      storageBackend,
      uploadedBy,
    });

    // Sync field logging — INSERT
    try { await logFieldChanges('work_order_documents', doc.id, vesselId, null, doc, uploadedBy || 'system'); } catch (e) { console.error('[FieldLogger] wo_documents create:', e); }

    // Queue file for sync (best-effort — never blocks upload)
    try {
      await FileSyncProcessor.queueFileForSync(
        'work_order_documents', doc.id, doc.fileKey,
        doc.fileName, doc.fileSize, doc.vesselId
      );
    } catch (syncErr) {
      console.error('[WODocService] File sync queue failed (non-fatal):', syncErr);
    }

    return doc;
  } catch (dbError) {
    console.error('DB insert failed, rolling back file upload:', dbError);
    try {
      if (storageBackend === 'object') {
        await deleteFromObjectStorage(fileKey);
      } else {
        await deleteFromLocalFS(fileKey);
      }
    } catch (deleteError) {
      console.error('Failed to cleanup uploaded file after DB error:', deleteError);
    }
    throw new Error('Failed to create document record');
  }
}

export async function downloadDocument(documentId: string): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
  const doc = await docRepo.findById(documentId);
  if (!doc) throw new NotFoundError('Document not found');

  try {
    let buffer: Buffer;
    if (doc.storageBackend === 'object') {
      buffer = await readFromObjectStorage(doc.fileKey);
    } else {
      buffer = await readFromLocalFS(doc.fileKey);
    }
    return {
      buffer,
      fileName: doc.fileName,
      contentType: doc.fileType || 'application/octet-stream',
    };
  } catch (err) {
    console.error('Failed to download document:', err);
    throw new NotFoundError('Document file not found in storage');
  }
}

export async function deleteDocument(documentId: string): Promise<void> {
  const doc = await docRepo.findById(documentId);
  if (!doc) throw new NotFoundError('Document not found');

  try {
    if (doc.storageBackend === 'object') {
      await deleteFromObjectStorage(doc.fileKey);
    } else {
      await deleteFromLocalFS(doc.fileKey);
    }
    console.log(`Deleted WO document from storage: ${doc.fileKey}`);
  } catch (err) {
    console.error('Failed to delete file from storage (continuing with DB cleanup):', err);
  }

  await docRepo.deleteById(documentId);
  // Sync field logging — hard DELETE (log as soft-delete equivalent for sync)
  try { await logFieldChanges('work_order_documents', doc.id, doc.vesselId || null, { is_deleted: false }, { is_deleted: true }, 'system'); } catch (e) { console.error('[FieldLogger] wo_documents delete:', e); }
}

export async function linkDocumentsToExecution(workOrderId: string, executionId: string): Promise<void> {
  // Fetch existing docs before update for field logging
  const existingDocs = await docRepo.findByWorkOrderId(workOrderId);
  await docRepo.linkExecutionId(workOrderId, executionId);
  // Sync field logging — UPDATE (log each affected document)
  for (const oldDoc of existingDocs) {
    try { await logFieldChanges('work_order_documents', oldDoc.id, oldDoc.vesselId || null, oldDoc, { ...oldDoc, executionId }, 'system'); } catch (e) { console.error('[FieldLogger] wo_documents link:', e); }
  }
  console.log(`Linked documents for WO ${workOrderId} to execution ${executionId}`);
}
