# Audit History routing — v2: two changes, tested separately

Supersedes the single-change version in `ROUTING-PROPOSAL-audit-history.md` after the reviewer's point that a
recognition gap and a clarification guard are different things and must be measured apart. Nothing implemented.

## What is proven, and what is not

**PROVEN (offline, reproducible):** `_GENERIC_TITLE_WORDS` contains `history` and `preparation`, so
`_terms_from_title()` returns `[]` for *Audit - History Manual* and *Audit - Preparation Manual*. Those two
documents contribute **no** routing term, and `explicit_module()` on the `hist-1` question returns
`(None, "no module named")`. This is a **recognition gap** and it is a fact about the code.

**NOT proven:** that closing the gap fixes `hist-1`. Between the gap and the wrong answer sit the vector
ranking, the 1.15 floor, the 0.07 clarify margin and the answer model. I previously wrote "root cause proven";
that overstated it. The correct statement is: **the recognition gap is proven; the causal chain to the wrong
answer is not.** Astra also cannot check it from the pack as shipped — the routing code and the captured inputs
were not included. Both are in this pack now (`routing-evidence/`).

## Change A — recognition (title matching)

Make the two Audit manuals nameable. `_GENERIC_TITLE_WORDS` is doing two jobs: dropping words that are noise in
every title (`user`, `manual`, `office`, `R1`) and, accidentally, dropping the only distinguishing word in two
titles.

- keep the noise list for **single bare tokens**;
- additionally emit a **module-qualified phrase** per document: `audit history`, `audit preparation`,
  `technical sync`;
- match a phrase only when the question contains it (or a close variant), never the bare word.

**Why the bare word is not enough — the reviewer is right.** "history" is unique *among titles* but not
unambiguous *in a user's question*: "running-hours history", "rotation history", "sync history" are Technical.
Matching only the qualified phrase avoids that. It also means a paraphrase that says "inspection history"
without "audit" still will not match — a limitation of Change A, stated, not hidden.

**Files:** `app/retrieval.py` — `_GENERIC_TITLE_WORDS`, `_terms_from_title()`, `title_terms()`.

**Test A, offline, no model calls.** Replay `explicit_module()` over all 102 stored questions and report a
three-column table: module named before / after / whether the question is genuinely about that module.
Pass conditions:
1. `hist-1` and the `prep-*` questions resolve to `audit`;
2. **zero** currently-correct questions change — in particular any Technical question containing "history";
3. the false-positive probe: synthetic questions "what is the running hours history of a component" and
   "show the sync history" must **not** resolve to audit.

Change A can ship or fail on Test A alone. It does not need Change B.

## Change B — the clarification guard

Separate and independently testable: when the chosen module does not lexically account for the question's
distinctive terms, prefer clarify over answering.

**The reviewer's objection is accepted:** a guard like this can reject valid paraphrases and push the assistant
into asking for clarification more often. Clarifying is not free — it is a worse answer than a correct one.
So Change B must be measured on **three** outcomes, never two:

| outcome | meaning |
|---|---|
| **correct-from-right-module** | answered, right module, supported by supplied text — the goal |
| **clarify** | asked which module — acceptable, but a cost |
| **wrong-module answer** | answered confidently from the wrong feature — the failure being removed |

Reporting "hist-1 no longer wrong" is not sufficient: it must say whether it became *correct* or merely
*clarified*, and how many previously-correct questions became clarifications.

**Files:** `app/retrieval.py` `route()`; `app/config.py` two flags default off
(`assistant_route_guard`, `route_guard_min`); reuses `db.search_lexical`.

**Test B, offline first.** Recompute the guard over the stored candidate lists for all 102 questions and report
the three-outcome table above, plus the count of questions whose outcome changes in each direction. Pass
condition: wrong-module answers fall, and clarifications rise by no more than a threshold the owner sets in
advance (my suggestion: no more than 2 of 102, and none among the 13 routing probes).

**Test B cannot be run on stored data alone for the answer text** — the stored answers were produced under the
old routing. Stage 2 is a bounded live run, and needs approval.

## Precedence, unchanged from v1

explicit module name > originating-module (UI) context > vector similarity. Today the UI context only breaks a
tie below `ROUTE_MARGIN`; it must never override a module the question names.

## Not in scope

The audience-label problem — turning "Audience: Office / Sail Admin" into a permission rule — is an **answer**
behaviour. Change A and Change B do not address it. It stays open as A2b, and `certsurveys-2` on the F0 arm is
a second instance of the same shape (a "Mandatory field" marker turned into "the record cannot be saved").
