# Local shore + ship test environment

A permanent, reusable two-node environment: a **shore** and a **vessel** that sync with each other
over the network, using the real provisioning and sync code paths — no mocks.

Built for the 2026-07 sync-stack pilot and kept because real vessels cannot be staged: promoting to
production commits all three ships at once, so this pair is the only gate that exists.

---

## Topology

```
   HOST (your machine)                        DOCKER
  ┌───────────────────────────┐              ┌─────────────────────────────────┐
  │ SHORE app     :5000       │◄────────────►│ SHIP app          :5000         │
  │ (npx tsx server/index.ts) │   HTTP over  │  (same build, container :5100)   │
  │                           │   the network│                                 │
  │ Postgres  pms_arch        │              │ Postgres  pms_arch_ship         │
  │ (host DB)                 │              │ (INSIDE the container)          │
  └───────────────────────────┘              └─────────────────────────────────┘
        authoritative side                      ship reaches shore at
        never initiates sync                    http://shore.pilot:5000
```

**Key properties — these are what make it a faithful test, not a simulation:**

- **The ship is genuinely isolated.** It runs its own Postgres inside the container and never gets
  host DB credentials. It talks to shore only over HTTP, exactly like a vessel over VSAT.
  *(Caveat: the host's 5432 is network-reachable from the container via `host-gateway`, which is
  needed to reach shore on 5000. Isolation is by configuration, not by firewall.)*
- **Same build both sides.** Ship vs shore is decided ONLY by `SYNC_INSTANCE_ID`: anything starting
  `SHIP-` is a ship (`server/modules/sync/syncRole.ts`). No separate build, no code branch.
- **Provisioning and sync run through the real API endpoints**, so the run is scriptable and
  exercises the same code a live vessel does.

---

## Bring it up

```bash
bash local-test-env/up.sh              # add --rebuild to force a fresh image
bash local-test-env/provision.sh       # bundle shore -> ship, then sync
```

| | URL |
|---|---|
| SHORE | http://localhost:5000 |
| SHIP | http://localhost:5100 |

**No login.** Standalone mode; you are `Sail Admin`. Landing on `/login` means an env var is
missing (see the domain shim below).

First `up.sh` takes ~10 min (image build + migrations). Later runs are ~2 min.

## Reset to clean

```bash
bash local-test-env/reset.sh           # drops pms_arch, removes the container
```
Only ever touches `pms_arch` / `pms_arch_ship`. **It does not touch the real dev DB `pms`.**

---

## What the scripts do

| Script | Steps |
|---|---|
| `up.sh` | creates `pms_arch` if absent → starts shore (migrations run at boot) → builds the image if absent → runs the container → **sets `sync_settings.shore_url` in the ship's DB** |
| `provision.sh` | `GET /sync/provision/download/<vuuid>` on shore → `POST /sync/provision/import` on ship → `POST /sync/trigger` to drain |
| `reset.sh` | removes container, stops shore, drops the two test DBs |

### Three things that will cost you an hour if you get them wrong

1. **`shore_url` MUST end with `/technical/api`.** Without it the ship hits the SPA catch-all and
   sync dies with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` — an error that names
   neither the setting nor the URL. `up.sh` sets this for you.
2. **`SYNC_INSTANCE_ID` must be `SHIP-` + `vessels.id`, NOT `vuuid`.** Provisioning derives the
   shore-side id from `vessels.id` (`provisioningService.ts:64,93`). A mismatch gives 403s or two
   `tenant_instances` rows for one vessel. Check with:
   `SELECT id, vuuid, (id = vuuid) AS safe FROM vessels WHERE vuuid = '<vuuid>';`
3. **The DB value beats the env value** for `shore_url`, `instance_id` and the sync tunables.
   Editing `.env` and seeing no change usually means the DB row is winning.

---

## Seeding real data

An empty `pms_arch` is a poor test — migration 138 repairs real ROB drift and needs rows to work on.
Load a real vessel's data from the dev DB:

```bash
pg_dump -h localhost -U postgres -d pms --data-only --disable-triggers \
  --exclude-table=schema_migrations --exclude-table=sync_field_log \
  --exclude-table=sync_batches --exclude-table=sync_metadata \
  --exclude-table=sync_conflict_log --exclude-table=sync_conflicts \
  --exclude-table=sync_settings -f /tmp/pms-data.sql
# then TRUNCATE the target tables in pms_arch and restore
```
**Exclude `schema_migrations`** or you import a ledger that disagrees with the schema the runner
just built. **Exclude the `sync_*` runtime tables** so the ship starts from a clean sync slate.

The pilot used **WK Frontier Pilot** (`vuuid 743ef9d1-841a-11ed-aa7c-7003bca91a86`, `id WKFV` →
`SHIP-WKFV`), the only vessel with a full tree: 270 components, 293 jobs, 153 work orders,
1,115 spares. Its `id` was deliberately set to a short code so `id != vuuid`, which exercises the
identity trap in (2) above.

---

## The one deliberate local-only shim

The tenant domain normally comes from the SAILERP JWT. Standalone there is no JWT, so
`getDomain()` (`client/src/hooks/useExternalMasterData.ts`) used to fall back to the hardcoded
tenant `'rsms'` — silently pointing a WK session at the wrong company.

**Double-gated so it cannot leak into dev or production:** it needs BOTH `VITE_APP_ENV=local` AND
an explicit `VITE_LOCAL_PILOT_DOMAIN`. Miss either and behaviour is byte-identical to before.

Server-side no shim is needed: `tenantMiddleware` returns early when `MASTER_DATABASE_URL` is unset
(single-tenant), so the domain is never consulted. Provisioning's `tenant_instances` write is
likewise skipped without a master DB.

---

## Files — permanent vs throwaway

**TRACKED (permanent infrastructure):**

| File | Purpose |
|---|---|
| `local-test-env/Dockerfile.ship` | ship image: Node 22 + Postgres, app and DB in one container |
| `local-test-env/ship-entrypoint.sh` | starts the internal Postgres, creates the DB, launches the app |
| `local-test-env/up.sh` / `provision.sh` / `reset.sh` | lifecycle |
| `local-test-env/.env.shore.example` / `.env.ship.example` | env templates with the gotchas noted inline |
| `docs/LOCAL-TEST-ENVIRONMENT.md` | this file |
| `migrations/preflight/138-preflight.sql` | pre-deploy check, also useful here |

**UNTRACKED (throwaway — do not commit):**

- `local-test-env/bundle.json`, `local-test-env/shore.log` — generated per run
- `scripts/test-*.ts` — the harnesses; deliberately untracked by project convention
- `pilot/evidence/` — one-off logs and exports from the 2026-07 pilot

---

## Known-good baseline (2026-07-26, build `4bc0c0609`)

Provision: 8.2 MB bundle, 10,354 rows, 82 tables, `verified: true`, 0 errors.
Sync: drains to `remainingPush=0 / remainingPull=0`.
Work-order parity: 153 = 153, all displayed-status bands equal.
Auto-sync ticks unprompted on the configured interval and each run records
`Completed` with a real duration.

If a fresh run does not reproduce these, something regressed — investigate before trusting a result.
