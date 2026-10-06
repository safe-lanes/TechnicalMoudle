import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  formatWorkOrderToast, WorkOrderResponseError, workOrderErrorDescription,
  workOrderErrorFeedback, workOrderResponseError,
} from "./workOrderErrorFeedback";

const fallback = "The work order could not be saved. Check the details and try again.";
const transport = (payload: unknown) => new Error(`400: ${JSON.stringify(payload)}`);

test("save/draft/job errors unwrap HTTP/JSON and readable schema paths", () => {
  const payload = {
    error: "Invalid work order data",
    details: [
      { path: ["jobTitle"], message: "Required", code: "invalid_type" },
      { path: ["executionData", "currentReading"], message: "Must be zero or greater." },
    ],
  };
  for (const error of [payload, transport(payload), new WorkOrderResponseError(payload)]) {
    assert.equal(workOrderErrorDescription(error, fallback),
      "Job Title: Required Current Reading: Must be zero or greater.");
  }
  assert.equal(workOrderErrorDescription({ fieldErrors: { manhours: ["Must be greater than zero."] } }, fallback),
    "Manhours: Must be greater than zero.");
});

test("prefer useful role/approval reason, not forbidden code or duplicate diagnostics", () => {
  assert.equal(workOrderErrorDescription({
    error: "forbidden", message: "Only Chief Engineer can approve this work order.",
    details: { message: "Only Chief Engineer can approve this work order.", code: "FORBIDDEN" },
  }, fallback), "Only Chief Engineer can approve this work order.");
  assert.equal(workOrderErrorDescription(transport({ error: "This work order requires Superintendent acknowledgment before approval. Minimum remarks: 30 characters." }), fallback),
    "This work order requires Superintendent acknowledgment before approval. Minimum remarks: 30 characters.");
});

test("preserve actual text limits and dates, not summaries or field identifiers", () => {
  assert.equal(workOrderErrorDescription({
    error: "workCarriedOut exceeds maximum length",
    details: { message: "workCarriedOut must be 2000 characters or fewer (currently 2001 characters)." },
  }, fallback), "Work Carried Out must be 2000 characters or fewer (currently 2001 characters).");
  assert.equal(workOrderErrorDescription({ error: "Start Date cannot be before 01-Oct-2026 (Part A baseline)." }, fallback),
    "Start Date cannot be before 01-Oct-2026 (Part A baseline).");
});

test("RH timeline terminology changes only with the known reading-date anchor", () => {
  const error = transport({ error: "Completion Date 01-Oct-2026 is earlier than the previous entry (02-Oct-2026)." });
  assert.match(workOrderErrorDescription(error, fallback), /^Completion Date/);
  assert.equal(workOrderErrorDescription(error, fallback, { readingDate: true }),
    "Current Reading Date 01-Oct-2026 is earlier than the previous entry (02-Oct-2026).");
});

test("zero-inclusive RH wording and daily-rate requirements remain accurate", () => {
  assert.equal(workOrderErrorDescription("Current Reading must be a positive number (≥ 0).", fallback),
    "Current Reading must be a valid number that is zero or greater.");
  assert.equal(workOrderErrorDescription({
    code: "RH_OVERRIDE_REQUIRED", error: "Running hours increased by 51 over 2 days. Maximum: 50 hours (25 hours per day). Admin override is required.",
    canOverride: false,
  }, fallback), "Running hours increased by 51 over 2 days. Maximum: 50 hours (25 hours per day). Admin override is required.");
});

test("RH rejection uses authoritative values and never invents absent readings/limits", () => {
  const supplied = workOrderErrorDescription({
    code: "INVALID_RUNNING_HOURS", enteredValue: 2.15, componentActualRH: 2.12, maxAllowed: 2.12,
  }, fallback);
  assert.match(supplied, /2\.15 hours/);
  assert.match(supplied, /2\.12 hours or less/);
  const missing = workOrderErrorDescription({ code: "INVALID_RUNNING_HOURS" }, fallback);
  assert.doesNotMatch(missing, /undefined|null|NaN|0 hours/);
  assert.match(missing, /correct Current Reading/);
});

test("lower-reading warning retains its title, authoritative values/date and zero", () => {
  const payload = { code: "LOWER_THAN_CURRENT_RH", submittedRH: 0, currentRH: 97120, currentRHDate: "2026-10-01" };
  for (const error of [transport(payload), new WorkOrderResponseError(payload)]) {
    const feedback = workOrderErrorFeedback(error, "Approval Blocked", fallback);
    assert.equal(feedback.title, "Running Hours Update Blocked");
    assert.match(feedback.description, /0 RH/);
    assert.match(feedback.description, /97,120 RH/);
    assert.match(feedback.description, /01-Oct-2026/);
  }
});

test("stock shows actual spare and availability, never deduction or search metadata", () => {
  assert.equal(workOrderErrorDescription(transport({
    error: "INSUFFICIENT_STOCK: Cannot consume 4 units of FILTER_A. Current stock at location 17: 0. Already deducted (_deductedQty: 2, prior txns: 2). SQLSTATE: details",
  }), fallback), "Not enough stock. Cannot consume 4 units of FILTER_A. Available stock: 0.");
  const missing = workOrderErrorDescription({
    error: 'SPARE_NOT_FOUND: Spare part FILTER_A was not found in inventory. Searched: partCode="FILTER_A", partNo="A". Please verify the spare exists in inventory.',
  }, fallback);
  assert.match(missing, /FILTER_A was not found/);
  assert.doesNotMatch(missing, /Searched|partCode|partNo/);
  assert.equal(workOrderErrorDescription({ error: "LOCATION_REQUIRED: Spare part FILTER_A requires a storage location. Please select a location in the work order form." }, fallback),
    "Spare part FILTER_A requires a storage location. Please select a location in the work order form.");
});

test("document/postponement messages preserve the emitting limits and approval level", () => {
  for (const size of [5, 25]) {
    assert.equal(workOrderErrorDescription(transport({ message: `File too large. Maximum upload size is ${size} MB.` }), fallback),
      `File too large. Maximum upload size is ${size} MB.`);
  }
  assert.equal(workOrderErrorDescription({ error: "Maximum of 5 documents per type reached." }, fallback),
    "Maximum of 5 documents per type reached.");
  assert.equal(workOrderErrorDescription({ error: "Only Level2 approvers can approve this postponement." }, fallback),
    "Only Level 2 approvers can approve this postponement.");
});

test("malformed/empty/non-string/HTML/SQL/stack errors use safe action fallback", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.error = cyclic;
  for (const error of [
    null, undefined, 400, false, {}, [], cyclic, new Error(""), "[object Object]",
    new Error('400: {"error":'), new Error("500: <!doctype html><html>Internal Error</html>"),
    { code: "UNKNOWN_VALIDATION_CODE" }, "INTERNAL_SERVER_ERROR", "RH_OVERRIDE_REQUIRED:",
    new Error("TypeError: Cannot read properties of undefined\n at save (a.ts:1)"),
    { message: 'column "woTitle" does not exist' }, { error: "SQLSTATE: 123" },
    new Error("Unexpected token '<', \"<!doctype\" is not valid JSON"),
    new Error("Failed to fetch"),
  ]) assert.equal(workOrderErrorDescription(error, fallback), fallback);
});

test("action-specific titles/fallbacks also work with empty errors and retain toast options", () => {
  const toast = { title: "Error", description: "400: {}", variant: "destructive", duration: 9000 };
  const result = formatWorkOrderToast(toast, "Postponement Failed");
  assert.equal(result.title, "Postponement Failed");
  assert.match(result.description, /could not be postponed/);
  assert.equal(result.duration, 9000);
  assert.equal(result.variant, "destructive");
  assert.equal(formatWorkOrderToast({ ...toast, title: "Upload failed" }).title, "Document Upload Failed");
  assert.equal(formatWorkOrderToast({ ...toast, title: "Validation Error" }).title, "Work Order Validation");
  assert.equal(toast.title, "Error");
});

test("success, notices, empty exports and partial/bulk outcomes are untouched", () => {
  for (const title of [
    "Draft Saved (attachments partially failed)", "Work Order Created",
    "Approved", "Overdue Completion", "No Data", "Partial upload",
    "Documents Partially Uploaded", "Running Hours Update Blocked",
    "Spare Consumption Notice", "Partial queue",
  ]) {
    const toast = { title, description: "Actual outcome with counts, dates and correction.", variant: "destructive" };
    assert.equal(formatWorkOrderToast(toast), toast);
  }
  const success = { title: "Bulk Update Complete", description: "3 planned dates saved" };
  assert.equal(formatWorkOrderToast(success), success);
  const info = { title: "Nothing to review", description: "No work orders pending approval." };
  assert.equal(formatWorkOrderToast(info), info);
});

test("response helper reads the actual error body without changing the HTTP contract", async () => {
  const payload = { error: "Approval blocked", details: { message: "Chief Engineer remarks must be at least 20 characters." } };
  const response = new Response(JSON.stringify(payload), { status: 403 });
  const error = await workOrderResponseError(response);
  assert.equal(error.message, `403: ${JSON.stringify(payload)}`);
  assert.match(workOrderErrorDescription(error, fallback), /Chief Engineer remarks.*20 characters/);
});
