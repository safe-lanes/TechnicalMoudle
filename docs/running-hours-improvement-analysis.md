# Running Hours Improvement Analysis

**Date:** 28 October 2026  
**Status:** Investigation and recommendations only; implementation has not started.  
**Purpose:** Preserve the server-load improvement analysis, regression risks and approval requirements for future implementation.

## 1. Executive summary

The Running Hours module should not receive blanket pagination. The strongest demonstrated opportunity is to avoid loading unrelated Component records and unnecessary data when serving existing views.

Recommended sequence:

1. Optimize Overview master selection and inherited counting while preserving the complete response and existing calculations.
2. Implement the children-dialog identity/direct-lookup correction separately, after approval of its visible behavior correction.
3. Add History-search debounce as an independent, low-risk improvement.
4. Improve cache invalidation and immediate refetch behavior after verifying all consumers and freshness on return.
5. Defer response-field removal, Overview pagination, speculative indexes and export redesign.

No change can be guaranteed regression-free before implementation and verification. In particular, the Overview optimization can change the relative order of rows with equal component codes, and the children fix can change which parent's children are displayed in ambiguous aggregate views.

This document is not authorization to implement every recommendation. The existing narrow parent-loading task does not automatically include child selection, validation-policy corrections, search, cache changes or response-contract changes.

## 2. Evidence and limitations

Read-only development investigation found:

| Measurement | Observation |
| --- | ---: |
| Scoped Component records across available vessels | 5,088 |
| Active MASTER counters across those vessels | 187 |
| Highest active MASTER count for a single vessel | 38 |
| Component records loaded for that representative 38-master vessel | 1,639 |
| Largest inherited-child count under a master | 116 |
| Masters with more than 25 inherited children | 32 |
| Total RH audit records | 1,722 |
| Highest audit count for one component | 15 |

For the representative vessel:

| Source selection | Records | Summed source-record JSON representation |
| --- | ---: | ---: |
| Complete scoped Component selection | 1,639 | 2,997,087 bytes |
| MASTER-only comparison selection | 38 | 73,836 bytes |

A single development query-plan comparison observed 1.263 ms execution for the complete Component selection versus 0.096 ms for master-only selection, using existing vessel-tree and RH-master indexes respectively.

These figures are not production benchmarks, final HTTP payload sizes, measured process-memory savings or complete replacement-endpoint timings. In particular:

- The approximate 97% reduction applies to Component objects returned to the application in the representative example, not total SQL work or endpoint latency.
- SQL must still inspect relevant inherited rows to calculate counts.
- The replacement aggregate cost was not included in the isolated master-selection comparison.
- Keeping the existing response means final HTTP size should remain broadly equivalent.
- No visible screen-speed improvement or production percentage improvement should be promised.

## 3. Current data flow and integration boundaries

### Existing parent read

`GET /technical/api/running-hours/parents` currently:

1. Loads all non-deleted, vessel-scoped Components in the requested scope.
2. Selects active MASTER records in application memory.
3. Retains active inherited records and repeatedly filters them to count children per master.
4. Performs already-batched historical-reading and latest-audit lookups.
5. Calculates RH totals, utilization, period hours, warnings and update information.
6. Sorts the complete result by component code and returns a bare array.

This endpoint is not consumed only by the Overview grid. Its consumers include:

- Running Hours Overview.
- History component selection.
- Individual RH update and meter-replacement dialogs.
- Bulk Update.
- Overview CSV generation.
- Dashboard RH summaries.
- Dashboard per-vessel dot-matrix reads.

### Important identity detail

The parent API returns `cuuid` and `vesselId`, but the Running Hours UI mapping retains `cuuid` and currently omits `vesselId`, despite allowing it in the row interface.

Mapped-row vessel identity is also consulted by existing validation-policy resolution for individual, bulk and child operations. Adding it globally can therefore change validation behavior, not just child lookup efficiency.

## 4. Recommendation: canonical child identity and direct parent lookup

### Assessment

High-value improvement, but not strictly behavior-neutral. Obtain explicit approval for correcting ambiguous parent selection.

### Current behavior

In My Vessels mode, the children request uses `vesselId=all` and the parent's component code, without a vessel allow-list.

The server loads the complete matching fleet Component list, selects the first matching code or ID, and then calls an inherited-component helper that looks up the parent again.

Repeated component codes across vessels create a wrong-parent risk.

### Proposed behavior

- Carry the selected parent's canonical UUID and concrete vessel explicitly.
- Resolve that parent directly once.
- Verify its identity/vessel relationship and existing permitted scope on the server; client parameters alone are not authorization.
- Pass the resolved parent into an RH-specific child read instead of repeating the parent lookup.
- Preserve the existing child relationship predicate, active/deleted treatment, ordering and installed-stamp information.
- Key cached child results by canonical parent identity and concrete vessel, not component code alone.
- Do not silently fall back to fleet-wide code matching.
- Avoid modifying shared inherited-component storage behavior used by other paths.

### Query-saving qualification

Before stamp loading, the normal path changes from:

- Complete Component selection.
- Parent identifier lookup.
- Child query.

To:

- Direct parent lookup.
- Child query.

That is normally three queries becoming two, not two fewer queries. The primary benefit is removing the complete fleet/vessel Component result.

### Regression boundary

Do not add `vesselId` to the shared mapped row and assume no other behavior changes. That addition can alter the validation policy applied to the same existing update forms.

Carry query identity separately if needed to isolate this fix. If validation-policy correction is also intended, document and approve it separately.

The child-list predicate and Overview count predicate have existing differences, including nullable-reference behavior. Do not substitute one for the other as part of the optimization.

## 5. Recommendation: MASTER-only Overview query and aggregate counts

### Assessment

Best fit for the existing narrowly scoped parent-loading optimization. Proceed only after resolving the equal-code ordering decision and enforcing response/count parity.

### Proposed behavior

- Select active MASTER Components directly within the same existing scope.
- Obtain inherited counts through SQL aggregation rather than transferring complete child objects to Node.
- Keep the complete Overview list; add no pagination.
- Preserve all existing MASTER Component response properties through Drizzle's typed mapping.
- Leave batched audit reads and RH calculations unchanged.

### Mandatory safeguards

**Count type:** PostgreSQL COUNT returns bigint and the default node-postgres parser returns that as a string. A TypeScript `sql<number>` annotation does not convert it. Explicitly return an integer count, for example `COUNT(child.id)::integer`, and verify JSON number type. Counting the non-null child ID also avoids a phantom count for an unmatched LEFT JOIN.

**Typed mapping:** Preserve camel-case names, timestamp decoding, decimal strings, arrays and nulls using typed Component column selection. Keep internal aggregate metadata separate from public response fields.

**Allow-lists:** Use the established non-empty `inArray` branch. Preserve allow-list precedence and current empty-list behavior; do not accidentally turn an absent/empty list into a different scope.

**Null semantics:** Preserve JavaScript-equivalent reference/code comparisons, including null-to-null matches where the current algorithm allows them. Preserve blank strings separately from nulls.

**Count membership:** Preserve ID, UUID, code and counter-source references, vessel separation, and active/deleted rules. Count a child once per master despite overlapping OR conditions; do not repair ambiguous legacy relationships.

**Vessel fallback:** Preserve `master.vesselId ?? requestedVesselId`. Under normal Office `all` requests, a null-vessel master falls back to literal `'all'`; reproduce the predicate rather than hard-coding a zero or matching null-vessel children.

**Snapshot:** Master membership and inherited counts should share the original Component-read snapshot. Prefer one combined statement; if using two statements, account for snapshot and round-trip overhead.

**Query cost:** A correlated count is one SQL statement but can execute a subplan repeatedly. Compare it with a set-based aggregate using the complete replacement path. SQL-side grouping is compatible with the task; returning complete inherited lists to Node is not.

### Equal-code ordering: approval required

The existing Component query has no ORDER BY. The final application sort compares component codes only, so equal-code rows retain access-path-dependent source order.

Development checks found:

- 19 repeated-code groups.
- 133 masters within those groups.
- All 19 groups span multiple vessels.
- A read-only old-source versus candidate-MASTER-source comparison changed within-code source order in all 19 groups.

This can alter Overview, History selector, Bulk Update and CSV order even when all values and membership are identical.

The recommended oracle is:

1. Compare complete response row contents and types keyed by `cuuid`.
2. Preserve the existing comparator's order between non-equal codes.
3. Accept differences inside comparator-equal groups only after explicit approval.

Do not add a new UUID/vessel/name tie-breaker or natural-code ordering without approval.

## 6. Recommendation: refetch active queries after saves

### Assessment

Useful independent improvement, but requires cache-key and freshness verification. It is outside the narrow parent-read task.

### Correct behavior

Invalidate every relevant cached variant, but immediately refetch active consumers only. Inactive variants must remain stale so they refresh when used again.

Do not restrict invalidation itself to active variants, which could leave other cached entries incorrectly marked fresh.

### Active is not the same as visible

An active query has an enabled observer. The parent query remains enabled while History is open, and other views consume the data. Do not assume the Overview tab's visibility determines whether the query is active.

### Confirmed key-matching gaps

- Running Hours invalidates `['/technical/api/components']`.
- Some Component consumers use a first key element containing the vessel path, such as `['/technical/api/components/<vesselId>']`.
- Those first elements are different strings, so ordinary array-prefix invalidation does not match them.
- Dashboard's ordinary parent query uses the base parents key.
- Its dot-matrix queries use a distinct first string ending in `/parents/dot-matrix`; the ordinary parents array-prefix invalidation does not match that first string.

The project already has a boundary-aware URL-prefix invalidation helper suitable for these key forms.

### Regression safeguards

- Audit and retain required invalidation coverage across Overview, Dashboard, Component details and other affected consumers.
- Do not broaden immediate refetches indiscriminately.
- Verify that revisiting invalidated cached views refreshes them.
- Test returning immediately after a save and opening an edit before background refresh completes.
- Do not promise that cached data is instantly fresh: stale rows can temporarily render during a background refresh.
- Keep existing write guards and avoid adding mutation retries.

## 7. Recommendation: return only Overview grid fields

### Assessment

Defer. This is an avoidable response-contract risk and is unnecessary for the primary internal-loading improvement.

The grid does not describe the complete consumer contract. Non-displayed fields can still support meter replacements, edit forms, validation context, CSV and Dashboard.

Keep the full existing response while eliminating unrelated source records internally. If network response size later proves significant, first inventory every consumer and define a complete shared response contract or an explicitly opt-in lightweight read.

Do not silently drop fields from the existing endpoint.

## 8. Recommendation: debounce History search

### Assessment

Low-risk independent improvement, with a deliberate short delay before results refresh.

The search term currently changes the History query key immediately and can issue a count/page pair per keystroke.

A debounce around 300 ms can prevent intermediate requests while preserving final search meaning.

Required safeguards:

- Keep input text responsive.
- Apply the effective term and page reset together.
- Clear immediately.
- Cancel pending timers on component, vessel or tab changes.
- Prevent superseded responses replacing current results.
- Keep existing matching rules and date/sort meaning.
- Ensure History CSV uses the latest intended term, flushing pending search when needed rather than exporting an older debounced filter.

Browser request cancellation does not itself prove that an already-running database query has stopped.

## 9. Changes not justified now

| Change | Decision |
| --- | --- |
| Overview pagination | Do not add based on current evidence; master counts are relatively small. |
| History-selector pagination | No demonstrated initial need; avoid unnecessary UI scope changes. |
| Bulk Update pagination | No demonstrated initial need; avoids off-page editing complexity. |
| New indexes | Do not add speculatively. Existing indexes supported inspected selections; profile the actual aggregate first. |
| Export redesign | Not required for the selected read optimization. Preserve existing coverage and formatting. |
| History export cap removal | Not approved; preserve the existing 10,000-record cap. |
| RH mutation/scanner changes | Excluded from these loading improvements. |

## 10. Proportionate verification

### Main parity checks

- One fixed-clock integration comparison.
- Complete row-content/type comparison keyed by canonical identity.
- Ordering comparison according to the approved equal-code policy.
- Read-only development comparisons for every vessel, Office `all`, representative My Vessels lists, each preset period and one custom range.

### Targeted synthetic cases

- Null/blank references and component codes.
- ID, UUID, code and counter-source links.
- Overlapping OR matches.
- Repeated codes across vessels.
- Inactive, NULL-active, deleted and NULL-deleted rows.
- Fleet-template exclusion.
- Zero-child and null-vessel masters.
- Allow-list precedence and empty-list behavior.
- Count-number serialization and complete typed master mapping.

These fixtures are necessary: the inspected development data had no null-code, blank-code or null-vessel masters.

Avoid rebuilding an exhaustive calendar/timezone suite when those calculations remain unchanged. Expand that coverage only if implementation crosses those boundaries.

### Consumer and performance checks

- Read-only browser checks of Overview, History selection, Bulk Update population, relevant Dashboard reads and CSV coverage/order.
- Complete-query profiling, including aggregate loops/buffers/time, any transaction overhead, rows/bytes transferred to Node and hydration/processing.
- Repeated measurements rather than a single warm run.
- No real RH mutations or lasting fixture records.
- No runtime fallback to the complete Component inventory to hide a parity problem.

## 11. Recommended implementation sequence

| Order | Improvement | Conditions |
| --- | --- | --- |
| 1 | Overview MASTER-only selection and aggregated counts | Resolve equal-code ordering; preserve complete response and calculations. |
| 2 | Children identity/direct-lookup correction | Explicit approval; isolate validation-policy effects and preserve child/stamp semantics. |
| 3 | History-search debounce | Preserve page reset, export scope and pending-request handling. |
| 4 | Active-only immediate refetch and correct invalidation matching | Verify all consumers and freshness on return. |
| Defer | Grid-only response projection | Separate consumer and response-contract review first. |

Keep these changes isolated enough that verification can identify which change caused a mismatch. Approval of the parent-read task is not approval of the entire sequence.

## 12. Non-negotiable business boundaries

Unless separately approved, do not change:

- MASTER/INHERITED relationships or membership rules.
- RH accumulation, cumulative/current-meter totals or replacement calculations.
- Normal-update monotonicity and explicit reset/renewal exceptions.
- Validation policy or role/permission behavior.
- Period, utilization, warnings, historical fallback or date interpretations.
- Last Updated/Updated By meanings.
- Cascade, child update, installed-stamp accrual, audit or sync writes.
- Work Order generation or scanner triggers.
- CSV contents, record coverage, formatting or the History export cap.

The aim is lower resource usage for existing reads, not an unrequested redesign of Running Hours business behavior.

## 13. Source references

These references identify where the investigated behavior was observed; future implementation must recheck current code because it may change:

- `client/src/pages/pms/RunningHours.tsx`
- `client/src/pages/pms/rhValidationPolicy.ts`
- `client/src/pages/pms/Dashboard.tsx`
- `client/src/pages/pms/Components.tsx`
- `client/src/lib/queryClient.ts`
- `server/modules/running-hours/routes.ts`
- `server/modules/running-hours/controllers/runningHoursController.ts`
- `server/modules/running-hours/services/runningHoursService.ts`
- `server/modules/running-hours/repositories/runningHoursRepository.ts`
- `server/modules/running-hours/repositories/dateUpdatedLocalSql.ts`
- `server/postgresStorage.ts`
- `shared/schema.ts`
- `.local/tasks/running-hours-parent-loading-optimization.md`

## Final conclusion

The Overview query optimization is the strongest controlled first step. The children-dialog correction is also valuable, but changes visible identity behavior and can accidentally affect validation if implemented through shared row mapping. Search and cache improvements can follow independently. Keep response-field removal and broader pagination outside the initial implementation.
