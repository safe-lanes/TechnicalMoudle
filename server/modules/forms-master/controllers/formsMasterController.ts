import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { z, ZodError } from "zod";
import { formsMasterUuid } from "@shared/pmsFormsMasterContracts";
import * as service from "../services/formsMasterService";
import * as repo from "../repositories/formsMasterRepository";

export function formsMasterEndpoint(
  handler: (req: AuthenticatedRequest, actor: string) => Promise<unknown>,
  action?: "create" | "edit" | "delete",
): RequestHandler {
  return async (request, res) => {
    const req = request as AuthenticatedRequest;
    try {
      const actor = action ? await service.requireCatalogueWrite(req, action) : await service.requireCatalogueIdentity(req);
      const result = await handler(req, actor);
      res.status(req.method === "POST" && action === "create" ? 201 : 200).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Invalid Forms Master input", issues: error.flatten() }); return;
      }
      const e = error as { statusCode?: number; message?: string };
      const status = e.statusCode ?? 500;
      if (status === 500) console.error("[FormsMaster] Request failed:", error);
      res.status(status).json({ error: status === 500 ? "Forms Master operation failed; no change was saved." : e.message });
    }
  };
}
const groupQuery = z.object({ showDeleted: z.enum(["true", "false"]).optional() }).strict();
const categoryQuery = groupQuery.extend({ groupUuid: formsMasterUuid }).strict();
export const listGroups = formsMasterEndpoint(async req => repo.listGroups(groupQuery.parse(req.query).showDeleted === "true"));
export const listCategories = formsMasterEndpoint(async req => {
  const query = categoryQuery.parse(req.query);
  return repo.listCategories(query.groupUuid, query.showDeleted === "true");
});
export const roles = formsMasterEndpoint(async () => repo.lookupApproverRoles());
export const options = formsMasterEndpoint(async req => service.getOptions(req));
export const records = formsMasterEndpoint(async req => service.listForms(req.query));
export const details = formsMasterEndpoint(async req => service.formDetails(req.params.formUuid));
export const createRecord = formsMasterEndpoint(async (req, actor) => service.saveRecord(req.body, actor), "create");
export const updateRecord = formsMasterEndpoint(async (req, actor) => service.saveRecord(req.body, actor, req.params.formUuid), "edit");
export const deleteRecord = formsMasterEndpoint(async (req, actor) => service.deleteOrRestoreRecord(req.params.formUuid, true, actor), "delete");
export const restoreRecord = formsMasterEndpoint(async (req, actor) => service.deleteOrRestoreRecord(req.params.formUuid, false, actor), "edit");
export function labelControllers(kind: repo.LabelKind) {
  return {
    create: formsMasterEndpoint(async (req, actor) => service.saveCatalogueLabel(kind, req.body, actor), "create"),
    update: formsMasterEndpoint(async (req, actor) => service.saveCatalogueLabel(kind, req.body, actor, req.params.labelUuid), "edit"),
    delete: formsMasterEndpoint(async (req, actor) => service.deleteOrRestoreLabel(kind, req.params.labelUuid, true, actor), "delete"),
    restore: formsMasterEndpoint(async (req, actor) => service.deleteOrRestoreLabel(kind, req.params.labelUuid, false, actor), "edit"),
    order: formsMasterEndpoint(async (req, actor) => service.reorderCatalogueLabels(kind, req.body, actor), "edit"),
  };
}
