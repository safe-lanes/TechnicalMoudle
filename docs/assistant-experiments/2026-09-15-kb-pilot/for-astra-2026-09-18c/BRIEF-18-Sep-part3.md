# The five bounded corrections — done, verified, and stopped there

Nothing is deployed. Live, nginx, SMS RAG, every other site and all shared credentials are untouched; no shared key
was revoked or borrowed; **no application authentication or permission code was changed**. Every container
operation named its container explicitly — no filter was used to stop anything. No credential is in these files.

---

## 1. Citation scoring corrected — base judge `.8`

A supporting citation is accepted **anywhere** in the user-visible list, and the acceptance is stricter, not
looser:

| | .7 | .8 |
|---|---|---|
| which document counts | the case's manual string appears as a **substring** of the citation name | resolved against the corpus document list (30 documents) — the citation must be that document **exactly** |
| section / page | only for page-anchored cases | unchanged, required wherever the case gives one |
| does the cited text support the answer? | not tested | the cited document's text must have been **supplied to the model** and carry a required phrase |
| first place in the list | conflated with the pass on unpaged cases | computed and reported **separately**, never folded into the pass |
| undecidable | — | marked REVIEW-NEEDED for source-based review |

"(Operational)" names four corpus documents; "Technical -" names fourteen. Name similarity cannot separate them,
which is why exact identity and the supplied-text test went in together.

**Validated on 1,245 stored runs** (1,239 with the captured model input): **18 verdicts change, all
citation false → true, every one with `support=supported` and `first-source=False`** — a supported citation that
was simply not first. None moves the other way. `base-judge8-validation.txt`.

**Negative controls** (fixtures from real stored answers — they show what the rule rejects, not that it occurs):

| control | .7 | .8 |
|---|---|---|
| wrong document substituted in every citation | reject | reject |
| **lookalike document — another document matching the same name substring** | **accept** | **reject** |
| lookalike document and its text not supplied | accept | reject |
| right document cited, its text never supplied | accept | **reject** |
| page-anchored case, every page forced to 999 | reject | reject |

**Result on the case you raised:** corrected-claims case 06 now **passes on both arms** — right answer, corrected
section cited but not first, citation accepted because its text was supplied and supports the answer. The
first-source column carries the regression openly (39/42 → 36/42 on that suite), so nothing is hidden by the pass.

---

## 2. Conditions and qualification kept together — R5

**The cause, measured.** The captured input ended `* Applies to all of the above: n`. The chunker splits **each
page** by headings, then cuts each section at 1200 characters; R4's single section was ~1,900 characters and
crossed a page break, so it was char-split *and* its tail was orphaned into a headingless "Preamble" chunk.

**The fix is structural.** §1.1.14.6 is now a short lead plus **five sub-sections, one per action, each on its own
page**, each carrying its own role, switch and job-state conditions **and its own enforcement note**. The document
is **longer**, not shorter (38 → 50 paragraphs, 4 → 7 pages); nothing was cut for ranking; every `[code: …]`
reference is preserved; every paragraph outside the section is byte-identical.

Measured in the index: `1.1.14.6.1` 1087 chars · `.2` 635 · `.3` 1006 · `.4` 550 · `.5` 251 — each one chunk, none
over the 1200 limit, and **zero headingless chunks** for this document.

**Confirmed from the captured candidate requests** (`chunking-before-after.txt`): the model now receives
`1.1.14.6.1 Office 'Generate Now' — a whole vessel` as one block with what it does, both conditions and the
enforcement note complete.

**KB files reconciled** (`kb-diff.txt`): `office-generate-now.md`, `how-work-orders-are-created.md` and
`office-generate-wo-per-job.md` no longer state the refusal unconditionally. The policy wording is unchanged; only
its enforcement is now qualified, and every code reference is preserved. The other two KB files were not changed
and their vectors were reused.

---

## 3. Scoring corrections finished

**(a) Missing-evidence claims are tested against the supplied excerpts.** .7 used the answer's own citations as a
proxy; .8 parses the captured `Manual excerpts:` block, takes the distinctive content words of the sentence and
asks whether the supplied text carries them. Citation presence, answer length and the absence of a preferred
citation no longer enter the test. Undecidable → REVIEW-NEEDED, neither passed nor failed.

Of the seven asserted missing-evidence sentences in store, two change class — **in opposite directions**:

| run | sentence | .7 | .8 |
|---|---|---|---|
| s5 · D5a · pmsvessel-3 r3 | "The detailed Store transaction steps are not covered in the provided documentation." | contradicted-by-own-citation | **false-evidence** — the supplied text carries it |
| s6 · E1 · pmsvessel-3 r1 | "…not documented as a completely separate update workflow." | contradicted-by-own-citation | **limitation** — the supplied text really does not |

**(b) The "mandatory" / "fields marked *" correction is applied**, as a documented versioned matching-equivalence
(`PHRASE_EQUIV`) — it changes how an answer is matched, not what the question requires, which is why the frozen
suite can take it. Applied identically to both arms; old scores reproducible with `JUDGE_PHRASE_EQUIV=False`. Its
effect here is a gain for the **baseline** arm.

**(c) Action-specific checks retained and tightened.** Case 06's requirements are now **action-scoped** (suite
`2026-09-18.4`), using the work-order judge's block scoping: "sail admin" must sit in the **Generate Now** block
and the no-role-check statement in the **per-job Generate WO** block. Required words appearing elsewhere no longer
satisfy the case.

---

## 4. Authorization finding — recorded separately

`SECURITY-FINDING-2026-09-18-wo-generation-role.md`. All **READ** from source at `origin/replit_dev` @ `44c8fccad`:

- **Intended:** office 'Generate Now' restricted to Sail Admin, on top of a per-vessel switch that fails closed.
- **Effective:** the gate resolves `forwardedRole || user.role`; `forwardedRole` comes from the caller's
  `x-user-role` header and `user.role` is the fixed string `"Sail Admin"`. **A request with no role header is
  evaluated as a Sail Admin.** Every other condition in that function fails closed; this one fails open.
- The gate reads `req.user` — the field the middleware comment reserves for business logic — rather than
  `req.rbac`, which reports `role: null` when nothing was forwarded and would have refused.
- `PMS_AUTH_MOCK_RBAC` drives `req.rbac` and therefore does **not** affect this gate; an earlier draft said it did
  and that is recorded, not quietly fixed.
- **Limits:** no production or customer installation accessed; proxy header handling not inspected; the pilot was
  down and its authentication does not generalise. **No claim that production exposure exists.** The note says
  what one request against an owner-nominated deployment would settle, and names a one-function candidate fix.
  Neither was done.
- ~12 other server files read `user.role`; whether any shares the fallback was **not** determined.

---

## 5. Rebuild and verification

| | F0 — pre-change v5 candidate | F1 — corrected |
|---|---|---|
| container | `sail-assistant-py-f0` · `45647f6ba64f…` | `sail-assistant-py-f1` · `3d78d1e6efab…` |
| image / prompt / model | `v6-r7` · v5 `ff9ee87141ac1362` · gpt-5.6-luna default T | identical |
| flags | `ROUTE_INTENT=on`, `HYBRID=rescue` | identical |
| index | `kb-pilot-c` 916 | **`kb-pilot-e` 921** |

`kb-pilot-e` = copy of `kb-pilot-c` with only the changed sources re-indexed: 0 chunk differences elsewhere,
exactly three KB files changed, 9 vectors reused / 14 embedded.

| suite | runner's rule | F0 | F1 | other rule (F0 → F1) | first-source |
|---|---|---|---|---|---|
| routing 13 | all three | 13 | 13 | — | — |
| retrieval 18 | all three | 18 | 18 | — | — |
| frozen 12 | majority | 12 | 12 | all-three 11 → **12** | 33/36 → 33/36 |
| corrected claims 14 | majority | 13 | 13 | all-three 13 → 13 | 39/42 → **36/42** |
| work orders 8 | all three | **8** | **6** | majority 8 → 8 | 24/24 → 24/24 |
| manual coverage 57 | all three | **35** | **34** | majority 39 → 39 | 120/171 → 120/171 |
| fresh validation 10 | all three | 10 | 10 | majority 10 → 10 | — |

**Attribution.** 87 of the 101 questions received **byte-identical** supplied excerpts; 14 received different ones
— all of them work-order or office-generation questions. On the 87 identical ones the arms disagree on **18 of 228
paired runs**: the **observed pass/fail disagreement on identical supplied excerpts** for this run. That is not an
accuracy margin and does not excuse any specific failure; it is used only to say which differences *cannot* be the
change. All seven manual-coverage moves and the frozen gain are in that identical-input set, individually listed
in `s7-input-identity.txt`.

**The two work-order losses are real (different inputs) and are judge gaps, not answer defects**
(`wo-judge-defects-s7.txt`; full answers in `s7-evidence-pack.txt`). Each is one failing run of three:

1. `wo-phr-01` r1 — the requirement sentence *is* office-qualified ("in the **office**, the vessel's **office
   work-order generation** switch must be on."). It fails because of a second, correct sentence — "The Ship does
   not have this switch requirement." — which mentions "switch" without "office". The test has no negation
   awareness. Removing only that contrast sentence makes it pass.
2. `wo-phr-05` r3 — the only "sail admin" sentence in the per-job block says the restriction applies "only to the
   relevant planned-generation actions, **not** to per-job Generate WO or unplanned work orders". The check
   (`acceptance_wo.py:293`) is a bare substring test.

Both were found after the run, on the arm they would help. **Neither was patched.**

A first diagnosis of mine was wrong and is kept in the file: I attributed both to markdown emphasis; stripping
every `**` and re-running fails identically, so that explanation is false.

**46 runs are flagged for source-based review** rather than scored on a guess — all on passing runs, in two
groups: "cited document supplied but its text does not carry a required phrase" (23) and "ambiguous expected
manual 'Technical' → 14 documents" (23). Both belong to the work-order suite, whose cases name the expected
manual as the bare string "Technical".

---

## Remaining defects

1. Two work-order judge gaps (above) — demonstrated, not patched.
2. Work-order cases name their expected manual as "Technical" (14 documents) — 46 review flags. A case change, not
   made here.
3. Corrected-claims case 01 fails all three runs on **both** arms, on the answer check, with the expected document
   supplied and supporting. Pre-existing, unchanged.
4. Corrected-claims case 04 expects "(Operational)" — four documents. Passes now under exact identity plus
   supplied-text support, but should name its document.
5. First-source ranking for case 06 is still behind the KB pilot file. The restructure did not restore first place
   and was not meant to; the instruction was not to shorten the document for ranking.
6. The Audit History routing defect is unchanged and open.
7. Observed pass/fail disagreement on identical supplied excerpts: 18/228 (7.9 %) here, 25/297 (8.4 %) in the
   previous run. Single-run deltas on these suites are not evidence either way.

Stopped here, as instructed: no further prompt or model experiments, nothing deployed.
