# Note for the domain team — office "Generate Now" button shown to roles the server refuses (low priority)

Found 14-Sep-2026 while checking work-order creation paths for the assistant. READ from the code
(not exercised live). Same code on `feature/chatbot-enterprise`, `origin/replit_dev` (cf5241ad6,
dev deployment) and the fork line `origin/feature/approval-engine-phase2` (037c7e98f) — the seven
work-order files are byte-identical on the first two; on the fork line only
`server/modules/work-orders/routes.ts` differs (route-guard edits from the approval-engine work,
see the assistant experiment report), not the pieces below.

**What the UI shows** — `client/src/pages/pms/WorkOrders.tsx:1487`:
`{isShore && (isSailAdmin || isClientAdmin || isHeadOfDept) && (` … `Generate Now` button
(`:1488-1499`, `data-testid="button-generate-now"`), calling `POST /technical/api/work-orders/generate-now` (`:429`).

**What the server allows** — `server/modules/work-orders/services/workOrderGenerationGate.ts:44`
`const PROVISIONING_ROLE = 'Sail Admin';` and `:141-147`: any other role gets
`ROLE_NOT_PERMITTED` — "Only a Sail Admin may generate work orders directly from the office."
(then `:150-161` the per-vessel switch `OFFICE_GENERATION_DISABLED`).

**Effect**: a Client Admin or Head of Dept on shore sees an enabled "Generate Now" button whose
every click is refused by the server with the role message. No data risk (the server is the
authority); it is a display/permission mismatch. Suggested fix, for the domain team to decide:
show the button only to `isSailAdmin` on shore, or show it disabled with the reason for the other
two roles.

**Related documentation fact (not a code issue)**: the June PMS manuals present the component-level
"Generate WO" button (Office p18, Vessel p16) without conditions; on shore it passes through the same
per-vessel switch (`server/modules/jobs/services/jobService.ts:578`), so office users need the
vessel switch enabled. See the assistant's code-derived Recent Updates document R3.2 §1.1.14.13.
