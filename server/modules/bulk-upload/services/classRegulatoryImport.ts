import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { components, vessels, masterLists, componentClassRegulatory as entries,
  importHistory, importChangeLog, bulkImportHistory, bulkImportErrors } from "@shared/schema";
import { CLASS_REGULATORY_TEMPLATE_FIELDS } from "@shared/bulkImportTemplateFields";
import { isClassComponent, surveyTypeCategoryLabel } from "@shared/classRegulatory";
import { getDb } from "../../../db";
import { getCurrentTenantContext } from "../../../utils/asyncLocalStorage";
import { ConflictError, ForbiddenError, ValidationError } from "../../shared/errors";
import { sectionHOfficeCanManage, type SectionHActor } from "../../components/services/classRegulatoryAccess";
import { classRegulatoryBusinessFields, writeClassEntryInTransaction, type ClassRegulatoryTx } from "../../components/services/classRegulatoryService";
import { headers, importSurveyDate, readSectionHWorkbook, SECTION_H_IMPORT_TYPE, type ImportMode } from "./classRegulatoryWorkbook";

type Db = Awaited<ReturnType<typeof getDb>>;
type Connection = Db | ClassRegulatoryTx;
type Entry = typeof entries.$inferSelect;
type PlannedRow = {
  row: number; status: "ok" | "warning" | "error"; errors: string[]; warnings: string[]; normalized: Record<string, any>;
  values: Record<string, string>; componentUuid?: string; target?: Entry;
  targetFingerprint?: string; proposed?: "create" | "update" | "skip"; business?: Record<string, any>;
  masterFingerprint?: string;
};
type Preview = {
  token: string; binding: string; vesselId: string; vesselCode: string; mode: ImportMode;
  sheet: string; file: Buffer; originalName: string; timestamp: number; rows: PlannedRow[];
  state: "ready" | "running" | "done"; workbookHash: string;
};
const previews = new Map<string, Preview>();
// Match JavaScript trim() on both sides of certificate identity comparisons.
const trimCharacters = "\u0009\u000a\u000b\u000c\u000d \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
const TTL = 60 * 60 * 1000;
const MAX_CACHED_BYTES = 64 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const active = (table: typeof entries | typeof components | typeof vessels | typeof masterLists) =>
  or(isNull(table.isDeleted), eq(table.isDeleted, false));

function assertOffice(actor: SectionHActor) {
  if (!sectionHOfficeCanManage(actor)) throw new ForbiddenError("Only an authorized Office user can import Classification & Regulatory Data.");
}
function binding(actor: SectionHActor) {
  return fingerprint([getCurrentTenantContext()?.tuid || "single-tenant", actor.userId, actor.userType, actor.role, actor.identityMode]);
}
export function importMode(value: unknown): ImportMode {
  if (value !== "add" && value !== "update" && value !== "upsert") throw new ValidationError("Select Add Only, Update Only or Add + Update.");
  return value;
}
export async function importVessel(db: Connection, vesselId: unknown) {
  if (typeof vesselId !== "string" || !uuid.test(vesselId)) throw new ValidationError("Select a valid vessel UUID.");
  const [vessel] = await db.select().from(vessels).where(and(eq(vessels.vuuid, vesselId), active(vessels)));
  if (!vessel) throw new ValidationError("The selected vessel does not exist or has been removed.");
  return vessel;
}
export async function resolveImportComponent(db: Connection, vesselId: string, code: string, lock = false) {
  const query = db.select().from(components).where(and(eq(components.vesselId, vesselId),
    eq(components.componentCode, code), eq(components.dataScope, "vessel"), active(components)));
  const matches = await (lock ? query.for("update") : query);
  if (!matches.length) throw new ValidationError("Component Code does not exist for the selected vessel.");
  if (matches.length !== 1) throw new ValidationError("Component Code is ambiguous within the selected vessel. Correct duplicate components first.");
  const component = matches[0];
  if (!uuid.test(component.cuuid || "")) throw new ValidationError("Component has no valid canonical UUID. Correct its identity before importing.");
  return component;
}
/** Ignore unrelated is_sync bookkeeping while detecting actual record mutations. */
function entryFingerprint(entry: Entry) {
  const { isSync: _sync, ...business } = entry;
  return fingerprint(business);
}
async function master(db: Connection, type: string, value: string, lock = false) {
  // Compare complete formatted pairs, rather than splitting on "/" (which may
  // legitimately occur in a value or category). Exact legacy keys retain priority.
  const query = db.select().from(masterLists).where(type === "surveyType" ? eq(masterLists.listType, type) :
    and(eq(masterLists.listType, type), or(eq(masterLists.listKey, value), eq(masterLists.listValue, value))));
  const matches = await (lock ? query.for("share") : query);
  const codes = matches.filter(row => row.listKey === value);
  const eligible = matches.filter(row => row.isActive && !row.isDeleted);
  const pairs = type === "surveyType" ? eligible.filter(row => row.category?.trim() &&
    surveyTypeCategoryLabel(row.listValue, row.category) === value) : [];
  const candidates = codes.length ? codes : pairs.length ? pairs : eligible.filter(row => row.listValue === value);
  if (type === "surveyType" && !codes.length && candidates.length > 1)
    throw new ValidationError(`Survey Type/Category: "${value}" matches multiple active Survey Types. Enter a unique Survey Type/Category pair; this row cannot be imported.`);
  if (candidates.length !== 1 || !candidates[0].isActive || candidates[0].isDeleted) throw new ValidationError(
    `${type === "classificationSociety" ? "Classification Society" : "Survey Type/Category"}: ${candidates.length > 1 ? "ambiguous master value" : "unknown, inactive or removed master value"}.`);
  return candidates[0];
}
async function evaluate(db: Connection, values: Record<string, string>, vesselId: string, mode: ImportMode, lock = false) {
  const vessel = await importVessel(db, vesselId);
  if (values.vesselCode !== vessel.code) throw new ValidationError("Vessel Code must match the selected vessel's actual code.");
  if (!values.componentCode) throw new ValidationError("Component Code is required.");
  if (!values.certificateNumber || values.certificateNumber.length > 100)
    throw new ValidationError("Certificate Number is required and must not exceed 100 characters.");
  const component = await resolveImportComponent(db, vesselId, values.componentCode, lock);
  const query = db.select().from(entries).where(and(eq(entries.componentId, component.cuuid),
    sql`btrim(${entries.certificateNumber}, ${trimCharacters}) = ${values.certificateNumber}`));
  const candidates = await (lock ? query.for("update") : query);
  const matching = candidates.filter(e => !e.isDeleted);
  if (matching.length > 1) throw new ValidationError("Multiple active entries match Component Code + Certificate Number. Correct the ambiguity first.");
  if (!matching.length && candidates.length) throw new ValidationError("Only removed entries match. Resolve these manually; this import does not restore entries.");
  const target = matching[0];
  if (target && !uuid.test(target.ccruuid || "")) throw new ValidationError("The matching entry has no reconciled canonical UUID.");
  const proposed = mode === "add" && target || mode === "update" && !target ? "skip" : target ? "update" : "create";
  const business: Record<string, any> = { certificateNumber: values.certificateNumber };
  // Blank inputs are omitted, not converted to null/defaults or empty strings.
  for (const key of ["classRequirements", "information"])
    if (values[key]) business[key] = values[key];
  if (values.lastClassSurveyDate) business.lastClassSurvey = importSurveyDate(values.lastClassSurveyDate);
  if (values.nextClassSurvey) business.nextSurveyDue = importSurveyDate(values.nextClassSurvey);
  const selectedMasters: unknown[] = [];
  let surveyTypeValue = target?.surveyType ? surveyTypeCategoryLabel(target.surveyType) : undefined;
  if (!values.surveyType && target?.surveyTypeKey) {
    const query = db.select().from(masterLists).where(and(eq(masterLists.listType, "surveyType"),
      eq(masterLists.listKey, target.surveyTypeKey)));
    const retained = await (lock ? query.for("share") : query);
    surveyTypeValue = surveyTypeCategoryLabel(target.surveyType, retained.length === 1 ? retained[0].category : null);
    selectedMasters.push(["retainedSurvey", ...retained.map(m => [m.id, m.listKey, m.listValue, m.category, m.isActive, m.isDeleted])]);
  }
  for (const [field, type, key] of [
    ["classificationSociety", "classificationSociety", "classificationSocietyKey"],
    ["surveyType", "surveyType", "surveyTypeKey"],
  ]) {
    if (!values[field]) {
      if (!target && proposed !== "skip") throw new ValidationError(`${field === "surveyType" ? "Survey Type/Category" : "Classification Society"} is required for a new entry.`);
      continue;
    }
    const selected = await master(db, type, values[field], lock);
    business[key] = selected.listKey;
    if (type === "surveyType") surveyTypeValue = surveyTypeCategoryLabel(selected.listValue, selected.category);
    selectedMasters.push([type, selected.id, selected.listKey, selected.listValue, selected.isActive, selected.isDeleted,
      ...(type === "surveyType" ? [selected.category] : [])]);
  }
  const societyCode = business.classificationSocietyKey || target?.classificationSocietyKey || target?.classCode;
  if (values.classCode) {
    if (!societyCode || values.classCode !== societyCode) throw new ValidationError("Class Code must exactly match the selected Classification Society's master code.");
    // Even a retained society must still be active when its code is explicitly supplied.
    const selected = await master(db, "classificationSociety", societyCode, lock);
    selectedMasters.push(["classCode", selected.id, selected.listKey, selected.listValue]);
  }
  // Reuse the exact manual validators; import master inputs are additionally checked above,
  // including unchanged keys, since the manual editor intentionally preserves retired snapshots.
  if (proposed !== "skip") await classRegulatoryBusinessFields(db, business, target, true);
  return { vessel, component, target, proposed: proposed as "create" | "update" | "skip", business,
    masterFingerprint: fingerprint(selectedMasters), surveyTypeValue };
}

export async function previewSectionHImport(
  actor: SectionHActor, vesselId: string, mode: ImportMode, file: Buffer, name: string, sheetName?: string,
) {
  assertOffice(actor);
  const db = await getDb();
  const vessel = await importVessel(db, vesselId);
  const parsed = readSectionHWorkbook(file, name, sheetName);
  const keys = new Map<string, number>();
  for (const { values } of parsed.rows) {
    const key = JSON.stringify([values.componentCode, values.certificateNumber]);
    keys.set(key, (keys.get(key) || 0) + 1);
  }
  const rows: PlannedRow[] = [];
  for (const source of parsed.rows) {
    const result: PlannedRow = { ...source, status: "ok", normalized: { ...source.values }, errors: [...source.errors], warnings: [] };
    for (const field of CLASS_REGULATORY_TEMPLATE_FIELDS) result.normalized[field.header] = source.values[field.key];
    try {
      if (keys.get(JSON.stringify([source.values.componentCode, source.values.certificateNumber]))! > 1)
        throw new ValidationError("Duplicate Component Code + Certificate Number within this worksheet.");
      const resolved = await evaluate(db, source.values, vesselId, mode);
      Object.assign(result, { componentUuid: resolved.component.cuuid, target: resolved.target,
        targetFingerprint: resolved.target && entryFingerprint(resolved.target), proposed: resolved.proposed,
        business: resolved.business, masterFingerprint: resolved.masterFingerprint });
      result.normalized.action = resolved.proposed;
      result.normalized.Action = resolved.proposed;
      if (!result.errors.length && resolved.surveyTypeValue)
        result.normalized["Survey Type/Category"] = resolved.surveyTypeValue;
      if (!result.errors.length && !isClassComponent(resolved.component.classItem)) {
        result.warnings.push(`Component ${source.values.componentCode} is not marked as a Class Item. Otherwise valid data can be imported, but Section H will remain hidden until Class Item is saved as Yes.`);
        result.status = "warning";
      }
    } catch (error: any) {
      result.errors.push(...(error.fieldErrors ? Object.entries(error.fieldErrors).map(([k, v]) => `${k}: ${v}`) : [error.message]));
    }
    if (result.errors.length) result.status = "error";
    rows.push(result);
  }
  for (const [key, value] of Array.from(previews)) if (Date.now() - value.timestamp >= TTL) previews.delete(key);
  const bytes = Array.from(previews.values()).reduce((n, p) => n + p.file.length, 0);
  if (bytes + file.length > MAX_CACHED_BYTES || previews.size >= 100)
    throw new ValidationError("Validation capacity is temporarily full. Wait for existing sessions to expire and retry.");
  const token = randomUUID();
  previews.set(token, { token, binding: binding(actor), vesselId, vesselCode: vessel.code, mode,
    sheet: parsed.sheet, file, originalName: name, timestamp: Date.now(), rows, state: "ready", workbookHash: fingerprint(file) });
  return { fileToken: token, columns: headers(), summary: { ok: rows.filter(r => r.status === "ok").length,
    warnings: rows.filter(r => r.status === "warning").length, errors: rows.filter(r => r.status === "error").length },
    rows: rows.map(({ row, status, errors, warnings, normalized }) => ({ row, status, errors, warnings, normalized })), totalRows: rows.length,
    errorReportUrl: `/technical/api/bulk/class-regulatory/preview/${token}/errors?vesselId=${encodeURIComponent(vesselId)}` };
}

export function sectionHPreview(actor: SectionHActor, body: any, claim = false) {
  assertOffice(actor);
  const cached = previews.get(body.fileToken);
  if (!cached || Date.now() - cached.timestamp >= TTL) {
    if (cached) previews.delete(body.fileToken);
    throw new ValidationError("The validation session expired or is no longer available. Run validation again.");
  }
  if (cached.binding !== binding(actor) || cached.vesselId !== body.vesselId ||
      (body.mode !== undefined && cached.mode !== body.mode) ||
      (body.type !== undefined && body.type !== SECTION_H_IMPORT_TYPE))
    throw new ForbiddenError("Validation context does not match this user, tenant, vessel, mode or import type. Run validation again.");
  if (claim) {
    if (cached.state !== "ready") throw new ConflictError("This validation session is already importing or has been used. Run validation again.");
    cached.state = "running";
  }
  return cached;
}

export function selectedSectionHRows(preview: Preview, indices: unknown) {
  if (indices === undefined) {
    if (preview.rows.some(r => r.status === "error")) throw new ValidationError("The worksheet has errors. Explicitly confirm importing valid rows only.");
    return preview.rows;
  }
  if (!Array.isArray(indices) || !indices.length || new Set(indices).size !== indices.length)
    throw new ValidationError("Select a nonempty, unique set of validated Excel row numbers.");
  const selected = indices.map(index => {
    const row = Number.isInteger(index) ? preview.rows.find(r => r.row === index) : undefined;
    if (!row || (row.status !== "ok" && row.status !== "warning")) throw new ValidationError("Selected rows must reference the server's valid Excel rows.");
    return row;
  });
  return selected;
}

export async function commitSectionHImport(
  actor: SectionHActor, body: any, storeFile: (file: Buffer, name: string, type: string) => Promise<string | null>,
  progress: (data: any) => void,
) {
  const preview = sectionHPreview(actor, body);
  const selected = selectedSectionHRows(preview, body.rowIndices);
  sectionHPreview(actor, body, true); // Synchronous claim before any awaited storage/DB work.
  const db = await getDb();
  const id = randomUUID();
  const startedAt = new Date();
  const excluded = preview.rows.filter(row => row.status === "error");
  const result = { historyId: id, created: 0, updated: 0, skipped: 0, archived: 0, failed: excluded.length,
    errors: excluded.map(row => ({ row: row.row, message: row.errors.join("; ") })),
    rowResults: excluded.map(row => ({ rowNumber: row.row, action: "failed", error: row.errors.join("; "),
      primaryIdentifier: row.values.componentCode })) as any[] };
  let bulkId: number | undefined;
  try {
    const vessel = await importVessel(db, preview.vesselId);
    if (vessel.code !== preview.vesselCode) throw new ConflictError("Vessel changed after validation. Run validation again.");
    const storedFilePath = await storeFile(preview.file, preview.originalName, SECTION_H_IMPORT_TYPE);
    if (!storedFilePath) throw new Error("The original workbook could not be stored. No regulatory records were imported.");
    await db.transaction(async tx => {
      await tx.insert(importHistory).values({ id, type: SECTION_H_IMPORT_TYPE, mode: preview.mode,
        userId: actor.userId, vesselId: preview.vesselId, originalName: preview.originalName, storedFilePath,
        fileSize: preview.file.length, startedAt, status: "in_progress", createdByUuid: actor.userId, updatedByUuid: actor.userId });
      const [bulk] = await tx.insert(bulkImportHistory).values({ biuuid: id, vesselCode: preview.vesselId,
        vesselName: vessel.name, moduleType: SECTION_H_IMPORT_TYPE, sheetName: preview.sheet,
        fileName: preview.originalName, fileSize: preview.file.length, uploadedBy: actor.userId,
        totalRows: preview.rows.length, status: "processing", createdByUuid: actor.userId, updatedByUuid: actor.userId }).returning();
      bulkId = bulk.id;
    });
    progress({ historyId: id, processed: 0, total: selected.length, percent: 0, status: "Importing Classification & Regulatory Data" });
    const failures: { row: number; errors: string[] }[] = preview.rows.filter(r => r.status === "error");
    for (let index = 0; index < selected.length; index++) {
      const row = selected[index];
      try {
        const outcome = await db.transaction(async tx => {
          // Shared vessel lock prevents deletion/code changes during the row transaction.
          await tx.select({ id: vessels.vuuid }).from(vessels).where(eq(vessels.vuuid, preview.vesselId)).for("share");
          const live = await evaluate(tx, row.values, preview.vesselId, preview.mode, true);
          if (live.vessel.code !== preview.vesselCode || live.component.cuuid !== row.componentUuid ||
              live.proposed !== row.proposed || live.target?.id !== row.target?.id ||
              (live.target && entryFingerprint(live.target) !== row.targetFingerprint) ||
              live.masterFingerprint !== row.masterFingerprint)
            throw new ConflictError("Component, matching record or reference master changed after validation; run dry-run again.");
          if (live.proposed === "skip") return "skipped" as const;
          const saved = await writeClassEntryInTransaction(tx, live.component.cuuid, live.business, actor, live.target, "bulk_import");
          await tx.insert(importChangeLog).values({ id: randomUUID(), importHistoryId: id,
            entityType: "component_class_regulatory", entityId: saved.ccruuid!,
            operation: live.target ? "updated" : "created", previousData: live.target || null, newData: saved,
            checksum: fingerprint(saved), createdByUuid: actor.userId, updatedByUuid: actor.userId });
          return live.target ? "updated" as const : "created" as const;
        });
        result[outcome]++;
        result.rowResults.push({ rowNumber: row.row, action: outcome, primaryIdentifier: row.values.componentCode });
      } catch (error: any) {
        result.failed++;
        const message = error.fieldErrors ? Object.values(error.fieldErrors).join("; ") :
          error.statusCode ? error.message : "The row could not be saved; its transaction was rolled back. Contact support with the import ID.";
        result.errors.push({ row: row.row, message });
        failures.push({ row: row.row, errors: [message] });
        result.rowResults.push({ rowNumber: row.row, action: "failed", error: message, primaryIdentifier: row.values.componentCode });
      }
      // Durable counters allow recovery/polling without relying on this process's cache.
      await db.update(importHistory).set({ created: result.created, updated: result.updated, skipped: result.skipped,
        errorMessage: result.errors.length ? JSON.stringify(result.errors) : null })
        .where(eq(importHistory.id, id));
      progress({ historyId: id, processed: index + 1, total: selected.length, remaining: selected.length - index - 1,
        percent: Math.round((index + 1) * 100 / selected.length), errors: result.failed, status: "Importing Classification & Regulatory Data" });
    }
    await db.transaction(async tx => {
      for (const failure of failures) for (const message of failure.errors) await tx.insert(bulkImportErrors).values({
        importId: bulkId!, importUuid: id, rowNumber: failure.row, fieldName: "Row",
        errorType: "Validation", errorDescription: message, createdByUuid: actor.userId, updatedByUuid: actor.userId,
      });
      const status = result.failed ? result.created + result.updated + result.skipped ? "partial" : "failed" : "complete";
      await tx.update(importHistory).set({ created: result.created, updated: result.updated, skipped: result.skipped,
        finishedAt: new Date(), status, errorMessage: result.errors.length ? JSON.stringify(result.errors) : null }).where(eq(importHistory.id, id));
      await tx.update(bulkImportHistory).set({ successCount: result.created + result.updated,
        skippedCount: result.skipped, failedCount: failures.length, status: status === "complete" ? "completed" : status,
        processingTimeMs: Date.now() - startedAt.getTime() }).where(eq(bulkImportHistory.biuuid, id));
    });
    return result;
  } catch (error) {
    // Earlier committed rows remain truthfully recorded; never report workbook-wide rollback.
    await db.update(importHistory).set({ status: "failed", finishedAt: new Date(),
      errorMessage: "Import interrupted. Review committed row counts and validate again." }).where(eq(importHistory.id, id));
    if (bulkId) await db.update(bulkImportHistory).set({ status: "failed", successCount: result.created + result.updated,
      skippedCount: result.skipped, failedCount: result.failed }).where(eq(bulkImportHistory.id, bulkId));
    throw error;
  } finally {
    preview.state = "done";
  }
}

export function previewErrorRows(actor: SectionHActor, token: string, vesselId: string) {
  return sectionHPreview(actor, { fileToken: token, vesselId }).rows.filter(r => r.status === "error");
}
