# Provenance of the code-derived Technical documents (R3, 14-Sep-2026)

Repository revision read: `27a40b2ce` (branch feature/chatbot-enterprise). R2 = the 10-Sep originals, preserved unchanged in `R2/`; R3 = corrected sources in `R3/` built by `build_r3.py`. Dispositions: KEPT (evidence supports the R2 wording), NARROWED (wording reduced to what the evidence supports), CORRECTED (wording replaced), REMOVED (claim dropped), ADDED (fact the code establishes that R2 lacked).

| document | sha256 R2 | sha256 R3 |
|---|---|---|
| Technical - Bulk Data Import (Operational) User Manual.docx | ba200e864d3caf26 | bffa8828d516ab84 |
| Technical - Ship-Side (Vessel Crew) Operational Notes.docx | 69857b38989de51b | 0bb3e4225ed74fda |
| Technical - Recent Updates & Changed Behaviours (Operational) Notes.docx | 6a93bd2383064b27 | 3d4a838ae015c06f |
| Technical - Roles & Permissions (Operational) User Manual.docx | 97a3fedab09bf22a | e845a51f00a291ce |
| Technical - Sync (Operational) User Manual.docx | 083e08c13944c1a7 | 25f4a49ef951ccee |

| document | claim (R3 wording, or the R2 claim removed) | disposition | evidence (file:line at the revision above) |
|---|---|---|---|
| Bulk Data Import | Importable types = Machinery Components / Jobs / Spares / Stores / Locations / Rotation Items / History (no 'Work Orders') | CORRECTED | client/src/pages/admin/BulkDataImport.tsx:266-274 |
| Bulk Data Import | Path = PMS → Admin → 'Bulk Data Imp' tab, heading 'Bulk Data Import' | CORRECTED | client/src/components/SideMenuBar.tsx:69; client/src/pages/pms/PMSAdmin.tsx:41,75; client/src/pages/TechnicalModule.tsx:228-229 |
| Bulk Data Import | Vessel dropdown; imports associated with the selected vessel | KEPT | client/src/pages/admin/BulkDataImport.tsx:297-309,393 |
| Bulk Data Import | 'Download Template' button; headings must stay unchanged; .csv/.xls/.xlsx ≤ 20 MB | KEPT | UniformBulkUpload.tsx:758-761,330-338,905-907; server/modules/bulk-upload/routes.ts:14-17,25; validationService.ts:671-680 |
| Bulk Data Import | Vessel Code must match; Component Code must exist | KEPT | server/modules/bulk-upload/services/validationService.ts:658-666,995,1625 |
| Bulk Data Import | R2: 'Job codes must be filled in and unique — blank or duplicate rejected' | REMOVED (wrong) → Job Code optional, auto-generated; duplicates on Job Code + Component Code + Vessel Code | validationService.ts:217,441-443; client/src/pages/admin/JobUpload.tsx:50 |
| Bulk Data Import | Jobs: 'Assigned To' recognised ranks; 'Approver' from Rank Master; Master Data sheet for reference | NARROWED | validationService.ts:1762-1771,448-469,1775-1792; templateService.ts:289-316 |
| Bulk Data Import | Upload area 'Click to upload or drag and drop'; dry-run runs automatically on selection | CORRECTED | UniformBulkUpload.tsx:902-907,342-349,357,382 |
| Bulk Data Import | Dry-run rows ok/warning/error; summary Valid/Warnings/Errors/Total; created/updated/skipped only after import | CORRECTED | UniformBulkUpload.tsx:79-84,1057-1059,978-1007,475; ImportProgressOverlay.tsx:158-161 |
| Bulk Data Import | 'Re-validate' after correcting; warning example (unit set to Hours) | KEPT | UniformBulkUpload.tsx:930-936; validationService.ts:1717-1718 |
| Bulk Data Import | Buttons 'Import N Records' / 'Skip Errors & Import N Valid Rows' / 'Proceed with Partial Import' | CORRECTED | UniformBulkUpload.tsx:1176,1187,1394 |
| Bulk Data Import | Skipped reasons e.g. 'WO already exists' | KEPT | server/modules/bulk-upload/services/importService.ts:1596,1614 |
| Bulk Data Import | 'Import History' (not 'Bulk Import History') | CORRECTED | BulkDataImport.tsx:402; UniformBulkUpload.tsx:774-776,1241; routes.ts:35 |
| Bulk Data Import | No selective re-import; whole-import Undo from Import History | CORRECTED (Undo added — UI dialog exists) | UniformBulkUpload.tsx:1385,200-202,640-642; routes.ts:41 |
| Ship-Side | Only jobs and components deactivated by the office disappear for ship users (spares claim removed — no ship-viewer filter found) | NARROWED | server/modules/jobs/controllers/jobController.ts:9-36; server/modules/components/controllers/componentController.ts:13-20; no match in server/modules/spares |
| Ship-Side | RH reading mandatory; NOT_RH_DRIVEN exempt; per-vessel RH validation switch | NARROWED | workOrderCompletionService.ts:131-141; shared/schema.ts:2379-2381; client/src/pages/pms/rhValidationPolicy.ts:11-18 |
| Ship-Side | R2: 'a lower reading is still saved, counter not reduced' | CORRECTED → lower reading refused; back-dated exception; completion RH ≤ current reading | server/modules/running-hours/services/rhTimelineValidationService.ts:310-311; workOrderCompletionService.ts:146-156,257-265,358-366 |
| Ship-Side | WO number format with vessel code prefix (JOBCODE segment, UWO for unplanned) | CORRECTED | server/utils/workOrderNumbering.ts:7-11,60-86,119-131 |
| Ship-Side | Save Draft; approvals from office; rejected completion returns with remarks; no postponement auto-revert; sync tasks | KEPT | WorkOrderFormPage.tsx:2841-2850,7453; workOrderService.ts:2860-2879; server/routes.ts:687-696; SyncDashboard.tsx:525-551,641-647 |
| Ship-Side | Indicator shows connection, last sync, pending/failed/conflict counts; history on the dashboard | NARROWED | client/src/components/SyncStatusIndicator.tsx:63-139; SyncDashboard.tsx:659-714 |
| Recent Updates | R2: 'Admin: run Sync Masters to populate vessel codes' | REMOVED (wrong) → v_code reaches ships via provisioning only; 'Sync All' does not | docs/SYNC-ARCHITECTURE.md:24-27; shared/syncConfig.ts:1191-1202; client/src/pages/admin/DataMasters.tsx:391,558-575 |
| Recent Updates | WO numbering, legacy fallback, sequence continuity | KEPT | server/utils/workOrderNumbering.ts:7-11,66-81,112-126,156-164 |
| Recent Updates | RH mandatory with NOT_RH_DRIVEN exemption; outcome recorded | NARROWED | workOrderCompletionService.ts:131-142; shared/schema.ts:1399-1403 |
| Recent Updates | RH never decreases; lower direct entry refused; back-dated kept; reset exceptions; date-wins across sync | NARROWED | rhValidation.ts:44-82; rhTimelineValidationService.ts:310-311; docs/SYNC-ARCHITECTURE.md:17-33 |
| Recent Updates | Explicit approve/reject; Save Draft; per-vessel office generation switch; ships ungated; Generate Now | KEPT | workOrderService.ts:1187-1191; shared/schema.ts:1405-1409,2371-2373; workOrderGenerationGate.ts:64-87,119-120,150-162; WorkOrders.tsx:1492-1498 |
| Recent Updates | Only a Sail Admin may run office generation; message names 'Lead Time & Grace Period Settings'; other roles refused | CORRECTED | workOrderGenerationGate.ts:44,141-148,153-161; PmsVesselSettingsManagement.tsx:402,505-511 |
| Recent Updates | Office RH entry switch + explicit reading date required | NARROWED | shared/schema.ts:2375-2377; workOrderCompletionService.ts:192-201,211-218 |
| Recent Updates | Reopen/reject available to Office, PMS Admin, Sail Admin; rejected WO re-computes to Due or Overdue | CORRECTED | work-orders/routes.ts:125-135; workOrderController.ts:636; shared/workOrders/status.ts:253; workOrderBulkService.ts:369,381-382 |
| Recent Updates | Superintendent page scoped to the selected vessel | CORRECTED | client/src/pages/pms/SuperintendentPage.tsx:53-79,367-379 |
| Recent Updates | Superintendent lock switch; postponements no auto-revert; rotational stamp identity | KEPT | shared/schema.ts:2383-2385,375-380,408-422; server/routes.ts:687-694 |
| Recent Updates | Certificates Next Annual / Next Interim; empty shows a dash | NARROWED | shared/schema.ts:3506,3508; client/src/pages/cert-surveys/CertificatesPage.tsx:775,812-813,1001-1003 |
| Recent Updates | Two approval levels enabled per function; approvers maintained separately | CORRECTED | client/src/pages/admin/ApprovalWorkflow.tsx:148,155-156,197-198,626-629; server/routes.ts:361-369; server/postgresStorage.ts:5785,5946-5950 |
| Recent Updates | R3.2 §1.1.14.13 way 1: planned WOs generated from job schedule; ship daily scan, ship-only | ADDED (R3.2) | server/services/jobDueScanner.ts:122-135,163-195 (ship-only, interval scan), :493-535 (creates WOs per due job); PMS manual p18 (Part C frequency/next due), p28 §1.1.5.1 (Scheduled tab) |
| Recent Updates | R3.2 §1.1.14.13 way 1: office 'Generate Now' = Sail Admin AND vessel switch; other roles refused; button on Work Orders screen | ADDED (R3.2) | server/modules/work-orders/services/workOrderGenerationGate.ts:44,64-87,141-161; client/src/pages/pms/WorkOrders.tsx:429,1487-1499; routes.ts:91 |
| Recent Updates | R3.2 §1.1.14.13 way 2: per-job 'Generate WO' (Components Part C, reason Planning/Breakdown/Other, duplicate refused); office condition = vessel switch only (no Sail-Admin-only check on this path); ship always | ADDED (R3.2) | client/src/pages/pms/Components.tsx:916,1016-1018; server/modules/jobs/routes.ts:40; jobService.ts:570-590 (isShipInstance / isOfficeWoGenerationEnabled; reason union type); PMS manual p18 Office / p16 Vessel |
| Recent Updates | R3.2 §1.1.14.13 way 3: unplanned WO via '+ Unplanned W.O', Part A save, Part B submit | ADDED (R3.2) | PMS manual §1.1.5.2 p29 Office / p24 Vessel; client/src/pages/pms/WorkOrders.tsx:1533; WorkOrderFormPage.tsx:82-111 (mode unplanned-create); routes.ts:103 (POST /work-orders) |
| Roles | Role list = Sail Admin, Superintendent, Client Admin, Head of Dept, Vessel, External; 'Admin' → Superintendent; 'Vessel Admin' → Head of Dept | CORRECTED | shared/uiRoles.ts:1-33 |
| Roles | R2: 'Level 2 Reviewer' and 'Vessel Admin' as assignable roles | CORRECTED (R3.1) → Level 2 Reviewer = per-job rank field (PMS manual §1.1.3.5 uses the term); 'Vessel Admin' = profile role treated as Head of Dept (PMS manual §1.1.3.4 uses the term) | shared/uiRoles.ts:32; shared/schema.ts:1204,2578; client/src/pages/pms/JobsFormPage.tsx:1346; workOrderService.ts:1720-1724; work-orders/routes.ts:113-123; workOrderBulkService.ts:143-156,227; official PMS Office manual p11-12 |
| Roles | My Vessel scope | KEPT | client/src/contexts/VesselContext.tsx:13-60; AuthContext.tsx:447 |
| Roles | Me/My Team: PMS Dashboard Operation tab only; shown when not admin scope; WO KPIs only; disabled until hierarchy mapped | CORRECTED | client/src/pages/pms/Dashboard.tsx:477,529-534,636,2836-2876 |
| Roles | R2: 'only HOD' / 'only Vessel Admin' can use the toggle | REMOVED (contradictory) | Dashboard.tsx:2836 (`!isAdminScope`) |
| Roles | Ship users see only active jobs and components | NARROWED | jobController.ts:9-36; componentController.ts:13-20 |
| Roles | R2: 'write actions are permission-checked on the server across the module' | CORRECTED → role checks on specific routes; menu access configuration controls navigation | server/middleware/permissions.ts:16-27,93-127; server/middleware/auth.ts:37,79; fleet/routes.ts:8-18; work-orders/routes.ts:113-135 |
| Roles | Sail Admin full access; admin area incl. per-vessel settings screen name | KEPT/NARROWED | auth.ts:37; permissions.ts:108; PMSAdmin.tsx:41; SideMenuBar.tsx:147; PmsVesselSettingsManagement.tsx:402 |
| Roles | Export on screens that offer it (not 'each screen') | NARROWED | Export buttons in 10 PMS pages (Dashboard, WorkOrders, Components, RunningHours, AnomaliesPage, WorkOrderPlanner, …) |
| Roles | R2: 'HOD can do everything an office user can for their department' | REMOVED (wrong) → Head of Dept: Me/My Team; excluded from postponement approval when no steps configured | client/src/components/PostponeApprovalDialog.tsx:109-113; UIRoleContext.tsx:85; ModifyPMS.tsx:178 |
| Roles | Crew: RH, WOs, spares/stores; Sync Now; Auto-Sync Settings | KEPT | workOrderCompletionService.ts:185-201; SyncDashboard.tsx:525-531,641-647; AutoSyncSettingsCard.tsx:98 |
| Roles | Per-vessel switches on 'Lead Time & Grace Period Settings' incl. RH validation (default on) | CORRECTED | PmsVesselSettingsManagement.tsx:402,617; shared/schema.ts:2371-2385 |
| Sync | Fleet Overview path, screen name, relative times, colours, 60 s auto-refresh | KEPT | SideMenuBar.tsx:142-143; SyncFleetOverview.tsx:7,87-148,199,221,313,407,441-448 |
| Sync | Eye icon opens the Sync Dashboard without passing the vessel; vessel pre-selected only when one exists; activity table has no Files column | CORRECTED | SyncFleetOverview.tsx:477-488,707-714; SyncDashboard.tsx:211-215,439-452,684-690 |
| Sync | R2: 'amber also means changes waiting to go out' | REMOVED (wrong) → stale is time-based only; pending changes separate count | SyncFleetOverview.tsx:134-142,450-457 |
| Sync | Stale card counts >48 h vs badge >24 h (in-code inconsistency, stated) | ADDED | SyncFleetOverview.tsx:136-142,257-262,362 |
| Sync | Sorting = oldest last-sync first, never-synced first; conflicts do not move up | CORRECTED | server/modules/sync/service.ts:1640 |
| Sync | Sync is ship-initiated; auto-sync ship-only when enabled (default true since migration 119), 6 h, 3-min boot delay | CORRECTED | autoSyncScheduler.ts:26-27,263-279; migrations/103_sync_settings_seed.sql:10; migrations/119_sync_settings_defaults_update.sql:8-24; SyncFleetOverview.tsx:242-243 |
| Sync | Sync Now stops at 20 cycles / ~60 s / no progress | CORRECTED | server/modules/sync/syncEngine.ts:62-63,568,595-611; controller.ts:302-305 |
| Sync | Auto-Sync Settings per ship instance; interval effective immediately, next run after one interval | NARROWED | AutoSyncSettingsCard.tsx:20,98,112,127-128; autoSyncScheduler.ts:160-193,285-288; sync/controller.ts:686-690 |
| Sync | Indicator content (Online/Offline, last sync, counts, link); history on dashboard | NARROWED | SyncStatusIndicator.tsx:63-139; SyncDashboard.tsx:659-714 |
| Sync | Field-level merge; same-field: recent wins, conflict recorded; notification to the rejected sender on the office side; none on ship | CORRECTED | shared/syncConfig.ts:6; oneWayApplier.ts:1622-1635; sync/service.ts:411-447 |
| Sync | Dual completion → Sync Conflict Review (menu 'Conflict Review'); one unit; interim later date, tie → ship; red on overview | KEPT | dualCompletionResolver.ts:10-15,89-103; SyncConflictReview.tsx:249,347; SideMenuBar.tsx:97; conflictReviewRepository.ts:742-745,896-899; SyncFleetOverview.tsx:120-125 |
| Sync | RH across sync: latest date wins, tie → ship, never backwards, reset exceptions | KEPT | rhEventComparator.ts:4-17,77-121,200-210,258; oneWayApplier.ts:1077-1086 |
| Sync | 'Sync All' on Admin → Data Masters (shore only); vessel code is the WO prefix | CORRECTED (label) / KEPT (WO prefix, hand-verified) | DataMasters.tsx:558-580; server/modules/misc/routes.ts:32; workOrderNumbering.ts:7-11,60-86 |
| Sync | Vessel master at provisioning only; re-provision from Admin → Ship Provisioning | CORRECTED | shared/syncConfig.ts:1191-1202; SideMenuBar.tsx:98; provisioningService.ts:55,373,851 |
