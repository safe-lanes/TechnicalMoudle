# Crewing chatbot Stage 2 — integration check against the target branches (31-Oct-2026)

Isolated checkouts only. Nothing merged into or pushed to a target branch; nothing deployed; no registration changed.
Evidence: PROVEN = run here, output in the session scratchpad `integ/` and the Crewing results folder; READ = code.

## 1. Short version

1. **Trial branches pushed** (normal push, no force) after the outgoing-file scan: Crewing
   `feature/assistant-livedata-trial` = **ec2c42e5e**, assistant `feature/crewing-livedata-trial` = **5a90cec81**.
2. **Crewing merges cleanly into the latest `crewing_accounts` (782b92935, 15 commits newer than the trial base).** The
   merged tree type-checks at the target's baseline (229 = 229), builds for production, introduces no new test failure,
   adds no migration, and passes every trial check on the merged code (direct 132/132, permissions 14/14, SQL 87/87,
   model smoke 17/17).
3. **The assistant is a fast-forward** of `feature/chatbot-enterprise` (12f2aef44, unchanged since the trial began); the code
   is byte-identical to the tested pilot image `crewtrial-1483cb185`. Technical and documentation answers, suggestions, the
   widget and knowledge training are unaffected.
4. **Release still needs:** genuine SAILERP login test (Datta), dev acceptance with Sahil/Sagar's examples, the two
   assistant flags set, a Crewing service secret, and your approval for the dev registration change. Plan in §5, rollback in §6.

## 2. Outgoing-file scan before the push (PROVEN)

| Branch | Range | Result |
|---|---|---|
| Crewing | 3457b6718..dad841d4 (5 commits, 31 files: 15 .ts, 16 .json) | one local DB password default in a test script → removed (commit ec2c42e5e, the pushed head); 0 real local crew names (133 names checked, positive control found 45 synthetic hits; "Marek" / "than" matches were the synthetic fixture and an English word); no captures, logs, keys or binaries. The local vessel name "Prime Fortune" appears in expected-result files — already in the pushed base since 3457b6718; a vessel name, not personal data |
| Assistant | 77a0c95c5..5a90cec81 (6 commits, 4 .py + 1 .md) | clean |

## 3. Tested SHAs

| Item | SHA |
|---|---|
| Crewing target `origin/crewing_accounts` | **782b92935** |
| Crewing trial branch (pushed) | **ec2c42e5e** (code tested on the pilot = 4649c86d; later commits are results / script hygiene only) |
| Crewing integration merge (local only, branch `integ/crewing-livedata-20261031`, worktree `crew/wt-integ-crewing`) | **705cfcbb** |
| Assistant target `origin/feature/chatbot-enterprise` | **12f2aef44** |
| Assistant trial branch (pushed) = the fast-forward result | **5a90cec81** (app code = 1483cb185 = pilot image `sail-assistant-py:crewtrial-1483cb185`) |

## 4. Results

### Crewing — target vs merged (same node_modules, package files identical)

| Check | Target 782b92935 | Merged 705cfcbb |
|---|---|---|
| `tsc --noEmit` errors | 229 | 229 |
| Full vitest (JSON reporter) | 1211 tests, 70 failed, 62 failed files | 1199 tests, 60 failed, 63 failed files |
| "New" failures in merged | — | 11 listed, **0 real**: the three files concerned (crew-pool-validation, vessel-management, recruitment-language-import) give an identical 10 failed / 55 passed on BOTH trees when run alone — pre-existing schema-validation failures that the combined target run did not load (the suite is load-sensitive; it also never exits by itself — a runner now stops it once the report is written) |
| Production build (`npm run build`) | stops on the deliberate guard "VITE_PARENT_LOGIN_URL is not set" (deployment setting) | same guard; with a placeholder URL: **built in 1 m 14 s**, server bundle contains the new tools |
| Migrations | — | none added (server start: 219 skipped, 0 applied) |
| Trial checks against servers started from the merged tree | — | direct **132/132**, permissions **14/14**, tool vs independent SQL **87/87** |
| Model smoke through the pilot assistant → merged servers | — | two-area 9/9 turns, Part B 8/8 turns |

### Assistant

- Fast-forward possible; app code identical to the tested image; pytest **131** on that tree.
- No widget, indexer or knowledge file changed vs the target; documentation regression vs the released v10 code on the final
  image: same gate and same cited sources for all four Technical / Crewing how-to questions, suggestions identical.
- Compatibility (READ, `agent.manifest_for`): a registration without a data URL never calls Crewing (documentation only); a
  registered URL whose manifest fails or is invalid falls back to documentation answers. Technical's instructions are
  byte-identical (unit test).

## 5. Remaining release requirements

1. **Genuine login** — SAILERP → Crewing → widget with a real Office user (Datta), including the token endpoint and the role
   allow-list (`ASSISTANT_ALLOWED_ROLES`, default "Sail Admin").
2. **Dev acceptance** — Sahil / Sagar's examples on the acceptance day, with that day's date and records.
3. **Assistant flags** — `ASSISTANT_QUERY_STATE_GUARD=true` and `ASSISTANT_MASK_CONVERSATION_MEMORY=true` on the release
   container (both default OFF; the pilot ran with both ON).
4. **Crewing settings** — a new `ASSISTANT_SERVICE_SECRET` in PM2 on dev (identity signing key and instance id already exist
   from Stage 1); optional `ASSISTANT_DATA_TIMEZONE` (default UTC) and `ASSISTANT_DATA_STATEMENT_TIMEOUT_MS` (default 5000);
   `VITE_PARENT_LOGIN_URL` as today. No migration, no package change.
5. **Registration change (your approval)** — `crewing-dev` is documentation-only today; live data needs its `url` + `secret`
   added in the assistant's module registry. This is the switch that turns live data on.
6. **Merges (your approval)** — Crewing trial → `crewing_accounts` (Datta merges / deploys Crewing dev); assistant trial →
   `feature/chatbot-enterprise` (fast-forward).

## 6. Deployment and rollback plan (for approval — nothing done)

Order (each step reversible on its own):
1. Crewing dev: merge the trial into `crewing_accounts` (Datta), deploy with the new service secret. Endpoints exist but are
   unreachable without the secret; with `crewing-dev` still documentation-only, users see no change.
2. Assistant: build a new release image from the fast-forwarded `feature/chatbot-enterprise` (5a90cec81) with the two flags,
   start it beside the live v10 container, check Technical and documentation answers and the widget bundle on it, then switch
   nginx to it (the v10 container stays running for rollback, as in previous releases).
3. Registration: add `url` + `secret` to `crewing-dev` → live data on for Crewing dev only. Genuine-login test and dev
   acceptance follow.

Rollback:
- **Live data off, no redeploy:** remove `url` / `secret` from the `crewing-dev` registration → documentation-only again (the
  assistant never calls Crewing without a URL).
- **Assistant:** switch nginx back to the v10 container (kept running).
- **Crewing:** redeploy the previous `crewing_accounts` commit (782b92935); no migration to revert.
- **Fail-safe if Crewing is unhealthy:** a failing manifest makes the assistant fall back to documentation answers.

## 7. Local state left for review

- Worktrees `crew/wt-integ-crewing` (merge 705cfcbb, local branch) and `crew/wt-integ-base` (target, detached) — both have a
  `node_modules` JUNCTION to `wt-assistant-crewing`; unlink the junction before removing either worktree.
- Trial servers :6100 / :6101 currently run from the merged tree (allowed roles incl. External 1, pilot only).
- Pilot assistant container `sail-assistant-py-crewtrial` (crewtrial-1483cb185) and earlier containers kept stopped.
