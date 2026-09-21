# Reviewer pack — bounded retrieval experiment, 21-Sep-2026

Answers the brief: run one bounded retrieval experiment on the ORIGINAL questions, capture the
candidates before routing, test search across modules, and compare the resulting module and supporting
passage against the current version — measuring correct module, unnecessary clarification and wrong
module separately, with the model, prompt and documents held fixed.

**Read `routing-experiment/ROUTING-EXPERIMENT.md` first.** It opens with three retractions: the claim
that no Audit chunk reached the distance limit is measured FALSE — the passage is rank 5 of the top-10
that routing receives, at distance 1.0204 inside the 1.15 floor.

| file | what it is |
|---|---|
| `routing-experiment/ROUTING-EXPERIMENT.md` | the report |
| `routing-experiment/candidates.json` | the raw capture: per question, the unscoped vector top-50, the nearest chunk of every module over the whole corpus, the unscoped lexical top-50, and the expected document's nearest chunks |
| `routing-experiment/meta.json` | settings actually in force, the title-term map, and the module each question names |
| `routing-experiment/cases.json` | the 101 questions verbatim with their ground-truth module, reconciled 101/101 against the review ledger |
| `routing-experiment/build_cases.py` / `capture.py` / `capture_meta.py` / `analyse.py` | the harness, re-runnable |
| `shipped-source/` | `retrieval.py`, `chat.py`, `db.py` as shipped, so the reproductions can be checked without repository access |
| `SUPERSEDED-earlier-diagnosis.md` | the previous diagnosis, kept so the retracted claims can be read in their original wording |

Scope: 101 embedding calls, no chat/answer model calls, no re-index, nothing deployed, no container
restarted, no database row written. Live service untouched.
