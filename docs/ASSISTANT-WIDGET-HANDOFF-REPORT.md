# Shared assistant widget — handoff report

Date: 19-Oct-2026 · Author: Claude Code (support) · For validation against the original brief.

Evidence labels: **PROVEN** = tested (automated test or live pilot run, results below) · **READ** = from the code, not run.

## 1. Branch and SHAs

| Item | Value |
|---|---|
| Branch | `feature/assistant-widget` (isolated worktree `.wt/assistant-widget`) |
| Base SHA | `60a66054b` (= `origin/feature/chatbot-enterprise`, the code behind the live assistant v8) |
| Final SHA | the commit that adds this report on top of `ed1c85b46` (the release commit; recorded in the release log in ASSISTANT-WIDGET-RELEASE-PLAN.md) |
| Commits | `7cce4cad3` widget + module starter questions · `2e726277c` byte-exact bundle, pilot token mode, suggestions harness · `f08d80607` live pilot tests · `dcbea40e3` integration guide · `693441e1d` assistant serves the bundle · `3037dbed8` served-bundle test + guide |
| Pushed? | `3037dbed8` pushed 15-Oct-2026 with Ghazi's approval; the follow-up commits (`95fe08ab9` suggestions, `c76adb14e` release plan, `6a3a5c4ba` documentation-only registration, `ed1c85b46` docs) are pushed with the release. Not merged into any module branch. |

**Deviation from the brief, approved by Ghazi on 15-Oct:** the brief said "no push". The branch was pushed after explicit approval. Ghazi also chose hosting "option A": the central assistant serves the bundle itself. That added a small static-file route to the assistant (section 6).

## 2. Scope kept

| Requirement | Status |
|---|---|
| Technical's existing integration unchanged | **PROVEN (diff)**: no file changed outside `packages/sail-assistant-widget/`, `central-assistant-py/` and the integration guide. No Technical client or server file was touched. |
| Knowledge-training system unchanged | **PROVEN (diff)**: no `kb_*` file, knowledge route or trainer screen changed. The assistant changes are additive only: `GET /suggestions`, `GET /widget/...`, and two read-only DB helpers (`pair_enabled`, `manual_sections`). |
| Crewing and Audit applications not modified | **PROVEN**: no change to either repository. Inspection was read-only. |
| No new assistant backend | **PROVEN**: uses the existing central assistant (`POST /chat`, issuer-based registration, `x-assistant-identity`). |

## 3. Module inspection (findings)

- **Crewing:** React 18.3 + Vite 7.3.7 + wouter + Tailwind. Its login token (JWT) carries **no role**, so its token endpoint must look up the role on the server. Its legacy `/api/*` routes are not authenticated (isExempt). It has no assistant token endpoint yet.
- **Audit & Safety:** Angular 19.2.14 with custom webpack (browser builder), rxjs 6.5.4. **Limitation:** GitLab access to the latest Audit frontend was denied. The newest readable commit was `development_final 5ec343ada` (18-May-2026), so the Angular version needs confirming by the Audit team. It has no assistant token endpoint yet.
- **SAILERP:** the bottom-right sync button sits at z-index 1000, so the widget has an `offset` setting to clear it.
- **Central assistant contract:** `docs/ASSISTANT-API.md`. Identity is a 60-second HMAC-signed token, verified by issuer (`iss`) against the registered instance.

## 4. Widget delivered (brief items 1–6)

| # | Requirement | Status / where |
|---|---|---|
| 1 | Versioned bundle for Angular, React and plain HTML. React only internal. | **PROVEN**: `packages/sail-assistant-widget/dist/1.0.0/sail-assistant-widget.1.0.0.js` (IIFE, `window.SailAssistant`, about 320 KB / 100 KB gzipped) + `.mjs` + `integrity.json` / `SHA384SUMS`. Hosts install nothing. |
| 2 | Isolated styling, floating button, panel, Markdown tables, citations, starter questions, bounded history, loading/error, accessible controls | **PROVEN** (tests below). Shadow root isolates styles. History is capped at 40 messages shown and 8 sent (`src/widgetSession.ts:57`). |
| 3 | `init`, `updateContext`, `open`, `close`, `destroy` | **READ + PROVEN**: `src/widgetApi.ts` (`WidgetHandle`) |
| 4 | Config = assistant URL, module id, starter questions, token-provider callback. No hard-coded modules. Vessel optional. | **PROVEN**: module id is validated by pattern only. Vessel fields are optional. Tested without a vessel. |
| 5 | Vessel, user or tenant change and logout clear history, cancel pending requests and drop late answers | **PROVEN** (tests below) |
| 6 | Trainer login / Manage Knowledge kept separate | **READ**: the widget calls only `/chat` and `/suggestions`. No trainer or knowledge-management access. |

## 5. Security

| Requirement | Status |
|---|---|
| No signing keys, secrets or trainer credentials in browser code | **READ**: the widget only calls the host's `getToken` callback. Keys live in each module's backend. |
| Identity from the verified backend, never browser headers | **READ**: the assistant verifies the signed token's issuer and signature. The guide (section 1.2) requires modules to mint only from their verified login. |
| Shore-only and server-side checks kept | **READ**: unchanged in the assistant. The guide tells modules with ship instances to refuse minting on a ship. |
| Missing token endpoints documented; mocks clearly labelled | **PROVEN**: Crewing and Audit endpoints are listed as dependencies in the guide. Demo pages show a "MOCK identity / MOCK assistant" banner. |

## 6. Hosting (option A — decided by Ghazi 15-Oct)

- The assistant serves the bundle at `GET /widget/<version>/<file>` (`central-assistant-py/app/widget_static.py`). It serves only files listed in that version's `integrity.json` whose bytes match, cached immutably for one year, with public CORS (needed for `<script integrity crossorigin>`).
- The bundle is copied into the assistant by `central-assistant-py/scripts/sync_widget_bundle.py`. That script checks hashes and never changes an existing version. The `Dockerfile` copies `widget/`.
- Live nginx already forwards every path on `assistant.sl-sail.com` to the assistant, so no nginx change is needed.
- **Not live yet:** it needs an assistant release, which is awaiting Ghazi's approval. Until then, it exists only on the pilot test container.

## 7. Suggested questions (added requirement)

| Requirement | Status |
|---|---|
| Suggestions match the configured module (not the URL) | **PROVEN**: `GET /suggestions?module=<configured id>`. Tested in the Crewing and Audit examples. |
| Only questions supported by that module's published manuals; never drafts or another module | **READ + PROVEN**: `app/suggestions.py`. Each catalog question names its manual file and section, and is served only while that passage is published in the served index (`kb_state IS NULL`, no tenant copy). |
| Refresh on module change; hide when none | **PROVEN**: the Audit example section switch refreshes the questions, and an empty list hides them. |
| Every served question actually answered on the pilot | **PROVEN, historical (15-Oct-2026):** `verify_suggestions.py` → 21/21 questions then in the catalogue were answered with an own-module citation; an unknown module returned an empty list. **Current catalogue (19-Oct): 20 questions** (technical 4, crewing 5, audit 4, safety 4, incident 3). The removed Crewing question ("post incident test record") had correct steps, but its first citation was the Incident manual. Suggestions are also hidden when a published knowledge entry supersedes their manual passage. |

## 8. Test results

**Hosts used:** the same built bundle in `examples/plain-html`, `examples/crewing-react` (React 18.3 / Vite 7 / wouter / Tailwind) and `examples/audit-angular` (Angular 19.2.14, custom webpack, rxjs 6.5.4).

| Suite | Result | Covers |
|---|---|---|
| Unit (vitest) | **25/25** | session rules: history bounds, context reset, late-answer discard, token reuse |
| Browser, MOCK identity + MOCK assistant (Playwright) | **27/27** | per host: one widget, module suggestions, answers + citations, follow-up, table; host styles unaffected; keyboard (Enter opens, focus, Escape closes and returns focus); narrow screen; expired token = 1 refresh + 1 retry, then "sign in again"; assistant down → Try again. Context: Crewing no vessel → vessel starts a new conversation; Audit module switch refreshes suggestions, none → hidden; modules without vessel work. Logout clears history and never mints again; user switch mid-answer cancels it and the late answer is never shown; repeated mount/unmount + double init leave one widget and no leftover listeners; invalid config refused. |
| Live pilot (real central assistant, pilot-signed MOCK identity) | **5/5** | real suggestions + real answers with own-module citations + follow-up in all 3 hosts; rejected first token → exactly one forced refresh; bundle loaded from the assistant with integrity → works, wrong hash blocked |
| Instrument check | fails as it should | the same live test from a non-allowed origin fails |
| Assistant server (pytest) | **95/95** | includes `test_suggestions` 9, `test_widget_static` 3 (mutation-checked) and the documentation-only registration test |

**Identity disclosure:** all browser tests use a MOCK login. The live tests use real assistant answers with a pilot-signed mock identity. **No genuine Crewing or Audit login has been tested yet**, because neither module has a token endpoint.

**Live-data support:** not claimed for the widget. The widget passes context only. Live-data tools stay per module (stage 2 in the guide).

## 9. Handoff documentation

`docs/ASSISTANT-MODULE-INTEGRATION-GUIDE.md`, section 1.1 (rewritten 15-Oct) covers:
- copy-and-paste setup (script tag with integrity, `init`, `updateContext`, `destroy`);
- Crewing (React hook `examples/crewing-react/src/useSailAssistant.ts`) and Audit (Angular service `examples/audit-angular/src/app/sail-assistant.service.ts`) examples, plus a plain HTML example;
- what the widget provides versus each module's token endpoint (1.2), assistant registration (1.3) and optional live-data APIs (section 2);
- pinned versions, hosting at `https://assistant.sl-sail.com/widget/<version>/`, upgrade and rollback (change the version and integrity in the module's `index.html`), and publishing a new version.

## 10. Limitations and open items

1. **Assistant release** needed before modules can load the bundle from `assistant.sl-sail.com`. Awaiting approval.
2. **Token endpoints** in Crewing and Audit. Not built; module teams' dependency. Crewing must resolve the role on the server.
3. **Registration + CORS** per module and environment (`crewing-dev`, `audit-dev`, …) on the assistant. **Stage 1 = module + signing key only (no URL, no service secret)**; stage 2 adds URL **and** secret together.
4. **Genuine module-login test**, after item 2.
5. **Audit Angular version** to be confirmed (GitLab access limited to the 18-May commit).
6. Published trainer knowledge is not used for suggestions (manual catalogue only). Smallest addition proposed, not built.
7. Technical keeps its existing in-app chat. Moving it to the shared widget is optional.

## 11. Follow-up (19-Oct-2026)

See ASSISTANT-WIDGET-RELEASE-PLAN.md (live comparison, checks, rollback) and section 1.5 of ASSISTANT-MODULE-INTEGRATION-GUIDE.md (module team checklist).
