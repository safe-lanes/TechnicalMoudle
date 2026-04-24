/**
 * File Sync Processor — Handles binary file transfer between ship and shore
 *
 * Architecture:
 * 1. When a file is uploaded to a BOTH_EDITABLE table (WO doc, component doc),
 *    it gets queued in sync_file_queue with status='pending'
 * 2. After field data sync completes (Phase 4), the file processor runs
 * 3. Files are chunked into 256KB pieces and transferred one chunk at a time
 * 4. If transfer is interrupted, it resumes from the last successful chunk
 * 5. After all chunks are received, the file is reassembled and verified via SHA-256 hash
 *
 * Storage backends:
 * - 'local' — filesystem under .private/wo-docs/ or .private/component-docs/
 * - 'object' — Replit Object Storage (GCS via signed URLs) — only on Replit
 *
 * Tables with real binary files:
 * - work_order_documents  — fileKey + storageBackend ('local' | 'object')
 * - component_documents   — fileKey + storageBackend ('local' | 'object')
 *
 * Tables with URL references only (no binary sync needed):
 * - defect_attachments    — url column (synced via field logging)
 * - change_request_attachment — url column (synced via field logging)
 *
 * Priority: Small files (<100KB) first, then by creation date
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as syncRepo from './repository';

const CHUNK_SIZE_BYTES = 256 * 1024; // 256KB per chunk
const MAX_FILE_RETRIES = 3;
const TEMP_DIR = path.resolve(process.cwd(), '.private', 'sync-temp');

// Storage base directories (match the app's conventions)
const WO_DOCS_DIR = path.resolve(process.cwd(), '.private', 'wo-docs');
const COMPONENT_DOCS_DIR = path.resolve(process.cwd(), '.private', 'component-docs');

export interface FileChunk {
  queueUuid: string;
  chunkIndex: number;
  totalChunks: number;
  data: string; // base64 encoded chunk
  fileHash: string; // SHA-256 of complete file (for final verification)
}

export class FileSyncProcessor {
  private instanceId: string;

  constructor() {
    this.instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  }

  /**
   * Process all pending file transfers for a vessel.
   * Called AFTER field data sync is complete.
   */
  async processQueue(
    vesselId: string,
    _syncBatchId: string
  ): Promise<{
    filesProcessed: number;
    filesFailed: number;
    bytesTransferred: number;
  }> {
    let filesProcessed = 0;
    let filesFailed = 0;
    let bytesTransferred = 0;

    // Determine direction based on instance identity
    const direction = this.instanceId.toUpperCase().startsWith('SHIP')
      ? 'ship_to_shore'
      : 'shore_to_ship';
    const pendingFiles = await syncRepo.getPendingFiles(vesselId, direction, 50);

    console.log(
      `[FileSyncProcessor] ${pendingFiles.length} pending files for vessel ${vesselId} (${direction})`
    );

    for (const fileEntry of pendingFiles) {
      try {
        await syncRepo.updateFileStatus(fileEntry.queueUuid, 'in_progress');

        // Read the file from local storage
        const fileBuffer = await this.readLocalFile(
          fileEntry.fileKey,
          fileEntry.tableName
        );
        if (!fileBuffer) {
          throw new Error(`File not found: ${fileEntry.fileKey}`);
        }

        // Calculate hash for verification
        const hash = crypto
          .createHash('sha256')
          .update(fileBuffer)
          .digest('hex');

        // Split into chunks
        const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE_BYTES);
        const startChunk = fileEntry.chunkOffset || 0; // Resume from last successful chunk

        for (let i = startChunk; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE_BYTES;
          const end = Math.min(start + CHUNK_SIZE_BYTES, fileBuffer.length);
          const chunkData = fileBuffer.subarray(start, end).toString('base64');

          const chunk: FileChunk = {
            queueUuid: fileEntry.queueUuid,
            chunkIndex: i,
            totalChunks,
            data: chunkData,
            fileHash: hash,
          };

          // Send chunk (via sync API or local mode)
          await this.sendChunk(chunk);

          // Update progress
          await syncRepo.updateFileStatus(
            fileEntry.queueUuid,
            'in_progress',
            i + 1 // chunk_offset = next chunk to send
          );

          bytesTransferred += end - start;
        }

        // Mark completed
        await syncRepo.markFileCompleted(fileEntry.queueUuid);
        filesProcessed++;
        console.log(
          `[FileSyncProcessor] Completed: ${fileEntry.fileName || fileEntry.fileKey} (${totalChunks} chunks, ${fileBuffer.length} bytes)`
        );
      } catch (error: any) {
        filesFailed++;
        const retryCount = (fileEntry.retryCount || 0) + 1;
        const status = retryCount >= MAX_FILE_RETRIES ? 'failed' : 'pending';

        await syncRepo.updateFileStatus(
          fileEntry.queueUuid,
          status,
          fileEntry.chunkOffset || 0, // Keep current offset for resume
          error.message
        );

        // Increment retry count in DB
        try {
          await syncRepo.incrementRetryCount(fileEntry.queueUuid);
        } catch (_e) {
          // best-effort
        }

        console.error(
          `[FileSyncProcessor] Failed: ${fileEntry.fileName || fileEntry.fileKey} — ${error.message} (retry ${retryCount}/${MAX_FILE_RETRIES})`
        );
      }
    }

    return { filesProcessed, filesFailed, bytesTransferred };
  }

  /**
   * Receive a file chunk from the other side.
   * Called by the sync API when a chunk arrives.
   */
  async receiveChunk(
    chunk: FileChunk
  ): Promise<{ received: boolean; complete: boolean }> {
    const tempPath = path.join(TEMP_DIR, chunk.queueUuid);

    // Create temp directory for this file's chunks
    if (!fs.existsSync(tempPath)) {
      fs.mkdirSync(tempPath, { recursive: true });
    }

    // Save chunk to temp storage
    const chunkFile = path.join(
      tempPath,
      `chunk_${String(chunk.chunkIndex).padStart(5, '0')}`
    );
    const chunkBuffer = Buffer.from(chunk.data, 'base64');
    fs.writeFileSync(chunkFile, chunkBuffer);

    console.log(
      `[FileSyncProcessor] Received chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} for ${chunk.queueUuid}`
    );

    // Check if all chunks received
    if (chunk.chunkIndex === chunk.totalChunks - 1) {
      // Reassemble the file
      const assembled = this.assembleChunks(tempPath, chunk.totalChunks);

      // Verify hash
      const hash = crypto
        .createHash('sha256')
        .update(assembled)
        .digest('hex');
      if (hash !== chunk.fileHash) {
        console.error(
          `[FileSyncProcessor] Hash mismatch for ${chunk.queueUuid}: expected ${chunk.fileHash}, got ${hash}`
        );
        // Clean up temp chunks
        fs.rmSync(tempPath, { recursive: true, force: true });
        return { received: true, complete: false };
      }

      // Save to final location
      const fileEntry = await syncRepo.getFileQueueEntry(chunk.queueUuid);
      if (fileEntry) {
        await this.saveLocalFile(
          fileEntry.fileKey,
          fileEntry.tableName,
          assembled
        );
        await syncRepo.markFileCompleted(chunk.queueUuid);
        console.log(
          `[FileSyncProcessor] File assembled and saved: ${fileEntry.fileKey} (${assembled.length} bytes, hash verified)`
        );
      }

      // Clean up temp chunks
      fs.rmSync(tempPath, { recursive: true, force: true });
      return { received: true, complete: true };
    }

    return { received: true, complete: false };
  }

  /**
   * Reassemble chunks into a single buffer.
   */
  private assembleChunks(tempPath: string, totalChunks: number): Buffer {
    const buffers: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkFile = path.join(
        tempPath,
        `chunk_${String(i).padStart(5, '0')}`
      );
      buffers.push(fs.readFileSync(chunkFile));
    }
    return Buffer.concat(buffers);
  }

  /**
   * Read a file from local storage.
   * Adapts based on tableName and the app's dual-backend storage.
   */
  private async readLocalFile(
    fileKey: string,
    tableName: string
  ): Promise<Buffer | null> {
    // WO docs use local:// prefix for local storage
    if (fileKey.startsWith('local://')) {
      const relativePath = fileKey.replace('local://', '');
      const baseDir =
        tableName === 'component_documents' ? COMPONENT_DOCS_DIR : WO_DOCS_DIR;
      const fullPath = path.join(baseDir, relativePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
    }

    // Try as a plain relative key under the appropriate directory
    const dirs = [WO_DOCS_DIR, COMPONENT_DOCS_DIR];
    if (tableName === 'component_documents') {
      dirs.reverse(); // Check component dir first
    }

    for (const dir of dirs) {
      const fullPath = path.join(dir, fileKey);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
    }

    // Try absolute path
    if (fs.existsSync(fileKey)) {
      return fs.readFileSync(fileKey);
    }

    // Object Storage files cannot be read locally without the GCS client.
    // In production, the file would need to be downloaded from Object Storage first.
    // For now, skip cloud-stored files and log a warning.
    console.warn(
      `[FileSyncProcessor] File not found locally: ${fileKey} (table: ${tableName}). ` +
        `If stored in Object Storage, cloud-to-cloud transfer is not yet implemented.`
    );
    return null;
  }

  /**
   * Save a file to local storage.
   */
  private async saveLocalFile(
    fileKey: string,
    tableName: string,
    buffer: Buffer
  ): Promise<void> {
    let targetPath: string;

    if (fileKey.startsWith('local://')) {
      const relativePath = fileKey.replace('local://', '');
      const baseDir =
        tableName === 'component_documents' ? COMPONENT_DOCS_DIR : WO_DOCS_DIR;
      targetPath = path.join(baseDir, relativePath);
    } else {
      // Default to WO docs dir unless it's a component doc
      const baseDir =
        tableName === 'component_documents' ? COMPONENT_DOCS_DIR : WO_DOCS_DIR;
      targetPath = path.join(baseDir, fileKey);
    }

    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, buffer);
    console.log(
      `[FileSyncProcessor] Saved file to local storage: ${targetPath}`
    );
  }

  /**
   * Send a chunk to the other side via sync API.
   */
  private async sendChunk(chunk: FileChunk): Promise<void> {
    const shoreUrl = process.env.SYNC_SHORE_URL || '';
    const localMode = process.env.SYNC_LOCAL_MODE === 'true';

    if (localMode || !shoreUrl) {
      // Local mode — save chunk directly (simulates receive on "other side")
      await this.receiveChunk(chunk);
      return;
    }

    // Remote mode — HTTP call
    const response = await fetch(`${shoreUrl}/sync/file/upload-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Api-Key': process.env.SYNC_API_KEY || '',
        'X-Sync-Instance-Id': this.instanceId,
      },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.status}`);
    }
  }

  /**
   * Queue a file for sync when it's uploaded to a BOTH_EDITABLE table.
   * Called by upload handlers in WO docs, component docs, etc.
   *
   * Best-effort: failures do NOT block the upload.
   */
  static async queueFileForSync(
    tableName: string,
    rowUuid: string,
    fileKey: string,
    fileName: string | null,
    fileSizeBytes: number | null,
    vesselId: string | null
  ): Promise<void> {
    try {
      const instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
      const direction = instanceId.toUpperCase().startsWith('SHIP')
        ? 'ship_to_shore'
        : 'shore_to_ship';

      // Priority: small files first
      let priority = 0;
      if (fileSizeBytes) {
        if (fileSizeBytes < 100 * 1024) priority = 10; // <100KB — high priority
        else if (fileSizeBytes < 1024 * 1024) priority = 5; // <1MB — medium
        else priority = 1; // >1MB — low
      }

      // Calculate file hash if file exists locally
      let fileHash: string | null = null;
      try {
        const resolvedPath = fileKey.startsWith('local://')
          ? path.join(
              tableName === 'component_documents'
                ? COMPONENT_DOCS_DIR
                : WO_DOCS_DIR,
              fileKey.replace('local://', '')
            )
          : fileKey;
        if (fs.existsSync(resolvedPath)) {
          const buffer = fs.readFileSync(resolvedPath);
          fileHash = crypto
            .createHash('sha256')
            .update(buffer)
            .digest('hex');
        }
      } catch {
        // Hash calculation is best-effort
      }

      // Calculate total chunks
      const totalChunks = fileSizeBytes
        ? Math.ceil(fileSizeBytes / CHUNK_SIZE_BYTES)
        : null;

      await syncRepo.queueFile({
        tableName,
        rowUuid,
        fileKey,
        fileName,
        fileSizeBytes,
        fileHash,
        direction,
        vesselId,
        instanceId,
        totalChunks,
        priority,
      });

      console.log(
        `[FileSyncProcessor] Queued for sync: ${fileName || fileKey} (${direction}, priority ${priority})`
      );
    } catch (error: any) {
      // Best-effort — file queuing failure must NEVER block the upload
      console.error(
        `[FileSyncProcessor] Failed to queue file for sync: ${error.message}`
      );
    }
  }
}
