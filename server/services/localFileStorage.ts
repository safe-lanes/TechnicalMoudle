import * as fs from 'fs';
import * as path from 'path';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'component-documents');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`📁 Created local file storage directory: ${UPLOADS_DIR}`);
}

export class LocalFileStorage {
  /**
   * Write a file buffer to local disk storage
   * @param fileKey - The unique key for the file (e.g., componentCode/timestamp_filename)
   * @param buffer - The file buffer to write
   * @param contentType - The MIME type of the file
   * @returns The full path where the file was saved
   */
  static async write(fileKey: string, buffer: Buffer, contentType?: string): Promise<string> {
    // Ensure the directory structure exists
    const fullPath = path.join(UPLOADS_DIR, fileKey);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(fullPath, buffer);
    
    // Write metadata file for content type
    if (contentType) {
      const metaPath = `${fullPath}.meta.json`;
      fs.writeFileSync(metaPath, JSON.stringify({ contentType, createdAt: new Date().toISOString() }));
    }
    
    console.log(`📄 Saved file to local storage: ${fullPath}`);
    return fullPath;
  }
  
  /**
   * Read a file from local disk storage
   * @param fileKey - The unique key for the file
   * @returns The file buffer and content type
   */
  static async read(fileKey: string): Promise<{ buffer: Buffer; contentType: string }> {
    const fullPath = path.join(UPLOADS_DIR, fileKey);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fileKey}`);
    }
    
    const buffer = fs.readFileSync(fullPath);
    
    // Read metadata if available
    let contentType = 'application/octet-stream';
    const metaPath = `${fullPath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        contentType = meta.contentType || contentType;
      } catch (e) {
        // Ignore metadata read errors
      }
    }
    
    return { buffer, contentType };
  }
  
  /**
   * Delete a file from local disk storage
   * @param fileKey - The unique key for the file
   */
  static async delete(fileKey: string): Promise<void> {
    const fullPath = path.join(UPLOADS_DIR, fileKey);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`🗑️ Deleted file from local storage: ${fullPath}`);
    }
    
    // Also delete metadata if exists
    const metaPath = `${fullPath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
  }
  
  /**
   * Check if a file exists in local storage
   * @param fileKey - The unique key for the file
   */
  static exists(fileKey: string): boolean {
    const fullPath = path.join(UPLOADS_DIR, fileKey);
    return fs.existsSync(fullPath);
  }
  
  /**
   * Get the file content type from metadata
   * @param fileKey - The unique key for the file
   */
  static getContentType(fileKey: string): string {
    const fullPath = path.join(UPLOADS_DIR, fileKey);
    const metaPath = `${fullPath}.meta.json`;
    
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        return meta.contentType || 'application/octet-stream';
      } catch (e) {
        // Fallback
      }
    }
    
    // Infer from extension
    const ext = path.extname(fileKey).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
