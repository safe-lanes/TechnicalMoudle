import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlannerDateInput } from "@/components/pms/PlannerDateInput";
import { formatPlannerDueInfo, plannerDateCommitValue, plannerDateDraftValue } from "@/lib/plannerDatePresentation";

// The server test configuration does not transform JSX in the shared UI primitive.
vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props),
}));

describe("Planner date presentation leaves raw row data unchanged", () => {
  it.each([
    ["2026-01-16", "16-01-2026"],
    ["16-Jan-2026", "16-01-2026"],
    ["16-01-2026", "16-01-2026"],
    ["2026-01-16T00:30:00+05:30", "16-01-2026"],
    ["2026-01-16T23:30:00-07:00", "16-01-2026"],
    ["2024-02-29", "29-02-2024"],
    ["-", "-"],
    ["", ""],
    ["Not available", "Not available"],
    ["2026-02-30", "2026-02-30"],
  ])("formats Calendar dueInfo %s as %s", (raw, expected) => {
    expect(formatPlannerDueInfo("CALENDAR", raw)).toBe(expected);
  });

  it.each(["12,000 RH", "500 RH", "0 RH", "-", "2026-01-16"])("never treats RH dueInfo %s as a calendar date", (raw) => {
    expect(formatPlannerDueInfo("RH", raw)).toBe(raw);
  });

  it("keeps original dates available to sorting and export consumers", () => {
    const rows = Object.freeze([
      Object.freeze({ jobType: "CALENDAR", dueInfo: "2026-01-16", plannedDate: "2026-10-08" }),
      Object.freeze({ jobType: "RH", dueInfo: "12,000 RH", plannedDate: null }),
    ]);
    const original = JSON.stringify(rows);
    expect(rows.map(row => formatPlannerDueInfo(row.jobType, row.dueInfo))).toEqual(["16-01-2026", "12,000 RH"]);
    expect(JSON.stringify(rows)).toBe(original);
  });
});

describe("Planner date drafts and autosave commits", () => {
  it.each(["0", "08", "08-10", "08-10-202", "31-02-2026", "29-02-2025", "2026-10-08"])(
    "does not interpret invalid/partial draft %s as a clear",
    (draft) => expect(plannerDateDraftValue(draft)).toBeUndefined(),
  );

  it("distinguishes an intentional clear from a complete numeric date", () => {
    expect(plannerDateDraftValue("")).toBe("");
    expect(plannerDateDraftValue("08-10-2026")).toBe("2026-10-08");
    expect(plannerDateDraftValue("29-02-2024")).toBe("2024-02-29");
  });

  it.each(["2026-10-08", "08-Oct-2026", "08-10-2026", "2026-10-08T00:30:00+05:30"])(
    "does not normalize or autosave an unchanged day originally stored as %s",
    (original) => expect(plannerDateCommitValue(original, "2026-10-08")).toBeUndefined(),
  );

  it("sends a newly committed day as ISO and an intentional clear as the existing empty value", () => {
    expect(plannerDateCommitValue("08-Oct-2026", "2026-10-09")).toBe("2026-10-09");
    const cleared = plannerDateCommitValue("2026-10-08", "");
    expect(cleared).toBe("");
    expect(cleared || null).toBeNull();
    expect(plannerDateCommitValue(null, "")).toBeUndefined();
    expect(plannerDateCommitValue(null, "2026-10-09")).toBe("2026-10-09");
  });

  it("rejects invalid or display-format values at the final commit boundary", () => {
    for (const selected of ["2026-02-30", "2026-13-01", "09-10-2026", "2026-10", "garbage"]) {
      expect(plannerDateCommitValue("2026-10-08", selected)).toBeUndefined();
    }
  });

  it("suppresses Enter-plus-blur duplicates before an API refresh and permits retry after failure", () => {
    expect(plannerDateCommitValue("2026-10-08", "2026-10-09", "2026-10-09")).toBeUndefined();
    expect(plannerDateCommitValue("2026-10-08", "2026-10-09", "2026-10-08")).toBe("2026-10-09");
    expect(plannerDateCommitValue("2026-10-08", "", "")).toBeUndefined();
  });
});

describe("Planner controls show locale-independent dates without saving on render", () => {
  it.each(["2026-10-08", "08-Oct-2026", "08-10-2026"])("shows raw %s numerically over an ISO calendar", (value) => {
    const change = vi.fn();
    const html = renderToStaticMarkup(React.createElement(PlannerDateInput, {
      value, onChange: change, "data-testid": "input-planned-date-1", "aria-label": "Planned date",
    }));
    expect(html).toContain('type="text"');
    expect(html).toContain('value="08-10-2026"');
    expect(html).toContain('value="2026-10-08"');
    expect(html).toContain('data-testid="input-planned-date-1-picker-trigger"');
    expect(change).not.toHaveBeenCalled();
  });

  it("keeps empty and bulk control placeholders numeric", () => {
    const html = renderToStaticMarkup(React.createElement(PlannerDateInput, {
      value: "", onChange: vi.fn(), commitOnChange: true,
      "data-testid": "input-bulk-date", "aria-label": "Bulk planned date",
    }));
    expect(html).toContain('placeholder="DD-MM-YYYY"');
    expect(html).toContain('data-testid="input-bulk-date"');
  });

  it("retains disabled row controls and does not offer a disabled calendar", () => {
    const html = renderToStaticMarkup(React.createElement(PlannerDateInput, {
      value: "2026-10-08", onChange: vi.fn(), disabled: true,
      "data-testid": "input-planned-date-2", "aria-label": "Planned date",
    }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('value="08-10-2026"');
    expect(html).not.toContain("input-planned-date-2-picker-trigger");
  });
});
