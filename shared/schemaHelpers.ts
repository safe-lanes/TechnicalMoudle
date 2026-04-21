import { timestamp } from "drizzle-orm/pg-core";

/**
 * Standard `updated_at` column.
 *
 * Use this for every new table so that `updated_at` automatically advances
 * to the current timestamp on every UPDATE issued through Drizzle.
 *
 * Equivalent to:
 *   timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date())
 *
 * Residual gaps (NOT covered by this hook):
 *   - Raw SQL UPDATEs via db.execute(sql`UPDATE ...`)
 *   - .onConflictDoUpdate({ set: { ... } }) clauses
 *   - SQL inside server/migrations.ts and migrations/*.sql files
 * For those paths, set `updated_at` explicitly.
 */
export const updatedAtColumn = () =>
  timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());

/**
 * Timezone-aware variant of `updatedAtColumn`.
 *
 * Matches the existing nullable, `with timezone` shape used by a handful of
 * tables (e.g. admin/role tables). Same auto-stamp semantics on UPDATE.
 */
export const updatedAtColumnTz = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date());
