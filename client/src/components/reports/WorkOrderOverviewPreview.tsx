import { useState, useMemo, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  ColSpanParams,
  ICellRendererParams,
  RowClassParams,
  GridReadyEvent,
  GridApi,
} from "ag-grid-community";
import { ModuleRegistry } from "ag-grid-community";
import {
  MenuModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  LicenseManager,
} from "ag-grid-enterprise";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";
import type { ReportColumn } from "@/components/reports/ReportPreviewModal";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

try {
  const licenseKey = import.meta.env.VITE_AG_GRID_LICENSE_KEY || import.meta.env.AG_GRID_LICENSE_KEY;
  if (licenseKey) LicenseManager.setLicenseKey(licenseKey);
} catch (_) {}

try {
  ModuleRegistry.registerModules([
    MenuModule,
    ColumnsToolPanelModule,
    FiltersToolPanelModule,
  ]);
} catch (_) {}

// ─── Types ───────────────────────────────────────────────────────────────────

interface WoOverviewCellData {
  count: number;
  isPct?: boolean;
  woIds: string[];
}

interface WoOverviewMonthMeta {
  label: string;
  yearMonth: string;
}

interface WoOverviewWoInfo {
  workOrderNo: string;
  jobTitle: string;
  status: string;
  componentName: string;
  dueDate: string | null;
}

export interface WorkOrderOverviewData {
  vesselName: string;
  anchorYear: number;
  anchorMonth: number;
  months: WoOverviewMonthMeta[];
  woInfo: Record<string, WoOverviewWoInfo>;
  matrix: {
    totalDue: WoOverviewCellData[];
    criticalDue: WoOverviewCellData[];
    nonCriticalDue: WoOverviewCellData[];
    completedTotal: WoOverviewCellData[];
    completedCritical: WoOverviewCellData[];
    completedNonCritical: WoOverviewCellData[];
    notCompletedTotal: WoOverviewCellData[];
    notCompletedCritical: WoOverviewCellData[];
    notCompletedNonCritical: WoOverviewCellData[];
    overdueTotal: WoOverviewCellData[];
    overdueCritical: WoOverviewCellData[];
    overdueNonCritical: WoOverviewCellData[];
    postponedTotal: WoOverviewCellData[];
    postponedCritical: WoOverviewCellData[];
    postponedNonCritical: WoOverviewCellData[];
    extendedPct: WoOverviewCellData[];
  };
}

interface WorkOrderOverviewPreviewProps {
  data: WorkOrderOverviewData;
  isLoading?: boolean;
  error?: string | null;
}

interface DrilldownState {
  label: string;
  monthLabel: string;
  woIds: string[];
}

type SectionKey = "due" | "completed" | "notCompleted" | "overdue" | "extended";

interface MatrixRow {
  rowId: string;
  rowType: "section" | "data";
  metric: string;
  sectionKey: SectionKey;
  bold: boolean;
  indent: boolean;
  cells: WoOverviewCellData[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Completed: "bg-green-100 text-green-800",
  Overdue: "bg-red-100 text-red-800",
  Postponed: "bg-purple-100 text-purple-800",
  Due: "bg-yellow-100 text-yellow-800",
  Active: "bg-blue-100 text-blue-800",
  "Due (Grace P)": "bg-orange-100 text-orange-800",
  "Pending Approval": "bg-gray-100 text-gray-800",
};

const SECTION_STYLES: Record<SectionKey, { headerBg: string; dataBg: string; text: string }> = {
  due:          { headerBg: "#BFD9EF", dataBg: "#E8F4FD", text: "#1a2e45" },
  completed:    { headerBg: "#A8DDB5", dataBg: "#E8F8F0", text: "#1a3a22" },
  notCompleted: { headerBg: "#FFCC80", dataBg: "#FFF3E0", text: "#5a3a00" },
  overdue:      { headerBg: "#FFAB91", dataBg: "#FFEBE8", text: "#5a1a0a" },
  extended:     { headerBg: "#CE93D8", dataBg: "#F3E8FF", text: "#3a0a5a" },
};

function formatDue(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "dd MMM yyyy");
  } catch {
    return dateStr;
  }
}

// ─── Cell Renderers ───────────────────────────────────────────────────────────

const MetricCellRenderer = (params: ICellRendererParams) => {
  const row: MatrixRow | undefined = params.data;
  if (!row) return null;

  if (row.rowType === "section") {
    const style = SECTION_STYLES[row.sectionKey];
    return (
      <div
        style={{
          fontWeight: 600,
          fontSize: "11px",
          color: style.text,
          display: "flex",
          alignItems: "center",
          height: "100%",
          paddingLeft: "12px",
          letterSpacing: "0.03em",
        }}
      >
        {row.metric}
      </div>
    );
  }

  return (
    <div
      style={{
        fontSize: "12px",
        fontWeight: row.bold ? 600 : 400,
        paddingLeft: row.indent ? "24px" : "12px",
        display: "flex",
        alignItems: "center",
        height: "100%",
        color: "#374151",
      }}
    >
      {row.metric}
    </div>
  );
};

const MonthCellRenderer = (params: ICellRendererParams) => {
  const row: MatrixRow | undefined = params.data;
  if (!row || row.rowType === "section") return null;

  const cell: WoOverviewCellData | undefined = params.value;
  if (!cell) return <span style={{ color: "#9ca3af" }}>—</span>;

  const { context } = params;
  const colIdx: number = params.colDef?.colId ? parseInt(params.colDef.colId.replace("m_", ""), 10) : -1;
  const monthLabel = context?.months?.[colIdx]?.label ?? "";

  if (cell.isPct) {
    return (
      <span style={{ fontStyle: "italic", fontSize: "12px", color: "#374151", fontWeight: row.bold ? 600 : 400 }}>
        {cell.count}%
      </span>
    );
  }

  if (cell.count === 0) {
    return <span style={{ color: "#9ca3af" }}>—</span>;
  }

  const clickable = cell.woIds.length > 0;
  const handleClick = () => {
    if (clickable && context?.openDrilldown) {
      context.openDrilldown(row.metric, monthLabel, cell);
    }
  };

  return (
    <span
      onClick={handleClick}
      style={{
        color: clickable ? "#1d4ed8" : "#374151",
        textDecoration: clickable ? "underline" : "none",
        textDecorationStyle: "dotted",
        cursor: clickable ? "pointer" : "default",
        fontWeight: row.bold ? 600 : 400,
        fontSize: "12px",
      }}
      data-testid={`wo-overview-cell-${row.metric.replace(/\s+/g, "-")}-${monthLabel}`}
    >
      {cell.count}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkOrderOverviewPreview({ data, isLoading, error }: WorkOrderOverviewPreviewProps) {
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const gridApiRef = useRef<GridApi | null>(null);

  const openDrilldown = useCallback((label: string, monthLabel: string, cell: WoOverviewCellData) => {
    if (cell.count === 0 || cell.woIds.length === 0) return;
    setDrilldown({ label, monthLabel, woIds: cell.woIds });
  }, []);

  const { months, matrix, woInfo } = data ?? { months: [], matrix: {} as WorkOrderOverviewData["matrix"], woInfo: {} };

  // Build flat row data: section header rows + data rows
  const rowData: MatrixRow[] = useMemo(() => {
    if (!months?.length || !matrix) return [];

    const mk = (
      rowId: string,
      metric: string,
      sectionKey: SectionKey,
      cells: WoOverviewCellData[],
      bold = false,
      indent = false
    ): MatrixRow => ({ rowId, rowType: "data", metric, sectionKey, bold, indent, cells });

    const sec = (rowId: string, metric: string, sectionKey: SectionKey): MatrixRow => ({
      rowId, rowType: "section", metric, sectionKey, bold: false, indent: false, cells: [],
    });

    return [
      sec("s1", "SECTION 1 — WORK ORDERS DUE", "due"),
      mk("totalDue",        "Total WOs Due",           "due",  matrix.totalDue,        true,  false),
      mk("criticalDue",     "Critical WOs Due",        "due",  matrix.criticalDue,     false, true),
      mk("nonCriticalDue",  "Non-Critical WOs Due",    "due",  matrix.nonCriticalDue,  false, true),

      sec("s2", "SECTION 2 — COMPLETED", "completed"),
      mk("compTotal",    "Completed (Total)",     "completed", matrix.completedTotal,       true,  false),
      mk("compCrit",     "Completed (Critical)",  "completed", matrix.completedCritical,    false, true),
      mk("compNonCrit",  "Completed (Non-Crit.)", "completed", matrix.completedNonCritical, false, true),

      sec("s3", "SECTION 3 — NOT COMPLETED", "notCompleted"),
      mk("ncTotal",    "Not Completed (Total)",      "notCompleted", matrix.notCompletedTotal,       true,  false),
      mk("ncCrit",     "Not Completed (Critical)",   "notCompleted", matrix.notCompletedCritical,    false, true),
      mk("ncNonCrit",  "Not Completed (Non-Crit.)",  "notCompleted", matrix.notCompletedNonCritical, false, true),

      sec("s4", "SECTION 4 — OVERDUE %", "overdue"),
      mk("ovdTotal",    "Overdue % (Total)",      "overdue", matrix.overdueTotal,       true,  false),
      mk("ovdCrit",     "Overdue % (Critical)",   "overdue", matrix.overdueCritical,    false, true),
      mk("ovdNonCrit",  "Overdue % (Non-Crit.)",  "overdue", matrix.overdueNonCritical, false, true),

      sec("s5", "SECTION 5 — EXTENDED (POSTPONED)", "extended"),
      mk("extTotal",    "Extended Total",          "extended", matrix.postponedTotal,       true,  false),
      mk("extCrit",     "Extended (Critical)",     "extended", matrix.postponedCritical,    false, true),
      mk("extNonCrit",  "Extended (Non-Crit.)",    "extended", matrix.postponedNonCritical, false, true),
      mk("extPct",      "Extended %",              "extended", matrix.extendedPct,          true,  false),
    ];
  }, [months, matrix]);

  // Column definitions
  const columnDefs: ColDef[] = useMemo(() => {
    const metricCol: ColDef = {
      headerName: "Metric",
      field: "metric",
      colId: "metric",
      pinned: "left",
      minWidth: 210,
      maxWidth: 260,
      flex: 0,
      sortable: false,
      resizable: true,
      filter: false,
      suppressMovable: true,
      suppressHeaderFilterButton: true,
      menuTabs: [],
      cellRenderer: MetricCellRenderer,
      cellStyle: { padding: 0, border: "none" },
      headerClass: "wo-overview-metric-header",
      // Span all month columns for section header rows
      colSpan: (params: ColSpanParams) => {
        if (params.data?.rowType === "section") return 1 + months.length;
        return 1;
      },
    };

    const monthCols: ColDef[] = months.map((m, i) => ({
      headerName: m.label,
      colId: `m_${i}`,
      field: `cells`,
      minWidth: 75,
      maxWidth: 110,
      flex: 1,
      sortable: false,
      resizable: true,
      filter: false,
      suppressMovable: true,
      suppressHeaderFilterButton: true,
      menuTabs: [],
      cellRenderer: MonthCellRenderer,
      cellStyle: { display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: "none" },
      headerClass: "wo-overview-month-header",
      valueGetter: (params) => params.data?.cells?.[i],
    }));

    return [metricCol, ...monthCols];
  }, [months]);

  // Row styling: section header vs data rows
  const getRowStyle = useCallback((params: RowClassParams) => {
    const row: MatrixRow | undefined = params.data;
    if (!row) return undefined;
    const s = SECTION_STYLES[row.sectionKey];
    if (row.rowType === "section") {
      return { background: s.headerBg, borderBottom: "1px solid rgba(0,0,0,0.12)" };
    }
    return { background: s.dataBg, borderBottom: "1px solid rgba(0,0,0,0.06)" };
  }, []);

  const getRowHeight = useCallback((params: any) => {
    return params.data?.rowType === "section" ? 30 : 32;
  }, []);

  const onGridReady = useCallback((e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  }, []);

  const gridContext = useMemo(() => ({ openDrilldown, months }), [openDrilldown, months]);

  // Drilldown rows for the dialog
  const drilldownWos = useMemo(() => {
    if (!drilldown) return [];
    return drilldown.woIds.map((id, idx) => ({
      sno: idx + 1,
      id,
      ...(woInfo[id] ?? {}),
      formattedDueDate: formatDue(woInfo[id]?.dueDate ?? null),
    })).filter((w) => w.workOrderNo);
  }, [drilldown, woInfo]);

  const drilldownColumns: ReportColumn[] = useMemo(() => [
    { header: "S.No",      field: "sno",              width: 60,  flex: 0 },
    { header: "WO Number", field: "workOrderNo",       width: 160 },
    { header: "Job Title", field: "jobTitle",          width: 200 },
    { header: "Component", field: "componentName",     width: 180 },
    { header: "Due Date",  field: "formattedDueDate",  width: 120 },
    {
      header: "Status",
      field: "status",
      width: 130,
      cellRenderer: (params: ICellRendererParams) => {
        const status: string = params.value ?? "";
        return (
          <Badge className={`text-[10px] px-1.5 py-0.5 ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
            {status}
          </Badge>
        );
      },
    },
  ], []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-gray-500">
        <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-sm">Loading Work Orders Overview…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
        Failed to load report: {error}
      </div>
    );
  }

  return (
    <div className="p-1 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-800">Work Orders Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            12-month rolling matrix · {data.vesselName} · {months[0]?.label} – {months[months.length - 1]?.label}
          </p>
        </div>
        <p className="text-[10px] text-gray-400 italic">Click any count to see the work orders</p>
      </div>

      {/* AG Grid Matrix */}
      <div
        className="ag-theme-alpine report-ag-grid wo-overview-grid"
        style={{ width: "100%", minHeight: "560px" }}
      >
        <style>{`
          .wo-overview-grid .ag-header-cell.wo-overview-metric-header {
            background-color: #1E3A5F;
            color: white;
            font-size: 12px;
            font-weight: 600;
          }
          .wo-overview-grid .ag-header-cell.wo-overview-month-header {
            background-color: #1E3A5F;
            color: white;
            font-size: 11px;
            font-weight: 600;
            text-align: center;
          }
          .wo-overview-grid .ag-header-cell.wo-overview-month-header .ag-header-cell-label {
            justify-content: center;
          }
          .wo-overview-grid .ag-row {
            border-bottom: none;
          }
          .wo-overview-grid .ag-cell {
            border-right: none !important;
          }
          .wo-overview-grid .ag-pinned-left-cols-container .ag-cell {
            border-right: 1px solid rgba(0,0,0,0.12) !important;
          }
          .wo-overview-grid .ag-header {
            border-bottom: 2px solid #1E3A5F;
          }
          .wo-overview-grid .ag-header-cell {
            border-right: 1px solid rgba(255,255,255,0.15);
          }
        `}</style>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: false, filter: false, resizable: true }}
          getRowStyle={getRowStyle}
          getRowHeight={getRowHeight}
          getRowId={(params) => params.data.rowId}
          onGridReady={onGridReady}
          context={gridContext}
          suppressHorizontalScroll={false}
          suppressMovableColumns={true}
          suppressCellFocus={true}
          enableCellTextSelection={true}
          animateRows={false}
          headerHeight={36}
          domLayout="autoHeight"
          reactiveCustomComponents={true}
          theme="legacy"
        />
      </div>

      {/* Footer */}
      <div className="px-2 py-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500 italic">
        Critical = criticality "Yes" OR job priority "Critical".
        Overdue % = (Overdue ÷ Total Due) × 100. Extended % = (Postponed ÷ Total Due) × 100.
        Overdue classification uses computed status (grace/lead-time aware). Completed counts by actual completion month.
      </div>

      {/* Drilldown Dialog — AG Grid powered */}
      <Dialog open={!!drilldown} onOpenChange={() => setDrilldown(null)}>
        <DialogContent className="max-w-4xl h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {drilldown?.label} — {drilldown?.monthLabel}
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({drilldownWos.length} work order{drilldownWos.length !== 1 ? "s" : ""})
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden min-h-[300px]">
            <ReportAgGridTable
              columns={drilldownColumns}
              data={drilldownWos}
              height="100%"
              rowHeight={34}
              headerHeight={36}
              testId="wo-overview-drilldown-grid"
              noRowsMessage="No work orders found for this selection."
              getRowId={(params) => params.data.id}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
