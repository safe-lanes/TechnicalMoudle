import { Router, type Request, type Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { importHistory, bulkImportHistory, bulkImportErrors } from "@shared/schema";
import { getDb } from "../../db";
import { captureTenantFromReq } from "../../utils/tenantConnectionManager";
import { asyncHandler } from "../shared/middleware";
import { NotFoundError, ValidationError } from "../shared/errors";
import { requireSectionHIdentity, requireSectionHOffice, type SectionHRequest } from "../components/services/classRegulatoryAccess";
import { commitSectionHImport, importMode, importVessel, previewErrorRows, previewSectionHImport,
  sectionHPreview, selectedSectionHRows } from "./services/classRegulatoryImport";
import { classRegulatoryErrorWorkbook, classRegulatoryTemplate } from "./services/classRegulatoryTemplate";
import { SECTION_H_IMPORT_TYPE } from "./services/classRegulatoryWorkbook";
import { storeUploadedFile } from "./controllers/bulkController";

const router = Router();
const prefix = "/bulk/class-regulatory";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
router.use(prefix, requireSectionHIdentity, requireSectionHOffice);
const run = (handler: (req: SectionHRequest, res: Response) => Promise<unknown>) =>
  asyncHandler((req: Request, res: Response) => captureTenantFromReq(req)(() => handler(req as SectionHRequest, res)));
const actor = (req: SectionHRequest) => req.sectionHActor!;
const xlsx = (res: Response, buffer: Buffer, name: string) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  return res.send(buffer);
};

router.get(`${prefix}/template`, run(async (req, res) =>
  xlsx(res, await classRegulatoryTemplate(String(req.query.vesselId || "")), "class_regulatory_template.xlsx")));
router.post(`${prefix}/sheets`, upload.single("file"), run(async (req, res) => {
  await importVessel(await getDb(), req.body.vesselId);
  if (!req.file || !/\.(xlsx|xls)$/i.test(req.file.originalname)) throw new ValidationError("Upload an Excel workbook.");
  const workbook = XLSX.read(req.file.buffer, { type: "buffer", bookSheets: true });
  return res.json({ sheets: workbook.SheetNames });
}));
router.post(`${prefix}/dry-run`, upload.single("file"), run(async (req, res) => {
  if (!req.file) throw new ValidationError("Select an Excel workbook.");
  if (req.body.type !== SECTION_H_IMPORT_TYPE) throw new ValidationError("Invalid import type.");
  return res.json(await previewSectionHImport(actor(req), req.body.vesselId, importMode(req.body.mode),
    req.file.buffer, req.file.originalname, req.body.sheetName));
}));
router.get(`${prefix}/preview/:token/errors`, run(async (req, res) =>
  xlsx(res, await classRegulatoryErrorWorkbook(previewErrorRows(actor(req), req.params.token,
    String(req.query.vesselId || ""))), "class_regulatory_validation_errors.xlsx")));
router.post(`${prefix}/import-stream`, run(async (req, res) => {
  selectedSectionHRows(sectionHPreview(actor(req), req.body), req.body.rowIndices);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const send = (event: string, data: unknown) => {
    if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(": heartbeat\n\n"); }, 15_000);
  try {
    const result = await commitSectionHImport(actor(req), req.body,
      (file, name, type) => storeUploadedFile(file, `${randomUUID()}_${name}`, type),
      data => send("progress", data));
    send("complete", result);
  } catch (error: any) {
    send("error", { message: error.statusCode ? error.message : "Import interrupted. Check history before retrying.", error: error.message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}));

// Every lookup is tenant-local and checked against an existing vessel. Office scope is all vessels.
async function historyEntry(req: SectionHRequest) {
  const db = await getDb();
  const [entry] = await db.select().from(importHistory).where(and(eq(importHistory.id, req.params.id),
    eq(importHistory.type, SECTION_H_IMPORT_TYPE)));
  if (!entry || !entry.vesselId) throw new NotFoundError("Import history not found.");
  await importVessel(db, entry.vesselId);
  if (req.query.vesselId && req.query.vesselId !== entry.vesselId) throw new NotFoundError("Import not found for this vessel.");
  return entry;
}
router.get(`${prefix}/history`, run(async (req, res) => {
  const db = await getDb();
  const global = req.query.moduleType === SECTION_H_IMPORT_TYPE || req.query.moduleType === "all";
  const vesselId = String((global ? req.query.vesselCode : req.query.vesselId) || "");
  if (vesselId || !global) await importVessel(db, vesselId);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  if (global) {
    const rows = await db.select().from(bulkImportHistory).where(and(
      req.query.moduleType === SECTION_H_IMPORT_TYPE ? eq(bulkImportHistory.moduleType, SECTION_H_IMPORT_TYPE) : undefined,
      vesselId ? eq(bulkImportHistory.vesselCode, vesselId) : undefined)).orderBy(desc(bulkImportHistory.uploadedAt));
    const filtered = req.query.status && req.query.status !== "all" ? rows.filter(r => r.status === req.query.status) : rows;
    return res.json({ items: filtered.slice(offset, offset + limit), total: filtered.length });
  }
  const rows = await db.select().from(importHistory).where(and(eq(importHistory.type, SECTION_H_IMPORT_TYPE),
    eq(importHistory.vesselId, vesselId))).orderBy(desc(importHistory.startedAt));
  return res.json({ items: rows.slice(offset, offset + limit).map(row => ({
    ...row, date: row.startedAt, user: row.userId,
    failed: row.errorMessage?.startsWith("[") ? JSON.parse(row.errorMessage).length : 0,
  })), total: rows.length });
}));
router.get(`${prefix}/import-status/:id`, run(async (req, res) => {
  const entry = await historyEntry(req);
  const errors = entry.errorMessage?.startsWith("[") ? JSON.parse(entry.errorMessage) : [];
  return res.json({ ...entry, status: entry.status === "partial" ? "complete" : entry.status,
    historyId: entry.id, completedAt: entry.finishedAt, completed: entry.status !== "in_progress",
    failed: errors.length, errors });
}));
router.get(`${prefix}/history/:id/download-original`, run(async (req, res) => {
  const entry = await historyEntry(req);
  if (!entry.storedFilePath) throw new NotFoundError("The original workbook is unavailable.");
  let data: Buffer;
  if (entry.storedFilePath.startsWith("replit:")) {
    const { Client } = await import("@replit/object-storage");
    const result = await new Client().downloadAsBytes(entry.storedFilePath.slice(7));
    if (!result.ok) throw new NotFoundError("Original workbook is unavailable in storage.");
    data = Buffer.from(result.value as unknown as ArrayBuffer);
  } else if (entry.storedFilePath.startsWith("local:")) {
    const local = path.resolve(entry.storedFilePath.slice(6));
    const root = path.resolve("uploads", "bulk-imports", SECTION_H_IMPORT_TYPE) + path.sep;
    if (!local.startsWith(root)) throw new NotFoundError("Original workbook storage path is invalid.");
    data = await fs.readFile(local);
  } else throw new NotFoundError("Original workbook storage backend is unavailable.");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(entry.originalName || "import.xlsx")}`);
  res.setHeader("Content-Type", entry.originalName?.toLowerCase().endsWith(".xls") ?
    "application/vnd.ms-excel" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return res.send(data);
}));
router.get(`${prefix}/history/:id/errors`, run(async (req, res) => {
  const db = await getDb();
  if (/^[0-9a-f-]{36}$/i.test(req.params.id)) {
    const entry = await historyEntry(req);
    const errors = await db.select().from(bulkImportErrors).where(eq(bulkImportErrors.importUuid, entry.id));
    return xlsx(res, await classRegulatoryErrorWorkbook(errors.map(e => ({ row: e.rowNumber, errors: [e.errorDescription] }))),
      "class_regulatory_errors.xlsx");
  }
  if (!/^\d+$/.test(req.params.id)) throw new NotFoundError("Import history not found.");
  // Global history uses its numeric legacy ID; ownership comes from the canonical history row.
  const [bulk] = await db.select().from(bulkImportHistory).where(and(eq(bulkImportHistory.id, Number(req.params.id)),
    eq(bulkImportHistory.moduleType, SECTION_H_IMPORT_TYPE)));
  if (!bulk?.vesselCode) throw new NotFoundError("Import history not found.");
  await importVessel(db, bulk.vesselCode);
  return res.json(await db.select().from(bulkImportErrors).where(eq(bulkImportErrors.importUuid, bulk.biuuid)));
}));
router.get(`${prefix}/history/:id/:fileType`, run(async (req, res) => {
  const entry = await historyEntry(req);
  if (!["errors", "error-report", "error"].includes(req.params.fileType)) throw new NotFoundError("Unknown report.");
  const errors = await (await getDb()).select().from(bulkImportErrors).where(eq(bulkImportErrors.importUuid, entry.id));
  return xlsx(res, await classRegulatoryErrorWorkbook(errors.map(e => ({ row: e.rowNumber, errors: [e.errorDescription] }))),
    "class_regulatory_errors.xlsx");
}));
router.post(`${prefix}/undo/:historyId`, run(async (_req, res) =>
  res.status(400).json({ error: "Undo is not available for this import type." })));

export default router;
