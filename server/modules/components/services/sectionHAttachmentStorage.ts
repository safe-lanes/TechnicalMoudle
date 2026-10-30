import fs from "node:fs/promises";
import path from "node:path";
import { objectStorageClient } from "../../../objectStorage";
import { sectionHFileKey } from "@shared/sectionHAttachments";

export const SECTION_H_DIR = "component-class-regulatory";
export function sectionHLocalPath(key: string) {
  const parts = key.split("/");
  if (parts.length !== 3 || !parts[2].includes("_")) throw new Error("Invalid Section H storage key.");
  const [attachment, ...filename] = parts[2].split("_");
  if (sectionHFileKey(parts[0], parts[1], attachment, filename.join("_")) !== key) throw new Error("Unsafe Section H storage key.");
  return path.resolve(process.cwd(), ".private", SECTION_H_DIR, key);
}
function objectFile(key: string) {
  sectionHLocalPath(key);
  const root = process.env.PRIVATE_OBJECT_DIR;
  if (root) {
    const [bucket, ...prefix] = root.replace(/^\/+/, "").split("/");
    return objectStorageClient.bucket(bucket).file([...prefix, SECTION_H_DIR, key].filter(Boolean).join("/"));
  }
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) throw new Error("Private attachment object storage is not configured.");
  return objectStorageClient.bucket(bucket).file(`.private/${SECTION_H_DIR}/${key}`);
}
export function sectionHStorageBackend(): "local" | "object" {
  return process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || process.env.PRIVATE_OBJECT_DIR ? "object" : "local";
}
export async function writeSectionHFile(key: string, bytes: Buffer, backend: string, contentType: string) {
  if (backend === "object") {
    await objectFile(key).save(bytes, { resumable: false, metadata: { contentType } });
  } else {
    const target = sectionHLocalPath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const staging = `${target}.staging`;
    try { await fs.writeFile(staging, bytes, { flag: "wx" }); await fs.rename(staging, target); }
    finally { await fs.unlink(staging).catch(() => {}); }
  }
}
/** Installation-local bytes take priority on a receiving vessel; never trust sender absolute roots. */
export async function readSectionHFile(key: string, backend: string): Promise<Buffer> {
  const target = sectionHLocalPath(key);
  try { return await fs.readFile(target); }
  catch (error: any) { if (error.code !== "ENOENT") throw error; }
  if (backend !== "object" || sectionHStorageBackend() !== "object") throw new Error("Attachment bytes are pending delivery.");
  const [bytes] = await objectFile(key).download();
  return bytes;
}
export async function sectionHFileAvailable(key: string, backend: string): Promise<boolean> {
  try {
    await fs.access(sectionHLocalPath(key)); return true;
  } catch { /* object fallback */ }
  if (backend === "object" && sectionHStorageBackend() === "object") {
    const [exists] = await objectFile(key).exists(); return exists;
  }
  return false;
}
export async function discardSectionHFile(key: string, backend: string) {
  if (backend === "object") await objectFile(key).delete({ ignoreNotFound: true });
  else await fs.unlink(sectionHLocalPath(key)).catch(error => { if (error.code !== "ENOENT") throw error; });
}
