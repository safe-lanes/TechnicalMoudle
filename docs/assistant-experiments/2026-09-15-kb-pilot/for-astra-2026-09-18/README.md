# For Astra — review pack, 18-Sep-2026

Read `ASTRA-BRIEF-18-Sep.md` first. It is self-contained: it states what was asked, what was done, what was corrected, the final comparison, the recommendation, the open items, and eight questions for you. The other files are the raw outputs behind each claim, so any number in the brief can be audited without repository access.

Nothing is deployed. The live assistant, nginx, the SMS RAG service, other sites and all shared credentials were untouched, and no shared key was revoked. None of these files contains a credential.

| file | what it is | size |
|---|---|---|
| `ASTRA-BRIEF-18-Sep.md` | the brief — start here | 12 KB |
| `reconcile.txt` | every published number recomputed from the stored runs: per-suite, per-case, per-run, under both pass rules | 41 KB |
| `review-d4-verdicts-full.json` | the per-run record for all 171 stored answers — verdict, supporting excerpt and page, citation assessment, defect class, reason, alongside the automatic verdict | 191 KB |
| `diag_fixes.txt` | why each retrieval or routing defect happens: module decision, vector ranking, where the expected chunk sits, what the rescue displaced | 15 KB |
| `replay-v6.txt` | prompt v5 against v6 on identical captured inputs, with the full answers for six defective runs and ten controls | 19 KB |
| `judge5-validation.txt` | the judge change re-scored over eight stored dumps: 270 changed verdicts, old and new side by side | 32 KB |
| `s5-runs.txt` | the full final verification log — three arms, every suite, every case | 95 KB |
| `s5-manuals-rejudge.txt` | the manual-coverage scores re-checked against the captured excerpts | 5 KB |
| `fresh_cases-2026-09-18.2.json` | the fresh validation set actually used | 13 KB |
| `fresh_cases-2026-09-18.1-original.json` | the original frozen version, kept so the corrections can be compared | 9 KB |

Note on the two fresh-case files: version 2 replaced version 1 in place under the same filename in the repository, so both are exported here under dated names. Comparing them shows whether the corrections tightened the cases or loosened them — they were corrected before the set's first run, and the set is held out of tuning.

If the 191 KB per-run record is too large to paste, the brief and the smaller logs stand on their own; send that file only if a specific verdict is disputed.
