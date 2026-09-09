# Multi-Tenancy — Deployment Steps (Nilesh)

Branch `feature/multi-tenancy`. Dev/test server: shore + one WK ship already running single-tenant. SAILERP auth is already in place (JWT handled). Goal: turn on multi-tenancy, keep WK syncing, add a second tenant DB.

> The whole feature is gated by one env var: **`MASTER_DATABASE_URL`**. Set = multi-tenant; unset = back to today (single-tenant). That's also the rollback (bottom).

---

## 1. Shore setup (once)

### 1.1 Create the master DB
```sql
CREATE DATABASE pms_master;     -- on the SAME PostgreSQL server as the tenant DBs
```
*Why:* the master DB holds the `tenants` + `tenant_instances` registry. **The two tables auto-create on shore boot** (no manual migration).

### 1.2 Set shore env vars
```bash
export MASTER_DATABASE_URL="postgres://<user>:<pass>@<host>:5432/pms_master"
export SYNC_API_KEY="<the current shared sync key the WK ship already uses>"
export SYNC_LEGACY_KEY_TOLERANCE=true
```
- `MASTER_DATABASE_URL` — *turns multi-tenancy ON; master + all tenant DBs use its host/creds.*
- `SYNC_API_KEY` — *the existing legacy shared key; shore needs it to accept the WK ship during the bridge (step 2.2).*
- `SYNC_LEGACY_KEY_TOLERANCE=true` — *lets the already-running WK ship keep syncing on the old key until its per-tenant key is applied.*

Restart shore. Log should read `🏢 Multi-tenant mode ENABLED`.

### 1.3 Register the first tenant (WK — adopt the existing DB)
```bash
# one-time precondition: create the integrity baseline the gate checks
npx tsx scripts/data-baseline-snapshot.ts        # writes docs/data-snapshot-BASELINE.json

DATABASE_URL="postgres://<user>:<pass>@<host>:5432/<existing_WK_db>" \
MASTER_DATABASE_URL="$MASTER_DATABASE_URL" \
  npx tsx scripts/promote-to-tenant.ts --domain <wk-domain> --tuid TEN-WK
```
*Why:* adopts the existing WK DB as tenant #1. Gate (all must pass, else aborts with no write): no `DEF-%` defects, zero pending migrations, data integrity intact before+after. Writes one `tenants` row (`database_name` = that DB). Idempotent.
Expect `✅ PROMOTE COMPLETE`. Confirm: `psql pms_master -c "SELECT domain,database_name FROM tenants;"`.

---

## Case A — the already-running WK ship (existing)

### A.1 Backfill its map row + generate its key (shore-side, no ship access)
```bash
MASTER_DATABASE_URL="$MASTER_DATABASE_URL" \
  npx tsx scripts/backfill-wk-instances.ts \
    --domain <wk-domain> \
    --ship "SHIP-Gas Mia::<vesselUuid>"
```
*Why:* registers the ship in the map so shore can route it, and prints a per-tenant key. Use the **exact** instance id from the ship's `sync_settings.instance_id` (format `SHIP-<...>`, may contain spaces; `::` separates the vessel UUID). **Copy the printed `sync_api_key`.**

### A.2 Tolerance is already ON (step 1.2)
*Why:* the WK ship still sends the old shared key; tolerance makes shore accept it → **no sync outage** while you finish migrating. (Shore log shows `LEGACY-KEY TOLERANCE: instance 'SHIP-Gas Mia' authenticated…`.)

### A.3 Apply the per-tenant key to the ship
`PUT /technical/api/sync/settings` (offline-admin; SAILERP auth already in place), body:
```json
{ "settings": { "sync_api_key": "<the key printed in A.1>" } }
```
*Why:* the ship now sends its own per-tenant key instead of the shared one (it auto-prefers the DB value).

### A.4 Turn tolerance OFF (after all ships migrated)
```bash
unset SYNC_LEGACY_KEY_TOLERANCE       # then restart shore
```
*Why:* full per-tenant auth — the old shared key is now rejected. A migrated ship keeps syncing; any ship still on the old key would get 403 (expected).

---

## Case B — add a NEW client DB (e.g. Primeconav) as another tenant

> A brand-new DB is **empty**, so `promote-to-tenant.ts` does **not** apply here (its gate requires zero pending migrations — an empty DB has them all). Register it directly; the schema auto-builds on first use.

### B.1 Create + register
```sql
CREATE DATABASE primeconav;                                   -- on the same PG server
-- on the master DB:
INSERT INTO tenants (domain, tuid, database_name)
VALUES ('<primeconav-domain>', 'TEN-PRIMECONAV', 'primeconav')
ON CONFLICT (domain) DO NOTHING;
```
*Why:* `tenants` maps the SAILERP domain → this DB. **On the first request routed to this domain, shore lazy-runs the full migration suite against the new DB** (schema + seed/reference data) automatically.

### B.2 Confirm
`psql pms_master -c "SELECT domain,database_name FROM tenants;"` shows Primeconav. After the first Primeconav login/request, `psql primeconav -c '\dt'` shows the tables (auto-migrated).

---

## Case C — add a NEW ship server

### C.1 Set the ship's instance id
```bash
export SYNC_INSTANCE_ID="SHIP-<vesselCode>"     # on the new ship server
```
*Why:* this is the ship's identity on the sync wire and the key shore routes on. Convention `SHIP-<vesselCode>`.

### C.2 Provision it (auto-gets key + map row)
- Shore (offline-admin, authenticated with the tenant's domain):
  `GET /technical/api/sync/provision/download/<vesselId>` → download the bundle.
- Ship: `POST /technical/api/sync/provision/import` with that bundle.

*Why:* generating the bundle mints the ship's per-tenant key, writes its `tenant_instances` map row (`SHIP-<vesselCode>` → domain), and ships the key inside the bundle; import seeds it into the ship's `sync_settings`. **No tolerance needed — a new ship is per-tenant from its first sync.**

---

## Rollback (safe back-out for anything)
```bash
unset MASTER_DATABASE_URL       # then restart shore
```
→ single-tenant fallback, **byte-identical to today** (tenant routing + guard go inert). To de-register a tenant/ship: `DELETE FROM tenants WHERE domain='…';` / `DELETE FROM tenant_instances WHERE instance_id='SHIP-…';` on the master DB (tenant DBs are untouched).
