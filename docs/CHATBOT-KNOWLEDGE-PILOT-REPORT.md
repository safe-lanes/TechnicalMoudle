# Chatbot knowledge management — pilot report

**SAIL AI Assistant · Technical module · Build and verification report — FINAL STATE (1 Oct 2026)**

- **Prepared for:** Astra (review)
- **Requested by:** Ghazi Anwer
- **Work done:** 30 Sep and 1 Oct 2026
- **Status:** pilot complete. Pushed to the feature branch `origin/feature/chatbot-enterprise`, with Ghazi's approval.
  - **Not merged into `replit_dev`, not deployed.**
  - No public endpoint.
  - Production, the live assistant service, its index and the other services are unchanged.
- **Final code:** commit `7550c9000`. Evidence commit `ed80dda86`; this report update follows it.
- **Tested image:** `sail-assistant-py:kbpilot-7550c9000` (built with `git archive` from `7550c9000`), running as the
  isolated pilot service.
- **Detailed evidence:** `docs/assistant-experiments/2026-09-30-kb-pilot/`:
  - `PILOT-RESULTS.md`;
  - `APP-BEHAVIOUR-VERIFIED.md`;
  - `DEFECTS-FOR-DEVELOPMENT.md` (D1–D7);
  - harness, failure-test and four-example outputs;
  - `screenshots-2026-10-01/`.
- **Guides:**
  - `docs/CHATBOT-KNOWLEDGE-PILOT-GUIDE.md` — assigning trainers, and using the screen;
  - `docs/CHATBOT-KNOWLEDGE-PILOT-ACCESS-PLAN.md` — Jeevan's own access; a separate approval is pending.

**Evidence classes:**
- **PROVEN** — run, output kept.
- **READ** — from code.
- **INFERRED** — a deduction, basis stated.

**Pilot used:** yes, for every result.

> **How to read this report.**
> - **§1** is the **final state**.
> - **§10** (owner decisions) and **§11** (Astra's corrections and the final version) describe how it was reached.
> - **§2–§9 are historical:** the morning-of-1-Oct round. Their company-only / per-environment design, scope and
>   share-grant fields, and images `kbpilot-r5/r6/r7` were **superseded** by §10–§11. They are kept for the audit trail.

---

## 1. Final state (summary)

**Who trains:**
- Named **SAIL staff**, assigned per **module** on a list kept by the assistant (AI server).
- They are managed on the trainer page `/admin/kb`, which needs the admin token and is not reachable publicly, or with
  the command `python -m app.kb_admin`.
- A trainer is matched on **issuer + company + user id** from the verified login.
- **Sail Admin alone gives no training access.**
- Deactivation applies on the trainer's next click, even in an open screen.

**What trainers do:**
- Draft → **Test draft** → **Publish for all clients and environments** → edit / restore an earlier revision / retire,
  with full history.
- There is no separate approver.
- Test draft uses the chatbot's own answer path for documentation ("how do I") questions. It does not cover live-data
  tools.

**What publishing means:**
- The revision becomes **available to the chatbot** for every client, in dev and production, at once. The chatbot uses
  it when it is relevant; this is not guaranteed in every answer.
- Applying to all clients and environments is **our chosen policy**, not a technical necessity.
- Drafts and unpublished edits are never available to users.

**Reports:**
- "Report this answer" creates a review item for the module's trainers. It never becomes knowledge by itself.
- Trainers must not copy client-specific data from a report into an entry.

**Safety (PROVEN):**
- A failed publish (embedding outage, or a failure inside the transaction) leaves the served revision, its searchable
  content and its superseding unchanged.
- Rollback and retire restore the earlier content.

**The four examples (PROVEN on the final image):**
- All four are correct by meaning and evidence.
- The delete answer says the Delete button "is available to" Sail Admin / Client Admin, with no permission claim.
- RH answers give Master → Inherited, and the future-date rule as an Update RH **screen** check.
- Application defects D1–D7 are logged separately and not fixed.

**Final verification, on image `kbpilot-7550c9000`:**

| Check | Result |
|---|---|
| End-to-end harness | **61/61** |
| Publish-failure test | **8/8** |
| Administrator page workflow in a real browser | PROVEN: add, deactivate, history, reactivate, with each effect checked on the deployed pilot |
| Unit tests | 77 |
| mypy | clean |
| PMS `tsc` | 294 = branch baseline |

**Regression suites:**
- The A/B regression (routing, retrieval, work orders, frozen, corrected, fresh, manual coverage) last ran on image r6
  (§6): no content regression.
- It was **not rerun** on the final image. The later changes were the access rules, the screen labels and the admin
  page; they do not alter retrieval or answers for chatbot users while nothing is published. This is **INFERRED** from
  the diff, not measured.

**Not done (approval needed separately):**
- Jeevan's access from his own computer (access plan).
- Merge into `replit_dev`.
- Any deployment.

---

## 2. Requirements and how each was met (historical)

> **HISTORICAL (morning of 1 Oct 2026).** Superseded by §10–§11 and summarised in §1. Company-only / per-environment scope and the r5–r7 images described here are no longer current.


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

> **HISTORICAL (morning of 1 Oct 2026).** Superseded by §10–§11 and summarised in §1. Company-only / per-environment scope and the r5–r7 images described here are no longer current.


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

## 4. The four examples — assessment of the earlier run (PROVEN, by reading; `four-examples-20261001-114006.json`)

> **HISTORICAL (morning of 1 Oct 2026).** Superseded by §10–§11 and summarised in §1. Company-only / per-environment scope and the r5–r7 images described here are no longer current.


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

> **HISTORICAL (morning of 1 Oct 2026).** Superseded by §10–§11 and summarised in §1. Company-only / per-environment scope and the r5–r7 images described here are no longer current.


| Check | Result |
|---|---|
| Harness `verify_kb_pilot.py` (permissions, lifecycle, environments, company scope, supersede + rollback, reports, revocation, module context) | **68/68** PROVEN |
| Publish failure `verify_kb_publish_failure.py` (embedding outage, in-transaction failure, instrument check, rollback, retire) | **8/8** PROVEN |
| Real browser — ordinary user, two module trainers, lifecycle, dev vs production, revocation | PROVEN (7 screenshots) |
| Normal browser (Chromium): "Manage knowledge" opens a new tab, signed in, token removed, no link back | PROVEN |
| Unit tests / mypy / ruff (changed files) | 77 passed / clean / clean |
| PMS `tsc` | 294 = branch baseline (no new errors) |

---

## 6. Regression — existing suites, A/B on image r6 (PROVEN; still the latest regression run)

> **HISTORICAL (morning of 1 Oct 2026).** Superseded by §10–§11 and summarised in §1. Company-only / per-environment scope and the r5–r7 images described here are no longer current.


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

> **HISTORICAL (morning of 1 Oct 2026).** Superseded by §10–§11 and summarised in §1. Company-only / per-environment scope and the r5–r7 images described here are no longer current.


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

> **HISTORICAL (morning of 1 Oct 2026).** Superseded by §10–§11 and summarised in §1. Company-only / per-environment scope and the r5–r7 images described here are no longer current.


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

> **HISTORICAL (morning of 1 Oct 2026).** Superseded by §10–§11 and summarised in §1. Company-only / per-environment scope and the r5–r7 images described here are no longer current.


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

---

## 10. Addendum (later on 1 Oct 2026): owner decisions applied, plus a trainer page

### Ghazi's decisions after reviewing the pilot

1. **Trainers are a list of named people,** not a SAILERP role. A user has only one SAILERP role, and Sail Admin
   bypasses PMS permission checks, so a role-based grant would have made every Sail Admin a trainer or removed their
   admin role.
2. **Trainers are SAIL staff and train for all clients,** so the company-only option is removed.
3. **One assistant serves every environment and training is done on dev,** so every entry applies to all
   environments. A Publish is live for all clients in dev and production at once.

### Built

- **Trainer page** `/admin/kb` on the AI server, with the same protection as the existing `/admin` endpoints (admin
  token, not reachable from the internet). It provides:
  - a list of trainers (user id, name, company, module, active/inactive, who and when);
  - "Add trainer", picking from people who have used the chatbot or typing the id;
  - deactivate and reactivate.
- **The command** `python -m app.kb_admin` does the same.
- **Simplified access rules:** any trainer of a module may write that module's entries; every entry is for all clients
  and all environments; reports go to all of the module's trainers.
- **Migration `0010`** makes existing knowledge "all clients, all environments" (idempotent).
- **Knowledge screen:** the company and environment choices are removed.

### Found and fixed

- **The pilot's admin token was identical to the live service's.** It had been inherited from an older pilot env file.
  The token was never printed or sent anywhere off the server.
- **Fix:** the pilot now has its own token; superseded pilot env copies were deleted from the AI server; the
  A/B-comparison container that carried the same copy was removed.
- **The live service and its token are unchanged.**

### Verified on pilot image `kbpilot-r8`

- **Harness `verify_kb_pilot.py`: 61/61 (`harness-r8.txt`).** This includes, newly:
  - a dev publish reaches production users and other companies;
  - the supersede applies everywhere;
  - every report reaches all of the module's trainers;
  - the trainer page's API: wrong token refused (401), add trainer, deactivate (refused at once in an open session),
    reactivate, user picker.
- **Publish failure: 8/8.**
- **Unit tests: 77,** including both pages' script syntax.
- **In the browser:** the trainer page renders with no errors, and a wrong token shows "Wrong admin token." I did
  **not** type the real admin token into the browser myself.

---

## 11. Final corrections after Astra's review, and the final version

### Final version (identified)

- **Final code commit:** `7550c9000` on `chatbot-enterprise`, local only and not pushed. Earlier commits on the same
  line: `120b42d15`, `393410399`, `1ca3fca23`.
- **Tested image:** `sail-assistant-py:kbpilot-7550c9000` (image id `sha256:c17216c6…`).
  - Built with `git archive 7550c9000`, not from the working tree.
  - Running as the pilot service.
  - Database migration level `0010`.
  - The live service is unchanged (`v7-r2`).

### The five points

| # | Astra's point | Done | Evidence |
|---|---|---|---|
| 1 | Make the publishing impact unmistakable; sharing is a policy, not a necessity; the pilot must not affect production | Button now reads **"Publish for all clients and environments"**; the screen and guide say publishing makes guidance **available** to the chatbot for every client in dev and production, and that this is our chosen policy (the assistant can keep scopes apart). The pilot remains a separate service and database; nothing published there reaches the real production chatbot | `kb_ui.html`, guide |
| 2 | Commit and identify the final version | Commit `7550c9000`; image `kbpilot-7550c9000` built from it; **harness 61/61** (`harness-7550c9000.txt`); **publish failure 8/8** (`publish-failure-7550c9000.txt`); four examples rerun (`four-examples-20261001-164622.json`) | PROVEN |
| 3 | Test the administrator's page workflow in a real browser, with the pilot token handled securely | See "Administrator workflow" below | PROVEN |
| 4 | Guide wording | The guide now says: identity = **issuer + company + user id**; Publish = available for retrieval, **not** guaranteed in every answer; Test draft covers **documentation** questions, not live-data tools | guide |
| 5 | Delete answer wording | The entry now says "The Delete button is **available** to Sail Admin and Client Admin users". The user's answer on the final image reads "It is available to Sail Admin and Client Admin users", with no permission claim. Defect D1 stays recorded separately | four-examples run, case 1 |

### Administrator workflow (point 3)

**How the token was handled.** To avoid typing a server credential into a browser, the **same committed code** was run on
this machine only (`127.0.0.1:8090`):
- it was connected to the pilot database through an SSH forward;
- it had its own **throwaway admin token**, generated locally and deleted afterwards;
- it was afterwards shut down, along with the forward.

**What was done on the real page** (typing and clicking, screenshots 8 and 9):
1. the token gate;
2. the list of the pilot's real trainers;
3. the person picker (it found the DEV TEST chatbot users);
4. **Add trainer** `devtest-tech-4` → "…is now a Technical trainer";
5. **Deactivate**;
6. **Show inactive** → history;
7. **Reactivate** → "Reactivated";
8. **Deactivate** again, leaving the pilot clean.

**Effect on the deployed pilot** (its own admin token, untouched), checked after each step with the trainer's real
sign-in and one open session:
- after Add: trainer, Technical;
- after Deactivate: refused (403) in the **same open session**;
- after Reactivate: allowed again;
- after the final Deactivate: refused.

### Four examples on the final image

- All four use the draft in preview.
- The served answers are correct.
- Delete: button availability only, no permission claim.
- RH validations: the future-date rule sits under "Date validation on the Update RH **screen**", and the server-side
  "not earlier than the last update" rule is now its own item, which removes the earlier grouping nuance.
- RH types: Master → Inherited, and no "Non-inherited" type.

### Guidance for trainers (Astra's note, now in the screen and the guide)

- Record any version or configuration condition in **Conditions** / **Application version**.
- Do not copy client-specific data from reported conversations into entries, because entries are published for all
  clients.

### State

- **Pilot:** Jeevan's five drafts waiting, two retired demo entries, nothing served.
- **Active DEV TEST trainers:** `devtest-tech-1`, `devtest-tech-2`, `devtest-crew-1`.
- **Ready for Jeevan to test the isolated pilot** once the access plan is approved.
