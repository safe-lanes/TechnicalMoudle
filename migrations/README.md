# Migrations — Idempotency Contract

Every migration file in this directory **must be idempotent**: running it a second time must be a clean no-op, never a crash.

## Why?

The migration runner (`server/migrations.ts`) catches some "already exists" errors (`42P07`, `42701`, `42704`) but does **not** catch `42710` (duplicate constraint/index). Non-idempotent migrations will crash the server on boot if the object already exists.

## Required Patterns

### CREATE TABLE / CREATE INDEX
```sql
CREATE TABLE IF NOT EXISTS "table_name" ( ... );
CREATE INDEX IF NOT EXISTS "idx_name" ON "table" ("col");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_name" ON "table" ("col");
```

### ADD COLUMN
```sql
ALTER TABLE "table" ADD COLUMN IF NOT EXISTS "col" type;
```

### ADD CONSTRAINT (FK, UNIQUE, CHECK)
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'constraint_name') THEN
    ALTER TABLE "table" ADD CONSTRAINT "constraint_name" ...;
  END IF;
END $$;
```

### DROP CONSTRAINT
```sql
ALTER TABLE "table" DROP CONSTRAINT IF EXISTS "constraint_name";
```

### CREATE TYPE (ENUM)
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'type_name') THEN
    CREATE TYPE "type_name" AS ENUM(...);
  END IF;
END $$;
```

## Drizzle-Generated Files

Files with `-->  statement-breakpoint` markers are Drizzle-generated. The runner splits on these markers and executes each statement individually. **Never remove or move breakpoint markers.**

## Hand-Written Files

Files with 3-digit prefixes (e.g., `014_fleet_fk_constraints.sql`) are hand-written. They execute as a single batch. Use `DO $$` blocks for conditional DDL.

## Testing Idempotency

After adding a new migration, verify zero non-idempotent patterns remain:

```bash
grep -rn "CREATE TABLE" migrations/*.sql | grep -v "IF NOT EXISTS" | wc -l   # must be 0
grep -rn "CREATE INDEX" migrations/*.sql | grep -v "IF NOT EXISTS" | wc -l   # must be 0
grep -rn "ADD COLUMN" migrations/*.sql | grep -v "IF NOT EXISTS" | wc -l     # must be 0
```

Note: `ADD COLUMN` / `DROP CONSTRAINT` / `CREATE INDEX` inside `DO $$` blocks with proper guards will appear in these counts but are safe — verify manually that the surrounding block provides idempotency.
