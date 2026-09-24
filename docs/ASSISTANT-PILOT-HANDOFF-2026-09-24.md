# Assistant live-data pilot — handoff (24-Sep-2026)

**Status:** functional pilot ACCEPTED (Ghazi / Astra, 23-Sep-2026). Functional changes FROZEN — no further
answer tuning. Everything below is verified on the isolated pilot only. **Nothing is deployed; the live
assistant (`kb-xref-e`, docs-only) and its nginx configuration are untouched.** Production live-data
enablement and any deployment require explicit approval.

## 1. Pilot commits (branch `chatbot-enterprise`, local, NOT pushed; remote is at `5476ce373`)

| # | Commit | What |
|---|---|---|
| 1 | `bf6a95b3c` | Tool loop sends `reasoning_effort=none` (gpt-5.6-luna rejected function tools otherwise); widget vessel selection travels as masked context; Data API returns an explicit "unknown vessel" failure; tests |
| 2 | `c061405b3` | Data API resolves the widget's vessel id (`vessels.id`) or vuuid to the vuuid before the access check |
| 3 | `8b10ca196` | Vessel-scope decision by forwarded user TYPE (Office = any vessel of the tenant, Ship = assigned vessel); token carries `userType` |
| 4 | `3bdebf90d` | Shore-only enforcement by deployment mode (server 403 + widget hidden on a ship); work-order counts = the Work Orders screen's own calculation; minted `userId` = forwarded id |
| 5 | `318df2a8f` | Follow-up context (bounded, masked history on both paths; widget clears on vessel change); Markdown tables; running-hours facts; overdue list paging; "How do I …" starters |
| 6 | `049305dff` | "Due this week" split calendar-dated vs running-hours; 720 h lead-time explanation; clean `npm ci` proof; Windows npm note |
| 7 | `7d5191730` | Multi-tenant Data API authentication — tenant from the module-signed identity + service secret; tracked harness (21 checks) |
| 8 | (this commit) | Documentation handoff: identity trust separation, `userType` source, remaining genuine-session check, decision required |

Checks at head: `npx tsc --noEmit` = 294 (branch baseline, unchanged); assistant tests 58/58; harness 21/21.

## 2. What is verified, and how (standalone pilot, emulated SAILERP session)

| Area | Evidence | Class |
|---|---|---|
| Shore-only | Ship container: manifest / execute / token mint all 403 with valid credentials; widget hidden for every role; shore 200 and widget shown | PROVEN (both pilot containers) |
| Counts match the Technical screen | Same vessel, same snapshot: Work Orders tab badges = assistant counts (Overdue 142, Due 6, …) | PROVEN |
| Follow-ups, tables, running hours, paging, starters | Complete conversations through the real widget; see `docs/ASSISTANT-API.md` and commit messages 5–6 | PROVEN (widget) |
| **Tenant identity** | Pilot shore in multi-tenant mode: SAILERP-shaped HS256 JWT → tenant database selected; cross-tenant vessel unknown; missing / expired / tampered JWT and identity tokens refused at both hops | PROVEN (harness 21/21 + widget) — with a JWT minted by the test using the pilot `JWT_SECRET` |
| **User identity and role** | `userId`, `role`, `userType` are browser-forwarded headers from the decrypted SAILERP profile. NOT server-verified — the same trust the module's own RBAC guards use | PROVEN by code reading and by the harness (headers freely chosen) — this is a LIMITATION, not a verification |
| Genuine SAILERP login | Not available on the pilot | **PENDING** |

Details and the exact field-by-field trust table: `docs/ASSISTANT-API.md` §3.2.

## 3. `userType` — resolved statement

`userType` (and `role`, `userId`) come from the **browser profile headers** (`x-user-type` → `req.rbac.userType`),
never from the JWT. The server reads exactly one JWT claim: `domain`. The current code requires from SAILERP:
(1) an HS256 Bearer signed with the shared `JWT_SECRET` carrying `domain`; (2) the encrypted `userProfile`
handoff (`userUuid`, `userType`, `role`) the client forwards as headers. The pilot's test JWT also carried
`id`, `userType`, `userId` — those claims are ignored by the code.

## 4. Remaining production integration check (genuine SAILERP session)

Procedure in `docs/ASSISTANT-API.md` §3.3. In short: log in genuinely in the target environment, decode the
Bearer payload locally in the browser console, record ONLY claim names + `domain` + expiry, confirm the widget
mints (`/assistant/token` 200) and answers one live question. **Never place a raw token in chat, reports,
tickets or Git.** The harness's optional `GENUINE_BEARER` check prints claim names only.

## 5. Decision required before production live-data enablement

User-level permissions are currently the module's browser-trusted RBAC. Two ways to make user identity
server-verified without a new authentication design (`docs/ASSISTANT-API.md` §3.4):

- **A. Trusted token claims** — if the genuine SAILERP JWT carries user id / user type / role, read them from
  the verified payload (needs §4 to confirm; small additive change).
- **B. Server-side identity lookup** — resolve role / user type / vessels from the tenant's synced SAILERP
  user tables (`master_users.role/userType`, `users`, `admn_role_master`, `master_user_vessels`) by a verified
  user id.

Owner of the decision: Ghazi / Jeevan (product), with SAILERP (Sachin) for what the JWT carries.

## 6. To enable live data in an environment (after approval)

Deploy the module build containing the Data API (commits 1–7), set `ASSISTANT_SERVICE_SECRET` and
`ASSISTANT_IDENTITY_SIGNING_KEY` in the module's PM2 env, build the assistant image from this branch's
`central-assistant-py`, add the module to `ASSISTANT_MODULE_APIS` on the assistant container, restart it.
`docs/ASSISTANT-API.md` §4. The module must run multi-tenant (it does in dev and prod) — the tenant rule
of §3.1 is what makes the Data API work there.

## 7. Pilot state (kept available)

- Shore `:5000` host process, **multi-tenant mode** (two lines in the untracked `local-test-env/.env.shore.example`:
  `MASTER_DATABASE_URL` → `pms_master_pilot`, `JWT_SECRET`; remove both to return to single-tenant). Master
  registry: tenant `pilot` → `pms_arch` (the pilot data), tenant `pilot-b` → `pms_arch_b` (empty, migrated on first
  access), `SHIP-WKFV` mapped with its existing key. Restart: `bash local-test-env/restart-shore.sh`.
- Ship `pms-ship` `:5100` (Docker; not needed for the assistant — shore-only).
- Assistant container `sail-assistant-py-pilot` (image `pilot-r5`) on the AI server, loopback `:8044`; reached
  from the workstation through an SSH forward tunnel; the shore is reached from the server through an SSH
  reverse tunnel to `:15000`. Both tunnels are per-session and must be re-opened.
- Emulated browser sessions `local-test-env/.pilot-widget-storage-mt-{a,b}.json` (untracked; 12-hour JWTs —
  re-mint with the recorded one-liner when expired).
- Harness: source the shore env, then
  `BASE=http://localhost:5000/technical/api DOMAIN_A=pilot DOMAIN_B=pilot-b VESSEL=743ef9d1-841a-11ed-aa7c-7003bca91a86 EXPECT_OVERDUE=142 npx tsx scripts/verify-assistant-multitenant-auth.ts`.

## 8. Separate PMS data point (not an assistant matter)

ME Turbochargers (601.053) on WK Frontier Pilot: running-hours reading 0.00, last updated 19-Feb-2026
(import). Its 500 h job shows Due because 500 h remaining is within the 720 h running-hours lead time. The
reading needs confirmation on board; it is not proven wrong.
