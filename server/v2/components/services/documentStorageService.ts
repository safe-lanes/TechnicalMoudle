import { objectStorageClient, ObjectNotFoundError } from "../../../objectStorage";

export class DocumentStorageService {
  async uploadFile(fileBuffer: Buffer, mimetype: string, fileKey: string): Promise<void> {
    const bucketId = this.getBucketId();

    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(`.private/documents/${fileKey}`);
    await file.save(fileBuffer, {
      metadata: { contentType: mimetype }
    });
    console.log(`V2 Uploaded file to object storage: ${fileKey}`);
  }

  async downloadFile(fileKey: string): Promise<Buffer> {
    const bucketId = this.getBucketId();

    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(`.private/documents/${fileKey}`);
    const [fileBuffer] = await file.download();
    console.log(`V2 Serving file from object storage: ${fileKey}`);
    return fileBuffer;
  }

  async deleteFile(fileKey: string): Promise<void> {
    const bucketId = this.getBucketId();

    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(`.private/documents/${fileKey}`);
    await file.delete();
  }

  private getBucketId(): string {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      throw new Error("Object storage not configured. Please set up object storage in the Replit Object Storage panel.");
    }
    return bucketId;
  }
}
