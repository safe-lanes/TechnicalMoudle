# Chatbot knowledge management — pilot report (final round)

**SAIL AI Assistant · Technical module · Build and verification report, revision 2**

- **Prepared for:** Astra (review)
- **Requested by:** Ghazi Anwer
- **Work done:** 30 Sep and 1 Oct 2026
- **Status:** complete on the isolated pilot.
  - Committed **locally** on `chatbot-enterprise` as `120b42d15`.
  - **Not merged, pushed or deployed.** No new public endpoint.
  - Production, the live service, the live index and the other services are unchanged.
- **Detailed evidence:** `docs/assistant-experiments/2026-09-30-kb-pilot/`:
  - `PILOT-RESULTS.md` — results;
  - `APP-BEHAVIOUR-VERIFIED.md` — intended / observed / defect, kept separate;
  - `DEFECTS-FOR-DEVELOPMENT.md` — D1–D7;
  - harness, failure-test and four-example outputs;
  - `screenshots-2026-10-01/`.
- **Guides:**
  - `docs/CHATBOT-KNOWLEDGE-PILOT-GUIDE.md` — assigning trainers, and using the screen;
  - `docs/CHATBOT-KNOWLEDGE-PILOT-ACCESS-PLAN.md` — Jeevan's own access, waiting for approval.

**Evidence classes:**
- **PROVEN** — run, output kept.
- **READ** — from code.
- **INFERRED** — a deduction, basis stated.

**Pilot used:** yes, for everything below.

---

## 1. Summary

**Trainers are now configurable per module:**
- Jeevan is not hard-coded anywhere.
- A trainer grant names one module, a publishing scope (own company or product-wide) and, separately, whether guidance
  may be shared across environments.
- It is matched on the verified identity's issuer + company + user id, and checked on every request.

**Proven boundaries:**
- An ordinary Sail Admin cannot manage knowledge.
- The same user id in another company, or another environment, gets nothing.
- A revoked trainer is refused in an already-open screen.

**Environments are explicit:**
- Guidance applies to the environment it was written in, unless explicitly shared.
- A dev entry, and a dev supersede, do not affect the same company's (simulated) production.

**Test draft is now representative:** it answers through the widget's own path (tool loop, same model and settings),
with the draft visible only in that request and never logged.

**Publishing is safe under failure (PROVEN):**
- With an embedding outage, or a failure inside the swap transaction, the served revision, its searchable chunk and its
  supersedes are unchanged.
- Rollback restores the earlier revision's text and supersedes.

**Review corrections are closed:**
- The reversed "cascaded to all child components" sentence is traced to two manual passages. A correction entry now
  replaces them.
- The future-date rule is stated as an Update RH **screen** check.
- The sub-component check is not presented as enforced.
- Work-order retention on job delete is now PROVEN (34 work orders kept).

**The four examples answer correctly by meaning and evidence,** with minor wording nuances stated in §4.

**Regression:** no content regression against the served behaviour (§6).

---

## 2. Requirements (final brief) and how each was met

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Configurable trainers module by module; Jeevan = Technical only, not hard-coded | `kb_trainers` grants per module via `python -m app.kb_admin`; Jeevan's real grant to be added with his ids | PROVEN (harness, browser) |
| 1 | Chat access and knowledge access separate; Sail Admin keeps chat | Chat unchanged (shore-only, Sail Admin); training needs a grant | PROVEN: ordinary Sail Admin chats and reports, cannot manage (403, no icon) |
| 1 | Multiple trainers per module; Technical ≠ Crewing | Two Technical trainers + one Crewing trainer, each confined to their module | PROVEN |
| 1 | Match issuer + company + user id; same id in another company inherits nothing | As specified | PROVEN (other company and other environment both denied) |
| 1 | Document assign / revoke | Guide Part A | — |
| 2 | Chat → Manage knowledge → permitted modules → create/edit → save → test → publish | Implemented end to end | PROVEN (browser; normal-browser new tab PROVEN in Chromium) |
| 2 | Only published content in ordinary answers; reports ≠ knowledge | As specified | PROVEN |
| 2 | History, rollback, retire; revocation stops existing sessions | As specified | PROVEN (harness + browser revocation) |
| 3 | Module vs global/company scope separate; global only when granted | `publish_scope` per grant | PROVEN |
| 3 | Company entries/feedback/supersedes within scope; company correction never hides global passages for others | As specified | PROVEN |
| 3 | Same company across dev and production; environment-specific vs explicitly shared | `env_scope` per entry; `*` only with the share grant | PROVEN (shore B = simulated production) |
| 3 | Version applicability | Recorded and shown; **not filtered** (the widget sends no app version) | Limitation §7 |
| 3 | Pilot publications/previews never affect production | Separate pilot DB; environment filter | PROVEN (live unchanged; dev → prod isolation) |
| 4 | Qualify "all four correct"; trace the cascade sentence; screen vs endpoint future date; no active-child claim; WO retention runtime-proven | All addressed | §4, `APP-BEHAVIOUR-VERIFIED.md` |
| 4 | Keep intended / observed / defects separate; log defects separately | Document restructured; D1–D7 logged (not fixed) | — |
| 5 | Test draft through the widget's path, model and settings; no leaks via history or caches | Tool loop with documentation search; not logged; no answer cache exists | PROVEN (path, isolation); READ (no cache) |
| 6 | Simulated embedding failure; atomic activation; retire/rollback restore scope | 8/8 | PROVEN |
| 6 | Clear test accounts; annotate history of entries made under "Jeevan (pilot)" | DEV TEST accounts; audit notes on all 5 earlier entries | PROVEN |
| 7 | Status mismatch fixed; feedback textbox rechecked; Save/Test/Publish clear; reusable for every module; shore-only | Done | PROVEN (browser) |
| 8 | Bounded verification + handoff; local commit; access plan | Done | §§4–6, §9, access plan |

---

## 3. What changed since the previous report

1. **Trainers:**
   - new table `kb_trainers` (migration `0009`) and admin command `app/kb_admin.py`;
   - the env-var owner list was **removed**;
   - grants are read per request;
   - ship identities are refused;
   - new endpoint `GET /kb/eligibility`, so the widget shows the icon to trainers only.
2. **Environment scope** on entries, chunks, supersedes and review items:
   - the retrieval filter enforces it;
   - knowledge with no environment is never served (fail closed).
3. **Preview** runs through the tool loop (`chat.handle_chat(…, preview=True)`, documentation search only):
   - not logged;
   - `draftRetrieved` is measured from what the search returned, not from citations.
4. **Content:**
   - four drafts revised;
   - a fifth correction entry;
   - all were left as **drafts** for Jeevan, after a clearly labelled pilot-test publish.
5. **UI:**
   - status label;
   - action explanations;
   - environment choice;
   - permitted modules only;
   - progress message.
   - **A blank-screen bug I introduced** (duplicate `const note`) was caught in the browser and fixed. A unit test now
     syntax-checks the screen script; it was verified to fail on the broken copy.
6. **Tests and scripts:**
   - `verify_kb_pilot.py` rewritten: 68 checks, two environments, DEV TEST accounts;
   - new `verify_kb_publish_failure.py`;
   - `kb_pilot_four_examples.py` revised;
   - unit tests: 77.

---

## 4. The four examples — final assessment (PROVEN, by reading; `four-examples-20261001-114006.json`)

| Case | Answer with the entry | Verdict and nuance |
|---|---|---|
| Delete jobs | Delete steps, soft delete, **work orders kept** (now runtime-proven with 34), Deactivate Job alternative; cites the entry | Correct. Says "only Sail Admin and Client Admin can delete" — the **intended** (screen) rule; the server does not enforce it (D1, kept out of user text) |
| Deactivate components | Is Active = No; active jobs block it; deal with spares; deactivate sub-components first — "the application may not prevent deactivation while a child component remains active" | Correct; the sub-component check is **not** claimed as enforced. The spares block remains READ (not exercised) |
| RH counter types | Three types; Master → Inherited direction; no "Non-inherited" | Correct. The conflicting manual sentence is no longer among the sources: traced to Office p.40 and Vessel p.34, both replaced by the correction entry |
| RH validations | All rules matching the PROVEN behaviour; future date under "Date validation on the **Update RH screen**" | Correct. Minor: the "not earlier than the last update" rule is grouped under the same screen heading, although the server also enforces it |

**Process:**
- Preview used the draft in all four cases, through `search_module_docs`.
- A scan found no internal notes or pilot-test labels in any answer.
- The pilot-test publishes were made with the **DEV TEST** account and marked "PILOT TEST ONLY — not confirmed by Jeevan".
  All were retired and reset to drafts.

---

## 5. Verification results

| Check | Result |
|---|---|
| Harness `verify_kb_pilot.py` (permissions, lifecycle, environments, company scope, supersede + rollback, reports, revocation, module context) | **68/68** PROVEN |
| Publish failure `verify_kb_publish_failure.py` (embedding outage, in-transaction failure, instrument check, rollback, retire) | **8/8** PROVEN |
| Real browser — ordinary user, two module trainers, lifecycle, dev vs production, revocation | PROVEN (7 screenshots) |
| Normal browser (Chromium): "Manage knowledge" opens a new tab, signed in, token removed, no link back | PROVEN |
| Unit tests / mypy / ruff (changed files) | 77 passed / clean / clean |
| PMS `tsc` | 294 = branch baseline (no new errors) |

---

## 6. Regression — existing suites, A/B (PROVEN)

BASE = new features off (prompt fingerprint equals live). KB = pilot. Same image (r6), same index copy, nothing published.

| Suite | BASE | KB |
|---|---|---|
| Routing 13 | 13 | 13 |
| Retrieval 18 | 18 | 18 |
| Work orders 8 (all runs) | 8 | 8 |
| Frozen 12 | 11 | 11 |
| Corrected 14 | 13 | 13 |
| Fresh 10 | 10 | 10 |
| Manual coverage 57 (all runs) | 34 | 32 |

**Manual coverage:**
- **KB losses:** all four are literal-phrase misses in one or two of three runs, with the same meaning (for example
  "viewed, edited, or exported" where the case requires "view, edit, or export").
- **KB gains:** two, of the same kind.
- **Previous run:** yesterday's r3 run showed the opposite (BASE 33, KB 35).
- **Reading:** judge variance, not a content regression. This is my reading; there was no second reader.

---

## 7. Limitations (plainly)

1. **Jeevan cannot use the pilot from his own computer yet.** The plan is ready (separate hostname, dev PMS widget
   change, his grant). It needs approval because it exposes an endpoint and deploys to dev.
2. **Trainers are managed by command**, not on a screen (the agreed simple mechanism).
3. **Version-specific applicability is not filtered.** The widget sends no application version; the version is recorded
   and shown in the entry. Environments **are** enforced.
4. **Preview covers documentation questions.** Live-data tools need the user's short-lived token, which the knowledge
   screen does not hold.
5. **"Production" in the tests is the pilot's simulated production** (shore B), not the real production environment.
6. **Answer wording follows meaning, not exact text.** Small qualifiers can be regrouped (§4).
7. **Application defects D1–D7 are logged, not fixed.** D2 (active-child check) rests on one vessel's data; one
   production count is needed.
8. **The spares deactivation check stays READ:** no suitable test component.
9. **The PMS module's own RBAC still trusts browser headers** (mock identity). The knowledge screen does not rely on them.

---

## 8. Decisions made in this round that you may want to review

1. **Grants live in the assistant database,** managed by a command, rather than in an environment variable: no restart,
   immediate revocation, history kept.
2. **Environment = the registered instance's environment label;** `*` = shared, allowed only with an explicit share grant.
3. **A Crewing trainer in the pilot signs in through the Technical instance** (the only one registered). In real use the
   grant's issuer is the application the trainer signs in through.
4. **Global trainers see review items from every company of their environment** (decision carried over from round 1).
5. **The manuals' reversed note is handled by a correction entry** (new, in draft for Jeevan); the manuals themselves
   are not changed.
6. **Pilot-test publishes of Jeevan's drafts** were used to test the user path, then retired and reset (labelled in
   history).

---

## 9. State, commit and next steps

- **Code:** local commit on `chatbot-enterprise`: **`120b42d15`** (code + evidence), plus a docs-only follow-up commit recording this SHA. Not pushed.
- **Pilot:**
  - AI server: `sail-kbpilot-db`, `sail-assistant-py-kbpilot` (image `kbpilot-r7-120b42d15`, built with `git archive` from the commit; harness **68/68** on it, `harness-r7-120b42d15.txt`), and
    `sail-assistant-py-kbbase` (A/B only, removable);
  - local: shores A/B and the tunnel.
- **Pilot data:**
  - Jeevan's five drafts (four examples + the correction), all points open;
  - the retired demo entries;
  - the browser reports.
- **Awaiting approval:**
  1. push;
  2. the access plan (hostname, nginx, dev widget deploy, dev credentials in the pilot registry);
  3. Jeevan's dev user id and company domain;
  4. a production count for D2/D7.
