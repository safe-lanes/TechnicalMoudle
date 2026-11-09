import { z } from "zod";
import jwt from "jsonwebtoken";
import { readVerifiedUser, type VerifiedUser } from "../../../middleware/tenantMiddleware";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { getRbacIdentity } from "../../../middleware/auth";
import { storage } from "../../../storage";
import { isShipInstance, getEffectiveInstanceId } from "../../sync/syncRole";
import { formMasterInput, formsMasterUuid, formsMasterListInput } from "@shared/pmsFormsMasterContracts";
import * as repo from "../repositories/formsMasterRepository";

function verifiedCatalogueUser(req: AuthenticatedRequest): VerifiedUser | undefined {
  let verified = (req as AuthenticatedRequest & { verifiedUser?: VerifiedUser }).verifiedUser;
  // Multi-tenant requests must use the identity already verified with the
  // correct tenant key. Never fall back to the single-tenant key in that case.
  if (!verified && !tenantConnectionManager.isMultiTenantEnabled) {
    const token = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (token && process.env.JWT_SECRET) {
      try {
        const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        if (typeof claims !== "string") verified = readVerifiedUser(claims);
      } catch { return undefined; }
    }
  }
  return verified;
}
export function requireCatalogueIdentity(req: AuthenticatedRequest): string {
  const identity = getRbacIdentity(req);
  const actor = req.user?.userUuid;
  const verified = verifiedCatalogueUser(req);
  // req.user is historically populated with a mock. It is NOT authentication.
  // Forwarded fields are used only after binding them to a verified session.
  // A syntactically valid UUID or a privileged role name is not authentication.
  if (!req.user || identity.source !== "forwarded" || !identity.userType ||
      !actor || !formsMasterUuid.safeParse(actor).success ||
      req.get("x-user-id") !== actor ||
      !verified || verified.userId !== actor || !verified.role ||
      verified.role !== identity.role || verified.userType !== identity.userType)
    repo.catalogueError("An identified user is required for Forms Master", 401);
  return actor;
}
export async function catalogueCapabilities(req: AuthenticatedRequest) {
  requireCatalogueIdentity(req);
  const identity = getRbacIdentity(req);
  const none = { create: false, edit: false, delete: false };
  const instance = (await getEffectiveInstanceId()).trim().toUpperCase();
  if (!instance || instance === "UNKNOWN" || instance === "SHIP-VESSELNAME") return none;
  if (await isShipInstance() || identity.userType !== "Office" || !identity.role) return none;
  const role = await storage.getRoleByName(identity.role);
  if (!role || !role.isActive || role.isDeleted) return none;
  const [menus, permissions] = await Promise.all([storage.getActiveMenuItems(), storage.getRoleMenuPermissions(role.ruid)]);
  const menu = menus.find(item => item.name === "admin-masters" && !item.isDeleted);
  const permission = menu ? permissions.find(item => item.menuMuid === menu.muid && !item.isDeleted) : undefined;
  return { create: permission?.canCreate === true, edit: permission?.canEdit === true, delete: permission?.canDelete === true };
}
export async function requireCatalogueWrite(req: AuthenticatedRequest, action: "create" | "edit" | "delete") {
  const actor = requireCatalogueIdentity(req);
  if (!(await catalogueCapabilities(req))[action])
    repo.catalogueError("Forms Master can only be edited from the office with explicit admin-masters permission.", 403);
  return actor;
}
function dbCode(error: unknown): { code?: string; constraint?: string; message?: string } {
  if (!error || typeof error !== "object") return {};
  const e = error as { code?: string; constraint?: string; message?: string; cause?: unknown };
  return e.code ? e : e.cause ? dbCode(e.cause) : e;
}
export async function catalogueWrite<T>(work: () => Promise<T>, allocate = false): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      const detail = dbCode(error);
      const allocation = detail.constraint && /group_code|allocated_no|form_id/.test(detail.constraint);
      if (detail.code === "23505" && allocate && allocation && attempt === 0) continue;
      if (detail.code === "23505") repo.catalogueError(`An active name or allocated identifier is already in use (${detail.constraint ?? "unique value"}).`);
      if (detail.code === "23503") repo.catalogueError("A selected reference is unavailable; refresh and select an active record.", 400);
      throw error;
    }
  }
}
export async function getOptions(req: AuthenticatedRequest) {
  const [groups, categories, roles, vessels, capabilities] = await Promise.all([
    repo.listGroups(true), repo.listCategories(undefined, true), repo.lookupApproverRoles(), repo.listVessels(), catalogueCapabilities(req),
  ]);
  return { groups, categories, roles, vessels, capabilities };
}
export function listForms(query: unknown) { return repo.listRecords(formsMasterListInput.parse(query)); }
export function formDetails(id: string) { return repo.getRecord(formsMasterUuid.parse(id)); }
export function saveRecord(body: unknown, actor: string, id?: string) {
  const input = formMasterInput.parse(body);
  return catalogueWrite(() => repo.saveForm(input, actor, id ? formsMasterUuid.parse(id) : undefined), !id);
}
export function deleteOrRestoreRecord(id: string, deleted: boolean, actor: string) {
  return catalogueWrite(() => repo.changeFormDeleted(formsMasterUuid.parse(id), deleted, actor));
}
const labelName = z.string().trim().min(1).max(200);
export function saveCatalogueLabel(kind: repo.LabelKind, body: unknown, actor: string, id?: string) {
  if (kind === "group") {
    const input = z.object({ groupName: labelName }).strict().parse(body);
    return catalogueWrite(() => repo.saveLabel(kind, input.groupName, actor, id ? formsMasterUuid.parse(id) : undefined), !id);
  }
  if (id) {
    const input = z.object({ categoryName: labelName }).strict().parse(body);
    return catalogueWrite(() => repo.saveLabel(kind, input.categoryName, actor, formsMasterUuid.parse(id)));
  }
  const input = z.object({ categoryName: labelName, groupUuid: formsMasterUuid }).strict().parse(body);
  return catalogueWrite(() => repo.saveLabel(kind, input.categoryName, actor, undefined, input.groupUuid), true);
}
export function deleteOrRestoreLabel(kind: repo.LabelKind, id: string, deleted: boolean, actor: string) {
  return catalogueWrite(() => repo.changeLabelDeleted(kind, formsMasterUuid.parse(id), deleted, actor));
}
export function reorderCatalogueLabels(kind: repo.LabelKind, body: unknown, actor: string) {
  const ids = z.array(formsMasterUuid).max(10000);
  if (kind === "group") {
    const input = z.object({ uuids: ids }).strict().parse(body);
    return catalogueWrite(() => repo.reorderLabels(kind, input.uuids, actor));
  }
  const input = z.object({ groupUuid: formsMasterUuid, uuids: ids }).strict().parse(body);
  return catalogueWrite(() => repo.reorderLabels(kind, input.uuids, actor, input.groupUuid));
}
