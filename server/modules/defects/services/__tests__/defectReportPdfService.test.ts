import { describe, expect, it, vi } from "vitest";
import puppeteer from "puppeteer";
import { defectReportPdfSchema } from "@shared/defectReportPdf";
import {
  buildDefectReportPdfHtml, generateDefectReportPdf, getDefectReportPdfFilename,
} from "../defectReportPdfService";

vi.mock("puppeteer", () => ({ default: { launch: vi.fn() } }));
vi.mock("../defectLogPdfService", () => ({ getChromiumPath: () => "/mock/chromium" }));

describe("Individual Defect Report PDF", () => {
  it("keeps all legacy sections and display fields, including every action and extension", () => {
    const data = defectReportPdfSchema.parse({
      reportId: "D001-26-0002", vessel: "Test Vessel", category: "Machinery",
      dateObserved: "07 Sep 2026", source: "Non-SIRE", component: "Pump",
      dateReportedToOffice: "08 Sep 2026", defectCategory: "Mechanical",
      make: "Maker", dateRegisteredInSystem: "09 Sep 2026", defectType: "Leak",
      model: "Model-X", targetDate: "30 Sep 2026", raisedBy: "Chief Engineer",
      isCoc: true, isCritical: false, dateClosed: "01 Oct 2026",
      description: "Seal inspection", immediateCause: "UNSAFE ACT\n• Checklist",
      immediateCauseExplanation: "Immediate explanation", rootCause: "SYSTEM FACTOR",
      rootCauseExplanation: "Root explanation", sireVersion: "SIRE 2.0",
      sireReference: "4.1", sireHardwareClass: "Hardware class", riskLevel: "Medium",
      priority: "High",
      actions: Array.from({ length: 105 }, (_, index) => ({
        actionType: "Corrective", description: `Action-${index + 1}`,
        proposedBy: "Engineer", responsibility: "Master", dueDate: "15 Oct 2026", status: "Open",
      })),
      targetDateExtension: {
        existingTargetDate: "30 Sep 2026", newTargetDate: "15 Oct 2026",
        reasonForExtension: "Parts pending", approved: "Approved",
        approvalDate: "25 Sep 2026", approverComments: "Approved remarks",
      },
      confirmCompleted: true, dateCompleted: "01 Oct 2026", closedByName: "Closer",
      closedByRank: "Master", verified: true, dateVerified: "02 Oct 2026",
      verifiedByName: "Verifier", verifiedByOfficePosition: "Superintendent",
    });
    const html = buildDefectReportPdfHtml(data);
    for (const value of Object.values(data)) {
      if (typeof value === "string") expect(html).toContain(value);
    }
    for (const value of Object.values(data.targetDateExtension!)) expect(html).toContain(value);
    for (const action of data.actions) expect(html).toContain(action.description);
    expect(html).toContain("CoC: Yes, Critical: No");
    expect(html).toContain("PART A - REPORTING");
    expect(html).toContain("PART B - ANALYSIS & ACTIONS");
    expect(html).toContain("PART C - CLOSEOUT");
    expect(html).toContain("B5. Target Date Extension");
    expect(html).toContain("A4 portrait");
    expect(html).toContain("<thead>");
  });

  it("handles empty optional data and excludes an absent extension", () => {
    const html = buildDefectReportPdfHtml(defectReportPdfSchema.parse({ reportId: "D-1" }));
    expect(html).toContain("No actions recorded");
    expect(html).toContain('<div class="value">-</div>');
    expect(html).toContain("CoC: No, Critical: No");
    expect(html).not.toContain("B5. Target Date Extension");
    expect(html).not.toContain("undefined");
    expect(html).toContain("C2. Verification");
  });

  it("converts rich text safely, retaining breaks and preventing remote resources or scripts", () => {
    const html = buildDefectReportPdfHtml(defectReportPdfSchema.parse({
      reportId: 'D-"1',
      description: '<p>Pump &amp; seal</p><ul><li>Inspect &#x26; repair</li></ul>'
        + '<img src="https://example.invalid/track"><script>BAD_SCRIPT()</script>'
        + '&lt;img src=x onerror=BAD()&gt;',
    }));
    expect(html).toContain("Pump &amp; seal\n");
    expect(html).toContain("• Inspect &amp; repair");
    expect(html).toContain("&lt;img src=x onerror=BAD()&gt;");
    expect(html).toContain("D-&quot;1");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("BAD_SCRIPT()");
    expect(html).not.toContain('<img src=');
    expect(html).toContain("default-src 'none'");
  });

  it("validates transport data without accepting objects or coerced boolean values", () => {
    expect(defectReportPdfSchema.safeParse({ reportId: "" }).success).toBe(false);
    expect(defectReportPdfSchema.safeParse({ reportId: "D-1", description: {} }).success).toBe(false);
    expect(defectReportPdfSchema.safeParse({ reportId: "D-1", verified: "false" }).success).toBe(false);
    expect(defectReportPdfSchema.safeParse({ reportId: "D-1", actions: "invalid" }).success).toBe(false);
  });

  it("preserves the legacy filename and makes unsafe identifiers header-safe", () => {
    const date = new Date(2026, 9, 22, 13, 5);
    expect(getDefectReportPdfFilename("D001-26-0002", date)).toBe("Defect_Report_D001-26-0002_20261022_1305.pdf");
    expect(getDefectReportPdfFilename('D/"\r\n1', date)).toBe("Defect_Report_D____1_20261022_1305.pdf");
  });

  it.each([false, true])("closes Chromium when rendering fails=%s", async (fails) => {
    const page = {
      setJavaScriptEnabled: vi.fn(), setRequestInterception: vi.fn(), on: vi.fn(),
      setContent: vi.fn(), pdf: fails ? vi.fn().mockRejectedValue(new Error("Render failed"))
        : vi.fn().mockResolvedValue(new Uint8Array([1, 2])),
    };
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    vi.mocked(puppeteer.launch).mockResolvedValueOnce(browser as any);
    const pending = generateDefectReportPdf(defectReportPdfSchema.parse({ reportId: "D-1" }));
    if (fails) await expect(pending).rejects.toThrow("Render failed");
    else await expect(pending).resolves.toEqual(new Uint8Array([1, 2]));
    expect(browser.close).toHaveBeenCalledOnce();
    expect(page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(page.setRequestInterception).toHaveBeenCalledWith(true);
  });
});
