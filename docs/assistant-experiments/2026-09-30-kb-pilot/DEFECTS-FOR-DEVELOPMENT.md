# Application defects found during the chatbot knowledge pilot — for separate development work

These were found while verifying the four chatbot cases. **None was fixed** in the knowledge-management work, as
instructed. The evidence is in `APP-BEHAVIOUR-VERIFIED.md`.

- **Where tested:** test shore `:5077`, database `pms_ae_test`.
- **Code checked:** the files involved are identical on `replit_dev`.
- **Not tested on production.**

| # | Area | Defect | Evidence | Class | Suggested owner check |
|---|---|---|---|---|---|
| D1 | Jobs — permission | `DELETE /jobs/:id` accepted from a request forwarding *Vessel User*. The Delete button is hidden in the UI, but the server check (`requirePermission('pms-modify-pms','delete')`) does not enforce | 204 on the test shore; `jobs/routes.ts:32`, `middleware/permissions.ts:16-23` | PROVEN (mock identity) | Enforce the role server-side once the mock identity is replaced |
| D2 | Components — validation | Deactivating a component with **active child components** is NOT refused. The check matches `parent_id` to the parent's `cuuid`/`id`, but children store the parent's **component code** | DIESEL ENGINES with 16 active children was deactivated (restored); 264/264 children use the code; `postgresStorage.ts:1443-1449` | PROVEN on pilot data | Count production rows by `parent_id` form first; then match on component code (same vessel) |
| D3 | Components — permission | `POST /components/:id/inactivate` has no permission check | `components/routes.ts:53` | READ | Add the same guard as component edit |
| D4 | Change requests — validation | Applying a change request that sets "Is Active" skips the jobs/spares/children checks | `postgresStorage.ts:6470-6541` | READ | Reuse the inactivate checks in the apply path |
| D5 | Running hours — validation | The Update RH endpoint accepts a **future-dated** reading; only the screen blocks it | 30-Sep test: reading dated 01-Oct accepted (200) | PROVEN | Add a server-side future-date check (vessel local date) |
| D6 | Running hours — permission | A request forwarding *Vessel User* with `adminOverride:true` bypassed the same-day and 25 h/day limits, because the server role is the mock *Sail Admin* | +50 h same day accepted (200) | PROVEN (mock identity) | Part of the mock-identity hardening backlog |
| D7 | Data | 30 components store `rh_counter_type = 'NOT RH DRIVEN'` (space-separated legacy spelling) next to 69 with `NOT_RH_DRIVEN` | Pilot vessel data | PROVEN (one vessel) | Check production and normalise if confirmed |

**Not a defect, but a documentation fault:** the Office (p.40) and Vessel (p.34) manuals state the RH cascade in reverse
("For components with an Inherited RH type, updates are cascaded to all child components"). The knowledge pilot corrects
this with a correction entry. The manuals themselves should be corrected at their next revision.
