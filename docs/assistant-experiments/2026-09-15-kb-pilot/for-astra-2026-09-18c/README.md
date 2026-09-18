# For Astra — third pack, 18-Sep-2026: the five bounded corrections, done and verified

Read `BRIEF-18-Sep-part3.md` first. Nothing is deployed. The live assistant, nginx, the SMS RAG service, every
other site on the box and all shared credentials are untouched; no shared key was revoked or borrowed; no
application authentication or permission code was changed. Every container operation used an explicit container
name — no filter was used to stop anything. None of these files contains a credential.

| file | what it is |
|---|---|
| `BRIEF-18-Sep-part3.md` | the brief — start here |
| `R5-Recent-Updates-RESTRUCTURED.docx` · `R5-PROVENANCE.md` | the document as it is now indexed, and why each action is its own page |
| `R3-Recent-Updates-AS-INDEXED.docx` | the revision it replaces, recovered from git and sha-verified against the index |
| `kb-diff.txt` | the three reconciled KB pilot files, before and after |
| `SECURITY-FINDING-2026-09-18-wo-generation-role.md` | item 4, as its own note |
| `base-judge8-validation.txt` | judge .7 → .8 over 1,245 stored runs, the negative controls, and every missing-evidence sentence reclassified |
| `score8-s7.txt` | the paired run scored under the corrected judges — majority and all-three separately, first-source as its own column, review-needed listed |
| `score8-s6.txt` | the previous run re-scored on the same judges, for continuity |
| `s7-runs.txt` · `s7-generated-runs.txt` | the full run logs |
| `s7-input-identity.txt` | which questions received different supplied excerpts, and the observed pass/fail disagreement on identical ones |
| `s7-evidence-pack.txt` | full answers and complete captured model inputs for every case that differs between the arms |
| `chunking-before-after.txt` | the supplied excerpt that was truncated, and the same section after the restructure |
