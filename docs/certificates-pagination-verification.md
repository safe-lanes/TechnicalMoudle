# Certificate loading verification

## Current status: partially implemented, task remains open

Only the operational Certificate read path changed. Frontend code, write APIs,
Surveys, Defects, Admin configuration, schema, indexes and dependencies were not
changed.

Attachment content is fetched only after SQL selects the requested rank window.
Missing vessel data still produces blank values and an empty attachment array.
All read stages share a read-only, repeatable-read transaction.

**Default and numeric-sort requests now use database-side scope, eligibility,
counting and page selection.** Only the selected page's response rows cross to
the application. SQL retains first-encountered vessel grouping and sequence
ordering, including source-order ties, without introducing an ID tie-breaker.
Unknown explicit sort fields retain their existing numeric-sequence fallback.

**Explicit text/date-string sorts still use the compatibility hybrid path.**
That path reads applicability and lightweight vessel metadata, performs existing
scope filtering, row construction, natural sorting and counting in application
memory, then hydrates attachments only after SQL selects the ranked page.
Its scalar loading remains unbounded. This remaining original scope has NOT
been deferred into a follow-up or accepted as task completion.

The existing natural, case-insensitive JavaScript comparator is not replaced
with an approximate SQL comparator. The user declined a dedicated database
sorting configuration. Catalog inspection found no existing natural-sort or
ICU sort-key function, and only the plpgsql extension is installed. No
configuration, sorting-function, extension or collation additions were made.

## Checks

- The Certificate-module suite has **113 passing tests**, covering page membership, ordering,
  scope precedence, blank data, duplicate-data mapping, response metadata,
  attachment content and internal-ID removal.
- A frozen pre-change service acts as an independent read oracle.
- Tests execute the actual unchanged browser Due In/page-sort and export-helper
  source against old/new responses.
- PDF, CSV and Excel handlers are executed separately: PDF renderer inputs and
  CSV/Excel serialized bytes/filenames are compared old versus new.
- Isolated frontend callbacks check compound edit identity, selective cache
  patching, the 5,000 ms refresh/reset behavior, attachment viewing/add/remove
  callbacks and refusal to edit when permission is absent.
- Repository checks inspect the narrow metadata projection, false-or-NULL
  deletion predicate, SQL page boundary before attachment hydration and shared
  transaction setup.
- The development database read-only comparison passed **56 request cases**.
  Actual PostgreSQL execution passed **7 virtual-row boundary cases**, without
  inserting fixtures or modifying Certificate records.
- **276 isolated PostgreSQL comparisons** exercise the actual numeric SQL path
  against the legacy oracle using connection-local temporary tables. They cover
  scope precedence, ECMAScript whitespace, Unicode lowercasing, null/false/true
  deletion flags, inactive/deleted masters, missing saved data, duplicate data,
  sequence ties, ascending/descending/default/unknown sorts, page boundaries
  and the distinct no-eligible-master response. No public table data is changed.
- Service-unit adapters supply fixture results for the numeric SQL delegation;
  they are not evidence that the numeric SQL algorithm itself is correct.
  Numeric-query unit checks and the actual PostgreSQL comparisons supply that
  evidence.
- The running page rendered its existing 100-row page and total of 639.
  Browser navigation completed page 1 → 2 → 1.
- Browser CSV and Excel downloads each contained 639 data rows. Their content
  matched apart from Excel's existing UTF-8 BOM. Filenames remained unchanged.
- A browser-generated PDF had a valid PDF signature, the 639-record subtitle
  and the existing wrapped Certificate No. column header.
- Live Certificate edits/uploads/deletions were not performed; those contracts
  were checked through isolated callbacks and existing write-service tests.

## Development measurements

Three warm service-call samples per scope, in milliseconds. These include
service/database work, not browser or end-to-end HTTP latency:

| Scope | Legacy median | SQL default-path median |
| --- | ---: | ---: |
| All vessels, first 100 rows | 63.58 | 19.01 |
| One vessel, first page | 56.38 | 8.69 |

These are a development snapshot, not a production performance guarantee.
The probe also reports the legacy complete vessel-data JSON representation
versus the current page response JSON representation. Those are different
diagnostic components, not a measurement of total wire bytes or heap usage.

Reproduce the read-only database comparison with:

```sh
node --import tsx scripts/verify-certificate-paging.ts
node --import tsx scripts/verify-certificate-numeric-fixtures.ts
```

Run the module tests with:

```sh
node node_modules/vitest/vitest.mjs run server/modules/cert-surveys/__tests__
```

## Remaining limitations

- Fully database-bounded scalar scope/order/count selection remains outstanding
  for explicit natural string/date-string sorts. It needs a verified design
  using the unchanged database configuration, not a behavior change or an
  assumption that the default/numeric SQL path completes the full task.
- Source-dependent ordering remains source-dependent; no new stability
  guarantee or tie-breaker was introduced.
- The large export request remains intentionally unbounded up to its existing
  requested limit of 100000.
- Project-wide TypeScript checking remains blocked by diagnostics in unchanged
  files, including PlannerDateInput, micro-frontend exports and other modules.
  No diagnostics were reported for the changed Certificate runtime files in the
  captured check.
- The browser retains its existing AG Grid licensing/configuration warnings.
  They were not changed as part of this loading-only work.
