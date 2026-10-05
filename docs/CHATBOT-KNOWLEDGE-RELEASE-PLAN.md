# Chatbot knowledge management — release to the official assistant (plan for approval)

**Prepared 5 Oct 2026. Nothing below has been done on the live service.** The live assistant, its database, nginx and
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
| Assistant code to release | commit **`abe87ed1a`** on `chatbot-enterprise` (local; pushed head of `feature/chatbot-enterprise` is `9d163eaf2`) | — |
| Release image | `sail-assistant-py:v8-abe87ed1a`, built on the AI server with `git archive abe87ed1a:central-assistant-py` | PROVEN |

## 3. What changes

**Assistant (`v7-r2` → `v8-abe87ed1a`)** — `git diff 890b47645 abe87ed1a -- central-assistant-py`:
- knowledge management: entries, revisions, private preview, publish / restore / retire, supersedes, review queue,
  trainer list (`kb_trainers`) + trainer page `/admin/kb` (not public) + command `python -m app.kb_admin`;
- migrations **0008–0011** (additive: new `kb_*` tables, four nullable columns on `assistant_chunks`);
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

| Check | Result | Class |
|---|---|---|
| Migration 0008–0011 on a copy of live data | clean; second run no-op | PROVEN |
| Today's live image on the migrated database (switch overlap / fast rollback) | healthy, fingerprint `b31c3f9c`, no errors | PROVEN |
| Rollback rehearsal (scratch copy with a published + a preview knowledge row) | OLD downgrade left the 2 rows behind (found → fixed in `abe87ed1a`); FIXED downgrade removes them, back to 0007; today's live image healthy on it; re-upgrade clean | PROVEN |
| Knowledge harness (trainers, refusals, draft → test → publish → edit → restore → retire, all clients/environments, reports, revocation, trainer page) | **66/66** | PROVEN |
| Publish failure (embedding outage / failure inside the transaction leave the served version unchanged) | **8/8** (pilot, same code) | PROVEN |
| Live-data routing dev vs production (local test environments) | **15/15** — dev → dev Data API only (142 overdue = dev's own count), production → production only, cross-environment / forged / re-labelled identities refused | PROVEN |
| Normal browser flow, **no browser override** (release PMS code `329ee5d42` → candidate; the assistant address comes from the app's own setting) | trainer sees the book icon → knowledge screen opens signed in, Technical only, the 5 transferred drafts listed; Test draft private ("draft, not published"); Publish without approver; an **ordinary user on the simulated production** gets revision 2 cited as a knowledge entry; Report this answer works; Restore → users get revision 1 again; Retire → no longer used; ordinary dev user: no book icon | PROVEN |
| Change note lost on Save → Publish (found in the browser) | fixed in `e58246b2a`, re-checked in the browser | PROVEN |
| Draft transfer (5 entries as unpublished drafts, attributed to development) | 5 imported, 0 served, 0 reports, 0 accounts carried; rerun = no-op | PROVEN |
| Regression suites BASE vs REL | routing 13/13 = 13/13 · retrieval 18/18 = 18/18 · work orders 8/8 = 8/8 · frozen 11/12 = 11/12 · corrected 13/14 = 13/14 · fresh **10/10 vs 9/10** · manual coverage **35/57 vs 33/57** | PROVEN (numbers) |
| Reading of the differences | fresh-audit-1: same 5 sections retrieved on both sides in every run; the failing run gives the same steps but not the word "mandatory/required". Manual coverage: 4 losses, each passing in 1–2 of 3 REL runs — 3 are wording only ("permanently removed" vs "removes", "create and release" vs "released", "open the existing record" vs "edit the existing"), 1 omits "auto-generated Master ID" in one run; 2 gains of the same kind. Same pattern as the 1-Oct run (34 vs 32); the 30-Sep run went the other way (33 vs 35) | READ (by me; no second reader; no captured model input, so a prompt effect cannot be excluded) |

Fingerprint: the image the suites ran on (`19e108451`) and the release image differ only in `app/kb_ui.html` (the
knowledge screen) and the 0008 downgrade — prompt fingerprint identical (`e9d7ba01`). PROVEN (file hashes).

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
| 2 | Start `sail-assistant-py-v8` = image `v8-abe87ed1a`, env `v8-release.env`, network `technical-rag-net`, `127.0.0.1:8051→8000` (same as v7, new port); it migrates the live DB to 0011 on start. v7 keeps serving (PROVEN safe on a migrated copy) | `/health` on :8051: fingerprint `e9d7ba01`, instances dev/prod/demo, rejected [] ; alembic 0011 |
| 3 | nginx: `assistant.conf` + `safelanes.conf:375` `8046 → 8051` (backups `*.bak-v8-<ts>`), `nginx -t`, reload | public `/health` = `e9d7ba01`; `/admin` 403; no-token chat 401; preflight from dev/prod/demo 200 |
| 4 | Grant Jeevan: `docker exec sail-assistant-py-v8 python -m app.kb_admin grant --user Jeevan --module technical --name "Jeevan" --by "Ghazi"` (dev system picked automatically: `technical-dev`) | `kb_admin list` |
| 5 | Import the 5 drafts: `kb_transfer_drafts.py import --in kb-drafts.json --dry-run`, then without `--dry-run` (export file already made from the pilot) | 5 drafts, 0 served |
| 6 | Public smoke (me): docs answer for a dev token path, health, eligibility 401 without login | — |
| 7 | Ghazi or Jeevan, in a normal browser on dev: chatbot → book icon → knowledge screen shows the 5 drafts; one Test draft. **No publish needed** for the check | screenshot |
| 8 | Send Jeevan the short guide (§8) | — |
| 9 | After a few days without problems: remove the knowledge pilot (nginx `kbpilot.conf` + its certificate, DNS `kb-pilot` (Naveel), containers `sail-assistant-py-kbpilot*`, `sail-kbpilot-db`, the dev keys in `kbpilot-r9.env`), the release candidates (`sail-assistant-py-rel`, `-relbase`, `sail-assistant-reldb`, `-relbasedb`, test env files) and finally `sail-assistant-py-v7` | — |

## 6. Rollback

- **R1 (seconds, while nothing has been published on live):** nginx back to `8046` + reload; v7 still runs and works on
  the migrated DB (PROVEN). Safe only while there are **no knowledge rows** (`SELECT count(*) FROM assistant_chunks WHERE
  kb_state IS NOT NULL` = 0) — otherwise v7 would serve them as ordinary passages.
- **R2 (after something was published):** export entries (`kb_transfer_drafts.py export` / `pg_dump`), stop v8, run
  `alembic downgrade 0007` with the v8 image (removes knowledge rows first — rehearsed), nginx back to 8046.
- **R3:** restore the step-1 dump.

## 7. Decisions for Ghazi

1. **Approve the rollout (§5)** — steps 1–5 on the live assistant; step 0 is Nilesh's dev deploy.
2. **The three answer settings** (§3) go live with the release (as tested). Alternative: knowledge only, settings
   off — that combination is **not** tested with the four examples (RH answers relied on module context + glossary).
3. **Production PMS:** when `replit_dev` is next deployed to production, production users will see **"Report this
   answer"** (reports go to the Technical trainers' queue; they never change answers). No book icon on production
   (no trainer can match a production login). OK?
4. Push `chatbot-enterprise` (`e58246b2a`, `abe87ed1a` + docs) to `feature/chatbot-enterprise`.

## 8. Guide for Jeevan

`docs/CHATBOT-KNOWLEDGE-TRAINER-GUIDE.md` — normal application steps only.
