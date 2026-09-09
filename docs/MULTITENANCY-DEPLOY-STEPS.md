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
- **A ship's identity (`instance_id`) is set ONCE and NEVER changed.** Use the same convention everywhere — **`SHIP-<vessel-id>`** (the vessel's `id` column — NOT its `vuuid`). The ship's own setting, the shore `tenant_instances` row, and the ship's stored data must all be the **identical string**. **Changing a live ship's `instance_id` strands all its not-yet-synced changes** — they keep the old tag and never push (the classic "some records sync, others don't"). If it ever must change, re-tag first (see the last troubleshooting row).
- **One vessel = exactly ONE `tenant_instances` row.** Never register the same ship twice under two different ids (e.g. once by name, once by uuid). Two rows for one vessel is the #1 cause of half-synced data. After any registration, verify there is only one row for that vessel.

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
First, get the ship's instance id (run on the **ship's** database) — **copy this exact value; do not retype or "tidy" it:**
```
psql "<ship DATABASE_URL>" -c "SELECT setting_value FROM sync_settings WHERE setting_key='instance_id';"
```
It looks like `SHIP-XXXX`. Register that **exact** value on the **master** database:
```
psql "postgres://postgres:sailadmin@localhost:5432/pms_master" -c "INSERT INTO tenant_instances (instance_id, vessel_id, domain) VALUES ('<ship-instance-id>', '<vessel-uuid>', '<company-domain>') ON CONFLICT (instance_id) DO UPDATE SET vessel_id = EXCLUDED.vessel_id, domain = EXCLUDED.domain;"
```
- `<ship-instance-id>` = the **exact** string from the ship query above (do not swap the name for the uuid or vice-versa).
- `<vessel-uuid>` = the vessel's `vuuid`.

> ⚠️ **This ship is now adopted under that exact id. Do NOT also run PART 3 (Download Provisioning Bundle) for this same ship.** Provisioning registers its *own* id (`SHIP-<vessel code>`); if it differs from the value above you get **two rows for one vessel** and half its data silently stops syncing. PART 3 is for **brand-new** ships only.

**Then verify there is exactly ONE row for this vessel:**
```
psql "postgres://postgres:sailadmin@localhost:5432/pms_master" -c "SELECT instance_id, (sync_api_key IS NOT NULL) AS has_key FROM tenant_instances WHERE vessel_id='<vessel-uuid>';"
```
Must return **one** row, whose `instance_id` matches the ship's setting exactly. (More than one row → remove the wrong one before syncing.)

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

**Step 1 — On the SHIP server**, set its identity in the ship's `.env`. **Use `SHIP-<vessel-id>`** (the vessel's `id` column — NOT its `vuuid`, NOT its name), and this **must be the identical string** the shore registers in Step 2/3:
```
SYNC_INSTANCE_ID=SHIP-<vessel-id>
```
Then restart the ship app: `pm2 restart SAIL-Technical-App`.

> The ship's `SYNC_INSTANCE_ID` and the shore's `tenant_instances.instance_id` **must match byte-for-byte**. If they differ, the ship's sync gets `403` (or its data is filed under the wrong id). Set it **once** and never change it. (Provisioning derives the shore id from the vessel's `id` field — after Step 2, confirm in Step 4 that the created row's `instance_id` equals what you set here; if not, align them before syncing.)

**Step 2 — On the SHORE**, logged in as that company, download the ship's bundle:
- App: **Admin → Sync → Provisioning → select the vessel → Download**.

**Step 3 — On the SHIP**, import that bundle:
- App: **Admin → Sync → Provisioning → Import → choose the downloaded file**.

This automatically: creates the ship's `tenant_instances` row, generates the ship's own sync key, and seeds it on the ship. The new ship is per-tenant from its first sync — **no manual SQL, no tolerance needed.**

**Step 4 — Verify (one row, and it matches the ship):**
```
psql "postgres://postgres:sailadmin@localhost:5432/pms_master" -c "SELECT instance_id, vessel_id, domain, (sync_api_key IS NOT NULL) AS has_key FROM tenant_instances WHERE vessel_id='<vessel-vuuid>';"
```
- Must return **exactly one** row, and its `instance_id` must equal the ship's `SYNC_INSTANCE_ID` from Step 1.
- If two rows appear (e.g. one by uuid + one by name), the ship was double-registered — keep the correct one, delete the other, and make the ship's setting match it, **before** syncing.

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
| **Some records sync, others don't** (RH updates / completed WOs only partly reach office) | The ship's `instance_id` was **changed** at some point; changes made under the OLD id are stranded (the push only sends changes tagged with the ship's CURRENT id) | On the **ship** DB, re-tag the stranded rows to the current id, then sync: `SELECT instance_id, is_synced, COUNT(*) FROM sync_field_log GROUP BY 1,2;` to find the old id, then `UPDATE sync_field_log SET instance_id='<current-id>' WHERE instance_id='<old-id>' AND is_synced=false;` → **Sync Now**. Also remove any duplicate `tenant_instances` row so it can't recur. |
| Two `tenant_instances` rows for one vessel | Ship registered twice under different ids (manual name + provisioning uuid) | Keep the row whose `instance_id` matches the ship's `SYNC_INSTANCE_ID` (and has the key); `DELETE` the other. Ensure the ship never re-registers under a different id. |
| Want to undo everything | — | Remove `MASTER_DATABASE_URL` from `.env`, `pm2 restart SAIL-Technical-App`. |

**Golden rules:** after any `.env` edit → **restart**. `JWT_SECRET` must match SAILERP. One company = one database. New empty DB builds itself on first login. **A ship's `instance_id` is set once, uses `SHIP-<vessel-id>`, matches its shore row exactly, and is NEVER changed. One vessel = one `tenant_instances` row.**
