# Where the correct Audit passage disappears — stage-by-stage trace

Requested by the reviewer: trace `hist-1` through initial search, distance filtering, module selection and
final excerpt selection, and identify where to fix. Stored data, the index and the shipped source only.
**No model calls. Nothing implemented.**

Question: *"Who is allowed to add comments in the Review section of an inspection history record — the ship or
the office?"*
Expected passage: `Audit - History Manual_R1`, p.16, "The Review section is intended for office users only."

## The trace

| stage | result | evidence |
|---|---|---|
| **1. Indexing** | **PASSES.** The passage is in the index: `module=audit`, `page=16`, section `3.3 REVIEW PAGE:`, content "The **Review** section is intended for office users only." 24 chunks from that manual are present. | SQL over `kb-pilot-e` |
| **2. Vector recall** | **FAILS silently.** No Audit chunk lands inside the 1.15 floor, so `audit` never enters `best` and is not a routing candidate. | stored response: only Technical citations, top distance 0.8754 |
| **3. Module naming** | **CONTRIBUTES NOTHING.** `explicit_module()` → `(None, 'no module named')`; the question contains no module alias and no title term. | reproduced offline |
| **4. Module selection** | **THE LOSS HAPPENS HERE.** With no named module, `route()` picks Technical on vector similarity, margin 0.1266 > the 0.07 clarify threshold, so it answers instead of clarifying. | `route()`, stored confidence |
| **5. Excerpt selection** | **CANNOT RECOVER IT** — see below. | `chat.py:103-108` |

## Why the lexical channel does not save it — the architectural finding

The candidate already runs a lexical channel (`ASSISTANT_HYBRID=rescue`). It would have found the passage:

```
tsquery 'review section office users' over the whole corpus:
  1  incident  Near Miss Manual — 6. OFFICE CLOSEOUT
  2  audit     Audit - History Manual_R1 — 3.3 REVIEW PAGE:      <-- the correct passage, rank 2 corpus-wide
  3  incident  Incident Manual — Part K: Office Closeout
```

But in `chat.py` the order is:

```python
routed = retrieval.route(hits, message, ui_module, terms)          # line 103 — module chosen FIRST
lex = await db.search_lexical(emb, message, routed.module, ...)    # line 108 — scoped to routed.module
```

**The lexical search is passed the module that routing already chose.** It can only reorder excerpts *within*
that module. It is structurally incapable of correcting a module error, however strong the lexical evidence.
That is the single most actionable finding in this trace.

## A second, independent obstacle: the question's words are not in the corpus

```
"inspection history" anywhere in the corpus : 0 occurrences
"inspection" in the Audit History manual    : 14
"history"     in the Audit History manual   : 6  (plus the section "1.3 HISTORY SUB-MODULE OVERVIEW")
```

The user's compound phrase does not exist in the product's own vocabulary — the manual says "History
sub-module" and "Inspection Record Page". Both words are individually well represented in the right manual, so
an **OR-of-terms** lexical channel reaches it while a phrase or embedding match on the compound does not.

## What this means for the two earlier proposals — both now measured as latent

| finding | status after measurement |
|---|---|
| **R1** ambiguous title terms are not dropped; first document wins | reproduced, but a scan of the real corpus finds **no ambiguous term**. Latent. Fixes nothing observed. |
| **R2** a named module is discarded when it has no candidate inside the floor | measured over all 93 stored questions that carry a question string: **42 name a module, 0 were answered from a different module.** Latent. Fixes nothing observed. |

Both are real code defects worth tidying. **Neither is the cause of `hist-1`, and neither would fix it.** My
earlier proposals aimed at the wrong place; that is now measured rather than argued.

Caveat on the R2 measurement: it compares the named module with the module the answer came from, taken from
stored responses. The pre-filter candidate list is not stored, so a case where the name was discarded *and*
vector routing happened to choose the same module would be invisible. That residual is not excluded.

## Where a fix would go — stated, not proposed for implementation

The loss is at **stage 4**, and the material already exists to prevent it at **stage 5's** cost:

1. **Let the lexical channel vote on the module.** Run `search_lexical` **unscoped** before `route()` and give
   its top modules to the routing decision — as a candidate source, or as a corroboration test. This needs no
   new component; it reorders two existing calls in `chat.py`.
2. **Treat "no module named, low margin, question terms absent from the chosen module" as clarify**, rather
   than answering. This is the guard the reviewer has on hold, and it stays on hold.

Option 1 is the smaller change and addresses the cause directly. **Neither is implemented, and no claim is
made that either fixes `hist-1` until it is measured** — on three outcomes (correct-from-right-module /
clarify / wrong-module), not two.

## Evidence classes

- Stages 1, 3, 5 and the lexical ranking: **PROVEN** (SQL over the live index, offline reproduction, source).
- Stage 2 "no Audit chunk inside the floor": **INFERRED** from the stored citations — the query embedding is
  not stored, so the Audit chunk's actual distance was not computed. Computing it needs one embedding call.
- Effect of any fix: **not measured.**
