# Component Register error inventory and verification

Verified against the frontend and backend sources on 2026-10-05. This is a presentation-only change: no backend, schema, shared request representation, accepted inputs, or data changes are included.

## Reading this inventory

- **Exact** means a literal source message; **template** contains dynamic values in `{braces}`. These braces describe placeholders, not displayed JSON.
- **Visible before**: `apiRequest` failures appeared as `status: {"error":"reason",...}` unless a caller had special handling. The actual backend reason is recorded below rather than repeating that wrapper in every row.
- **Hidden before**: query errors were ignored, with arrays defaulting to `[]`, blank fields, or an indefinitely loading edit form. Some direct-fetch queries even returned `[]` on a failed 404.
- **After**: safe reasons are unwrapped, mapped where indicated, and deduplicated. Only message-bearing fields are read; codes, stack, arbitrary diagnostics and schema metadata are excluded. HTML, malformed JSON, SQL/runtime diagnostics and missing messages use the operation's fallback.
- Load failures have persistent, section-specific alerts explaining that the section is unavailable/out of date, **not an empty result**. The main page's failed jobs/history/spares/documents/classification/requisitions sections do not show a successful empty state.
- The exact screenshot acceptance text takes precedence over the initial inventory's shortened Maker/Code suggestion.
- This is a **source-verified inventory**, not a claim that every backend rejection was triggered against live records. Negative save behavior is separately verified with browser response interception.

## 1. Add/edit/save: required fields and lookups

Title after: **Component Save Failed**. Existing inline highlighting and parent validation remain in place.

| Kind | Current reason / behavior | Readable description after |
|---|---|---|
| Exact, visible | Please fill all mandatory fields before saving. | Complete the highlighted required fields before saving. |
| Exact, inline | This field is required (source omits final period) | Unchanged beside the affected field. |
| Template, server | Missing mandatory fields: {fields} | Complete these required fields: {fields}. |
| Template, server | Cannot set mandatory fields to empty: {fields} | These required fields cannot be empty: {fields}. |
| Exact, visible | Maker list is still loading. Please try again in a moment. | The Maker List is loading. Wait a moment and try again. A known request failure instead says the Maker List could not be loaded. |
| Exact, visible | Please select a valid Maker from the Maker List. | Select a valid maker from the Maker List. |
| Exact, server/screenshot | Maker and Maker Code combination not found in Maker List. Please select a valid Maker. | **Maker and Maker Code combination not found in Maker List. Please select a valid Maker.** |
| Exact, server | Maker not found in Maker List. Please select a valid Maker. | Select a maker that exists in the Maker List. |
| Exact, server | Maker Code not found in Maker List. | Select a maker code that exists in the Maker List. |
| Template, server | Invalid Equipment / System Department. Allowed values are: {values}. | Select a valid Equipment / System Department: {values}. |
| Template, server | Invalid Component Category. Allowed values are: {values}. | Select a valid component category: {values}. |
| Exact, server/schema | Validation failed / Invalid request data, with nested errors | Safe field messages are shown once. Recognized `Required`/expected-type issues become “Check {field label} and enter a valid value.” Unknown schema internals are not displayed; use the operation fallback when no usable reason remains. |

Department values are still Engine, Deck, Electrical, Galley, LSA and FFA. Component category values still come from active master-list entries. No lookup acceptance rules changed.

## 2. Identity and parent relationships

Title after: **Component Save Failed**; local parent errors stay inline, with the same parent-field highlighting.

| Kind | Current reason | Readable description after |
|---|---|---|
| Template | Component Code '{code}' already exists for this vessel. Please use a unique code. | Component code '{code}' is already registered on this vessel. Enter a unique code. |
| Exact, uniqueness race/controller | Component Code already exists for this vessel. Please use a unique code. | Retain this useful unique-code instruction, without the transport wrapper. |
| Template | Component Name '{name}' already exists for this vessel. Please use a unique name. | Component name '{name}' is already registered on this vessel. Enter a unique name. |
| Exact, local | Parent Component Code is required. | Enter a parent component code. |
| Template, local/server | Invalid Parent Component Code format '{parent}'. Expected SFI format: 6, 61, 612, 612.005, 601001, 601001001, etc. | Enter a valid parent component code. Expected SFI format: 6, 61, 612, 612.005, 601001, 601001001, etc. |
| Exact, local | A component cannot be its own parent. | Choose a different parent; a component cannot be its own parent. |
| Template, server | Component Code and Parent Component Code are both '{code}'. A component cannot be its own parent. | Choose a different parent; a component cannot be its own parent (code '{code}'). |
| Template, local | Parent Component Code '{parent}' does not exist in this vessel's component register. | Parent component '{parent}' does not exist on this vessel. Select an existing parent. |
| Template, server | Parent Component Code '{parent}' does not exist in the vessel's component register. Cannot create a component without a valid parent. | Parent component '{parent}' does not exist on this vessel. Select an existing parent. |

## 3. Rotational stamps

Component-save title: **Component Save Failed**. Replacement dialog title: **Rotational Item Replacement Failed**. Stamp-load alerts: **Stamps Load Failed** / **Rotational Items Load Failed**.

| Kind | Current reason / behavior | Readable description after |
|---|---|---|
| Exact | Stamp is mandatory when Rotational Item is Yes (local version has a final period) | Select a stamp when Rotational Item is set to Yes. |
| Template | Stamp "{stamp}" not found in Rotation Item Master. Create it first under PMS → Admin → Master Data → Rotation Item Master List (or bulk import), then select it here. | Retain the full reason, stamp and existing create/import instructions. |
| Template | Stamp "{stamp}" is retired and cannot be fitted to a component. | Stamp "{stamp}" is retired. Select an available stamp. |
| Template | Stamp "{stamp}" is already installed on another component{optional holder name} on this vessel. Stamps must be unique. | Preserve stamp, optional holder and vessel; replace the last sentence with “Select an available stamp.” |
| Template, race | Stamp "{stamp}" was just taken or changed by another update. Refresh and pick an available stamp. | Unchanged readable reason and corrective instruction. |
| Replacement validation | Select an existing rotational item or provide a new Stamp; Provide either an existing item or a new Stamp — not both; Starting Running Hours must be zero or a positive number | Preserve the respective safe validation instruction. |
| Replacement template | Stamp "{stamp}" already exists on this vessel (status: {status}); currently installed on another component; retired and cannot be installed | Preserve the actual conflict, stamp and status; never reinterpret these as Maker errors. |
| Replacement lifecycle | Incoming rotational item not found; Incoming item belongs to a different vessel; Component is not marked as a Rotational Item; Component has no vessel; Component disappeared during swap; incoming/outgoing item changed concurrently — please retry | Preserve the safe specific reason, including retry instructions. `componentCuuid is required` becomes “Select a component before replacing its rotational item.” |
| Hidden query | Failed to load rotation items / replacement item query failure | Persistent load failure, not “no available stamps.” StampSelect formatting is opt-in for the two Component Register save forms; unrelated consumers keep their presentation. |

## 4. RH source configuration and embedded RH updates

Save-form title: **Component Save Failed**. The existing embedded panel uses **RH Configuration Save Failed** / **Running Hours Update Failed**.

| Kind | Current reason | Readable description after |
|---|---|---|
| Exact, local | Please select a RH Counter Source from MASTER components. | Select a MASTER component as the RH Counter Source. |
| Exact | MASTER counter type cannot have a master component reference | A MASTER counter cannot inherit from another counter. Clear the RH Counter Source. |
| Exact, two backend variants | INHERITED counter type requires rhMasterComponentId / rhMasterComponentId is required for INHERITED counter type | Select a MASTER component as the RH Counter Source for this inherited counter. |
| Exact | Master component not found | The selected RH source was not found. Select an existing MASTER component. |
| Exact | Master component must be from the same vessel | Select an RH source from the same vessel. |
| Exact, two backend variants | Referenced component is not a MASTER counter type / Selected component is not configured as a MASTER counter type | Select an RH source configured as a MASTER counter. |
| Exact | A component cannot inherit running hours from itself | Select another MASTER component as the RH source. |
| Exact | NOT_RH_DRIVEN counter type cannot have a master component reference | Clear the RH Counter Source for a component that is not RH-driven. |
| Template | Cannot change from MASTER: {count} component(s) inherit from this counter ({names}{optional “and N more”}). Reassign them first. | Preserve count/names/remaining count; “Reassign their RH sources before changing this counter type.” |
| Exact, local panel | Running hours must be a non-negative number | Retain the instruction under Running Hours Update Failed. |
| Other safe service validations | Specific reading/date/counter reason, including submitted/current readings and relevant dates | Retain that reason and corrective instruction. Diagnostic codes and repeated nested copies are not rendered. |
| Generic panel failure | Failed to update RH configuration / Failed to update running hours | Safe server text when available; otherwise “The RH configuration could not be saved. Check the counter type and source, then try again.” / “The running hours could not be updated. Check the reading and try again.” |

The panel is only mounted by the alternate Component Register form. The separate Running Hours page and its formatter are unchanged.

## 5. Permissions, deletion and deactivation

| Kind | Current reason / behavior | Title / readable description after |
|---|---|---|
| Exact, local | You do not have permission to edit/create components. | Component Save Failed — same permission denial. |
| Exact / template with record ID | Component not found / Component not found: {id} | This component could not be found. Refresh the register and try again. |
| Exact | Component deletion status can only be changed through the Delete Component action | Use Delete Component to delete this component. |
| Exact | Only vessel components can be deleted through the Component Register | Only vessel components can be deleted from this register. |
| Template | Component has {count} active child component(s). Please deactivate the child components first. | Component Deactivation Failed — preserve count and child-deactivation instruction. |
| Template, existing deletion override | This component has {count} active child component(s). Please deactivate the child components first before deleting this component. | Component Deletion Blocked — retain count and instruction in existing rejection dialog. |
| Templates, jobs/spares | Component cannot be deleted because {count} active Job(s)/Spare(s) are linked. Please deactivate or delete the linked Jobs/Spares before deleting the component. | Preserve count and required corrective action. Deletion still uses its existing detailed dialog; deactivation still shows the server explanation. |
| Response metadata, not prose | ACTIVE_CHILDREN, ACTIVE_JOBS, ACTIVE_SPARES/LINKED_SPARES; activeChildrenCount, activeJobsCount, linkedSparesCount | Metadata remains available for existing dependency handling; only counts/reasons are displayed, never internal codes. |
| Generic failure | Failed to delete/inactivate component | Component Deletion Failed / Component Deactivation Failed — the component could not be deleted/deactivated; refresh and try again. No linked-item cause is invented for network failures. |
| Exact | vesselId is required | Select a vessel and try again. |
| Bare authorization response | Forbidden / Unauthorized | You do not have permission to perform this action. / Your session could not be verified. Sign in and try again. |

Important existing behavior: inactivation parses status-prefixed JSON. This presentation parser still accepts that exact representation; the shared `apiRequest` contract is unchanged. Delete failures still close the confirmation and open the explanation dialog. Job-deactivation failures still close their confirmation. Rejected component saves do not close/reset/navigate.

## 6. Embedded jobs and work orders

| Kind | Before | Title / readable description after |
|---|---|---|
| Job rejection | Error — raw `error.message` / Failed to deactivate job | Job Deactivation Failed — safe reason, or “The job could not be deactivated. Try again.” |
| Partial draft-job creation template | Component Created — Component saved. {successCount} job(s) created. Failed: {titles}. (reasons discarded) | Component Saved — Some Jobs Failed — retain saved-component distinction and success count; each failed title now includes its readable reason. Existing post-save close/invalidation behavior is unchanged. |
| Special WO response | `blockingWorkOrder` creates internal PLANNED_WO_EXISTS flag | Work Order Already Planned — “Please complete the existing planned Work Order from the WO section before proceeding.” Flag never displayed. |
| Exact | Cannot generate work orders for an inactive job | Work Order Creation Blocked — “The job must be active before a work order can be created.” |
| Generic WO rejection | Error — reason / Failed to generate work order | Work Order Creation Failed — safe reason, or “The work order could not be created. Try again.” |

## 7. Documents

Upload/open/delete titles: **Document Upload Failed**, **Document Open Failed**, **Document Deletion Failed**. Dependency/count limits: **Document Upload Blocked**. Partial slot rejection: **Document Upload — Some Files Skipped**.

| Kind | Before | Readable description after |
|---|---|---|
| Exact, full-page control | Please select a component first before uploading documents. | Select a component before uploading documents. The main-page uploader now explicitly reports this existing prerequisite rather than silently returning. |
| Exact / file template | Please upload PDF, Word, or image files only. / "{file}" is not a supported file type. Skipped. | Upload a PDF, Word (.doc or .docx), JPEG, or PNG file. Multi-file rejection retains file name and “was skipped.” These are the actual accepted MIME types; no GIF/WebP/etc. added. |
| Exact / file template | File size must be less than 25MB. / "{file}" exceeds 25MB. Skipped. | The selected file exceeds 25 MB. Choose a smaller file. Multi-file version retains file name/skipped outcome. Existing `> 25 MB` check is unchanged. |
| Count template, main page | Maximum 5 documents per type. Delete an existing document first. | Maximum 5 documents for {document type}. Delete an existing document first. No limit was added to the full-page single-file control. |
| Partial template | Only {slots} slot(s) remaining. {count} file(s) were not uploaded. | Same slots/count with affected document type. Valid files still upload independently; successful files still trigger the success count and refresh. |
| Exact | File upload required - cannot create document without a file | Choose a file before uploading the document. |
| Exact + schema details | Invalid document data | The document information is invalid. Check the selected component and file, then try again. Safe recognized field issues are included; raw expected/received/codes are not. |
| Exact | Invalid componentId - component not found | The selected component could not be found. Refresh the register and try again. |
| Exact | componentCode mismatch - does not match component's code | The document's component code does not match the selected component. Refresh the register and try again. |
| Exact | vesselCode mismatch - does not match component's vessel | The document's vessel does not match the selected component's vessel. |
| Exact | Document not found | This document could not be found. Refresh the document list and try again. |
| Exact variants | Document file not found in local storage / storage / object storage | The document file could not be found. Refresh the document list and try again. |
| Exact | Cannot access documents for components from other vessels / Cannot access documents from other vessels | Preserve the specific vessel-isolation denial. |
| Exact | Insufficient permissions to download this document | You do not have permission to download this document. |
| Exact, storage | Object storage not configured / Failed to upload file to object storage | Document storage is temporarily unavailable. Try again later. No storage paths/providers are displayed. |
| Exact | Failed to create document record | The document could not be saved. Try uploading it again. |
| Generic request/open/delete failure | Upload Failed / Error / Delete Failed; raw errors, discarded download body, or generic reason | Retain file name and safe server reason. Otherwise: document could not be uploaded/deleted, try again; could not be opened, refresh document list and try again. |

Document streaming/download behavior is preserved by a Component Register-only download helper that retains rejected response bodies. The shared download helper is unchanged. Alternate modal “Upload Document” and document-icon controls have no action handlers in the existing source; this task does not invent workflows for those controls.

## 8. Component tree/order

| Kind | Before | Title / readable description after |
|---|---|---|
| Exact | No Selection — Please select a component to expand. | No Selection — Select a component to expand. |
| Exact, drag | Invalid Move — Cannot move a component under its own descendant — this would create a circular hierarchy. | Invalid Move — A component cannot be moved beneath one of its descendants. Choose a different parent. |
| Template, server | Circular hierarchy detected: cannot move "{code}" under "{parent}" because it would create a cycle | Component Order Save Failed — same readable descendant instruction. |
| Exact + schema details | Invalid request data | Component Order Save Failed — safe field feedback where available; otherwise refresh/retry order-save fallback. |
| Repository-only failures | Component not found: {id}; Reparent update matched 0 rows for component cuuid: {id} | Controller currently masks these as Failed to update sort order (not promised as visible reasons). No backend change. A directly received not-found reason is readable; raw row-count diagnostics are suppressed. |
| Generic | Error — only messages containing “Circular” retained; otherwise Failed to save sort order | Component Order Save Failed — safe non-circular validation is retained, or “The component order could not be saved. Refresh the register and try again.” |

## 9. Change requests

| Kind | Before | Title / readable description after |
|---|---|---|
| Load failure | Error — Failed to load change request data; HTTP failure was not checked before parsing JSON | Change Request Load Failed — safe reason, or “The change request could not be loaded. Refresh and try again.” |
| No selection | Please select a component — You must select a component to modify before submitting | Change Request Submission Failed — Select a component before submitting a change request. |
| Main category restriction | Cannot modify main category — Main categories are organizational placeholders. Please create sub-components to add editable items. | Unchanged restriction/instruction. Categories 1–8 remain non-editable placeholders. |
| No changes | No changes detected / No Changes — Please make some modifications before submitting / No changes have been made to submit | Make a change before submitting the request. The separate review-button “No fields have been modified” advisory remains readable and unchanged. |
| CR form incomplete WOs | Validation Error — Please complete all work order edits before submitting | Change Request Submission Failed — preserve the existing complete-edits instruction. |
| Submit failures, three paths | Submission failed — raw error; ComponentRegisterFormCR / ReviewChangesDrawer: Error — generic text | Change Request Submission Failed — safe reason, or “The change request could not be submitted. Check your changes and try again.” |

Rejected submissions keep entered changes, reason, current mode and selected record. Success reset/navigation is unchanged. The shared ReviewChangesDrawer formats only `targetType === "component"`; other modules retain their feedback.

## 10. Load and export failures

| Dataset / operation | Before | After |
|---|---|---|
| Component register / component details | Query failures hidden as empty tree/blank fields; alternate edit dialog could remain “Loading component data...” | Component Register Load Failed / Component Load Failed with safe reason or refresh/retry fallback; alternate dialog distinguishes failed load from loading. |
| Maker List / department / component category | Hidden query failures; zero Makers could be mislabeled as still loading | Maker List Load Failed / Departments Load Failed / Component Categories Load Failed; failed lookup is not treated as a successful empty lookup. |
| Master components / selected master / RH parent / RH reading / meter history | Hidden queries, generic throws, empty options or permanent “Loading...” | RH Sources Load Failed / Running Hours Load Failed / RH Configuration Load Failed / Meter Replacement History Load Failed, as applicable. |
| Jobs / maintenance history / documents / spares / classification / requisitions | Hidden errors; maintenance-history/document direct fetch swallowed 404 into `[]`; optional sections could say no data/coming soon | Jobs / Maintenance History / Documents / Spares / Classification Data / Requisitions Load Failed. A failed 404 is not a successful empty collection. Successfully empty responses keep existing empty states. |
| Safe vessel denials during optional-section loads | Cannot access classification data/requisitions/maintenance history for components from other vessels; Cannot access maintenance history for other vessels | Preserve the denial under the affected section's load title. |
| No export rows | No Data — No component data available to export. | Component Export Failed — There are no components to export for the current selection. |
| Export while register query failed | Empty-data message or stale output | Component Export Failed — safe load reason or refresh/retry fallback; do not present a failed load as empty data. |
| XLSX file-generation exception | No catch; no readable feedback | Component Export Failed — safe reason, or “The component export file could not be created. Try again.” |

Export still uses the already-fetched register, not a new export endpoint. Successful XLSX content/name/count and navigation are unchanged.

## Sources checked

- `client/src/components/ComponentRegisterAddEdit.tsx`
- `client/src/components/AddEditComponentForm.tsx`
- `client/src/pages/pms/Components.tsx`
- Existing embedded paths: `ComponentRegisterFormCR.tsx`, `ReviewChangesDrawer.tsx`, `RunningHoursConditionPanel.tsx`, `StampSelect.tsx`, `ReplaceRotationalItemDialog.tsx`
- Unchanged transport/download: `client/src/lib/queryClient.ts`, `client/src/lib/authedDownload.ts`
- `server/modules/components/services/componentService.ts`, `documentService.ts`, `subEntityService.ts`
- `server/modules/components/controllers/componentController.ts`, `subEntityController.ts`
- `server/modules/components/repositories/componentRepository.ts`, `server/postgresStorage.ts`
- Related validation sources: `server/modules/shared/middleware.ts`, `server/modules/jobs/services/jobService.ts`, `server/modules/running-hours/services/runningHoursService.ts`, `server/modules/rotational-items/services/rotationalItemService.ts`

## Verification

- Focused command: `npx tsx --test client/src/lib/componentErrorFeedback.test.ts client/src/pages/pms/runningHoursErrorFeedback.test.ts`.
- Covers exact screenshot payload; ordinary text; nested/serialized/deduplicated validation; malformed/missing/HTML/network/SQL/stack/code-only responses; action-specific fallbacks; dependency counts; RH/stamp instructions; escaped dynamic display; failed-save catch retaining state; existing unrelated RH formatter.
- `npm run check` reports 289 existing errors, with no errors in the changed Component Register files. Examples: missing FormEditor/schema Form export, existing WorkOrderForm fields, report/component type problems, server/vite allowedHosts typing and shared/schema boolean typing. These are reported separately, not fixed here.
- `git diff --check` passes. Backend/schema/transport and separate Running Hours feedback have no changes.
- Controlled browser run passed on `/pms/components` using an existing component, with **exactly two intercepted PATCH attempts** and no other writes. The first 400 response displayed **Component Save Failed** and the exact Maker/Code sentence above. The second returned HTML malformed for its JSON content type and displayed the operation-specific save fallback.
- Both rejections kept the edit form open and retained the changed Component Name and Notes. Maker/Model were not changed. No save, audit, deactivation or other mutation reached the server.
- Browser evidence: screenshot IDs `lr9vmf` (exact Maker rejection) and `stgohn` (malformed-response fallback). Expected intercepted 400 resource errors and existing date-format/AG Grid warnings were observed, with no application crash.
