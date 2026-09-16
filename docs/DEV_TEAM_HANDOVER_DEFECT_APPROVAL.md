# Defect Approval Settings Sync Handover

`defect_approval_settings` is deliberately shore-local because Defects approval
classification and workflow submission happen on shore. This task does not modify
`shared/syncConfig.ts`; the development team should add the following paste-ready entry
inside the `NO_SYNC` section of `SYNC_CONFIG`:

```ts
  defect_approval_settings: {
    tableName: 'defect_approval_settings',
    category: 'NO_SYNC',
    direction: 'none',
    identityColumn: 'dasuuid',
    vesselScopeColumn: null,
    vesselScopeJoinPath: null,
    isGlobal: true,
    isConfigurable: false,
    businessRules: null,
    notes: 'Shore-local Defects approval-routing singleton. Classification uses long_extension_days; ships do not run the approval engine or need this threshold.',
  },
```

Do not classify this table as shore-to-ship: its threshold is only used when the
shore-side Defects approval card submits an Approval Engine request.

## Closure history sync handover

`defect_closure_history` is different from the shore-local routing settings above.
Shore creates immutable rejected-closeout snapshots, and vessels need those records
to display the compliance history without being allowed to create, update, or delete
it. Add this paste-ready entry inside the `ONE_WAY_SHORE_TO_SHIP` section:

```ts
  defect_closure_history: {
    tableName: 'defect_closure_history',
    category: 'ONE_WAY_SHORE_TO_SHIP',
    direction: 'shore_to_ship',
    identityColumn: 'dchuuid',
    vesselScopeColumn: 'vessel_id',
    vesselScopeJoinPath: null,
    isGlobal: false,
    isConfigurable: false,
    businessRules: 'Shore is the only writer. Ships receive insert-only immutable compliance snapshots.',
    immutable: true,
    notes: 'Immutable C1 closeout attempts returned during C2 verification. Shore is the write master; vessels consume history read-only.',
  },
```

This task deliberately does not modify `shared/syncConfig.ts`.

## OPEN ITEMS

### Rejected closure and extension history in the PDF

- `defect_approval_settings.show_rejected_closures_on_report` exists at
  `shared/schema.ts:2532-2554` and is persisted by
  `server/postgresStorage.ts:9158-9179`, but no report, export, or PDF generator
  reads it.
- The Defect PDF accepts one optional `targetDateExtension` rather than extension
  history (`client/src/lib/pdfReportGenerator.ts:99-107`). The wizard selects only
  the latest extension when constructing that payload
  (`client/src/pages/defects/DefectFormWizard.tsx:644-672,1249-1260`).
- The generated document prints that single extension
  (`client/src/lib/pdfReportGenerator.ts:1297-1320`) and the current C1/C2 values
  (`client/src/lib/pdfReportGenerator.ts:1324-1354`). It reads neither extension
  history nor `defect_closure_history`. A defect extended several times therefore
  prints as though it was extended once, and rejected closure attempts are absent.

Whether to enable the existing toggle and how to render complete extension and
closure histories in the exported compliance document are future product decisions,
not defects in the closure-reopen implementation.

### Reopened defects that retain an approved extension

The approved contract is to preserve `isDeferred=true` and the extended
`targetCloseDate` when C2 rejection reopens a defect. Existing consumers are not
changed by this task. The read-only review found:

| Consumer | Current Open + deferred behavior | Assessment |
|---|---|---|
| Defects list | Directly reads `isDeferred`, displays **Extended**, and suppresses **Overdue** (`client/src/pages/defects/DefectsLog.tsx:263-325`). | Counted once in the computed status; no double-count, but raw status Open is hidden. |
| Shared status helper / dashboard | The helper returns **Extended** before action/default states and excludes deferred rows from **Overdue** (`client/src/lib/defectStatusUtils.ts:40-73`). Dashboard KPI/chart buckets use that result (`client/src/pages/defects/DefectsDashboard.tsx:186-225,443-461`). The target-date cell independently colors any past date red (`client/src/pages/defects/DefectsDashboard.tsx:1022-1046`). | No bucket double-count; the dashboard can show an Extended badge beside a red past-due date. |
| Defect reports | Status summary and vessel reports group raw `status`, while overdue includes raw Open rows with a past target date and never reads `isDeferred` (`server/modules/defects/services/defectsService.ts:763-789,797-816`). | No within-report double-count; reported as Open and can appear overdue, contradicting list/dashboard. |
| Alert evaluator | Its row contract omits `isDeferred`; any non-Closed/non-Cancelled row past target raises an overdue alert (`server/modules/alerts/evaluators/defectEvaluators.ts:24-89`), fed by the shared defect read (`server/modules/alerts/services/pmsAlertEngine.ts:272-286`). | One deduped overdue alert, but it contradicts the list/dashboard Extended status. |
| Exact defect form | Directly reads `isDeferred` and displays the deferment plus its details (`client/src/pages/defects/DefectFormExact.tsx:137,1408-1481`). | Coherent with preserving the approved extension; no count involved. |

Whether these consumers should converge on one overdue/extended interpretation is a
follow-up decision. Do not infer that preserving the approved extension authorizes a
status, report, alert, or rendering change.