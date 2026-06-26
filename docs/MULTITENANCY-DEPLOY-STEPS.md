# Multi-Tenancy — Simple Deployment Steps (Support Guide)

Plain, copy-paste steps for the **test server**. Examples use the test-server values:
database server `postgres://postgres:sailadmin@localhost:5432`, app folder `C:\GitHub\technical_build`,
PM2 app name **`SAIL-Technical-App`**. Run SQL with `psql` (comes with PostgreSQL) or pgAdmin.

---

## Things to know first (read once)

- **ON/OFF switch** = the `MASTER_DATABASE_URL` line in the shore `.env`.
  Set = multi-tenant ON. Removed/blank = back to normal single-company. (This is also the instant rollback.)
- **One company = one database.** A small registry database (`pms_master`) maps each company's
  login **domain** → its database. Its two tables (`tenants`, `tenant_instances`) are **created automatically**
  the first time the app starts with `MASTER_DATABASE_URL` set.
- **After ANY `.env` change you MUST restart:** `pm2 restart SAIL-Technical-App`.
- **`JWT_SECRET` must be the EXACT same value as the SAILERP login server.**
  Wrong value → every login shows **"Access Denied / Invalid authorization token"**.
- After a change, confirm in the log: `pm2 logs SAIL-Technical-App --lines 50` → look for `🏢 Multi-tenant mode ENABLED`.

---

## PART 1 — Make an already-running shore + ship multi-tenant (one-time)

The shore is running normally on one database (`pms_arch`). This switches it to multi-tenant **without losing that data**.

**Step 1 — Create the registry database:**
```
psql "postgres://postgres:sailadmin@localhost:5432/postgres" -c "CREATE DATABASE pms_master;"
```

**Step 2 — Edit the shore `.env` (`C:\GitHub\technical_build\.env`).** Set these lines:
```
MASTER_DATABASE_URL="postgres://postgres:sailadmin@localhost:5432/pms_master"
JWT_SECRET=<EXACT same value as the SAILERP server>
SYNC_API_KEY=<the shared sync key the existing ship already uses>
SYNC_LEGACY_KEY_TOLERANCE=true
```
Leave `DATABASE_URL` pointing at the existing database (`...pms_arch`) — that becomes the first company.
- `MASTER_DATABASE_URL` → turns multi-tenant ON.
- `JWT_SECRET` → must match SAILERP, or every login fails.
- `SYNC_API_KEY` + `SYNC_LEGACY_KEY_TOLERANCE=true` → lets the **already-running ship keep syncing** on its current key (no ship change needed yet).

**Step 3 — Restart and confirm:**
```
pm2 restart SAIL-Technical-App
pm2 logs SAIL-Technical-App --lines 50
```
Must show `🏢 Multi-tenant mode ENABLED`. (If it shows `🏠 Single-tenant mode` or `Master DB init failed` → `MASTER_DATABASE_URL` is wrong; fix and restart.)

**Step 4 — Register the existing company as the first tenant** (its DB is `pms_arch`):
```
psql "postgres://postgres:sailadmin@localhost:5432/pms_master" -c "INSERT INTO tenants (domain, tuid, database_name) VALUES ('<company-domain>', 'TEN-<short-code>', 'pms_arch') ON CONFLICT (domain) DO NOTHING;"
```
- `<company-domain>` = the company's SAILERP login domain.
- `TEN-<short-code>` = any short label, e.g. `TEN-WK`.

**Step 5 — Register the existing ship so the shore recognizes it.**
First, get the ship's instance id (run on the **ship's** database):
```
psql "<ship DATABASE_URL>" -c "SELECT setting_value FROM sync_settings WHERE setting_key='instance_id';"
```
It looks like `SHIP-XXXX`. Then on the **master** database:
```
psql "postgres://postgres:sailadmin@localhost:5432/pms_master" -c "INSERT INTO tenant_instances (instance_id, vessel_id, domain) VALUES ('<ship-instance-id>', '<vessel-uuid>', '<company-domain>') ON CONFLICT (instance_id) DO UPDATE SET vessel_id = EXCLUDED.vessel_id, domain = EXCLUDED.domain;"
```

**Step 6 — Verify:**
- Log into the app with that company's domain → loads normally (no "Access Denied").
- On the ship: Sync Dashboard → **Sync Now** → completes successfully.

**Rollback (anytime):** remove the `MASTER_DATABASE_URL` line from `.env`, then `pm2 restart SAIL-Technical-App`. The shore is back exactly as before.

> Optional, later: to move the existing ship off the shared key onto its own key, see **PART 4**.

---

## PART 2 — Add a NEW company (tenant) to an already-running multi-tenant shore

Use this for a brand-new, **empty** company database (e.g. "epic"). No restart needed.

**Step 1 — Create the company's database:**
```
psql "postgres://postgres:sailadmin@localhost:5432/postgres" -c "CREATE DATABASE pms_epic;"
```
(Use a clear name: `pms_<company>`.)

**Step 2 — Register it** (replace `epic` with the company's SAILERP domain, and `pms_epic` with the DB name):
```
psql "postgres://postgres:sailadmin@localhost:5432/pms_master" -c "INSERT INTO tenants (domain, tuid, database_name) VALUES ('epic', 'TEN-EP', 'pms_epic') ON CONFLICT (domain) DO NOTHING;"
```

**Step 3 — First login builds the tables automatically.**
Log into the app with that company's domain. **The first request takes ~30–60 seconds** while it
builds all tables + seed data in the new database. Wait for it (refresh once after a minute if needed).

**Step 4 — Verify:**
```
psql "postgres://postgres:sailadmin@localhost:5432/pms_epic" -c "\dt"
```
You should see many tables. The company can now use the app. (Add its ships with **PART 3**.)

> ⚠️ Only use PART 2 for a **brand-new empty** database. An existing, already-filled database is adopted like PART 1 Step 4 (register the row pointing at that existing DB — do **not** create a new empty one).

---

## PART 3 — Add a NEW ship to a company

A new ship gets its identity, sync key, and registry entry **automatically** via provisioning.

**Step 1 — On the SHIP server**, set its identity in the ship's `.env` (use the vessel's code):
```
SYNC_INSTANCE_ID=SHIP-<vesselcode>
```
Then restart the ship app: `pm2 restart SAIL-Technical-App`.

**Step 2 — On the SHORE**, logged in as that company, download the ship's bundle:
- App: **Admin → Sync → Provisioning → select the vessel → Download**.

**Step 3 — On the SHIP**, import that bundle:
- App: **Admin → Sync → Provisioning → Import → choose the downloaded file**.

This automatically: creates the ship's `tenant_instances` row, generates the ship's own sync key, and seeds it on the ship. The new ship is per-tenant from its first sync — **no manual SQL, no tolerance needed.**

**Step 4 — Verify:**
```
psql "postgres://postgres:sailadmin@localhost:5432/pms_master" -c "SELECT instance_id, vessel_id, domain FROM tenant_instances WHERE instance_id='SHIP-<vesselcode>';"
```
Then on the ship: Sync Dashboard → **Sync Now** → it should succeed and appear on the shore under that company.

---

## PART 4 (optional, later) — Move the existing ship onto its own per-tenant key, then lock down

Do this only after PART 1 is stable. It removes the shared-key bridge.

**Step 1 — Pick a strong key** (any random 32+ char hex string), e.g. generate one and keep it safe.

**Step 2 — Store it on the master row for that ship:**
```
psql "postgres://postgres:sailadmin@localhost:5432/pms_master" -c "UPDATE tenant_instances SET sync_api_key='<the-key>' WHERE instance_id='<ship-instance-id>';"
```

**Step 3 — Set the same key on the ship** (in the app, logged in as offline admin on the ship):
`PUT /technical/api/sync/settings` with body:
```json
{ "settings": { "sync_api_key": "<the-key>" } }
```
(Or via the ship's database: `UPDATE sync_settings SET setting_value='<the-key>' WHERE setting_key='sync_api_key';` then the ship picks it up on next sync.)

**Step 4 — Once ALL ships are moved to their own keys**, turn off the bridge in the shore `.env`:
```
SYNC_LEGACY_KEY_TOLERANCE=false
```
Then `pm2 restart SAIL-Technical-App`. From now on only per-tenant keys are accepted (shared key rejected).

---

## Quick troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| **"Access Denied / Invalid authorization token"** on every page after enabling MT | Shore `JWT_SECRET` ≠ SAILERP's | Set `JWT_SECRET` to the EXACT SAILERP value, **restart**. |
| Boot log shows `🏠 Single-tenant mode` though `MASTER_DATABASE_URL` is set | App not restarted, or master DB unreachable | Check the URL/creds, then `pm2 restart SAIL-Technical-App`. |
| New company logs in but **no tables / errors** | Tenant not registered, or first-login migration didn't run | Confirm the `tenants` row exists; log in again and wait ~60s; check `pms_<co>` with `\dt`. |
| Ship sync gets **403** after enabling MT | Ship not in `tenant_instances`, or shared key not accepted | Register the ship (PART 1 Step 5); ensure `SYNC_API_KEY` is set on shore and `SYNC_LEGACY_KEY_TOLERANCE=true`. |
| Want to undo everything | — | Remove `MASTER_DATABASE_URL` from `.env`, `pm2 restart SAIL-Technical-App`. |

**Golden rules:** after any `.env` edit → **restart**. `JWT_SECRET` must match SAILERP. One company = one database. New empty DB builds itself on first login.
