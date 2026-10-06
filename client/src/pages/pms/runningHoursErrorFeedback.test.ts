import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getLowerRunningHoursWarning, getRunningHoursErrorFeedback, RunningHoursUpdateError,
} from "./runningHoursErrorFeedback";
import { validateRHMonotonicity } from "../../../../server/modules/running-hours/utils/rhValidation";

const fallback = "Failed to update running hours";
const payload = {
  error: "Current Reading (95555 RH) cannot be lower than the latest Running Hours value (97120 RH recorded on 2026-10-01). Correct the reading before continuing.",
  code: "LOWER_THAN_CURRENT_RH", submittedRH: 95555, currentRH: 97120,
  currentRHDate: "2026-10-01", submittedRHDate: "2026-10-01",
};
const transportError = (body: unknown) => new Error(`400: ${JSON.stringify(body)}`);

test("screenshot payload becomes a concise warning without diagnostics or duplicates", () => {
  const error = transportError({ ...payload, monotonicity: { ...payload, allowed: false, reason: payload.code } });
  assert.deepEqual(getRunningHoursErrorFeedback(error, fallback), {
    title: "Running Hours Update Blocked",
    description: "Entered reading: 95,555 RH. Latest saved reading: 97,120 RH on 01-Oct-2026. The reading cannot be lower than the latest saved value. Check and correct the reading.",
  });
  assert.equal(error.message.startsWith("400: {"), true, "shared transport error must not be mutated");
});

test("flat, details, nested monotonicity, raw strings and Work Order errors use the same warning", () => {
  const expected = getLowerRunningHoursWarning(payload);
  for (const error of [
    payload, transportError(payload), `400: ${JSON.stringify(payload)}`,
    transportError({ error: payload.error, details: payload }),
    { details: { monotonicity: { ...payload, code: undefined, reason: payload.code } } },
    { error: payload }, new RunningHoursUpdateError(payload),
  ]) {
    assert.deepEqual(getLowerRunningHoursWarning(error), expected);
  }
});

test("missing dates are omitted without inventing a date", () => {
  for (const currentRHDate of [null, undefined, "", "invalid", "2026-02-30", "01-Not-2026"]) {
    const description = getRunningHoursErrorFeedback(transportError({ ...payload, currentRHDate }), fallback).description;
    assert.ok(description.includes("Latest saved reading: 97,120 RH."));
    assert.ok(!description.includes(" on "));
  }
});

test("decimal and zero readings remain exact and are not treated as missing", () => {
  for (const [submittedRH, currentRH, expected] of [
    [0, 0.0123456789, "Entered reading: 0 RH. Latest saved reading: 0.0123456789 RH"],
    [1234.567891, 9876.543219, "Entered reading: 1,234.567891 RH. Latest saved reading: 9,876.543219 RH"],
    ["0", "97120.125", "Entered reading: 0 RH. Latest saved reading: 97,120.125 RH"],
  ]) {
    const description = getRunningHoursErrorFeedback(transportError({ ...payload, submittedRH, currentRH }), fallback).description;
    assert.ok(description.startsWith(expected), description);
  }
  const description = getRunningHoursErrorFeedback({
    code: payload.code, submittedRH: null, currentRH: "not a number",
  }, fallback).description;
  assert.equal(description, "The reading cannot be lower than the latest saved value. Check and correct the reading.");
});

test("calendar dates never shift with browser timezone, including ISO timestamps", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["Asia/Calcutta", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = timezone;
      for (const currentRHDate of ["2026-10-01", "2026-10-01T00:00:00Z", "01-Oct-2026"]) {
        assert.ok(getRunningHoursErrorFeedback(transportError({ ...payload, currentRHDate }), fallback)
          .description.includes("on 01-Oct-2026."));
      }
    }
    assert.ok(getRunningHoursErrorFeedback({ ...payload, currentRHDate: "2024-02-29" }, fallback)
      .description.includes("on 29-Feb-2024."));
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("other RH errors retain useful server feedback, not their diagnostic payload", () => {
  for (const error of [
    transportError({ error: "Select a valid reading date.", code: "RH_INVALID_READING_DATE", details: [] }),
    transportError({ error: { message: "Select a valid reading date." } }),
    new Error("403: Select a valid reading date."),
    { message: "Select a valid reading date." },
  ]) {
    assert.deepEqual(getRunningHoursErrorFeedback(error, fallback), {
      title: "Error", description: "Select a valid reading date.",
    });
  }
  assert.equal(getRunningHoursErrorFeedback(transportError({
    error: "Increase exceeds the maximum allowed hours.", validation: { requiresAdminOverride: true },
  }), fallback).description, "Increase exceeds the maximum allowed hours.");
});

test("malformed, empty, HTML and diagnostic-only errors use the operation fallback", () => {
  for (const error of [
    null, undefined, {}, new Error(""), new Error('400: {"error":'),
    new Error("500: <html>Internal Server Error</html>"),
    transportError({ details: [{ code: "invalid_type", expected: "number" }] }),
    transportError({ error: "LOWER_THAN_CURRENT_RH" }),
    new Error("TypeError: internal failure\n    at update (file.ts:1:2)"),
    transportError({ error: "Internal failure\n    at update (file.ts:1:2)" }),
    transportError(["unexpected array"]),
  ]) {
    assert.deepEqual(getRunningHoursErrorFeedback(error, fallback), { title: "Error", description: fallback });
  }
  assert.equal(getRunningHoursErrorFeedback(null, "Failed to perform bulk update").description, "Failed to perform bulk update");
  assert.equal(getRunningHoursErrorFeedback(null, "Failed to update child running hours").description, "Failed to update child running hours");
});

test("unrelated Work Order errors and successful outcomes are not relabeled", () => {
  for (const error of [
    new Error("Not enough spares in stock"),
    transportError({ error: "Date is required", code: "COMPLETION_DATE_REQUIRED" }),
    { code: "RH_OVERRIDE_REQUIRED", error: "Rate exceeds limit", canOverride: true },
    { rhUpdateSkipped: true, rhUpdateOutcome: "skipped_lower", submittedRH: 1, latestRH: 2 },
    { monotonicity: { reason: "APPROVED_RESET", allowed: true } },
    { monotonicity: { reason: "EQUAL_CURRENT_RH", allowed: true } },
  ]) {
    assert.equal(getLowerRunningHoursWarning(error), null);
  }
});

test("presentation consumes actual validation output without changing lower, equal, increase or reset rules", () => {
  const result = validateRHMonotonicity({
    submittedRH: 95555, currentRH: 97120, currentRHDate: "2026-10-01",
  });
  assert.equal(result.allowed, false);
  const copy = JSON.stringify(result);
  assert.ok(getRunningHoursErrorFeedback({ monotonicity: result }, fallback).description.includes("95,555 RH"));
  assert.equal(JSON.stringify(result), copy);
  for (const [submittedRH, approvedReset, reason] of [
    [97120, false, "EQUAL_CURRENT_RH"], [97121, false, "VALID_INCREASE"], [0, true, "APPROVED_RESET"],
  ] as const) {
    const allowed = validateRHMonotonicity({ submittedRH, currentRH: 97120, approvedReset });
    assert.equal(allowed.allowed, true);
    assert.equal(allowed.reason, reason);
    assert.equal(getLowerRunningHoursWarning({ monotonicity: allowed }), null);
  }
});
