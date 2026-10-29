# Section H — implementation and controlled rollout

## Confirmed scope and security decisions

The user confirmed on 29 October 2026: use existing Component **edit permission**, not an office-admin role allowlist; authorized Office users may manage entries for **all vessels**. Ship users remain read-only and reads require an active assignment. Other proposed initial-release functional/master/audit rules were approved.

The existing permission framework treats genuine Sail Admin/PMS Admin as having Component edit rights; this resource follows that existing policy, only AFTER verified identity and Office checks. It does not extend these shortcuts to Ship, mock, absent or spoofed identities.

`tenantMiddleware` already verifies a SAILERP JWT and supplies `verifiedUser`. Section H uses that existing context, requires it to match `req.rbac` and canonical user UUID, and never authenticates from x-user-* headers alone. No secrets or environment settings were changed. A standalone session, source mock/none, mismatched claims, absent JWT verification or missing claims is refused. Single-tenant deployments without this verified context need a separately reviewed authentication adapter; do not disable the guard to make a demo editable.

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
