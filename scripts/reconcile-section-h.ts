/**
 * Operator-reviewed identity mapping only. Never generates historical UUIDs.
 * Usage: npx tsx scripts/reconcile-section-h.ts --inventory
 *        npx tsx scripts/reconcile-section-h.ts --map /private/mapping.json [--apply]
 * Without --apply, this is read-only. Run separately on explicitly authorized targets.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { getPool } from "../server/db";

const mappingSchema = z.array(z.object({
  localId: z.number().int().positive(),
  componentId: z.string().min(1),
  vesselCode: z.string().min(1),
  ccruuid: z.string().uuid(),
  expectedSnapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict());
const businessColumns = [
  "component_id", "component_code", "vessel_code", "classification_society", "survey_type",
  "certificate_number", "issue_date", "expiry_date", "last_class_survey", "next_survey_due",
  "class_requirements", "class_code", "information", "survey_status", "remarks", "is_deleted",
];
export function regulatorySnapshotHash(row: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(businessColumns.map(key => [key, row[key] ?? null]))).digest("hex");
}
export function validateIdentityMap(raw: unknown, rows: Record<string, any>[]) {
  const map = mappingSchema.parse(raw);
  if (new Set(map.map(item => item.localId)).size !== map.length ||
      new Set(map.map(item => item.ccruuid)).size !== map.length) throw new Error("Mapping has duplicate local ids or UUIDs.");
  for (const item of map) {
    const row = rows.find(existing => existing.id === item.localId);
    if (!row || row.component_id !== item.componentId || row.vessel_code !== item.vesselCode ||
        regulatorySnapshotHash(row) !== item.expectedSnapshotSha256) {
      throw new Error(`Mapping snapshot/scope mismatch for local row ${item.localId}; re-review the inventory.`);
    }
    if (row.ccruuid && row.ccruuid !== item.ccruuid) throw new Error("Mapping attempts to change an existing stable UUID.");
    if (rows.some(existing => existing.id !== item.localId && existing.ccruuid === item.ccruuid)) {
      throw new Error("Mapping UUID belongs to another local entry.");
    }
  }
  return map;
}

async function main() {
  const args = process.argv.slice(2);
  const inventory = args.includes("--inventory");
  const mappingIndex = args.indexOf("--map");
  if (!inventory && (mappingIndex < 0 || !args[mappingIndex + 1])) throw new Error("Use --inventory or --map /private/mapping.json [--apply].");
  if (inventory && args.includes("--apply")) throw new Error("Inventory never applies changes.");
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Coordinate with Section H operations and prevent inventory drift while applying.
    await client.query("LOCK TABLE component_class_regulatory IN SHARE ROW EXCLUSIVE MODE");
    const { rows } = await client.query("SELECT * FROM component_class_regulatory ORDER BY id");
    if (inventory) {
      console.log(JSON.stringify(rows.map(row => ({
        localId: row.id, componentId: row.component_id, vesselCode: row.vessel_code,
        ccruuid: row.ccruuid, expectedSnapshotSha256: regulatorySnapshotHash(row),
      })), null, 2));
      await client.query("ROLLBACK");
      return;
    }
    const map = validateIdentityMap(JSON.parse(await readFile(args[mappingIndex + 1], "utf8")), rows);
    if (!args.includes("--apply")) {
      console.log(`Dry run: ${map.length} reviewed mappings valid. No data changed.`);
      await client.query("ROLLBACK");
      return;
    }
    await client.query("SET LOCAL sync.bypass_trigger = 'true'");
    for (const item of map) {
      // Never advance business updated_at or fabricate user edits/field logs.
      await client.query("UPDATE component_class_regulatory SET ccruuid = $1 WHERE id = $2 AND ccruuid IS NULL", [item.ccruuid, item.localId]);
    }
    await client.query("COMMIT");
    console.log(`Applied ${map.length} reviewed mappings. Initial snapshot/checkpoint delivery is still required.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
