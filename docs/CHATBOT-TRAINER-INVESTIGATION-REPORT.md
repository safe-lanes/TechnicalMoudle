# Chatbot training: four wrong answers and a trainer workflow

**SAIL AI Assistant · Technical module · Investigation report**

- **Prepared for:** Astra
- **Requested by:** Ghazi Anwer
- **Input:** Jeevan's "Chatboat Question and answers.docx"
- **Date:** 30 Sep 2026
- **Status:** revision 3 (30 Sep). Approved by Ghazi with changes; the pilot is built and tested (§10, §11).

> **Revision 3 corrections (from the pilot, §11)**
> - **Retracted:** "Deactivation is refused while the component has active child components" (Case 2) was READ from code and is **wrong on the pilot data**. A parent with 16 active children was deactivated. The check looks for children by the parent's id, but the data stores the parent's component code. The jobs check does work.
> - The RH rules in Case 4 are now **PROVEN** on the running application (test shore), no longer only READ. Two more server gaps were found (§11).
> - Case 4's reproduction is now explained more fully. The Technical manuals say "Running Hours" and almost never "RH", so most "RH" questions fall out of the Technical documentation. This is a **PROVEN** data point on the pilot index. It is still **not** proven to be the cause of Jeevan's original answer.

> **Revision 2 corrections**
> - Evidence is now separated into **original evidence** (Jeevan's document), **reproduced behaviour** (my read-only runs on the live KB) and **unconfirmed causes**. Revision 1 treated a reproduced Crewing routing as the cause of Jeevan's original answers. That was not proven, because his original answers cite **Technical** manuals.
> - Application permissions are now split into **what the UI shows** and **what the server enforces**. The UI restrictions are not presented as proven server controls, and the enforcement gaps are recorded separately (§8).

---

## 1. Summary

- **Three of the four answers failed because the knowledge is not in the KB:** delete a job, deactivate a component, RH counter types. The chatbot did not say so. It answered with a *different* procedure (Modify Job, Edit Component) or invented a detail (a "Non-inherited" counter type).
- **The fourth (RH validations) is not a knowledge gap.** Several correct Technical rules are in the KB, but the original answer used none of them. It cited only the general Update Running Hours sections. Why those rule passages were not used is **unconfirmed**. My reproduction on a different path routed the question to Crewing ("RH" = Rest Hours), but Jeevan's original answer cited Technical manuals, so it did not follow that route.
- **The true behaviour of all four comes from the application code**, with file references. Some points only the product owner can decide. Following Ghazi's decision, these become **"Needs expert confirmation"** items inside the trainer drafts, not separate questions.
- **What the system has today:** no draft/publish states, revisions, supersede, tenant scope, trainer roles, report button or admin screens. It **does** already index small curated Markdown entries ("KB pilot"), and the proposal builds on that.
- **Proposal:** a small trainer workflow in PMS Admin.
  - Report → draft → review → approve → publish, with revisions, rollback and retire.
  - Published entries are indexed and cited. Drafts never reach answers.
  - Corrections supersede conflicting passages. Company entries stay with that company.
  - Two chatbot fixes: no substitute procedures, and search the module the user is in.

---

## 2. How this was checked

| Evidence | What | Class |
|---|---|---|
| Live KB | Set `kb-xref-e` (965 chunks) on the AI server. The four questions were embedded and searched, with top passages and routing recorded, plus a keyword search of all Technical chunks. Run in a throwaway container of the live image: **read-only**, no conversation log rows written, no reindex. | **PROVEN** |
| Application code | `replit_dev` (what users run) and the approval branch. Every rule below cites file:line, and the cited files are identical on both branches. | **READ** |
| Assistant code | `central-assistant-py` (branch `chatbot-enterprise`): data model, indexer, retrieval, prompts, widget, admin endpoints. | **READ** |
| Original evidence | Jeevan's document: the question, the chatbot's original answer and its cited sources, and his remark. The original conversation's retrieved passages and routing were **not** available for this review. | **ORIGINAL** |
| Pilot (shore + ship) | **Not used for revision 1**, because these are documentation and design questions. The code rules (e.g. 25 h per day, one update per day) are to be confirmed on the pilot application before their entries are published (§10). | **GAP** |

The live-KB searches in this report are **reproductions**. They embed the question alone and run the documentation routing without the widget's module context or conversation history. They show what that path does today. They do **not** show which passages Jeevan's original conversation retrieved.

---

## 3. The four cases

### Case 1 — "How to delete the jobs"

- **Chatbot said:** no Delete Job function is documented, then gave the Modify Job change-request steps.
- **KB has:** nothing. 0 chunks mention deleting a job. *(PROVEN)*
- **Original evidence:** the answer cites Technical sections 1.1.10.1 (p.54), 1.1.10.3 (p.56) and p.57, the Modify PMS / Jobs change-request steps.
- **Reproduced:** routed to Crewing, with "Delete Variable Tasks" as the top hit and the Technical Modify Job passages next. *(PROVEN for the reproduction path only)*
- **Cause:** missing knowledge *(PROVEN: 0 chunks)*, then a substituted procedure *(ORIGINAL: the answer offered the modify steps)*. The routing difference is **not** a proven cause, because the original answer cited Technical manuals.
- **Code says** *(READ)*:
  - The Job form has a **Delete** (trash) button. The **UI shows it** to Sail Admin and Client Admin only, and not in Modify or Edit mode (`client/src/pages/pms/JobsFormPage.tsx:1032-1041`). **The server does not enforce** that restriction: see §8.
  - It is a soft delete: the job is hidden from Office and Vessel views, and its work orders and history are kept. `JobsFormPage.tsx:1971-1973`, `server/postgresStorage.ts:2796-2811`
  - A separate **Deactivate Job** button is in the Component Register jobs table. `ComponentRegisterAddEdit.tsx:160-177,1867-1876`. Open WOs continue to completion. `jobService.ts:486-510`
  - Modify PMS change requests have no "delete" change type.
- **Needs expert confirmation:** delete or deactivate, which should users be told to use? Should vessel users request it through a change request?

### Case 2 — "How to deactivate any components"

- **Chatbot said:** no Deactivate action is documented, then gave the Edit Component steps.
- **KB has:** 3 chunks saying office-deactivated items disappear on the vessel. None says how to deactivate. *(PROVEN)*
- **Original evidence:** the answer cites Technical 1.1.4.4 (p.25), p.56 and 1.1.4.1 (p.16), the Edit Component steps.
- **Reproduced:** the documentation gate returned "not documented" (nearest Technical passages too far). *(PROVEN for the reproduction path only)*
- **Cause:** missing knowledge *(PROVEN: no chunk says how to deactivate)*, then a substituted procedure *(ORIGINAL)*.
- **Code says** *(READ)*:
  - Component Register → Edit → **Is Active = No (Inactive)** → Save (`ComponentRegisterAddEdit.tsx:1619-1623,938-959`). The UI requires edit permission for components. The deactivate endpoint itself has **no server permission check** (§8).
  - Deactivation is refused while the component has active **child components**, active linked **jobs** or active linked **spares**, each with its own message. Open WOs continue. `postgresStorage.ts:1309-1454` — **Revision 3: the child-component part is wrong on the pilot data (PROVEN, §11); the jobs part is PROVEN to work; spares not tested.**
  - A change request can set "IS Active", but the apply path skips those checks. `postgresStorage.ts:6470-6541`
- **Needs expert confirmation:** is deactivation from the vessel through a change request supported? Today it bypasses the checks.

### Case 3 — "What are types of RH Counter type"

- **Chatbot said:** two types, "Inherited" and an invented "Non-inherited".
- **KB has:** one note only: "Inherited RH type cascades to child components". There is no list of types. *(PROVEN)*
- **Original evidence:** the answer cites Technical Vessel manual p.34; it listed Inherited and a "Non-inherited" type.
- **Reproduced:** "not documented", with Crewing passages nearest. *(PROVEN for the reproduction path only)*
- **Cause:** missing knowledge *(PROVEN: no list of types in the KB)*, then an unsupported detail *(ORIGINAL: "Non-inherited" is not a type in the application)*.
- **Code says** *(READ)*:
  - There are **three types:** `MASTER`, `INHERITED`, `NOT_RH_DRIVEN` (the default). `shared/schema.ts:261,355`
  - Their labels are "Master (RH Owner)", "Inherited (Uses Master Counter)" and "Not RH Driven". `RunningHoursConditionPanel.tsx:66-68`
  - **Master** owns the counter and is the only type on the Running Hrs page. Its updates cascade to its inherited components. `runningHoursService.ts:289-291,916-917`
  - **Inherited** needs a Master on the same vessel and takes its value from it. `runningHoursService.ts:836-857,796-804`
  - **Not RH Driven** has its RH fields cleared and needs no RH reading at WO completion. `woCompletionRhRequirement.ts:10-11`
- **Needs expert confirmation:** none, because the code is unambiguous. Only the wording users should see needs confirming.

### Case 4 — "What are RH validations available when updating RH"

- **Chatbot said:** the documentation does not list validation rules.
- **KB has** several correct rules *(PROVEN)*:
  - RH never moves backwards ("Running hours cannot go backward!");
  - back-dated readings are kept in history;
  - the RH reading is mandatory when completing an RH-based WO;
  - sync never lowers RH.
- **Original evidence:** the answer cites Technical Vessel 1.1.6.3 (p.33), p.34 and Office 1.1.6.3 (p.39), the general Update Running Hours steps. It says the manuals list no validation rules.
- **Reproduced:** routed to **Crewing** ("RH" = Rest Hours), and no Technical rule passage was in the top results. *(PROVEN for the reproduction path only)*
- **Cause:**
  - The KB **does** hold several of the rules *(PROVEN)*, and the original answer used none of them *(ORIGINAL)*.
  - Why is **unconfirmed**. The original conversation retrieved Technical passages but not these rule passages. Possible reasons include ranking, the tool loop's query wording, or the answer model not using them. None is proven.
  - Part of the full rule list is also missing from the KB.
- **Code says** *(READ)*:
  - **Always applied:**
    - a reading cannot be lower than the latest one, except when the meter was replaced or reset for renewal;
    - the result cannot be negative.

    `rhValidation.ts:70-80`
  - **Applied when the vessel's RH validation is ON:**
    - no date before the last reading;
    - **one update per day**;
    - at most **25 h per day** since the last reading.

    A missing setting counts as ON, and only Sail Admin can turn it off. `rhValidation.ts:98-231`, `runningHoursService.ts:162-171`
  - **Single update:**
    - a date is required and cannot be in the future;
    - a zero value needs a renewal confirmation;
    - a meter replacement needs the old meter's final reading.

    `RunningHours.tsx:1030-1110`
  - **Bulk update:**
    - a date is required;
    - zero is refused ("use individual update").

    `RunningHours.tsx:1367-1411`
- **Needs expert confirmation:**
  - Is 25 h/day intended, rather than 24?
  - Bulk update has no future-date check, and "Old Meter Final" shows only to Sail Admin. Are both intended?

> **Decision (Ghazi):** the "Needs expert confirmation" points are not sent to Jeevan as separate questions, because they are exactly what the trainer feature is for.
> - The four entries are created as drafts pre-filled with the code facts, marked *Code-verified*.
> - Each open point shows as *Needs expert confirmation*. Jeevan confirms or corrects it inside the tool, which marks it *Expert-approved*.
> - Where his answer shows a product fault (e.g. the change request bypassing the checks), the entry states today's behaviour and the fault goes to development separately.

---

## 4. Two chatbot faults a trainer alone will not fix

1. **Substituting a different procedure.** In cases 1 and 2 there was no evidence for the asked action, and the answer described another action instead.
   - The existing rule is not enough: "say plainly that it is not covered … never guess" (`retrieval.py:347`, `agent.py:313`).
   - Add an explicit rule: if the asked action is not in the evidence, say so, and do not present a different action as the answer.
2. **Ignoring the module the user is in** *(READ + reproduced; not proven as the cause of the original answers)*.
   - In the live widget, Technical questions go through the tool loop. Its documentation search routes by vectors only and ignores the widget's module (`retrieval.py:329-339`).
   - My reproduction of that routing sent "RH" questions to Crewing. The original answers cited Technical manuals, so this may not be what happened to Jeevan. It is still a real weakness of that path.
   - Pass the module, and the existing intent terms, into that search, so "RH" in the Technical widget means Running Hours. Explicit questions about another module keep going to that module.

---

## 5. What exists today

**Reusable**
- Curated "KB pilot" Markdown entries (`kb/technical/…`), already indexed and served. They have `[manual]` / `[code]` evidence tags, sources, a reviewer checklist and a conflict log.
- The indexer can index one small entry without LlamaParse, and replaces a document's chunks in one transaction (`index_documents.py:276-292,452-501`).
- A conversation log, a ratings table and a `/rate` endpoint.
- Acceptance suites with JSON-defined cases (`manual_cases.json`, `fresh_cases.json`).

**Missing**
- Draft / published / retired states, revisions and rollback.
- Supersede: a correction cannot hide the wrong passage.
- Tenant scope: all knowledge is global, and `assistant_chunks` has no tenant column.
- Trainer and approver roles. Admin access is a static header token only.
- A "Report this answer" button in the widget. The widget also sends no conversation id and does not show citations.
- Any admin or trainer screen.

---

## 6. Proposal — first version

The first version stays small: one workflow on top of the existing index and KB-pilot format. There is no separate training platform, no automatic learning from chat and no model retraining.

### Workflow

**Report answer / New topic → Draft → In review → Approved & published → Retired**

- "Report this answer" in the widget creates a **review item only**. It never changes the KB.
- Every edit is a new revision, and rollback re-publishes an earlier revision.
- The approver cannot be the author.

### Screens (PMS Admin, existing login)

| Screen | Contents |
|---|---|
| Review queue | Reported answers (question, answer, citations, reporter note) and "New topic". |
| Entry editor | See the field list below the table. |
| Review & approve | Changes compared with the published revision, evidence, approve or reject with a comment. History tab with rollback and retire. |

The entry editor holds:
- **Module** and **type**: FAQ / procedure / validation rule / scenario / correction.
- **Applies to:** office or vessel, roles, vessel conditions, environment/version.
- **Scope:** global, or this company only.
- **Guidance and conditions.**
- **Evidence rows:** manual page, code file with revision, or expert name.
- **Evidence class,** shown as **Manual / Code-verified / Expert-approved**.
- **Supersedes:** search the KB and pick the conflicting passage.
- **"Needs expert confirmation" notes.**

### Data (assistant database, one migration)

- `kb_entries`: key, module, type, scope tenant (empty = global product knowledge), conditions, status, current revision.
- `kb_entry_revisions`: body, evidence, evidence class, author, reviewer, approver, timestamps, change note.
- `kb_review_items`: reported answers, linked to the conversation.
- `assistant_chunks.tenant_domain` (empty = global), plus a list of superseded passages.

### Publishing and indexing

- On approval, the entry is written in the KB-pilot format (evidence tags + sources) and indexed into the served set as its own document, in one transaction.
- **Only published revisions are ever indexed, so drafts never reach answers.**
- Retire removes the entry's chunks. Rollback re-indexes the chosen revision.
- Search hides passages that a published entry supersedes, so contradictory instructions are never served side by side.
- Search returns global entries plus the asking company's own entries only, based on the verified login. Company guidance never becomes global.
- Citations show the entry title and its evidence class.

### Permissions (checked on the server)

- Trainer roles and approver roles are configured on the assistant and verified from the signed login token.
- Any chat user can only create review items. Only trainers draft, and only approvers publish.
- No one can approve their own revision. Every action is logged with who and when.
- With no published evidence, the chatbot states the limitation instead of substituting a procedure.

---

## 7. Acceptance tests

| Test | Pass when |
|---|---|
| Case 1 — delete jobs | Names the Job form Delete button, its roles and the soft-delete effect. Mentions Deactivate Job as a separate action. Does **not** present the Modify Job steps as deletion. Cites the published entry. |
| Case 2 — deactivate component | Gives Is Active = No (Inactive) → Save, the three blocking conditions, and that open WOs continue. Cites the entry. |
| Case 3 — RH counter types | Gives exactly three types with their meaning, and no invented type. |
| Case 4 — RH validations | Routed to Technical. Lists the rules, including one update per day and 25 h/day (as confirmed by the expert). |
| Draft isolation | A draft entry is never retrieved or cited. |
| Retire / rollback | A retired entry disappears, and rollback restores the earlier text. |
| Supersede | The superseded manual passage is no longer served for the same question. |
| Tenant boundary | Company A's entry is not visible to company B, and global entries are visible to both. |
| Permissions | A reporter cannot publish, and an author cannot approve their own revision. Both are enforced by the server. |
| No evidence | A question with no evidence gets "not documented", not a different procedure. |

---

## 8. Other findings (outside this scope, not fixed)

These were read from code while establishing the four cases. They are reported for separate follow-up, and nothing was changed.

- `DELETE /jobs/:id`: the permission check does not enforce, so the server accepts the call from any user. Only the UI hides the button (`jobs/routes.ts:32`, `middleware/permissions.ts:16-23`).
- `POST /components/:id/inactivate`: has no permission check (`components/routes.ts:53`).
- Running-hours update route: its admin guard lets every request through (`auth.ts:99-101`).
- Change requests apply "Is Active" without the component safety checks (`postgresStorage.ts:6470-6541`).

---

## 9. Decisions needed before building

1. Approve the scope above.
2. Put the trainer screens in PMS Admin (proposed), or in the central assistant.
3. Decide which roles may draft and which may approve.
4. Confirm the RH rules on the pilot before their entries are published.

---

*Not done at this stage, as instructed: no production change, no live reindex, no merge, no push. The live KB checks were read-only (throwaway container, no log writes). Evidence classes: PROVEN = checked on the live system; READ = from code, not run.*

---

## 10. Approved changes and pilot (revision 2)

Ghazi approved the build with these changes to §6. The pilot results are reported separately.

- **Owner:** Jeevan is the chatbot's knowledge owner. He creates, edits, tests and publishes his own entries, with no separate approver.
- **Workflow:** Draft → Preview/test → Publish → Edit or retire, with revision history and rollback. Other users' feedback creates a review item for Jeevan and never changes the KB.
- **One central interface** with module selection (Technical, Crewing, Audit, …). Module screens may link to it.
- **Permissions on the server:**
  - Owners are granted per module and per publishing scope, from trusted identity, not browser roles.
  - Ordinary tenant roles never grant global publishing.
  - A company's correction never hides global passages for other companies.
- **The four examples** become the first drafts and the acceptance cases.

---

## 11. Pilot findings (revision 3)

Full results: `docs/assistant-experiments/2026-09-30-kb-pilot/PILOT-RESULTS.md`. The application checks are in
`docs/assistant-experiments/2026-09-30-kb-pilot/APP-BEHAVIOUR-VERIFIED.md`: test shore :5077 (database `pms_ae_test`),
every changed row restored.

**Application behaviour (PROVEN on the test shore):**

- **RH:**
  - lower reading refused;
  - second update on the same day refused;
  - +26 h one day after the last reading refused;
  - reading dated before the last reading refused;
  - missing vessel setting = validation ON.
- **Delete job:** a soft delete (deleted + inactive). WO retention was checked only on a job with no WOs.
- **Deactivate component:** refused with 6 active jobs linked.
- **Counter types:** MASTER / INHERITED / NOT_RH_DRIVEN. Data point: 30 rows use the legacy spelling `NOT RH DRIVEN`.

**Application faults found (for development, not fixed here):**

1. **Active child components do not block deactivation** on the pilot data.
   - The check (`postgresStorage.ts:1443-1449`) compares the child's `parent_id` with the parent's `cuuid`/`id`.
   - All 264 children on the pilot vessel store the parent's **component code** instead.
   - One vessel only. One production count is needed before calling it a pattern.
2. **The Update RH endpoint accepts a future-dated reading.** Only the screen blocks it.
3. **Any caller can bypass the same-day / 25 h limits.**
   - A request forwarding "Vessel User" with the admin-override flag bypassed them.
   - Cause: the server's role is the mock Sail Admin (known mock-identity gap).
4. **`DELETE /jobs/:id` accepted a Vessel User request** (already in §8). Now PROVEN.

**Chatbot (PROVEN on the pilot index, same content as live):**

- "RH" questions asked from Technical: before the change, 0 of 10 phrasings reached Technical; 7 were "not documented" and 3 went to Crewing.
- A per-module glossary expands "RH" to "Running Hours" in the search text for Technical questions. With it, 10/10 reach Technical, and asked from Crewing, 10/10 stay Crewing.
- An explicit "In Crewing, …" stays Crewing either way.
