# Chatbot trainers through SAILERP — investigation and proposal (for approval)

**6 Oct 2026. Proposal only — nothing built, pushed or deployed.** The completed knowledge-management and rollback work
(release image `v8-8d81b1f1f`) is unchanged by this document.

Evidence: the SAILERP code read is the local copy at `C:\Users\GhaziAnwer\sailapp\sail_backend`, last commit
**2026-05-18** (`43b153381`) — not pulled (shared live branch). Everything marked READ-SAILERP may have changed since and
must be confirmed by the SAILERP team. PMS and assistant facts are from the current code and the live chatbot log.

## 0. Update 6 Oct (later) — the three clarifications, on CURRENT code

SAILERP read from a separate checkout `C:\Users\GhaziAnwer\sailapp\sail_backend_latest` = `origin/development_final`
**`13def9cbe` (6 Oct 2026)** (`git fetch` + `git worktree add --detach`; the existing working branch and `.env` untouched).
Production branch `production_build` = `8473cd404` (1 Oct), 2 115 commits behind development_final. PMS read from
`origin/replit_dev` (`329ee5d42`).

### 0.1 SAILERP, current code (READ-latest)
- **Still one role per user** (`user.roleId`); still per-user permission tables (`smsuserpermission`). Unchanged conclusion:
  a Trainer *role* would replace the operational role → use a per-user flag.
- **Login token** = `{ id, domain, userType }`; `id` = the **login record id** (`login.id`). Ids are company-specific.
- **Authentication:** 1 698 routes use `@Auth()` — a real guard (token checked against the `token` table). It
  **authenticates only**; it does not check rights.
- **Rights check exists but is unused:** `@AuthWithPermission('<menu route>', 'edit')` → `PermissionsGuard` checks the
  caller's role against `roleaccess` for that menu (added 30 Jun 2026). Used on **0** endpoints today.
- **User edit** `PUT /api/v1/user/:userId` has `@Auth()` only, and `updateUserProfile` (480 lines) never checks the
  caller's rights → in code, **any logged-in user can update any user, including the role**. (Finding F2 below.)

### 0.2 Existing chat access — the Technical PMS DOES need a change (READ, current replit_dev)
- The chatbot button is shown **only when the UI role is Sail Admin** (`ChatButton.tsx`: `!isSailAdmin → hidden`).
- The server issues the chatbot identity only to roles in `ASSISTANT_ALLOWED_ROLES` (default `Sail Admin`, 403 otherwise).
- The book icon and the knowledge screen both need that identity → **a trainer with another operational role cannot reach
  Manage knowledge today.** "Technical PMS needs no change" was wrong; it holds only for trainers who are Sail Admins
  (Jeevan is).
- **Smallest change, chat access unchanged:** a separate **knowledge-only identity** (`GET /technical/api/assistant/kb-token`,
  dev instance only, any verified office user, claim `scope: "kb"`). The assistant accepts `scope: "kb"` only for the trainer
  check and the knowledge screen — **`/chat` refuses it**. The widget shows a **"Manage knowledge"** button (no chat) to a
  non-Sail-Admin user only when the assistant says they are a trainer. Sail Admins see the chatbot exactly as today.

### 0.3 Protecting the Trainer flag (SAILERP)
- **Not** on the general user-edit endpoint (it checks no rights — F2).
- A **dedicated endpoint** `PUT /api/v1/chatbot/trainers/:userId` (and the list `GET`) using the existing
  `@AuthWithPermission('admin/chatbot-trainers', 'edit')`, with a new menu right **granted only to the administrator role(s)
  you choose** in `roleaccess`; it **refuses self-assignment** (caller's login = target) and records who/when.
- The server-to-server list the AI server reads (`GET /api/v1/chatbot/trainers/export`) uses a **service secret**, not a
  user login.

### 0.4 Findings to track separately (not confirmed live defects — verify with the SAILERP team / Nilesh)
| # | Finding | Class | Who verifies |
|---|---|---|---|
| F1 | Master-data feed `GET /api/v1/crewmasterdata/getallmasterdata/*` (users, vessels…) has no `@Auth()` and is excluded from the tenant middleware; the PMS calls it without credentials | READ-latest | SAILERP team (is it network-restricted?) |
| F2 | `PUT /api/v1/user/:userId` authenticates but checks no rights → any logged-in user could change any user's role via the API | READ-latest | SAILERP team |
| F3 | Login query interpolates the username into SQL (`l.username='${username}'`) | READ-latest | SAILERP team |
| F4 | PMS master-data sync keys users by `uuid` (SAILERP now also sends `id` = login id) → the PMS's server-side role lookup by verified login id cannot match → the role likely comes from the browser profile (`ASSISTANT_ROLE_FALLBACK=profile`) | READ (both sides) + INFERRED (env) | Nilesh: dev PM2 log `[assistant-api] mint user=362 role=… (profile-header)` |

### 0.5 Revised effort
| Part | Who | Estimate |
|---|---|---|
| SAILERP: flag + menu right + protected assign endpoint (no self-assign) + export endpoint (secret) + checkbox screen + dev deploy | SAILERP team | ~1.5–2.5 days (their estimate needed) |
| PMS: knowledge-only identity endpoint + "Manage knowledge" button for trainers who are not Sail Admins | me (Nilesh deploys) | ~0.5–1 day |
| AI server: SAILERP directory client (cache ≤ 60 s, fail closed), page = eligible list + module ticks, `scope: kb` handling, company + login match, tests | me | ~1.5 days |
| End-to-end on dev (tick → appears; untick → refused ≤ 60 s; module removal → immediate; non-Sail-Admin trainer reaches Manage knowledge but not chat) | me | ~0.5 day |

### 0.6 Temporary arrangement (if Jeevan should train before this is built)
AI-managed grant, Technical only: **dev system `technical-dev` + login id `362` + company** — his verified dev login shows
`rsms` (25 Sep–5 Oct) and `rsms05102026` (6 Oct). **Which company is his real dev company must be confirmed** (you /
Jeevan); the grant is then made for that company only. He is a Sail Admin, so no PMS change is needed for him.

---

## 1. What exists today

| Fact | Class |
|---|---|
| A SAILERP user has **one role**: `user.roleId → rolemaster` (one value per user). Roles grant menu rights through `roleaccess` (role × menu: view/create/edit/delete). | READ-SAILERP |
| So a **"Chatbot Trainer" role would replace the person's operational role**, and a trainer **menu right** on a role would reach **every user with that role** (e.g. every Sail Admin). Neither meets the requirement. | INFERRED from the two rows above |
| SAILERP already has **per-user extra permissions**: `smsuserpermission` (user + `isPermissionuser` flag) and `smsPrintPermission`, kept beside the role. This is the right pattern for "Chatbot Trainer". | READ-SAILERP |
| Users live in **each company's own schema**; user and login ids are **company-specific**. | READ-SAILERP |
| The SAILERP login token is `{ id, domain, userType, clientName, userId }` — **`id` is the login record id** (`auth` table), and it carries **no role**. Jeevan's verified identity on dev is login **`362`**, company `rsms` (25 Sep–5 Oct) then `rsms05102026` (6 Oct). | READ-SAILERP (payload) · PROVEN (live chatbot log; dev site inferred from nginx referer) |
| The PMS mints the chatbot identity from that **verified** token (user id + company from the token, never the browser). | READ (current PMS code) |
| SAILERP sends users to the PMS through the master-data feed `GET /api/v1/crewmasterdata/getallmasterdata/users?domain=…` (fields: uuid, name, email, userType, designation, department, role). It is **excluded from the tenant middleware and has no guard** in this code; the PMS calls it with no credentials. | READ-SAILERP + READ (PMS) |
| That feed keys users by **`uuid`**, while the chatbot identity carries the **login id** — so the PMS's server-side role lookup (`master_users` by verified id) cannot match, and dev most likely gets the role from the **browser profile fallback** (`ASSISTANT_ROLE_FALLBACK=profile`). Check: the dev PM2 log line `[assistant-api] mint user=362 role=… (profile-header)`. | INFERRED (ids differ by construction) — not verified on the dev server |
| The PMS master-data sync is **manual** (Admin → Data Masters → Sync All), so anything carried only through it would be revoked late. | READ (PMS) |
| The SAILERP backend makes no outbound calls today. | READ-SAILERP (May audit) |

## 2. Proposal — the smallest design that meets the brief

**SAILERP holds the Trainer permission; the AI server holds the module assignment; both are checked on every request.**

```
SAILERP dev                         AI server (assistant)                      Technical dev (PMS)
───────────                         ─────────────────────                      ──────────────────
user screen: [x] Chatbot Trainer    trainer page /admin/kb:                    chatbot → Manage knowledge
 (per-user flag, like                - lists eligible users from SAILERP         (identity = verified login id
  smsuserpermission)                   (name, email, designation, company,        + company, minted server-side)
                                       login id, role)                                   │
GET /api/v1/chatbot/trainers  ◄──────  - admin ticks modules per person                 │
 (service secret; all companies        (Technical, Crewing…)                            │
  on dev; trainers only)              every knowledge request:  ◄───────────────────────┘
                                       trainer = in SAILERP list (cached ≤ 60 s)
                                                 AND assigned the module
```

1. **SAILERP (dev):** a per-user **Chatbot Trainer** flag next to the existing role (same pattern as `smsuserpermission`):
   a table per company schema, a checkbox on the user screen, and **one new server-to-server endpoint**
   `GET /api/v1/chatbot/trainers` that returns, for every company on that SAILERP instance, the users with the flag:
   `{domain, loginId, userUuid, fullName, email, designation, role, userType}`. Protected by a **service secret** (header),
   reachable from the AI server only. Operational roles are untouched; Sail Admin gets nothing automatically.
2. **AI server (mine):**
   - a small SAILERP-directory client (dev SAILERP URL + secret in the assistant env), cached ≤ 60 s;
   - the trainer page lists **only eligible users** from that list, with enough detail to tell people apart (name,
     email, designation, company, login id, role); the admin ticks **modules** per person — no free-text user id;
   - identity match = **dev system + company + login id** (company kept internally for matching only — published
     knowledge still serves all companies within the module);
   - access check on **every** knowledge request (including open screens) = *in the SAILERP trainer list* **and**
     *assigned that module*; the widget's book icon uses the same check.
3. **Technical PMS:** ~~no change~~ — **superseded by §0.2**: a knowledge-only identity + a Manage-knowledge button for trainers who are not Sail Admins.
4. **Crewing / SAILERP (Audit & Safety) chatbots:** unchanged by this; when they are connected later, the same trainer
   list and module assignments apply.

### Revocation

| Removed | Effect |
|---|---|
| SAILERP Trainer flag | gone from the SAILERP list → refused on the next request **within ≤ 60 s** (cache), including open screens |
| AI module assignment | refused **immediately** (read on every request — already PROVEN) |
| SAILERP unreachable | **fail closed**: knowledge management refused (chat unaffected); the page says why |

The 60 s is a setting; 0 = ask SAILERP on every request (more load on SAILERP).

### Why not the alternatives
- **Through the PMS master-data feed:** sync is manual (late revocation), the feed is keyed by uuid (not the login id),
  and the feed is unauthenticated — fixing all three is more work than one new endpoint.
- **A SAILERP role or a role menu right:** replaces the operational role, or reaches everyone with the role.

## 3. Dependencies (other team)

**SAILERP team** (backend + Angular; e.g. Mandeep / Harendra — your call who):
1. per-user Chatbot Trainer flag (table + migration per company schema) and the user-screen checkbox;
2. `GET /api/v1/chatbot/trainers` (service secret; dev instance first);
3. a dev deploy of that SAILERP change;
4. **Security, independent of the chatbot:** please confirm whether `getallmasterdata/*` (users, vessels…) is open
   without authentication on dev/production, and protect it if so.

I need from you: who on the SAILERP team, the **SAILERP dev API base URL** the AI server should call, and agreement on
the secret (I generate it and place it only in the two server env files).

## 4. Effort (estimates)

| Part | Who | Estimate |
|---|---|---|
| SAILERP flag + checkbox + endpoint + dev deploy | SAILERP team | ~1–2 days (their estimate needed) |
| AI server: directory client + cache + fail-closed, page (eligible list + module ticks), access check incl. company, migration for the new key, unit tests, harness against a local stub of the SAILERP endpoint | me | ~1–1.5 days |
| Pilot test with a stub, then dev end-to-end once SAILERP's endpoint is on dev (tick → appears; untick → refused ≤ 60 s; module removal → immediate) | me | ~0.5 day |
| Release | as the current plan (§5), same image line + this change | — |

## 5. Effect on the current release

- The release (`v8-8d81b1f1f`) can go first with the **AI-only** trainer list (Jeevan = login 362, Technical), and switch to the
  SAILERP-driven list when SAILERP's endpoint exists; or the release waits for this. **Your decision.**
- Chat access, live-data routing, publishing and the rollback procedure are unaffected.

## 6. Untested assumptions (what would change the design)
- The SAILERP code is from May; the role model, the per-user permission pattern or the master-data endpoint may have
  changed — the SAILERP team must confirm.
- "Login id is company-specific" is read from the schema-per-company design; a global id would simplify matching.
- The browser-profile role fallback on dev is inferred, not checked on the dev server.
