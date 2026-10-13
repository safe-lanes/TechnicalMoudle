# AuthContext metadata verification

## Scope

Production changes consist solely of fifteen added properties in the existing
three user object literals in `client/src/contexts/AuthContext.tsx`.

- Development default and encrypted-profile hydration synthesize `isSync`,
  `createdByUuid`, `updatedByUuid`, `isDeleted`, and `sortOrder` as null.
- Explicit login copies those five properties with `?? null`, retaining false,
  zero, explicit null, strings, and nonzero ordering. Missing/undefined legacy
  properties become null.
- The field-by-field allowlist remains intact; passwords and arbitrary extra
  fields are still excluded.
- Metadata is inert: even `isDeleted: true` does not reject login or change
  `isActive`. Audit metadata is not used as the active identity.
- Reload still synthesizes null metadata from the encrypted profile. This
  change adds no metadata persistence or storage writes.

No schema, authentication control flow, role mapping, API/header construction,
dependency, or compiler/test-runner configuration was changed.

## Compiler comparison

Command before and after:

```bash
npx tsc --noEmit --incremental false --pretty false
```

| Inventory | Count |
| --- | ---: |
| Baseline diagnostics | 120 |
| Remaining diagnostics | 117 |
| Removed AuthContext TS2322 diagnostics | 3 |
| Added diagnostics | 0 |
| Changed full messages among remaining diagnostics | 0 |
| Independent concurrent diagnostic changes | 0 |

Removed baseline locations in `client/src/contexts/AuthContext.tsx`:

| Construction | Baseline line:column | Corresponding new line:column | Code |
| --- | --- | --- | --- |
| Development default | 87:7 | 87:7 | TS2322 |
| Encrypted-profile user | 329:7 | 334:7 | TS2322 |
| Explicit login sanitizer | 422:11 | 432:11 | TS2322 |

Each removed diagnostic reported missing `isDeleted`, `createdByUuid`,
`updatedByUuid`, `isSync`, and `sortOrder` on `PublicUser`. Comparison used file,
line, column, code, and the **full multiline diagnostic message**, with unchanged
source-line mapping to account for insertions. All 117 unrelated diagnostics
matched. The full compiler remains nonzero because these unrelated errors are
out of scope, not because the three AuthContext errors remain.

Full local evidence is retained in the ignored
`generated-artifacts/auth-metadata/` directory: `compiler-before.txt`,
`compiler-after.txt`, `compiler-comparison.json`, `AuthContext.before.tsx`, and
`tests.txt`. Generated evidence is excluded from Git and deployment.

## Offline regression results

```bash
npx vitest run server/__tests__/authContextMetadata.test.ts
```

Result: **30 passed** using the unchanged existing Vitest configuration.

The harness executes actual provider TSX in an isolated VM, supplies deterministic
React hooks and view-mode outputs, runs real encryption/decryption on fixture-only
storage, and replaces all external side effects with recorded fakes. It denies
unlisted imports and exposes no network/process globals. Differential checks
reconstruct the pre-change provider by removing exactly the fifteen additions
and compare all old user fields, role/view-mode inputs, document/data decisions,
storage reads, and side-effect order/payloads.

Coverage includes:

- Fresh Replit default and unknown synthesized metadata.
- Ship, Office, and Sail Admin encrypted hydration and explicit login.
- True/false/null flags; zero/nonzero/null ordering; audit UUID strings, empty
  strings, and null; absent and explicitly undefined legacy fields.
- Password/arbitrary-property rejection and inert supplied deletion metadata.
- Missing, undecryptable, or plaintext-only profiles; incomplete encrypted
  inputs; production signed-out and intentional-logout suppression.
- Active identity inputs installed before capture, rank-scoped query predicates,
  capture payload/count/guard behavior, unchanged user state-update counts, and
  clearing/re-establishing the same-tab capture guard on logout/login.
- Existing encrypted domain hydration and logout storage clearing.

These are offline source-level provider tests, not a browser React integration,
live SSO test, or server authorization proof. The view-mode hook is mocked; its
implementation and the active-identity header implementation are untouched.

Consumer recheck found no direct `currentUser` reads of the five metadata keys
and no whole-user serialization/spread. UI-role resolution still uses
`role`/`userType`; active identity still uses UUID/name/email/type/role only.
Purchasing still reacts to the whole user object, so preserving one user state
update per construction path remains important.
