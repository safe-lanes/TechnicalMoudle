# Pilot access plan — letting Jeevan test from his own computer

**Status (5 Oct 2026):** AI-server side DONE; waiting only for the chatbot screen change on dev (Nilesh deploys
`replit_dev` to dev) and Jeevan's one browser setting.

| Step | State |
|---|---|
| 1 DNS `kb-pilot.sl-sail.com` → 13.250.51.71 | DONE (owner, 5-Oct); resolves on public DNS |
| 2 nginx + certificate (pilot only, `/admin` blocked) | DONE; checked from outside: health 200, `/admin` 403, no login 401, live assistant unchanged |
| 3 Real dev PMS registered on the pilot as `technical-dev` (dev's keys copied on the server only, env `kbpilot-r9.env`); dev website allowed (CORS) | DONE; browser pre-check from `https://dev.sl-sail.com` 200, other sites 400. My local test shores renamed `technical-pilotlocal` / `technical-pilotprod` |
| 4 Chatbot screen change on dev ("Report this answer", trainer book icon; Report hidden when the assistant does not support it) | READY on branch `feature/kb-pilot-dev-widget` (commit 329ee5d42 on top of replit_dev e08f76a49) — needs to reach `replit_dev`, then Nilesh deploys dev |
| 5 Jeevan's browser setting | after step 4 |
| 6 Jeevan = Technical trainer (`technical-dev` + user id `Jeevan`) | DONE |
| 7 Smoke test with a real dev login | after step 4 |

Pilot image `kbpilot-19e108451`: harness 66/66, publish failure 8/8.

## Goal

**Jeevan** uses the knowledge pilot from his own computer:
- with his **normal SAILERP login**;
- as a **Technical** trainer;
- without touching production PMS, the live chatbot service or its index.

## Today

- **Where the pilot runs:** the AI server.
  - Service: `sail-assistant-py-kbpilot`, image `kbpilot-r6`, listening on `127.0.0.1:8047` only.
  - Database: `sail-kbpilot-db`, its own, holding a read-only copy of the live index.
- **How it is reached:** only through an SSH tunnel from Ghazi's machine, by two local pilot PMS shores. No public
  address exists.
- **Why a path on the live hostname is not possible:** the knowledge screen uses absolute paths (`/kb/api/…`) and a
  session cookie scoped to `/`. Served under a path of `assistant.sl-sail.com`, its calls would reach the **live**
  service and share the live origin's cookies. The pilot therefore needs **its own hostname**.

## Recommended plan (about 1 hour once approved)

| # | Step | Where | Approval needed for |
|---|---|---|---|
| 1 | DNS: `kb-pilot.sl-sail.com` → AI server (13.250.51.71) | DNS (owner) | new public name |
| 2 | nginx site for that name + Let's Encrypt certificate → `127.0.0.1:8047` (the pilot only). Same hardening as the live assistant site: TLS only, no `/admin` | AI server | new public endpoint |
| 3 | Register the **dev** PMS instance in the **pilot** registry: `technical-dev` → `https://dev.sl-sail.com/technical/api`, using the dev instance's existing signing key and service secret. They are copied **on the server** from the live env file into the pilot env file and never leave the server. This is the same trust relationship dev already has with the live assistant | AI server, pilot env | reusing dev's instance credentials in a second service |
| 4 | Pilot CORS: allow `https://dev.sl-sail.com` | pilot env | — |
| 5 | Deploy the **widget change** (4 files on `chatbot-enterprise`) to **dev** PMS: "Report this answer" for everyone; the "Manage knowledge" icon only for trainers (decided by the assistant). Production PMS unchanged | dev server | deploying to dev |
| 6 | Point **only Jeevan's browser** at the pilot: one-time per-browser setting `ASSISTANT_CENTRAL_URL = https://kb-pilot.sl-sail.com` (existing tester override in the widget; we give him a one-line instruction). Other dev users keep the live assistant | Jeevan's browser | — |
| 7 | Grant Jeevan (5-Oct: dev system + user id, no company): `kb_admin grant --user Jeevan --module technical --name "Jeevan" --by Ghazi` — or the same on the Trainers page | pilot | confirmed: dev user id `Jeevan` |
| 8 | Smoke test from outside, as Ghazi:<br>• real dev login → book icon → knowledge screen<br>• Test draft<br>• publish a DEV TEST entry → the widget cites it<br>• retire it<br>• one request **without** a token is refused | — | — |

## Authentication

- **Every pilot endpoint needs a signed identity.** It is minted by the dev PMS from Jeevan's verified SAILERP login (the
  same mechanism as the live chatbot). There is no anonymous access and no separate pilot password.
- **The knowledge screen needs a trainer grant**, matched on the dev system + user id (no company), and checked on every request.
- **Revoking Jeevan's grant** stops his access immediately, including an open screen.

## Isolation

- **Production PMS:** not changed.
- **Live assistant (`sail-assistant-py-v7`) and its database:** not changed.
- **Pilot publications:** reach only browsers pointed at the pilot (step 6), and only for the dev environment.

## Alternative (if you prefer no per-browser setting)

At step 6, point **all of dev** at the pilot instead (`VITE_ASSISTANT_CENTRAL_URL`, then rebuild dev):
- dev testers would use the pilot service, with the same index copy and the new rules;
- revert by rebuilding dev with the old value.

## Removal

To remove the pilot:
1. Remove the nginx site and DNS record.
2. Revoke the grants.
3. Clear the per-browser setting.
4. Stop and remove `sail-assistant-py-kbpilot`, `sail-assistant-py-kbbase` and `sail-kbpilot-db` (volume
   `sail-kbpilot-db-data`).

Live is unaffected at every step.

## Information needed from you

- ~~Jeevan's SAILERP user id on dev and company domain~~ — answered 5-Oct: user id `Jeevan` on dev; the company is no longer needed.
- Approval for steps 1, 2, 3 and 5.
- Whether step 6 or the alternative.
