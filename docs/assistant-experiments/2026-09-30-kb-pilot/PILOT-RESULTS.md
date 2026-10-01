# Chatbot knowledge management — pilot results (final round, 1-Oct-2026)

**Evidence classes:**
- **PROVEN** — run on the pilot or the test shore, with output kept.
- **READ** — from code, not run.
- **INFERRED** — a deduction, with its basis stated.

**Pilot used:** yes, for every result below. Production was not used (instruction: keep production untouched).

**Earlier evidence:** it is reused only where this round did not change the code it covers; §5 lists what was rerun.

## 1. What changed this round

1. **Trainers per module** (DB table `kb_trainers`, managed with `python -m app.kb_admin`).
   - Matched on issuer + company + user id.
   - Publishing scope (company / global) is separate from the module grant.
   - Sharing across environments is a separate, explicit grant.
   - Grants are read on every request, so a revocation also stops an open session.
   - Ship identities cannot open the screen (shore-only).
   - The widget shows the "Manage knowledge" icon only to trainers (`GET /kb/eligibility`).
   - The old `ASSISTANT_KB_OWNERS` setting is removed.
2. **Explicit environment** on every entry, chunk and supersede: the environment label of the trainer's instance, or
   `*` for guidance explicitly shared by all environments. Knowledge without an environment is never served.
3. **Test draft** now uses the widget's answering path: the tool loop, with the same model, instructions and settings.
   - It is limited to documentation search.
   - The draft is retrievable only inside that request.
   - A preview is never logged as a conversation.
4. **Content corrections** after review:
   - the RH answers no longer mix in the manuals' reversed "cascaded to all child components" note (a new correction
     entry replaces the two manual passages it came from);
   - the future-date rule is stated as a check by the Update RH **screen**;
   - the sub-component advice is not presented as an enforced check;
   - work-order retention on delete is runtime-tested.
5. **UI:**
   - the retired/draft status label is consistent in the list and the editor;
   - Save draft / Test draft / Publish are explained on screen;
   - the module list shows permitted modules only;
   - there is an environment choice;
   - the progress message stays visible during a test.
6. **Test accounts:**
   - New tests use clearly named **DEV TEST** accounts.
   - Earlier pilot entries carry a history note that development created them under "Jeevan (pilot)", and that Jeevan
     neither authored nor confirmed them.

## 2. Permissions, scope and lifecycle — harness `verify_kb_pilot.py` (PROVEN, 68/68 on r5; `harness-r5.txt`)

**Real identity path:** identities are minted by the pilot PMS shores, as the widget does:
- shore A = `technical-dev`, companies `pilot` and `pilot-b`;
- shore B = `technical-prod`, a **simulated** production environment with the same company `pilot`.

**Trainer boundaries:**
- Two Technical trainers see Technical only.
- The Crewing trainer sees Crewing only.
- Each is refused (403) when creating an entry in the other module.
- The **second** Technical trainer can publish the first trainer's entry.
- An ordinary Sail Admin is not a trainer: 403 on create, list and the review queue.
- The widget eligibility check returns "no", so the icon is hidden.

**Identity matching:**
- The **same user id in another company** gets nothing.
- The **same user id and company in production** gets nothing.
- A **ship** identity cannot open the screen.

**Lifecycle:**
- A draft is invisible to an ordinary user, including while it is being tested.
- Publishing is refused while a point needs confirmation.
- **Test draft** uses the tool loop (`search_module_docs`) and the draft.
- After publish, the user's answer follows the entry and names it.
- An unpublished edit is not served.
- A publish failing validation is refused, and revision 1 stays served.
- Revision 2 is served after publish.
- Rollback serves revision 1's content as revision 3.
- History keeps every revision.
- After retire, the entry is no longer retrieved.

**Environment (same company, dev vs production):**
- A dev entry is not served to production users.
- A dev trainer's production login can neither read nor change it.
- Shared guidance needs the share grant (403 without it).
- Shared guidance reaches dev **and** production users.
- A non-share trainer can read it but not change it.
- After retire it is gone in both environments.

**Company scope:**
- A company-B entry supersedes a real manual passage for company B only.
- The other company keeps the passage and never gets company B's entry.
- A global supersede applies to both companies.
- A dev supersede does not hide the passage in production.
- **Rollback restores the earlier revision's supersede** (revision 2 removed it, and rollback to revision 1 hid the
  passage again).
- Retire restores the passage.

**Reports:**
- A report creates a review item and changes nothing.
- Both Technical trainers see it.
- Global trainers see company B's reports; the company-B trainer sees only company B's.
- A production report does not reach dev trainers.
- The Crewing trainer does not get Technical reports.
- "Create entry from this" links the report.
- A company trainer cannot close another company's report.

**Revocation:**
- Revoking trainer 2 with the admin command makes their **already-open session** get 403 on the next change.
- Re-granting restores access.

**Module context:** "RH" asked from Technical → Technical; "In Crewing, …" → Crewing.

## 3. Publish failure and atomicity — `verify_kb_publish_failure.py` (PROVEN, 8/8 on r5; `publish-failure-r5.txt`)

The script runs inside a pilot container against the pilot database. The test entry supersedes one manual passage.

| Step | Result |
|---|---|
| Embedding service fails during publish (simulated outage) | refused **502** "…previously published version is still in use"; served revision, **searchable chunk (content and embedding hash)** and **supersede rows unchanged** |
| Failure **inside** the swap transaction, after the new chunk and supersedes were written | refused **500**; everything rolled back; revision 1 still served, unchanged |
| Instrument check | a real publish of revision 2 **does** change the snapshot (so the comparison can see a change) |
| Rollback to revision 1 | revision 1's guidance text **and its supersede** are restored (as revision 3) |
| Retire | served chunk and supersede removed |

## 4. The four examples, assessed by meaning and evidence (PROVEN; `four-examples-20261001-114006.json`)

**Method:**
1. Asked by an ordinary DEV TEST user through the widget path, before any entry was served.
2. "Test draft" through the new chatbot-path preview.
3. **All five** entries were published as **pilot-test revisions**, marked "PILOT TEST ONLY — not confirmed by Jeevan".
   The fifth is the correction of the manuals' Gear-icon note.
4. Asked again, then everything was retired and reset to drafts for Jeevan.

| Case | Before (no entry) | With the entry (user's widget answer) | Verdict |
|---|---|---|---|
| Delete jobs | Says deleting is not documented; points to modify/change-request sections | Delete button steps; soft-delete effect; work orders kept; Deactivate Job alternative; cites the entry | **Correct.** Nuance: says "only Sail Admin and Client Admin can delete" — that is the intended (screen) rule; the server does not enforce it (D1, not for users) |
| Deactivate components | Not documented; still lists Edit steps | Is Active = No; jobs block it; deal with spares; deactivate sub-components first and "the application may not prevent deactivation while a child component remains active" | **Correct** — the sub-component check is **not** presented as enforced |
| RH counter types | "Documentation does not list types", then RH update steps | Three types; Master → Inherited direction ("when its RH is updated, the increase is also applied to linked Inherited components"); no "Non-inherited" | **Correct** — the reversed manual note is no longer among the sources (superseded by the correction entry) |
| RH validations | Lists form fields as "validations" | All rules matching the PROVEN behaviour. The future-date rule sits under "Date validation on the **Update RH screen**" | **Correct.** Minor: the "not earlier than the last update" rule is grouped under the same screen heading, although the server also enforces it (not false; grouping only) |

- In every case the preview used the draft (`draftRetrieved` true) through `search_module_docs`.
- A scan found no internal notes or pilot-test labels in any answer.

## 5. Real browser (PROVEN, 1-Oct; screenshots in `screenshots-2026-10-01/`)

1. **Ordinary Sail Admin:**
   - chats, and has **no** "Manage knowledge" icon;
   - "Report this answer": the textbox takes real typing, Send works ("Sent to the module's knowledge trainers…"), and
     the report appears in the Technical trainer's review queue.
2. **Technical trainer 1:**
   - the icon is shown;
   - the screen shows "DEV TEST Technical trainer 1 · pilot · dev" and **Technical only**;
   - Jeevan's drafts show "draft · earlier version retired" in **both** the list and the editor (status fix).
3. **Lifecycle:**
   - created a DEV TEST entry by typing;
   - **Save draft**;
   - **Test draft**: "Your draft was used… Answered the same way as the chatbot (tool loop, documentation search)";
   - **Publish**.
4. **Answers after publish:**
   - the **dev** ordinary user's widget answer cites "Technical – Knowledge: DEV TEST demo … revision 1 (Code-verified)";
   - the **production** user of the **same company** gets the manuals' answer, not the dev entry.
5. **Edit and restore:**
   - edit → Save draft (revision 1 still served) → Publish revision 2;
   - **Restore** revision 1 → "Revision 1 restored and published" (revision 3, revision 1's text);
   - **Retire** (two clicks) → retired.
6. **Crewing trainer:** sees **Crewing only**, and no Technical entries.
7. **Revocation:** the Crewing grant was revoked with the admin command while the screen was open. The next **Save
   draft** was refused (403) with "You are not a knowledge trainer for this module, scope and environment". Re-granted
   afterwards.
8. **Defects found in the browser and fixed:**
   - a duplicate `const note` left the whole screen blank (stuck on "Signing in…"). The API harness could not see this,
     so a new unit test now syntax-checks the screen script; it was verified to fail on the broken copy;
   - the "Testing…" message disappeared while a test was running. Fixed.

**Note:** in the desktop browser pane the knowledge screen opened outside the pane (new window), so the demo opened it
in the same tab with the same minted token. In a normal browser (Playwright Chromium) the icon opened a **new tab**,
signed in ("DEV TEST Technical trainer 1 · pilot · dev", Technical only) — PROVEN.

## 6. Regression — existing suites, A/B on image r6 (PROVEN; log `~/kbpilot-build-r6/out/runs.txt` on the AI server)

**Setup:**
- BASE = every new feature off (prompt fingerprint `b31c3f9c` = live).
- KB = pilot settings.
- Same code, same index copy, no entries published during the run.

| Suite | BASE | KB | Reading |
|---|---|---|---|
| Routing 13 | 13/13 | 13/13 | equal |
| Retrieval 18 | 18/18 | 18/18 | equal |
| Work orders 8 (all runs) | 8/8 | 8/8 | equal |
| Frozen 12 (majority) | 11/12 | 11/12 | equal |
| Corrected 14 (majority) | 13/14 | 13/14 | equal |
| Fresh 10 | 10/10 | 10/10 | equal |
| Manual coverage 57 (all three runs must pass) | 34/57 | 32/57 | KB −4 / +2. All four losses are **literal-phrase** misses in one or two of three runs, each case passing at least once: "view, edit, or export" vs "viewed, edited, or exported"; "past their due date" vs "has passed its due date"; "cannot be modified" vs "must select a location before modifying"; "attached / history record" vs "attachments linked to the History record". The gains are of the same kind. Yesterday's r3 run went the other way (BASE 33, KB 35) → judge variance, not a content regression (read by me) |

**Other checks:**
- Unit tests: 77 passed, including the new permission/environment tests and the UI-script check.
- mypy: clean.
- ruff: clean on changed files.
- PMS `tsc`: 294, equal to this branch's baseline (no new errors).

## 7. Application behaviour and defects

See `APP-BEHAVIOUR-VERIFIED.md` (intended / observed / defect, kept separate) and `DEFECTS-FOR-DEVELOPMENT.md` (D1–D7,
not fixed, logged for separate work).

**New this round (PROVEN):** deleting a job with **34** work orders keeps all of them, unchanged and listed.

**Still READ:** the spares check on deactivation. It was not exercised, because no suitable test component exists.

## 8. Remaining limitations

1. **Jeevan cannot open the pilot himself yet.** See `docs/CHATBOT-KNOWLEDGE-PILOT-ACCESS-PLAN.md`. A separate hostname
   is needed and requires approval.
2. **Trainers are managed by command, not on screen.** This is the simple configuration agreed for this version.
3. **Version applicability is not filtered.** "Application version" is recorded and shown in the entry, but the widget
   does not send the application version, so answers are not filtered by it. Environments **are** enforced.
4. **Preview covers documentation questions only.** Live-data tools need the user's short-lived token, which the
   knowledge screen does not hold. Knowledge entries are documentation, so this is the relevant path; data answers are
   unchanged.
5. **Same company on two environments** was tested with the pilot's simulated production (shore B), not real
   production.
6. **Answer wording follows meaning, not exact text.** Small qualifiers can be regrouped (§4).
7. **The PMS module's own RBAC still trusts browser headers** (mock-identity backlog, D1/D6). The knowledge screen does
   not rely on them.
8. **In the desktop browser pane**, "Manage knowledge" opens outside the pane. In a normal browser (Playwright Chromium) it
   was **PROVEN** to open a new tab, signed in as the trainer, with the token removed from the address and no link back
   to the PMS page (`window.opener` null).
