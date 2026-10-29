import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../../../db";
import type { StorePageQuery } from "@shared/storesPagination";
import { z } from "zod";

// All identifiers/expressions are owned by this module; client values are bound.
const s = (name: string) => sql.raw(`s.${name}`);
const text = (name: string) => sql`COALESCE(${s(name)}, '')`;
const rob = sql`COALESCE(NULLIF(s.rob,0), s.rob_location_a+s.rob_location_b,0)`;
const stock = sql`CASE WHEN COALESCE(s.min,0)=0 THEN 'N/A' WHEN ${rob}>=s.min THEN 'OK' ELSE 'Low' END`;
export const historyDate = (tz: string) => {
  // Match the displayed local day, with timestamp fallback for malformed text.
  // Guard all components before casts; JS normalizes e.g. 31-Feb into March.
  const raw = sql`btrim(s.date_local)`;
  const time = "([T ]([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,6})?)?(Z|[+-](0[0-9]|1[0-4]):[0-5][0-9])?)?";
  const iso = sql`CASE WHEN ${raw} ~ ${"^[0-9]{4}-[0-9]{2}-[0-9]{2}" + time + "$"} THEN left(${raw},10) END`;
  const isoDay = sql`CASE WHEN ${iso} IS NOT NULL
    AND substring(${iso},1,4)::int BETWEEN 1 AND 9999
    AND substring(${iso},6,2)::int BETWEEN 1 AND 12
    AND substring(${iso},9,2)::int BETWEEN 1 AND 31
    THEN make_date(substring(${iso},1,4)::int,substring(${iso},6,2)::int,1)+(substring(${iso},9,2)::int-1) END`;
  const human = sql`CASE WHEN ${raw} ~ '^[0-9]{1,2}-[A-Za-z]{3}-[0-9]{4}( ([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?)?$'
    THEN substring(${raw} from '^([0-9]{1,2}-[A-Za-z]{3}-[0-9]{4})') END`;
  return sql`CASE WHEN ${isoDay} IS NOT NULL THEN
      CASE WHEN ${raw} ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' AND to_char(${isoDay},'YYYY-MM-DD')=${iso}
        THEN (${raw}::timestamptz AT TIME ZONE ${tz})::date ELSE ${isoDay} END
    WHEN ${human} IS NOT NULL
      AND lower(split_part(${human},'-',2)) IN ('jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec')
      AND split_part(${human},'-',1)::int BETWEEN 1 AND 31
      AND split_part(${human},'-',3)::int BETWEEN 1 AND 9999
      THEN make_date(split_part(${human},'-',3)::int,
        array_position(ARRAY['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],lower(split_part(${human},'-',2))),1)
        + (split_part(${human},'-',1)::int-1)
    ELSE (s.timestamp_utc AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date END`;
};
const like = (v: string) => `%${v.replace(/[\\%_]/g, "\\$&")}%`;
const join = (v: SQL[], op = " AND ") => v.length ? sql.join(v, sql.raw(op)) : sql`TRUE`;

export function fields(q: StorePageQuery, history = false): Record<string, SQL> {
  if (history) return {
    id: s("id"), dateLocal: sql`COALESCE(to_char(${historyDate(q.timeZone)},'DD-Mon-YYYY'),'-')`, eventType: sql`upper(COALESCE(s.event_type,'UNKNOWN'))`,
    itemName: sql`COALESCE(NULLIF(s.item_name,''),'Item #'||s.item_id)`, partCode: text("part_code"),
    uom: text("uom"), qtyChange: s("qty_change_base"), robAfter: s("rob_after_base"),
    place: text("place"), userId: sql`COALESCE(NULLIF(s.user_id,''),'System')`,
    remarks: text("remarks"), ref: text("ref"),
  };
  return {
    id: s("id"), itemCode: text("item_code"), itemName: text("item_name"),
    storesCategory: text("category"), category: text("category"), uom: text("uom"),
    rob: q.bulk === "true" ? sql`s.rob_location_a+s.rob_location_b` : rob, min: s("min"), max: s("max"), stock,
    location: q.bulk === "true" ? text("location_a") : sql`'@ '||COALESCE(trim_scale(s.rob_location_a)::text,'0')||' / '||COALESCE(trim_scale(s.rob_location_b)::text,'0')`,
    location2: text("location_b"),
    locationAName: text("location_a"), locationBName: text("location_b"),
    robLocationA: s("rob_location_a"), robLocationB: s("rob_location_b"),
    impaCode: text("impa_code"), specification: text("specification"),
    unitCost: s("unit_cost"), supplier: text("supplier"), lastOrderDate: text("last_order_date"),
    leadTime: text("lead_time"), ihmPresence: text("ihm_presence"), ihmEvidenceType: text("ihm_evidence_type"),
    ihmDetails: text("ihm_details"), expiryDate: text("expiry_date"), batchNumber: text("batch_number"),
    sdsReference: text("sds_reference"), hazardClassification: text("hazard_classification"), remarks: text("remarks"), notes: sql`''`,
    locRob: sql`CASE WHEN s.location_a=${q.location ?? ""} AND s.rob_location_a>0 THEN s.rob_location_a ELSE s.rob_location_b END`,
    _locRob: sql`CASE WHEN s.location_a=${q.location ?? ""} AND s.rob_location_a>0 THEN s.rob_location_a ELSE s.rob_location_b END`,
    _locName: sql`${q.location ?? ""}`,
  };
}

function filterExpression(expr: SQL, filter: any, depth = 0): SQL {
  if (depth > 5 || !filter || typeof filter !== "object") throw new Error("Invalid grid filter");
  if (filter.filterType === "multi") {
    if (!Array.isArray(filter.filterModels)) throw new Error("Invalid multi filter");
    return join(filter.filterModels.filter(Boolean).map((f: any) => filterExpression(expr, f, depth + 1)));
  }
  if (filter.conditions || filter.condition1) {
    const conditions = filter.conditions ?? [filter.condition1, filter.condition2].filter(Boolean);
    if (!Array.isArray(conditions) || conditions.length > 10 || !["AND", "OR"].includes(filter.operator)) throw new Error("Invalid compound filter");
    return sql`(${join(conditions.map((f: any) => filterExpression(expr, { filterType: filter.filterType, ...f }, depth + 1)), ` ${filter.operator} `)})`;
  }
  const str = sql`COALESCE((${expr})::text,'')`;
  if (filter.filterType === "set") {
    if (!Array.isArray(filter.values) || filter.values.length > 5000) throw new Error("Invalid set filter");
    return filter.values.length ? sql`(${join(filter.values.map((v: any) => v == null ? sql`${expr} IS NULL OR ${str}=''` : sql`${str}=${String(v)}`), " OR ")})` : sql`FALSE`;
  }
  if (filter.type === "blank") return sql`(${expr} IS NULL OR ${str}='')`;
  if (filter.type === "notBlank") return sql`(${expr} IS NOT NULL AND ${str}<>'')`;
  if (filter.filterType === "number" || filter.filterType === "date") {
    const date = filter.filterType === "date";
    const value = date ? filter.dateFrom?.slice(0, 10) : Number(filter.filter);
    const to = date ? filter.dateTo?.slice(0, 10) : Number(filter.filterTo);
    if (date ? !/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") : !Number.isFinite(value)) throw new Error("Invalid comparison");
    const bound = date ? sql`${value}::date` : sql`${value}::numeric`;
    switch (filter.type) {
      case "equals": return sql`${expr}=${bound}`;
      case "notEqual": return sql`${expr}<>${bound}`;
      case "lessThan": return sql`${expr}<${bound}`;
      case "lessThanOrEqual": return sql`${expr}<=${bound}`;
      case "greaterThan": return sql`${expr}>${bound}`;
      case "greaterThanOrEqual": return sql`${expr}>=${bound}`;
      case "inRange":
        if (date ? !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "") : !Number.isFinite(to)) throw new Error("Invalid range");
        return sql`${expr} BETWEEN ${bound} AND ${date ? sql`${to}::date` : sql`${to}::numeric`}`;
    }
  } else {
    const value = String(filter.filter ?? "");
    switch (filter.type) {
      case "contains": return sql`${str} ILIKE ${like(value)}`;
      case "notContains": return sql`${str} NOT ILIKE ${like(value)}`;
      case "equals": return sql`lower(${str})=lower(${value})`;
      case "notEqual": return sql`lower(${str})<>lower(${value})`;
      case "startsWith": return sql`${str} ILIKE ${like(value).slice(1)}`;
      case "endsWith": return sql`${str} ILIKE ${like(value).slice(0, -1)}`;
    }
  }
  throw new Error("Unsupported grid filter");
}

export function criteria(vesselId: string, q: StorePageQuery, history = false, grid = true, itemUuid?: string): SQL {
  const f = fields(q, history);
  const conditions: SQL[] = [];
  if (vesselId === "my") throw new Error("Use an explicit assigned-vessel scope");
  if (vesselId !== "all") conditions.push(sql`s.vessel_id=${vesselId}`);
  if (q.scope === "my" || q.vesselIds !== undefined) {
    const ids = (q.vesselIds ?? "").split(",").filter(Boolean);
    conditions.push(ids.length ? sql`s.vessel_id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})` : sql`FALSE`);
  }
  conditions.push(history ? sql`s.section=${q.itemType}` : sql`s.item_type=${q.itemType} AND s.deleted=false`);
  if (itemUuid) conditions.push(sql`s.store_uuid=${itemUuid}`);
  if (!history && q.activeOnly === "true") conditions.push(sql`s.is_active IS DISTINCT FROM FALSE`);
  if (q.search) {
    const searchFields = history ? [f.itemName, f.partCode] : [f.itemName, f.itemCode, ...(q.bulk === "true" ? [f.category] : [])];
    conditions.push(sql`(${join(searchFields.map(expr => sql`${expr} ILIKE ${like(q.search)}`), " OR ")})`);
  }
  if (!history) {
    if (q.category && q.category !== "all") conditions.push(sql`position(${q.category} in ${f.category})>0`);
    if (q.stockStatus && q.stockStatus !== "all") conditions.push(sql`${stock}=${q.stockStatus}`);
    if (q.location !== undefined) conditions.push(sql`((s.location_a=${q.location} AND s.rob_location_a>0) OR (s.location_b=${q.location} AND s.rob_location_b>0))`);
  } else {
    if (q.eventType !== "all") conditions.push(sql`${f.eventType}=${q.eventType}`);
    const day = historyDate(q.timeZone);
    if (q.dateFrom) conditions.push(sql`(${day} IS NULL OR ${day}>=${q.dateFrom}::date)`);
    if (q.dateTo) conditions.push(sql`(${day} IS NULL OR ${day}<=${q.dateTo}::date)`);
  }
  if (grid) {
    const model = JSON.parse(q.filters);
    if (!model || Array.isArray(model) || typeof model !== "object" || Object.keys(model).length > 60) throw new Error("Invalid filter model");
    for (const [key, filter] of Object.entries(model)) {
      if (!Object.prototype.hasOwnProperty.call(f, key)) throw new Error(`Unsupported filter column: ${key}`);
      conditions.push(filterExpression(f[key], filter));
    }
  }
  return join(conditions);
}

export function ordering(q: StorePageQuery, history = false): SQL {
  const model = z.array(z.object({ colId: z.string(), sort: z.enum(["asc", "desc"]) })).max(20).parse(JSON.parse(q.sort));
  const f = fields(q, history);
  const order = model.map(({ colId, sort }) => {
    if (!Object.prototype.hasOwnProperty.call(f, colId)) throw new Error(`Unsupported sort column: ${colId}`);
    return sql`${f[colId]} ${sql.raw(sort)}`;
  });
  if (!order.length) {
    if (history) order.push(sql`s.id DESC`);
    else if (q.bulk !== "true") {
      // Match numeric-aware code ordering without changing stored codes.
      order.push(sql`CASE WHEN s.is_active IS FALSE THEN 1 ELSE 0 END`, sql`(SELECT array_agg(
        CASE WHEN chunk ~ '^[0-9]+$' THEN lpad(chunk,30,'0') ELSE chunk END ORDER BY ordinal)
        FROM regexp_matches(s.item_code,'([0-9]+|[^0-9]+)','g') WITH ORDINALITY AS parts(matches,ordinal)
        CROSS JOIN LATERAL unnest(matches) AS chunk)`);
    }
  }
  return sql`${sql.join([...order, sql`s.id ASC`], sql`, `)}`;
}
const camel = (row: any) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
  // Raw Drizzle execution leaves PostgreSQL timestamps as naive text, unlike
  // ORM select's Date mapping. Preserve the existing UTC API representation.
  if (key === "timestamp_utc" && typeof value === "string") {
    const date = new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
    return ["timestampUTC", Number.isNaN(date.getTime()) ? value : date.toISOString()];
  }
  return [key === "timestamp_utc" ? "timestampUTC" : key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), value];
}));
export async function queryPage(vesselId: string, q: StorePageQuery, history = false, itemUuid?: string) {
  const db = await getDb();
  const table = sql.raw(history ? "stores_ledger" : "stores_items");
  const where = criteria(vesselId, q, history, true, itemUuid);
  const order = ordering(q, history);
  return db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const count = await tx.execute(sql`SELECT count(*)::int AS total FROM ${table} s WHERE ${where}`);
    const result = await tx.execute(sql`SELECT s.* FROM ${table} s WHERE ${where}
      ORDER BY ${order} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`);
    const total = Number(count.rows[0].total);
    return { items: result.rows.map(camel), total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) };
  });
}
export async function queryLocations(vesselId: string, q: StorePageQuery) {
  const db = await getDb();
  const where = criteria(vesselId, { ...q, location: undefined, filters: "{}" });
  const base = sql`WITH locs AS (
    SELECT loc.name FROM stores_items s CROSS JOIN LATERAL
    (VALUES (s.location_a,s.rob_location_a),(s.location_b,s.rob_location_b)) loc(name,qty)
    WHERE ${where} AND COALESCE(loc.name,'')<>'' AND loc.qty>0
  ), grouped AS (SELECT name,count(*)::int AS count FROM locs
    WHERE name ILIKE ${like(q.locationSearch)} GROUP BY name)`;
  return db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const count = await tx.execute(sql`${base} SELECT count(*)::int AS total FROM grouped`);
    const rows = await tx.execute(sql`${base} SELECT * FROM grouped ORDER BY name LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`);
    const total = Number(count.rows[0].total);
    return { items: rows.rows, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) };
  });
}
export async function queryValues(vesselId: string, q: StorePageQuery, column: string, history: boolean) {
  const available = fields(q, history);
  if (!Object.prototype.hasOwnProperty.call(available, column)) throw new Error("Unknown column");
  const expr = available[column];
  const db = await getDb();
  const model = JSON.parse(q.filters); delete model[column];
  const where = criteria(vesselId, { ...q, filters: JSON.stringify(model) }, history);
  const rows = await db.execute(sql`SELECT DISTINCT (${expr})::text AS value FROM ${sql.raw(history ? "stores_ledger" : "stores_items")} s WHERE ${where} ORDER BY value`);
  return rows.rows.map(row => row.value);
}
export async function queryTargets(vesselId: string, q: StorePageQuery) {
  const db = await getDb();
  const rows = await db.execute(sql`SELECT s.id,s.vessel_id FROM stores_items s WHERE ${criteria(vesselId, q, false, false)}`);
  return rows.rows.map(r => ({ id: Number(r.id), vesselId: String(r.vessel_id) }));
}

/** Validate only submitted identities, not complete inventory records.
 * JSON binding avoids PostgreSQL's parameter-count limit for large selections.
 */
export async function queryTargetIdentities(ids: number[]) {
  if (!ids.length) return [];
  const db = await getDb();
  const result = await db.execute(sql`SELECT s.id,s.vessel_id,s.item_type,s.deleted FROM stores_items s
    WHERE s.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(Array.from(new Set(ids)))}::jsonb)::bigint)`);
  return result.rows.map(row => ({
    id: Number(row.id), vesselId: String(row.vessel_id), itemType: String(row.item_type), deleted: row.deleted === true,
  }));
}
