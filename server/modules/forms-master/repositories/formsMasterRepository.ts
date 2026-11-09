import { and, asc, desc, eq, ilike, or, sql, count } from "drizzle-orm";
import { v4 as uuid, v5 } from "uuid";
import { pmsFormGroups as g, pmsFormCategories as c, pmsFormsMaster as f, vessels, admnRoleMaster } from "@shared/schema";
import { storage, type FormsMasterTransaction, type FormsMasterDatabase } from "../../../storage";
import { incrementAlphabeticKey } from "@shared/certificates/companyGroupLabels";
import type { FormMasterInput, FormsMasterListInput } from "@shared/pmsFormsMasterContracts";
import { logFieldChanges } from "../../sync/fieldLogger";
import { isShipInstance } from "../../sync/syncRole";
import { PMS_FORM_DEFAULTS, PMS_FORMS_NAMESPACE } from "../defaults/pmsFormsMasterSeedData";

export function catalogueError(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}
export const FORMS_MASTER_LOCK = 764192;
type Conn = FormsMasterTransaction | FormsMasterDatabase;
type GroupRow = typeof g.$inferSelect;
type CategoryRow = typeof c.$inferSelect;
type FormRow = typeof f.$inferSelect;
type CatalogueRow = GroupRow | CategoryRow | FormRow;
export type LabelKind = "group" | "category";

export function nextGroupCode(codes: string[]): string {
  const sorted = codes.filter(code => /^[A-Z]+$/.test(code)).sort((a, b) => a.length - b.length || a.localeCompare(b));
  return sorted.length ? incrementAlphabeticKey(sorted[sorted.length - 1]) : "A";
}
export function nextFormId(groupCode: string, categoryNo: number, allocated: string[], vessel: boolean): string {
  const prefix = `${groupCode}${String(categoryNo).padStart(2, "0")}`;
  const pattern = new RegExp(`^(?:VES-)?${prefix}-(\\d+)$`);
  const max = allocated.reduce((n, id) => { const match = pattern.exec(id); return match ? Math.max(n, Number(match[1])) : n; }, 0);
  if (!Number.isSafeInteger(max + 1)) catalogueError("Form number series exhausted");
  return `${vessel ? "VES-" : ""}${prefix}-${String(max + 1).padStart(3, "0")}`;
}
async function lock(tx: FormsMasterTransaction, key: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`forms-master:${key}`}, 0))`);
}
export async function catalogueTransaction<T>(work: (tx: FormsMasterTransaction) => Promise<T>): Promise<T> {
  return storage.withFormsMasterTransaction(async tx => {
    // A single catalogue integrity lock also serializes hierarchy checks with
    // seed/create/delete/restore/reorder, preventing active children of retired parents.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${FORMS_MASTER_LOCK})`);
    return work(tx);
  });
}
async function record(tx: FormsMasterTransaction, table: "pms_form_groups" | "pms_form_categories" | "pms_forms_master",
  identity: string, before: CatalogueRow | null, after: CatalogueRow, actor: string, action: string, outbound = true) {
  await storage.createAuditLog({
    userId: actor, entityType: table === "pms_forms_master" ? "form_master" : table === "pms_form_groups" ? "form_group" : "form_category",
    entityId: identity, actionType: action, source: "forms-master",
    oldValue: before ? JSON.stringify(before) : null, newValue: JSON.stringify(after), payload: { before, after },
  }, tx);
  if (outbound) {
    const logged = await logFieldChanges(table, identity, null, before, after, actor, tx);
    // Legacy logger catches individual insert errors. PostgreSQL then marks the
    // transaction aborted; force a statement so COMMIT cannot silently ROLLBACK.
    await tx.execute(sql`SELECT 1`);
    if (logged < 1) throw new Error("Forms Master outbound changes were not logged; write rolled back");
  }
}
async function activeGroup(tx: Conn, id: string) {
  const [row] = await tx.select().from(g).where(eq(g.fguuid, id));
  if (!row || row.isDeleted) catalogueError("Select an active Group", 400);
  return row;
}
async function activeParents(tx: Conn, groupUuid: string, categoryUuid: string) {
  const group = await activeGroup(tx, groupUuid);
  const [category] = await tx.select().from(c).where(eq(c.fcuuid, categoryUuid));
  if (!category || category.isDeleted || category.groupUuid !== groupUuid)
    catalogueError("Select an active Category belonging to the selected Group", 400);
  return { group, category };
}
/** Isolated source: domain decision says Approver means roles, never ranks. */
export async function lookupApproverRoles(conn?: Conn) {
  const db = conn ?? await storage.getFormsMasterDatabase();
  const query = db.select({ ruid: admnRoleMaster.ruid, assignedRole: admnRoleMaster.assignedRole }).from(admnRoleMaster)
    .where(and(eq(admnRoleMaster.isActive, true), sql`coalesce(${admnRoleMaster.isDeleted}, false) = false`)).orderBy(asc(admnRoleMaster.assignedRole));
  return conn ? query.for("share") : query;
}
export async function listGroups(showDeleted = false) {
  return (await storage.getFormsMasterDatabase()).select().from(g).where(showDeleted ? undefined : eq(g.isDeleted, false)).orderBy(asc(g.displayOrder), asc(g.groupCode));
}
export async function listCategories(groupUuid?: string, showDeleted = false) {
  return (await storage.getFormsMasterDatabase()).select().from(c).where(and(groupUuid ? eq(c.groupUuid, groupUuid) : undefined, showDeleted ? undefined : eq(c.isDeleted, false)))
    .orderBy(asc(c.displayOrder), asc(c.categoryNo));
}
export async function listVessels() {
  return (await storage.getFormsMasterDatabase()).select({ vuuid: vessels.vuuid, name: vessels.name }).from(vessels)
    .where(and(eq(vessels.isActive, true), sql`coalesce(${vessels.isDeleted}, false) = false`)).orderBy(asc(vessels.name));
}
const selection = {
  fmuuid: f.fmuuid, formId: f.formId, scope: f.scope, vesselId: f.vesselId, groupUuid: f.groupUuid, categoryUuid: f.categoryUuid,
  formName: f.formName, companyFormName: f.companyFormName, woPreApproval: f.woPreApproval, woPostApproval: f.woPostApproval,
  approverRoleRuid: f.approverRoleRuid, approverRoleLabel: f.approverRoleLabel, whenToUse: f.whenToUse, responsible: f.responsible,
  typicalJobs: f.typicalJobs, suggestedApprover: f.suggestedApprover, isDeleted: f.isDeleted, isDefault: f.isDefault,
  groupCode: g.groupCode, groupName: g.groupName, categoryNo: c.categoryNo, categoryName: c.categoryName, vesselName: vessels.name,
};
export async function listRecords(input: FormsMasterListInput) {
  const db = await storage.getFormsMasterDatabase();
  const search = `%${input.search.replace(/[\\%_]/g, "\\$&")}%`;
  const condition = and(
    input.showDeleted === "true" ? undefined : eq(f.isDeleted, false),
    input.search ? or(ilike(f.formId, search), ilike(f.formName, search), ilike(f.companyFormName, search), ilike(g.groupName, search), ilike(g.groupCode, search), ilike(c.categoryName, search)) : undefined,
    input.groupUuid ? eq(f.groupUuid, input.groupUuid) : undefined, input.categoryUuid ? eq(f.categoryUuid, input.categoryUuid) : undefined,
    input.scope ? eq(f.scope, input.scope) : undefined, input.vesselId ? eq(f.vesselId, input.vesselId) : undefined,
    input.pre ? eq(f.woPreApproval, input.pre === "true") : undefined, input.post ? eq(f.woPostApproval, input.post === "true") : undefined);
  const sorts = { formId: f.formId, scope: sql`case when ${f.scope} = 'fleet' then 'Fleet' else coalesce(${vessels.name}, '') end`,
    group: sql`${g.groupCode} || '. ' || ${g.groupName}`, category: c.categoryName, formName: f.formName, companyFormName: f.companyFormName,
    woPreApproval: f.woPreApproval, woPostApproval: f.woPostApproval, approver: f.approverRoleLabel, actions: f.isDeleted };
  // Repeatable read gives a truthful count + page from the same snapshot.
  return db.transaction(async tx => {
    const [{ total }] = await tx.select({ total: count() }).from(f).innerJoin(g, eq(g.fguuid, f.groupUuid)).innerJoin(c, eq(c.fcuuid, f.categoryUuid))
      .leftJoin(vessels, eq(vessels.vuuid, f.vesselId)).where(condition);
    const records = await tx.select(selection).from(f).innerJoin(g, eq(g.fguuid, f.groupUuid)).innerJoin(c, eq(c.fcuuid, f.categoryUuid))
      .leftJoin(vessels, eq(vessels.vuuid, f.vesselId)).where(condition)
      .orderBy((input.direction === "desc" ? desc : asc)(sorts[input.sort]), asc(f.fmuuid)).limit(input.pageSize).offset((input.page - 1) * input.pageSize);
    return { records, total, page: input.page, pageSize: input.pageSize };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getRecord(id: string) {
  const db = await storage.getFormsMasterDatabase();
  const [row] = await db.select(selection).from(f).innerJoin(g, eq(g.fguuid, f.groupUuid)).innerJoin(c, eq(c.fcuuid, f.categoryUuid))
    .leftJoin(vessels, eq(vessels.vuuid, f.vesselId)).where(eq(f.fmuuid, id));
  if (!row) catalogueError("Form not found", 404);
  return row;
}
export async function saveForm(input: FormMasterInput, actor: string, id?: string) {
  return catalogueTransaction(async tx => {
    const before = id ? (await tx.select().from(f).where(eq(f.fmuuid, id)))[0] : null;
    if (id && !before) catalogueError("Form not found", 404);
    if (before?.isDeleted) catalogueError("Restore the form before editing");
    if (before && before.scope !== input.scope) catalogueError("Scope cannot change after creation", 400);
    const { group, category } = await activeParents(tx, input.groupUuid, input.categoryUuid);
    if (input.vesselId) {
      const [vessel] = await tx.select().from(vessels).where(and(eq(vessels.vuuid, input.vesselId), eq(vessels.isActive, true), sql`coalesce(${vessels.isDeleted}, false) = false`)).for("share");
      if (!vessel) catalogueError("Select an active vessel", 400);
    }
    const role = input.approverRoleRuid ? (await lookupApproverRoles(tx)).find(r => r.ruid === input.approverRoleRuid) : null;
    if (input.approverRoleRuid && !role) catalogueError("Select an active Approver role", 400);
    const data = { ...input, approverRoleLabel: role?.assignedRole ?? null, updatedByUuid: actor, updatedAt: new Date() };
    let after: FormRow;
    if (before) {
      [after] = await tx.update(f).set(data).where(eq(f.fmuuid, before.fmuuid)).returning();
    } else {
      await lock(tx, `form:${group.groupCode}:${category.categoryNo}`);
      // Immutable allocated prefix, NOT current parent membership (moved rows reserve IDs).
      const historical = await tx.select({ formId: f.formId }).from(f)
        .where(sql`${f.formId} ~ ${`^(VES-)?${group.groupCode}${String(category.categoryNo).padStart(2, "0")}-[0-9]+$`}`);
      const formId = nextFormId(group.groupCode, category.categoryNo, historical.map(row => row.formId), input.scope === "vessel");
      [after] = await tx.insert(f).values({ ...data, fmuuid: uuid(), formId, createdByUuid: actor }).returning();
    }
    await record(tx, "pms_forms_master", after.fmuuid, before, after, actor, before ? "update" : "create");
    return after;
  });
}
export async function changeFormDeleted(id: string, deleted: boolean, actor: string) {
  return catalogueTransaction(async tx => {
    const [before] = await tx.select().from(f).where(eq(f.fmuuid, id));
    if (!before) catalogueError("Form not found", 404);
    if (before.isDeleted === deleted) return before;
    if (!deleted) await activeParents(tx, before.groupUuid, before.categoryUuid);
    const [after] = await tx.update(f).set({ isDeleted: deleted, updatedAt: new Date(), updatedByUuid: actor }).where(eq(f.fmuuid, id)).returning();
    await record(tx, "pms_forms_master", id, before, after, actor, deleted ? "delete" : "restore");
    return after;
  });
}
export async function saveLabel(kind: LabelKind, label: string, actor: string, id?: string, groupUuid?: string) {
  return catalogueTransaction(async tx => {
    if (kind === "group") {
      const before = id ? (await tx.select().from(g).where(eq(g.fguuid, id)))[0] : null;
      if (id && !before) catalogueError("Group not found", 404);
      if (before?.isDeleted) catalogueError("Restore the Group before editing");
      await lock(tx, "group");
      const all = await tx.select().from(g);
      const data = { groupName: label, updatedAt: new Date(), updatedByUuid: actor };
      const [after] = before ? await tx.update(g).set(data).where(eq(g.fguuid, id!)).returning()
        : await tx.insert(g).values({ ...data, fguuid: uuid(), groupCode: nextGroupCode(all.map(row => row.groupCode)), displayOrder: Math.max(0, ...all.map(row => row.displayOrder)) + 1, createdByUuid: actor }).returning();
      await record(tx, "pms_form_groups", after.fguuid, before, after, actor, before ? "update" : "create");
      return after;
    }
    const before = id ? (await tx.select().from(c).where(eq(c.fcuuid, id)))[0] : null;
    if (id && !before) catalogueError("Category not found", 404);
    if (before?.isDeleted) catalogueError("Restore the Category before editing");
    const parentId = before?.groupUuid ?? groupUuid!;
    await activeGroup(tx, parentId);
    await lock(tx, `category:${parentId}`);
    const all = await tx.select().from(c).where(eq(c.groupUuid, parentId));
    const data = { categoryName: label, updatedAt: new Date(), updatedByUuid: actor };
    const [after] = before ? await tx.update(c).set(data).where(eq(c.fcuuid, id!)).returning()
      : await tx.insert(c).values({ ...data, fcuuid: uuid(), groupUuid: parentId, categoryNo: Math.max(0, ...all.map(row => row.categoryNo)) + 1,
        displayOrder: Math.max(0, ...all.map(row => row.displayOrder)) + 1, createdByUuid: actor }).returning();
    await record(tx, "pms_form_categories", after.fcuuid, before, after, actor, before ? "update" : "create");
    return after;
  });
}
/** One usage function for Stage 2 to extend without changing deletion callers. */
export async function labelUsage(tx: Conn, kind: LabelKind, id: string) {
  const [{ forms }] = await tx.select({ forms: count() }).from(f).where(and(eq(kind === "group" ? f.groupUuid : f.categoryUuid, id), eq(f.isDeleted, false)));
  const [{ categories }] = kind === "group" ? await tx.select({ categories: count() }).from(c).where(and(eq(c.groupUuid, id), eq(c.isDeleted, false))) : [{ categories: 0 }];
  return { forms, categories };
}
export async function changeLabelDeleted(kind: LabelKind, id: string, deleted: boolean, actor: string) {
  return catalogueTransaction(async tx => {
    const table = kind === "group" ? g : c;
    const identity = kind === "group" ? g.fguuid : c.fcuuid;
    const [before] = await tx.select().from(table).where(eq(identity, id));
    if (!before) catalogueError("Label not found", 404);
    if (before.isDeleted === deleted) return before;
    if (deleted) {
      const usage = await labelUsage(tx, kind, id);
      if (usage.forms || usage.categories) catalogueError(`Cannot delete: ${usage.categories} active Categories and ${usage.forms} active Forms use this label.`);
    } else if ("groupUuid" in before) await activeGroup(tx, before.groupUuid);
    const [after] = await tx.update(table).set({ isDeleted: deleted, updatedAt: new Date(), updatedByUuid: actor }).where(eq(identity, id)).returning();
    await record(tx, kind === "group" ? "pms_form_groups" : "pms_form_categories", id, before, after, actor, deleted ? "delete" : "restore");
    return after;
  });
}
export async function reorderLabels(kind: LabelKind, uuids: string[], actor: string, groupUuid?: string) {
  return catalogueTransaction(async tx => {
    if (kind === "category") await activeGroup(tx, groupUuid!);
    const table = kind === "group" ? g : c;
    const identity = kind === "group" ? g.fguuid : c.fcuuid;
    const rows = kind === "group" ? await tx.select().from(g).where(eq(g.isDeleted, false))
      : await tx.select().from(c).where(and(eq(c.groupUuid, groupUuid!), eq(c.isDeleted, false)));
    const rowId = (r: GroupRow | CategoryRow) => "fguuid" in r ? r.fguuid : r.fcuuid;
    if (new Set(uuids).size !== uuids.length || rows.length !== uuids.length || rows.some(r => !uuids.includes(rowId(r))))
      catalogueError("Order must contain every active label exactly once in the selected Group", 400);
    for (const before of rows) {
      const id = rowId(before), order = uuids.indexOf(id) + 1;
      if (before.displayOrder === order) continue;
      const [after] = await tx.update(table).set({ displayOrder: order, updatedAt: new Date(), updatedByUuid: actor }).where(eq(identity, id)).returning();
      await record(tx, kind === "group" ? "pms_form_groups" : "pms_form_categories", id, before, after, actor, "reorder");
    }
    return { success: true };
  });
}
export async function seedDefaults() {
  const outbound = !(await isShipInstance());
  return catalogueTransaction(async tx => {
    const stats = { groups: { inserted: 0, skipped: 0 }, categories: { inserted: 0, skipped: 0 }, forms: { inserted: 0, skipped: 0 }, conflicting: 0 };
    const groups: (typeof g.$inferInsert)[] = [], categories: (typeof c.$inferInsert)[] = [], forms: (typeof f.$inferInsert)[] = [];
    const seenGroups = new Set<string>(), seenCategories = new Set<string>(), series = new Map<string, number>();
    for (const row of PMS_FORM_DEFAULTS) {
      const groupKey = `FG-DEF-${row.groupCode}`, categoryKey = `FC-DEF-${row.groupCode}-${String(row.categoryNo).padStart(2, "0")}`;
      const groupUuid = v5(groupKey, PMS_FORMS_NAMESPACE), categoryUuid = v5(categoryKey, PMS_FORMS_NAMESPACE), formUuid = v5(row.seedKey, PMS_FORMS_NAMESPACE);
      if (!seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        groups.push({ fguuid: groupUuid, seedKey: groupKey, groupCode: row.groupCode, groupName: row.groupName, displayOrder: seenGroups.size, isDefault: true });
      }
      if (!seenCategories.has(categoryKey)) {
        seenCategories.add(categoryKey);
        categories.push({ fcuuid: categoryUuid, seedKey: categoryKey, groupUuid, categoryNo: row.categoryNo, categoryName: row.categoryName, displayOrder: row.categoryNo, isDefault: true });
      }
      const suffix = (series.get(categoryKey) ?? 0) + 1; series.set(categoryKey, suffix);
      forms.push({ fmuuid: formUuid, seedKey: row.seedKey, formId: `${row.groupCode}${String(row.categoryNo).padStart(2, "0")}-${String(suffix).padStart(3, "0")}`,
        scope: "fleet", vesselId: null, groupUuid, categoryUuid, formName: row.formName, companyFormName: row.formName, whenToUse: row.whenToUse,
        responsible: row.responsible, typicalJobs: row.typicalJobs, suggestedApprover: row.suggestedApprover, isDefault: true,
      });
    }
    // Preflight every missing identity BEFORE inserting anything. Never adopt a
    // customer's unrelated row just because its name/code happens to match.
    const conflicts: { table: string; seedKey: string | null | undefined; owners: unknown[] }[] = [];
    for (const row of groups) {
      if ((await tx.select().from(g).where(eq(g.fguuid, row.fguuid))).length) continue;
      const owners = await tx.select({ uuid: g.fguuid, code: g.groupCode, name: g.groupName }).from(g).where(or(
        eq(g.groupCode, row.groupCode), eq(g.seedKey, row.seedKey!),
        and(eq(g.isDeleted, false), sql`lower(trim(${g.groupName})) = lower(trim(${row.groupName}))`)));
      if (owners.length) conflicts.push({ table: "pms_form_groups", seedKey: row.seedKey, owners });
    }
    for (const row of categories) {
      if ((await tx.select().from(c).where(eq(c.fcuuid, row.fcuuid))).length) continue;
      const owners = await tx.select({ uuid: c.fcuuid, name: c.categoryName, number: c.categoryNo }).from(c).where(or(
        eq(c.seedKey, row.seedKey!), and(eq(c.groupUuid, row.groupUuid), or(eq(c.categoryNo, row.categoryNo),
          and(eq(c.isDeleted, false), sql`lower(trim(${c.categoryName})) = lower(trim(${row.categoryName}))`)))));
      if (owners.length) conflicts.push({ table: "pms_form_categories", seedKey: row.seedKey, owners });
    }
    for (const row of forms) {
      if ((await tx.select().from(f).where(eq(f.fmuuid, row.fmuuid))).length) continue;
      const owners = await tx.select({ uuid: f.fmuuid, formId: f.formId, name: f.formName }).from(f).where(or(
        eq(f.formId, row.formId), eq(f.seedKey, row.seedKey!), and(eq(f.isDeleted, false),
          sql`lower(trim(regexp_replace(${f.formName}, '[ ' || chr(9) || chr(10) || chr(13) || chr(12) || chr(11) || ']+', ' ', 'g'))) = lower(trim(regexp_replace(${row.formName}, '[ ' || chr(9) || chr(10) || chr(13) || chr(12) || chr(11) || ']+', ' ', 'g')))`)));
      if (owners.length) conflicts.push({ table: "pms_forms_master", seedKey: row.seedKey, owners });
    }
    if (conflicts.length) {
      stats.conflicting = conflicts.length;
      console.error("[FormsMaster] Seed conflicts (zero inserts committed):", JSON.stringify({ ...stats, conflicts }));
      catalogueError(`Forms Master seed conflicts: ${JSON.stringify(conflicts)}`);
    }
    for (const row of groups) {
      const [saved] = await tx.insert(g).values(row).onConflictDoNothing({ target: g.fguuid }).returning();
      if (saved) { stats.groups.inserted++; await record(tx, "pms_form_groups", saved.fguuid, null, saved, "system", "create", outbound); } else stats.groups.skipped++;
    }
    for (const row of categories) {
      const [saved] = await tx.insert(c).values(row).onConflictDoNothing({ target: c.fcuuid }).returning();
      if (saved) { stats.categories.inserted++; await record(tx, "pms_form_categories", saved.fcuuid, null, saved, "system", "create", outbound); } else stats.categories.skipped++;
    }
    for (const row of forms) {
      const [saved] = await tx.insert(f).values(row).onConflictDoNothing({ target: f.fmuuid }).returning();
      const formUuid = row.fmuuid;
      if (saved) { stats.forms.inserted++; await record(tx, "pms_forms_master", formUuid, null, saved, "system", "create", outbound); } else stats.forms.skipped++;
    }
    return stats;
  });
}
