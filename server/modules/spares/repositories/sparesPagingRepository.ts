import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import type { SparePageQuery } from "@shared/sparesPagination";

const col = (key: string) => sql.raw(`s.${key}`);
const text = (key: string) => sql`COALESCE(${col(key)},'')`;
const join = (parts: SQL[], op = " AND ") => parts.length ? sql.join(parts, sql.raw(op)) : sql`TRUE`;
const literal = (value: string) => value.replace(/[\\%_]/g, "\\$&");
const stock = sql`CASE WHEN COALESCE(s.rob,0)<COALESCE(s.min,0) THEN 'Low' WHEN COALESCE(s.rob,0)=COALESCE(s.min,0) THEN 'At Min' ELSE 'OK' END`;

// History's existing period filter accepts date-only/English DD-Mon text;
// other text falls back to timestampUTC. Keep display formatting separate.
export function historyDay(q: SparePageQuery): SQL {
  const value = sql`btrim(s.date_local)`;
  const months = sql`ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']`;
  return sql`CASE
    WHEN ${value} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND substring(${value},1,4)::int BETWEEN 1 AND 9999 AND substring(${value},6,2)::int BETWEEN 1 AND 12
      AND substring(${value},9,2)::int BETWEEN 1 AND 31
      THEN make_date(substring(${value},1,4)::int,substring(${value},6,2)::int,1)+substring(${value},9,2)::int-1
    WHEN ${value} ~ '^[0-9]{1,2}-[A-Z][a-z]{2}-[0-9]{4}$'
      AND split_part(${value},'-',1)::int BETWEEN 0 AND 31 AND split_part(${value},'-',3)::int BETWEEN 1 AND 9999
      AND split_part(${value},'-',2)=ANY(${months})
      THEN make_date(split_part(${value},'-',3)::int,array_position(${months},split_part(${value},'-',2)),1)+split_part(${value},'-',1)::int-1
    ELSE (s.timestamp_utc AT TIME ZONE 'UTC' AT TIME ZONE ${q.timeZone})::date END`;
}
export function displayHistoryDay(q: SparePageQuery): SQL {
  const value = sql`btrim(s.date_local)`;
  const iso = sql`CASE WHEN ${value} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([T ].*)?$'
    AND substring(${value},1,4)::int BETWEEN 1 AND 9999 AND substring(${value},6,2)::int BETWEEN 1 AND 12
    AND substring(${value},9,2)::int BETWEEN 1 AND 31
    THEN make_date(substring(${value},1,4)::int,substring(${value},6,2)::int,1)+substring(${value},9,2)::int-1 ELSE NULL END`;
  return sql`CASE WHEN COALESCE(s.date_local,'')='' THEN (s.timestamp_utc AT TIME ZONE 'UTC' AT TIME ZONE ${q.timeZone})::date
    WHEN ${value} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN ${iso}
    WHEN ${value} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ]([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]+)?)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])?$'
      THEN CASE WHEN to_char(${iso},'YYYY-MM-DD')=substring(${value},1,10)
        AND ${value} ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN (${value}::timestamptz AT TIME ZONE ${q.timeZone})::date ELSE ${iso} END
    WHEN btrim(s.date_local) ~ '^[0-9]{1,2}-[A-Z][a-z]{2}-[0-9]{4}$' THEN ${historyDay(q)}
    ELSE NULL END`;
}
export function fields(q: SparePageQuery): Record<string, SQL> {
  if (q.kind === "history") return {
    id: col("id"), date: sql`COALESCE(to_char(${displayHistoryDay(q)},'DD-Mon-YYYY'),'-')`,
    dateLocal: displayHistoryDay(q), partCode: text("part_code"), partName: text("part_name"),
    componentName: text("component_name"), partNumber: sql`COALESCE(p.part_number,'-')`,
    eventType: col("event_type"), qtyChange: col("qty_change"), robAfter: col("rob_after"), reference: text("reference"),
  };
  return {
    id: col("id"), partCode: text("part_code"), partName: text("part_name"),
    componentName: text("component_name"), componentCode: text("component_code"),
    partNumber: text("part_number"), critical: text("critical"), criticality: text("criticality"),
    isRotationItem: col("is_rotation_item"), rob: col("rob"), min: col("min"), max: col("max"),
    stockStatus: stock, location: text("location"), location2: text("location_2"),
    locationDisplay: sql`COALESCE(s.location,'')||' / '||COALESCE(s.location_2,'')`,
    ihm: text("ihm"), robLocationA: col("rob_location_a"), robLocationB: col("rob_location_b"),
    locRob: sql`ls.qty`, changeLocation: sql`COALESCE(l.location_name,'')`,
  };
}
function filterExpression(expr: SQL, f: any, depth = 0): SQL {
  if (!f || typeof f !== "object" || depth > 5) throw new Error("Invalid filter");
  if (f.filterType === "multi") {
    if (!Array.isArray(f.filterModels) || f.filterModels.length > 10) throw new Error("Invalid multi filter");
    return join(f.filterModels.filter(Boolean).map((v: any) => filterExpression(expr, v, depth + 1)));
  }
  if (f.conditions || f.condition1) {
    const parts = f.conditions ?? [f.condition1, f.condition2].filter(Boolean);
    if (!Array.isArray(parts) || parts.length > 10 || !["AND", "OR"].includes(f.operator)) throw new Error("Invalid compound filter");
    return sql`(${join(parts.map((v: any) => filterExpression(expr, { filterType: f.filterType, ...v }, depth + 1)), ` ${f.operator} `)})`;
  }
  const value = sql`COALESCE((${expr})::text,'')`;
  if (f.filterType === "set") {
    if (!Array.isArray(f.values) || f.values.length > 5000) throw new Error("Invalid set filter");
    return f.values.length ? sql`(${join(f.values.map((v: any) => v == null ? sql`${expr} IS NULL OR ${value}=''` : sql`${value}=${String(v)}`), " OR ")})` : sql`FALSE`;
  }
  if (f.type === "blank") return sql`(${expr} IS NULL OR ${value}='')`;
  if (f.type === "notBlank") return sql`(${expr} IS NOT NULL AND ${value}<>'')`;
  const numeric = f.filterType === "number";
  const date = f.filterType === "date";
  if (numeric || date) {
    const parse = (v: any) => {
      if (numeric) { if (!Number.isFinite(Number(v))) throw new Error("Invalid number"); return sql`${Number(v)}::numeric`; }
      const day = String(v ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new Error("Invalid date");
      return sql`${day}::date`;
    };
    const a = parse(date ? f.dateFrom : f.filter);
    const ops: Record<string, string> = { equals: "=", notEqual: "<>", lessThan: "<", lessThanOrEqual: "<=", greaterThan: ">", greaterThanOrEqual: ">=" };
    if (Object.hasOwn(ops, f.type)) return sql`${expr} ${sql.raw(ops[f.type])} ${a}`;
    if (f.type === "inRange") return sql`${expr} BETWEEN ${a} AND ${parse(date ? f.dateTo : f.filterTo)}`;
  } else {
    const v = literal(String(f.filter ?? ""));
    switch (f.type) {
      case "equals": return sql`lower(${value})=lower(${String(f.filter ?? "")})`;
      case "notEqual": return sql`lower(${value})<>lower(${String(f.filter ?? "")})`;
      case "contains": return sql`${value} ILIKE ${`%${v}%`}`;
      case "notContains": return sql`${value} NOT ILIKE ${`%${v}%`}`;
      case "startsWith": return sql`${value} ILIKE ${`${v}%`}`;
      case "endsWith": return sql`${value} ILIKE ${`%${v}`}`;
    }
  }
  throw new Error("Unsupported filter");
}
export function scope(vesselId: string, q: SparePageQuery, alias: "s" | "cl" | "c" = "s"): SQL {
  const parts: SQL[] = [];
  const vessel = sql.raw(`${alias}.vessel_id`);
  if (vesselId === "my") throw new Error("Use explicit My Vessels scope");
  if (vesselId !== "all") parts.push(sql`${vessel}=${vesselId}`);
  if (q.scope === "my" || q.vesselIds !== undefined) {
    const ids = (q.vesselIds ?? "").split(",").filter(Boolean);
    parts.push(ids.length ? sql`${vessel} IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})` : sql`FALSE`);
  }
  return join(parts);
}
export function criteria(vesselId: string, q: SparePageQuery): SQL {
  const f = fields(q), parts = [scope(vesselId, q)];
  if (q.kind === "history") {
    if (q.search) parts.push(sql`(s.part_code ILIKE ${`%${literal(q.search)}%`} OR s.part_name ILIKE ${`%${literal(q.search)}%`} OR s.component_name ILIKE ${`%${literal(q.search)}%`})`);
    if (q.eventType !== "all") parts.push(sql`s.event_type=${q.eventType}`);
    if (q.dateFrom) parts.push(sql`(${historyDay(q)} IS NULL OR ${historyDay(q)}>=${q.dateFrom}::date)`);
    if (q.dateTo) parts.push(sql`(${historyDay(q)} IS NULL OR ${historyDay(q)}<=${q.dateTo}::date)`);
  } else {
    parts.push(sql`s.deleted=false AND s.is_deleted IS DISTINCT FROM TRUE`);
    if (q.kind !== "location") parts.push(sql`s.data_scope='vessel'`);
    if (q.activeOnly === "true") parts.push(sql`s.is_active IS DISTINCT FROM FALSE`);
    if (q.kind === "location") {
      if (vesselId === "all") throw new Error("Invalid vessel: select one vessel for By Location");
      if (!q.locationId) throw new Error("Invalid location");
      parts.push(sql`ls.location_id=${q.locationId} AND ls.qty>0 AND l.vessel_id=s.vessel_id`);
    }
    if (q.search) {
      // Preserve each screen's existing fields and substring rules. Inventory's
      // existing ILIKE treats %/_ as wildcards; local Location/Bulk search was literal.
      const raw = q.kind === "inventory" ? q.search.trim() : literal(q.search);
      const keys = q.kind === "bulk" ? ["part_code", "part_name"] : q.kind === "location"
        ? ["part_code", "part_name", "component_name"] : ["part_code", "part_name", "component_code", "component_name", "location", "location_2"];
      if (raw) parts.push(sql`(${join(keys.map(key => sql`${col(key)} ILIKE ${`%${raw}%`}`), " OR ")})`);
    }
    if (q.criticality && q.criticality !== "All") parts.push(q.kind === "location"
      ? sql`(s.critical=${q.criticality} OR s.criticality=${q.criticality})`
      : q.criticality === "Critical" ? sql`s.critical IN ('Critical','Yes')`
      : sql`(s.critical IS NULL OR s.critical NOT IN ('Critical','Yes'))`);
    if (q.rotation === "Rotation Items") parts.push(sql`s.is_rotation_item=true`);
    if (q.rotation === "Non-Rotation Items") parts.push(sql`s.is_rotation_item IS DISTINCT FROM TRUE`);
    if (q.stockStatus && q.stockStatus !== "All") parts.push(sql`${stock}=${q.stockStatus}`);
    if (q.componentId) parts.push(sql`(s.component_code=${q.componentId} OR s.component_code LIKE ${`${q.componentId}.%`}
      OR EXISTS(SELECT 1 FROM spare_component_links cl JOIN components c ON c.cuuid=cl.component_id
        WHERE cl.spare_id=s.id AND c.vessel_id=s.vessel_id AND (c.component_code=${q.componentId} OR c.component_code LIKE ${`${q.componentId}.%`})))`);
  }
  const filters = JSON.parse(q.filters);
  if (!filters || Array.isArray(filters) || typeof filters !== "object" || Object.keys(filters).length > 60) throw new Error("Invalid filters");
  for (const [key, value] of Object.entries(filters)) {
    if (!Object.hasOwn(f, key) || (["locRob", "changeLocation"].includes(key) && q.kind !== "location")) throw new Error(`Unsupported column ${key}`);
    parts.push(filterExpression(f[key], value));
  }
  return join(parts);
}
export function ordering(q: SparePageQuery): SQL {
  const model = z.array(z.object({ colId: z.string(), sort: z.enum(["asc", "desc"]) })).max(20).parse(JSON.parse(q.sort));
  const f = fields(q);
  const parts = model.map(({ colId, sort }) => {
    if (!Object.hasOwn(f, colId) || (["locRob", "changeLocation"].includes(colId) && q.kind !== "location")) throw new Error(`Unsupported column ${colId}`);
    return sql`${f[colId]} ${sql.raw(sort)}`;
  });
  if (!parts.length) parts.push(q.kind === "history" ? sql`s.timestamp_utc DESC` : q.kind === "inventory" ? sql`s.part_code ASC NULLS LAST` : sql`s.id ASC`);
  return sql`${sql.join([...parts, sql`s.id ASC`], sql`,`)}`;
}
export const from = (q: SparePageQuery) => q.kind === "history"
  ? sql`spares_history s LEFT JOIN spares p ON p.suuid=s.spare_uuid`
  : q.kind === "location" ? sql`spare_location_stock ls JOIN spares s ON s.suuid=ls.spare_uuid JOIN locations l ON l.id=ls.location_id` : sql`spares s`;
export const camel = (row: any): any => Object.fromEntries(Object.entries(row).map(([key, value]) => {
  if (key === "timestamp_utc") return ["timestampUTC", value instanceof Date ? value.toISOString() :
    typeof value === "string" ? new Date(value.replace(" ", "T") + (/Z$|[+-]\d{2}:\d{2}$/.test(value) ? "" : "Z")).toISOString() : value];
  return [key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()), value];
}));
export async function queryPage(vesselId: string, q: SparePageQuery) {
  const db = await getDb(), where = criteria(vesselId, q), order = ordering(q);
  return db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const count = await tx.execute(sql`SELECT count(*)::int AS total FROM ${from(q)} WHERE ${where}`);
    const rows = await tx.execute(sql`SELECT s.* ${q.kind === "history" ? sql`,p.part_number` : q.kind === "location" ? sql`,ls.qty AS location_qty` : sql``}
      FROM ${from(q)} WHERE ${where} ORDER BY ${order} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`);
    const total = Number(count.rows[0].total);
    return { items: rows.rows.map(row => { const item = camel(row); if (q.kind !== "history") item.location2 = item.location2 ?? item.location_2; return item; }),
      total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) };
  });
}
export async function queryValues(vesselId: string, q: SparePageQuery, column: string) {
  const f = fields(q);
  if (!Object.hasOwn(f, column) || (["locRob", "changeLocation"].includes(column) && q.kind !== "location")) throw new Error("Unsupported column");
  const model = JSON.parse(q.filters); delete model[column];
  const db = await getDb();
  const rows = await db.execute(sql`SELECT DISTINCT (${f[column]})::text AS value FROM ${from(q)}
    WHERE ${criteria(vesselId, { ...q, filters: JSON.stringify(model) })} ORDER BY value`);
  return rows.rows.map(r => r.value);
}
export async function queryLocations(vesselId: string, q: SparePageQuery) {
  if (vesselId === "all" || vesselId === "my") throw new Error("Invalid vessel: select one vessel for By Location");
  const db = await getDb();
  const base = sql`WITH grouped AS (SELECT l.id,l.location_name AS "locationName",count(distinct s.id)::int AS "sparesCount"
    FROM spare_location_stock ls JOIN spares s ON s.suuid=ls.spare_uuid JOIN locations l ON l.id=ls.location_id
    WHERE ${scope(vesselId, q)} AND s.deleted=false AND s.is_deleted IS DISTINCT FROM TRUE AND ls.qty>0
      AND l.vessel_id=s.vessel_id AND l.location_name ILIKE ${`%${literal(q.locationSearch)}%`}
    GROUP BY l.id,l.location_name)`;
  return db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const count = await tx.execute(sql`${base} SELECT count(*)::int AS total FROM grouped`);
    const rows = await tx.execute(sql`${base} SELECT * FROM grouped ORDER BY "locationName",id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`);
    const total = Number(count.rows[0].total);
    return { items: rows.rows, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) };
  });
}
