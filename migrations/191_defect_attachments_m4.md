# Defect attachment upgrade — capacity acceptance and release review

Date: 2 November 2026. This is a delivery report/runbook, **not another database migration**.

## Release decision

Development acceptance is complete. **Do not deploy/publish until the final review approves production release.** No real vessel was activated for testing. There are no manual feature switches, readiness allowlists or gate-management APIs.

The only SQL migration remains `migrations/191_defect_part_c_attachments.sql`: idempotently add `defects.part_c_attachments`, default `[]`, with no evidence backfill, conversion or movement. No migration 192 is required.

## Measured five × five MB scenario

Test: `server/modules/sync/__tests__/defectAttachmentCapacity.integration.test.ts`.

Two isolated PostgreSQL schemas and distinct private local storage roots represented shore and vessel. Real HTTP multipart uploads invoked production authorization, staging, existing-defect save/commit and `PostgresStorage` persistence. The strict authenticated production handshake/file controllers and worker transferred bytes over HTTP.

Five valid PDFs of **5,242,880 bytes each** were uploaded from shore, committed and transferred to vessel. Five separate attachment identities using the same five PDF contents were then uploaded from vessel, committed and transferred to shore. Total source file content: **52,428,800 bytes (50 MiB)**. All ten receiver copies matched their source SHA-256 hashes.

| Observation | Actual result |
|---|---:|
| Multipart requests accepted | 10, each HTTP 201 |
| Largest multipart body in fixture | 5,243,314 bytes |
| Ship → shore chunk requests | 400 (80 per PDF) |
| Shore → ship reads | 400 chunks; five receiver hashes matched |
| Largest chunk request body | 87,980 bytes |
| Largest metadata request body | 27,986,542 bytes |
| Largest HTTP response body | 13,986,118 bytes |
| Total HTTP requests | 837 |
| Status totals | 826 × 200; 10 × 201; 1 expected 409 |
| Shore → ship resumable cycles | 3 files, then 2 files; remaining 2, then 0 |
| Ship → shore resumable cycles | 3 files, then 2 files; remaining 2, then 0 |
| Stale same-list update | HTTP 409 `DEFECT_STALE`; newer list preserved |
| Remove one, then remaining four; apply metadata | Final C1 list empty on both installations |
| Old inline A/B documents | Byte-for-byte unchanged |
| Earlier committed external documents | Still readable internally; not physically purged on list removal |

The metadata measurement deliberately retained one existing 5 MiB inline file in A and another in B. The envelope included actual field logs (including old/new JSON values) and a full-row copy. These old inline values explain the larger metadata/save responses; the **new external file bodies were not embedded in Defects JSON or field logs**.

The metadata HTTP adapter called production `applyFieldLogInserts`/`SyncEngine.applyFieldLog` against an already-established parent. It is not a full end-to-end test of the production push/pull routing, full-row recovery, acknowledgement, TLS/tenant forwarding or infrastructure.

The capacity actor was a verified Office Master on both installation roles. Ship-user assignment checks are covered by separate access tests, not by this capacity actor. The harness used isolated protocol role bindings and the development field-logger identity; it did not exercise real installation startup identity configuration.

The application JSON parser is configured for 100 MiB (104,857,600 bytes); the measured JSON bodies passed that same limit. This does **not** establish a global maximum for arbitrary existing legacy batches. Older inline data and old/new logs can still enlarge other batches. Verify actual production reverse-proxy/body limits; do not solve this by dropping legacy data or silently acknowledging undelivered logs.

Machine-readable measurements are in the ignored generated output `generated-artifacts/defect-attachments/m4-capacity.json`. Large fixture PDFs are generated output, not application assets or Git content. Fixture schemas/private roots are removed after the test.

### Capacity defect corrected

A partially completed transfer could exhaust its time budget and return zero remaining because the count reused the “time remaining” predicate. The worker now checks compatibility separately from its work deadline and still counts eligible pending transfers. The scenario then completed over two cycles per direction instead of falsely ending the drain.

The focused budget-expiry regression additionally checks that two remote and one local eligible files remain counted when no more work can be done in that cycle. Missing-parent/held files remain excluded as before.

### Preview proxy control

A real HTTPS request through the Replit development preview sent a complete **5,243,374-byte multipart body** containing one exact-limit PDF. The actual C1 endpoint returned HTTP 409 `DEFECT_FILES_UNAVAILABLE`: **“No authenticated peer report has been received.”**

This confirms that this preview proxy passed the multipart body to the application and that automatic readiness refused C1. It is **not** a successful live C1 save or a production proxy/storage test. No fake readiness reports were inserted into real data, and no public Defect row was created.

## Other acceptance coverage

- Mixed-version migration191 retry retains unknown C1 field logs rather than skip-and-ack; readiness withholding protects empty arrays as well as populated arrays.
- Legacy evidence uses same-defect C1 → B → separate `defect_attachments.datuuid`, labelled **Legacy evidence**, including PDF and verification. No filename guessing or migration rewrite.
- New API choices cannot introduce Part B IDs; saved older IDs and older vessel sync remain readable. Stale new B choices ask the user to refresh.
- Strict chunks: owning vessel/parent/section, immutable descriptors/bytes, bounded decoding, hashes, duplicate completion, restart progress, safe private paths and receiver-local backend receipts.
- Three actual errors cause visible **“Transfer failed – contact support”**. Missing parent (425), compatibility loss and old retry generations do not exhaust attempts. Shore-only verified Office Sail Admin/PMS Admin retry is audited; Offline Admin, vessel-side retry and forged tokens are rejected.
- Fairness: more than 50 held Section H rows cannot hide eligible Defect transfers. No new Defect bytes use the generic legacy file endpoints.
- Existing Work Order, Component and Job source directories still list/read through their original transport without a Defects capability; Section H delivery/provisioning regression coverage remains separate.
- Existing PDF portrait layout, legacy notes and available image embedding remain covered; no save is required to export current form values.

Native TypeScript still reports **39 pre-existing unrelated errors**, with none in the files changed for this milestone. Do not describe the whole project as type-clean.

Across the capacity and regression runs, **74 targeted tests passed in 12 files**. The completed capacity run took 132.13 seconds including fixture overhead; this is not a production throughput guarantee.

After restart the app served normally and Sync Dashboard rendered. The development dashboard showed 19 expected vessels without authenticated reports. Startup maintenance also reported **critical sync health** and **one drift finding** (6 rows / 40 fields compared across 31 tables). Those global diagnostics were not resolved by this attachment milestone and must not be represented as a healthy/accepted production fleet.

## Backend/access and installation limits

| Environment | Verified | Not verified |
|---|---|---|
| Isolated shore/vessel fixture | Local private storage, SQL field appliers, real HTTP multipart/file protocol, all hashes, removal, conflict, resumption | Public TLS/proxy; production deployment; real vessel network |
| Development preview | Exact-limit multipart passes proxy; genuine unknown-peer refusal; application restart/dashboard | Successful live C1 save or real counterpart |
| Actual production shore | No access in this review | Actual configured provider/permissions, physical bytes, proxy limit, installed build/schema and authenticated peer reports |
| Actual vessels | No physical installations accessible | Migration/build inventory, canonical identity, provider/local disk, real counterpart transfer and operational network recovery |

Provider adapters/local receipts do not turn a local-storage test into an object-store test. Receiver metadata must retain the sender's backend; a verified receiver-local receipt resolves its own different backend. Never rewrite synced metadata or search another vessel's folders as a fallback.

## Shore-first rollout — after approval

1. **Inventory and back up.** Record build, tenant, canonical vessel UUID/instance ID, actual database/schema, local/private or object provider, free space and actual HTTP body limits on shore and every vessel. Back up databases and committed private bytes/object keys together. Record existing pending/failed queues before change. Do not edit peer reports by hand.
2. **Prepare shore first.** Apply the single idempotent migration191 to the actual owning schema/tenant database. Deploy matching shore server/frontend code. Verify the actual column, writable/readable private provider canary, stable database identity, authenticated user mapping and existing legacy document reads. Do not claim readiness from the migration filename alone.
3. **Observe old vessels safely.** Until a vessel reports authenticated `defect_files_v1`, migration191 and fresh compatibility, its new A/B uploads remain on the existing inline path; C1 stays unavailable with the update message. C1/unsupported external metadata stays unacknowledged/withheld. A ready pair's private-store failure is an error, never a silent inline fallback.
4. **Update one vessel.** Back up its database and private bytes, apply migration191, then deploy matching vessel code. Verify the actual canonical vessel/SHIP instance binding and existing authenticated tenant/key configuration. Do not copy credentials into release documents. Verify local provider read/write and persisted source identity.
5. **Let synchronization establish readiness automatically.** Run normal authenticated sync. In **Admin → Sync Dashboard**, inspect read-only Defect document reports for shore and every expected vessel: build, actual column/provider prerequisites, report age, state and pending/failed/held files. “Unknown” is not a successful connection. No admin enable action is needed or provided.
6. **Accept the real pair.** With an authorized Master, create an eligible C1 document and confirm external metadata, separate private bytes, counterpart availability/hash, download and removal protection. Exercise both source directions, real proxy limits, actual production provider and interrupted/resumed transfer. Confirm existing A/B, C2 evidence, PDF exports, WO/Component/Job/Section H files and unrelated Defect operations still work. Record timestamps/hashes/backend without credentials.
7. **Update remaining vessels.** Repeat the same schema/build/provider/authenticated acceptance per installation. Record genuine unknown/stale/offline/lost reports; never mark them ready to complete a checklist. Reports expire after 15 minutes; missing/stale reports stop new compatible operations. Older readable documents remain available.

Readiness, progress and failures are automatic observations stored using protected existing settings/queue/audit mechanisms, not a new editable configuration table. Do not expose or restore operational toggles.

## Recovery and support

- **Unknown/stale/lost peer:** inspect authenticated sync reachability, canonical vessel/instance/tenant binding, actual column/build and private-store health on both installations. After correction, a fresh authenticated report restores readiness automatically.
- **Metadata not present yet (425):** deliver/retry metadata first. Keep bytes/queue position; do not increment toward terminal failure, delete the document or acknowledge its missing field logs.
- **Interrupted transfer:** retain immutable staging chunks and resume from durable progress with the same descriptor. Do not replace pending keys/bytes. Completed duplicates are hash-checked, not rewritten.
- **Terminal failure:** show the exact support message. A verified shore Office Sail Admin/PMS Admin with Sync Dashboard edit access may use the dedicated retry action. It validates current ownership/source bytes/readiness, creates a new retry generation and audits the change. Do not reset SQL counters manually or use generic skip/retry.
- **Provider/disk failure:** repair the original private backend/access or restore its backed-up bytes/receipts. A ready pair must fail explicitly, not write base64 instead. Keep the sender's synced backend metadata unchanged.
- **Unsaved upload abandoned:** staging expires after seven days only after committed/history/queue reference checks. Committed/history documents do not expire on that timer.
- **Rollback decision:** stop deployment and preserve migration191, queues, chunks, receipts and newly externalized bytes. An old release may not read external metadata. Do not drop the column, clear arrays, move all closure files into B, delete bytes or skip-and-ack to force a downgrade. Review a compatible code fix/restore plan and both database-and-file backups before any destructive recovery.

## User-facing release notes

- Part A, **Part B - Rectification Documentation**, and **Part C1 - Closure documents** have independent attachments.
- **Closure files already uploaded to the shared list stay in Part B; new closure documents go in Part C1.** Previously selected shared evidence remains readable and is labelled **Legacy evidence**.
- New compatible documents are private external files; old inline documents remain readable. Maximum file size is 5 MB (5,242,880 bytes), accepting PDF/JPG/PNG.
- C1 becomes available automatically after the relevant vessel software/schema and authenticated synchronization are compatible. Otherwise: **“Part C1 will be available after this vessel's software update.”**
- A stale form attempting to select new Part B closure evidence says: **“This form is out of date. Please refresh the page, then attach closure documents in Part C1.”**
- Pending transfer is not missing evidence; terminal transfer failure says **“Transfer failed – contact support”**. Contact the shore administrator rather than repeatedly reattaching the same file.
