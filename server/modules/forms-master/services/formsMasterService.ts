import { z } from "zod";
import jwt from "jsonwebtoken";
import { readVerifiedUser, type VerifiedUser } from "../../../middleware/tenantMiddleware";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { getRbacIdentity } from "../../../middleware/auth";
import { storage } from "../../../storage";
import { isShipInstance, getEffectiveInstanceId } from "../../sync/syncRole";
import { formMasterInput, formsMasterUuid, formsMasterListInput } from "@shared/pmsFormsMasterContracts";
import { createDefaultDevelopmentUser } from "@shared/developmentUser";
import { findMasterUserById } from "../../assistant-api/masterUserRepository";
import * as repo from "../repositories/formsMasterRepository";

type CatalogueRequest = AuthenticatedRequest & {
  verifiedUser?: VerifiedUser;
  formsMasterActor?: { userId: string; role: string; userType: "Office" | "Ship" };
};

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

/** Server-owned gate for the Forms Master default-user path; never sourced from request claims. */
export function formsMasterReplitDefaultEnabled(): boolean {
  return process.env.NODE_ENV === "development" &&
    process.env.VITE_APP_ENV === "replit" &&
    !tenantConnectionManager.isMultiTenantEnabled;
}

function forwardedHeader(req: AuthenticatedRequest, name: string): string | null {
  const value = req.get(name);
  if (!value?.trim()) return null;
  try { return decodeURIComponent(value).trim(); } catch { return value.trim(); }
}

function formsMasterDefaultRequested(req: AuthenticatedRequest): boolean {
  return req.get("x-forms-master-development") === "default-user";
}

async function resolveReplitDefaultActor(req: CatalogueRequest): Promise<string> {
  if (!formsMasterReplitDefaultEnabled() || !formsMasterDefaultRequested(req) ||
      req.get("authorization") || req.verifiedUser) {
    repo.catalogueError("A verified signed-in user is required for Forms Master.", 401);
  }

  const user = createDefaultDevelopmentUser();
  if (!req.user || !user.isActive || user.isDeleted || !user.userUuid ||
      (user.userType !== "Office" && user.userType !== "Ship")) {
    repo.catalogueError("The Replit default Forms Master user is not available.", 403);
  }

  const userId = forwardedHeader(req, "x-user-id");
  const role = forwardedHeader(req, "x-user-role");
  const userType = forwardedHeader(req, "x-user-type");
  if (userId !== user.userUuid || role !== user.role || userType !== user.userType ||
      req.user.userUuid !== user.userUuid || req.user.userType !== user.userType) {
    repo.catalogueError("The Replit Forms Master identity does not match the AuthContext default user. Refresh the preview and retry.", 403);
  }

  const upstream = getRbacIdentity(req);
  if (upstream.source === "forwarded" &&
      ((upstream.role && upstream.role !== user.role) ||
       (upstream.userType && upstream.userType !== user.userType))) {
    repo.catalogueError("The forwarded Replit Forms Master identity does not match the configured default user.", 403);
  }

  // The fixed development identity must correspond to this installation's
  // canonical user record. Its stored role is authoritative for RBAC; do not
  // grant the role label embedded in the public AuthContext development profile.
  const mapped = await findMasterUserById(user.userUuid);
  if (!mapped || !mapped.role || mapped.userType !== user.userType) {
    repo.catalogueError(
      "The Replit default user is not registered as an active user with a valid Office/Ship type in this installation's user directory.",
      403,
    );
  }

  // Route-local RBAC is now derived from the fixed server-owned identity and
  // canonical role mapping, not from mockAuthMiddleware or caller-controlled values.
  req.rbac = { source: "forwarded", role: mapped.role, userType: mapped.userType };
  req.formsMasterActor = { userId: user.userUuid, role: mapped.role, userType: mapped.userType };
  return user.userUuid;
}

export async function requireCatalogueIdentity(request: AuthenticatedRequest): Promise<string> {
  const req = request as CatalogueRequest;
  if (req.formsMasterActor) return req.formsMasterActor.userId;

  if (!req.user) repo.catalogueError("Please sign in to access Forms Master.", 401);
  if (formsMasterDefaultRequested(req) && formsMasterReplitDefaultEnabled() &&
      !req.verifiedUser && !req.get("authorization")) {
    return resolveReplitDefaultActor(req);
  }

  const verified = verifiedCatalogueUser(req);
  if (!verified?.userId || !formsMasterUuid.safeParse(verified.userId).success) {
    repo.catalogueError("Please sign in through the integrated application to access Forms Master.", 401);
  }

  // Some integrated tokens omit role/type; resolve only from the canonical
  // server-side directory, never from browser headers.
  let role = verified.role;
  let userType = verified.userType;
  if (!role || !userType) {
    const mapped = await findMasterUserById(verified.userId);
    role ||= mapped?.role ?? null;
    userType ||= mapped?.userType ?? null;
  }
  const actor = verified.userId;
  const forwardedId = forwardedHeader(req, "x-user-id");
  const forwardedRole = forwardedHeader(req, "x-user-role");
  const forwardedType = forwardedHeader(req, "x-user-type");
  if (!req.user || !role || !userType || req.user.userUuid !== actor ||
      forwardedId !== actor || forwardedRole !== role || forwardedType !== userType) {
    repo.catalogueError("The signed-in identity could not be matched to the Forms Master request. Please sign in again.", 401);
  }

  const upstream = getRbacIdentity(req);
  if (upstream.source === "forwarded" &&
      ((upstream.role && upstream.role !== role) ||
       (upstream.userType && upstream.userType !== userType))) {
    repo.catalogueError("The forwarded identity does not match the verified Forms Master session. Please sign in again.", 401);
  }

  // Use the verified claims (or server-side canonical role/type resolution) for
  // Forms Master RBAC, including when unrelated mock-RBAC mode is enabled.
  req.rbac = { source: "forwarded", role, userType };
  req.formsMasterActor = { userId: actor, role, userType };
  return actor;
}
export async function catalogueCapabilities(req: AuthenticatedRequest) {
  await requireCatalogueIdentity(req);
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
  const actor = await requireCatalogueIdentity(req);
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
