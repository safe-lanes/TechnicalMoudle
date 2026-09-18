# The five items of your GO — done, with the evidence (18-Sep, second pack)

Nothing is deployed. The live assistant, nginx, the SMS RAG service, every other site and all shared
credentials are untouched, and no shared key was revoked or borrowed. No application authentication
was changed. None of these files contains a credential.

---

## 1. The document section, corrected in full

**A revision trap, found before anything was built.** The repository's `generated-docs/R3/` copy of
the Recent Updates note is **not** the revision the candidate index was built from. Each index set
records the sha256 it was built from:

| sha256 | revision | index sets |
|---|---|---|
| `6a93bd23…` | R2 | `py-llamaparse`, `ce-clean`, `ag-*` |
| `d10f3027…` | **R3 — the one in the candidate set `kb-pilot-c`** | `repaired`, `kb-base`, `kb-pilot`, `kb-pilot-c` |
| `71bafc19…` | R3.2 = R3 + a whole new §1.1.14.13 | `repaired-r32`; this is the repository copy today |

My first draft of R4 was built from R3.2 and would have added §1.1.14.13 to the index alongside the
correction. The indexed revision was recovered from git (`619dbb92` @ `972f424d7`), sha-verified
against the database, and R4 rebuilt from it by a checked-in script.

**The correction.** Heading → "1.1.14.6 Office Generation of Work Orders — Conditions by Action";
four bullets → six:

1. **Generate Now** — Sail Admin **and** the vessel's office generation switch.
2. **The three refusals, verbatim**, with their codes; unreadable vessel state fails closed.
3. **Per-job Generate WO** — the switch plus job state; **no role check on this path**.
4. **Unplanned** — neither rule.
5. **Ships** — always generate; a ship passes the gate untested.
6. **Applies to all** — authentication and vessel access, plus the enforcement note in item 2.

Every other paragraph is byte-identical (verified paragraph by paragraph).

**Files:** `R4-Recent-Updates-CORRECTED.docx`, `R3-Recent-Updates-AS-INDEXED.docx`,
`R4-PROVENANCE.md` (claim-by-claim code evidence at PMS revision `origin/replit_dev` @ `44c8fccad`).

---

## 2. The identity caveat, resolved rather than hedged

**Intended permission (READ, code):** `evaluateDirectGeneration` refuses any caller whose role is
not `'Sail Admin'`.

**Effective enforcement (READ, code):** the gate tests
`resolveGateRole(user) = user.forwardedRole || user.role`, where `forwardedRole` comes from the
`x-user-role` header and `user.role` is the literal `"Sail Admin"` set by the middleware. **A request
that arrives without a role header is evaluated as a Sail Admin and passes.** The header is supplied
by the caller, so it is an attribution signal, not a verified credential. The document now says this
in those terms.

**An error I made and corrected before the run:** the first draft of that bullet cited
`PMS_AUTH_MOCK_RBAC`. That flag sets `req.rbac`, which this controller does not read — it reads
`req.user`. The flag was removed, the index rebuilt, and the aborted first run discarded. The
sequence is in `R4-PROVENANCE.md` rather than quietly fixed.

**Running deployment: none used, none claimed.** No request was made to production or any customer
installation. The local shore+ship pilot is not running (ports 5000/5100 refused), and by a standing
project rule its authentication does not generalise to production, so starting it would not answer
the question. So: what the code requires and what it tests — READ. Whether every real caller in a
given deployment sends the header — **not measured, unknown.**

---

## 3. Judge corrections, finished before any model call

**Case 06 (`acceptance_generated.py`, suite `2026-09-18.3`).** Now requires the per-action split:
Generate Now with its role rule, the per-job `Generate WO` route, and a statement that the per-job
route carries **no role check** — the last through a new `||` alternation, because that one fact has
several natural wordings. No `must_not` was added for the blanket sentence: every wording that would
catch it also matches the refusal message the corrected document quotes verbatim. The required split
rejects the blanket answer on its own.

**Base judge .7 (`acceptance_answers.py`).** Your objection was right and the length shortcut is
gone. Each sentence asserting a decline phrase is classified by what it is about:

| class | violation? |
|---|---|
| refusal — first-person inability, or "no information" | yes |
| false-evidence — says the case's **own expected source** lacks the answer | yes |
| contradicted-by-own-citation — says the evidence base as a whole lacks it **while citing the expected manual and page** | yes |
| limitation-not-retrieved — the same claim when the expected source was **not** cited: the assistant is describing what it was given | no |
| limitation — scoped to some **other** named source, or to an attribute rather than to the evidence | no |

"Unsupported" is decided against the answer's own citations, not against its length.
`JUDGE_DECLINE_SCOPE=False` reproduces .6; with `JUDGE_DECLINE_AWARE=False`, .5. Old results are
preserved — nothing was rewritten.

**Validation on stored answers only** (`base-judge7-validation-all.txt`, 14 dumps, every arm since
11-Sep; `base-judge7-validation-s5.txt` for the final run). The judge change moves **4 verdicts**,
all pass → fail, each read against the full answer:

| dump · arm · case · run | the sentence | read |
|---|---|---|
| s5 · D5a · pmsvessel-3 · r3 | "The detailed Store transaction steps are not covered in the provided documentation." | genuine defect — the manual's own §1.1.8.3 says "follow the same steps", and the answer cites p.43 and p.40 |
| abc · B-corrected · safety-meeting-1 · r3 | "the provided excerpts do not include the full Part C…" | genuine — its citations include §1.6 p.10, Part B p.11, Part D p.14 |
| s4c · D4-rescue · safety-meeting-1 · r2 | same claim | same |
| abc · B-corrected · case 07 · r2 | "…are not documented for Heads of Department in the provided excerpts." | **borderline**, reported not special-cased: the "No" is right but grounded on absence of evidence where §1.1.12.6 documents the limit positively |

Decline-phrase audit over all dumps: 54 asserted occurrences — 48 limitation, 4
contradicted-by-own-citation, 2 false-evidence. Every sentence is printed so the classifier can be
checked directly.

**Work-order judge .11 → .12** (the lead-in fix you found): exactly **2 verdicts** across five stored
work-order dumps, both the ones you identified (`wo-generic-02`, B0 r1 and D5a r2) —
`wo-judge12-validation.txt`.

**Case 06 correction:** 2 verdicts in the final run (B0 r1, D5 r2 — the two blanket answers), 31
across all history. One near-miss worth recording: B0 r3 splits by action but writes "No special
role is required"; my first alternation list missed that wording and would have failed a correct
answer. Found by reading the changed verdicts, widened before concluding.

**All three arms of the 15-Sep run, re-scored on the corrected judges** (`score7-s5.txt`, both pass
rules per suite, per case):

| suite (rule) | B0 | D5a | D5 |
|---|---|---|---|
| routing 13 (all) | 8 | 13 | 13 |
| retrieval 18 (all) | 18 | 18 | 18 |
| frozen 12 (majority) | 11 | 12 | 12 |
| corrected claims 14 (majority) | 12 | 12 | 12 |
| work orders 8 (all) | 6 | 8 | 7 |
| manual coverage 57 (all) | 34 | 35 | 33 |
| fresh validation 10 (all) | 9 | 10 | 10 |

---

## 4. The candidate, rebuilt on an isolated index

Only v5. Model, prompt sha, routing and selection pinned identical; the index is the only difference.

| | E0 pre-correction | E1 corrected |
|---|---|---|
| image / prompt / model | `v6-r7` · v5 `ff9ee87141ac1362` · gpt-5.6-luna, default T | same |
| flags | `ROUTE_INTENT=on`, `HYBRID=rescue` | same |
| index | `kb-pilot-c` 916 | `kb-pilot-d` 919 |

`kb-pilot-d` is a row-for-row copy of `kb-pilot-c` with this one document re-indexed. Verified in the
database: **0 chunk differences** in every other document; the only section whose text differs is
§1.1.14.6; **12 of the document's 16 chunks served from the stored-vector cache, 4 embedded.**

One artefact, reported not tuned away: the longer section spans a parsed page break, so `kb-pilot-d`
carries an extra headingless "Preamble" chunk holding the tail of the last bullet.

---

## 5. Every suite, corrected vs pre-correction, on the corrected judges

Both arms ran **fresh in the same invocation**, so they share model, key, time and load.
`score7-s6.txt`, `s6-runs.txt`.

| suite | rule applied | E0 | E1 | other rule (E0 → E1) |
|---|---|---|---|---|
| routing 13 | all | 13 | 13 | — |
| retrieval 18 | all | 18 | 18 | — |
| frozen 12 | majority | 12 | 12 | all-runs 11 → 12 |
| corrected claims 14 | majority | **12** | **11** | all-runs 12 → 10 |
| work orders 8 | all | **7** | **8** | majority 7 → 8 |
| manual coverage 57 | all | **33** | **34** | majority 40 → 38 |
| fresh validation 10 | all | 10 | 10 | majority 10 → 10 |

**How much of that can be the document?** The outbound captures settle it: of 101 questions, **99
received byte-identical model input in both arms**. Only two questions were sent anything different,
and both are generation questions. So every difference on the other 99 is answer variance —
measured at **25 of 297 paired runs, 8.4 %** (`s6-input-identity.txt`, listed case by case). The
seven manual-coverage moves, the frozen run and the work-order gain all sit inside that noise.

**The one real difference — case 06: the answer improves, the citation position regresses.**

| | E0 | E1 |
|---|---|---|
| answer, all 3 runs | pass | **pass** (under the new, harder expectation) |
| top citation | Recent Updates §1.1.14.6 | KB pilot "Office 'Generate Now'" |
| case verdict | pass | **fail on citation, all 3 runs** |

Cause, visible in the citation list: E1 retrieves the corrected section **twice** (positions 2 and
4) because it now spans two chunks, so each is individually slightly less similar and the KB file
takes first place. Full answers and captured inputs: `s6-evidence-pack.txt`.

**Two fixes exist and neither was applied**, because choosing them after seeing which arm they help
is tuning to the result:

1. extend base judge .5's "citation anywhere" to unpaged cases with a unique manual name — this case
   would pass;
2. shorten §1.1.14.6 so it stays in one chunk — the top citation would very likely return.

Your call on both.

**What the correction did achieve:** the over-broad sentence is out of the corpus, and in this run no
answer to case 06 states that only a Sail Admin can generate office work orders — whereas in the
15-Sep run two did, and the old expectation passed them.

---

## Still open

1. Case 06's citation position (above) — judge or document, your call.
2. The headingless "Preamble" chunk.
3. `fresh-audit-1` still fails on the literal word "mandatory" where the answer writes "fields marked
   with *". The `||` alternation would fix it in one line and it would help the **baseline**, not the
   candidate — not applied, because the fresh set is frozen before first use and editing a frozen
   case mid-comparison destroys the only thing that set is for. Proposed for the next freeze.
4. The Audit History routing defect is unchanged and open.
5. Base judge .7's one borderline verdict (case 07 r2 above).
6. Variance is 8.4 % of runs on identical input. Single-run deltas on these suites are not evidence;
   future comparisons need paired identical-input analysis or many more repeats.

**Position unchanged: deploy nothing.** This run measures one document correction on an isolated
index. It does not settle promotion.

## Files

| file | what it is |
|---|---|
| `R4-Recent-Updates-CORRECTED.docx` · `R3-Recent-Updates-AS-INDEXED.docx` · `R4-PROVENANCE.md` | the corrected document, the exact revision it replaces, and the code evidence |
| `base-judge7-validation-all.txt` · `-s5.txt` | judge .6 vs .7 and case 06 old vs new over every stored dump, with the full decline-phrase audit |
| `wo-judge12-validation.txt` | work-order judge .11 → .12 over five stored dumps |
| `score7-s5.txt` · `score7-s6.txt` | all arms re-scored on the corrected judges, both pass rules, per case |
| `s6-runs.txt` | the full paired run log |
| `s6-input-identity.txt` | the 99-of-101 identical-input finding and the 8.4 % variance measurement |
| `s6-evidence-pack.txt` | full answers + complete captured model inputs for every case that differs between the arms |
