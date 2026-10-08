import { describe, expect, it } from "vitest";
import { formatJobFormDate } from "@/lib/jobFormDatePresentation";
import { formatPeriodDate, formatPeriodDisplayValue, type PeriodValue } from "@/lib/periodPickerPresentation";

describe("Job Form numeric date presentation", () => {
  it.each([
    ["2026-04-01", "01-04-2026"],
    ["01-Apr-2026", "01-04-2026"],
    ["01-04-2026", "01-04-2026"],
    ["01 Apr 2026", "01-04-2026"],
    ["2025-11-28T1200", "28-11-2025"],
    ["2026-04-01T00:30:00+05:30", "01-04-2026"],
    ["2026-04-01T23:30:00-07:00", "01-04-2026"],
    ["2026-04-01T08:00:00Z", "01-04-2026"],
    ["29-Feb-2024", "29-02-2024"],
  ])("shows %s as %s without a timezone day shift", (raw, expected) => {
    expect(formatJobFormDate(raw)).toBe(expected);
  });

  it.each([null, undefined, "", "not a date", "2026-02-30", "31-04-2026", "29-Feb-2025"])(
    "does not invent a date for %s",
    (raw) => {
      expect(formatJobFormDate(raw)).toBe("-");
      expect(formatJobFormDate(raw, "—")).toBe("—");
    },
  );

  it("formats completed/skipped history values without changing serialized job data", () => {
    const record = Object.freeze({
      nextDueDate: "01-Apr-2026",
      lastCompletedDate: "2026-03-01T00:30:00+05:30",
      completionDate: "2026-03-01",
      workDate: "01-Mar-2026",
      skippedCycleDate: "2026-02-01",
      runDate: "12000",
    });
    const before = JSON.stringify(record);
    expect(formatJobFormDate(record.nextDueDate)).toBe("01-04-2026");
    expect(formatJobFormDate(record.lastCompletedDate)).toBe("01-03-2026");
    expect(formatJobFormDate(record.completionDate || record.workDate, "—")).toBe("01-03-2026");
    expect(formatJobFormDate(record.skippedCycleDate || record.completionDate || record.workDate)).toBe("01-02-2026");
    expect(JSON.stringify(record)).toBe(before);
    expect(record.runDate).toBe("12000");
  });
});

describe("PeriodPicker presentation is opt-in and leaves local calendar selections unchanged", () => {
  const from = new Date(2026, 3, 1);
  const to = new Date(2026, 3, 30);
  const range: PeriodValue = { mode: "dateRange", dateFrom: from, dateTo: to };

  it("keeps other callers' original date and range labels by default", () => {
    expect(formatPeriodDate(from)).toBe("01 Apr 2026");
    expect(formatPeriodDisplayValue(range)).toBe("01 Apr 2026 - 30 Apr 2026");
    expect(formatPeriodDisplayValue({ mode: "dateRange", dateFrom: from })).toBe("From 01 Apr 2026");
  });

  it("shows numeric Date From, Date To and applied range labels only when requested", () => {
    expect(formatPeriodDate(from, "DD-MM-YYYY")).toBe("01-04-2026");
    expect(formatPeriodDate(to, "DD-MM-YYYY")).toBe("30-04-2026");
    expect(formatPeriodDisplayValue(range, "DD-MM-YYYY")).toBe("01-04-2026 - 30-04-2026");
    expect(formatPeriodDisplayValue({ mode: "dateRange", dateFrom: from }, "DD-MM-YYYY")).toBe("From 01-04-2026");
  });

  it.each([
    [{ mode: "yearQuarterMonth", year: 2026, month: 3 }, "APR-2026"],
    [{ mode: "yearQuarterMonth", year: 2026, quarter: 2 }, "Q2-2026"],
    [{ mode: "yearQuarterMonth", year: 2026 }, "2026"],
  ] as const)("does not turn period %j into a full date", (period, expected) => {
    expect(formatPeriodDisplayValue(period)).toBe(expected);
    expect(formatPeriodDisplayValue(period, "DD-MM-YYYY")).toBe(expected);
  });

  it("preserves Date objects, local days and filter serialization", () => {
    const before = JSON.stringify(range);
    const fromTime = from.getTime();
    const toTime = to.getTime();
    const isoBoundary = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(isoBoundary(from)).toBe("2026-04-01");
    expect(isoBoundary(to)).toBe("2026-04-30");
    formatPeriodDisplayValue(range, "DD-MM-YYYY");
    expect(range.dateFrom).toBe(from);
    expect(range.dateTo).toBe(to);
    expect(from.getTime()).toBe(fromTime);
    expect(to.getTime()).toBe(toTime);
    expect(JSON.stringify(range)).toBe(before);
    expect(isoBoundary(from)).toBe("2026-04-01");
    expect(isoBoundary(to)).toBe("2026-04-30");
  });

  it("preserves empty period labels and avoids displaying invalid selections as dates", () => {
    expect(formatPeriodDate(undefined, "DD-MM-YYYY")).toBe("");
    expect(formatPeriodDate(new Date(NaN), "DD-MM-YYYY")).toBe("");
    expect(formatPeriodDisplayValue(null, "DD-MM-YYYY")).toBe("");
    expect(formatPeriodDisplayValue({ mode: "dateRange" }, "DD-MM-YYYY")).toBe("");
  });
});
