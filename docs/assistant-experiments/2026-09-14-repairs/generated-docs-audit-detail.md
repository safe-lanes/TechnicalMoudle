# Generated Technical documents — per-claim audit tables (14-Sep-2026)

Produced by three read-only audit agents over the repository (server/, client/src/, shared/, docs/);
file:line references are to `feature/chatbot-enterprise` at commit 9c16594da. Summary and the one
hand-corrected verdict are in `generated-docs-audit.md`.

## 1. Technical - Bulk Data Import (Operational) User Manual

| Claim | Verdict | Evidence |
|---|---|---|
| Bulk import loads Components, Spares, Stores, Jobs, Work Orders from a spreadsheet | PARTLY | Template list is Machinery Components / Jobs / Spares / Stores / Locations / Rotation Items / History — `client/src/pages/admin/BulkDataImport.tsx:266-274`; no "Work Orders" template (only `wo-history`) |
| Safe pattern: download template → fill → upload → run the dry-run → review → import → confirm | PARTLY | Stages exist, but the dry-run fires automatically on file selection (`client/src/components/admin/UniformBulkUpload.tsx:342-349`, `:357`, POST `/technical/api/bulk/dry-run` `:382`); no separate confirm step after import |
| Menu path "Admin → Bulk Data Import" | PARTLY | Lives under PMS → Admin as tab "Bulk Data Imp" (heading "Bulk Data Import") — `SideMenuBar.tsx:69`, `TechnicalModule.tsx:228-229`, `pms/PMSAdmin.tsx:41`, `:75`; the standalone Admin submodule (`SideMenuBar.tsx:88-98`) has no such entry |
| Select the Vessel from a dropdown; import is per vessel | SUPPORTED | `BulkDataImport.tsx:297-309`, `:393` |
| Choose the data type / template | SUPPORTED | `BulkDataImport.tsx:326-362`, `:266-274` |
| Click "Download Template" | SUPPORTED | `UniformBulkUpload.tsx:758-761`; `server/modules/bulk-upload/routes.ts:25` |
| Keep column headings unchanged | SUPPORTED | `validationService.ts:671-680`, `:658-666`; `shared/bulkImportTemplateFields.ts:29-60` |
| Save as Excel/CSV | SUPPORTED | `UniformBulkUpload.tsx:330-338`, `:905-907`; `routes.ts:14-17` (20 MB) |
| Vessel Code must match the selected vessel | SUPPORTED | `validationService.ts:658-666`; `bulkImportTemplateFields.ts:51` |
| Component Code must exist for the vessel | SUPPORTED | `validationService.ts:995`, `:1625`, `:683-700` |
| Job rank fields must use the template's rank list | PARTLY | Template ships a rank sheet (`templateService.ts:289-316`), but validated columns are Assigned To (`validationService.ts:1762-1771`) and Approver against the live Rank Master (`:448-469`, `:1775-1792`) |
| Job codes must be filled in and unique; blank/duplicate rejected | UNSUPPORTED (contradicted) | Job Code optional and auto-generated: `validationService.ts:217`, `:441-443`; `JobUpload.tsx:50` ("Job codes auto-generated as JOB-XXXXXXX"); duplicates checked on Job Code + Component Code + Vessel Code |
| Click "Choose File / Upload" | PARTLY | Drop zone reads "Click to upload or drag and drop" (`UniformBulkUpload.tsx:902-907`); only a tab named "Upload" (`:766-768`) |
| Confirm data type and vessel match your file | SUPPORTED | `BulkDataImport.tsx:297-309`, `:388-394`; `validationService.ts:662` |
| File is read and validated before anything is saved | SUPPORTED | `UniformBulkUpload.tsx:342-349`; `routes.ts:29` vs `:30`; `dryRunCache.ts:3` |
| Dry-run writes nothing | SUPPORTED | `dryRunCache.ts:3-11`; writes only in `POST /bulk/import` (`routes.ts:30-31`) |
| Dry-run reports per row created/updated/skipped/error | PARTLY | Per-row dry-run status is ok / warning / error (`UniformBulkUpload.tsx:79-84`, `:1057-1059`); created/updated/skipped only after import (`:475`, `ImportProgressOverlay.tsx:158-161`) |
| Summary shows Created / Updated / Skipped | PARTLY | Dry-run summary is Valid / Warnings / Errors / Total (`:978-1007`); post-import summary has the counts (`ImportSummaryModal.tsx:227-275`) |
| Skipped rows carry a reason | SUPPORTED | `importService.ts:1614`, `:1596` |
| Error examples and fix-and-re-upload guidance | SUPPORTED | `validationService.ts:995`, `:674`, `:1778`; `UniformBulkUpload.tsx:1385` |
| Warnings import but need attention | SUPPORTED | `UniformBulkUpload.tsx:991`, `:596-597`; `validationService.ts:1717-1718` |
| Re-run the dry-run until clean | SUPPORTED | `UniformBulkUpload.tsx:930-936`, `:398-409` |
| Choose "Import" (or "Import valid rows") | PARTLY | Labels are "Import {n} Records" (`:1176`), "Skip Errors & Import {n} Valid Rows" (`:1187`), "Proceed with Partial Import" (`:1394`) |
| Final summary of created/updated/skipped | SUPPORTED | `ImportProgressOverlay.tsx:140-165`; `ImportSummaryModal.tsx:51`, `:227-275` |
| Open the relevant screen to confirm | SUPPORTED | `MachineryComponentUpload.tsx:15-18`; `cacheInvalidation.ts` via `UniformBulkUpload.tsx:60` |
| Check "Bulk Import History" | PARTLY | Labelled "Import History" (`BulkDataImport.tsx:402`, `UniformBulkUpload.tsx:774-776`, `:1241`; `routes.ts:35`) |
| Re-import only the failed rows | PARTLY | Guidance is fix the file and re-upload (`:1385`); no selective re-import; whole-import Undo exists (`routes.ts:41`) |

SUPPORTED 13 · PARTLY 10 · UNSUPPORTED 1.

## 2. Technical - Ship-Side (Vessel Crew) Operational Notes

| Claim | Verdict | Evidence |
|---|---|---|
| Ship runs its own local copy; works with no internet | SUPPORTED | `isShipInstance()` e.g. `workOrderCompletionService.ts:195`; `SyncDashboard.tsx:525`; `provisioningService.ts` |
| Log RH, complete WOs, record spares/stores locally | SUPPORTED | modules present; `workOrderCompletionService.ts:185-194` |
| Changes exchanged via sync, scheduled or manual | SUPPORTED | `autoSyncScheduler.ts:101`, `:160-192`, `:261`; `SyncDashboard.tsx:531`, `:551` |
| Ship sees only active jobs | SUPPORTED | `jobController.ts:9-28`, `:30-36`; `jobVisibilityPolicy.test.ts:40-57` |
| Ship sees only active components | SUPPORTED | `componentController.ts:13-20`; `componentVisibilityPolicy.test.ts:35-51` |
| Ship sees only active spares | PARTLY | Spares can be deactivated (`sparesService.ts:124-127`) but no ship-viewer filter found in `server/modules/spares` |
| RH jobs need a reading; completion refused without it | SUPPORTED | `workOrderCompletionService.ts:132-141`; `WorkOrderFormPage.tsx:2820-2826`, `:2995-3006`; exemptions: NOT_RH_DRIVEN (`:132-134`), per-vessel `rhValidationEnabled` |
| Lower reading still saved, counter not reduced | PARTLY | True only for back-dated readings (`workOrderCompletionService.ts:257-265`, `:358-366`); a plain lower reading is hard-blocked "Running hours cannot go backward!" (`rhTimelineValidationService.ts:310-311`; `WorkOrderFormPage.tsx:2780-2781`, `:6409`); completion RH above current also blocked (`:146-156`) |
| Hours go down only for meter replacement / renewal reset | SUPPORTED | `rhEventComparator.ts:197-205`, `:258`, `:307-310`; `running-hours/routes.ts:55` |
| Save as Draft; nothing live until submit | SUPPORTED | `WorkOrderFormPage.tsx:2841-2850`, `:7453` |
| Drafts do not change status | SUPPORTED | `WorkOrderFormPage.tsx:2841-2845`, `:2894-2897` |
| WO numbers include the vessel code, e.g. `<VESSELCODE>-JOB-…` | PARTLY | Prefix correct; "JOB" is the job's own code segment: `<V_CODE>-<JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<NNN>` (`workOrderNumbering.ts:7`, `:44`, `:60-80`), unplanned `<V_CODE>-UWO-…` (`:119-120`); generated job codes `MKR-<XX>-<NNNNN>` (`:217-255`) |
| Old WOs keep numbers; sequence continues | SUPPORTED | `workOrderNumbering.ts:66-80`, `:112-125` |
| Approval decided office-side with remarks | SUPPORTED | `workOrderService.ts:2877`, `:3125`, `:3174`, `:3188`; `SuperintendentPage.tsx`; `postgresStorage.ts:8827-8829` |
| Rejected completion returns with remarks; correct and resubmit | SUPPORTED | `workOrderService.ts:2860-2879`, `:656`; `WorkOrderFormPage.tsx:2780` |
| Postponed WO stays postponed | SUPPORTED | `server/routes.ts:687-696`; `postgresStorage.ts:8818-8869` |
| Task steps identical to Office manuals | SUPPORTED | shared screens/endpoints; `WorkOrderFormPage.tsx:111` |
| Admin → Sync Dashboard → "Auto-Sync Settings" | SUPPORTED | `SideMenuBar.tsx:96`; `SyncDashboard.tsx:641-647`; `autoSyncScheduler.ts:285-288` |
| "Sync Now" on the Sync Dashboard | SUPPORTED | `SyncDashboard.tsx:525-551` |
| Confirm sync via indicator + history | SUPPORTED | `SyncStatusIndicator.tsx:125`; `SyncDashboard.tsx:474`, `:659-665` |

SUPPORTED 16 · PARTLY 3 · UNSUPPORTED 0.

## 3. Technical - Recent Updates & Changed Behaviours (Operational) Notes

| Claim | Verdict | Evidence |
|---|---|---|
| Planned WO `<VESSELCODE>-<JOB>-<COMPONENT>-<YEAR>-<NNN>` | SUPPORTED | `workOrderNumbering.ts:7`, `:86` |
| Unplanned `<VESSELCODE>-UWO-…` | SUPPORTED | `workOrderNumbering.ts:10-11`, `:131` |
| Existing WOs keep numbers; sequence continues | SUPPORTED | `workOrderNumbering.ts:66-81`, `:112-126`; `workOrderNumbering.test.ts:55-62` |
| Missing vessel code → legacy format | SUPPORTED | `workOrderNumbering.ts:156-164` |
| "Admin: run Sync Masters to populate vessel codes" | UNSUPPORTED (contradicted) | `docs/SYNC-ARCHITECTURE.md:24-27` (vessels NO_SYNC; provisioning or one-time UPDATE); `/admin/sync-masters` (`DataMasters.tsx:391`) syncs crew/tenant masters, not v_code |
| RH reading mandatory on completion | SUPPORTED | `workOrderCompletionService.ts:134-142` |
| (omitted exception) not required for NOT_RH_DRIVEN components | PARTLY | `workOrderCompletionService.ts:131-134` |
| Reading + outcome recorded on the WO | SUPPORTED | `shared/schema.ts:1399-1403`; `SYNC-ARCHITECTURE.md:21-22` |
| Counter never decreases from late/low readings | SUPPORTED | `rhValidation.ts:46-82`; `postgresStorage.ts:230-246`, `:1701`, `:8267`, `:8292` |
| Only meter replacement / renewal reset lowers | SUPPORTED | `rhValidation.ts:44`, `:57-68`; `schema.ts:372` |
| Across sync latest reading date wins; tie → ship | SUPPORTED | `SYNC-ARCHITECTURE.md:17-18`, `:29-33` |
| Pending Approval moves only with explicit Approve/Reject | SUPPORTED | `workOrderService.ts:1187-1191`; `approvalTransition.ts:9-25`; tests |
| Completion draft saved for later | SUPPORTED | `schema.ts:1405-1409`; `WorkOrderFormPage.tsx:2841` |
| Draft changes nothing live | SUPPORTED | `schema.ts:1406-1408`; `workOrderContextService.ts:432-433` |
| Office generation per-vessel switch, off by default | SUPPORTED | `schema.ts:2371-2373`; `workOrderGenerationGate.ts:64-87`, `:150-162` |
| Switch set by a Sail Admin | SUPPORTED | `workOrderGenerationGate.ts:66-67`; `PmsVesselSettingsManagement.tsx:505-511` |
| Office users told it is disabled for the vessel | PARTLY | Non-Sail-Admin office users are refused earlier with ROLE_NOT_PERMITTED (`workOrderGenerationGate.ts:141-148`, `:44`) |
| Ships always generate on their daily scan | SUPPORTED | `workOrderGenerationGate.ts:69`, `:119-120`; `jobDueScanner.ts:158-160`, `:191-192` |
| Office "Generate Now", vessel-scoped | SUPPORTED | `WorkOrders.tsx:1492-1498`; `work-orders/routes.ts:91`; `jobDueScanner.ts:158` |
| Office RH entry per-vessel switch | SUPPORTED | `schema.ts:2375-2377`; `workOrderGenerationGate.ts:89-112`; `workOrderCompletionService.ts:192-201` |
| (omitted) office RH entry requires a reading date | PARTLY | `workOrderCompletionService.ts:211-218` |
| Superintendent can reopen a completed WO with remarks | SUPPORTED | `work-orders/routes.ts:131-135`; `workOrderController.ts:339-351`; `workOrderService.ts:3742-3747` |
| Superintendent can reject a completion | SUPPORTED | `routes.ts:125-129`; `workOrderController.ts:315` |
| Rejected WOs appear in the Overdue tab | PARTLY | Tab is re-computed Due/Overdue/Active (`shared/workOrders/status.ts:253`; `workOrderBulkService.ts:369`, `:381-382`) |
| Superintendent notifications with pending/acknowledged/information tabs | SUPPORTED | `superintendentNotifications.ts:2-4`, `:76-87`; `SuperintendentPage.tsx:53`, `:367-379` |
| …scoped to the superintendent's vessels | PARTLY | Scoped to the selected vessel (`SuperintendentPage.tsx:55`, `:77-79`) |
| Per-vessel superintendent lock | SUPPORTED | `schema.ts:2383-2385`; `PmsVesselSettingsManagement.tsx:220-229`, `:527-535`; `useApprovalPolicy.ts:20`, `:36-39` |
| Postponed WO does not auto-revert | SUPPORTED | `server/routes.ts:687-694`; `postgresStorage.ts:8828` |
| Rotational parts tracked by stamp identity | SUPPORTED | `schema.ts:375-380`, `:408-422`, `:189` |
| Certificates carry Next Annual / Next Interim, editable | SUPPORTED | `schema.ts:3506`, `:3508`; `CertificatesPage.tsx:775`, `:812-813`, `:244` |
| Existing records show blank until filled | PARTLY | Renders '-' when empty (`CertificatesPage.tsx:1001-1003`) |
| Configurable multi-level approval chains | PARTLY | Two fixed levels via checkboxes (`ApprovalWorkflow.tsx:148`, `:626-629`; `syncConfig.ts:631`, `:643`); steps `postgresStorage.ts:5785`, `:6158-6209`, `:7982-7989` |
| Set up under Admin → Approval Workflow | SUPPORTED | `SideMenuBar.tsx:147`; `PermissionsContext.tsx:114`; `ApprovalWorkflow.tsx:347` |
| Approver roles set per level on that screen | PARTLY | Screen stores level1Enabled/level2Enabled only (`ApprovalWorkflow.tsx:155-156`, `:197-198`; `server/routes.ts:361-369`); approvers in `moc_approvers` (`postgresStorage.ts:5785`, `:5946-5950`) |
| Each level's decision recorded with comments | SUPPORTED | `postgresStorage.ts:6185`, `:6200`, `:6750-6756`; `changeRequestsController.ts:106-126` |

SUPPORTED 22 · PARTLY 9 · UNSUPPORTED 1.

## 4. Technical - Roles & Permissions (Operational) User Manual

| Claim | Verdict | Evidence |
|---|---|---|
| Role "Sail Admin" highest-level admin | SUPPORTED | `shared/uiRoles.ts:1`, `:15`; `auth.ts:37`; `permissions.ts:12-15`, `:108` |
| Role "Office / Admin (Superintendent)" | SUPPORTED | `uiRoles.ts:17` (label "Superintendent"), `:26` |
| Role "HOD (Head of Department)" | PARTLY | Code role `Head_of_Dept`, label "Head of Dept" (`uiRoles.ts:18`); "HOD" only a variable name |
| Role "Vessel Admin" distinct | PARTLY | SAILERP profile role mapped into `Head_of_Dept` (`uiRoles.ts:32`); no "Vessel Admin" in `client/src`; legacy string only (`auth.ts:10`) |
| Role "Level 2 Reviewer" | PARTLY | No such role; driven by job rank `level2_reviewer_rank_id` (`schema.ts:1204`, `:2578`; `workOrderService.ts:1720-1724`); endpoints `requireRole(['Office','PMS Admin','Sail Admin'])` (`routes.ts:113-123`) |
| Role list complete | PARTLY | `Client_Admin` and `External` omitted (`uiRoles.ts:1-21`, `:27-28`); `Client_Admin` is the default Office role (`:28`; `Dashboard.tsx:533-534`) |
| "My Vessel" scope shows assigned vessels | SUPPORTED | `VesselContext.tsx:13-14`, `:20`, `:38`, `:56-60`; `AuthContext.tsx:447` |
| Me / My Team toggle exists | SUPPORTED | `Dashboard.tsx:477`, `:2840-2865` |
| Toggle controls whose work you see across screens | PARTLY | PMS Dashboard Operation tab only (`Dashboard.tsx:2836`); WO KPIs only (`:2876`) |
| Only HOD can use the toggle | PARTLY | Gate is `!isAdminScope` (`Dashboard.tsx:2836`, `:534`); crew users see it; disabled when hierarchy unmapped (`:636`, `:2852`, `:2870-2876`) |
| Only Vessel Admin can use My Team | PARTLY / contradicts previous | Same single toggle; Vessel Admin → Head_of_Dept (`uiRoles.ts:32`) |
| Ship users see only active items | PARTLY | Soft-delete propagation deactivates (`SYNC-ARCHITECTURE.md:22-24`); no role-based read filter |
| Write actions permission-checked on the server | PARTLY (important) | `requirePermission` is opt-in and pass-through by default (`permissions.ts:16-23`, `:100`, `:106`); no `enforce:true` call site outside tests; unconfigured roles fail open (`:24-27`, `:111-112`); real enforcement = `requireRole` |
| Refusal message wording | SUPPORTED | `permissions.ts:114`, `:127`; `auth.ts:79` ("Forbidden - Insufficient permissions") |
| Master list types restricted to Sail Admin | SUPPORTED | `fleet/routes.ts:8-9`, `:17-18` |
| Sail Admin full access | SUPPORTED | `auth.ts:37`; `permissions.ts:108`; `postgresStorage.ts:6158-6160`, `:6750-6752` |
| Admin area contents | SUPPORTED | `PMSAdmin.tsx:41`; `SideMenuBar.tsx:147`; `PmsVesselSettingsManagement.tsx:402`; `permissions.ts:5` |
| Sail Admin sees all vessels | SUPPORTED | `Dashboard.tsx:533`, `:866` |
| Office manages assigned vessels via My Vessel | SUPPORTED | `VesselContext.tsx:20-38`; `AuthContext.tsx:113`, `:447` |
| Office reviews dashboards, WOs, RH, spares, stores, defects, certs, surveys | SUPPORTED | pages under `client/src/pages/pms/`, `cert-surveys/` |
| Review postponement requests | SUPPORTED | `PostponeApprovalDialog.tsx:73`, `:111`; `postgresStorage.ts:7982-7989` |
| Reopen / reject completion; superintendent notifications | SUPPORTED | `routes.ts:125-135`; `workOrderService.ts:3742-3747`; `SuperintendentPage.tsx:53`, `:367-379` |
| "(superintendent capability)" | PARTLY | Role-set guard `requireRole(['Office','PMS Admin','Sail Admin'])` (`routes.ts:127`, `:133`; `workOrderController.ts:636`) |
| Export from each screen | PARTLY | Export on many screens (10 PMS files), not all; no per-role export check |
| HOD can do everything an office user can for their department | UNSUPPORTED | No department-scoped permission layer; only approver/job department matching (`workOrderCompletionService.ts:111-123`); HOD excluded from postponement approval (`PostponeApprovalDialog.tsx:111`) |
| HOD switches Me / My Team | SUPPORTED (scope caveat) | `Dashboard.tsx:529`, `:2836-2865` |
| Vessel Admin administers vessel data, uses My Team | PARTLY | No Vessel Admin code path; maps to Head_of_Dept |
| Level 2 Reviewer approves/rejects at Level 2 | PARTLY | Stage exists ("Pending Office Review", `workOrderBulkService.ts:143-156`, `:227`; `routes.ts:113-123`) but triggered by job rank, authorised by role set |
| Return work for correction | SUPPORTED | `workOrderBulkService.ts:357-415` |
| Crew log RH, complete WOs, record consumption | SUPPORTED | `workOrderCompletionService.ts:185-201`; `RunningHours.tsx`; `WorkOrderFormPage.tsx` |
| Crew trigger Sync Now / Auto-Sync Settings | SUPPORTED | `SyncDashboard.tsx:525-531`, `:641-647`; `SyncStatusIndicator.tsx:125`; `AutoSyncSettingsCard.tsx:98` |
| Multi-level chains configured under Approval Workflow with roles per level | PARTLY | Two fixed levels; approvers in `moc_approvers` (see doc 3) |
| Each decision recorded | SUPPORTED | `postgresStorage.ts:6185`, `:6200`, `:6209`, `:6750-6756`; `changeRequestsController.ts:106-126` |
| Per-vessel switch: office WO generation | SUPPORTED | `schema.ts:2371-2373`; `workOrderGenerationGate.ts:64-71`, `:119-120` |
| Per-vessel switch: office RH entry | SUPPORTED | `schema.ts:2375-2377`; `workOrderGenerationGate.ts:89-112` |
| Per-vessel switch: superintendent lock | SUPPORTED | `schema.ts:2383-2385`; `PmsVesselSettingsManagement.tsx:220-229`, `:527-535` |
| Switches live "in the vessel settings" | PARTLY | Screen titled "Lead Time & Grace Period Settings" (`PmsVesselSettingsManagement.tsx:402`, `:617`; `workOrderGenerationGate.ts:158-159`) |
| (omitted) 4th switch: RH validation | PARTLY | `schema.ts:2379-2381` |

SUPPORTED 19 · PARTLY 15 · UNSUPPORTED 1.

## 5. Technical - Sync (Operational) User Manual

| Claim | Verdict | Evidence |
|---|---|---|
| Office path "Admin menu → Fleet Overview" | SUPPORTED | `SideMenuBar.tsx:142-143` (shore-only) |
| Screen "Fleet Sync Overview" | SUPPORTED | `SyncFleetOverview.tsx:313`, route `/admin/sync-fleet` (`:7`) |
| Last sync shown as "5h ago" / "2d ago" | SUPPORTED | `SyncFleetOverview.tsx:87-97`, `:441` |
| Colour-coded status per vessel | SUPPORTED | `SyncFleetOverview.tsx:99-148`, `:444-448` |
| Screen refreshes automatically | SUPPORTED | `:199`, `:221` (60 s), `:407` |
| Click into a vessel's Sync Dashboard | PARTLY | Eye icon opens `/admin/sync-dashboard` without the vessel (`:477-488`); dashboard needs its own dropdown (`SyncDashboard.tsx:439-452`, `:211-215`) |
| History shows pushed, pulled, conflicts, files, duration | SUPPORTED (on Sync Dashboard) | `SyncDashboard.tsx:684-690`; Fleet Overview activity table has no Files column (`SyncFleetOverview.tsx:707-714`) |
| Green = synced recently | SUPPORTED | `:143-147` |
| Amber = no sync in over 24 h | SUPPORTED | `:136-142` |
| Amber also = changes waiting to go out | UNSUPPORTED (contradicted) | `:134-135` "Stale is TIME-BASED ONLY"; `pending_changes` separate (`:450-457`) |
| Red = >48 h or conflicts | SUPPORTED | `:120-132` |
| Grey = Never Synced / Not Provisioned | SUPPORTED | `:104-117` |
| Amber/red sorted to top | PARTLY | `ORDER BY last_sync_at ASC NULLS FIRST` (`sync/service.ts:1640`) |
| Default auto-sync every 6 hours | SUPPORTED | `autoSyncScheduler.ts:26`; `migrations/119_sync_settings_defaults_update.sql:12,24` |
| Auto-sync is the normal mode, no action needed | PARTLY | Needs `auto_sync_enabled` (seed false in 103, true in 119); ship-only (`autoSyncScheduler.ts:263-266`), 3-min boot delay (`:27`); no shore trigger (`SyncFleetOverview.tsx:242-243`) |
| Manual "Sync Now" on the ship | SUPPORTED | `SyncDashboard.tsx:525-531`, `:551` |
| One Sync Now clears a long outage | PARTLY | `runSyncToCompletion` stops at cap 20 cycles / 60 s / no progress (`syncEngine.ts:62-63`, `:568`, `:595-611`) |
| Ship path "Admin → Sync Dashboard" | SUPPORTED | `SideMenuBar.tsx:96`; `SyncDashboard.tsx:7` |
| "Auto-Sync Settings" card | SUPPORTED | `SyncDashboard.tsx:641-656` |
| Toggle auto-sync; "Sync Interval (minutes)" | SUPPORTED | `AutoSyncSettingsCard.tsx:98`, `:112` |
| Changed interval takes effect immediately | SUPPORTED | `AutoSyncSettingsCard.tsx:127-128`; `autoSyncScheduler.ts:160-193` (first tick after the new interval, `:191`) |
| Set per vessel on the ship side | PARTLY | Per instance: global `sync_settings` keys (`AutoSyncSettingsCard.tsx:20`; `sync/controller.ts:686-690`) |
| Sync Now pushes and pulls; history recorded | SUPPORTED | `controller.ts:305`; `SyncDashboard.tsx:323-327`, `:659-714` |
| Ship indicator shows connection + last sync | SUPPORTED | `SyncStatusIndicator.tsx:63-71` |
| …with recent sync history in the indicator | PARTLY | Popover shows counts + links only (`:73-139`); history on the dashboard |
| Field-by-field merge | SUPPORTED | `shared/syncConfig.ts:6` |
| Same field both sides → more recent wins; loser recorded | SUPPORTED | `oneWayApplier.ts:1626-1627`, `:1635` |
| Office user whose edit lost is notified | PARTLY (direction inverted) | Notification to the rejected incoming sender, normally the ship user (`sync/service.ts:411-447`); ship applier sends none (`oneWayApplier.ts:1622-1624`) |
| Dual completion → conflict on "Sync Conflict Review" | SUPPORTED | `dualCompletionResolver.ts:10-12`; `SyncConflictReview.tsx:249`, `:347`; menu "Conflict Review" (`SideMenuBar.tsx:97`) |
| Resolved as one unit | SUPPORTED | `conflictReviewRepository.ts:742-745`, `:896-899` |
| Interim = later completion date; tie → ship | SUPPORTED | `dualCompletionResolver.ts:13-15`, `:89-103` |
| Unresolved conflicts show red | SUPPORTED | `SyncFleetOverview.tsx:120-125`; `service.ts:1626-1630` |
| RH reconciled by reading date | SUPPORTED | `rhEventComparator.ts:4-10`, `:104-121` |
| Same date → ship wins | SUPPORTED | `rhEventComparator.ts:6-8`, `:77-83`, `:114-116` |
| Hours never move backwards | SUPPORTED | `rhEventComparator.ts:200-210`, `:12-17`; `oneWayApplier.ts:1077-1086` |
| Only meter replacement / renewal reset lowers | SUPPORTED | `rhEventComparator.ts:258`, `:203-209` |
| Vessel masters refreshed by an admin action | PARTLY | `POST /technical/api/admin/sync-masters` (`misc/routes.ts:32`; `adminController.ts:402-425`) but button labelled "Sync All" (`DataMasters.tsx:558-575`, `:580`) |
| Vessel code used in work-order numbers | SUPPORTED (hand-corrected from the agent's UNSUPPORTED) | `server/utils/workOrderNumbering.ts:7-11`, `:60-86`, `:119-131` — `<V_CODE>-` prefix on planned and unplanned numbers |
| Vessel master data reaches a ship at provisioning only | SUPPORTED | `shared/syncConfig.ts:1191-1202`; `provisioningService.ts:55` |
| Contact support about refreshing the ship | PARTLY | Self-service "Ship Provisioning" exists (`SideMenuBar.tsx:98`; `provisioningService.ts:55`, `:373`, `:851`) |

SUPPORTED 29 · PARTLY 9 · UNSUPPORTED 1 (after correction).
