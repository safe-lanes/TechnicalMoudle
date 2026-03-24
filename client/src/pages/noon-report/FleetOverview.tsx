import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVessel } from "@/contexts/VesselContext";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Ship,
  AlertTriangle,
  Activity,
  Droplets,
  Clock,
  Search,
  ArrowRight,
  CheckCircle,
  FileText,
  TrendingDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VesselFleetSummary {
  vesselId: string;
  lastReportDate: string | null;
  lastVoyageNo: string | null;
  lastPortFrom: string | null;
  lastPortTo: string | null;
  lastCiiRating: string | null;
  lastCondition: string | null;
  totalReports: number;
  submittedReports: number;
  activeAlerts: number;
  totalHfoRob: number;
  totalAllRob: number;
  avg7DayConsumption: number | null;
  enduranceDays: number | null;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const ciiConfig: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: "bg-green-100", text: "text-green-700", label: "A" },
  B: { bg: "bg-emerald-100", text: "text-emerald-700", label: "B" },
  C: { bg: "bg-yellow-100", text: "text-yellow-700", label: "C" },
  D: { bg: "bg-orange-100", text: "text-orange-700", label: "D" },
  E: { bg: "bg-red-100", text: "text-red-700", label: "E" },
};

function CiiBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span className="text-gray-400 text-sm">—</span>;
  const cfg = ciiConfig[rating] ?? { bg: "bg-gray-100", text: "text-gray-600", label: rating };
  return (
    <Badge className={`${cfg.bg} ${cfg.text} border-0 text-xs font-bold px-2`}>
      {cfg.label}
    </Badge>
  );
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-gray-400 text-sm">No data</span>;
  if (days === 0) return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Today</Badge>;
  if (days <= 1) return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Yesterday</Badge>;
  if (days <= 3) return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">{days}d ago</Badge>;
  if (days <= 7) return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">{days}d ago</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-0 text-xs">{days}d ago</Badge>;
}

function fmt(v: number | null | undefined, dp = 1): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(dp);
}

// ── Fleet KPI Tiles ───────────────────────────────────────────────────────────

interface FleetKpiTileProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}

function FleetKpiTile({ label, value, sub, icon, color }: FleetKpiTileProps) {
  return (
    <Card className="border border-gray-200 shadow-none">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Vessel Row ────────────────────────────────────────────────────────────────

interface VesselRowProps {
  vessel: { id: string; name: string };
  summary: VesselFleetSummary | undefined;
  isSelected: boolean;
  onNavigate: () => void;
}

function VesselRow({ vessel, summary, isSelected, onNavigate }: VesselRowProps) {
  const days = daysSince(summary?.lastReportDate ?? null);
  const hasData = summary && summary.totalReports > 0;

  return (
    <TableRow
      className={`hover:bg-gray-50 transition-colors ${isSelected ? "bg-blue-50/50" : ""}`}
      data-testid={`row-fleet-${vessel.id}`}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Ship className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{vessel.name}</p>
            {isSelected && (
              <p className="text-xs text-blue-600 font-medium">Selected vessel</p>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <DaysBadge days={days} />
        {summary?.lastReportDate && (
          <p className="text-xs text-gray-400 mt-0.5">{summary.lastReportDate}</p>
        )}
      </TableCell>

      <TableCell className="text-sm text-gray-600">
        {summary?.lastVoyageNo ?? "—"}
      </TableCell>

      <TableCell className="text-sm text-gray-600">
        {summary?.lastPortFrom && summary?.lastPortTo
          ? `${summary.lastPortFrom} → ${summary.lastPortTo}`
          : summary?.lastPortFrom ?? summary?.lastPortTo ?? "—"}
      </TableCell>

      <TableCell className="text-sm text-gray-600 capitalize">
        {summary?.lastCondition ?? "—"}
      </TableCell>

      <TableCell>
        <CiiBadge rating={summary?.lastCiiRating ?? null} />
      </TableCell>

      <TableCell className="text-sm text-right">
        {hasData ? (
          <div>
            <span className="font-medium text-gray-800">{fmt(summary!.totalAllRob, 0)} MT</span>
            <p className="text-xs text-gray-400">HFO: {fmt(summary!.totalHfoRob, 0)}</p>
          </div>
        ) : <span className="text-gray-400">—</span>}
      </TableCell>

      <TableCell className="text-sm text-right">
        {summary?.enduranceDays !== null && summary?.enduranceDays !== undefined ? (
          <span className={`font-medium ${summary.enduranceDays < 7 ? "text-red-600" : summary.enduranceDays < 14 ? "text-amber-600" : "text-gray-800"}`}>
            {fmt(summary.enduranceDays, 0)} d
          </span>
        ) : <span className="text-gray-400">—</span>}
      </TableCell>

      <TableCell className="text-center">
        {summary && summary.activeAlerts > 0 ? (
          <Badge className="bg-red-100 text-red-700 border-0 text-xs gap-1">
            <AlertTriangle className="h-3 w-3" />
            {summary.activeAlerts}
          </Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">0</Badge>
        )}
      </TableCell>

      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          {hasData ? (
            <span className="text-xs text-gray-600">
              <span className="font-medium text-green-700">{summary!.submittedReports}</span>
              <span className="text-gray-400">/{summary!.totalReports}</span>
            </span>
          ) : (
            <span className="text-xs text-gray-400">0</span>
          )}
        </div>
      </TableCell>

      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={onNavigate}
          data-testid={`btn-vessel-nav-${vessel.id}`}
        >
          View <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FleetOverview() {
  const { vesselId, setVesselId, vessels } = useVessel();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const vesselIds = useMemo(() => vessels.map((v) => v.id), [vessels]);

  const { data: fleetData = [], isLoading } = useQuery<VesselFleetSummary[]>({
    queryKey: ["/technical/api/nr-fleet-summary", vesselIds.join(",")],
    queryFn: () =>
      fetch(`/technical/api/nr-fleet-summary?vesselIds=${vesselIds.join(",")}`).then(r => r.json()),
    enabled: vesselIds.length > 0,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const summaryMap = useMemo(() => {
    const map: Record<string, VesselFleetSummary> = {};
    for (const item of fleetData) map[item.vesselId] = item;
    return map;
  }, [fleetData]);

  const filteredVessels = useMemo(
    () =>
      vessels.filter((v) =>
        !search || v.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [vessels, search],
  );

  // Fleet-wide aggregates
  const fleetTotals = useMemo(() => {
    const active = fleetData.filter(d => d.totalReports > 0);
    return {
      totalReports: fleetData.reduce((s, d) => s + d.totalReports, 0),
      totalAlerts: fleetData.reduce((s, d) => s + d.activeAlerts, 0),
      totalRob: fleetData.reduce((s, d) => s + d.totalAllRob, 0),
      vesselsActive: active.length,
      avgEndurance: active.length > 0
        ? active.filter(d => d.enduranceDays !== null).reduce((s, d) => s + (d.enduranceDays ?? 0), 0) / Math.max(1, active.filter(d => d.enduranceDays !== null).length)
        : null,
    };
  }, [fleetData]);

  function navigateToVessel(id: string) {
    setVesselId(id);
    setLocation("/noon-report/history");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Fleet Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Noon report status and fuel KPIs across all vessels
        </p>
      </div>

      {/* Fleet KPI tiles */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FleetKpiTile
            label="Active Vessels"
            value={`${fleetTotals.vesselsActive} / ${vessels.length}`}
            sub="with noon report data"
            icon={<Ship className="h-5 w-5 text-blue-600" />}
            color="text-blue-700"
          />
          <FleetKpiTile
            label="Total Reports"
            value={fleetTotals.totalReports}
            sub="across fleet"
            icon={<FileText className="h-5 w-5 text-green-600" />}
            color="text-green-700"
          />
          <FleetKpiTile
            label="Total Fleet ROB"
            value={`${fleetTotals.totalRob.toFixed(0)} MT`}
            sub="all fuel types combined"
            icon={<Droplets className="h-5 w-5 text-indigo-600" />}
            color="text-indigo-700"
          />
          <FleetKpiTile
            label="Active Alerts"
            value={fleetTotals.totalAlerts}
            sub={fleetTotals.totalAlerts > 0 ? "requires attention" : "all clear"}
            icon={<AlertTriangle className={`h-5 w-5 ${fleetTotals.totalAlerts > 0 ? "text-red-500" : "text-gray-400"}`} />}
            color={fleetTotals.totalAlerts > 0 ? "text-red-600" : "text-gray-600"}
          />
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vessels…"
            className="pl-9 h-9 text-sm"
            data-testid="input-vessel-search"
          />
        </div>
        <span className="text-sm text-gray-400">
          {filteredVessels.length} of {vessels.length} vessels
        </span>
      </div>

      {/* Vessel Table */}
      <Card className="border border-gray-200 shadow-none overflow-hidden">
        <CardHeader className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            Vessel Status — {filteredVessels.length} vessel{filteredVessels.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>

        {vessels.length === 0 ? (
          <CardContent className="py-12 text-center text-sm text-gray-400">
            No vessels available.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold text-gray-600 min-w-[160px]">Vessel</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 min-w-[110px]">Last Report</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Voyage</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 min-w-[160px]">Route</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Condition</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-center">CII</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">ROB</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">Endurance</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-center">Alerts</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-center">Reports</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 11 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filteredVessels.map((vessel) => (
                      <VesselRow
                        key={vessel.id}
                        vessel={vessel}
                        summary={summaryMap[vessel.id]}
                        isSelected={vessel.id === vesselId}
                        onNavigate={() => navigateToVessel(vessel.id)}
                      />
                    ))
                }
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-400 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span><span className="text-yellow-600 font-medium">Yellow</span> = 4–7 days old | <span className="text-red-600 font-medium">Red</span> = 8+ days old</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5" />
          <span>Endurance: <span className="text-red-600 font-medium">&lt;7d</span> = critical | <span className="text-amber-600 font-medium">&lt;14d</span> = low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Reports: <span className="text-green-600 font-medium">submitted</span>/total</span>
        </div>
      </div>
    </div>
  );
}
