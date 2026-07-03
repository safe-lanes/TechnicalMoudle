# Phase 0 — `getPostgresClient()` call-site inventory (no code change)

Part D of the multi-tenant Phase 0 seam refactor. These call sites are **inventoried, not
migrated** in Phase 0. They use the synchronous `getPostgresClient()` accessor (which returns
the single cached `{ db, pool }` from `server/postgresClient.ts`).

**Phase 1 plan:** `getPostgresClient()` becomes ALS-aware (returns the request's tenant-cached
`{ db, pool }` when inside `runInTenantContext`, else the legacy single client). Because
`tenantMiddleware` pre-resolves + caches the tenant pool before `next()`, these **28 sites route
correctly with ZERO call-site edits** — that is why Phase 0 leaves them untouched.

Verified on `feature/multi-tenancy` (post Step-0 merge of `feature/replit-work`). Total: **28 calls / 11 files**.

| Count | File |
|------:|------|
| 8 | `server/modules/defects/repositories/defectAdminRepository.ts` |
| 7 | `server/modules/components/repositories/componentRepository.ts` |
| 3 | `server/modules/ranks/service.ts` |
| 3 | `server/modules/cert-surveys/services/certAdminService.ts` |
| 1 | `server/modules/ranks/repository.ts` |
| 1 | `server/modules/ranks/hodResolutionService.ts` |
| 1 | `server/modules/cert-surveys/services/surveyAdminService.ts` |
| 1 | `server/modules/cert-surveys/repositories/surveyRepository.ts` |
| 1 | `server/modules/cert-surveys/repositories/surveyAdminRepository.ts` |
| 1 | `server/modules/cert-surveys/repositories/certificateRepository.ts` |
| 1 | `server/modules/cert-surveys/repositories/certAdminRepository.ts` |

Re-run the inventory:
```
grep -rc "getPostgresClient(" server/ --include="*.ts" | grep -v ":0" | grep -v "postgresClient.ts"
```

---

## tsc baseline for `feature/multi-tenancy` = **292** (NEW, adopted after Phase 0)

`npx tsc --noEmit 2>&1 | grep -c "error TS"`

| Branch / state | Baseline |
|---|---|
| `replit_dev` / pre-Phase-0 `feature/multi-tenancy` | 369 |
| **`feature/multi-tenancy` from Phase 0 (`4a6e875e0`) onward** | **292** |

**Why it dropped (not a mystery):** Phase 0 added **zero** new errors (verified by a normalized
diff of the error sets — empty "new" set). The 369→292 drop is **77 `TS18048: 'db' is possibly
'undefined'` eliminations**: the eager `db` export in `server/db.ts` is typed `… | undefined`, so
every `db.select()/insert()/update()` on it was flagged possibly-undefined. Routing through
`await getDb()` (which returns a non-undefined db, throwing if unavailable) makes the type
accurate and those errors vanish. Runtime is byte-identical — same single cached pool.

**Rule for subsequent phases (1–6) on this branch:** verify against **292**, not 369. Any phase
that pushes the count **above 292** has introduced a real error to investigate — it no longer
hides in old `db`-undefined noise. (Flag-off must still hold ≤ 292; flag-on tenant code is
additive and must not regress it.)
