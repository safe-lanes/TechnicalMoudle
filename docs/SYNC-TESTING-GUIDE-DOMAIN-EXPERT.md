# Ship-Shore Sync — Domain Expert Testing Guide

> **Version:** 1.0  
> **Last Updated:** 2026-04-25  
> **Testers:** Jeevan Naik, Rahul Singh Sisodiya, Sahil Puri  
> **Prerequisites:** Two running servers (shore on port 5000, ship on port 5001) with provisioned data

---

## How to Use This Guide

Each test case follows the same structure:
1. **Setup** — What to do before the test
2. **Shore Action** — What to do on the shore server (port 5000)
3. **Ship Action** — What to do on the ship server (port 5001)
4. **Sync** — Trigger a sync cycle
5. **Verify** — What to check after sync

**Triggering Sync:** Go to **Admin → Sync Dashboard** on the ship server and click **Sync Now**. Or use:
```bash
curl -X POST http://localhost:5001/technical/api/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"vesselId": "YOUR_VESSEL_UUID"}'
```

**Checking Sync Status:** On either server, go to **Admin → Sync Dashboard** to see batch history, pending changes, and conflicts.

---

## Test Case 1: Work Order Sync (Shore → Ship → Shore)

**Owner:** Jeevan Naik  
**Tables tested:** `work_orders` (BOTH_EDITABLE), `work_order_executions` (BOTH_EDITABLE), `work_order_postponements` (BOTH_EDITABLE)

### 1A: Shore Creates Work Order, Ship Receives It

**Shore Action:**
1. Open PMS → Work Orders
2. Note an existing work order OR wait for the `JobDueScanner` to auto-generate one
3. Record the work order number and its current status

**Sync:**
- Trigger sync from ship server

**Ship Verify:**
1. Open PMS → Work Orders on ship
2. Confirm the work order appears with matching status, dates, and assignment
3. Check that the component name and job details match shore

### 1B: Ship Executes Work Order, Shore Receives Update

**Ship Action:**
1. Open PMS → Work Orders on ship
2. Select a pending work order
3. Execute it: add execution details, set status to "Completed", record completion date and running hours

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. Open PMS → Work Orders on shore
2. Find the same work order
3. Confirm status shows "Completed"
4. Confirm execution details (date, running hours, remarks) match what ship entered

### 1C: Shore Postpones Work Order

**Shore Action:**
1. Select a pending work order on shore
2. Postpone it: enter postponement reason, new due date

**Sync:**
- Trigger sync from ship

**Ship Verify:**
1. Open the same work order on ship
2. Confirm it shows as postponed with the reason and new date from shore

---

## Test Case 2: Spare Parts Sync

**Owner:** Jeevan Naik  
**Tables tested:** `spares` (ONE_WAY), `spares_history` (BOTH_EDITABLE), `spare_location_stock` (BOTH_EDITABLE), `inventory_transactions` (BOTH_EDITABLE)

### 2A: Shore Defines Spare, Ship Receives It

**Shore Action:**
1. Open PMS → Spares
2. Add a new spare part to a component (or note an existing one)
3. Record: spare name, part number, minimum stock level

**Sync:**
- Trigger sync from ship

**Ship Verify:**
1. Open PMS → Spares on ship
2. Navigate to the same component
3. Confirm the spare appears with correct name, part number, min stock

### 2B: Ship Updates Spare Stock (ROB), Shore Sees Update

**Ship Action:**
1. Open PMS → Spares on ship
2. Update the ROB (Remaining On Board) quantity for a spare
3. Record: new quantity, which location

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. Open PMS → Spares on shore
2. Check the same spare's stock levels
3. Confirm the ROB quantity matches what ship entered

### 2C: Ship Records Spare Consumption in Work Order

**Ship Action:**
1. When executing a work order on ship, add a spare part consumption entry
2. Record: spare name, quantity consumed

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. Check `spares_history` on shore (via work order execution details)
2. Confirm the consumption entry appears

---

## Test Case 3: Stores Sync

**Owner:** Sahil Puri  
**Tables tested:** `stores_items` (ONE_WAY), `stores_ledger` (BOTH_EDITABLE), `inventory_transactions` (BOTH_EDITABLE)

### 3A: Shore Defines Store Item, Ship Receives It

**Shore Action:**
1. Open PMS → Stores
2. Add a new store item or note an existing one
3. Record: item name, unit, category

**Sync:**
- Trigger sync from ship

**Ship Verify:**
1. Open PMS → Stores on ship
2. Confirm the item appears with correct details

### 3B: Ship Records Store Transaction, Shore Sees It

**Ship Action:**
1. Open PMS → Stores on ship
2. Record an issue or receipt transaction for a store item
3. Record: item, quantity, transaction type

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. Open PMS → Stores on shore
2. Check the stores ledger for the item
3. Confirm the transaction appears with correct quantity and type

---

## Test Case 4: Defect Lifecycle Sync

**Owner:** Rahul Singh Sisodiya  
**Tables tested:** `defects` (BOTH_EDITABLE), `defect_actions` (BOTH_EDITABLE), `defect_attachments` (BOTH_EDITABLE)

### 4A: Ship Reports Defect, Shore Receives It

**Ship Action:**
1. Open Defects → New Defect on ship
2. Create a defect: enter title, description, location, category, priority
3. Record: defect number

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. Open Defects on shore
2. Find the defect by number
3. Confirm all fields match: title, description, location, category, priority, status

### 4B: Shore Adds Action Item, Ship Sees It

**Shore Action:**
1. Open the defect created by ship
2. Add a corrective action item with description and target date

**Sync:**
- Trigger sync from ship

**Ship Verify:**
1. Open the same defect on ship
2. Confirm the action item appears with correct description and date

### 4C: Ship Closes Defect, Shore Receives Status Change

**Ship Action:**
1. On ship, mark the defect as "Closed" with close remarks and date

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. Confirm the defect now shows status "Closed" with close remarks

### 4D: Business Rule — Only Shore Can Verify

**Ship Action:**
1. Try to set a defect status to "Verified" on ship (if UI allows)

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. The defect status on shore should NOT be "Verified"
2. Check sync batch results — the verification attempt should be rejected by the business rule in `service.ts`
3. This validates the rule: only shore can verify defects

---

## Test Case 5: Certificates & Surveys Sync

**Owner:** Rahul Singh Sisodiya  
**Tables tested:** `certificates` (BOTH_EDITABLE), `surveys` (BOTH_EDITABLE), `vessel_certificate_data` (BOTH_EDITABLE), `vessel_survey_data` (BOTH_EDITABLE)

### 5A: Shore Updates Certificate Dates, Ship Receives Them

**Shore Action:**
1. Open Cert & Surveys → Certificates on shore
2. Update a certificate's issue date or expiry date
3. Record: certificate name, old date, new date

**Sync:**
- Trigger sync from ship

**Ship Verify:**
1. Open Cert & Surveys → Certificates on ship
2. Find the same certificate
3. Confirm dates match shore's updates

### 5B: Ship Updates Survey Status, Shore Receives It

**Ship Action:**
1. Open Cert & Surveys → Surveys on ship
2. Update a survey completion date or status
3. Record: survey name, status, date

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. Open Cert & Surveys → Surveys on shore
2. Confirm the survey shows the updated status and date

---

## Test Case 6: Change Request (Modify PMS) Sync

**Owner:** Rahul Singh Sisodiya  
**Tables tested:** `change_request` (BOTH_EDITABLE), `change_request_attachment` (BOTH_EDITABLE), `change_request_comment` (BOTH_EDITABLE)

### 6A: Ship Submits Change Request, Shore Reviews

**Ship Action:**
1. Open PMS → Modify PMS on ship
2. Create a change request: add job, modify interval, add remarks
3. Submit the request

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. Open PMS → Modify PMS on shore (or view as superintendent)
2. Find the change request from ship
3. Confirm all details: requested changes, remarks, status

### 6B: Shore Approves/Rejects, Ship Sees Decision

**Shore Action:**
1. Open the change request
2. Approve or reject it with comments

**Sync:**
- Trigger sync from ship

**Ship Verify:**
1. Open the same change request on ship
2. Confirm the approval/rejection status and shore's comments appear

---

## Test Case 7: Running Hours Sync

**Owner:** Jeevan Naik  
**Tables tested:** `running_hours_audit` (BOTH_EDITABLE), `component_running_hours_log` (BOTH_EDITABLE)

### 7A: Ship Updates Running Hours, Shore Receives Them

**Ship Action:**
1. Open PMS → Running Hours on ship
2. Update running hours for a component (e.g., Main Engine)
3. Record: component name, old hours, new hours, date

**Sync:**
- Trigger sync from ship

**Shore Verify:**
1. Open PMS → Running Hours on shore
2. Find the same component
3. Confirm the running hours match ship's update
4. Check the audit trail shows the ship's entry

---

## Test Case 8: Conflict Scenario

**Owner:** All testers (one person on shore, one on ship)  
**Tables tested:** Any BOTH_EDITABLE table  
**Goal:** Verify conflict detection and resolution

### Setup
- Both servers synced and up-to-date (no pending changes)

### Create a Conflict

**Shore Action (DO NOT SYNC YET):**
1. Open a work order on shore
2. Change the `remarks` field to "Updated by shore team"
3. DO NOT trigger sync yet

**Ship Action (DO NOT SYNC YET):**
1. Open the SAME work order on ship
2. Change the `remarks` field to "Updated by ship crew"
3. DO NOT trigger sync yet

### Sync and Detect

**Ship Action:**
1. Trigger sync from ship

### Verify Conflict

1. Open **Admin → Sync Dashboard** on either server
2. Look at the **Conflicts** section
3. Confirm a conflict exists for: table=`work_orders`, field=`remarks`
4. Verify it shows both values: ship="Updated by ship crew", shore="Updated by shore team"

### Resolve Conflict

1. Choose a resolution:
   - **Ship Wins:** The ship's value is kept
   - **Shore Wins:** The shore's value is kept
   - **Manual:** Enter a custom merged value
2. Click resolve
3. Verify the winning value is now in the `remarks` field on both servers (after next sync)

---

## Test Case 9: Ship Provisioning

**Owner:** Sahil Puri  
**Goal:** Verify a fresh ship can be provisioned from shore data

### On Shore

1. Navigate to **Admin → Ship Provisioning**
2. Select a vessel from the dropdown
3. Click **Preview Manifest**
4. **Verify:** The manifest shows tables and row counts. Key tables to check:
   - `components` — should have rows matching the vessel's component tree
   - `jobs` — should have the vessel's job definitions
   - `spares` — should have spare part records
   - `work_orders` — should have existing work orders
5. Click **Generate & Download**
6. Save the JSON file

### On Ship (Fresh Database)

1. Navigate to **Admin → Ship Provisioning**
2. Click **Import** and upload the JSON file from shore
3. **Verify import results:** check tables imported, rows imported, errors
4. Click **Verify** — should show all tables with matching or higher row counts
5. Navigate to PMS sections and spot-check:
   - Components tree matches shore
   - Jobs are present with correct intervals
   - Work orders exist with correct statuses
   - Spares have correct quantities

---

## Test Case 10: Dashboard Monitoring

**Owner:** All testers  
**Goal:** Verify the Sync Dashboard shows accurate information

### On Ship — Sync Dashboard (`/admin/sync-dashboard`)

1. **Status Section:**
   - Instance ID shows `SHIP-*`
   - Last sync time is shown (or "Never" if first time)
   - Pending changes count is accurate

2. **Sync Now Button:**
   - Click it — sync should start
   - Watch the batch appear in history with status progression
   - After completion, verify counts: records pushed, records pulled, conflicts

3. **Batch History:**
   - Shows recent sync batches
   - Each batch shows: status, duration, records sent/received, conflicts

4. **Conflict Resolution:**
   - If conflicts exist (from Test Case 8), they appear here
   - Resolution options work correctly

### On Shore — Sync Dashboard

1. Same checks as ship
2. Additionally verify you can see batches initiated by ship

---

## Test Case 11: Fleet Sync Overview (Shore Only)

**Owner:** All testers (on shore server only)  
**Goal:** Verify the fleet-wide monitoring dashboard

### On Shore — Fleet Overview (`/admin/sync-fleet`)

1. **Verify Visibility:**
   - This page should be visible in the sidebar on shore server
   - This page should NOT appear in the sidebar on ship server

2. **Summary Cards:**
   - Total vessels count matches the fleet
   - Synced vessels count matches vessels that have synced at least once
   - "Needs Attention" count matches vessels with issues

3. **Vessel Table:**
   - All vessels are listed
   - Each shows: last sync time, status (badge), pending changes, conflicts, pending files
   - Vessels that have never synced show appropriate indicators

4. **Settings Panel:**
   - Expand the settings panel
   - All 10 sync settings are displayed with current values
   - Edit a setting (e.g., change `sync_interval_minutes` to 30)
   - Click Save — confirm the "Settings updated" toast
   - Refresh page — confirm the setting persisted

5. **Test Connection:**
   - Enter the shore URL in the test connection field
   - Click Test — should show "Connected" with latency
   - Enter an invalid URL — should show "Connection failed"

---

## Validation Checklist

After completing all test cases, verify the following end-to-end:

### Data Flow Verification

- [ ] ONE_WAY data flows shore → ship (components, jobs, spares definitions)
- [ ] BOTH_EDITABLE data flows both directions (work orders, defects, certificates)
- [ ] SHIP_ONLY data flows ship → shore (noon reports — if noon report module is active)
- [ ] Field-level changes are tracked in `sync_field_log`
- [ ] Conflicts are detected when both sides edit the same field
- [ ] Conflicts can be resolved via all 3 methods (ship_wins, shore_wins, manual)

### Infrastructure Verification

- [ ] Health check returns `healthy` on both servers
- [ ] Pruning respects safety rules (does not delete unsynced or in-progress data)
- [ ] Settings persist across server restarts (stored in `sync_settings` table)
- [ ] Instance detection works (`useSyncInstanceInfo` hook returns correct values)
- [ ] Fleet Overview is visible on shore, hidden on ship

### Edge Cases

- [ ] Sync works after server restart (checkpoint preserved in `sync_metadata`)
- [ ] Large batch of changes (50+ records) syncs correctly in chunks
- [ ] Empty sync cycle completes without errors (no changes to transfer)
- [ ] Sync with no connectivity fails gracefully with retry messages in logs

---

## Known Limitations

1. **File Sync:** Binary file transfer (work order documents, component documents) is implemented but requires local filesystem storage. Cloud-to-cloud transfer (Object Storage → Object Storage) is not yet implemented.

2. **Automatic Sync:** The `auto_sync_enabled` setting exists but the automatic scheduler is not yet wired up. Sync must be triggered manually via the dashboard or API.

3. **Business Rules:** Currently, only one business rule is implemented (defect verification restricted to shore). Additional rules can be added by updating `businessRules` in `shared/syncConfig.ts`.

4. **Offline Duration:** The system tracks changes via `sync_field_log`. Extremely long offline periods (months) may accumulate large numbers of unsynced entries. The health monitor warns at 100,000 entries.

5. **Concurrent Edits:** The conflict detection is per sync cycle. If the same field is edited multiple times between syncs, only the latest change is compared.

6. **SAILERP Data:** Users, vessels, fleets, and other SAILERP-provisioned tables are NOT synced by the PMS sync engine. They must be managed separately.

7. **Tables Without UUID Identity:** Some BOTH_EDITABLE tables (e.g., `certificates`, `surveys`, `component_documents`, `component_requisitions`, `ihm_items`, `ihm_maintenance_log`) have integer PKs without UUID identity columns. These rely on `ON CONFLICT DO NOTHING` during provisioning instead of upsert.

8. **Vessel Scope Variants:** Most tables use `vessel_id` for vessel scoping, but some use `vessel_code` (e.g., `component_running_hours_log`, `component_maintenance_history`, `component_documents`). The sync engine handles both but testers should verify data appears under the correct vessel.

---

## Test Environment Quick Reference

| Item | Shore | Ship |
|------|-------|------|
| URL | `http://localhost:5000` | `http://localhost:5001` |
| DB | `pms_shore` | `pms_ship` |
| Instance ID | `SHORE-DEV` | `SHIP-TESTVESSEL` |
| Admin Page | Admin → Fleet Overview, Sync Dashboard, Ship Provisioning | Admin → Sync Dashboard, Ship Provisioning |
| Sync Trigger | Via API or Dashboard | Via Dashboard "Sync Now" button |
| Health Check | `GET /technical/api/sync/health` | `GET /technical/api/sync/health` |
| Instance Info | `GET /technical/api/sync/instance-info` | `GET /technical/api/sync/instance-info` |
