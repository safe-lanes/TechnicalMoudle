# Routing — v3, rebuilt around two executable findings

Supersedes v1 (`ROUTING-PROPOSAL-audit-history.md`) and v2 (`ROUTING-PROPOSAL-v2-two-changes.md`), both kept for
the trace. Nothing implemented. No model calls were used to produce this.

## What the reviewer showed, and what I withdraw

**Change A is withdrawn as a fix for `hist-1`.** The reviewer ran the supplied functions and is right:

```
explicit_module("Who can comment in the audit history review section?")   -> ('audit', 'module name in question')
explicit_module("audit preparation checklist attachments")                -> ('audit', 'module name in question')
explicit_module("...the Review section of an inspection history record...") -> (None, 'no module named')
```

Any question containing the word **audit** already routes to Audit through the existing `audit` alias, with or
without title terms. The reported question says "**inspection** history" and contains no module word, so adding
`audit history` as a title phrase changes nothing for it. v2 admitted that limitation and then set a pass
condition requiring that same question to resolve to `audit`. **Those two statements contradicted each other;
the pass condition was unsatisfiable.** Withdrawn.

The recognition gap is still real (the two Audit manuals yield no title term) but it is **narrow**: it only
affects a question that names the manual without naming the module. It is not the `hist-1` path.

## The two findings worth fixing, both reproduced

### R1 — ambiguous title terms are not dropped; the first document wins (order-dependent)

The comment says one thing, the code does another:

```python
for module, file in await db.document_titles():
    for t in _terms_from_title(file):
        if t and terms.get(t, module) == module:   # keeps the FIRST module; never removes the term
            terms[t] = module
# a term that maps to more than one module is dropped (ambiguous)   <-- the code does not do this
_title_terms = {t: m for t, m in terms.items() if m in MODULE_LABELS}
```

Reproduced with a synthetic collision (`Safety - Master Review Manual` vs `Technical - Master Review Notes`):

```
order 1: {'master review': 'safety'}
order 2: {'master review': 'technical'}
```

Routing therefore depends on the order `db.document_titles()` returns rows — which no caller controls.

**Fix:** make the code do what the comment says. Count modules per term and drop any term with more than one;
or, if a winner is wanted, make the rule explicit and deterministic rather than incidental.

**Offline test — already run** (`routing-evidence/R1-R2-reproduction.txt`): the term map differs when the
document list is reversed, and the scan for terms that are ambiguous across the real corpus returns **none**.
So R1 is a **latent** fault today, not an active one: it would bite the first time two modules ship a manual
whose distinguishing phrase matches. Worth fixing because it is cheap and the comment already promises the
behaviour — but it is **not** causing any current misroute, and the report must not imply otherwise.

### R2 — a named module is honoured only if it is already a candidate

```python
if named and named in best:      # `best` contains only modules with a hit inside route_sim_floor
    top_module, reason = named, f"explicit: {why}"
```

When the question names a module that has **no** chunk inside the 1.15 floor, the name is silently discarded and
vector routing answers from a different module. The strongest available signal loses to the weakest.

**Fix:** when a module is named and has no candidate inside the floor, do not answer from another module —
return `clarify` naming it, or `not_documented` for that module.

**Offline test — still to run:** over the stored candidate lists for all 102 questions, count how often
`named` is set while `named not in best`. If that count is zero, R2 is likewise latent and must be reported as
such. This test needs the per-question candidate lists rather than the final five excerpts, so it is the one
piece of offline work still outstanding here.

## What this does **not** do

**Neither fix addresses `hist-1`.** That question names no module, so R2 never engages, and R1 changes nothing
for it. `hist-1` remains open. Its mechanism is a recall problem — no Audit chunk lands inside the floor for a
question whose subject is an Audit feature — and the only candidate answer to that is the lexical/clarification
guard, which stays **on hold** at the reviewer's instruction.

If the guard is ever tried, it is measured on **three** outcomes, never two:
correct-from-right-module · clarify · wrong-module answer. "No longer wrong" is not a result.

## Evidence-class statement

- R1: **PROVEN as a code defect** (order-dependence reproduced) and **measured as latent** — no ambiguous
  term exists on the current corpus.
- R2: **PROVEN as a code path** (the `named in best` gate is in the shipped source). Whether it fires on any
  current question is **not yet measured** — that test is named above and not run.
- "Root cause of `hist-1`": **withdrawn**. The recognition gap is proven; it is not the cause of `hist-1`, and
  no fix here is claimed to fix `hist-1`.
- Effect of either fix on live behaviour: **not measured.** Offline tests first; nothing implemented.
