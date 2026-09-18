# R4 — correction of "Recent Updates & Changed Behaviours (Operational) Notes", §1.1.14.6

Date: 18-Sep-2026. Author: assistant work on branch `chatbot-enterprise`. Nothing deployed; the live
assistant, its index and its container are unchanged.

## Why

The reviewer (Astra) found that §1.1.14.6 as written in R3 states a blanket rule:

> "Only a Sail Admin can generate work orders directly from the office, and only for a vessel whose
> 'office work-order generation' switch is enabled."

The KB pilot file "How work orders are created" records a different, per-action rule (Generate Now =
Sail Admin only; per-job Generate WO = no role check; unplanned = no role check). Both files are
supplied to the assistant in the same request, so the two sources contradict each other, and the
acceptance case built on the R3 sentence rewards an over-broad answer.

The code was read to decide which source is right. **The KB file is right and R3 was wrong.**

## Evidence — code read (class: READ, from source; revision below)

Revision read: `origin/replit_dev` @ `44c8fccad` (PMS repo, working tree clean for these files).
Read-only; no application code was changed by this work.

| claim in R4 | file · symbol | what the code does |
|---|---|---|
| Generate Now requires role **and** switch | `server/modules/work-orders/controllers/workOrderController.ts:133` → `server/modules/work-orders/services/workOrderGenerationGate.ts` `evaluateDirectGeneration` | the only call site of the full gate; tests role then switch |
| the role tested is `'Sail Admin'` | `workOrderGenerationGate.ts` `PROVISIONING_ROLE = 'Sail Admin'` | constant, compared case-insensitively to the resolved role |
| three distinct refusals, switch-unknown fails closed | same file, codes `ROLE_NOT_PERMITTED`, `OFFICE_GENERATION_DISABLED`, `VESSEL_STATE_UNKNOWN` | messages quoted verbatim in the document |
| ship instances pass the gate | same function, `isShip` branch | returns allowed before the role and switch tests |
| per-job Generate WO has **no** role check | `server/modules/jobs/services/jobService.ts:555-580` | calls `isOfficeWoGenerationEnabled` and the job-state checks only; never calls the gate |
| unplanned WO touches neither rule | the create path in `workOrderController` | no gate call |
| the role comes from the forwarded header | `workOrderGenerationGate.resolveGateRole` prefers the forwarded role; `server/middleware/auth.ts:197` stores it from `x-user-role` | client sends it: `client/src/lib/activeRank.ts:127` |
| fallback identity reports 'Sail Admin' | `server/middleware/auth.ts:186` `role: "Sail Admin"` (fixed, not derived from the request) | so `resolveGateRole` returns 'Sail Admin' whenever no role header arrives — see the identity finding in the report |

## What changed in the document

Heading: "1.1.14.6 Office Generation of Work Orders Is a Per-Vessel Switch"
→ "1.1.14.6 Office Generation of Work Orders — Conditions by Action".

The four R3 bullets (paragraphs 20–23) were replaced by six bullets (paragraphs 20–25), one per
action plus a refusals bullet and an "applies to all" bullet. No other paragraph of the document was
touched: §1.1.14.5 above and §1.1.14.7 below are byte-identical.

Removed (the over-broad sentence and the two bullets that repeated it):

- "Only a Sail Admin can generate work orders directly from the office, and only for a vessel whose
  'office work-order generation' switch is enabled (off by default)…"
- "With the switch off, the Sail Admin is told that office work-order generation is not enabled…"
- "The office 'Generate Now' button … subject to the same switch and role rule."

Added: per-action conditions for Generate Now, per-job Generate WO and unplanned; the three refusal
messages verbatim with their codes; the ship bullet (kept, with its code reason); and the
authentication / forwarded-role / fallback-identity bullet. Each bullet carries its code reference in
square brackets, in the same style the rest of the generated document uses.

## Which revision was corrected (checked, not assumed)

The repository's `generated-docs/R3/` copy is NOT the revision the candidate index was built from.
Three revisions of this note exist, and each index set records the sha256 it was built from:

| sha256 | what it is | index sets built from it |
|---|---|---|
| `6a93bd23…` | R2 | `py-llamaparse`, `ce-clean`, `ag-*` (14 chunks) |
| `d10f3027…` | **R3 as indexed in the candidate set** | `repaired`, `kb-base`, `kb-pilot`, **`kb-pilot-c`** (13 chunks) |
| `71bafc19…` | R3.2 — R3 plus §1.1.14.13 "How To Create A Work Order" | `repaired-r32` (16 chunks); this is what `generated-docs/R3/` holds today |

R4 is therefore built from `d10f3027…`, recovered from git blob `619dbb92` at commit `972f424d7`
and kept as `generated-docs/R3/… .AS-INDEXED-kb-pilot-c.docx` (sha verified). Building it from the
repository's R3.2 copy instead would silently have added §1.1.14.13 to the index, changing far more
than the correction. `generated-docs/build_r4.py` rebuilds R4 from that file and is checked in.

## Preservation

| revision | path | status |
|---|---|---|
| R3 exactly as indexed in `kb-pilot-c` (`d10f3027…`) | `generated-docs/R3/Technical - Recent Updates & Changed Behaviours (Operational) Notes.AS-INDEXED-kb-pilot-c.docx` | recovered from git, preserved |
| R3.2 (the repository copy before this work) | `generated-docs/R3/Technical - Recent Updates & Changed Behaviours (Operational) Notes.PRE-R4.docx` | preserved, unchanged |
| R4 (corrected) | `generated-docs/R4/Technical - Recent Updates & Changed Behaviours (Operational) Notes.docx` | new |

Both R3 files at their original paths were left in place, so the pre-correction index set remains
reproducible.

## What the isolated index shows (PROVEN, from the database)

`kb-pilot-d` = a row-for-row copy of `kb-pilot-c` (916 chunks) with this one document re-indexed from
R4, giving 919. A full comparison of the two sets:

- chunks of every OTHER document: **0 differences** (`EXCEPT` over id + content).
- this document: the only section whose text differs is §1.1.14.6, plus one "Preamble" chunk in
  `kb-pilot-d` that holds the tail of the last bullet where the parsed page breaks. That fragment is
  part of the corrected section; it carries no heading of its own, and it is reported rather than
  tuned away.
- vectors: 12 of the document's chunks were served from the stored-vector cache, 4 embedded. Nothing
  else in the corpus was re-parsed or re-embedded.

## Limits of this correction

- The claims are **READ** from source at the revision above. They were not exercised against a
  running deployment; no request was made to live or to any PMS instance.
- "Any signed-in user with access to the vessel may use per-job Generate WO" is what the code path
  shows. Whether a UI route to that action is shown to every role was not measured.
- The forwarded-role behaviour of a specific deployment (whether `x-user-role` actually arrives) was
  not inspected on any running installation; the document says so rather than asserting an effective
  permission. `PMS_AUTH_MOCK_RBAC` is deliberately NOT mentioned in the document: it sets `req.rbac`,
  which this gate does not read — the gate reads `req.user`. An earlier draft of the bullet cited it
  and was corrected before the measured run.
- The document's own revision line still reads "R3 (September 2026)". It was left alone so that the
  only text difference between the two index sets is the corrected section; the revision is tracked
  by folder and sha here.
