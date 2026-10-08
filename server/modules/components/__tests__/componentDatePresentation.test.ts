import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ComponentDateInput } from "@/components/pms/ComponentDateInput";
import {
  componentDateChangeValue,
  formatComponentChangeValue,
  formatComponentDate,
} from "@/lib/componentDatePresentation";
import { workOrderDateInputValue } from "@shared/dateUtils";

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props),
}));

describe("Component-only date presentation", () => {
  it.each([
    ["2026-09-18", "18-09-2026"],
    ["18-Sep-2026", "18-09-2026"],
    ["18-09-2026", "18-09-2026"],
    ["18/09/2026", "18-09-2026"],
    ["29-Feb-2024", "29-02-2024"],
    ["2026-09-18T00:30:00+05:30", "18-09-2026"],
    ["2026-09-18T23:30:00-07:00", "18-09-2026"],
    ["2026-09-18T08:00:00Z", "18-09-2026"],
  ])("shows %s as %s without changing its calendar day", (raw, expected) => {
    expect(formatComponentDate(raw)).toBe(expected);
  });

  it.each([null, undefined, "", "Not available", "not a date", "31-02-2026", "2026-02-30", "29-Feb-2025"])(
    "keeps caller-selected fallbacks for absent/invalid date %s",
    (raw) => {
      expect(formatComponentDate(raw)).toBe("—");
      expect(formatComponentDate(raw, "")).toBe("");
      expect(formatComponentDate(raw, "Not available")).toBe("Not available");
    },
  );

  it.each(["2026-09-18", "18-Sep-2026", "18-09-2026", "2026-09-18T00:30:00+05:30"])(
    "preserves the original saved representation when selecting/returning to %s",
    (original) => {
      expect(componentDateChangeValue(original, "2026-09-18")).toBe(original);
      expect(componentDateChangeValue(original, "2026-09-19")).toBe("2026-09-19");
      expect(componentDateChangeValue(original, "")).toBe("");
    },
  );

  it("newly selected dates keep the original ISO request convention", () => {
    expect(componentDateChangeValue("", "2026-10-08")).toBe("2026-10-08");
    expect(componentDateChangeValue(null, "2026-10-08")).toBe("2026-10-08");
    expect(workOrderDateInputValue("18-Sep-2026")).toBe("2026-09-18");
  });

  it.each(["2026-09-18", "18-Sep-2026", "18-09-2026", "2026-09-18T23:30:00-07:00"])(
    "renders %s with numeric visible text, an ISO picker, and no mount-time change",
    (original) => {
      const onChange = vi.fn();
      const markup = renderToStaticMarkup(React.createElement(ComponentDateInput, {
        value: original,
        onChange,
        "data-testid": "component-date",
      }));
      expect(markup).toContain('value="18-09-2026"');
      expect(markup).toContain('value="2026-09-18"');
      expect(markup).toContain('data-testid="component-date-picker"');
      expect(markup).toContain('placeholder="DD-MM-YYYY"');
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("empty and read-only controls preserve blank values and disable editing", () => {
    const empty = renderToStaticMarkup(React.createElement(ComponentDateInput, { value: "" }));
    expect(empty).toContain('value=""');
    expect(empty).toContain('placeholder="DD-MM-YYYY"');
    const readOnly = renderToStaticMarkup(React.createElement(ComponentDateInput, {
      value: "18-Sep-2026",
      readOnly: true,
    }));
    expect(readOnly).toContain('value="18-09-2026"');
    expect(readOnly).toContain('disabled=""');
    expect(readOnly).not.toContain('type="date"');
  });

  it("formats change-request review text, not the submitted diff or other fields", () => {
    const diff = Object.freeze({ path: "A.installationDate", oldVal: "18-Sep-2026", newVal: "2026-10-08" });
    const before = JSON.stringify(diff);
    expect(formatComponentChangeValue(diff.path, diff.oldVal)).toBe("18-09-2026");
    expect(formatComponentChangeValue(diff.path, diff.newVal)).toBe("08-10-2026");
    expect(JSON.stringify(diff)).toBe(before);
    expect(formatComponentChangeValue("A.componentName", "18-Sep-2026")).toBe("18-Sep-2026");
    expect(formatComponentChangeValue("A.installationDate", null)).toBe("null");
    expect(formatComponentChangeValue("A.installationDate", "")).toBe("-");
  });
});
