import { useState, useMemo } from "react";
import { Search, Calendar, History, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVessel } from "@/contexts/VesselContext";

interface HistoryRecord {
  id: number;
  componentId: string;
  componentCode: string;
  vesselCode: string;
  jobId: string | null;
  jobCode: string | null;
  workOrderId: string;
  workOrderNo: string;
  jobTitle: string;
  maintenanceType: string;
  dateCompleted: string;
  runningHoursAtCompletion: string | null;
  performedBy: string;
  approvedBy: string | null;
  status: string;
  missedCycles: number | null;
  isSkipped: boolean | null;
  backdatingDays: number;
}

interface VesselComponent {
  id: string;
  componentCode: string;
  name: string;
}

const EXCEL_COLORS = {
  primary: "FF1E5A8E",
  secondary: "FF5DADE2",
  textDark: "FF2C3E50",
  textLight: "FF5A6C7D",
  textWhite: "FFFFFFFF",
  bgLight: "FFF7F9FC",
  bgWhite: "FFFFFFFF",
  bgAmber: "FFFEF3C7",
  bgYellow: "FFFFFCE8",
  border: "FFE1E8ED",
};

const PDF_COLORS = {
  primary: [30, 90, 142] as [number, number, number],
  secondary: [93, 173, 226] as [number, number, number],
  textDark: [44, 62, 80] as [number, number, number],
  textLight: [90, 108, 125] as [number, number, number],
  textWhite: [255, 255, 255] as [number, number, number],
  bgLight: [247, 249, 252] as [number, number, number],
  bgAmber: [254, 243, 199] as [number, number, number],
  bgYellow: [255, 252, 232] as [number, number, number],
  border: [225, 232, 237] as [number, number, number],
};

const WorkHistory: React.FC = () => {
  const [, setLocation] = useLocation();
  const { vesselId, vessels } = useVessel();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("all");
  const [selectedDateFilter, setSelectedDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const currentVessel = vessels.find(v => v.id === vesselId);
  const vesselName = currentVessel?.name || "Vessel";

  const { data: records = [], isLoading: recordsLoading } = useQuery<HistoryRecord[]>({
    queryKey: [`/technical/api/maintenance-history/vessel/${vesselId}`],
    enabled: !!vesselId,
  });

  const { data: components = [], isLoading: componentsLoading } = useQuery<VesselComponent[]>({
    queryKey: [`/technical/api/components/${vesselId}`],
    enabled: !!vesselId,
  });

  const componentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of components) {
      if (c.componentCode) map.set(c.componentCode, c.name || c.componentCode);
    }
    return map;
  }, [components]);

  const isLoading = recordsLoading || componentsLoading;

  const filterByDate = (record: HistoryRecord): boolean => {
    if (!record.dateCompleted) return false;
    const completedDate = new Date(record.dateCompleted);
    const today = new Date();

    switch (selectedDateFilter) {
      case "lastMonth": {
        const threshold = new Date();
        threshold.setMonth(today.getMonth() - 1);
        return completedDate >= threshold;
      }
      case "lastQuarter": {
        const threshold = new Date();
        threshold.setMonth(today.getMonth() - 3);
        return completedDate >= threshold;
      }
      case "lastYear": {
        const threshold = new Date();
        threshold.setFullYear(today.getFullYear() - 1);
        return completedDate >= threshold;
      }
      case "custom": {
        if (!customStartDate || !customEndDate) return true;
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return completedDate >= start && completedDate <= end;
      }
      default:
        return true;
    }
  };

  const filteredRecords = useMemo(() => {
    return records
      .filter(record => {
        const matchesComponent =
          selectedComponent === "all" || record.componentCode === selectedComponent;
        const matchesSearch =
          searchTerm === "" ||
          record.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.componentCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (componentMap.get(record.componentCode) ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.performedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.workOrderNo?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDate = filterByDate(record);
        return matchesComponent && matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        if (!a.dateCompleted) return 1;
        if (!b.dateCompleted) return -1;
        return new Date(b.dateCompleted).getTime() - new Date(a.dateCompleted).getTime();
      });
  }, [records, selectedComponent, searchTerm, selectedDateFilter, customStartDate, customEndDate, componentMap]);

  const vesselComponents = useMemo(() => {
    return [...components]
      .filter(c => c.componentCode)
      .sort((a, b) => {
        const nameA = a.name || a.componentCode;
        const nameB = b.name || b.componentCode;
        return nameA.localeCompare(nameB);
      });
  }, [components]);

  const dateRangeLabel = useMemo(() => {
    switch (selectedDateFilter) {
      case "lastMonth": return "Last Month";
      case "lastQuarter": return "Last Quarter";
      case "lastYear": return "Last Year";
      case "custom":
        if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
        return "Custom Range";
      default: return "All Time";
    }
  }, [selectedDateFilter, customStartDate, customEndDate]);

  const exportFilename = (ext: string) => {
    const safeVesselName = vesselName.replace(/[^a-zA-Z0-9]/g, "");
    const dateStr = new Date().toISOString().slice(0, 10);
    return `work-history-${safeVesselName}-${dateStr}.${ext}`;
  };

  const formatDateCell = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SAIL PMS";
      workbook.created = new Date();

      const ws = workbook.addWorksheet("Work History");

      const columns = [
        { key: "dateCompleted", header: "Date Completed", width: 16 },
        { key: "component", header: "Component", width: 30 },
        { key: "jobTitle", header: "Job Title", width: 42 },
        { key: "rh", header: "RH at Completion", width: 18 },
        { key: "missedCycles", header: "Missed Cycles", width: 15 },
        { key: "backdating", header: "Backdating (Days)", width: 18 },
        { key: "performedBy", header: "Performed By", width: 20 },
        { key: "status", header: "Status", width: 14 },
      ];

      const totalCols = columns.length;
      const lastColLetter = String.fromCharCode("A".charCodeAt(0) + totalCols - 1);

      ws.columns = columns.map(c => ({ key: c.key, width: c.width }));

      ws.mergeCells(`A1:${lastColLetter}1`);
      const titleCell = ws.getCell("A1");
      titleCell.value = "SEAFARER TECHNICAL MANAGEMENT SYSTEM";
      titleCell.font = { size: 14, bold: true, color: { argb: EXCEL_COLORS.textWhite }, name: "Arial" };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.primary } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 30;

      ws.mergeCells(`A2:${lastColLetter}2`);
      const subtitleCell = ws.getCell("A2");
      subtitleCell.value = `Work History Report — ${vesselName}`;
      subtitleCell.font = { size: 12, bold: true, color: { argb: EXCEL_COLORS.textDark }, name: "Arial" };
      subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.bgLight } };
      subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
      subtitleCell.border = { bottom: { style: "medium", color: { argb: EXCEL_COLORS.primary } } };
      ws.getRow(2).height = 25;

      ws.getRow(3).height = 8;

      ws.getCell("A4").value = `Vessel: ${vesselName}`;
      ws.getCell("A4").font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.textDark }, name: "Arial" };
      ws.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.bgLight } };

      const dtCol = String.fromCharCode(lastColLetter.charCodeAt(0) - 1);
      ws.mergeCells(`${dtCol}4:${lastColLetter}4`);
      ws.getCell(`${dtCol}4`).value = `Report Date: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
      ws.getCell(`${dtCol}4`).font = { size: 10, color: { argb: EXCEL_COLORS.textLight }, name: "Arial" };
      ws.getCell(`${dtCol}4`).alignment = { horizontal: "right" };
      ws.getRow(4).height = 18;

      ws.getCell("A5").value = `Report Period: ${dateRangeLabel}  |  Total Records: ${filteredRecords.length}`;
      ws.getCell("A5").font = { size: 9, color: { argb: EXCEL_COLORS.textDark }, name: "Arial" };
      ws.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.bgLight } };
      ws.getRow(5).height = 16;

      ws.getRow(6).height = 6;

      const headerRow = ws.getRow(7);
      columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.secondary } };
        cell.font = { bold: true, color: { argb: EXCEL_COLORS.textWhite }, size: 10, name: "Arial" };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: EXCEL_COLORS.textWhite } },
          left: { style: "thin", color: { argb: EXCEL_COLORS.textWhite } },
          bottom: { style: "thin", color: { argb: EXCEL_COLORS.textWhite } },
          right: { style: "thin", color: { argb: EXCEL_COLORS.textWhite } },
        };
      });
      headerRow.height = 25;

      filteredRecords.forEach((record, idx) => {
        const missedCycles = record.missedCycles ?? 0;
        const backdatingDays = record.backdatingDays ?? 0;
        const componentName = componentMap.get(record.componentCode) ?? record.componentCode;

        const rowNum = 8 + idx;
        const row = ws.getRow(rowNum);

        const values = [
          formatDateCell(record.dateCompleted),
          `${componentName} (${record.componentCode})`,
          record.jobTitle || "-",
          record.runningHoursAtCompletion
            ? `${parseFloat(record.runningHoursAtCompletion).toLocaleString()} hrs`
            : "-",
          missedCycles > 0 ? missedCycles : "-",
          backdatingDays > 0 ? backdatingDays : "-",
          record.performedBy || "-",
          record.status || "-",
        ];

        values.forEach((v, colIdx) => {
          row.getCell(colIdx + 1).value = v;
        });

        const isEven = idx % 2 === 1;
        let bgColor = isEven ? EXCEL_COLORS.bgLight : EXCEL_COLORS.bgWhite;
        let fontColor = EXCEL_COLORS.textDark;
        let isBold = false;

        if (missedCycles > 0) {
          bgColor = EXCEL_COLORS.bgAmber;
          fontColor = "FF92400E";
          isBold = true;
        } else if (backdatingDays > 0) {
          bgColor = EXCEL_COLORS.bgYellow;
          fontColor = "FF713F12";
          isBold = true;
        }

        row.eachCell((cell, colNum) => {
          if (colNum > totalCols) return;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
          cell.font = { color: { argb: fontColor }, size: 9, name: "Arial", bold: isBold };
          cell.border = {
            top: { style: "thin", color: { argb: EXCEL_COLORS.border } },
            left: { style: "thin", color: { argb: EXCEL_COLORS.border } },
            bottom: { style: "thin", color: { argb: EXCEL_COLORS.border } },
            right: { style: "thin", color: { argb: EXCEL_COLORS.border } },
          };
          cell.alignment = { horizontal: "left", vertical: "middle" };
        });
        row.height = 20;
      });

      const lastDataRow = 7 + filteredRecords.length + 1;
      const summaryRow = ws.getRow(lastDataRow + 1);
      summaryRow.getCell(1).value = "SUMMARY";
      summaryRow.getCell(1).font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.primary }, name: "Arial" };

      const totalMissed = filteredRecords.filter(r => (r.missedCycles ?? 0) > 0).length;
      const totalBackdated = filteredRecords.filter(r => (r.backdatingDays ?? 0) > 0).length;

      ws.getRow(lastDataRow + 2).getCell(1).value = `Total Records: ${filteredRecords.length}`;
      ws.getRow(lastDataRow + 3).getCell(1).value = `Records with Missed Cycles: ${totalMissed}`;
      ws.getRow(lastDataRow + 3).getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.bgAmber } };
      ws.getRow(lastDataRow + 4).getCell(1).value = `Records with Backdating: ${totalBackdated}`;
      ws.getRow(lastDataRow + 4).getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.bgYellow } };

      ws.pageSetup = {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFilename("xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;

      doc.setFillColor(...PDF_COLORS.primary);
      doc.rect(0, 0, pageWidth, 34, "F");

      doc.setTextColor(...PDF_COLORS.textWhite);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("WORK HISTORY REPORT", margin, 14);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(vesselName, margin, 22);

      doc.setFontSize(8);
      doc.text(`Period: ${dateRangeLabel}`, margin, 29);

      doc.setFontSize(8);
      doc.text(`Vessel: ${vesselName}`, pageWidth - margin, 12, { align: "right" });
      doc.text(
        `Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
        pageWidth - margin,
        18,
        { align: "right" }
      );
      doc.text(`Records: ${filteredRecords.length}`, pageWidth - margin, 24, { align: "right" });

      const headers = [
        "Date Completed",
        "Component",
        "Job Title",
        "RH at Completion",
        "Missed Cycles",
        "Backdating",
        "Performed By",
        "Status",
      ];

      const body = filteredRecords.map(record => {
        const missedCycles = record.missedCycles ?? 0;
        const backdatingDays = record.backdatingDays ?? 0;
        const componentName = componentMap.get(record.componentCode) ?? record.componentCode;

        return [
          formatDateCell(record.dateCompleted),
          `${componentName}\n${record.componentCode}`,
          record.jobTitle || "-",
          record.runningHoursAtCompletion
            ? `${parseFloat(record.runningHoursAtCompletion).toLocaleString()} hrs`
            : "-",
          missedCycles > 0 ? `⚠ ${missedCycles} cycle${missedCycles !== 1 ? "s" : ""}` : "—",
          backdatingDays > 0 ? `${backdatingDays} day${backdatingDays !== 1 ? "s" : ""}` : "—",
          record.performedBy || "-",
          record.status || "-",
        ];
      });

      autoTable(doc, {
        head: [headers],
        body,
        startY: 40,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          overflow: "linebreak",
          lineColor: PDF_COLORS.border,
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: PDF_COLORS.secondary,
          textColor: PDF_COLORS.textWhite,
          fontStyle: "bold",
          halign: "center",
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: PDF_COLORS.bgLight,
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 38 },
          2: { cellWidth: 60 },
          3: { cellWidth: 26 },
          4: { cellWidth: 24 },
          5: { cellWidth: 22 },
          6: { cellWidth: 30 },
          7: { cellWidth: 22 },
        },
        didParseCell: (hookData) => {
          if (hookData.section !== "body") return;
          const record = filteredRecords[hookData.row.index];
          if (!record) return;

          const missedCycles = record.missedCycles ?? 0;
          const backdatingDays = record.backdatingDays ?? 0;

          if (missedCycles > 0) {
            hookData.cell.styles.fillColor = PDF_COLORS.bgAmber;
            hookData.cell.styles.textColor = [146, 64, 14];
          } else if (backdatingDays > 0) {
            hookData.cell.styles.fillColor = PDF_COLORS.bgYellow;
            hookData.cell.styles.textColor = [113, 63, 18];
          }
        },
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(...PDF_COLORS.border);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        doc.setFontSize(7);
        doc.setTextColor(...PDF_COLORS.textLight);
        doc.text("SAIL — Seafarer Technical Management System", margin, pageHeight - 7);
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth - margin,
          pageHeight - 7,
          { align: "right" }
        );
      }

      doc.save(exportFilename("pdf"));
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleRowClick = (record: HistoryRecord) => {
    setLocation(`/pms/work-order/${record.workOrderId}`);
  };

  const getStatusBadgeColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading work history...</div>
      </div>
    );
  }

  const canExport = filteredRecords.length > 0;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <History className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Work History</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {vesselName} — Vessel-Level Maintenance History
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!canExport || isExportingExcel}
                title={!canExport ? "No records to export" : "Export to Excel"}
                data-testid="button-export-excel"
                className="gap-2"
              >
                {isExportingExcel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                )}
                Export Excel
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={!canExport || isExportingPDF}
                title={!canExport ? "No records to export" : "Export to PDF"}
                data-testid="button-export-pdf"
                className="gap-2"
              >
                {isExportingPDF ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 text-red-600" />
                )}
                Export PDF
              </Button>
            </div>
          </div>

          {/* Filters row */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by job, component, performed by, WO number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white"
                  data-testid="input-search-work-history"
                />
              </div>

              <Select value={selectedComponent} onValueChange={setSelectedComponent}>
                <SelectTrigger className="w-[240px] bg-white" data-testid="select-component-filter">
                  <SelectValue placeholder="All Components" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Components</SelectItem>
                  {vesselComponents.map(c => (
                    <SelectItem key={c.componentCode} value={c.componentCode}>
                      {c.name || c.componentCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Date Range:</span>
              <Select value={selectedDateFilter} onValueChange={setSelectedDateFilter}>
                <SelectTrigger className="w-[180px] bg-white" data-testid="select-date-filter">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                  <SelectItem value="lastYear">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {selectedDateFilter === "custom" && (
                <>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-[150px] bg-white"
                    data-testid="input-custom-start-date"
                  />
                  <span className="text-gray-500">to</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-[150px] bg-white"
                    data-testid="input-custom-end-date"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Date Completed</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Component</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Job Title</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">RH at Completion</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Missed Cycles</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Backdating</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Performed By</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <History className="h-16 w-16 mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No work history found</p>
                        <p className="text-sm mt-1">
                          {searchTerm || selectedComponent !== "all" || selectedDateFilter !== "all"
                            ? "Try adjusting your filters"
                            : "No completed work orders have been recorded yet for this vessel"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(record => {
                    const missedCycles = record.missedCycles ?? 0;
                    const backdatingDays = record.backdatingDays ?? 0;
                    const componentName = componentMap.get(record.componentCode) ?? record.componentCode;

                    return (
                      <tr
                        key={record.id}
                        onClick={() => handleRowClick(record)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        data-testid={`history-row-${record.id}`}
                      >
                        <td className="py-3 px-4 text-sm text-gray-900 whitespace-nowrap">
                          {formatDateCell(record.dateCompleted)}
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-900">
                          <div className="font-medium">{componentName}</div>
                          <div className="text-xs text-gray-500">{record.componentCode}</div>
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-900 max-w-[220px]">
                          <div className="truncate" title={record.jobTitle}>{record.jobTitle}</div>
                          {record.maintenanceType && (
                            <div className="text-xs text-gray-500">{record.maintenanceType}</div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-900">
                          {record.runningHoursAtCompletion
                            ? `${parseFloat(record.runningHoursAtCompletion).toLocaleString()} hrs`
                            : "-"}
                        </td>

                        <td className="py-3 px-4 text-sm">
                          {missedCycles > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800"
                              data-testid={`badge-missed-cycles-${record.id}`}
                            >
                              ⚠ {missedCycles} {missedCycles === 1 ? "cycle" : "cycles"}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-sm">
                          {backdatingDays > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800"
                              data-testid={`badge-backdating-${record.id}`}
                            >
                              ↩ {backdatingDays} {backdatingDays === 1 ? "day" : "days"}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-900">{record.performedBy || "-"}</td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(record.status)}`}
                          >
                            {record.status || "N/A"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing{" "}
              <span className="font-medium">{filteredRecords.length}</span>{" "}
              {filteredRecords.length === 1 ? "record" : "records"}
              {records.length !== filteredRecords.length && (
                <span className="text-gray-400"> (of {records.length} total)</span>
              )}
            </p>
            {filteredRecords.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>
                  Missed cycles
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span>
                  Backdated
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkHistory;
