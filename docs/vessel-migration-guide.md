# Vessel Migration Guide

> Reference document for anyone writing future database migrations that involve the `vessels` table or any of the 31 child tables with `vessel_id` foreign keys.

---

## 1. Current Vessels Table Structure

| Column          | Type      | Constraints                        | Description                                    |
|-----------------|-----------|------------------------------------|------------------------------------------------|
| `id`            | INTEGER   | PRIMARY KEY, SERIAL (auto-increment) | Internal database identifier (1, 2, 3...)      |
| `vuuid`         | TEXT      | NOT NULL, UNIQUE                   | Canonical UUID identity column                 |
| `name`          | TEXT      | NOT NULL                           | Vessel display name                            |
| `code`          | TEXT      | NOT NULL                           | Vessel code (independent identifier)           |
| `fleet_id`      | TEXT      | NULLABLE                           | Fleet association                              |
| `imo_number`    | TEXT      | NULLABLE                           | IMO number                                     |
| `vessel_type`   | TEXT      | NULLABLE                           | Type of vessel                                 |
| `flag`          | TEXT      | NULLABLE                           | Flag state                                     |
| `is_active`     | BOOLEAN   | NOT NULL, DEFAULT true             | Active status                                  |
| `vessel_sequence` | INTEGER | NULLABLE                           | Display ordering                               |
| `created_at`    | TIMESTAMP | NOT NULL, DEFAULT now()            | Creation timestamp                             |
| `updated_at`    | TIMESTAMP | NOT NULL, DEFAULT now()            | Last update timestamp                          |

### Key Identity Rules

- **`id` (INTEGER SERIAL)**: Auto-generated internal identifier. Never set manually. Never referenced by any child table.
- **`vuuid` (TEXT UNIQUE)**: The canonical UUID identity. All 31 child tables reference this column via their `vessel_id` foreign key. This is the value used throughout server code and frontend for vessel identification.

---

## 2. All 31 Foreign Key Relationships

Every child table listed below has a `vessel_id` column of type **TEXT** that references `vessels(vuuid)`.

| #  | Child Table                        | Child Column | References     | Constraint Name                                              |
|----|------------------------------------|-------------|----------------|--------------------------------------------------------------|
| 1  | alert_config                       | vessel_id   | vessels(vuuid) | alert_config_vessel_id_vessels_vuuid_fk                      |
| 2  | alert_events                       | vessel_id   | vessels(vuuid) | alert_events_vessel_id_vessels_vuuid_fk                      |
| 3  | certificates                       | vessel_id   | vessels(vuuid) | certificates_vessel_id_vessels_vuuid_fk                      |
| 4  | change_request                     | vessel_id   | vessels(vuuid) | change_request_vessel_id_vessels_vuuid_fk                    |
| 5  | components                         | vessel_id   | vessels(vuuid) | components_vessel_id_vessels_vuuid_fk                        |
| 6  | defect_sequences                   | vessel_id   | vessels(vuuid) | defect_sequences_vessel_id_vessels_vuuid_fk                  |
| 7  | defects                            | vessel_id   | vessels(vuuid) | defects_vessel_id_vessels_vuuid_fk                           |
| 8  | ihm_items                          | vessel_id   | vessels(vuuid) | ihm_items_vessel_id_vessels_vuuid_fk                         |
| 9  | ihm_maintenance_log                | vessel_id   | vessels(vuuid) | ihm_maintenance_log_vessel_id_vessels_vuuid_fk               |
| 10 | import_history                     | vessel_id   | vessels(vuuid) | import_history_vessel_id_vessels_vuuid_fk                    |
| 11 | inventory_transactions             | vessel_id   | vessels(vuuid) | inventory_transactions_vessel_id_vessels_vuuid_fk            |
| 12 | job_component_links                | vessel_id   | vessels(vuuid) | job_component_links_vessel_id_vessels_vuuid_fk               |
| 13 | jobs                               | vessel_id   | vessels(vuuid) | jobs_vessel_id_vessels_vuuid_fk                              |
| 14 | locations                          | vessel_id   | vessels(vuuid) | locations_vessel_id_vessels_vuuid_fk                         |
| 15 | pms_vessel_settings                | vessel_id   | vessels(vuuid) | pms_vessel_settings_vessel_id_vessels_vuuid_fk               |
| 16 | running_hours_audit                | vessel_id   | vessels(vuuid) | running_hours_audit_vessel_id_vessels_vuuid_fk               |
| 17 | spare_component_links              | vessel_id   | vessels(vuuid) | spare_component_links_vessel_id_vessels_vuuid_fk             |
| 18 | spare_location_stock               | vessel_id   | vessels(vuuid) | spare_location_stock_vessel_id_vessels_vuuid_fk              |
| 19 | spares                             | vessel_id   | vessels(vuuid) | spares_vessel_id_vessels_vuuid_fk                            |
| 20 | spares_history                     | vessel_id   | vessels(vuuid) | spares_history_vessel_id_vessels_vuuid_fk                    |
| 21 | stores_items                       | vessel_id   | vessels(vuuid) | stores_items_vessel_id_vessels_vuuid_fk                      |
| 22 | stores_ledger                      | vessel_id   | vessels(vuuid) | stores_ledger_vessel_id_vessels_vuuid_fk                     |
| 23 | surveys                            | vessel_id   | vessels(vuuid) | surveys_vessel_id_vessels_vuuid_fk                           |
| 24 | users                              | vessel_id   | vessels(vuuid) | users_vessel_id_vessels_vuuid_fk                             |
| 25 | vessel_certificate_applicability   | vessel_id   | vessels(vuuid) | vessel_certificate_applicability_vessel_id_vessels_vuuid_fk  |
| 26 | vessel_certificate_data            | vessel_id   | vessels(vuuid) | vessel_certificate_data_vessel_id_vessels_vuuid_fk           |
| 27 | vessel_survey_applicability        | vessel_id   | vessels(vuuid) | vessel_survey_applicability_vessel_id_vessels_vuuid_fk       |
| 28 | vessel_survey_data                 | vessel_id   | vessels(vuuid) | vessel_survey_data_vessel_id_vessels_vuuid_fk                |
| 29 | work_order_execution_details       | vessel_id   | vessels(vuuid) | work_order_execution_details_vessel_id_vessels_vuuid_fk      |
| 30 | work_order_executions              | vessel_id   | vessels(vuuid) | work_order_executions_vessel_id_vessels_vuuid_fk             |
| 31 | work_orders                        | vessel_id   | vessels(vuuid) | work_orders_vessel_id_vessels_vuuid_fk                       |

---

## 3. Critical Rules for Future Vessel Migrations

### 3.1 Never Change the `id` Column Type

The `vessels.id` column is now `INTEGER SERIAL PRIMARY KEY`. Do not change it back to TEXT, UUID, or any other type. Changing primary key column types generates destructive ALTER TABLE statements that break existing data.

### 3.2 Never Change the `vuuid` Column Type

The `vessels.vuuid` column is `TEXT NOT NULL UNIQUE`. All 31 child tables depend on it via foreign keys. Changing its type would require simultaneously migrating all 31 child tables.

### 3.3 Child Tables Reference `vuuid`, Not `id`

All child table `vessel_id` columns are **TEXT** and reference `vessels(vuuid)`. They do **not** reference `vessels(id)`.

When writing queries or migrations involving child tables:
- Use the UUID string value (from `vuuid`) when filtering by `vessel_id`
- Never use the integer `id` value for child table lookups

### 3.4 Adding a New Child Table with `vessel_id`

When creating a new table that needs a vessel reference:

```sql
CREATE TABLE new_table (
    id SERIAL PRIMARY KEY,
    vessel_id TEXT NOT NULL REFERENCES vessels(vuuid),
    -- other columns...
);
```

In Drizzle schema (`shared/schema.ts` or `shared/v2/*/schema.ts`):

```typescript
export const newTable = pgTable("new_table", {
    id: serial("id").primaryKey(),
    vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
    // other columns...
});
```

### 3.5 Adding New Columns to the Vessels Table

Use a dedicated ALTER TABLE migration:

```sql
ALTER TABLE vessels ADD COLUMN new_column TEXT;
```

Update `shared/schema.ts` first, then run `drizzle-kit generate` to create the migration file.

### 3.6 Inserting New Vessels

- **Do NOT supply `id`** — it is auto-generated by the SERIAL sequence
- **Always supply `vuuid`** — it is the canonical UUID identity

```sql
INSERT INTO vessels (vuuid, name, code, is_active)
VALUES ('your-uuid-here', 'Vessel Name', 'vessel-code', true);
-- id will be auto-assigned as the next integer in sequence
```

### 3.7 One Logical Change Per Migration

Follow the project's Drizzle-only migration policy:
- New tables: dedicated migration file
- New columns: ALTER TABLE ADD COLUMN in its own file
- Index changes: separate migration
- Enum updates: isolated migration
- Never combine unrelated changes in one migration

---

## 4. Server-Side Code Patterns

### Querying Vessels by UUID

```typescript
// Correct: use vuuid for UUID lookups
const vessel = await db.select().from(vessels).where(eq(vessels.vuuid, uuidValue));

// Wrong: never use vessels.id for UUID lookups
// const vessel = await db.select().from(vessels).where(eq(vessels.id, uuidValue));
```

### Querying Child Tables by Vessel

```typescript
// Correct: vessel_id in child tables contains the UUID string
const components = await db.select().from(components)
    .where(eq(components.vesselId, vesselUuid));
```

### Creating a Vessel

```typescript
// Correct: omit id (auto-generated), provide vuuid
const newVessel = await db.insert(vessels).values({
    vuuid: generatedUuid,
    name: "Vessel Name",
    code: "vessel-code",
}).returning();
// newVessel[0].id will be an auto-assigned integer
```

### API Response Format

```json
{
    "id": 1,
    "vuuid": "743ef9d1-841a-11ed-aa7c-7003bca91a86",
    "name": "Vessel 1",
    "code": "743ef9d1-841a-11ed-aa7c-7003bca91a86"
}
```

- `id`: Integer (for internal use only)
- `vuuid`: UUID string (canonical identity, used by all child tables and frontend)

---

## 5. Frontend Code Patterns

### Vessel Interface

```typescript
interface Vessel {
    id: string;    // Mapped from vuuid for backward compatibility
    vuuid: string; // Same UUID value
    name: string;
    code: string;
}
```

The frontend maps `vuuid` to `id` (as a string) so that all 30+ page files that reference `vessel.id` continue to work without changes. The UUID value is the same in both fields.

### Vessel Selection

When a vessel is selected in the UI, the UUID from `vuuid` is used as the identity value for all API calls, filtering, and child table queries.

---

## 6. Migration History Reference

| Migration | Description |
|-----------|-------------|
| 0008_daily_havok.sql | Added `vuuid` TEXT column (UNIQUE) to vessels table |
| 0009-0013 | Created FK constraints from all 31 child tables to `vessels(vuuid)` |
| 0014_auto_2026-02-11T08-37-10.sql | Converted `id` from TEXT to INTEGER SERIAL PRIMARY KEY; set `vuuid` NOT NULL |

### Migration 0014 Steps (for reference)

1. Dropped the primary key constraint on old TEXT `id`
2. Dropped the old TEXT `id` column
3. Added new `id` column as `INTEGER SERIAL PRIMARY KEY` (PostgreSQL auto-assigns sequential values to existing rows)
4. Set `vuuid` to `NOT NULL` (was already populated for all rows)

---

## 7. Important Corrections and Notes

- **Child tables were NOT migrated during Phase 4**: The 31 child tables' `vessel_id TEXT` columns and their FK constraints to `vessels(vuuid)` remained completely unchanged. No child table migration was needed because they never referenced `vessels.id` — they always referenced `vessels.vuuid`.
- **Design choice**: Keeping child tables on TEXT UUIDs referencing `vuuid` (rather than migrating to integer FKs referencing `id`) was intentional. It avoids a massive refactor across 31 tables and 149+ files while maintaining full referential integrity.
- **The `vessels.id` integer is for internal database use only**. It is never used as a foreign key by any table. All cross-table vessel relationships use the UUID in `vuuid`.
- **Never use `db:push --force`** for vessel-related schema changes. Always use `drizzle-kit generate` to create proper migration files, following the project's Drizzle-only migration policy.
- **Migration tracking is unified in `schema_migrations`**: Both code-based migrations (001-026) and Drizzle file-based migrations (0000-0014) are tracked in the single `schema_migrations` table. Drizzle migrations are stored with a `drizzle_` prefix (e.g., `drizzle_0014_auto_2026-02-11T08-37-10`). The system reads `migrations/meta/_journal.json` for the ordered list of Drizzle migrations and executes each SQL file statement-by-statement, handling "already exists" errors per-statement. This allows migrations to run correctly on both fresh local databases and existing Replit databases.
