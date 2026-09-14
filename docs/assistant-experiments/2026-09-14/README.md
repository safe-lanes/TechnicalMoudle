# Assistant experiments — 14-Sep-2026 (parser thread, controlled experiment, prompt-rule deployment)

Raw outputs behind `docs/CHATBOT-PYTHON-PORT-PLAN.md` §S.3–§S.5. No secrets: the configuration
record lists environment key NAMES only.

| file | what |
|---|---|
| `compare-3way.txt` | retrieval (18 queries): migrated · py-llamaparse · ce-clean (§S.3) |
| `compare-6way.txt`, `compare-final.txt`, `compare-final3.txt` | retrieval: migrated · ag-base · ag-clean · ag-xref · ag-both · ce-clean (§S.4; final3 = ag-base re-embedded metadata+text) |
| `compare-migrated-vs-ag-reuse.txt` | retrieval: served set vs the rebuild that reused every stored vector (§S.5) |
| `acceptance-3way.txt` | 12 answer-level cases, single run (§S.3) |
| `acceptance-final*.txt` | 12 cases across the six sets, single run, joint scoring (§S.4) |
| `acceptance-repeat3.txt` | 12 cases, 3-run majority: migrated · migrated-np (new prompt) · ag-base · ag-xref · ag-both (§S.4 table) |
| `deploy-verify-8016.txt` | deployment check 1: old prompt (8015) vs v2 prompt (8016), retrieval + 3-run answers (§S.5) |
| `acceptance-live-final.txt` | deployment check 2, corrected case 08, 3-run (§S.5) |
| `acceptance-live-dump.jsonl` | every full response of check 2 (case, set, run, verdict, response JSON) |
| `eyecheck-agentic-v6.txt`, `eyecheck-ce-v6.txt` | cleanup v6 eye-check: unique removed blocks per manual |
| `stability-ag.txt`, `stability-ce.txt` | parse stability by original page (agentic / cost_effective) |
| `index-run-ag-reuse.txt` | rebuild with stored-vector reuse: "reused N stored, embedded 0 new" per document |
| `server-logs/` | index runs on the AI server (py-llamaparse, ce-clean, ag3/ag4 builds) and the run scripts |
| `config-record.txt` | images (tags/ids), containers, index sets, env key names, chat model, route margin at teardown |
| `probe_determinism.py` | the embedding determinism probe (§S.5 embedding record) |

Prompt under test: `PROMPT_VERSION = v2-xref-hardrule-2026-09-14`, hashes docs-path
`b37172f6122a0257` · tool-loop `f8e5a8f86bede638` · combined `ebfd83a623e41173`.
