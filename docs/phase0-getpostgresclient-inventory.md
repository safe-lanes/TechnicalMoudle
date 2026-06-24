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
