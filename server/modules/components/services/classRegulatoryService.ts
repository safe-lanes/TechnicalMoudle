import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { auditLog, componentClassRegulatory as entries, components, masterLists, vessels, syncSettings } from "@shared/schema";
import { classRegulatoryInput, validateClassRegulatoryDates } from "@shared/classRegulatory";
import { getDb } from "../../../db";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { assertSectionHScope, DEVELOPMENT_READONLY_REASON, sectionHOfficeCanManage, type SectionHActor } from "./classRegulatoryAccess";

const active = or(isNull(entries.isDeleted), eq(entries.isDeleted, false));
export class ClassRegulatoryValidationError extends AppError {
  constructor(public fieldErrors: Record<string, string>) {
    super(400, "Please correct the highlighted Classification & Regulatory fields.");
  }
}
type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Connection = Db | Tx;

async function parent(db: Connection, componentId: string, actor: SectionHActor) {
  const [component] = await db.select().from(components)
    .where(eq(components.cuuid, componentId)).limit(1);
  if (!component || component.isDeleted) throw new NotFoundError("Component not found");
  await assertSectionHScope(actor, component.vesselId);
  if (actor.userType === "Ship" && component.isActive === false) throw new NotFoundError("Component not found");
  const [vessel] = await db.select().from(vessels).where(eq(vessels.vuuid, component.vesselId!)).limit(1);
  if (!vessel || vessel.isDeleted) throw new NotFoundError("Vessel not found");
  return { component, vessel };
}

export async function listClassEntries(componentId: string, actor: SectionHActor, includeDeleted = false) {
  const db = await getDb();
  await parent(db, componentId, actor);
  if (includeDeleted && !sectionHOfficeCanManage(actor)) throw new ForbiddenError("A verified Office session is required to view removed entries.");
  return db.select().from(entries).where(and(eq(entries.componentId, componentId), includeDeleted ? undefined : active))
    .orderBy(asc(entries.sortOrder), asc(entries.ccruuid), asc(entries.id));
}

/** Historical UUID migration must be explicitly reconciled, not guessed at first edit. */
async function assertReconciled(db: Connection) {
  const missing = await db.select({ id: entries.id }).from(entries).where(isNull(entries.ccruuid)).limit(1);
  if (missing.length) throw new ConflictError("Section H is read-only until historical shore/vessel identities have been reconciled.");
}

async function rolloutReady(db: Connection, vesselId: string): Promise<boolean> {
  const [setting] = await db.select({ value: syncSettings.settingValue }).from(syncSettings)
    .where(and(eq(syncSettings.settingKey, "section_h_ready_vessels"), eq(syncSettings.isDeleted, false))).limit(1);
  if (!setting?.value) return false;
  try {
    const ids: unknown = JSON.parse(setting.value);
    return Array.isArray(ids) && ids.every(id => typeof id === "string") && ids.includes(vesselId);
  } catch { return false; }
}

async function businessFields(db: Connection, raw: unknown, existing?: typeof entries.$inferSelect) {
  const result = classRegulatoryInput.safeParse(raw);
  if (!result.success) throw new ClassRegulatoryValidationError(Object.fromEntries(
    result.error.issues.map(issue => [issue.path[0] || "form", issue.code === "unrecognized_keys" ?
      "Only Classification & Regulatory business fields can be changed." : issue.message])));
  const input = result.data;
  const fields: Record<string, unknown> = { ...input };
  const errors: Record<string, string> = {};
  for (const [keyField, type, snapshot, label] of [
    ["classificationSocietyKey", "classificationSociety", "classificationSociety", "classification society"],
    ["surveyTypeKey", "surveyType", "surveyType", "survey type"],
  ] as const) {
    const key = input[keyField];
    // Preserve a legacy/retired snapshot on unrelated edits; selection changes must be valid.
    if (existing && (key === undefined || (key === existing[keyField] && key))) {
      delete fields[keyField];
      continue;
    }
    if (!key) { errors[keyField] = `Select a ${label}`; continue; }
    const [master] = await db.select().from(masterLists).where(and(eq(masterLists.listType, type),
      eq(masterLists.listKey, key), eq(masterLists.isActive, true),
      or(isNull(masterLists.isDeleted), eq(masterLists.isDeleted, false)))).limit(1);
    if (!master) { errors[keyField] = `Select an active ${label}`; continue; }
    fields[snapshot] = master.listValue;
    fields[keyField] = master.listKey;
    if (type === "classificationSociety") fields.classCode = master.listKey;
  }
  const merged = { ...existing, ...input };
  Object.assign(errors, validateClassRegulatoryDates(merged, existing));
  if (Object.keys(errors).length) throw new ClassRegulatoryValidationError(errors);
  return fields;
}

function assertWrite(actor: SectionHActor) {
  if (!sectionHOfficeCanManage(actor)) throw new ForbiddenError("A verified Office session is required to manage Classification & Regulatory Data.");
}
async function audit(tx: Tx, actor: SectionHActor, action: string,
  saved: typeof entries.$inferSelect, before?: typeof entries.$inferSelect) {
  await tx.insert(auditLog).values({
    userId: actor.userId, entityType: "component_class_regulatory", entityId: saved.ccruuid!,
    actionType: action, vesselCode: saved.vesselCode, componentCode: saved.componentCode,
    oldValue: before ? JSON.stringify(before) : null, newValue: JSON.stringify(saved),
    source: "web_ui", createdByUuid: actor.userId, updatedByUuid: actor.userId,
    payload: { componentUuid: saved.componentId, entryUuid: saved.ccruuid },
  });
}

export async function createClassEntry(componentId: string, raw: unknown, actor: SectionHActor) {
  assertWrite(actor);
  const db = await getDb();
  return db.transaction(async tx => {
    // Serializes same-component changes with reconciliation and scope checks.
    await tx.execute(sql`SELECT cuuid FROM components WHERE cuuid = ${componentId} FOR UPDATE`);
    const { component, vessel } = await parent(tx, componentId, actor);
    await assertReconciled(tx);
    if (!await rolloutReady(tx, vessel.vuuid)) throw new ConflictError("Section H writes are pending the verified shore/vessel rollout for this vessel.");
    const values = await businessFields(tx, raw);
    const [saved] = await tx.insert(entries).values({
      ...values, ccruuid: randomUUID(), componentId: component.cuuid,
      componentCode: component.componentCode || component.id, vesselCode: vessel.code,
      classificationSociety: values.classificationSociety as string, surveyType: values.surveyType as string,
      createdBy: actor.userId, updatedBy: actor.userId, createdByUuid: actor.userId,
      updatedByUuid: actor.userId, updatedAt: new Date(), isDeleted: false,
    }).returning();
    await audit(tx, actor, "create", saved);
    return saved;
  });
}

export async function mutateClassEntry(id: number, raw: unknown, action: "update" | "delete" | "restore", actor: SectionHActor) {
  assertWrite(actor);
  const db = await getDb();
  return db.transaction(async tx => {
    const [existing] = await tx.select().from(entries).where(eq(entries.id, id)).for("update");
    if (!existing) throw new NotFoundError("Classification & Regulatory entry not found");
    const { vessel } = await parent(tx, existing.componentId, actor);
    await assertReconciled(tx);
    if (!await rolloutReady(tx, vessel.vuuid)) throw new ConflictError("Section H writes are pending the verified shore/vessel rollout for this vessel.");
    if (action === "update" && existing.isDeleted) throw new ConflictError("Restore this entry before editing it.");
    if ((action === "delete" && existing.isDeleted) || (action === "restore" && !existing.isDeleted)) return existing;
    const now = new Date();
    const changes = action === "update" ? await businessFields(tx, raw, existing) :
      { isDeleted: action === "delete", deletedByUuid: action === "delete" ? actor.userId : null,
        deletedAt: action === "delete" ? now : null };
    const [saved] = await tx.update(entries).set({
      ...changes, updatedBy: actor.userId, updatedByUuid: actor.userId, updatedAt: now, isSync: false,
    }).where(eq(entries.id, id)).returning();
    // Required audit and business mutation commit/rollback together.
    await audit(tx, actor, action, saved, existing);
    return saved;
  });
}

export async function componentClassAccess(componentId: string, actor: SectionHActor) {
  const db = await getDb();
  const { vessel } = await parent(db, componentId, actor);
  const canViewRemoved = sectionHOfficeCanManage(actor);
  const viewOnly = (reasonCode: string, reason: string) => ({
    canView: true, canEdit: false, canViewRemoved, identityMode: actor.identityMode || "verified", reasonCode, reason,
  });
  if (actor.identityMode === "development-readonly") return viewOnly("DEVELOPMENT_READONLY", DEVELOPMENT_READONLY_REASON);
  if (actor.userType === "Ship") return viewOnly("VESSEL_READONLY", "Vessel users can view classification records but cannot change them.");
  if (!sectionHOfficeCanManage(actor)) return viewOnly("SESSION_UNVERIFIED", "A verified Office session is required to manage entries.");
  const missing = await db.select({ id: entries.id }).from(entries).where(isNull(entries.ccruuid)).limit(1);
  const ready = await rolloutReady(db, vessel.vuuid);
  if (missing.length) return viewOnly("RECONCILIATION_PENDING", "Historical shore/vessel identities must be reconciled before editing.");
  if (!ready) return viewOnly("ROLLOUT_PENDING", "Section H writes are pending the verified shore/vessel rollout for this vessel.");
  return { canView: true, canEdit: true, canViewRemoved, identityMode: actor.identityMode || "verified", reasonCode: "EDIT_ALLOWED" };
}
