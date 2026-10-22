import { describe, expect, it } from "vitest";
import {
  buildDefectLogPdfHtml,
  DEFECT_LOG_PDF_COLUMNS,
  getDefectLogPdfFilename,
} from "../defectLogPdfService";

describe("Defect Log PDF export", () => {
  it("uses the exact agreed column order", () => {
    expect(DEFECT_LOG_PDF_COLUMNS).toEqual([
      "ID",
      "Vessel",
      "Issue Date",
      "Category",
      "Component",
      "Description",
      "Target Date",
      "Date Compl.",
      "Status",
      "Priority",
    ]);
  });

  it("renders data as escaped table cells and keeps line breaks readable", () => {
    const html = buildDefectLogPdfHtml([
      {
        ID: "D-001",
        Description: "<script>alert('x')</script>\nInspect & repair",
      },
    ]);

    expect(html).toContain("<th>ID</th>");
    expect(html).toContain("<th>Date Compl.</th>");
    expect(html).toContain("<th>Priority</th>");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).toContain("Inspect &amp; repair");
    expect(html).toContain("<br>Inspect &amp; repair");
    expect(html).not.toContain("<script>alert");
    expect((html.match(/<th>/g) ?? []).length).toBe(10);
  });

  it("keeps the legacy PDF filename pattern", () => {
    expect(getDefectLogPdfFilename(new Date(2026, 9, 21, 13, 5))).toBe(
      "Defects_Log_20261021_1305.pdf",
    );
  });
});
