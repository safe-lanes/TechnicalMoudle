# Certificate loading verification

## Scope and implementation deviation

Only the operational Certificate read path changed. Frontend code, write APIs,
Surveys, Defects, Admin configuration, schema, indexes and dependencies were not
changed.

Attachment content is fetched only after SQL selects the requested rank window.
Missing vessel data still produces blank values and an empty attachment array.
Applicability, metadata, ordering and attachment hydration share a read-only,
repeatable-read transaction.

**This is compatibility-preserving hybrid paging, not fully database-bounded
scalar loading.** Applicability and lightweight vessel metadata are still read
without vessel/page restriction. Existing scope filtering, row construction,
JavaScript sorting and counting remain in application memory. SQL receives
ordered lightweight identities and selects the page before reading attachments.
Consequently, scalar read volume and sorting memory still grow with the dataset.

This differs from an entirely SQL-side scope/order/count implementation. The
existing natural, case-insensitive JavaScript comparator and unspecified source
order were retained rather than silently substituting a SQL collation or adding
a tie-breaker. No universal SQL ordering-equivalence claim is made.

## Checks

- The Certificate-module test suite covers old/new page membership, ordering,
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

| Scope | Legacy median | Hybrid median |
| --- | ---: | ---: |
| All vessels, first 100 rows | 55.77 | 21.54 |
| One vessel, first page | 61.85 | 11.29 |

The JSON representations of the vessel-data reads measured:

| Scope | Legacy complete vessel-data read | Lightweight metadata + selected attachments |
| --- | ---: | ---: |
| All vessels, first page | 7,997,057 bytes | 583,948 bytes |
| One vessel, first page | 7,997,057 bytes | 36,436 bytes |

These are diagnostic JSON-size comparisons, not measured wire bytes or heap
usage. They exclude applicability/master reads and rank parameters. They are a
development snapshot, not a production performance guarantee.

Reproduce the read-only database comparison with:

```sh
node --import tsx scripts/verify-certificate-paging.ts
```

Run the module tests with:

```sh
node node_modules/vitest/vitest.mjs run server/modules/cert-surveys/__tests__
```

## Remaining limitations

- Fully database-bounded scalar scope/order/count selection remains outstanding;
  it needs a separately verified ordering-compatible design.
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
