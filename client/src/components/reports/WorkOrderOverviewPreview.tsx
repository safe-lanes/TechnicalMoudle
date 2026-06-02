import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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

const STATUS_COLORS: Record<string, string> = {
  Completed: "bg-green-100 text-green-800",
  Overdue: "bg-red-100 text-red-800",
  Postponed: "bg-purple-100 text-purple-800",
  Due: "bg-yellow-100 text-yellow-800",
  Active: "bg-blue-100 text-blue-800",
  "Due (Grace P)": "bg-orange-100 text-orange-800",
  "Pending Approval": "bg-gray-100 text-gray-800",
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

const SECTION_COLORS = {
  due:          { header: "bg-[#BFD9EF]", data: "bg-[#E8F4FD]", hover: "hover:bg-[#d0e8f5]" },
  completed:    { header: "bg-[#A8DDB5]", data: "bg-[#E8F8F0]", hover: "hover:bg-[#cef2d8]" },
  notCompleted: { header: "bg-[#FFCC80]", data: "bg-[#FFF3E0]", hover: "hover:bg-[#ffe8b8]" },
  overdue:      { header: "bg-[#FFAB91]", data: "bg-[#FFEBE8]", hover: "hover:bg-[#ffd0c8]" },
  extended:     { header: "bg-[#CE93D8]", data: "bg-[#F3E8FF]", hover: "hover:bg-[#e8d0f8]" },
};

export default function WorkOrderOverviewPreview({ data, isLoading, error }: WorkOrderOverviewPreviewProps) {
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);

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

  const { months, matrix, woInfo } = data;

  const openDrilldown = (cellLabel: string, monthLabel: string, cell: WoOverviewCellData) => {
    if (cell.count === 0 || cell.woIds.length === 0) return;
    setDrilldown({ label: cellLabel, monthLabel, woIds: cell.woIds });
  };

  const renderCell = (
    cell: WoOverviewCellData,
    rowLabel: string,
    monthLabel: string,
    sectionKey: keyof typeof SECTION_COLORS,
    bold = false
  ) => {
    const { data: dataBg, hover } = SECTION_COLORS[sectionKey];
    const clickable = cell.count > 0 && !cell.isPct;
    const display = cell.isPct
      ? <span className={bold ? "font-bold" : ""}>{cell.count}%</span>
      : cell.count === 0
        ? <span className="text-gray-400">—</span>
        : <span className={`${bold ? "font-bold" : ""} ${clickable ? "underline decoration-dotted cursor-pointer text-blue-700" : ""}`}>{cell.count}</span>;

    return (
      <td
        key={monthLabel}
        className={`text-center px-2 py-1.5 text-xs border-b border-gray-200 ${dataBg} ${clickable ? `${hover} cursor-pointer` : ""}`}
        onClick={() => clickable && openDrilldown(rowLabel, monthLabel, cell)}
        data-testid={`wo-overview-cell-${rowLabel.replace(/\s+/g, '-')}-${monthLabel}`}
      >
        {display}
      </td>
    );
  };

  const SectionHeader = ({ label, sectionKey }: { label: string; sectionKey: keyof typeof SECTION_COLORS }) => (
    <tr>
      <td
        colSpan={months.length + 1}
        className={`px-3 py-1.5 text-xs font-semibold text-gray-800 border-b border-gray-300 ${SECTION_COLORS[sectionKey].header}`}
      >
        {label}
      </td>
    </tr>
  );

  const DataRow = ({
    label,
    cells,
    sectionKey,
    bold = false,
    indent = false,
  }: {
    label: string;
    cells: WoOverviewCellData[];
    sectionKey: keyof typeof SECTION_COLORS;
    bold?: boolean;
    indent?: boolean;
  }) => (
    <tr>
      <td
        className={`px-3 py-1.5 text-xs border-b border-gray-200 border-r border-r-gray-300 sticky left-0 z-10 ${SECTION_COLORS[sectionKey].data} ${bold ? "font-semibold" : ""} ${indent ? "pl-6" : ""}`}
        style={{ minWidth: "200px", maxWidth: "200px" }}
      >
        {label}
      </td>
      {cells.map((cell, i) => renderCell(cell, label, months[i].label, sectionKey, bold))}
    </tr>
  );

  const drilldownWos = drilldown
    ? drilldown.woIds.map(id => ({ id, ...woInfo[id] })).filter(w => w.workOrderNo)
    : [];

  return (
    <div className="p-1">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-800">Work Orders Overview</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              12-month rolling matrix · {data.vesselName} · {months[0]?.label} – {months[11]?.label}
            </p>
          </div>
          <p className="text-[10px] text-gray-400 italic">
            Click any count to see the work orders
          </p>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-sm">
        <table className="border-collapse text-xs" style={{ minWidth: `${200 + months.length * 90}px` }}>
          <thead>
            <tr className="bg-[#1E3A5F] text-white">
              <th
                className="px-3 py-2 text-left font-semibold sticky left-0 z-20 bg-[#1E3A5F] border-r border-blue-400"
                style={{ minWidth: "200px", maxWidth: "200px" }}
              >
                Metric
              </th>
              {months.map(m => (
                <th key={m.yearMonth} className="px-2 py-2 text-center font-semibold" style={{ minWidth: "80px" }}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Section 1: Due */}
            <SectionHeader label="SECTION 1 — WORK ORDERS DUE" sectionKey="due" />
            <DataRow label="Total WOs Due"         cells={matrix.totalDue}       sectionKey="due"  bold />
            <DataRow label="Critical WOs Due"      cells={matrix.criticalDue}    sectionKey="due"  indent />
            <DataRow label="Non-Critical WOs Due"  cells={matrix.nonCriticalDue} sectionKey="due"  indent />

            {/* Section 2: Completed */}
            <SectionHeader label="SECTION 2 — COMPLETED" sectionKey="completed" />
            <DataRow label="Completed (Total)"       cells={matrix.completedTotal}       sectionKey="completed" bold />
            <DataRow label="Completed (Critical)"    cells={matrix.completedCritical}    sectionKey="completed" indent />
            <DataRow label="Completed (Non-Crit.)"   cells={matrix.completedNonCritical} sectionKey="completed" indent />

            {/* Section 3: Not Completed */}
            <SectionHeader label="SECTION 3 — NOT COMPLETED" sectionKey="notCompleted" />
            <DataRow label="Not Completed (Total)"      cells={matrix.notCompletedTotal}       sectionKey="notCompleted" bold />
            <DataRow label="Not Completed (Critical)"   cells={matrix.notCompletedCritical}    sectionKey="notCompleted" indent />
            <DataRow label="Not Completed (Non-Crit.)"  cells={matrix.notCompletedNonCritical} sectionKey="notCompleted" indent />

            {/* Section 4: Overdue % */}
            <SectionHeader label="SECTION 4 — OVERDUE %" sectionKey="overdue" />
            <DataRow label="Overdue % (Total)"      cells={matrix.overdueTotal}       sectionKey="overdue" bold />
            <DataRow label="Overdue % (Critical)"   cells={matrix.overdueCritical}    sectionKey="overdue" indent />
            <DataRow label="Overdue % (Non-Crit.)"  cells={matrix.overdueNonCritical} sectionKey="overdue" indent />

            {/* Section 5: Extended (Postponed) */}
            <SectionHeader label="SECTION 5 — EXTENDED (POSTPONED)" sectionKey="extended" />
            <DataRow label="Extended Total"          cells={matrix.postponedTotal}       sectionKey="extended" bold />
            <DataRow label="Extended (Critical)"     cells={matrix.postponedCritical}    sectionKey="extended" indent />
            <DataRow label="Extended (Non-Crit.)"    cells={matrix.postponedNonCritical} sectionKey="extended" indent />
            <DataRow label="Extended %"              cells={matrix.extendedPct}          sectionKey="extended" bold />
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-gray-400 mt-2 italic">
        Critical = criticality "Yes" OR job priority "Critical". Overdue % = (Overdue ÷ Total Due) × 100.
        Extended % = (Postponed ÷ Total Due) × 100. Past months: all non-completed WOs counted as overdue.
      </p>

      {/* Drilldown Dialog */}
      <Dialog open={!!drilldown} onOpenChange={() => setDrilldown(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {drilldown?.label} — {drilldown?.monthLabel}
              <span className="ml-2 text-xs font-normal text-gray-500">({drilldownWos.length} work orders)</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {drilldownWos.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No work orders found.</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-[#1E3A5F] text-white">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">#</th>
                    <th className="px-3 py-2 text-left font-semibold">WO Number</th>
                    <th className="px-3 py-2 text-left font-semibold">Job Title</th>
                    <th className="px-3 py-2 text-left font-semibold">Component</th>
                    <th className="px-3 py-2 text-left font-semibold">Due Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownWos.map((wo, idx) => (
                    <tr
                      key={wo.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      data-testid={`drilldown-wo-row-${wo.id}`}
                    >
                      <td className="px-3 py-1.5 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-mono text-blue-700">{wo.workOrderNo}</td>
                      <td className="px-3 py-1.5">{wo.jobTitle}</td>
                      <td className="px-3 py-1.5 text-gray-600">{wo.componentName}</td>
                      <td className="px-3 py-1.5 text-gray-600">{formatDue(wo.dueDate)}</td>
                      <td className="px-3 py-1.5">
                        <Badge className={`text-[10px] px-1.5 py-0.5 ${STATUS_COLORS[wo.status] || "bg-gray-100 text-gray-700"}`}>
                          {wo.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer note */}
      <div className="mt-3 px-2 py-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500 italic">
        Vessel with ≥ 0% jobs pending on the selected month. Critical = criticality &quot;Yes&quot; OR job priority &quot;Critical&quot;.
        Overdue % = (Overdue ÷ Total Due) × 100. Extended % = (Postponed ÷ Total Due) × 100.
        Overdue classification uses computed status (grace/lead-time aware). Completed counts by actual completion month.
      </div>
    </div>
  );
}
