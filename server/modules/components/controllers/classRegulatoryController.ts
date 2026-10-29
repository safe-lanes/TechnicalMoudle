import type { Response, NextFunction } from "express";
import type { SectionHRequest } from "../services/classRegulatoryAccess";
import { sectionHCanEdit } from "../services/classRegulatoryAccess";
import * as service from "../services/classRegulatoryService";
import { AppError } from "../../shared/errors";

/** Resource-local error contract: never leak SQL, raw Zod issues or stacks. */
export const classRegulatoryHandler = (
  fn: (req: SectionHRequest, res: Response) => Promise<unknown>,
) => async (req: SectionHRequest, res: Response, _next: NextFunction) => {
  try {
    req.sectionHActor!.canEdit = await sectionHCanEdit(req.sectionHActor!);
    await fn(req, res);
  } catch (error) {
    if (error instanceof service.ClassRegulatoryValidationError) {
      return res.status(400).json({ error: error.message, fieldErrors: error.fieldErrors });
    }
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    console.error("[Section H] request failed", error);
    return res.status(503).json({ error: "Classification & Regulatory Data is temporarily unavailable. Please try again." });
  }
};

function entryId(req: SectionHRequest): number {
  if (!/^[1-9]\d*$/.test(req.params.id)) throw new AppError(400, "Invalid regulatory entry.");
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) throw new AppError(400, "Invalid regulatory entry.");
  return id;
}
export const list = classRegulatoryHandler(async (req, res) => {
  res.json(await service.listClassEntries(req.params.componentId, req.sectionHActor!, req.query.includeDeleted === "true"));
});
export const access = classRegulatoryHandler(async (req, res) => {
  res.json(await service.componentClassAccess(req.params.componentId, req.sectionHActor!));
});
export const create = classRegulatoryHandler(async (req, res) => {
  const { componentId, ...data } = req.body || {};
  if (typeof componentId !== "string" || !componentId) throw new AppError(400, "Save and select a component first.");
  res.status(201).json(await service.createClassEntry(componentId, data, req.sectionHActor!));
});
export const update = classRegulatoryHandler(async (req, res) => {
  res.json(await service.mutateClassEntry(entryId(req), req.body, "update", req.sectionHActor!));
});
export const remove = classRegulatoryHandler(async (req, res) => {
  res.json(await service.mutateClassEntry(entryId(req), {}, "delete", req.sectionHActor!));
});
export const restore = classRegulatoryHandler(async (req, res) => {
  res.json(await service.mutateClassEntry(entryId(req), {}, "restore", req.sectionHActor!));
});
