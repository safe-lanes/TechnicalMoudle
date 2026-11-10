/**
 * Offline payload/contract tests and staged simulations, NOT PostgreSQL tests.
 * No driver, server, migration entry point or network connection is invoked.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { getTableColumns, getTableName, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
import { v5 } from "uuid";
import { pmsFormGroups, pmsFormCategories, pmsFormsMaster } from "@shared/schema";
import { PMS_FORMS_NAMESPACE } from "../defaults/pmsFormsMasterSeedData";

const fake = vi.hoisted(() => ({
  transaction: vi.fn(), audit: vi.fn(), log: vi.fn(), ship: vi.fn(),
}));
vi.mock("../../../storage", () => ({
  storage: { withFormsMasterTransaction: fake.transaction, createAuditLog: fake.audit },
}));
vi.mock("../../sync/fieldLogger", () => ({ logFieldChanges: fake.log }));
vi.mock("../../sync/syncRole", () => ({ isShipInstance: fake.ship }));
import { seedDefaults } from "../repositories/formsMasterRepository";

type Row = Record<string, string | number | boolean | null>;
type Table = "pms_form_groups" | "pms_form_categories" | "pms_forms_master";
type Catalogue = Record<Table, Row[]>;
const tables: Table[] = ["pms_form_groups", "pms_form_categories", "pms_forms_master"];
const identities: Record<Table, string> = {
  pms_form_groups: "fguuid", pms_form_categories: "fcuuid", pms_forms_master: "fmuuid",
};
const migrationFile = "193_pms_forms_master_defaults.sql";
const migrationId = migrationFile.replace(".sql", "");
const migration = readFileSync(path.resolve("migrations", migrationFile), "utf8");
const runnerSource = readFileSync(path.resolve("server/migrations.ts"), "utf8");
const schemaSource = readFileSync(path.resolve("migrations/192_pms_forms_master.sql"), "utf8");
const repositorySource = readFileSync(path.resolve("server/modules/forms-master/repositories/formsMasterRepository.ts"), "utf8");
const docs = readFileSync(path.resolve("migrations/193_pms_forms_master_defaults.md"), "utf8");

function payload(name: string): Row[] {
  const match = migration.match(new RegExp(`seed_${name} CONSTANT jsonb := \\$${name}\\$\\n([\\s\\S]*?)\\n\\$${name}\\$::jsonb;`));
  if (!match) throw new Error(`Missing static ${name} payload`);
  return JSON.parse(match[1]);
}
const baseline: Catalogue = {
  pms_form_groups: payload("groups"), pms_form_categories: payload("categories"), pms_forms_master: payload("forms"),
};
const empty = (): Catalogue => ({ pms_form_groups: [], pms_form_categories: [], pms_forms_master: [] });
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const snake = (value: string) => value.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`);
const trimSpace = (value: unknown) => String(value).replace(/^ +| +$/g, "").toLowerCase();
const normalizeForm = (value: unknown) => trimSpace(String(value).replace(/[ \t\n\r\f\v]+/g, " "));

/** Staged behavioral model. Source-contract tests below bind its rules to SQL. */
function simulate(current: Catalogue, options: { missing?: Table; failAt?: Table } = {}) {
  const result = clone(current);
  if (options.missing) throw new Error(`P0001 prerequisite missing: public.${options.missing}`);
  for (const table of tables) for (const row of baseline[table]) {
    const identity = identities[table];
    if (result[table].some(existing => existing[identity] === row[identity])) continue;
    const owner = result[table].find(existing => {
      if (existing.seed_key === row.seed_key) return true;
      if (table === "pms_form_groups") return existing.group_code === row.group_code ||
        (!existing.is_deleted && trimSpace(existing.group_name) === trimSpace(row.group_name));
      if (table === "pms_form_categories") return existing.group_uuid === row.group_uuid &&
        (existing.category_no === row.category_no ||
          (!existing.is_deleted && trimSpace(existing.category_name) === trimSpace(row.category_name)));
      return existing.form_id === row.form_id ||
        (!existing.is_deleted && normalizeForm(existing.form_name) === normalizeForm(row.form_name));
    });
    if (owner) throw new Error(`P0001 table=${table} seed_key=${row.seed_key} expected_uuid=${row[identity]} actual_uuid=${owner[identity]}`);
  }
  let inserted = 0;
  for (const table of tables) {
    if (options.failAt === table) throw new Error("simulated constraint failure: staged changes discarded");
    for (const row of baseline[table]) {
      if (!result[table].some(existing => existing[identities[table]] === row[identities[table]])) {
        result[table].push(clone(row));
        inserted++;
      }
    }
  }
  return { result, inserted };
}

beforeEach(() => {
  fake.transaction.mockReset(); fake.audit.mockReset().mockResolvedValue({});
  fake.log.mockReset().mockResolvedValue(1); fake.ship.mockReset().mockResolvedValue(false);
});

describe("migration 193 fixed payload against the actual legacy seeder", () => {
  it("captures all legacy inserts without database access and compares every static field", async () => {
    const captured = empty();
    const tx = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      select: () => ({ from: () => ({ where: async () => [] }) }),
      insert: (table: Parameters<typeof getTableName>[0]) => ({
        values: (row: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              captured[getTableName(table) as Table].push(Object.fromEntries(
                Object.entries(row).map(([key, value]) => [snake(key), value]),
              ) as Row);
              return [row];
            },
          }),
        }),
      }),
    };
    fake.transaction.mockImplementation(async work => work(tx));
    const stats = await seedDefaults();
    expect(captured).toEqual(baseline);
    expect(stats).toEqual({
      groups: { inserted: 7, skipped: 0 }, categories: { inserted: 57, skipped: 0 },
      forms: { inserted: 64, skipped: 0 }, conflicting: 0,
    });
    // These calls belong to the retained LEGACY oracle, not the new SQL path.
    expect(fake.audit).toHaveBeenCalledTimes(128);
    expect(fake.log).toHaveBeenCalledTimes(128);
  });

  it("preserves all UUID-v5 identities, unique keys/codes, ordering and parent links", () => {
    expect(tables.map(table => baseline[table].length)).toEqual([7, 57, 64]);
    for (const table of tables) {
      const rows = baseline[table], identity = identities[table];
      expect(new Set(rows.map(row => row[identity])).size).toBe(rows.length);
      expect(new Set(rows.map(row => row.seed_key)).size).toBe(rows.length);
      for (const row of rows) {
        expect(row[identity]).toBe(v5(String(row.seed_key), PMS_FORMS_NAMESPACE));
        expect(row.is_default).toBe(true);
        expect(row).not.toHaveProperty("id");
        expect(row).not.toHaveProperty("created_at");
        expect(row).not.toHaveProperty("updated_at");
      }
    }
    expect(baseline.pms_form_groups.map(row => [row.group_code, row.display_order]))
      .toEqual(["A", "B", "C", "D", "E", "F", "G"].map((code, index) => [code, index + 1]));
    expect(new Set(baseline.pms_forms_master.map(row => row.form_id)).size).toBe(64);
    for (const row of baseline.pms_form_categories) {
      expect(baseline.pms_form_groups.some(parent => parent.fguuid === row.group_uuid)).toBe(true);
      expect(row.display_order).toBe(row.category_no);
    }
    for (const row of baseline.pms_forms_master) {
      expect(baseline.pms_form_categories.find(parent => parent.fcuuid === row.category_uuid)?.group_uuid).toBe(row.group_uuid);
      expect(row.scope).toBe("fleet"); expect(row.vessel_id).toBeNull();
      expect(row.company_form_name).toBe(row.form_name);
    }
  });

  it("leaves effective omitted-column defaults and generated metadata to migration 192", () => {
    for (const table of [pmsFormGroups, pmsFormCategories, pmsFormsMaster]) {
      const columns = getTableColumns(table);
      expect(columns.isDeleted.default).toBe(false);
      expect(columns.isDefault.default).toBe(false); // SQL payload explicitly supplies true.
      expect(columns.createdAt.hasDefault).toBe(true); expect(columns.updatedAt.hasDefault).toBe(true);
      expect(columns.id.generatedIdentity).toBeDefined();
      expect(columns.createdByUuid.notNull).toBe(false); expect(columns.updatedByUuid.notNull).toBe(false);
      expect(columns.createdByUuid.hasDefault).toBe(false); expect(columns.updatedByUuid.hasDefault).toBe(false);
    }
    const columns = getTableColumns(pmsFormsMaster);
    expect(columns.woPreApproval.default).toBe(false); expect(columns.woPostApproval.default).toBe(false);
    for (const column of [columns.approverRoleRuid, columns.approverRoleLabel]) {
      expect(column.notNull).toBe(false); expect(column.hasDefault).toBe(false);
    }
    expect(schemaSource).toContain("is_deleted BOOLEAN NOT NULL DEFAULT false");
    expect(schemaSource).toContain("wo_pre_approval BOOLEAN NOT NULL DEFAULT false");
    expect(schemaSource).toContain("wo_post_approval BOOLEAN NOT NULL DEFAULT false");
    expect(schemaSource).toContain("created_at TIMESTAMP NOT NULL DEFAULT now()");
    expect(schemaSource).toContain("updated_at TIMESTAMP NOT NULL DEFAULT now()");
  });
});

describe("staged simulation (does not execute PL/pgSQL)", () => {
  it("handles empty, partial and complete catalogues and replay after a history interruption", () => {
    const first = simulate(empty());
    expect(first.inserted).toBe(128);
    expect(simulate(first.result)).toEqual({ result: first.result, inserted: 0 });
    const partial = clone(first.result);
    partial.pms_form_groups.splice(4); partial.pms_form_categories.splice(20); partial.pms_forms_master.splice(30);
    const repaired = simulate(partial);
    expect(repaired.inserted).toBe(74);
    expect(tables.map(table => repaired.result[table].length)).toEqual([7, 57, 64]);
  });

  it("leaves edits, tombstones, company names, approvals, metadata and custom rows untouched", () => {
    const current = clone(baseline);
    for (const table of tables) {
      Object.assign(current[table][0], { is_deleted: true, seed_key: null, created_at: "old", updated_at: "edited",
        display_order: 999, created_by_uuid: "creator", updated_by_uuid: "editor" });
    }
    Object.assign(current.pms_form_groups[0], { group_code: "ZZ", group_name: "Office renamed" });
    Object.assign(current.pms_form_categories[0], { category_name: "Office label", category_no: 99 });
    Object.assign(current.pms_forms_master[0], { company_form_name: "Company choice", wo_pre_approval: true,
      wo_post_approval: true, approver_role_ruid: "role", approver_role_label: "Office" });
    current.pms_forms_master.push({ fmuuid: "custom", seed_key: null, form_id: "CUSTOM", form_name: "Custom" });
    expect(simulate(current)).toEqual({ inserted: 0, result: current });
  });

  const conflictCases: [Table, string, unknown][] = [
    ["pms_form_groups", "group_code", "A"], ["pms_form_groups", "seed_key", "FG-DEF-A"],
    ["pms_form_groups", "group_name", "  MAINTENANCE PLANNING & EXECUTION  "],
    ["pms_form_categories", "seed_key", "FC-DEF-A-01"], ["pms_form_categories", "category_no", 1],
    ["pms_form_categories", "category_name", "  COMPLETION & CLOSEOUT  "],
    ["pms_forms_master", "seed_key", "FM-DEF-001"], ["pms_forms_master", "form_id", "A01-001"],
    ["pms_forms_master", "form_name", "\tMaintenance \nWORK Completion\tReport\r"],
  ];
  it.each(conflictCases)("preflights %s %s collisions with explicit identity diagnostics", (table, key, value) => {
    const current = empty(), original = baseline[table][0], identity = identities[table];
    const owner: Row = { [identity]: "unrelated-uuid", seed_key: "CUSTOM", is_deleted: false,
      group_code: "Z", group_name: "Other", group_uuid: original.group_uuid ?? "other",
      category_no: 999, category_name: "Other", form_id: "CUSTOM", form_name: "Other" };
    owner[key] = value as Row[string]; current[table].push(owner);
    const before = clone(current);
    expect(() => simulate(current)).toThrow(`table=${table} seed_key=${original.seed_key} expected_uuid=${original[identity]} actual_uuid=unrelated-uuid`);
    expect(current).toEqual(before); // even a Forms conflict never commits the earlier Groups.
  });

  it("ignores deleted name-only owners, but deleted code/seed owners still conflict", () => {
    for (const [table, key, value] of conflictCases) {
      const current = empty(), first = baseline[table][0], identity = identities[table];
      const owner: Row = { [identity]: "other", seed_key: null, is_deleted: true, group_code: "Z",
        group_name: "Other", group_uuid: first.group_uuid ?? "other", category_no: 999,
        category_name: "Other", form_id: "CUSTOM", form_name: "Other", [key]: value as Row[string] };
      current[table].push(owner);
      if (key.endsWith("_name")) expect(simulate(current).inserted).toBe(128);
      else expect(() => simulate(current)).toThrow("actual_uuid=other");
    }
  });

  it("uses ordinary-space trim for labels and ASCII collapse for forms, not Unicode normalization", () => {
    expect(trimSpace("\tLabel\t")).not.toBe(trimSpace("Label"));
    expect(normalizeForm("\tName\n \vHere\f")).toBe("name here");
    expect(normalizeForm("Name\u00a0Here")).not.toBe(normalizeForm("Name Here"));
    for (const table of ["pms_form_categories", "pms_forms_master"] as const) {
      const current = empty(), row = clone(baseline[table][0]);
      row[identities[table]] = "custom";
      row.seed_key = "CUSTOM"; row.group_uuid = "different-parent";
      if (table === "pms_forms_master") { row.form_id = "CUSTOM"; row.form_name = "Different"; }
      current[table].push(row);
      expect(simulate(current).inserted).toBe(128);
    }
  });

  it("stages prerequisite and unexpected insert failures without partial changes", () => {
    for (const table of tables) {
      const current = empty();
      expect(() => simulate(current, { missing: table })).toThrow(`prerequisite missing: public.${table}`);
      expect(() => simulate(current, { failAt: table })).toThrow("staged changes discarded");
      expect(current).toEqual(empty());
    }
  });
});

describe("SQL source contracts and operator manifest", () => {
  it("uses one guarded atomic DO, the existing lock, preflight before inserts, and UUID-only skips", () => {
    expect(migration.match(/^DO \$seed\$/gm)).toHaveLength(1);
    expect(migration.trim().endsWith("END $seed$;")).toBe(true);
    expect(migration).not.toContain("--> statement-breakpoint");
    expect(migration).toContain("to_regclass('public.' || prerequisite)");
    expect(migration.indexOf("to_regclass")).toBeLessThan(migration.indexOf("pg_advisory_xact_lock(764192)"));
    const body = migration.slice(migration.indexOf("  candidate jsonb;"));
    const firstInsert = body.indexOf("INSERT INTO");
    expect(body.lastIndexOf("RAISE EXCEPTION")).toBeLessThan(firstInsert);
    expect(body.match(/ERRCODE = 'P0001'/g)).toHaveLength(4);
    expect(body).not.toMatch(/EXCEPTION\s+WHEN/i);
    expect(body).not.toMatch(/\b(UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\s/i);
    expect(body).not.toMatch(/audit_log|field_log|sync_log|isShip|instance_id|uuid_generate|gen_random/i);
    expect(body.match(/ON CONFLICT \((?:fguuid|fcuuid|fmuuid)\) DO NOTHING/g)).toHaveLength(3);
    expect(body.indexOf("INSERT INTO public.pms_form_groups")).toBeLessThan(body.indexOf("INSERT INTO public.pms_form_categories"));
    expect(body.indexOf("INSERT INTO public.pms_form_categories")).toBeLessThan(body.indexOf("INSERT INTO public.pms_forms_master"));
    for (const identity of Object.values(identities)) {
      expect(body).toContain(`WHERE ${identity} = candidate->>'${identity}') THEN CONTINUE`);
    }
    expect(body).toContain("expected_uuid=%s actual_uuid=%s");
    expect(body).toContain("expected_parent=%s expected_number=%s expected_name=%s");
  });

  it("binds collision predicates to legacy rules, including the exact ASCII whitespace expression", () => {
    const body = migration.slice(migration.indexOf("  candidate jsonb;"));
    expect(body).toContain("group_code = candidate->>'group_code' OR seed_key = candidate->>'seed_key'");
    expect(body).toContain("is_deleted = false AND lower(trim(group_name)) = lower(trim(candidate->>'group_name'))");
    expect(body).toContain("group_uuid = candidate->>'group_uuid' AND");
    expect(body).toContain("category_no = (candidate->>'category_no')::integer");
    expect(body).toContain("is_deleted = false AND lower(trim(category_name)) = lower(trim(candidate->>'category_name'))");
    expect(body).toContain("form_id = candidate->>'form_id' OR seed_key = candidate->>'seed_key'");
    const whitespace = "'[ ' || chr(9) || chr(10) || chr(13) || chr(12) || chr(11) || ']+'";
    expect(body.split(whitespace)).toHaveLength(3);
    expect(repositorySource.split(whitespace)).toHaveLength(3);
    expect(body).toContain("lower(trim(regexp_replace(form_name,");
    expect(body).toContain("lower(trim(regexp_replace(candidate->>'form_name',");
  });

  it("inserts every static field into its matching column without supplying generated metadata", () => {
    for (const table of tables) {
      const statement = migration.match(new RegExp(
        `INSERT INTO public\\.${table} \\(([\\s\\S]*?)\\)\\s+VALUES \\(([\\s\\S]*?)\\)\\s+ON CONFLICT`,
      ));
      expect(statement, table).not.toBeNull();
      const columns = statement![1].split(",").map(column => column.trim());
      const expressions = statement![2].split(",").map(expression => expression.trim());
      const keys = expressions.map(expression => expression.match(/candidate->>'(\w+)'/)?.[1]);
      expect(columns).toEqual(keys);
      expect([...columns].sort()).toEqual(Object.keys(baseline[table][0]).sort());
      for (let index = 0; index < columns.length; index++) {
        const value = baseline[table][0][columns[index]];
        const base = `candidate->>'${columns[index]}'`;
        expect(expressions[index]).toBe(typeof value === "number" ? `(${base})::integer`
          : typeof value === "boolean" ? `(${base})::boolean` : base);
      }
    }
  });

  it("publishes every manifest pair in SELECT-only operator SQL, including deleted identities", () => {
    for (const table of tables) for (const row of baseline[table]) {
      expect(docs).toContain(`('${table}', '${row.seed_key}', '${row[identities[table]]}')`);
    }
    const checklist = docs.slice(docs.indexOf("## Read-only operator SQL"));
    const blocks = Array.from(checklist.matchAll(/```sql\n([\s\S]*?)```/g), match => match[1]);
    expect(blocks.length).toBeGreaterThanOrEqual(5);
    for (const block of blocks) {
      expect(block).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|DO|CALL)\b/i);
      expect(block).toMatch(/^\s*(?:--[^\n]*\n\s*)*(SELECT|WITH)\b/);
    }
    expect(checklist).toContain("GROUP BY group_uuid, category_no HAVING count(*) > 1");
    expect(checklist).toContain("c.group_uuid <> f.group_uuid");
    expect(checklist).toContain("count(*) FILTER");
  });
});

describe("actual runner source with fake execution/history only", () => {
  /** Compile just the existing runner/helpers, never import/start the real DB module. */
  function runnerHarness() {
    const parts = [
      runnerSource.slice(runnerSource.indexOf("async function ensureMigrationsTable"), runnerSource.indexOf("/**", runnerSource.indexOf("async function markMigrationComplete"))),
      runnerSource.slice(runnerSource.indexOf("export async function runDrizzleMigrations")),
    ];
    // Use TypeScript AST to isolate functions, rather than include unrelated subsequent code.
    const combined = ts.createSourceFile("runner.ts", parts.join("\n"), ts.ScriptTarget.Latest, true);
    const names = new Set(["ensureMigrationsTable", "getMigrationStatus", "markMigrationComplete", "runDrizzleMigrations"]);
    const functions = combined.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text ?? ""))
      .map(node => node.getText(combined).replace(/^export /, "")).join("\n");
    expect(functions).toContain("async function markMigrationComplete");
    const code = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    const history = new Set<string>();
    let current = empty(), dataExecutions = 0, historyFailure = false, sqlFailure = false;
    const dialect = new PgDialect();
    const db = { execute: async (statement: Parameters<PgDialect["sqlToQuery"]>[0]) => {
      const query = dialect.sqlToQuery(statement);
      if (query.sql.includes("CREATE TABLE IF NOT EXISTS schema_migrations")) return { rows: [] };
      if (query.sql.includes("SELECT id FROM schema_migrations")) return { rows: history.has(String(query.params[0])) ? [{ id: query.params[0] }] : [] };
      if (query.sql.includes("INSERT INTO schema_migrations")) {
        if (historyFailure) { historyFailure = false; throw new Error("simulated interruption"); }
        expect(query.params.slice(0, 3)).toEqual([migrationId, `Drizzle SQL migration: ${migrationFile}`, `Auto-applied from migrations/${migrationFile}`]);
        history.add(String(query.params[0])); return { rows: [] };
      }
      expect(query.sql).toBe(migration);
      dataExecutions++;
      if (sqlFailure) throw Object.assign(new Error("prerequisite/conflict"), { code: "P0001" });
      current = simulate(current).result; return { rows: [] };
    } };
    const fs = { existsSync: () => true, readdirSync: () => [migrationFile], readFileSync: () => migration };
    const logger = { log: vi.fn(), error: vi.fn() };
    const run = new Function("sql", "path", "fs", "resolvePostgres", "drizzle", "schema", "console",
      `${code}\nreturn runDrizzleMigrations;`)(sql, path, fs, async () => ({ db }), () => db, {}, logger) as () => Promise<{ applied: number; skipped: number }>;
    return { run, history, failHistory: () => { historyFailure = true; }, failSql: () => { sqlFailure = true; },
      get dataExecutions() { return dataExecutions; }, get current() { return current; } };
  }

  it("records the exact filename ID once and skips on subsequent tracked runs", async () => {
    const harness = runnerHarness();
    expect(await harness.run()).toEqual({ applied: 1, skipped: 0 });
    expect(harness.history).toEqual(new Set([migrationId]));
    expect(await harness.run()).toEqual({ applied: 0, skipped: 1 });
    expect(harness.dataExecutions).toBe(1);
  });
  it("replays safely when SQL committed but history recording was interrupted", async () => {
    const harness = runnerHarness();
    harness.failHistory();
    await expect(harness.run()).rejects.toThrow("simulated interruption");
    expect(harness.history.size).toBe(0);
    const committed = clone(harness.current);
    expect(await harness.run()).toEqual({ applied: 1, skipped: 0 });
    expect(harness.current).toEqual(committed); expect(harness.dataExecutions).toBe(2);
  });
  it("does not skip-and-ack a P0001 prerequisite or conflict failure", async () => {
    const harness = runnerHarness();
    harness.failSql();
    await expect(harness.run()).rejects.toMatchObject({ code: "P0001" });
    expect(harness.history.size).toBe(0); expect(harness.current).toEqual(empty());
  });
});
