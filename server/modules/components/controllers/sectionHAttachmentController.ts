import multer from "multer";
import type { RequestHandler } from "express";
import { SECTION_H_FILE_BYTES } from "@shared/sectionHAttachments";
import { classRegulatoryHandler as handler } from "./classRegulatoryController";
import * as service from "../services/sectionHAttachmentService";
const multipart = multer({
  storage: multer.memoryStorage(),
  // Busboy emits limits at equality: allow one sentinel byte/part, then enforce
  // the exact business boundary below. files/fields still limit to one each.
  limits: { fileSize: SECTION_H_FILE_BYTES + 1, files: 1, fields: 1, fieldSize: 100, parts: 3 },
}).single("file");
export const uploadBody: RequestHandler = (req, res, next) => multipart(req, res, error => {
  if (error || (req.file && req.file.size > SECTION_H_FILE_BYTES))
    return res.status(400).json({ error: "Choose one file no larger than 10 MB and a valid upload identity." });
  next();
});
export const list = handler(async (req, res) => {
  res.json(await service.list(req.params.entryUuid, req.sectionHActor!, req.query.includeDeleted === "true"));
});
export const upload = handler(async (req, res) => {
  res.status(201).json(await service.upload(req.params.entryUuid, req.body?.attachmentUuid || "", req.file!, req.sectionHActor!));
});
export const remove = handler(async (req, res) => {
  res.json(await service.mutate(req.params.entryUuid, req.params.attachmentUuid, false, req.sectionHActor!));
});
export const restore = handler(async (req, res) => {
  res.json(await service.mutate(req.params.entryUuid, req.params.attachmentUuid, true, req.sectionHActor!));
});
export const download = handler(async (req, res) => {
  const file = await service.download(req.params.entryUuid, req.params.attachmentUuid, req.sectionHActor!);
  res.setHeader("Content-Type", file.type);
  res.setHeader("Content-Disposition", `${file.type === "application/pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(file.bytes);
});
