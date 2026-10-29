# Section H — implementation and controlled rollout

## Confirmed scope and security decisions

The latest user clarification on 29 October 2026 supersedes the earlier Component-edit-permission restriction: **all verified Office users** may manage Section H for **all vessels**, regardless of role name or Component menu view/edit/create/delete flags. Ship users remain read-only, retain the existing Component view-permission check and require an active vessel assignment. Other initial-release functional/master/audit rules remain unchanged.

Section H uses a resource-local verified-Office entitlement for record access, removed-record reads and every lifecycle mutation, including service-layer checks. It grants no admin shortcut to Ship, mock, absent or spoofed identities and does not change the global permission framework or legacy admin aliases. Permission to maintain regulatory master data remains separate; selecting existing society/type values does not grant master maintenance rights.

`tenantMiddleware` verifies a SAILERP JWT and supplies `verifiedUser`. Section H reuses that context where present. Its resource-local adapter also verifies standalone Bearer tokens with the same configured JWT_SECRET/HS256 policy and maps the signed configurable id claim through the existing non-deleted `master_users.id` lookup. No JWT `sub`, email or default-user substitution is performed. Missing signed role/type can use the existing master-user lookup; missing or ambiguous identity is refused. Unknown standalone users are refused. Database lookup outages are 503, not an invalid-token fallback.

Optional browser identity headers are not required when a real verified session exists. Contradictory user/role/type headers are refused. The default mock user's UUID is not compared to the signed canonical id when no identity header was supplied. Only Section H request-local RBAC is derived from the verified actor; global authentication and the global pass-through admin alias are unchanged. Forced mock-RBAC mode cannot obtain verified write access.

### Standalone development read-only option

`PMS_SECTION_H_DEV_READONLY=true` is an explicit non-secret **development-environment-only** opt-in. The code defaults it OFF, requires `NODE_ENV=development`, and refuses this mode whenever multitenancy is enabled. Do not enable it against production data or put it in a shared/production environment.

When deliberately enabled for an approved development dataset, GET active records and GET access use a fixed server-owned Office development viewer, never browser headers. The access response identifies `identityMode=development-readonly`, `canView=true`, `canViewRemoved=false`, `canEdit=false` and explains: "Development preview — read-only. No verified Office session was received. Sign in through the integrated application to edit; the default preview user cannot authorize changes." Anyone who can open that shared preview can view this profile's active records; there is no claim that this is a real authenticated Office user.

All mutations and removed-record reads remain refused to that profile, even with forged admin headers or a ready-vessel setting. Present invalid/expired Bearer tokens never fall back to development viewing. Production refuses the development mode even if the control is mistakenly set. The banner now explicitly names the missing verified session rather than suggesting Office business entitlement was refused.

### Standalone preview prerequisite

The frontend already reads encrypted credentials from sessionStorage, then localStorage, and attaches a bearer only to same-origin API calls. On Replit, absent credentials intentionally retain the default mock profile rather than redirecting to a real login. That Office-looking profile does not create a verified server session. At the access correction's development inspection, the supported configuration check reported no JWT_SECRET; no secret value or browser credentials were retrieved.

Use the existing integrated login and matching verification configuration, including the canonical user mapping, to establish a real Office session. Do not mint a test token for the shared application, enable mock writes, or change the default user to work around this prerequisite. Genuine Office/Ship browser lifecycle verification is unavailable until approved real sessions exist; the development banner is expected to remain in the unsigned standalone preview. A separate development-only authenticated editor mechanism requires review before implementation or activation.

### View and edit are independent

Normal record loading applies the Section H entitlement and component/vessel scope, but does not depend on historical UUID reconciliation or write activation. Every verified Office user can view active and removed entries without Component menu permissions; verified Ship users remain read-only with existing view permission and active vessel scope. The access response includes `canView`, `canViewRemoved`, `canEdit`, `identityMode` and `reasonCode`, distinguishing development read-only, vessel read-only, reconciliation pending and rollout pending. Office write controls remain disabled until reconciliation/readiness gates pass, but those write gates do not suppress Show removed. Existing record-array responses remain unchanged.

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

There is also a fail-closed per-vessel activation gate in existing instance-local `sync_settings`: `section_h_ready_vessels`, a JSON array of reviewed vessel UUIDs. No value is seeded or enabled by this implementation. After verifying authorization, audit, schema, mapping and peer capability, an authorized operator may record only those ready vessel UUIDs through approved operational procedures. Missing/malformed configuration leaves writes disabled, including for a new empty table. Do not add a wildcard or expose this gate as an ordinary master-data edit.

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
