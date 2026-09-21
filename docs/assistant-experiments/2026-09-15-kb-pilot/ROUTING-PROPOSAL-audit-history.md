# Audit History routing — trace and one proposed correction

Requested 19-Sep. Stored answers, captured inputs and source code only; **no model calls, nothing implemented.**

## 1. The trace, end to end

Question (`hist-1`): *"Who is allowed to add comments in the Review section of an inspection history record — the
ship or the office?"*

| stage | what happened | evidence |
|---|---|---|
| module named by the question? | **No.** `explicit_module()` returns `(None, "no module named")` | run offline against the real corpus list — see §2 |
| vector routing | best module **Technical**, top distance **0.8754**, margin **0.1266** | stored response: `module: Technical, confidence: 0.1266, routing: "vector routing"` |
| clarify? | no — margin 0.1266 > `ROUTE_MARGIN` 0.07 | `route()` in `app/retrieval.py` |
| excerpts supplied | Ship-Side notes §1.1.13.3 (0.8754), PMS Office manual p.13 (0.9725), Sync notes §1.2.8 (1.0169), PMS Office p.35 (1.0471) | captured model input |
| Audit History manual | **never retrieved, never supplied** — no Audit chunk was inside the 1.15 floor, so `audit` was not even a routing candidate | `best` is built only from hits ≤ `route_sim_floor` |
| the answer | built from the PMS **work-order** review section (a different feature that also has a "Reviewer Comments" field) plus the audience line "Audience: Office / Sail Admin" | `citation-review-verdicts-s7.md` §C |

## 2. Why the correct section is excluded — the root cause, proven offline

`explicit_module()` can match a module alias (`audit`, `pms`, `safety`, …) or a **term derived from a manual
title**. The title terms are built by `_terms_from_title()`, which drops words in `_GENERIC_TITLE_WORDS`:

```python
_GENERIC_TITLE_WORDS = {"user","manual","manuals","office","vessel","specific","notes","operational",
                        "for","sail","admin","history","preparation","sync","kb","pilot"}
```

`history` and `preparation` are in that list. So:

```
_terms_from_title("Audit - History Manual_R1_30.06.2026.pdf")      -> []      # no term at all
_terms_from_title("Audit - Preparation Manual_Office_R1_….pdf")    -> []      # no term at all
_terms_from_title("Audit - Fleet Sharing Manual- Office_R1_….pdf") -> ['fleet sharing']
```

**Two of the three Audit manuals contribute no routing term whatsoever.** A question can say "inspection
history" and the router has nothing to match. The word "audit" is not in the question either, so no alias fires.

This predicts more than `hist-1`: the same hole covers Audit **Preparation**, which matches the separately known
defect "`prep-3` chunks indexed but not retrieved".

**Why PMS work-order review wins instead:** with no named module the decision is pure vector similarity over
generic wording — "review", "comments", "ship", "office" — which the PMS work-order approval/review sections
carry strongly. The margin (0.1266) clears the clarify threshold, so the assistant answers confidently.

## 3. One proposed correction

**A routing corroboration guard, plus the title-term repair that makes it usable.** One change, two parts that
only work together.

**(a) `app/retrieval.py`, `_GENERIC_TITLE_WORDS` / `_terms_from_title`** — stop discarding a document's only
distinguishing word. Keep the words generic **as single tokens**, but emit a module-qualified **phrase** built
from the title plus its module: `audit history`, `audit preparation`, `technical sync`. Match those phrases, and
also the bare word when it is unambiguous across the corpus (the existing ambiguity drop already removes
collisions). This avoids "history" alone hijacking a PMS question about running-hours history.

**(b) `app/retrieval.py`, `route()`** — the chosen module must be corroborated. After the module is chosen, test
whether the question's distinctive content terms are lexically present in the chosen module's candidate chunks
(the tsvector search already exists: `db.search_lexical`). If they are not, do not answer:

```python
# after top_module is decided and before building `chosen`
if s.assistant_route_guard == "on":
    covered = lexical_cover(message, [h for h in hits if h.module == top_module])
    if covered < s.route_guard_min:                       # question's distinctive terms absent from the module
        return Routed("clarify", candidates=[MODULE_LABELS.get(m, m) for m, _ in ranked[:3]],
                      confidence=margin)                  # or "not_documented" when only one candidate
```

and, when a module **is** named but has no candidate inside the floor, clarify naming that module rather than
answering from another one:

```python
if named and named not in best:
    return Routed("clarify", candidates=[MODULE_LABELS.get(named, named)], confidence=0.0)
```

**Precedence, stated:** explicit module name > originating-module (UI) context > vector similarity. Today the UI
context only breaks a tie below `ROUTE_MARGIN`; it must never override a module the question names.

**Files:** `central-assistant-py/app/retrieval.py` (`_GENERIC_TITLE_WORDS`, `_terms_from_title`, `route`),
`app/config.py` (two new flags, default off: `assistant_route_guard`, `route_guard_min`), `app/db.py`
(reuse `search_lexical`). No change to `chat.py`'s answer path, no prompt change, no index change.

**What is deliberately not proposed:** nothing keyed to this question or this case; no permission rule inferred
from a document's audience label. The audience-label problem is an **answer** behaviour, not routing — it belongs
in prompt work and is listed separately in `OPEN-ISSUES.md` (A2b), not fixed here.

## 4. Verification plan

**Stage 1 — offline, no model calls.** Replay `explicit_module()` and the proposed guard over every stored
question (57 manual-coverage + 13 routing probes + 10 fresh + 14 corrected-claims + 8 work-order = 102) and
report, per question: module before, module after, and whether the change is intended. Required outcomes:

- `hist-1` and the `prep-*` cases route to **audit** or **clarify**, never Technical;
- **zero** changes among the questions that currently route correctly — in particular genuine PMS questions
  containing "history" (running-hours history, rotation history) and "review" (work-order review) must not move;
- paraphrases that name no module and no manual term still route by vector, and are caught by the guard only
  when the chosen module does not lexically cover the question.

**Stage 2 — bounded live run, needs approval.** A new isolated arm with the flags on; routing suite (13) plus
manual coverage (57 × 3) against the current arm. Accept only if routing does not regress and the Audit cases
move to audit/clarify.

**Falsification:** if Stage 1 moves any currently-correct question, the guard threshold or the phrase list is
wrong and the proposal fails as written. That is the test to run first.
