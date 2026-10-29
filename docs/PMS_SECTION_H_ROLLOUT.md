# Section H — implementation and controlled rollout

## Confirmed scope and security decisions

The latest user clarification on 29 October 2026 supersedes the earlier Component-edit-permission restriction: **all verified Office users** may manage Section H for **all vessels**, regardless of role name or Component menu view/edit/create/delete flags. Ship users remain read-only, retain the existing Component view-permission check and require an active vessel assignment. Other initial-release functional/master/audit rules remain unchanged.

Section H uses a resource-local Office entitlement for record access, removed-record reads and every lifecycle mutation, including service-layer checks. Production requires a verified Office session; the explicitly approved Replit default-user path below is a separate development exception, not a verified production session. There is no admin shortcut to Ship or arbitrary mock/absent/spoofed identities, and no global permission-framework or legacy-admin-alias changes. Permission to maintain regulatory master data remains separate; selecting existing society/type values does not grant master maintenance rights.

`tenantMiddleware` verifies a SAILERP JWT and supplies `verifiedUser`. Section H reuses that context where present. Its resource-local adapter also verifies standalone Bearer tokens with the same configured JWT_SECRET/HS256 policy and maps the signed configurable id claim through the existing non-deleted `master_users.id` lookup. No JWT `sub`, email or default-user substitution is performed. Missing signed role/type can use the existing master-user lookup; missing or ambiguous identity is refused. Unknown standalone users are refused. Database lookup outages are 503, not an invalid-token fallback.

Optional browser identity headers are not required when a real verified session exists. Contradictory user/role/type headers are refused. The default mock user's UUID is not compared to the signed canonical id when no identity header was supplied. Only Section H request-local RBAC is derived from the verified actor; global authentication and the global pass-through admin alias are unchanged. Forced mock-RBAC mode cannot obtain verified write access.

### Approved two-environment access selection

The latest user direction supersedes the earlier read-only-only preview policy:

| Environment | Section H identity |
|---|---|
| Browser `VITE_APP_ENV === "replit"` | AuthContext's default workspace user, even if a stale stored production profile exists |
| Missing/different browser flag | Existing AuthContext encrypted `userProfile` / `userType` flow, with the existing encrypted credential transport and no default-user fallback |

The single default-user definition is in `shared/developmentUser.ts`, consumed by AuthContext and the server. Section H alone gets `sectionHUser`; global `currentUser`, other module access, authentication aliases and master-maintenance permissions are unchanged. AuthContext must finish hydration and an explicit logout disables the development identity, requests and controls. A later real login clears the existing logout marker. Development selection does not claim that a browser profile is verified authentication.

Section H requests explicitly select `x-section-h-development: default-user` and send the selected default UUID/role/type. These are **not security credentials**. The server accepts this selection only when its own `NODE_ENV=development`, its own `VITE_APP_ENV=replit`, and multitenancy is disabled. A production server refuses it even if the browser bundle contains the flag or a caller forges headers. No client parameter alone enables this exception.

This deliberately provides no individual authentication inside the approved Replit preview: anyone who can access that development server can select the same configured default actor and exercise that actor's Office rights, subject to validation and historical UUID integrity checks. Restrict preview sharing accordingly and never point this development profile at production data. Canonical audit attribution identifies the configured default user, not the individual browser visitor.

The server constructs the actor from the shared default-user definition, never from browser role/type/UUID values, and requires every forwarded value to match it. The configured user must be active, have a canonical UUID and match a non-deleted `master_users.id` record of the same Office/Ship type; lookup failure is refused, not auto-provisioned. Returned identity mode is `replit-default`, not `verified`. Service-layer entitlement rechecks the server environment, default identity and Office type; Ship has no write shortcut.

An already verified integrated identity is never upgraded through the development selector. In standalone Replit, explicit default-user selection takes precedence over stale browser Bearer credentials, just as it takes precedence over a stale stored profile. The global fetch interceptor has a narrowly scoped transport exception: only Replit Section H/default-selected regulatory master reads omit stored or explicitly supplied Authorization, including still-valid tokens for a different user; all other requests keep normal Bearer injection. The server still independently enforces its own development configuration and never upgrades an already verified Ship context. Absent the selector, existing invalid/expired-token rejection still applies. Outside Replit the normal verified-session path remains unchanged.

All lifecycle operations retain canonical actor audit attribution, server-owned component/vessel scope, transactionality and historical UUID integrity checks. Normal editing does not require manual per-vessel rollout approval. The approved development identity is not approval to reconcile production data, provision a vessel installation or bypass receiver compatibility. Office removed-record visibility remains independent of historical UUID write readiness.

Historical inspection before removal of the rollout restriction found the default UUID mapped to an Office master user, no missing historical regulatory UUIDs and no readiness setting. The former implementation returned `ROLLOUT_PENDING`; this was an implementation-added restriction, not a business requirement. That behavior is superseded: absence of a readiness setting no longer affects editing. Full lifecycle persistence is exercised with session-local TEMP tables, not by changing shared business records.

### Legacy standalone development read-only option

`PMS_SECTION_H_DEV_READONLY=true` is an explicit non-secret **development-environment-only** opt-in. The code defaults it OFF, requires `NODE_ENV=development`, and refuses this mode whenever multitenancy is enabled. Do not enable it against production data or put it in a shared/production environment.

When deliberately enabled for an approved development dataset, GET active records and GET access use a fixed server-owned Office development viewer, never browser headers. The access response identifies `identityMode=development-readonly`, `canView=true`, `canViewRemoved=false`, `canEdit=false` and explains: "Development preview — read-only. No verified Office session was received. Sign in through the integrated application to edit; the default preview user cannot authorize changes." Anyone who can open that shared preview can view this profile's active records; there is no claim that this is a real authenticated Office user.

All mutations and removed-record reads remain refused to that profile, even with forged admin headers or a ready-vessel setting. Present invalid/expired Bearer tokens never fall back to development viewing. Production refuses the development mode even if the control is mistakenly set. The banner now explicitly names the missing verified session rather than suggesting Office business entitlement was refused.

### Production session prerequisite

Outside the approved Replit exception, the frontend reads encrypted credentials from sessionStorage, then localStorage, and attaches a bearer only to same-origin API calls. Reading encrypted `userProfile` is the UI identity source, not proof of a valid server session.

Use the existing integrated login and matching verification configuration, including canonical user mapping, for production Office access. Do not mint test credentials for the shared application or expose the development exception to production. Genuine integrated Office/Ship browser lifecycle verification still requires approved real sessions; the new Replit default-user path is separately labelled and tested.

### View and edit are independent

Normal record loading applies the Section H entitlement and component/vessel scope, but does not depend on historical UUID reconciliation or per-vessel write activation. Every verified Office user can view active and removed entries without Component menu permissions; verified Ship users remain read-only with existing view permission and active vessel scope. The access response includes `canView`, `canViewRemoved`, `canEdit`, `identityMode` and `reasonCode`, distinguishing development read-only, vessel read-only and reconciliation pending. Office write controls remain disabled while historical UUID reconciliation is pending, but this does not suppress Show removed. There is no readiness-setting dependency. Existing record-array responses remain unchanged.

The UI displays safe specific errors, a truthful successful-empty state, and independent records/access retries. Failed edit/access checks retain a draft without enabling Save. Cache keys for records/access and form master choices partition by viewer, role/type, tenant, vessel scope and auth-session generation; old record caches including removed entries are cleared on session changes. Access refreshes use active-only reads until removed-record access is freshly confirmed.

This access correction adds no SQL, table, column, backfill, migration replay, write activation, or synchronization changes. It does not enable the deferred historical finalization or claim live integrated Office/Ship session evidence.

Office scope is all vessels under the confirmed policy. Ship scope uses active `master_user_vessels` assignments; these are login-captured and must be refreshed by the existing integration. This change does not assert their freshness or redesign login/user administration.

## Delivered database files

- `migrations/185_component_class_regulatory_identity_lifecycle.sql`: nullable TEXT UUID, deletion actor/time, nullable-compatible UUID unique index. Existing integer id and component UUID FK remain.
- `migrations/186_section_h_master_metadata.sql`: stable society/type TEXT keys, nullable master country/category/description, conditional master updated_at alignment.
- `migrations/187_section_h_master_seed.sql`: 19 society/46 survey values; stable registry UUIDs; conflict-safe insertion with one canonical RINA.

All are file-based, idempotent SQL batches with transaction-level advisory locks and the established runner's tracking. No historical UUIDs are randomly generated, no legacy dates converted, no tables replaced, no new application tables created. New API records receive a UUID once in the trusted service.

`migrations/188_component_class_regulatory_identity_finalize.sql` is deliberately **NOT delivered into the auto-executed root** in this release. Its later authorized release must assert all records including removed rows have unique valid UUIDs, then add NOT NULL and the approved `gen_random_uuid()::text` future-insert default. Existing unique index already prevents duplicate known identities while permitting historical NULLs. Do not mark finalization performed or all installations upgraded based on this delivery.

## Historical reconciliation: operator procedure

Chosen utility: `scripts/reconcile-section-h.ts`. Reviewed input: a private, installation-specific JSON mapping file supplied with `--map`; never commit inventories/mappings. The utility does not infer matches or generate historical UUIDs.

1. Pause Section H edits/sync on the explicitly authorized shore/vessel installations; record their code versions/schema and back up through existing operations.
2. Apply additive schema first. Do not activate new payloads on old receivers.
3. Run `npx tsx scripts/reconcile-section-h.ts --inventory` on each authorized target. Output contains local id, component UUID, vessel code, saved UUID and snapshot hash; treat it as private operational data.
4. Review counterpart records, including removed records. Assign one shore-authoritative UUID to each logical entry and map its installation-local ids. Identical society/type alone is NOT identity; distinct certificates stay separate. Unmatched/ambiguous records require explicit human resolution, not deletion or deduplication.
5. Mapping JSON is an array of `{localId, componentId, vesselCode, ccruuid, expectedSnapshotSha256}`. Use each target's own inventory/hash. Run `npx tsx scripts/reconcile-section-h.ts --map /private/mapping.json` for a read-only validation.
6. After explicit authorization run the same command with `--apply`. It locks entries, refuses duplicate IDs/UUIDs, changed snapshots/ownership and reassignment of known identities; fills only NULL UUIDs. Replaying the same mapping is safe. It preserves business update stamps and emits no artificial field-log history.
7. Arrange verified initial delivery/re-provisioning or an explicitly reviewed reset of the Section H table checkpoint through existing sync operations. A UUID-only backfill deliberately does not advance business timestamps: normal incremental polling alone is NOT evidence it was delivered.
8. Test both sides, authorize and separately release migration 188 only once mapping/completeness and mixed-version gates pass. Retain additive columns/mapping evidence on rollback; never switch back to natural-key matching after UUID activation.

The API refuses Section H mutations while any historical NULL identity remains. This is a safety gate, not an instruction to fill independent random UUIDs on each installation.

### Removed per-vessel editing restriction

The user explicitly rejected the implementation-added `section_h_ready_vessels` allowlist. Section H no longer reads it for access, create, update, soft-delete or restore, and no longer emits `ROLLOUT_PENDING`. Office users manage records across vessels without assignments or per-vessel activation; Ship users remain read-only within their existing viewing scope. Existing historical NULL UUID checks, parent validity, business validation and atomic audit remain enforced.

The obsolete-setting cleanup was **Replit-only**, not a general migration for other installations. The previously applied `migrations/189_remove_section_h_ready_vessels.sql` has been removed from the distributed migration directory; its replay test has also been removed. No replacement migration, environment-gated cleanup, startup hook or provisioning deletion is provided. Existing stale setting rows on other installations can remain because Section H ignores them.

Leave already-applied migration-history entries intact, including Replit's `189_remove_section_h_ready_vessels` entry. Removing the source file does not undo past execution or require database-history changes. Do not reuse that migration identity or renumber other files. No new schema or data change is needed; number 188 remains reserved for the separately authorized historical-identity finalization described above.

This changes saving/access, not sync delivery: capability `component_class_regulatory_uuid_v1`, receiver schema and dependency checks, UUID-only identity, timestamp/replay guards, provisioning validation and failure-safe checkpoints remain required. No replacement readiness key is introduced, sync direction remains shore-to-ship, and no artificial field logs are added.

## Transport, provisioning and field-log matrix

| Write path | Delivery / history |
|---|---|
| H create/edit | Stable UUID, server-owned component/vessel, updated_at and trusted actors, transactional audit |
| H soft-delete/restore | Same UUID; deletion actor/time and explicit NULL clearing; audit and one-way extraction |
| Shared masters create/edit/retire | Stable list type/key, advance updated_at, preserve origin; no unrelated type lifecycle change |
| H receiver/replay | UUID-only lookup; full-precision DB timestamp guard; no local-clock overwrite, no origin attribution or field-log echo |
| Historical UUID mapping | Controlled metadata migration, no fake business field logs; explicit initial delivery required |
| Actual BOTH_EDITABLE paths | Existing field logger required when such paths are affected; this release adds no regulatory child Modify PMS workflow |
| Bulk/import/raw SQL | No new H import contract; utility/seed/update watermark behavior is explicit |

Section H and regulatory masters remain ONE_WAY_SHORE_TO_SHIP. The existing logger emits records only for BOTH_EDITABLE; a no-op logger call would not deliver H. Lifecycle `audit_log` is not `sync_field_log`. No global logger guard/direction has been changed. Required mutation and audit insert share the same transaction and roll back together.

Incremental pull advertises/requires `component_class_regulatory_uuid_v1`. Shore refuses to deliver H rows to peers without it; receivers refuse old identity-less snapshots, missing schema, unresolved local identities, missing dependencies and ownership changes. Failed deliveries do not advance the table checkpoint.

Provision generation with H rows requires the operator-confirmed `receiverCapabilities=component_class_regulatory_uuid_v1` query parameter on its existing generate/download route. Supply this only after inspecting the receiving installation. The bundle records the requirement. Legacy bundles with H rows and no UUID contract are refused before receiver cleanup. Imports apply H through the same UUID-only handler and preserve installation-local ids. Preview requests without receiver confirmation also refuse H-containing bundles rather than silently creating unsafe data.

Provisioning retains its existing active-row snapshot policy. Removed entries already on a vessel retain their UUID; missing tombstones are safe full-row inserts on incremental delivery, and later restore arrives with the same shore identity. No active-row snapshot alone is claimed to contain the complete removal history.

## Functional behavior and regression boundaries

- All active entries display; same society/type/certificate values are not natural uniqueness rules.
- Per-entry save/cancel, draft retention, safe errors, saved-parent prerequisite, read-only vessel access and authorized removed-entry restore.
- Society/type keys resolve within their fixed master types; Class Code is server-derived. Historical snapshots/retired references remain readable; new/changed choices must be active.
- DD-MM-YYYY UI only. Preserve untouched strings/timestamps and hidden legacy fields. Unchanged invalid historical dates are readable with warning and may survive unrelated edits; new invalid dates fail. Last <= Next when both parse; equality allowed.
- Class Item No keeps H visible with a notice. Existing report class-item population, columns, entry expansion, placeholder and removal exclusion remain unchanged.
- Regulatory master keys are immutable; retirement does not destroy referenced history. Country/category/description controls reuse the existing Components master grouping.
- Attachments/file sync, regulatory Modify PMS approvals and survey colours are deferred, not partially delivered.

## Completion evidence and remaining environment gates

Record focused test/build results in the delivery response. Cross-installation inventory, mapping, remote migrations, authenticated production session checks, separately released finalization and actual shore–vessel rollout require authorized target evidence. They are not inferred from local tests and no production/vessel operation is authorized or claimed here.

### Removal of the distributed Replit-only cleanup file

- After removal, six focused suites passed, 89 tests total. The only removed test was the obsolete cleanup-file replay test; Office/Ship lifecycle, ignored readiness values, audit, UUID and sync/replay coverage remain.
- The SQL file is absent, and a search of server, scripts and migrations found no executable references to its migration identity or replacement deletion of the obsolete setting.
- No database settings, migration-history rows or live business data were changed for this removal. No application runtime code changed, so no workflow restart or migration execution was needed.

### Historical readiness restriction removal verification (Replit-only cleanup)

- Six focused suites passed, 90 tests total, including real PostgreSQL TEMP-table lifecycle tests without any readiness setting, ignored empty/malformed/stale values, cross-vessel non-admin Office editing, Ship denials, canonical audit, stable UUIDs and full-row sync/replay behavior.
- Before its source file was removed, the Replit-only cleanup migration was replayed twice against session-local TEMP settings; the obsolete row was removed and an unrelated setting remained byte-for-byte unchanged. This is historical evidence, not an instruction to replay the removed file.
- The existing Replit development migration runner recorded `189_remove_section_h_ready_vessels` as applied. The obsolete key was already absent; all 14 other settings retained the same complete-row fingerprint before and after startup. That history is retained; the cleanup is no longer distributed.
- Live development access responses for Alejandro / 271.010 RUDDER and a component on Vessel 8 both returned `identityMode=replit-default`, `canEdit=true`, `canViewRemoved=true`, `reasonCode=EDIT_ALLOWED`.
- Frontend production build and backend bundle completed. The workflow restarted successfully and the Component page rendered. The existing Add Entry control remains governed by the server's `canEdit` response; no client permission override was added.
- No live classification business record, production installation or physical vessel was modified or synchronized during verification. Actual integrated-production sessions and physical shore/vessel delivery are not claimed by these local checks.

### Historical environment-specific access verification (before restriction removal)

- Nine focused suites passed, 116 tests total: source precedence, logout, request transport, production/multitenant rejection of development access, forged headers, verified Ship denials, canonical identity mapping, TEMP-table lifecycle/audit/readiness and existing synchronization invariants. A real client/interceptor/HTTP-server integration test supplies a valid non-default Ship token and verifies it is not forwarded to the explicitly selected Replit default-user path; normal-module and production requests retain their token.
- Production build passed. Repository type checking still reports 39 pre-existing diagnostics, none in this change's files.
- After restarting the app, a fresh browser selected Alejandro / 271.010 RUDDER and confirmed the actual access request used the default-user selector and returned `identityMode=replit-default`, `canView=true`, `canViewRemoved=true`, `canEdit=false`, `reasonCode=ROLLOUT_PENDING`. Records loaded normally, Show removed worked, no write controls appeared and refresh retained the same correct outcome.
- Explicit browser logout followed by reload remained signed out without issuing a new Section H request or restoring the default user.
- No live business record was created/changed during browser verification. Ready-vessel CRUD was verified only in session-local PostgreSQL TEMP tables. No readiness activation, schema/migration change, production session verification or physical shore/vessel rollout was performed.
