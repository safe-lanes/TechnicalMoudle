# Certificate database pagination verification

## Implementation

The operational Certificates endpoint now performs vessel scoping, eligibility,
counting, every supported sort and page selection in PostgreSQL. Application
memory receives the count and selected response rows, not a complete candidate
array or an application-generated rank list. Attachment content is selected
only after the page is materialized.

Count and page reads share a read-only, repeatable-read transaction. Missing
saved vessel data remains optional. Existing field fallbacks, source-dependent
vessel/sequence ordering, stable sort ties, duplicate-data mapping and empty
response variants are preserved. No ID-based tie-breaker was introduced.

The user explicitly approved the dedicated database sorting rule. Migration
`188_certificate_natural_sort.sql` adds only the Certificate natural-sort
collation: ICU en-US, numeric ordering, base sensitivity, nondeterministic
comparison. Nondeterminism preserves case/accent/leading-zero equivalences as
ties; the prior vessel/sequence/source order resolves those ties.

The migration is idempotent and checks the existing object's configuration.
ICU's equivalent `kn-true` and canonical `kn` spellings are both accepted.
The text-sort path checks the Node runtime locale rather than silently assuming
that a different locale matches the dedicated en-US collation.

There is no hybrid fallback. Text/date-string fields use the collation before
paging; date strings remain strings, not chronological SQL date conversions.
Unknown sort fields retain their prior numeric-sequence fallback.

Frontend filter placement, expiry re-sorting of each received page, PDF/CSV/Excel
helpers, query keys, edit APIs, validation, compound identity, attachments and
the 5,000 ms cache invalidation behavior were not changed. Surveys, Defects,
Admin configuration, table definitions, indexes and dependencies were untouched.

## Verification

- **128 module tests passed.** SQL tests inspect scope precedence, count queries,
  sort whitelisting, collation-before-limit, selected-page attachment hydration,
  read-only snapshot use and response mapping.
- **56 development-database comparisons** matched the frozen legacy read oracle
  for page membership, order, values, attachments and response metadata.
- **1,926 isolated PostgreSQL fixture comparisons** matched the legacy oracle.
  They cover all supported text-sort fields and aliases in both directions,
  numeric/default/unknown sorts, page boundaries, leading zeros, case, accents,
  composed/decomposed Unicode, ligatures, Unicode vessel names and whitespace,
  false/NULL deletion flags, missing data, duplicate saved data, deleted/inactive
  masters and the no-eligible-master response variant.
- Fixture tables are connection-local and disappear on disconnect. No public
  Certificate records were inserted, edited or deleted for verification.
- Service-unit adapters provide fixture envelopes for delegation tests; the
  actual SQL algorithm is verified by the PostgreSQL comparisons above.
- Tests execute the actual unchanged browser Due In/page-sort and export-helper
  functions against old/new data. Each PDF, CSV and Excel handler is checked
  separately: PDF renderer inputs and CSV/Excel bytes/filenames match.
- Isolated callbacks verify compound-key editing, selective cache updates,
  refresh-timer reset at 5,000 ms, full attachment viewing/add/remove payloads
  and permission refusal. Live attachment edits/deletions were not performed.
- The running page rendered 100 rows with total 639 and navigated 1 → 2 → 1.
  Clicking the certificate-name header triggered the SQL text-sort API, whose
  response matched the legacy oracle.
- Browser CSV and Excel downloads each contained 639 data rows; content matched
  apart from Excel's existing UTF-8 BOM, with unchanged filenames.
- Browser PDF output had a valid PDF signature, the 639-record subtitle and
  the existing Certificate No. column header.
- Running the collation migration twice after installation succeeded, verifying
  its idempotence. Startup recorded the migration and the app served normally.

## Development measurements

Three warm service-call samples per scope; medians in milliseconds:

| Scope | Legacy | SQL paging |
| --- | ---: | ---: |
| All vessels, first 100 rows | 57.86 | 14.97 |
| One vessel, first page | 55.89 | 6.20 |

These include service/database work, not end-to-end HTTP or browser latency.
The diagnostic legacy vessel-data JSON source was 7,997,057 bytes; selected-page
response JSON was 582,087 bytes for all vessels and 14,301 bytes for one vessel.
Those are different diagnostic components, not total wire-byte/heap
measurements or a production performance guarantee.

## Reproduction

```sh
node node_modules/vitest/vitest.mjs run server/modules/cert-surveys/__tests__
node --import tsx scripts/verify-certificate-paging.ts
node --import tsx scripts/verify-certificate-numeric-fixtures.ts
```

The last script's historical filename is retained; it now tests every sort.

## Existing limitations outside this change

- Source-dependent legacy ordering remains source-dependent; there is no new
  stability guarantee across arbitrary physical/query-plan changes.
- Large exports retain their existing requested limit of 100000.
- Project-wide TypeScript checking still reports errors in unchanged modules;
  no diagnostics were reported for the Certificate files in the captured check.
- Existing AG Grid licensing/configuration warnings remain.
- Broader runtime-upgrade sorting fuzz tests and interleaved multi-connection
  snapshot tests would strengthen future regression protection.
