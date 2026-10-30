import { Worker } from "node:worker_threads";
import { SECTION_H_FILE_BYTES, SECTION_H_TYPES } from "@shared/sectionHAttachments";
import { ValidationError } from "../../shared/errors";

/** Inspect ZIP central directory BEFORE decompression: bound inflated bytes/entries, reject ZIP64/encryption. */
export function validateDocxDirectory(buffer: Buffer) {
  let end = -1;
  for (let p = buffer.length - 22; p >= Math.max(0, buffer.length - 65557); p--) {
    if (buffer.readUInt32LE(p) === 0x06054b50) { end = p; break; }
  }
  if (end < 0) throw new Error("Missing DOCX ZIP directory.");
  const count = buffer.readUInt16LE(end + 10);
  const length = buffer.readUInt32LE(end + 12), start = buffer.readUInt32LE(end + 16);
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) ||
      buffer.readUInt16LE(end + 8) !== count || !count || count > 2048 || start + length > end)
    throw new Error("Unsupported DOCX ZIP directory.");
  let pos = start, inflated = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > start + length || buffer.readUInt32LE(pos) !== 0x02014b50) throw new Error("Invalid DOCX directory entry.");
    const flags = buffer.readUInt16LE(pos + 8), method = buffer.readUInt16LE(pos + 10);
    const expanded = buffer.readUInt32LE(pos + 24), packed = buffer.readUInt32LE(pos + 20);
    const nameLength = buffer.readUInt16LE(pos + 28), extra = buffer.readUInt16LE(pos + 30), comment = buffer.readUInt16LE(pos + 32);
    const offset = buffer.readUInt32LE(pos + 42);
    const name = buffer.subarray(pos + 46, pos + 46 + nameLength).toString("utf8");
    inflated += expanded;
    if ((flags & 0x2041) || ![0, 8].includes(method) || expanded > 20 * 1024 * 1024 ||
        inflated > 50 * 1024 * 1024 || packed === 0xffffffff || offset === 0xffffffff ||
        offset + 30 > start || buffer.readUInt32LE(offset) !== 0x04034b50 ||
        /(^\/|\\|(^|\/)\.\.(\/|$))/.test(name) || names.has(name) ||
        pos + 46 + nameLength + extra + comment > start + length) throw new Error("Unsafe or oversized DOCX container.");
    // Local header must agree with the directory; bound actual compressed input as well.
    if (buffer.readUInt16LE(offset + 6) !== flags || buffer.readUInt16LE(offset + 8) !== method)
      throw new Error("Inconsistent DOCX headers.");
    const localNameLength = buffer.readUInt16LE(offset + 26), localExtra = buffer.readUInt16LE(offset + 28);
    if (buffer.subarray(offset + 30, offset + 30 + localNameLength).toString("utf8") !== name ||
        offset + 30 + localNameLength + localExtra + packed > start) throw new Error("Invalid DOCX data bounds.");
    names.add(name); pos += 46 + nameLength + extra + comment;
  }
  if (pos !== start + length || !["[Content_Types].xml", "_rels/.rels", "word/document.xml"].every(n => names.has(n)))
    throw new Error("This ZIP is not a Word DOCX package.");
}

/** Existing direct dependency XLSX exposes its CFB reader. Isolation bounds malformed DOC parsing. */
async function validateWord(buffer: Buffer, extension: string) {
  await new Promise<void>((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      try {
        const c = require('xlsx').CFB;
        const doc = c.read(Buffer.from(workerData.bytes), {type:'buffer'});
        if (workerData.extension === 'doc') {
          const stream = c.find(doc, 'WordDocument');
          if (!stream || !stream.content || stream.content.length < 32 ||
              Buffer.from(stream.content).readUInt16LE(0) !== 0xa5ec ||
              !(c.find(doc, '0Table') || c.find(doc, '1Table'))) throw Error('Not a Word DOC container');
        } else {
          const xml = n => {
            const f = c.find(doc, '/' + n);
            if (!f || !f.content) throw Error('Missing Word package part');
            return Buffer.from(f.content).toString('utf8');
          };
          const types = xml('[Content_Types].xml'), body = xml('word/document.xml'), rels = xml('_rels/.rels');
          if (!types.includes('wordprocessingml.document.main+xml') ||
              !/Relationship\\b/.test(rels) || !/<(?:[\\w.-]+:)?document[\\s>]/.test(body) ||
              [types,body,rels].some(s => /<!DOCTYPE|<!ENTITY/i.test(s))) throw Error('Invalid Word package structure');
        }
        parentPort.postMessage({ok:true});
      } catch { parentPort.postMessage({ok:false}); }
    `, { eval: true, workerData: { bytes: buffer, extension }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Document validation timed out.")); }, 4000);
    worker.once("message", result => { clearTimeout(timer); void worker.terminate(); result.ok ? resolve() : reject(new Error("Invalid Word document structure.")); });
    worker.once("error", error => { clearTimeout(timer); reject(error); });
    worker.once("exit", code => { clearTimeout(timer); if (code !== 0) reject(new Error("Document validation could not complete.")); });
  });
}
export async function validateSectionHUpload(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
  const name = file.originalname;
  const extension = name.split(".").pop()?.toLowerCase() || "";
  const contentType = SECTION_H_TYPES[extension];
  if (!name || name.length > 200 || /[\\/\u0000-\u001f\u007f]/.test(name) || name.startsWith(".") || !contentType)
    throw new ValidationError("Choose a PDF, DOC or DOCX with a safe filename.");
  if (!file.size || file.size !== file.buffer.length || file.size > SECTION_H_FILE_BYTES)
    throw new ValidationError("Each attachment must be non-empty and no larger than 10 MB.");
  if (file.mimetype !== contentType && !(extension === "pdf" && file.mimetype === "application/x-pdf"))
    throw new ValidationError("The file type does not match its filename.");
  try {
    if (extension === "pdf") {
      if (file.buffer.subarray(0, 5).toString() !== "%PDF-" || !file.buffer.subarray(-2048).includes(Buffer.from("%%EOF")))
        throw new Error("Invalid PDF signature.");
    } else {
      if (extension === "docx") validateDocxDirectory(file.buffer);
      else if (!file.buffer.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))) throw new Error("Invalid DOC signature.");
      await validateWord(file.buffer, extension);
    }
  } catch { throw new ValidationError("The file is malformed, unsupported or exceeds safe document-processing limits."); }
  return { name, contentType };
}
