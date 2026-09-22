# Final decision report (second run) — the CORRECTLY ASSEMBLED candidate vs the deployed configuration

22-Sep-2026, 13:38–14:12 UTC. **Nothing deployed, pushed or merged. Live (`sail-assistant-py-cand` :8017;
`/health` llmCalls 724 before and after), nginx, SMS RAG and every other service untouched.** Supersedes
`FINAL-DECISION.md` (the HOLD on the mis-built candidate `kb-xref-c`), which stays in the record.

## 1. Decision: **PASS** — for exactly this package, and for nothing else

**Candidate = `sail-assistant-py-g5` (127.0.0.1:8042): image `sail-assistant-py:v6-r9` (sha256 722127cab537…),
index `kb-xref-d` (30 documents, 960 chunks), prompt v5 `ff9ee87141ac1362`, gpt-5.6-luna default temperature,
`ASSISTANT_ROUTE_INTENT=on`, `ASSISTANT_HYBRID=rescue`, `ASSISTANT_CROSS_MODULE_GAP=0.25`, `_SLOTS=2`,
`ROUTE_MARGIN=0.07`.** Full identities: `FROZEN-CANDIDATE-D.json`. Env diff against the frozen candidate `g4`
(masked): only `ASSISTANT_INDEX_SET`.

Against the isolated live copy, this package **loses no case on substance**: every one of its 10 mechanical
losses (1 corrected-claims, 9 manual-coverage) was read in full against the captured model input and is a
literal-phrase mismatch with the correct fact stated and supported by the supplied excerpt (§4). It gains 9 routing
probes, 7 of 8 work-order cases, 1 frozen, 2 corrected, 1 fresh and 7 manual-coverage cases, and turns the seven
cross-reference cases from **3 / 3 / 15** (correct / limited / incorrect) on live to **18 / 3 / 0**. No confirmed
release-blocking defect remains. The PASS is a verification verdict; **deployment is not authorised by this
report** and needs the owner's separate decision.

## 2. The inputs were locked before building (reviewer step 1–2)

`manifest.json` — the exact 30 intended sources with full sha256 and revision: 20 official PDF manuals (unchanged
since 11-Sep), 4 corrected operational documents (R3: Bulk Data Import bffa8828d5…, Roles & Permissions
e845a51f00…, Ship-Side 0bb3e4225e…, Sync 25f4a49ef9…), Recent Updates **R6** 771dc12473…, and the 5 work-order KB
files from **kb-r6** (how-work-orders-are-created.md c303336a9d…; the other four byte-identical to kb-r5).

**Compared with the previously reviewed candidate (`kb-pilot-e`, 30 rows): exactly two intended source
differences**, both the owner-authorised A5 correction —
1. Recent Updates R5 7a06bad589 → R6 771dc12473: §1.1.14.6.2's second bullet, which read *"Both refusals belong to
   'Generate Now' only"*, now reads: *"Only the ROLE refusal belongs to 'Generate Now'. The SWITCH refusal does
   not: on the office instance, both 'Generate Now' and the per-job 'Generate WO' route require the vessel's
   'office work-order generation' switch, and per-job 'Generate WO' is refused with the same message when it is
   off. The Sail Admin role requirement belongs to 'Generate Now' only. Unplanned creation ('+ Unplanned W.O')
   requires neither the role nor the switch. [code: …]"* (`generated-docs/build_r6.py`; `git diff --no-index
   build_r5.py build_r6.py` shows this bullet, the output path and the header comment — nothing else; the
   enforcement caveat bullets are unchanged; `PROVENANCE.md` §R6).
2. KB `how-work-orders-are-created.md`: one sentence appended to *Exceptions / edge cases* — the switch applies to
   BOTH office routes and only the unplanned route is exempt.
Everything else — 20 PDFs, the four R3 documents, the four other KB files — is byte-identical to `kb-pilot-e`.
The approved screenshot repairs are applied by the same `repairs=2026-09-14.1` module as in every candidate since
14-Sep (build key below). Against the HOLD candidate `kb-xref-c`: 10 source differences (5 R2 documents, 5 missing
KB files) — that is the defect that was corrected.

**The validator fails on the wrong sets (`manifest_check.py`, name AND full hash per file, count never accepted
alone):** pre-build `sources` check on the assembled directory PASSED; post-build `index` check on `kb-xref-d`
PASSED (30 rows, 30 hashes, no extra, 5 KB files present); negative controls: `kb-xref-c` FAILS (16 violations),
`kb-pilot-e` FAILS (4: the superseded R5 and kb-r5 file are on the forbidden list along with every R2 hash).

## 3. The build (one rebuild, isolated, cache-only except the one authorised parse)

`build-kb-xref-d.sh`, indexer image `sail-assistant-idx:r9f` (resolver `XREF_VERSION 2026-09-22.3`, `xref_facts.json`
md5 0873c1256…, both identical to the frozen candidate), `XREF_LAYOUT=quote-excluded`, `--resolve-xrefs
--apply-repairs`, new isolated index set `kb-xref-d`:
- step A: the R6 document alone, without `--cache-only` → **exactly one LlamaParse job**
  (`pjb-hzepqb29pyg4432pbjawvijdrup6`, 7 pages, agentic tier, the owner's explicit exception; log line count of
  "uploading": 1);
- step B: everything, `--cache-only` → 24 documents "accepted parse from the parse store — parser not called",
  the R6 document skipped as already indexed with the same build key, 5 KB files indexed as-is with the provenance
  line; vectors: every manual chunk reused from the store, 2 new embeddings for the R6 chunks and 1 for the changed
  KB file. Any other cache miss would have aborted the build (`CacheMiss`); none occurred.

Post-build (`postbuild-checks.sql`): one build key for all 25 parsed documents =
`…|clean=off|xrefs=2026-09-22.3|repairs=2026-09-14.1|chunker=2026-03-17.original|1200/150|embed=llamaindex-meta9|model=text-embedding-3-large:3072`
(identical to `kb-xref-c`); PDF chunk sets identical to `kb-xref-c` (0 / 0 differences → the cross-reference repair
under test is unchanged); the four R3 documents' chunk sets identical to `kb-pilot-e` (0 / 0); 4 of 5 KB chunks
byte-identical to `kb-pilot-e`, the fifth carries the new sentence; 41 resolved cross-references with `source_quote`
metadata (41 / 41, as in `kb-xref-c`). Recent Updates: 18 chunks, one per action, same structure as R5; exactly two
chunks differ from the R5 parse — §1.1.14.6.2 (the correction) and §1.1.14.6.1, where LlamaParse rendered the same
words without back-ticks around the code identifiers (parser rendering, no wording change; diff in the record).

**Known facts in the indexed text (step 3), all as intended:** "Job Code … must be filled in" 0 / "Job Code optional"
1 · "Sync Masters" 0 / vessel code via provisioning 1 · "everything an office user" 0 / HOD Me–My Team 3 ·
"single press can clear" 0 / corrected Sync Now wording 1 · "Both refusals" **0** / "Only the ROLE refusal" 1 ·
Generate Now = Sail Admin AND switch (§1.1.14.6.1) 1 · per-job Generate WO: "switch must be enabled … NO role check"
(§1.1.14.6.3) present · unplanned needs neither (§1.1.14.6.4) 1 · KB "switch applies to BOTH office routes" 1 ·
KB "Sail Admin requirement belongs to 'Generate Now' only" 1 · KB provenance line 5 / 5.

## 4. The final regression — one run, both arms, every suite (reviewer step 4)

LIVE = `sail-assistant-py-livecopy` recreated with the identical recipe as the morning run (image `prompt-v2`
sha256 8db669090d36…, index `repaired` 911, gpt-4o-mini, `ROUTE_MARGIN=0.07`, prompt sha `ebfd83a623e41173` =
live's `/health`; capture instrumentation only), removed by name after the run. CAND = `g5` above. Same runner
image (`v6-r7`), same judges (base .9, work-order .13, corrected-claims .4, others unchanged), three-run rules
unchanged, both arms answering concurrently 13:46–14:12 UTC. Every model input captured (LIVE 297 chat requests,
CAND 324). The seven cross-reference cases were run fresh on `g5` (3 runs); the live arm's cross-reference answers
are reused from this morning's run of the identical live configuration (`xref-answers-live.json`). Scores below
are computed from the dumps by `s10_score.py --dir s11` and agree with every suite console total in `s11/runs.txt`.

| suite (scoring rule) | LIVE | **CAND** | gains (CAND only) | losses (LIVE only) | fail on both |
|---|---|---|---|---|---|
| routing 13 — single routeOnly run | 4 | **13** | rt-general-01/02/03, rt-named-02/03, rt-pump-01, rt-05 ×3 | none | none |
| retrieval 18 — module + top manual (v1; v2 identical) | 18 | **18** | — | — | — |
| work orders 8 (+5 phrasings) — answer ∧ citation ∧ rule in ALL 3 | 0 | **7** | wo-generic-02/03, wo-phr-01…05 | none | wo-generic-01 (CAND 2/3, see below) |
| frozen 12 — answer ∧ citation ∧ attribution, MAJORITY | 11 | **12** | 05 | none | none |
| corrected claims 14 — answer ∧ citation, MAJORITY | 12 | **13** | 06, 13 | **01** (see below) | none |
| fresh 10 — answer ∧ module ∧ citation in ALL 3 (floor) | 9 | **10** | fresh-wo-broad-1 | none | none |
| manual coverage 57 — answer ∧ citation ∧ support in ALL 3 | 36 | **34** | defects-1, moc-office-2, nm-3, pmsoffice-1, pmsoffice-2, ra-office-3, sms-office-3 | **9** (see below) | 14 |
| cross-reference 7 × 3 — buckets, field-level must_not, appraisals capped | 3 / 3 / 15 | **18 / 3 / 0** | waitlist, monthly test, stores export, stores filter, surveys edit: 3/3 correct each | none | — |

Manual coverage re-judged offline against the captures (`s11/manuals-rejudge.txt`): totals unchanged; CAND
165 / 171 runs with the required phrases present in the supplied excerpts (LIVE 159 / 171); the 6 CAND "not in
excerpts" runs are prep-3 and sms-office-1, retrieval-level on both arms. Provenance-misattribution flags in the
cross-reference answers: 0 of 21.

### 4a. Every apparent regression, read in full against the captured input

Mechanical verdicts are preserved in the dumps and `runs.txt`; the reading is recorded beside them. Classification per
the instruction: **defect** (release-blocking) / **accepted limitation** / **test defect requiring manual assessment**.

**Confirmed release-blocking defects: none.**

**Test defects requiring manual assessment — 11 (in every one, the fact the rule looks for is stated, and the
excerpt that was supplied to the model carries it):**

| case | mechanical | what the candidate says | reading |
|---|---|---|---|
| corrected-01 Job Code (LIVE pass, CAND 0/3) | rule wants literal "optional" AND "generated" | 3/3: *"No. … the Job Code column is optional. Leave it blank; the system **generates** a code during import (JOB-XXXXXXX). Duplicate checking applies only when a Job Code is supplied together with a Component Code"* | the corrected R3 fact, complete (optional, generated on import, duplicate rule); "generates" ≠ "generated". Compare the HOLD candidate's *"Yes … must be filled in"* — that was a defect; this is not |
| wo-generic-01 (fail on both; CAND run 2 only) | "automatic generation" phrase MISSING | run 2: four routes — *"The ship system generates work orders from each job's frequency and next due date … runs automatically once a day"*, Generate Now with Sail Admin + switch, per-job Generate WO with switch and no role, unplanned with neither, sources labelled draft code-derived vs manual | complete and correct, including the corrected switch scope; the judge's phrase list does not contain this wording (a known synonym gap recorded 18-Sep) |
| certsurveys-2 (0/3) | "before the record can be saved" broken by inserted words | *"mandatory … must be completed before the new certificate (master) record can be saved"*; excerpt: *"Mandatory fields (*) must be completed before the record can be saved"* | correct |
| crewing-3 (runs 1, 3) | "active or ongoing onboard" → "currently / actively serving onboard" | green / yellow / red as the manual | correct |
| crewing-4 (0/3) | "check the compliance" → "check compliance" | + Save and Propose; excerpt: *"Click on the 'Save' and 'Propose' buttons … Note: From here, the user can check the compliance"* | correct |
| inc-1 (runs 1, 2) | "office users only" not literal | *"No. A vessel user must not enter or modify the Office Closeout section … requires closure by the office"* + the office closeout fields (Reviewed, Office Comments, Closed by / User Rank / Date Closed, SUBMIT) — all in the captured Near-Miss p.11 excerpt | correct |
| moc-office-1 (runs 2, 3) | "view, edit, or export" → "viewed, edited, or exported" | Office = view/edit/export; Vessel = view attached documents | correct |
| pmsvessel-2 (run 1) | "not available" → "unavailable" | *"No … The Change Request option is unavailable to Vessel Users; the screen is displayed only to the HOD"* — both in the captured p.47 excerpt (Figures 77/78) | correct |
| pmsvessel-3 (runs 1, 3) | "same steps" → "same bulk-update steps / follow the Spares bulk-update steps" | not a separate process; Store → + Bulk Updates Store → the Spares steps | correct — the resolved cross-reference working as designed |
| ra-office-1 (runs 1, 2) | "edit the existing" → "Edit that record / Edit its Approval Level" | only one Approval Level per Position/Rank; edit, do not create a new approver | correct |
| ra-vessel-1 (runs 2, 3) | "viewing purposes only" → "only view / view-only mode" | vessel users can only view Generic RAs | correct |

**Accepted limitations (unchanged by the candidate):** appraisals-filter stays *limited* (Crewing field lists
unverifiable); 14 manual-coverage cases fail on both arms (prep-3 and sms-office-1 at retrieval level — the required
text is never supplied; the rest as before); the v5/luna answer style meets literal-phrase rules written for the
gpt-4o-mini style less often — the 9 manual-coverage losses above are that effect, and the suite already says its
automatic score is a floor.

## 5. Cost, tokens, latency (measured this run; both arms concurrent on one host)

| | LIVE (gpt-4o-mini, prompt v2) | CAND (gpt-5.6-luna, prompt v5, cross-module append) |
|---|---|---|
| answers with a model call (conversation log) | 297 | 324 |
| input tokens per answer | ≈ 1,137 — **ESTIMATE** (chars ÷ 4 from the 297 captured bodies; that image records no usage) | **1,622** measured (log `tokens_in`; work-order suite 2,288, others 1,341–1,737) |
| output tokens per answer | not recorded by that image | **313** measured |
| latency mean / p50 / p95 | **2.3 s / 2.1 s / 3.4 s** | **4.8 s / 4.3 s / 9.9 s** |
| cross-reference cases (7 × 3) | mean 2.4 s | mean 4.8 s, 1,616 input tokens |
| cost per 1,000 answered questions | ≈ $0.32 at $0.15 / $0.60 per 1M (READ; output assumed 250) | **≈ $0.70** at $0.20 / $1.20 per 1M (READ from the model page, not verified against billing) |

Practical impact: about twice the latency (p95 ≈ 10 s under concurrent load) and roughly twice the model cost per
question, for the correctness changes in §4. Embeddings add < $0.01 per 1,000.

## 6. Exact deployment and rollback (recorded as required — NOT executed; not authorised by this report)

Live is served by two nginx lines: `/etc/nginx/conf.d/safelanes.conf:375` and `/etc/nginx/conf.d/assistant.conf:21`,
both `proxy_pass http://127.0.0.1:8017;` → `sail-assistant-py-cand`. Both images are at Alembic head `0007`, the
shared database already is; no schema step.

1. Pick a free port (`ss -ltn`; 8041 was free on 22-Sep — 8016–8040 and 8042 are taken by experiment containers).
   `docker run -d --name sail-assistant-py-cand2 --restart unless-stopped --network technical-rag-net -p 127.0.0.1:8041:8000 --env-file ~/central-assistant/assistant-luna.env -e ASSISTANT_INDEX_SET=kb-xref-d -e ASSISTANT_DOCS_PROMPT=v5 -e ASSISTANT_ROUTE_INTENT=on -e ASSISTANT_HYBRID=rescue -e ASSISTANT_CROSS_MODULE_GAP=0.25 -e ASSISTANT_CROSS_MODULE_SLOTS=2 -e ROUTE_MARGIN=0.07 sail-assistant-py:v6-r9` — **no** `ASSISTANT_CAPTURE_OUTBOUND` on a served container.
2. `curl -s http://127.0.0.1:8041/health` must show `indexSet kb-xref-d`, `chunks 960`, `docsPromptSha ff9ee87141ac1362`, `chatModel gpt-5.6-luna`.
3. Change the two `proxy_pass` lines from `8017` to `8041`; `sudo nginx -t && sudo systemctl reload nginx`. `sail-assistant-py-cand` keeps running untouched.
4. Post-deploy through the public path: `/health` equals step 2; the 18-query retrieval suite and the routing probes.

Rollback: set the same two lines back to `8017`, `sudo nginx -t && sudo systemctl reload nginx` (seconds; the old
container never stopped); then `docker stop sail-assistant-py-cand2 && docker rm sail-assistant-py-cand2`.

## 7. Recorded separately

- **LlamaParse:** one authorised job today (R6, 7 pages, agentic; id above) — plus the unresolved charge from the
  earlier `--dry-run` (~12–16 agentic jobs, ~05:00–05:25 UTC), visible only on the LlamaCloud usage page.
- **Side effects:** the 693 test conversations were written to the shared assistant database under
  `tenant_domain = smoke-suite-tenant` (same practice as every suite run); `sail-assistant-py-livecopy` created and
  removed by name; `sail-assistant-py-g5` left running as the verified candidate; nothing else touched.
- **Process finding, kept in the record:** the S41 comparisons claimed an index that differed only in the resolved
  chunks; it also carried five R2 documents. Fingerprinting the build input per document is now a standing rule.

## 8. Evidence

`manifest.json`, `manifest_check.py`, `manifest-sources.txt`, `index-*.txt` (rows of every index compared) ·
`build-kb-xref-d.sh`, server log `s10/build-kb-xref-d.log` · `postbuild-checks.sql` · `FROZEN-CANDIDATE-D.json` ·
`s11/runs.txt`, `s11/*-dump.jsonl`, `s11/capture-livecopy.jsonl`, `s11/capture-g5.jsonl`, `s11/xref-answers-cand-d.json`,
`xref-answers-live.json`, `s11/manuals-rejudge.txt`, `s11/score.txt`, `s11/read-losses.txt` ·
`generated-docs/build_r6.py`, `generated-docs/R6/*.docx`, `generated-docs/PROVENANCE.md` §R6 · the morning's HOLD
evidence stays in this folder unchanged.
