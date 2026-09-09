# Multi-Tenancy — Test-Server Deployment & Testing Runbook

**Branch:** `feature/multi-tenancy` (`fa212b2a1`, Phases 0–6) · **Scope:** a SEPARATE shore server + a REAL test ship instance, so the actual `/sync/*` wire, the guard, and per-tenant routing are exercised end-to-end.

Every command, flag, env-var name, and payload below was read from the code on this branch. Items that need a **full environment** (native deps installed) vs. that run **anywhere** are called out explicitly.

---

## 0. Concepts & prerequisites (read once)

**The flag.** Multi-tenant mode is driven by a single env var: **`MASTER_DATABASE_URL`**.
- **Unset** → single-tenant fallback: `getDb()`/`getPool()`/`getPostgresClient()` resolve the legacy `DATABASE_URL` pool; `tenantMiddleware` and `syncTenantGuard` are inert. **Byte-identical to today.** (`tenantConnectionManager.init()` logs `🏠 Single-tenant mode`.)
- **Set** → multi-tenant: the master DB holds the `tenants` + `tenant_instances` registry; every `/technical/api` browser request is routed by the verified JWT `domain`; every server-to-server `/sync/*` protocol call is routed by `X-Sync-Instance-Id` via the master map. (`init()` logs `🏢 Multi-tenant mode ENABLED`.)

**Same-PostgreSQL model.** The master DB and every tenant DB live on the **same** PostgreSQL server; credentials/host come from `MASTER_DATABASE_URL`; only the database **name** varies per tenant (`tenants.database_name`). No per-tenant URL is stored.

**Routing vs. auth (sync).** Shore is the sole authority. It routes purely from the ship's `X-Sync-Instance-Id` → `tenant_instances` map → `domain` → tenant DB. The ship NEVER declares a domain. The per-tenant `X-Sync-Api-Key` is the auth layer, validated **at the master level before any tenant DB is opened**.

**Ship identity.** A ship's instance id is resolved DB-first: `sync_settings.instance_id` → else env `SYNC_INSTANCE_ID` → else `'UNKNOWN'` (`server/modules/sync/syncRole.ts:getEffectiveInstanceId`). **Convention: `SHIP-<vesselCode>`** (e.g. `SHIP-ALWK`). `isShipInstanceId()` = case-insensitive `startsWith('SHIP-')`. Anything else (`SHORE`, `UNKNOWN`) is treated as shore.

### Prerequisites
- **DB access:** superuser/owner on the PostgreSQL server to `CREATE DATABASE` (master) and run migrations.
- **Network:** the test ship must reach the shore server's `/technical/api/sync/*` over HTTP (the ship's `SYNC_SHORE_URL` / `sync_settings.shore_url`).
- **`JWT_SECRET` must equal SAILERP's signing secret** — `tenantMiddleware` verifies the browser Bearer with it. ⚠️ **In multi-tenant mode the server REFUSES to boot if `JWT_SECRET` is unset** (and not dev `AUTH_BYPASS`) — see `server/index.ts:65`.
- **Integrity tooling:** `scripts/verify-data-integrity.ts` requires the `dotenv` package installed **and** a baseline file `docs/data-snapshot-BASELINE.json` (produce it with `npx tsx scripts/data-baseline-snapshot.ts`). The promote gate calls it.

### Env vars that drive everything

| Env var | Where read | Meaning |
|---|---|---|
| `MASTER_DATABASE_URL` | `tenantConnectionManager.init()` | **THE flag.** Set ⇒ multi-tenant; unset ⇒ single-tenant fallback. Master DB + all tenant DBs share its host/creds. |
| `DATABASE_URL` | `postgresClient`/legacy pool | The single/default DB (single-tenant, and the WK DB the promote gate runs against). |
| `JWT_SECRET` | `tenantMiddleware`, boot fail-loud | Verifies the SAILERP browser Bearer → tenant `domain`. Must match SAILERP. |
| `SYNC_API_KEY` | ship `syncEngine`/`fileSyncProcessor`; shore guard (tolerance) | The **legacy shared** sync key. Ship sends it when `sync_settings.sync_api_key` is empty; shore accepts it only under tolerance. |
| `SYNC_LEGACY_KEY_TOLERANCE` | `syncTenantGuard.ts:30` | `'true'` ⇒ a KNOWN instance may auth on the legacy key during migration. **Default OFF.** |
| `AUTH_BYPASS` | `tenantMiddleware`, boot | `'true'` **AND** `NODE_ENV=development` ⇒ skip JWT verify locally. Dev only. |
| `SYNC_INSTANCE_ID` | ship identity fallback | The ship's instance id when `sync_settings.instance_id` is empty. Set to `SHIP-<vesselCode>`. |
| `SYNC_SHORE_URL` | ship engine | Shore base URL the ship syncs to (DB `sync_settings.shore_url` wins). |
| `SYNC_PUSH_BATCH_SIZE` / `SYNC_REQUEST_TIMEOUT_MS` | ship tunables (DB-then-env) | Field-log rows/push (default 1000) and per-push timeout ms (default 30000). Provisioning seeds 200 / 120000. |
| `TENANT_POOL_MAX` / `GLOBAL_MAX_CONNECTIONS` | `tenantConnectionManager` | Per-tenant pool cap (5) and global cap (80). |

---

## Part A — Shore setup (once)

### A1. Provision the master DB + apply master migrations
The master DB holds `tenants` + `tenant_instances`. Migrations under `migrations/master/*.sql` are applied **automatically by `tenantConnectionManager.init()`** at boot when `MASTER_DATABASE_URL` is set (folder-scan, idempotent — `runMasterMigrations`). Files: `0001_tenants.sql`, `0002_tenant_instances.sql`.

```bash
# 1. Create the master DB on the SAME PostgreSQL server as the tenant DB(s):
psql "$ADMIN_PG_URL" -c 'CREATE DATABASE pms_master_test;'
# (ADMIN_PG_URL = a superuser conn string to the 'postgres' DB on that server)
```

The `tenants`/`tenant_instances` tables are created on first shore boot with `MASTER_DATABASE_URL` set (A2 + A3). You do **not** hand-run the master migrations — boot does it.

**✅ Checkpoint:** after the shore boots in A3, `psql <master> -c '\dt'` shows `tenants` and `tenant_instances`.

### A2. Set the shore env vars
On the test **shore** server (exact names):

```bash
export MASTER_DATABASE_URL="postgres://<user>:<pass>@<host>:5432/pms_master_test"
export DATABASE_URL="postgres://<user>:<pass>@<host>:5432/<existing_tenant_db>"   # the DB to adopt as tenant #1
export JWT_SECRET="<the SAILERP signing secret>"        # MUST match SAILERP
export SYNC_API_KEY="<the current legacy shared sync key>"  # only needed for Part C tolerance
# SYNC_LEGACY_KEY_TOLERANCE left UNSET for now (Part C turns it on)
# Do NOT set AUTH_BYPASS on a real test shore (it disables JWT verify).
```

⚠️ Boot will **fail-loud and exit** if `MASTER_DATABASE_URL` is set but `JWT_SECRET` is missing (`server/index.ts:65`). That is intentional — fix the secret, don't bypass.

### A3. Register the test tenant — `promote-to-tenant.ts`
Adopts the existing DB as tenant #1 behind a 3-check gate. **Runs anywhere**, but its integrity check (c) needs `dotenv` + the baseline file (see prereqs) — **so run it on a full environment**.

```bash
# Precondition (once): npx tsx scripts/data-baseline-snapshot.ts   (writes docs/data-snapshot-BASELINE.json)

DATABASE_URL="$DATABASE_URL" MASTER_DATABASE_URL="$MASTER_DATABASE_URL" \
  npx tsx scripts/promote-to-tenant.ts --domain <tenant-domain> --tuid <tenant-tuid>
```
- `--domain` = the tenant's SAILERP domain claim (the routing key). `--tuid` = a tenant uid label.
- **Gate (all must pass, else ABORT, no write):**
  - **(a)** `count(*) FROM defects WHERE id LIKE 'DEF-%'` = 0 — the one-time defect-ID rewrite must not be pending.
  - **(b)** `getPendingMigrations()` empty — the DB is fully migrated (read-only dry-run, applies nothing).
  - **(c)** `verify-data-integrity.ts` prints `ALL DATA INTACT` — run **before** and **after** the write.
- **Write:** one `tenants` row, `database_name = current_database()` (adoption), `ON CONFLICT (domain) DO NOTHING` (idempotent).

**Expected output (pass):**
```
═══════════ WK PROMOTION GATE ═══════════
Adopting DB '<db>' as tenant — domain='...', tuid='...'
✅ (a) defects with id LIKE 'DEF-%' = 0 (must be 0)
✅ (b) pending migrations = 0 (must be 0)
✅ (c) data integrity BEFORE = checked
✅ GATE PASSED — registering tenant…
✅ Registered tenants row (id=…)   [or: already present — idempotent no-op]
✅ data integrity AFTER write = checked
✅ PROMOTE COMPLETE …
```
On any gate failure it prints `❌ ABORT — gate failed — NO write performed` and exits non-zero. **No `tenants` row is written unless all three pass.**

**✅ Checkpoint:** `psql <master> -c "SELECT domain,tuid,database_name FROM tenants;"` shows your row.

### A4. Parity check — `verify-mt-parity.ts` (⚠️ FULL ENVIRONMENT ONLY)
Proves the single-tenant and multi-tenant code paths return identical GET responses against the same data, across 8 modules. **It loads the full module router, which transitively requires the native `sharp` module — it will SKIP cleanly (exit 0, "PARITY SKIPPED") on a box where `sharp`/`dotenv` aren't installed. Run it HERE, on the full test environment, not on a dev laptop.**

```bash
DATABASE_URL="postgres://<user>:<pass>@<host>:5432/<any_db_for_scratch>" \
  npx tsx scripts/verify-mt-parity.ts
```
It creates its own scratch master + scratch tenant DB, migrates the tenant DB (~30–60s), runs Phase ST then Phase MT against the **same** scratch DB, and asserts an empty diff.

**Expected (full env):** `✅ <ep> ST=200 MT=200` per endpoint, then `✅ PARITY PASSED`. **Skip (deps missing):** `⚠️ PARITY SKIPPED …` + exit 0 — re-run where native deps exist.

**Rollback A:** see Part E (unset `MASTER_DATABASE_URL` → byte-identical single-tenant; delete the `tenants` row to de-register).

---

## Part B — Scenario 1: a NEW ship (clean multi-tenant from the start)

A new ship gets its instance id, per-tenant key, and map row **automatically at provisioning**.

### B1. Configure the new ship's identity
On the ship server, set `SYNC_INSTANCE_ID=SHIP-<vesselCode>` (or `sync_settings.instance_id`), matching the vessel's code. This must equal the map key the bundle generates (`SHIP-<vesselCode>`) — see B2.

### B2. Generate the provisioning bundle (shore, authenticated)
The shore admin downloads the bundle for the vessel:
```
GET /technical/api/sync/provision/download/<vesselId>        (requireOfflineAdmin)
```
- This is a **browser** route, behind `tenantMiddleware` in MT mode → the request must carry a **SAILERP Bearer whose `domain` is the tenant's domain**. `tenantMiddleware` stashes that verified domain on the request.
- `generateProvisioningBundle(..., {domain, persist:true})` then:
  - mints/reuses a per-ship key keyed on `SHIP-<vesselCode>`, stores it in `sync_metadata.sync_api_key` (tenant DB), **and writes the `tenant_instances` map row** `SHIP-<vesselCode> → {domain, vesselId, sync_api_key}` (master);
  - embeds the key in `bundle.manifest.syncApiKey`.

⚠️ **The map row is written only if the verified `domain` is present on the generate request.** Authenticate the download with a domain-bearing SAILERP token. (If you generate without it, register the map row manually with `backfill-wk-instances.ts` — Part C2.)

### B3. Import the bundle on the ship
```
POST /technical/api/sync/provision/import      (requireOfflineAdmin)   body: <the downloaded bundle JSON>
```
- `importProvisioningBundle` seeds the ship's `sync_settings`: `sync_api_key` (from `manifest.syncApiKey`), `sync_push_batch_size` (200), `sync_request_timeout_ms` (120000) — via `seedSettingIfEmpty` (no overwrite-if-set). The ship declares **no** domain.

### B4. Verify the new ship syncs to the correct tenant DB
Trigger a sync from the ship (Sync Dashboard → **Sync Now**, or the auto-scheduler). The ship sends `X-Sync-Instance-Id: SHIP-<vesselCode>` + `X-Sync-Api-Key: <per-tenant key>`.

**✅ Assertions:**
1. Shore guard accepts (no 403). On the master, `SELECT * FROM tenant_instances WHERE instance_id='SHIP-<vesselCode>';` shows the row with `sync_api_key`.
2. Pushed rows land in **this tenant's DB only**: `psql <this-tenant-db> -c "SELECT count(*) FROM sync_batches;"` increments; any OTHER tenant DB is unchanged.
3. No `unknown_instance` / `invalid_sync_key` in the shore logs for this ship.

**Rollback B:** delete the ship's `tenant_instances` row (Part E) → its next sync 403s `unknown_instance` (fail-closed); re-import is idempotent (no key rotation).

---

## Part C — Scenario 2: an ALREADY-RUNNING ship (the WK case)

Starting state: the ship runs on the **legacy shared `SYNC_API_KEY`** (its `sync_settings.sync_api_key` is empty → `loadSettings` falls back to env). When the MT code + flag land on shore, that ship still sends the legacy key.

### C1. Confirm the ship's EXACT instance id
On the ship: `SELECT setting_value FROM sync_settings WHERE setting_key='instance_id';` (or the `SYNC_INSTANCE_ID` env). Capture the literal string — e.g. `SHIP-Gas Mia`. **A single character off fails closed at the guard.**

### C2. Backfill the map row + generate the key — `backfill-wk-instances.ts`
Shore-side, **no ship access**. Runs anywhere (only needs `MASTER_DATABASE_URL`).

```bash
MASTER_DATABASE_URL="$MASTER_DATABASE_URL" \
  npx tsx scripts/backfill-wk-instances.ts \
    --domain <tenant-domain> \
    --ship "SHIP-Gas Mia::<vesselUuid>" \
    --ship "SHIP-Frontier Venture::<vesselUuid>" \
    --ship "SHIP-Pioneer Venture::<vesselUuid>"
```
- Each `--ship` is `"<exact instanceId>::<vesselId>"` (separator is `::`; instance ids may contain spaces).
- For each ship it `INSERT … ON CONFLICT (instance_id) DO UPDATE`, **reusing an existing key (never rotating a live one)**, and **prints** the key.

**Expected output:** echoes the exact instance IDs for confirmation, then:
```
✅ tenant_instances rows written (idempotent ON CONFLICT DO UPDATE).
Per-tenant sync keys — apply each ship-side later via PUT /sync/settings {settings:{sync_api_key}}:
  SHIP-Gas Mia
      sync_api_key: <64-hex>   (newly generated)
  …
```
**📋 Capture each printed `sync_api_key`** — you need it in C4.

**✅ Checkpoint:** `SELECT instance_id, domain, sync_api_key FROM tenant_instances;` shows the 3 rows.

### C3. Enable transition tolerance, then flip the flag
On shore, set tolerance ON so the ship keeps syncing on the legacy key after MT turns on:
```bash
export SYNC_LEGACY_KEY_TOLERANCE=true
# (MASTER_DATABASE_URL already set from Part A → MT is on)
```
Restart shore.

**✅ Assertion:** trigger a sync from the running ship (still on the legacy key). Shore logs:
`[syncTenantGuard] LEGACY-KEY TOLERANCE: instance 'SHIP-Gas Mia' authenticated on the shared SYNC_API_KEY…`. Sync succeeds (no 403). Rows land in the correct tenant DB.

> Fail-closed is preserved even with tolerance ON: an **unknown** instance still 403s `unknown_instance`; a known instance with a **bogus** key (neither per-tenant nor legacy) still 403s `invalid_sync_key`.

### C4. Apply the per-tenant key to the ship (when ready)
When you can reach the ship's admin API, set its key (this is the **exact** payload; `requireOfflineAdmin`):
```
PUT /technical/api/sync/settings
Content-Type: application/json
Authorization: Bearer <SAILERP token>          (offline-admin role)
Body: { "settings": { "sync_api_key": "<the 64-hex key printed in C2 for THIS ship>" } }
```
The ship's `loadSettings` now resolves `sync_settings.sync_api_key` first → it sends the **per-tenant** key on the next sync.

**✅ Assertion:** next sync from this ship — shore logs show NO "LEGACY-KEY TOLERANCE" line for it (it matched the per-tenant key directly). Sync still succeeds.

### C5. Tighten — disable tolerance
Once **all** migrated ships are on their per-tenant keys:
```bash
unset SYNC_LEGACY_KEY_TOLERANCE     # (or set =false)
```
Restart shore.

**✅ Assertions:**
- Each migrated ship (per-tenant key) → still syncs (200).
- A ship still on the legacy key → now **403 `invalid_sync_key`** (legacy no longer accepted). Confirm zero rows written for the rejected attempt.

**Rollback C:** set `SYNC_LEGACY_KEY_TOLERANCE=true` again → legacy key accepted for known instances → ship resumes immediately (no outage). To revert a ship to the legacy key entirely, clear its `sync_settings.sync_api_key` (Part E).

---

## Part D — End-to-end verification (both ships / two tenants)

### D1. Automated cross-tenant-write proof (the §7.2 merge gate) — ⚠️ FULL ENV (loads module surface via guard path; uses scratch DBs)
```bash
DATABASE_URL="postgres://<user>:<pass>@<host>:5432/<any_db_for_scratch>" \
  npx tsx scripts/verify-multitenancy-cross-tenant-write.ts
```
Spins up a master + two scratch tenant DBs + three instances, drives the **real HTTP `/sync/*` routes** through the real guard, and asserts on **row counts in both DBs**. Expect `✅ GATE PASSED — no cross-tenant write possible` (cases: correct push lands only in A; unknown instance → 403 zero rows; wrong key → 403 zero rows pre-tenant-DB; instance/batch mismatch → 403; pull isolation; file-chunk validated; flag-off control).

### D2. Real two-ship check (manual)
With two real test ships on two tenants:
1. Snapshot row counts in **both** tenant DBs (`sync_batches`, `sync_field_log`).
2. Push from ship A → **A's DB grows, B's DB unchanged**. Push from ship B → **B grows, A unchanged**.
3. **Pull** from A returns only A's rows (B's are in a different DB — physically unreachable).

### D3. Per-tenant maintenance jobs
The shore Maintenance Orchestrator runs alerts (5m) / health (6h) / pruning (24h) **once per active tenant** in `runInTenantContext`. Confirm shore logs show each task running per tenant; no cross-tenant bleed; a slow tenant doesn't block others (per-(task,tenant) guard).

### D4. Negative test
- Push with an instance NOT in `tenant_instances` → **403 `unknown_instance`**, zero rows in any DB.
- Push with a known instance + wrong key (tolerance OFF) → **403 `invalid_sync_key`**, zero rows.

---

## Part E — Rollback / recovery (per risky step)

**Master escape hatch (always available, byte-identical to today):**
```bash
unset MASTER_DATABASE_URL     # then restart shore
```
→ single-tenant fallback: `tenantMiddleware`/`syncTenantGuard` inert, `getDb` uses the legacy `DATABASE_URL` pool. Production behaves exactly as before MT. **This is the safe back-out for ANY MT step.**

**Remove a bad `tenants` row (de-register a tenant):**
```sql
DELETE FROM tenants WHERE domain = '<domain>';   -- on the master DB
```
(The tenant DB itself is untouched — `promote` only adopts it.)

**Remove a bad `tenant_instances` row (de-register a ship):**
```sql
DELETE FROM tenant_instances WHERE instance_id = 'SHIP-<...>';   -- on the master DB
```
→ that ship's next sync 403s `unknown_instance` (fail-closed). Re-run `backfill-wk-instances.ts` to re-add (idempotent; reuses the existing key if still present).

**Revert a ship to the legacy key:**
- On the ship: `UPDATE sync_settings SET setting_value='' WHERE setting_key='sync_api_key';` (or `PUT /sync/settings` with `""`). The ship falls back to env `SYNC_API_KEY`.
- On shore: ensure `SYNC_LEGACY_KEY_TOLERANCE=true` so the legacy key is accepted again.

**Idempotent (safe to re-run):** `promote-to-tenant.ts` (ON CONFLICT DO NOTHING), `backfill-wk-instances.ts` (ON CONFLICT DO UPDATE, reuses key), master migrations (folder-scan, idempotent), `verify-mt-parity.ts` / cross-tenant harness (scratch DBs, self-cleaning).
**NOT idempotent / one-way to watch:** the env flag flip itself (operational, reversible by unset); applying a NEW key to a ship overwrites the previous (re-apply the correct one to fix).

**Confirm a clean rollback:**
- `tenantConnectionManager.init()` logs `🏠 Single-tenant mode` on boot (flag unset).
- App serves all 8 modules normally; `npx tsx scripts/verify-data-integrity.ts` → `ALL DATA INTACT`.
- No `tenant_*` rows referenced; no `403 unknown_instance/invalid_sync_key` in logs.

---

## Appendix — what needs a FULL environment vs. runs anywhere

| Step | Full env only? | Why |
|---|---|---|
| A3 `promote-to-tenant.ts` | gate check (c) needs **`dotenv` + baseline file** | else integrity (c) fails → gate aborts (fail-closed) |
| A4 `verify-mt-parity.ts` | **Yes** | loads full module router → needs native **`sharp`** (+ dotenv); SKIPs cleanly otherwise |
| D1 cross-tenant proof | runs where pg + node fetch available; tenant lazy-migration needs the schema | uses scratch DBs |
| backfill, guard, env flips, PUT /sync/settings | **anywhere** | only need pg / a running shore |

## Assumptions I could NOT fully verify from code (confirm operationally)
1. **How the operator obtains a domain-bearing SAILERP Bearer** for the authenticated provisioning download (B2) and for browser API tests — depends on SAILERP login; the code only requires `JWT_SECRET` to match. For a pure test you may mint a token signed with the shared `JWT_SECRET` carrying `{ domain, id, userType }`.
2. **The test ship server stand-up** (build/deploy of the ship instance, `SYNC_SHORE_URL`, networking) is outside this branch's code — use the existing ship-deploy scripts and confirm the ship can reach the shore `/sync/*`.
3. **`dotenv` / `sharp` availability** on the test environment — both were absent on the Windows dev box used to build this; confirm they're installed on the test server (npm install with optional deps) before A3/A4.
4. **Exact tenant `domain` / `tuid` values** for the test tenant are operator-chosen; the `domain` must equal the SAILERP `domain` claim the ship's users authenticate with.
