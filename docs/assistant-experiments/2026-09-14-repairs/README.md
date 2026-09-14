# Assistant — source-backed evaluation and targeted extraction repairs (14-Sep-2026)

Raw evidence behind `docs/CHATBOT-PYTHON-PORT-PLAN.md` §S.6. Deployment on hold; nothing public
changed. No secrets (the configuration record lists environment key NAMES only).

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

Generated-document corrections: `central-assistant-py/generated-docs/` (build_r3.py = source of the R3
documents, R2/ originals, R3/ corrected, PROVENANCE.md = every claim with disposition and file:line
evidence at repository revision 27a40b2ce).

Repair records themselves live in the code: `central-assistant-py/indexer/repairs/<sha16>.json`
(document sha256, page, figure, method, version, transcribed text) and are applied by
`indexer/repairs.py`. Suite: `indexer/acceptance_answers.py` (`SUITE_VERSION 2026-09-14.3`).
Resolver: `indexer/xrefs.py` (`XREF_VERSION 2026-09-14.4`). Prompt on the compared instances:
`v2-xref-hardrule-2026-09-14` (docs b37172f6122a0257 · tool-loop f8e5a8f86bede638).
