import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface RHTimelineEntry {
  id: number;
  date: string;
  rhValue: number;
  change: number | null;
  hrsPerDay: number | null;
  source: string;
  sourceReference: string | null;
  status: string;
  enteredBy: string;
  notes: string | null;
}

interface RHTimelineViewerProps {
  machineryId: string;
  machineryName: string;
  machineryCode?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RHTimelineViewer({
  machineryId,
  machineryName,
  machineryCode,
  open,
  onOpenChange,
}: RHTimelineViewerProps) {
  const [dateFilter, setDateFilter] = useState("90");

  const dateFrom = (() => {
    const days = parseInt(dateFilter);
    if (isNaN(days) || days === 0) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  })();

  const { data: timeline = [], isLoading } = useQuery<RHTimelineEntry[]>({
    queryKey: ["/technical/api/running-hours/timeline", machineryId, dateFrom],
    queryFn: async () => {
      const params = new URLSearchParams({ machineryId });
      if (dateFrom) params.set("dateFrom", dateFrom);
      const res = await fetch(`/technical/api/running-hours/timeline?${params}`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
    enabled: open && !!machineryId,
  });

  const chartData = [...timeline].reverse().map((entry) => ({
    date: new Date(entry.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    rh: entry.rhValue,
    hrsPerDay: entry.hrsPerDay,
  }));

  const getStatusIcon = (status: string) => {
    if (status.includes("High")) return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />;
    if (status.includes("Decrease") || status.includes("❌")) return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  };

  const getStatusColor = (status: string) => {
    if (status.includes("High") || status.includes("⚠")) return "text-orange-600 bg-orange-50";
    if (status.includes("Decrease") || status.includes("❌")) return "text-red-600 bg-red-50";
    return "text-green-600 bg-green-50";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="rh-timeline-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="rh-timeline-title">
            <Clock className="h-5 w-5 text-blue-600" />
            Running Hours Timeline — {machineryName}
            {machineryCode && <span className="text-sm text-gray-500 font-normal">({machineryCode})</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filter:</span>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[160px] h-8 text-sm" data-testid="rh-timeline-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="60">Last 60 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="180">Last 6 Months</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
                <SelectItem value="0">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-gray-400">{timeline.length} entries</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12" data-testid="rh-timeline-loading">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading timeline...</span>
          </div>
        ) : timeline.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm" data-testid="rh-timeline-empty">
            No running hours entries found for this component.
          </div>
        ) : (
          <>
            {chartData.length > 1 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4" data-testid="rh-timeline-chart">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Running Hours Over Time
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: number) => [`${value.toFixed(1)} hrs`, "Running Hours"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="rh"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="overflow-x-auto" data-testid="rh-timeline-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-left">
                    <th className="py-2 px-2 font-medium text-gray-600 w-[15%]">Date</th>
                    <th className="py-2 px-2 font-medium text-gray-600 w-[12%] text-right">RH Value</th>
                    <th className="py-2 px-2 font-medium text-gray-600 w-[10%] text-right">Change</th>
                    <th className="py-2 px-2 font-medium text-gray-600 w-[10%] text-right">Hrs/Day</th>
                    <th className="py-2 px-2 font-medium text-gray-600 w-[18%]">Source</th>
                    <th className="py-2 px-2 font-medium text-gray-600 w-[15%]">Status</th>
                    <th className="py-2 px-2 font-medium text-gray-600 w-[20%]">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((entry, idx) => (
                    <tr
                      key={entry.id || idx}
                      className="border-b border-gray-100 hover:bg-gray-50"
                      data-testid={`rh-timeline-row-${idx}`}
                    >
                      <td className="py-2 px-2 text-gray-700">
                        {new Date(entry.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-gray-900">
                        {entry.rhValue.toFixed(1)} hrs
                      </td>
                      <td className="py-2 px-2 text-right">
                        {entry.change !== null ? (
                          <span className={entry.change >= 0 ? "text-green-600" : "text-red-600"}>
                            {entry.change >= 0 ? "+" : ""}{entry.change.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {entry.hrsPerDay !== null ? (
                          <span className={entry.hrsPerDay > 20 ? "text-orange-600 font-medium" : "text-gray-600"}>
                            {entry.hrsPerDay.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                          {entry.source}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${getStatusColor(entry.status)}`}>
                          {getStatusIcon(entry.status)}
                          {entry.status.replace(/[✅⚠️❌]/g, "").trim()}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-500 text-xs truncate max-w-[200px]" title={entry.notes || ""}>
                        {entry.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
