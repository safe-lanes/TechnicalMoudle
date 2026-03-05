# Session Log

---

## 2026-03-05 — Work Order Form Part B Validations

### What We Built
- Comprehensive field validations for the Work Order form Part B (Work Completion Record) across two form components.
- Added mandatory checks, format validation, range validation, date/time logic, and auto-calculation for manhours.

### What's Working
- **Start Date**: Mandatory, cannot be a future date (both forms).
- **Start Time**: Mandatory, must be valid HH:MM 24-hour format (00:00–23:59). Placeholder updated to "HH:MM (e.g. 10:45)".
- **Completion Date**: Mandatory, cannot be future, must be ≥ Start Date.
- **Completion Time**: Mandatory, valid HH:MM. If same day as Start Date, must be ≥ Start Time. Placeholder updated to "HH:MM (e.g. 12:00)".
- **Performed By (Rank)**: Mandatory dropdown selection (was already validated, no change needed).
- **No. of Persons in Team**: Mandatory, must be a positive whole number ≥ 1 and ≤ 50. Uses strict regex `^[1-9]\d*$` to reject decimals. Input has `min/max/step` constraints.
- **Total Time Taken (Hours)**: Mandatory, must be > 0 and ≤ 720 hours (30 days). Input has `min/max` constraints.
- **Manhours**: Auto-calculated as Total Time × No. of Persons. Read-only field. Positive number safety check on submit.
- **Work Carried Out**: Mandatory, minimum 20 characters, rejects placeholder text ("Describe work carried out...").
- Red asterisks (*) added to all mandatory field labels.
- Manhours auto-calculation logic added to `WorkOrderForm.tsx` (was already present in `WorkOrderFormPage.tsx`).
- All validations produce clear toast error messages on submit.
- E2E test passed: labels, placeholders, read-only state, and auto-calculation all verified.

### What's Broken
- Nothing broken from this session's changes.

### What's Pending
- The secondary form (`WorkOrderForm.tsx`) has validation logic for fields like `startDateTime`, `noOfPersons`, `totalTimeHours`, but its Part B UI doesn't render separate input fields for all of these (it primarily shows Work Carried Out). If this form is actively used for submission flows, the UI may need to be extended to expose those fields so users can fill them in. Currently validation will block submission if those fields are empty — which is correct behavior but may need UI alignment.
- No backend-side validation was added for these rules (frontend-only). Consider adding server-side validation for defense in depth.

### Key Files Changed
- `client/src/pages/pms/WorkOrderFormPage.tsx` — Primary form: added all new validations in `handleSubmit`, updated labels with red asterisks, fixed time placeholders, added `min/max/step` to number inputs.
- `client/src/components/WorkOrderForm.tsx` — Secondary form: added matching validations in `handleSubmit`, added manhours auto-calculation in `handleExecutionChange`, updated Work Carried Out label with asterisk.

### Environment Issues
- None. Application runs normally, HMR picks up changes without errors.

### Where to Resume
- Consider adding backend validation for the same rules in `workOrderService.ts` or `workOrderController.ts`.
- Review whether `WorkOrderForm.tsx` (secondary/modal form) needs UI fields added for start/completion date/time, no. of persons, total time, etc. to match the new validation requirements.
- Potential next feature: auto-calculate Total Time Taken from the difference between Start Date/Time and Completion Date/Time.

---

## 2026-03-05 — B1 Section Validations (Safety Assessments & Document Uploads)

### What We Built
- B1 section validations for Work Order form Part B across both form components (`WorkOrderFormPage.tsx` and `WorkOrderForm.tsx`).
- Three validation rules: block on "No", require documents on "Yes", and enforce file type/size restrictions.

### What's Working
- **B1.1–B1.3 "No" blocking**: If Risk Assessment, Safety Checklists, or Operational Forms is set to "No", save is blocked with a Safety Warning toast identifying which items are flagged. Users must select "Yes" (and upload docs) or "NA" (not applicable).
- **Document required when "Yes"**: If any B1 field is "Yes" but no supporting document has been uploaded for that type, save is blocked with a Validation Error toast. Uses `getDocsByType()` in WorkOrderFormPage and `executionData.uploadedDocuments` filtering in WorkOrderForm.
- **File type restriction**: Only PDF (.pdf), JPG (.jpg/.jpeg), and PNG (.png) files accepted. Both programmatic validation (MIME type + extension check) and HTML `accept` attribute enforce this. Toast shown for invalid file types.
- **File size limit**: Maximum 5MB per file enforced in `handleFileSelected`. Toast shows actual file size when rejected.
- **Accept attributes tightened**: WorkOrderFormPage.tsx `accept` attributes updated from `.pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx` to `.pdf,.jpg,.jpeg,.png` for all three B1 document upload inputs. WorkOrderForm.tsx was already correct.

### What's Broken
- Nothing broken from this session's changes.

### What's Pending
- Server-side file type/size validation not added (frontend-only enforcement). Consider adding backend checks for defense in depth.

### Key Files Changed
- `client/src/pages/pms/WorkOrderFormPage.tsx` — Added B1 "No" blocking + doc-required validations before B2 validations in handleSubmit. Added file type/size checks in handleFileSelected. Tightened accept attributes on 3 file inputs.
- `client/src/components/WorkOrderForm.tsx` — Added matching B1 "No" blocking + doc-required validations in handleSubmit. Added file type/size checks in handleFileSelected.

### Environment Issues
- None. Application runs normally, HMR picks up all changes without compilation errors.

---

## 2026-03-05 — Current Reading Field Validation Enhancements

### What We Built
- Enhanced "Current Reading" (running hours) field validation in the B3 section of both form components.
- Added positive number check, ≥ Previous Reading enforcement (was missing in WorkOrderForm), and a soft warning for large jumps to catch typos.

### What's Working
- **Positive number ≥ 0**: Current Reading must be a valid number ≥ 0. Negative values are blocked with a validation error toast.
- **≥ Previous Reading**: Current Reading cannot be less than Previous Reading (running hours can only increase). Was already present in `WorkOrderFormPage.tsx`, now also added to `WorkOrderForm.tsx`.
- **Soft warning for large jumps**: If Current Reading exceeds Previous Reading by more than 2000 hrs, a "Warning — Large Reading Jump" toast is shown on the first save attempt. The warning displays the exact difference and asks the user to verify. On the second save attempt the value is accepted. The warning flag (`currentReadingWarningAcknowledged`) resets whenever either `currentReading` or `previousReading` changes.
- **Input min attribute**: `min="0"` added to both forms' Current Reading inputs.

### What's Broken
- Nothing broken from this session's changes.

### Key Files Changed
- `client/src/pages/pms/WorkOrderFormPage.tsx` — Added ≥ 0 check after mandatory check, soft warning for large jumps after the ≥ previousReading check, `min="0"` on input, warning flag state + reset logic in handleExecutionChange.
- `client/src/components/WorkOrderForm.tsx` — Added ≥ 0 check, ≥ previousReading comparison (was missing), soft warning for large jumps, `min="0"` on input, warning flag state + reset logic in handleExecutionChange.

---

## 2026-03-05 — B4 Spare Parts Consumed Validations (Qty Used, Location, Comments)

### What We Built
- Comprehensive B4 (Spare Parts Consumed) field validations for Qty Used, Location, and Comments in both form components.

### What's Working
- **Qty Used positive integer ≥ 1**: If a spare part row has data (partNo or description), the quantity consumed must be a non-empty positive whole number (≥ 1). Decimals, negatives, and blanks are blocked with a validation error toast listing the offending parts. Suggests removing the row if no spares were consumed.
- **Location mandatory when Qty > 0**: Any spare with qty > 0 must have a location set (either locationId or location name). Blocks save for ALL spares — not just inventory-tracked ones. Extends the existing PHASE 3A check which only covered inventory-tracked spares.
- **Comments required for high consumption**: If consumption exceeds 50% of the available ROB at the selected location, or if ROB is 0 but qty > 0, a comment is required explaining the usage. This check runs AFTER the PHASE 3A inventory load check to ensure reliable ROB data. In `WorkOrderForm.tsx`, uses `availableQty` field instead.
- **Input constraints**: Qty Used inputs updated with `min="1"` and `step="1"` for both preloaded and manually-added spares in both forms.

### What's Broken
- Nothing broken from this session's changes.

### Key Files Changed
- `client/src/pages/pms/WorkOrderFormPage.tsx` — Added B4 qty/location validations before PHASE 3A, comments validation after PHASE 3A inventory check. Updated qty inputs with min="1" step="1".
- `client/src/components/WorkOrderForm.tsx` — Added matching B4 qty/location/comments validations before onSubmit. Updated qty input with min="1" step="1".

---

## 2026-03-05 — Cross-Field Validation Rules (Completion/Due Date, Start/Creation Date, HOD Check, Frequency Integrity)

### What We Built
- Four new cross-field validation rules for Work Order form Part B in both form components.
- Rules cover date integrity, role-based approval separation, and automatic next due date recalculation.

### What's Working
- **Rule 1 — Completion Date vs. Next Due Date (soft warning)**: If the completion date is after the scheduled Next Due Date from Part A, an informational toast ("Overdue Completion") is shown but save is NOT blocked. The record is flagged for overdue tagging. Only applies when nextDueDate is present. Uses `normalizeDateToDDMMMYYYY` for safe date parsing.
- **Rule 2 — Start Date vs. WO Creation Date (hard block)**: Start Date cannot be earlier than the Work Order creation date stored in the database (`workOrder.createdAt`). Blocks save with toast showing the formatted creation date. Only applies when editing existing WOs (not new job creation). Gracefully skips if `createdAt` is unavailable.
- **Rule 3 — Approver ≠ Performer for HOD ranks (hard block)**: Head of Department ranks (Chief Engineer, Chief Officer, Master) cannot both perform and approve the same work. If Performed By equals Approver and is one of these HOD ranks, save is blocked with descriptive toast. Non-HOD ranks are not affected by this check.
- **Rule 4 — Frequency Integrity (auto-recalculate + warning)**: For Calendar-basis jobs with completion data, the next due date is auto-recalculated as `completionDate + frequency`. If the manually set nextDueDate differs from the calculated value, an informational toast is shown. The recalculated value overrides the submission payload. Running Hours basis jobs are skipped (RH next-due handled separately). Uses `calculateNextDueDate` from `@shared/dateUtils`.

### What's Broken
- Nothing broken from this session's changes.

### Key Files Changed
- `client/src/pages/pms/WorkOrderFormPage.tsx` — Added import of `calculateNextDueDate`/`normalizeDateToDDMMMYYYY` from `@shared/dateUtils`. Added Rule 2 after same-day time check. Added Rule 1 (overdue warning) after Rule 2. Added Rule 3 (HOD check) after performedBy required check. Added Rule 4 (frequency integrity) before submission payload, with `recalculatedNextDueDate` override in PATCH body.
- `client/src/components/WorkOrderForm.tsx` — Added same import. Added Rule 2 after same-day time check. Added Rule 1 (overdue warning) after Rule 2. Added Rule 3 (HOD check) after performedBy required check. Added Rule 4 (frequency integrity) before building `executionRecord`, with `nextDueDate: recalculatedNextDueDate` in payload.

### Validation Order in WorkOrderFormPage.tsx handleSubmit
B1 → B2 (date/time, Rule 2 start vs creation, Rule 1 overdue warning, Rule 3 HOD check) → B2 (persons, time, manhours, work description) → B3 (running hours) → B4 (qty, location, inventory, stock, comments) → Rule 4 (frequency recalculation at payload construction)
