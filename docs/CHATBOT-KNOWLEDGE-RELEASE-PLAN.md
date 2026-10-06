# Chatbot knowledge management — release to the official assistant (plan for approval)

**Prepared 5 Oct 2026, final update 6 Oct 2026. Nothing below has been done on the live service.** The live assistant, its database, nginx and
the dev/production PMS are unchanged. Every step marked ⏸ waits for Ghazi's approval.

Evidence classes: **PROVEN** = run, output kept · **READ** = from code · **INFERRED** = deduction (basis stated).

---

## 1. Goal (owner brief, 5 Oct)

- Trainers work **only through the application**: SAILERP dev → Technical → chatbot → **Manage knowledge**. No browser
  settings, no console, no tokens.
- The dev application uses the **official assistant** `https://assistant.sl-sail.com`. Drafts and Test draft are private;
  **Publish** makes the guidance available to that module's users of **all clients, in dev and production**.
- Live-data routing stays per environment (dev questions → dev Data API, production → production).
- Only assigned module trainers can manage knowledge (Sail Admin alone grants nothing); a trainer publishes without a
  second approver; reports and drafts never become knowledge by themselves.

## 2. Current state (checked 5 Oct)

| Item | Now | Evidence |
|---|---|---|
| Live assistant | container `sail-assistant-py-v7`, image `v7-r2` (= `central-assistant-py` of replit_dev `890b47645`), prompt fingerprint `b31c3f9c`, instances technical-dev/-prod/-demo | PROVEN (`docker inspect`, `/health`) |
| Live assistant database | `sail-assistant-db`, migration **0007**, index `kb-xref-e` 965 sections, 344 MB | PROVEN |
| Dev PMS (dev.sl-sail.com) | uses `https://assistant.sl-sail.com`; does **not** yet have the chatbot screen change | PROVEN (public JS bundle) |
| Production PMS (sailerp.sl-sail.com) | uses `https://assistant.sl-sail.com`; no chatbot screen change | PROVEN (public JS bundle) |
| `origin/replit_dev` | `329ee5d42` = the chatbot screen change (pushed 5 Oct, Ghazi OK) — waiting for Nilesh's dev deploy | PROVEN |
| Assistant code to release | **final commit `8d81b1f1f`** on `chatbot-enterprise` (local; `de30da779` after it changes only a test script; pushed head of `feature/chatbot-enterprise` is `9d163eaf2`) | PROVEN |
| **Release image** | **`sail-assistant-py:v8-8d81b1f1f`**, built on the AI server with `git archive 8d81b1f1f:central-assistant-py` | PROVEN |
| Change since the broad test round (`abe87ed1a`) | `51e866769` rollback hold commands (CLI) · `8d81b1f1f` **knowledge write block** (migration 0012 + a guard in every knowledge write) and an **optional company on trainer grants** — tested by the targeted checks in §4; the broad suites / harness / browser run were **not** repeated (bounded, as asked) | — |
| Jeevan's verified identity | dev user id **`362`** ("Jeevan Naik"), company **`rsms`** (25 Sep–5 Oct) and **`rsms05102026`** (6 Oct), role Sail Admin — from the live chatbot log; the chats came from `https://dev.sl-sail.com` (nginx referer at the same minutes). The login id is NOT "Jeevan". User `66` "Jeevan" (SL - Demo Use) is the **demo** site (`erp.sl-sail.com`) | user id + company PROVEN (signed identities in the log); dev site INFERRED from timing (every request in those minutes came from dev) |

## 3. What changes

**Assistant (`v7-r2` → `v8-8d81b1f1f`)** — `git diff 890b47645 8d81b1f1f -- central-assistant-py`:
- knowledge management: entries, revisions, private preview, publish / restore / retire, supersedes, review queue,
  trainer list (`kb_trainers`) + trainer page `/admin/kb` (not public) + command `python -m app.kb_admin`;
- migrations **0008–0012** (additive: new `kb_*` tables incl. `kb_maintenance`, four nullable columns on `assistant_chunks`);
- **write block** for rollback: every knowledge write (create, save, Test draft, publish, restore, retire) checks a
  maintenance flag under a shared database lock; `kb_admin writes-block` waits for writes in progress and refuses the rest;
- three answer settings switched on in the release env (they were tested together with the knowledge rules):
  `ASSISTANT_KB_RULES=on` (how the chatbot treats knowledge entries / missing evidence),
  `ASSISTANT_CONTEXT_MODULE_GAP=0.15` (the user's current module wins when the question names none — "RH" in Technical
  = Running Hours), `ASSISTANT_MODULE_GLOSSARY` (RH = Running Hours in Technical, Rest Hours in Crewing — search text
  only); plus `ASSISTANT_KB_TRAINER_ENVS=dev`. **Decision for Ghazi** — see §7.
- release env file prepared on the server: `~/central-assistant/v8-release.env` = `v7.env` + exactly these four lines
  (registry, keys, CORS, model, index unchanged).

**Technical PMS** — `replit_dev 329ee5d42` (4 chatbot screen files, no server/DB change): "Report this answer" (only
when the assistant supports it) and the "Manage knowledge" book icon (only for trainers, decided by the assistant).

## 4. Test results (release candidate on a COPY of the live database; live untouched)

Setup: live DB dumped (`~/central-assistant/backups/live-assistant-db-20261005T104402Z.dump`, 276 MB) and restored twice:
**BASE** = today's live image + live env (:8049) · **REL** = release image + release env (:8048), migrated to 0011.
Rows marked **(final image)** ran on `v8-8d81b1f1f` (6 Oct, scratch copies); the others on `abe87ed1a`/`19e108451`.

| Check | Result | Class |
|---|---|---|
| Migration 0008–0011 on a copy of live data | clean; second run no-op | PROVEN |
| Today's live image on the migrated database (switch overlap / fast rollback) | healthy, fingerprint `b31c3f9c`, no errors | PROVEN |
| **Fast rollback with knowledge present** (previous image on the MIGRATED DB, a real published entry + a real private preview) | **Plain switch is UNSAFE:** the previous image gave an ordinary user the private draft's text word for word. **Corrected procedure** (`kb_admin rollback-hold` before switching): previous image retrieves neither draft nor published entry, manuals answer normally, status 0; `rollback-release` → release image serves the published entry again, draft still private — **6/6** (`scripts/verify_fast_rollback.py`) | PROVEN |
| **Knowledge write block — concurrency (final image)** (`scripts/verify_rollback_write_block.py`, scratch copy) | **18/18**: a publish already inside its transaction → the block **waited 3.3 s** and that publish committed; while blocked, publish / Test draft / create / save / retire / restore all refused (503) and nothing written; hold → 0 served, later Test draft / publish still refused; release brings rows back with writes still blocked; a publish whose preparation began before the block is refused at its transaction; hold refuses unless writes are blocked; grant with a company matches only that company, without one any company. Migration 0012 second run = no-op | PROVEN |
| **Fast rollback, full order (final image)** | block → hold → status "SAFE" → (previous image retrieves nothing from knowledge, manuals normal) → release → unblock → published entry back, draft private — **6/6**; the plain switch still leaks the draft (finding kept) | PROVEN |
| Rollback rehearsal — full downgrade (scratch copy with a published + a preview knowledge row) | OLD downgrade left the 2 rows behind (found → fixed in `abe87ed1a`); FIXED downgrade removes them, back to 0007; today's live image healthy on it; re-upgrade clean | PROVEN |
| Knowledge harness (trainers, refusals, draft → test → publish → edit → restore → retire, all clients/environments, reports, revocation, trainer page) | **66/66** | PROVEN |
| Publish failure (embedding outage / failure inside the transaction leave the served version unchanged) | **8/8** (pilot, same code) | PROVEN |
| Live-data routing dev vs production (local test environments) | **15/15** — dev → dev Data API only (142 overdue = dev's own count), production → production only, cross-environment / forged / re-labelled identities refused | PROVEN |
| Normal browser flow, **no browser override** (release PMS code `329ee5d42` → candidate; the assistant address comes from the app's own setting) | trainer sees the book icon → knowledge screen opens signed in, Technical only, the 5 transferred drafts listed; Test draft private ("draft, not published"); Publish without approver; an **ordinary user on the simulated production** gets revision 2 cited as a knowledge entry; Report this answer works; Restore → users get revision 1 again; Retire → no longer used; ordinary dev user: no book icon | PROVEN |
| Change note lost on Save → Publish (found in the browser) | fixed in `e58246b2a`, re-checked in the browser | PROVEN |
| Draft transfer (5 entries as unpublished drafts, attributed to development) | 5 imported, 0 served, 0 reports, 0 accounts carried; rerun = no-op | PROVEN |
| Regression suites BASE vs REL | routing 13/13 = 13/13 · retrieval 18/18 = 18/18 · work orders 8/8 = 8/8 · frozen 11/12 = 11/12 · corrected 13/14 = 13/14 · fresh **10/10 vs 9/10** · manual coverage **35/57 vs 33/57** | PROVEN (numbers) |
| **Known answer limitations** (the two cases in full: `docs/assistant-experiments/2026-09-30-kb-pilot/RELEASE-TWO-CASES-FULL-ANSWERS.md`) | **Audit inspection fields (fresh-audit-1):** equivalent wording — "fields marked with \*" without the word "mandatory"; nothing missing. **Master certificate (certsurveys-1):** an **omission** in one release run — the auto-generated Master ID is not mentioned (all user steps correct). **New/Save timing:** saying the Master ID appears at Save (the manual: when New adds the row) is **incorrect and occurs on both versions** (one run each) — existing behaviour, not introduced by this release | READ (by me) |
| Reading of the other differences | fresh-audit-1: same 5 sections retrieved on both sides in every run; the failing run gives the same steps but not the word "mandatory/required". Manual coverage: 4 losses, each passing in 1–2 of 3 REL runs — 3 are wording only ("permanently removed" vs "removes", "create and release" vs "released", "open the existing record" vs "edit the existing"), 1 omits "auto-generated Master ID" in one run; 2 gains of the same kind. Same pattern as the 1-Oct run (34 vs 32); the 30-Sep run went the other way (33 vs 35) | READ (by me; no second reader; no captured model input, so a prompt effect cannot be excluded) |

Fingerprint: the image the suites ran on (`19e108451`) and `abe87ed1a` differ only in `app/kb_ui.html` and the 0008
downgrade; the final image adds the write block, the rollback commands and the optional company match — prompt
fingerprint identical (`e9d7ba01`). PROVEN (file hashes / health).

**Not repeated on the final image (bounded):** the knowledge harness (66), the browser flow and the regression suites
ran on `abe87ed1a`/`19e108451`. The final image adds the write guard (exercised for every write type by the 18 targeted
checks) and the optional company match (a grant without a company behaves exactly as before). Prompt fingerprint
unchanged (`e9d7ba01`).

**Not tested (and why):**
- A **real SAILERP dev login** through the real dev PMS → needs Nilesh's dev deploy and a real login (I never enter
  passwords). It is step 8 of the rollout.
- **Real production Data API** after the switch — identity verification and routing are unchanged by this release (READ:
  `identity.py` has no diff between `890b47645` and `abe87ed1a`; `chat.py`/`agent.py` only add the knowledge filter,
  the preview flag and the knowledge rules — the registered instance is passed through as before); production routing
  was proven on 28 Sep.
- The browser runs were on the local test environments (Office users; the local pilot has no SAILERP login page — the
  login session is placed in the browser by a helper; the assistant address is NOT overridden).

## 5. Rollout (⏸ each step after approval; ~30 min; live chat keeps working throughout)

| # | Step | Check |
|---|---|---|
| 0 | Nilesh deploys `replit_dev` (`329ee5d42`) to **dev** — any time; before the switch it shows nothing new (live answers the knowledge check with 404) | dev bundle contains `kb/eligibility` |
| 1 | Fresh backup: `pg_dump` of `sail-assistant-db` → `~/central-assistant/backups/`; copy `v7.env` → `v7.env.bak-v8-<ts>` | dump size ≈ 276 MB |
| 2 | Start `sail-assistant-py-v8` = image **`v8-8d81b1f1f`**, env `v8-release.env`, network `technical-rag-net`, `127.0.0.1:8051→8000`; it migrates the live DB to **0012** on start. v7 keeps serving (PROVEN on a migrated copy) | `/health` on :8051: fingerprint `e9d7ba01`, instances dev/prod/demo, rejected []; alembic 0012; `kb_admin rollback-status` → writes blocked: False |
| 3 | nginx `assistant.conf` + `safelanes.conf:375` `8046 → 8051` (backups `*.bak-v8-<ts>`), `nginx -t`, reload | public `/health` = `e9d7ba01`; `/admin` 403; no-token chat 401; preflight from dev/prod/demo 200 |
| 4 | **Register Jeevan** by his verified login, Technical only: `docker exec sail-assistant-py-v8 python -m app.kb_admin grant --user 362 --module technical --name "Jeevan Naik" --by "Ghazi" [--company <see §7>] --note "verified dev login 362"` — dev system picked automatically (`technical-dev`, the only dev instance). No role-based grant: Sail Admin alone gives nothing (PROVEN in the harness) | `kb_admin list` shows one Technical grant for 362 via technical-dev |
| 5 | Import the 5 drafts: `kb_transfer_drafts.py import --in kb-drafts.json --dry-run`, then without `--dry-run` | 5 drafts, 0 served |
| 6 | **Post-deployment checks** (below) | all pass |
| 7 | Send Jeevan the short guide (§8) | — |
| 8 | After a few days without problems: remove the knowledge pilot (nginx `kbpilot.conf` + certificate, DNS `kb-pilot` (Naveel), containers `sail-assistant-py-kbpilot*`, `sail-kbpilot-db`, the dev keys in `kbpilot-r9.env`), the release candidates (`sail-assistant-py-rel`, `-relbase`, `sail-assistant-reldb`, `-relbasedb`, test env files) and finally `sail-assistant-py-v7` | — |

### Post-deployment checks (normal application screens only — no console, no tokens, no real publish)

| # | Who | What | Pass when |
|---|---|---|---|
| C1 | Ghazi (or any user), dev or production | Open the chatbot in Technical and ask a **documentation question**, e.g. "How do I complete a work order?" | normal answer citing the PMS user manual |
| C2 | An **authorised production user** (Ghazi), production SAILERP → Technical | Ask **one live-data question** for a vessel they can see, e.g. "How many overdue work orders does <vessel> have?" | the number matches the Work Orders screen for that vessel; I confirm on the server that the call went to the production Data API (`technical-prod`) |
| C3 | **Jeevan**, SAILERP **dev** → Technical | Open the chatbot → **book icon (Manage knowledge)** → open one of the 5 drafts → **Test draft** with a question | the knowledge screen opens signed in as him, shows Technical and the 5 drafts; the test answer is shown privately ("draft, not published"). **Do not publish.** |
| C4 | an ordinary dev user (optional) | open the chatbot | no book icon |

## 6. Rollback

- **Never switch straight back to v7 once knowledge exists.** PROVEN unsafe: v7 searches by index set only and served a
  private draft's text to an ordinary user.
- **R1 — fast (about a minute), PROVEN (final image):**
  1. `docker exec sail-assistant-py-v8 python -m app.kb_admin writes-block --by "<who>" --reason "rollback"` — pauses
     every knowledge write; it **waits for writes already in progress** to finish and refuses all later ones.
  2. `... kb_admin rollback-hold --by "<who>"` — moves every knowledge row (published and previews) out of the served
     index set (refused unless step 1 is done).
  3. `... kb_admin rollback-status` — must print `served index set: 0 ... writes blocked: True -> SAFE to switch`.
  4. nginx `assistant.conf` + `safelanes.conf:375` back to `8046` (v7 still running), `nginx -t`, reload.
  **Writes stay blocked** while v7 serves. Knowledge entries stay in their own tables; users get the manuals only.
  **Roll forward:** nginx to `8051` → `kb_admin rollback-release` (only while blocked) → `kb_admin writes-unblock`.
- **R2 — full:** after R1, stop v8 and run `alembic downgrade 0007` with the v8 image (removes knowledge rows first —
  rehearsed), keeping the step-1 dump. Only if the database itself must return to the old version.
- **R3:** restore the step-1 dump.

## 7. Decisions for Ghazi

1. **Approve the rollout (§5)** — steps 1–6 on the live assistant (step 0 is Nilesh's dev deploy).
2. **Jeevan's company on the grant:** his verified dev login shows company `rsms` until 5 Oct and `rsms05102026` on
   6 Oct. Recording a company makes the grant match only that company — it would have stopped working when the company
   changed. Options: (a) **no company** (dev system + user id 362; your 5-Oct decision), (b) `rsms`, (c) `rsms05102026`.
   Which company is Jeevan's real dev company is a question for you / Jeevan.
3. **Production PMS:** when `replit_dev` is next deployed to production, production users will see **"Report this
   answer"** (reports go to the Technical trainers' queue; they never change answers). No book icon on production. OK?
4. **Push** `chatbot-enterprise` to `feature/chatbot-enterprise`: the local commits after `9d163eaf2` (plan commit last).
5. Settings: the three tested answer settings stay ON (your instruction).

## 8. Guide for Jeevan

`docs/CHATBOT-KNOWLEDGE-TRAINER-GUIDE.md` — normal application steps only.
