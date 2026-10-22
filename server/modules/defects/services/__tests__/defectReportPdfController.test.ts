import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportDefectReportPdf } from "../../controllers/defectsController";
import * as defectsService from "../defectsService";
import * as pdfService from "../defectReportPdfService";

vi.mock("../defectsService", () => ({ getDefect: vi.fn() }));
vi.mock("../defectReportPdfService", () => ({
  generateDefectReportPdf: vi.fn(),
  getDefectReportPdfFilename: vi.fn(() => "Defect_Report_D-1_20261022_1305.pdf"),
}));

function response() {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("Individual Defect Report PDF endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid data before launching a renderer", async () => {
    const res = response();
    await exportDefectReportPdf({ body: { reportId: "D-1", actions: {} }, params: { id: "D-1" } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pdfService.generateDefectReportPdf).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing defect", async () => {
    vi.mocked(defectsService.getDefect).mockResolvedValueOnce(undefined);
    const res = response();
    await exportDefectReportPdf({ body: { reportId: "D-1" }, params: { id: "D-1" } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(pdfService.generateDefectReportPdf).not.toHaveBeenCalled();
  });

  it("uses the saved identity but keeps current unsaved form content without writing records", async () => {
    vi.mocked(defectsService.getDefect).mockResolvedValueOnce({ id: "D-1" } as any);
    vi.mocked(pdfService.generateDefectReportPdf).mockResolvedValueOnce(new TextEncoder().encode("%PDF-test"));
    const res = response();
    await exportDefectReportPdf({
      body: { reportId: "wrong-id", description: "Unsaved current form description" }, params: { id: "D-1" },
    } as any, res as any);
    expect(pdfService.generateDefectReportPdf).toHaveBeenCalledWith(expect.objectContaining({
      reportId: "D-1", description: "Unsaved current form description",
    }));
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringContaining("Defect_Report_D-1"));
    expect(res.send).toHaveBeenCalledWith(Buffer.from("%PDF-test"));
  });

  it("returns a clear error without leaking render internals", async () => {
    vi.mocked(defectsService.getDefect).mockResolvedValueOnce({ id: "D-1" } as any);
    vi.mocked(pdfService.generateDefectReportPdf).mockRejectedValueOnce(new Error("Private renderer detail"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = response();
    try {
      await exportDefectReportPdf({ body: { reportId: "D-1" }, params: { id: "D-1" } } as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Could not generate the Defect Report PDF. Please try again." });
    } finally {
      errorLog.mockRestore();
    }
  });
});
