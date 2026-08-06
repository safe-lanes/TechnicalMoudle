# Deployment note — Shipskart vessel sync + JIT-only enrolment

**Commits:** `fdeac8852` (sweep no longer enrols users) and `e85a2ed6c` (vessel
resolve-by-IMO, crew rotation at the click, Admin → Sync Vessels).
**Branch:** `replit_dev`. **Migrations: none.** **Config changes: none.**

Deploy is a normal pull + build + `pm2 restart`. Nothing to run afterwards.

---

## What changed, in one paragraph

A vessel used to be *created* on Shipskart, never looked up — so a vessel that already
existed there could not be linked, and a link whose remote row had been deleted stayed
"pushed" with a dead id. Shipskart gave us a lookup on 06-Aug, so we now match by IMO first
and only create when the vessel genuinely does not exist. Separately, users are no longer
enrolled in bulk: a user reaches Shipskart only by opening Purchasing themselves. And crew
rotation (a user moved from one vessel to another) now settles on that user's next click
instead of waiting for a sweep that may be switched off.

---

## DEV — test here first

1. Pull, build, `pm2 restart`.
2. Admin → Shipskart Catalogue. There is a new card, **"Vessels on Shipskart"**.
3. Press **"Check first (changes nothing)"**. This is read-only: it makes no writes and
   creates nothing, it only reports what a real run would do, vessel by vessel.
4. **Read the table before doing anything else.** Expected outcomes:
   - *Already correct* — linked, nothing to do
   - *Would link to the existing Shipskart vessel* — matched by IMO, will be adopted
   - *Would be created on Shipskart* — no vessel with that IMO exists there
   - *Would correct a wrong link* — our stored id is stale
   - *IMO number is not 7 digits* — fix the vessel record; it can be neither looked up nor created
5. Only if the table looks right, press **"Sync vessels now"**. It runs in the background,
   the button shows progress, and the table fills in with the result per vessel.

### ⚠️ Important for dev: dev and production share the SAME Shipskart UAT tenant

A run on dev writes to the tenant production points at. It cannot create duplicate vessels
(it adopts by IMO), but it can add crew mappings there. So: **always press "Check first" and
read the table before pressing Sync.** That is exactly what the preview is for.

### What to test after deploying

- **New user**: a user who has never used Purchasing opens it → they are created on
  Shipskart with the mapped role, and mapped to their vessels.
- **Existing user**: opens Purchasing → no user is created, they go straight in.
- **Crew rotation**: change a user's vessel assignment in the app, have them log in and open
  Purchasing → the old vessel is unlinked and the new one linked, with no sweep running.
- **Unmapped role**: a user whose SAIL role is not mapped is blocked with the usual message —
  and is *not* created on Shipskart.
- **Nobody else gets created.** The hourly sync no longer enrols users at all; it only
  retries users who already tried and failed.

---

## PRODUCTION — after dev sign-off

1. Pull, build, `pm2 restart`. No migration, no config change.
2. Leave the **"Automatic sync to Shipskart"** switch as it is (currently OFF).

### One optional cleanup: the Gas Mia record

Not urgent, and it changes nothing for the client users currently on Gas Mia — those were
attached by Shipskart directly and are unaffected by anything here.

**Background.** There used to be two Gas Mia vessels on the Shipskart tenant: one Shipskart
created (IMO 8767898) and one ours created (IMO 9321225). Sachin deleted ours and moved IMO
9321225 onto his. Our production database still stores the *deleted* vessel's id.

**Effect if left alone:** the client's existing users keep working exactly as now. But a
*new* user assigned to Gas Mia would fail to link, because we would send Shipskart the id of
a vessel that no longer exists.

**When to do it:** before the first new user needs Gas Mia. Run on the production Technical DB:

```sql
-- 1. find the vuuid
SELECT vuuid, name, imo_number FROM vessels WHERE name ILIKE '%gas mia%';

-- 2. forget the deleted vessel, so it is looked up fresh
DELETE FROM shipskart_vessel_links WHERE vessel_vuuid = '<gas-mia-vuuid>';

-- 3. let the crew links be remade against the surviving vessel
UPDATE master_user_vessels
   SET shipskart_mapping_id = NULL, map_status = 'pending'
 WHERE vessel_id = '<gas-mia-vuuid>';
```

Then either press **Sync vessels now**, or simply let the next Gas Mia user open Purchasing.
Either way the vessel is matched on IMO 9321225, linked to Shipskart's record, and the crew
links are recreated there. **No new Gas Mia is created** — that is the whole point of the
lookup.

---

## Rollback

Revert the two commits and restart. There is no schema change, so nothing to undo in the
database. Links already written stay valid — they hold Shipskart's real vessel ids.

## Known leftovers on the Shipskart UAT tenant (for Sachin, not blocking)

- Two vessel-user mappings still pointing at the deleted Gas Mia `1b7bf5ab`:
  `38dbb515-eae9-4306-9073-0cf8c7f1dfb1`, `fb316806-660f-4a71-adc2-db2da8db1a72`
- Vessels whose IMO their duplicate check suffixed and which can never be matched again:
  `9290294-1`, `7656723`, `7656723-1`, `7656723-2`, plus `b645d939` (IMO 9999998)
- Test users: `harness-jit-1786013124908@…`, `harness-jit-1786036883648@safelanes-test.example.com`
