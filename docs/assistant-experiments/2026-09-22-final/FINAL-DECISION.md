# Final decision report — cross-reference candidate vs the deployed configuration

22-Sep-2026. One bounded regression run, as instructed. **Nothing deployed, pushed or merged. Live
(`sail-assistant-py-cand` :8017), nginx, SMS RAG and every other service untouched.** The isolated live copy
created for this run (`sail-assistant-py-livecopy` :8040) was stopped and removed by name afterwards.

## 1. Decision: **HOLD** the frozen candidate

The exact candidate — container `sail-assistant-py-g4`, image `sail-assistant-py:v6-r9`
(sha256 722127cab537…), index `kb-xref-c` (951 chunks, resolver `2026-09-22.3`, quote-excluded layout), prompt v5
`ff9ee87141ac1362`, gpt-5.6-luna default temperature, `ROUTE_INTENT=on`, `HYBRID=rescue`,
`CROSS_MODULE_GAP=0.25`/`SLOTS=2`, `ROUTE_MARGIN=0.07` (full record: `routing-experiment/FROZEN-CANDIDATE.json`) —
must not be deployed, for one reason that is not about the cross-reference repair at all:

**The candidate index was built from the wrong input documents (PROVEN).** Five of its 25 documents are the
**R2 (10-Sep, pre-correction)** versions of the generated operational documents, and the five KB-pilot work-order
files are absent. The live index and the previously reviewed candidate line (`kb-pilot-e`) carry the corrected R3
versions (Recent Updates: R3-as-indexed on live, R5 on `kb-pilot-e`) plus the five KB files.

| document (docx) | live `repaired` | `kb-pilot-e` (S39/S40 candidate) | **`kb-xref-c` (frozen)** |
|---|---|---|---|
| Bulk Data Import | bffa8828d5 = R3 | bffa8828d5 = R3 | **ba200e864d = R2** |
| Roles & Permissions | e845a51f00 = R3 | e845a51f00 = R3 | **97a3fedab0 = R2** |
| Ship-Side notes | 0bb3e4225e = R3 | 0bb3e4225e = R3 | **69857b3898 = R2** |
| Sync (Operational) | 25f4a49ef9 = R3 | 25f4a49ef9 = R3 | **083e08c139 = R2** |
| Recent Updates | d10f302783 = R3 as indexed | 7a06bad589 = R5 | **6a93bd2383 = R2** |
| 5 × "Technical - KB pilot: …" (1 chunk each) | absent | present | **absent** |

sha256 prefixes from `assistant_documents`; R2/R3/R5 labels by byte-identical match against
`central-assistant-py/generated-docs/R2|R3|R5/*.docx` in this repository. The build read
`~/central-assistant-py/documents/` (= the R2 copies) and was run without `--kb-dir`. The other 20 documents
(all PDF manuals) are byte-identical across the three indexes.

The consequence is measured, not inferred: **7 of the 14 corrected-claims cases regress against live**, and the
answers repeat exactly the claims the 14-Sep correction removed (`generated-docs/PROVENANCE.md`):

| case | candidate answer (all 3 runs) | R3 disposition of that claim |
|---|---|---|
| 01 Job Code in bulk job import | "Yes … the Job Code column must be filled in, and each job code must be unique" | REMOVED (wrong): Job Code optional, auto-generated |
| 05 vessel code onto the ship | "An Admin must run **Sync Masters** to populate the vessel code" | REMOVED (wrong): reaches ships via provisioning only |
| 07 Head of Department | "Yes. A Head of Department can do everything an office user can do for their department" | REMOVED (wrong) — a permission claim |
| 08 Level 2 Reviewer assignable? | "does not cover / do not state whether it can be assigned" | CORRECTED: it is a per-job rank field, not a role |
| 11 one press of Sync Now | "Yes … keeps the sync cycles repeating until the backlog is fully cleared" | R2 wording; corrected in R3 |
| 14 screen with the per-vessel switches | "The excerpts do not identify the office screen" | fact added in R3.1 (Lead Time & Grace Period Settings) |
| 02 where is Bulk Data Import | "Admin → Bulk Data Import" (R2 phrasing; live: "In the PMS module, open the Admin section") | R3 wording |

These are **substantive defects** (incorrect permissions, wrong behaviours, a fabricated "Sync Masters" step),
not model variance. They are **confirmed release-blocking**.

**Retraction.** Every comparison in the S41 line (`kb-xref-a/b/c` vs `kb-pilot-e`, packs 22a–22e) was described as
"the only variable is the document text of the resolved chunks". That was false: the five operational documents
differed as well. The seven cross-reference cases all live in PDF manuals that are byte-identical across the
indexes, so the 18/3/0 result for *those seven cases* stands; the claim of an otherwise-identical index does not.
The process failure: I never fingerprinted the build input per document before comparing indexes. That check is
now a standing rule (lesson 13 in `feedback_verify_the_instrument.md`).

## 2. What was run

Two arms, one invocation per suite, three runs where the suite is three-run, all suites executed by the same
runner image (`sail-assistant-py:v6-r7`) on `technical-rag-net`, 12:31–12:54 UTC, both arms answering concurrently
on one host:

- **LIVE** = `sail-assistant-py-livecopy`: image `sail-assistant-py:prompt-v2` (sha256 8db669090d36… — the image
  `sail-assistant-py-cand` runs), same env-file as live, `ASSISTANT_INDEX_SET=repaired` (911 chunks),
  `CHAT_MODEL=gpt-4o-mini`, `ROUTE_MARGIN=0.07`; `/health` prompt `v2-xref-hardrule-2026-09-14`,
  combined sha `ebfd83a623e41173` = live's `/health` exactly. Only addition: the outbound-capture variable
  (instrumentation). Env diff against live, secrets masked: that one variable.
- **CAND** = `sail-assistant-py-g4`, the frozen candidate above (identities recorded before the run).

Judges: base .9, work-order .13 (both reviewer-authorised on 19-Sep; the server copies still had .8/.12 and were
replaced by the repository versions before the run), corrected-claims .4, routing/retrieval/fresh/manuals unchanged
since S7. Cross-reference cases: the frozen candidate's result is **reused** from `xref-answers-c3-captured.json`
(same container, same index, same image, same flags, same judge — verified by `/health` and `FROZEN-CANDIDATE.json`);
the live arm was run fresh today (`xref-answers-live.json`).

The model input of every request on both arms was captured (`capture-livecopy.jsonl` 318 chat requests,
`capture-g4-s10.jsonl` 303) and the manual-coverage dump was re-judged offline against those captures
(`manuals-rejudge.txt`): totals unchanged, LIVE 159/171 runs with the required phrases present in the supplied
excerpts, CAND 165/171.

Scores are computed from the dumps by `s10_score.py` (`--read` prints every answer behind a loss in full); the
suites' own console totals in `runs.txt` agree with them on every suite.

## 3. Results against the live configuration

| suite (scoring rule) | LIVE | CAND | gains (CAND only) | **losses (LIVE only)** | fail on both |
|---|---|---|---|---|---|
| routing 13 — single routeOnly run, per case | 4 | **7** | rt-05-ctx-technical, rt-05-no-ctx, rt-05-ctx-safety | none | rt-general-01/02/03, rt-named-02/03, rt-pump-01 |
| retrieval 18 — module + top manual, expectations v1 (v2 identical) | 18 | 18 | — | — | — |
| work orders 8 (+5 phrasings) — answer ∧ citation ∧ rule in ALL 3 runs | 0 | 0 | — | — | all 8 |
| frozen answers 12 — answer ∧ citation ∧ attribution, MAJORITY of 3 | 11 | 11 | 05 (hazard categories: live clarifies, candidate answers from the Safety manual) | **08** (see §4) | — |
| corrected claims 14 — answer ∧ citation, MAJORITY of 3 | 12 | **5** | — | **01, 02, 05, 07, 08, 11, 14** | 06, 13 |
| fresh validation 10 — answer ∧ module ∧ citation in ALL 3 runs (automatic floor) | 9 | 8 | — | **fresh-audit-1** | fresh-wo-broad-1 |
| manual coverage 57 — answer ∧ citation ∧ support in ALL 3 runs | 36 | 31 | defects-1, moc-office-2, nm-3, pmsvessel-4 | **certsurveys-2, crewing-3, crewing-4, fn-1, inc-1, master-review-1, moc-office-1, pmsvessel-3, ra-vessel-1** | 17 |
| cross-reference 7 × 3 — buckets correct/limited/incorrect, field-level must_not, appraisals capped | **3 / 3 / 15** | **18 / 3 / 0** | waitlist, monthly-test, stores-export, stores-filter, surveys-edit: 3/3 correct each | none | — |

Cross-reference detail: live gives the source screen's steps in 15 of 21 answers ("Click on the 'In-Progress'
sub-sub module" for Waitlist; "'+' … new annual drug and alcohol record" for the monthly test; "Click on the 'Spares'
sub-sub module" for Stores export; "Go to the 'Certificates' sub-sub module … 'Issue Date'" for Surveys; Promotion
Rank for Appraisals). The candidate gives none of those. Audit History holds 3/3 on both.

Against the **previously reviewed candidate line** (`kb-pilot-e`, S39/S40: routing 13/13, work orders 6/8,
corrected 13/14, manuals 34/57): the frozen candidate is worse on routing (7), work orders (0), corrected (5),
manuals (31). All four drops trace to the build-input defect in §1: the six failing routing probes and the whole
work-order suite expect the five KB-pilot files that are absent from *both* live and the candidate; hist-1, which S40
reported fixed 3/3 by the cross-module append on `kb-pilot-e`, is 1/3 here (its cited Ship-Side document is the R2
version in this index — a plausible link, READ, not proven).

## 4. Every loss, read in full (answers in `read-losses.txt`; inputs in the captures)

Classification per the instruction: **defect** (release-blocking) / **accepted limitation** / **test defect
requiring manual assessment**. Original mechanical verdicts are preserved in the dumps and `runs.txt`; the reading
is recorded beside them, never in place of them.

**Confirmed release-blocking defects — 7 (corrected-claims 01, 02, 05, 07, 08, 11, 14).** All three runs each. Wrong
permissions (HOD), wrong behaviour (Sync Now, Job Code), a step that does not exist (Sync Masters), and two
"not covered" answers where the corrected document holds the fact. Cause: R2 documents in the index (§1). These
are content defects of the index build, not of the prompt, model or resolver.

**Test defects requiring manual assessment — 11 (read: no wrong screen, no fabricated step, no wrong permission in
any of them; the required phrase is present in meaning, absent as a literal string):**

| case | mechanical verdict | what the answer says | reading |
|---|---|---|---|
| frozen-08 (Waitlist export) | runs 1–2 ✗: required literal "in-progress" absent; run 3 ✓ | 3/3: "The Waitlist export procedure is the same as In Progress, §1.2.1.5 p.19: 1. Open the Waitlist … 2. Edit icon 3. Export" | correct Waitlist procedure with the source cited. Runs 1–2 write "In Progress" without the hyphen. Note the **live** "pass" on this case instructs "Click on the 'In-Progress' sub—sub module" — the wrong-screen instruction the cross-reference suite scores *incorrect*. The 14-Sep frozen rule predates the field-level rules and rewards the source wording. |
| fresh-audit-1 | run 1 ✗: literal "mandatory" absent | "Complete all inspection-page fields marked with *; Save …; Upload …; Next → Observation page" | meets the owner's score_by ("all mandatory fields marked with an asterisk"); runs 2–3 pass |
| certsurveys-2 | 3/3 ✗: "before the record can be saved" broken by inserted words | "must be completed before the new certificate (master) record can be saved" / "cannot be saved while any mandatory field is blank" | correct; live's pass is the same claim in fewer words |
| crewing-3 | run 3 ✗: "actively serving onboard" ≠ "active or ongoing onboard" | green/yellow/red as the manual states | correct |
| crewing-4 | 3/3 ✗: "check compliance" ≠ "check the compliance" | "check compliance … Save and Propose to submit for approval" | correct; the captured excerpt contains both facts verbatim (Figure 46 note and the 'Save'/'Propose' step) |
| fn-1 | run 3 ✗: "every pending action" ≠ "all actions" | Submit only after Date Closed is updated for every action | correct |
| inc-1 | runs 1, 3 ✗: "office users only" not literal | "No. A vessel user cannot fill in the Office Closeout comments or close the report … Office user: review, comment, close" | correct; run 2 has the literal phrase |
| master-review-1 | run 2 ✗: "history record" → "the record" | add attachment / view attachments / edit — the manual's own table, present in the captured input | correct |
| moc-office-1 | run 3 ✗: "viewed, edited, or exported" ≠ "view, edit, or export" | Office = view/edit/export; Vessel = view attachments | correct |
| pmsvessel-3 | 3/3 ✗: "same steps" not literal ("follow the bulk-update steps provided for Spares") | Stores bulk update follows the Spares steps, not a separate process | correct; the answer is the resolved cross-reference working as designed |
| ra-vessel-1 | runs 1–2 ✗: "only view / view-only mode" ≠ "viewing purposes only" | vessel users can only view Generic RAs | correct |

These eleven are the v5/luna answer style (fuller sentences, its own wording) meeting literal-phrase rules written
for the gpt-4o-mini style. They would need the owner's reading to be scored, exactly as the fresh suite's score_by
already says; no rule was changed for this report.

**Accepted limitations (fail on both arms, unchanged by the candidate):** corrected 06 and 13; fresh-wo-broad-1; the
17 manual-coverage cases failing on both; appraisals-filter stays *limited* (Crewing field lists unverified);
prep-3 and sms-office-1 fail at retrieval level on both arms (required text never in the supplied excerpts).

## 5. Cost, tokens, latency (measured this run, both arms concurrent on one host)

| | LIVE (gpt-4o-mini, prompt v2) | CAND (gpt-5.6-luna, prompt v5, cross-module append) |
|---|---|---|
| answers with a model call (conversation log) | 318 | 303 |
| input tokens per answer | ≈ 1,149 — **ESTIMATE** (4,594 chars ÷ 4 from 318 captured request bodies; the prompt-v2 image does not record usage) | **1,517** measured (log `tokens_in`; suite means 1,117–1,672 by suite) |
| output tokens per answer | not recorded by that image | **266** measured |
| latency mean / p50 / p95 | **2.3 s / 2.2 s / 3.4 s** | **4.3 s / 3.9 s / 8.1 s** |
| cross-reference cases only (7 × 3) | mean 2.4 s | mean 5.0 s, 1,609 input tokens |
| cost per 1,000 answered questions | ≈ $0.32 at gpt-4o-mini list price $0.15 / $0.60 per 1M (READ; output assumed 250) | **≈ $0.62** at $0.20 / $1.20 per 1M (READ from the model page, not verified against billing) |

72 further log rows carry no model (route-only probes and clarifications). Embeddings add under $0.01 per 1,000.

## 6. Exact deployment and rollback instructions (recorded as required; NOT to be executed under this HOLD)

Live is served by two nginx lines: `/etc/nginx/conf.d/safelanes.conf:375` and `/etc/nginx/conf.d/assistant.conf:21`,
both `proxy_pass http://127.0.0.1:8017;` → `sail-assistant-py-cand`. Both images are at Alembic head `0007`, the
shared database (`sail-assistant-db`) is already at `0007`, so no schema step is involved.

Deploy (only after a candidate has PASSED and the owner has approved):
1. `docker run -d --name sail-assistant-py-cand2 --restart unless-stopped --network technical-rag-net -p 127.0.0.1:8018:8000 --env-file ~/central-assistant/assistant-luna.env -e ASSISTANT_INDEX_SET=<passing index set> -e ASSISTANT_DOCS_PROMPT=v5 -e ASSISTANT_ROUTE_INTENT=on -e ASSISTANT_HYBRID=rescue -e ASSISTANT_CROSS_MODULE_GAP=0.25 -e ASSISTANT_CROSS_MODULE_SLOTS=2 -e ROUTE_MARGIN=0.07 sail-assistant-py:v6-r9` — **no** `ASSISTANT_CAPTURE_OUTBOUND` on a served container.
2. `curl -s http://127.0.0.1:8018/health` must show the intended `indexSet`, `chunks`, `docsPromptSha ff9ee87141ac1362`, `chatModel gpt-5.6-luna`.
3. Change the two `proxy_pass` lines above from `8017` to `8018`; `sudo nginx -t && sudo systemctl reload nginx`. `sail-assistant-py-cand` keeps running untouched.
4. Post-deploy: the 18-query retrieval suite and the routing probes through the public path; compare `/health` through nginx with step 2.

Rollback: change the same two lines back to `8017`, `sudo nginx -t && sudo systemctl reload nginx` (seconds; the old container never stopped). Then `docker stop sail-assistant-py-cand2 && docker rm sail-assistant-py-cand2` by name.

## 7. What would make the candidate deployable (stated, not done)

One rebuild with the correct inputs, then one regression run identical to this one:
`documents-kbpilot/` (the R3 set, 25 files) with the Recent Updates file taken from `documents-r5/` (R5,
7a06bad589), plus `--kb-dir kb-r5/technical/work-orders` (the five KB files, 1 chunk each), resolver
`2026-09-22.3`, `--cache-only`. The parse store already holds parses for all five corrected files
(one row each for bffa8828d5, e845a51f00, 0bb3e4225e, 25f4a49ef9, 7a06bad589), so the rebuild would need
**zero LlamaParse uploads** — that is a statement about the parse store, not a guarantee; `--cache-only` aborts on
any miss. This is a new build, therefore outside the instruction to stop; it is the owner's decision.

## 8. Recorded separately: the LlamaParse charge

The earlier `--dry-run` (22-Sep ~05:00–05:25 UTC) uploaded ~12–16 documents to LlamaParse (agentic tier) before
the cache-only guard existed. The history API returns 410 and the local journal is unreadable, so the amount is
only visible on the LlamaCloud usage page. Unresolved; it does not affect any result above.

## 9. Protection statement and side effects

- No deployment, push or merge. nginx, `sail-assistant-py-cand`, SMS RAG and all other containers untouched
  (`docker ps` before and after: `sail-assistant-py-cand` Up 8 days).
- Containers operated, by exact name only: `sail-assistant-py-livecopy` (created 12:22 UTC, stopped and removed after
  the run), `sail-assistant-py-g4` (queried; still running as the frozen candidate).
- Side effect to disclose: both arms use the live env-file's `DATABASE_URL`, so the 693 test conversations were
  written to the shared assistant database under `tenant_domain = smoke-suite-tenant` (the same practice as every
  earlier suite run). No live-tenant row was touched.
- The manuals suite's in-run `--capture` join produced "not captured" for every run (it reads the capture file at
  start-up, before the requests exist); the offline re-judge over the completed captures replaces it and agrees on
  every total.

## 10. Evidence in this folder

`runs.txt` (all suite consoles) · `*-dump.jsonl` (every answer, both arms) · `capture-livecopy.jsonl`,
`capture-g4-s10.jsonl` (model inputs) · `xref-answers-live.json` · `manuals-rejudge.txt` · `read-losses.txt` ·
`s10_score.py` · `../2026-09-15-kb-pilot/routing-experiment/FROZEN-CANDIDATE.json`, `xref-answers-c3-captured.json`,
`judge_xref.py`, `run_xref_test.py` (XREF_ARMS override added for the live arm).
