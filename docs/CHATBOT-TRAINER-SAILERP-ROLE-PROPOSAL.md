# Chatbot trainers through SAILERP — investigation and proposal (for approval)

**6 Oct 2026. Proposal only — nothing built, pushed or deployed.** The completed knowledge-management and rollback work
(release image `v8-8d81b1f1f`) is unchanged by this document.

Evidence: the SAILERP code read is the local copy at `C:\Users\GhaziAnwer\sailapp\sail_backend`, last commit
**2026-05-18** (`43b153381`) — not pulled (shared live branch). Everything marked READ-SAILERP may have changed since and
must be confirmed by the SAILERP team. PMS and assistant facts are from the current code and the live chatbot log.

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
3. **Technical PMS:** **no change** — the chatbot identity already carries the verified login id and company.
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
