# Assistant — source-backed evaluation and targeted extraction repairs (14-Sep-2026)

Raw evidence behind `docs/CHATBOT-PYTHON-PORT-PLAN.md` §S.6–§S.6.4. Deployment COMPLETED and
accepted by the owner on 14-Sep-2026 (10:58 UTC): the shared endpoint `assistant.sl-sail.com` (and
`viqmap.sl-sail.com/assistant/`) serves the run-D combination — image `sail-assistant-py:prompt-v2`,
index set `repaired` (911 chunks), prompt v2 — with the old container and `migrated` index retained
for rollback (§S.6.4). Separate follow-ups, not part of this closeout: case 05 routing (§S.6
proposal), verification of the corrected-claims case 04 citation, and the generic "create a work
order" question. No secrets (the configuration record lists environment key NAMES only).

| file | what |
|---|---|
| `source-inventory.md` | the 25 corpus documents with sha256 prefixes, origin (original manual vs GENERATED), which were repaired; D:\manuals hashes = ingested hashes |
| `generated-docs-audit.md` | summary of the claim-by-claim audit of the five generated Technical documents, the four outright-wrong sentences, the one hand-corrected verdict |
| `generated-docs-audit-detail.md` | the full per-claim tables (Claim / Verdict / Evidence file:line) |
| `render/*.txt` | for every acceptance case: what the saved agentic parse holds for the cited page(s), and the page renders produced |
| `render/*.png` | 200-dpi renders of the repaired pages: Audit Preparation p15 Figure 20, RA Office p13 Figure 15, RA Vessel p12 Figure 14 |
| `xref-pairs.txt` | all 41 resolved cross-reference pairs (pointer → target) from the manuals, plus chained ones; verified against the heading trees |
| `index-run-repaired-runA-resolver3.txt`, `index-run-repaired-v4.txt` | candidate builds: repairs applied per document, xrefs resolved, vectors reused vs newly embedded |
| `compare-repaired-runA-resolver3.txt` | run A: retrieval + 3-run answers, resolver .3 / suite .2 (case 08 answer incomplete → resolver fix) |
| `compare-repaired-v4.txt` | **run B (final)**: retrieval 18/18 ×3; joint answers live 7/12 · base-v2 7/12 · candidate 11/12; no regressions |
| `acceptance-repaired-runA-dump.jsonl`, `acceptance-repaired-v4-dump.jsonl` | every full response (case, set, run, verdict, response JSON) |
| `config-record.txt` | images, containers, index sets, env key names at the time of the earlier teardown |
| `index-run-repaired-r3.txt` | candidate rebuild from the isolated corpus with the R3 generated documents (20 parses reused, 5 new LlamaParse jobs, 855 vectors reused) |
| `final-run-c.txt`, `acceptance-*-dump.jsonl` (run C) | run C on the R3 candidate: frozen suite retained 11/12; corrected-claims suite .1 showed 5 judge defects (fixed as .2, reported) and 2 official-manual wording conflicts (R3.1) |
| `final-run-d.txt`, `acceptance-final-dump.jsonl`, `acceptance-generated-dump.jsonl` | **run D (final)**: retrieval, frozen 12-case suite, corrected-claims suite .2 — live · same-prompt baseline · candidate (R3.1, 911 chunks) |

| `deploy-switch.txt` | the switch itself (14-Sep 10:58 UTC): before/after snapshot of every other site and container (identical), the two-line diff, nginx -t, public health/admin/auth checks |
| `postdeploy-run.txt`, `postdeploy-answers-dump.jsonl`, `postdeploy-generated-dump.jsonl` | post-deployment suites through the PUBLIC endpoints: retrieval 18/18 on both paths, frozen suite 11/12, corrected claims 13/14 (identical per case to run D) |
| `postdeploy-iso.txt` | tenant isolation + auth through the public endpoint (disabled tenant refused, other unaffected, expired/wrong-key 401), per-tenant conversation log, service + nginx error logs since the switch |

| `note-generate-now-ui-mismatch.md` | standalone note for the domain team: 'Generate Now' shown to Client Admin / Head of Dept, server allows Sail Admin only (path:line) |
| `item1-run-e.txt`, `runE-*-dump.jsonl` | follow-up 1 run E: baseline (live's index) vs candidate `repaired-r32` (first R3.2 wording) — retrieval, frozen 12, corrected 14, work-order suite .1 (§S.7) |
| `item1-run-f.txt`, `runF-wo-dump.jsonl` | follow-up 1 run F: restructured section, rank probe, work-order suite .2 (body-only judge), retrieval |
| `item1-run-h.txt`, `runH-*-dump.jsonl` | follow-up 1 run H: live config vs prompt-v3 + R3.2 candidate — retrieval v1 17/18 · v2 18/18, frozen 10/12 (case 09 attribution regression), corrected 12/14, work-order suite .3 all-runs 2/3 · 3/3 · 0/3 (§S.7.1) |
| `item1-run-g.txt`, `runG-*-dump.jsonl` | follow-up 1 run G: frozen 12 + corrected 14 on the final candidate build (11/12 · 13/14, same cases as run D) |

Generated-document corrections: `central-assistant-py/generated-docs/` (build_r3.py = source of the R3
documents, R2/ originals, R3/ corrected, PROVENANCE.md = every claim with disposition and file:line
evidence at repository revision 27a40b2ce).

Repair records themselves live in the code: `central-assistant-py/indexer/repairs/<sha16>.json`
(document sha256, page, figure, method, version, transcribed text) and are applied by
`indexer/repairs.py`. Suite: `indexer/acceptance_answers.py` (`SUITE_VERSION 2026-09-14.3`).
Resolver: `indexer/xrefs.py` (`XREF_VERSION 2026-09-14.4`). Prompt on the compared instances:
`v2-xref-hardrule-2026-09-14` (docs b37172f6122a0257 · tool-loop f8e5a8f86bede638).
