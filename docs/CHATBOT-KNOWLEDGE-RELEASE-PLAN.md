# Chatbot knowledge management — release to the official assistant

**Version 6 Oct 2026 (direct trainer login). Release approved by Ghazi on 6 Oct, subject to the release checks in §5.**
Evidence classes: **PROVEN** = run, output kept · **READ** = from code · **INFERRED** = deduction (basis stated).

## 1. What is released

- **Trainers sign in on the training page itself** — `https://assistant.sl-sail.com/kb` — with a trainer user id and
  password. No SAILERP identity, company registration or Technical change is needed (owner decision 6 Oct; SAILERP role
  integration postponed). Accounts:

  | Account | Module | Parts |
  |---|---|---|
  | `pmstrainer` | Technical (PMS) | technical |
  | `crewtrainer` | Crewing | crewing |
  | `audsafetytrainer` | Audit & Safety (one module) | Audit · Safety · Incident (picked per entry) |

- After sign-in only the account's module is shown; a one-module account opens it directly. The server enforces the
  module on every request. Disable / password reset end open sessions at once; 5 wrong passwords lock for 15 minutes.
- Draft → **Test draft** (private) → **Publish** (no approver) → history / restore / retire. Publishing makes the guidance
  available to that module's users of **all companies** on the live chatbot (dev and production).
- Normal chat, live-data routing and chat access are unchanged. Reports never become knowledge by themselves.

## 2. Release artefacts

| Item | Value |
|---|---|
| Code | `chatbot-enterprise`, final code commit **`fe04a9997`** (docs commits after it) |
| Image | **`sail-assistant-py:v8-fe04a9997`** (built on the AI server from `git archive fe04a9997:central-assistant-py`) |
| Database migrations | **0008–0013** (additive): knowledge tables, `kb_maintenance` (0012, rollback write block), `kb_accounts` + `kb_sessions.account_id` (0013, trainer accounts). Live is at **0007** before the release |
| Settings | `~/central-assistant/v8-release.env` = live `v7.env` + `ASSISTANT_KB_RULES=on`, `ASSISTANT_CONTEXT_MODULE_GAP=0.15`, `ASSISTANT_MODULE_GLOSSARY` (RH), `ASSISTANT_KB_TRAINER_ENVS=dev` (tested settings; owner: keep ON) |
| Live accounts | created fresh on live (passwords different from the pilot), saved only in `C:\Users\GhaziAnwer\local-only\kb-trainer-accounts-LIVE.txt` |
| Drafts | the 5 Technical drafts, imported **unpublished**, attributed to development (`scripts/kb_transfer_drafts.py`) |
| Not carried to live | pilot sessions, test accounts, pilot passwords/hashes, old SAILERP-style trainer grants (`kb_trainers` stays empty) |

## 3. Tests and the image each ran on

| Check | Image | Result |
|---|---|---|
| Regression suites BASE (live image) vs REL — routing, retrieval, work orders, frozen, corrected, fresh, manual coverage | `19e108451` | equal except fresh 10→9 and manual coverage 35→33 (wording; see §6) |
| Knowledge harness (draft → test → publish → edit → restore → retire, all companies/environments, reports, revocation) | `19e108451` | 66/66 |
| Live-data routing dev vs production (local test environments) | `19e108451` | 15/15 |
| Browser flow without overrides (book icon path) | `19e108451` | PROVEN |
| Publish failure (embedding outage / in-transaction failure leave the served version unchanged) | pilot `7550c9000` (same publish code) | 8/8 |
| Draft transfer (5 unpublished drafts, rerun no-op) | `19e108451` | PROVEN |
| Full downgrade rehearsal (0008 downgrade removes knowledge rows) | `abe87ed1a` | PROVEN |
| Change note kept through Save → Publish | `e58246b2a` (browser) | PROVEN |
| Write block concurrency (drain, refusals for every write type, hold/release order) | `8d81b1f1f` | 18/18 |
| Fast rollback, full order (block → hold → old image serves no knowledge → release → unblock) | `8d81b1f1f` | 6/6 |
| Trainer accounts (login, modules, server enforcement, Test draft/Publish with account, disable/reset/lockout, hash only) + browser sign-in | `fe04a9997` (pilot) | 25/25 (twice) + PROVEN |
| **Release check: account-authenticated Publish and Test draft refused during the write block** | `fe04a9997` (scratch) | see §5 |
| **Release check: old image compatible with migration 0013 after the hold procedure** | `fe04a9997` + `v7-r2` (scratch) | see §5 |

The broad suites, harness and routing test were not repeated on `fe04a9997` (bounded, as agreed). Changes since
`19e108451` are the rollback commands, the write block and the trainer accounts; the prompt fingerprint is unchanged
(`e9d7ba01`).

## 4. Rollout (live chat keeps working throughout; v7 stays running for rollback)

| # | Step | Check |
|---|---|---|
| 1 | Fresh backup: `pg_dump` of `sail-assistant-db` → `~/central-assistant/backups/`; copy `v7.env` and both nginx files (`*.bak-v8-<ts>`) | dump present, size ≈ live DB |
| 2 | Start `sail-assistant-py-v8` = `v8-fe04a9997`, env `v8-release.env`, network `technical-rag-net`, `127.0.0.1:8051→8000`; it migrates the live DB to **0013** | `/health` on :8051 fingerprint `e9d7ba01`, instances dev/prod/demo, rejected []; alembic 0013; `rollback-status` writes blocked False |
| 3 | Create the 3 live accounts (fresh passwords via stdin; file outside Git) | `account-list` = exactly the 3 accounts, right modules |
| 4 | Import the 5 drafts (dry-run, then real) | 5 drafts, 0 served |
| 5 | `pmstrainer` can open and test the drafts (on :8051, before switching) | entries listed; Test draft private; draft not served |
| 6 | nginx `assistant.conf` + `safelanes.conf:375` `8046 → 8051`, `nginx -t`, reload | public health `e9d7ba01`; `/admin` 403; no-token chat 401; dev/prod/demo preflight 200; `/kb` page 200 |
| 7 | Post-switch checks (§4.1) | all pass |

### 4.1 Post-switch checks

| # | What | Who |
|---|---|---|
| P1 | Trainer sign-in page served; refused sign-in for an unknown user; account permissions + private preview on live data | me |
| P2 | A normal documentation answer through the public address | me (documentation-only identity) |
| P3 | **Trainer sign-in with a real password** → Technical opens → Test draft on one of the 5 drafts (do not publish) | **you / the PMS trainer** (I do not type real passwords) |
| P4 | **One authorised production live-data answer**: production SAILERP → Technical → chatbot → e.g. "How many overdue work orders does <vessel> have?"; I confirm on the server that it went to `technical-prod` | **you** (needs a real production login) |

## 5. Release checks before switching (owner, 6 Oct)

Filled in at release — see §7 (release log).

## 6. Known answer limitations (unchanged by this release)

- **Audit inspection fields:** equivalent wording ("fields marked with \*" without "mandatory"); nothing missing.
- **Master certificate:** an **omission** in one release run (the auto-generated Master ID not mentioned).
- **New/Save timing:** saying the Master ID appears at Save (manual: when New adds the row) is **incorrect and occurs on
  both versions** — existing behaviour. Full texts: `docs/assistant-experiments/2026-09-30-kb-pilot/RELEASE-TWO-CASES-FULL-ANSWERS.md`.

## 6a. Rollback

- **Never switch straight back to v7 once knowledge exists** (PROVEN unsafe: v7 would serve a private draft's text).
- **R1 — fast (about a minute):**
  1. `docker exec sail-assistant-py-v8 python -m app.kb_admin writes-block --by "<who>" --reason "rollback"` (waits for
     writes in progress, refuses the rest — trainers see "paused for maintenance")
  2. `... kb_admin rollback-hold --by "<who>"`
  3. `... kb_admin rollback-status` → must say `served index set: 0 … writes blocked: True -> SAFE to switch`
  4. nginx `assistant.conf` + `safelanes.conf:375` back to `8046`, `nginx -t`, reload. Writes stay blocked while v7 serves.
  Roll forward: nginx to `8051` → `rollback-release` → `writes-unblock`.
- **R2:** after R1, stop v8 and `alembic downgrade 0007` with the v8 image (rehearsed). **R3:** restore the step-1 dump.

## 7. Release log

(Completed at release.)
