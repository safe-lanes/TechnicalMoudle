import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { VesselContext } from "@/contexts/VesselContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ScatterChart,
  Scatter,
  ResponsiveContainer,
} from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Droplets, Gauge, BarChart3, Zap } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  robByFuelType: Record<string, number>;
  enduranceDays: Record<string, number | null>;
  avg7DayByFuel: Record<string, number | null>;
  totalEnduranceDays: number | null;
  totalEnduranceNM: number | null;
  avg7DayConsumption: number;
  avg7DaySpeed: number;
  ciiRating: string | null;
  aer: number | null;
  ciiRefLine: number | null;
  ytdDistanceNm: number | null;
  ytdCo2Mt: number | null;
  minBunkerToNextPort: number | null;
  recommendedBunker: number | null;
  safetyMarginPct: number;
  distanceToGo: number | null;
  hasData: boolean;
  last30DaysConsumption: Array<{
    date: string;
    hfo: number;
    lsmgo: number;
    mgo: number;
    vlsfo: number;
    lpg: number;
    total: number;
    avg7Day: number;
  }>;
  speedConsumptionData: Array<{ speed: number; consumption: number; date: string }>;
}

type FuelKey = "hfo" | "lsmgo" | "mgo" | "vlsfo" | "lpg";

const FUEL_LABELS: Record<FuelKey, string> = {
  hfo: "HFO",
  lsmgo: "LSMGO",
  mgo: "MGO",
  vlsfo: "VLSFO",
  lpg: "LPG",
};

const FUEL_COLORS: Record<FuelKey, string> = {
  hfo: "#1e40af",
  lsmgo: "#0891b2",
  mgo: "#7c3aed",
  vlsfo: "#0f766e",
  lpg: "#b45309",
};

// ── Recharts tooltip payload types ────────────────────────────────────────────

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  name: string;
  color: string;
  payload: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function robBadge(enduranceDays: number | null) {
  if (enduranceDays === null) return { label: "No data", color: "bg-gray-100 text-gray-500 border-gray-200" };
  if (enduranceDays < 5) return { label: "Critical", color: "bg-red-100 text-red-700 border-red-200" };
  if (enduranceDays < 10) return { label: "Low", color: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "OK", color: "bg-green-100 text-green-700 border-green-200" };
}

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(decimals);
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return d;
  }
}

// ── CII Gauge ─────────────────────────────────────────────────────────────────

const CII_BANDS: Array<{ rating: string; color: string }> = [
  { rating: "A", color: "#166534" },
  { rating: "B", color: "#16a34a" },
  { rating: "C", color: "#d97706" },
  { rating: "D", color: "#ea580c" },
  { rating: "E", color: "#dc2626" },
];

function CIIGauge({
  ciiRating,
  aer,
  ciiRefLine,
  ytdDistanceNm,
}: {
  ciiRating: string | null;
  aer: number | null;
  ciiRefLine: number | null;
  ytdDistanceNm: number | null;
}) {
  const noData = ciiRating === null;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" data-testid="cii-gauge">
      {noData ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-2 cursor-default">
                <span className="text-4xl font-bold text-gray-400" data-testid="cii-rating-display">N/A</span>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Info className="h-3 w-3" />
                  <span>CII unavailable</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-48 text-xs">
                Vessel DWT not configured — AER cannot be calculated. Contact your fleet manager to set vessel deadweight.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <>
          <span
            className="text-5xl font-black"
            style={{ color: CII_BANDS.find(b => b.rating === ciiRating)?.color ?? "#6b7280" }}
            data-testid="cii-rating-display"
          >
            {ciiRating}
          </span>
          <p className="text-xs text-gray-500">Current CII Rating</p>
        </>
      )}

      {/* 5-segment horizontal band */}
      <div className="flex items-end gap-1 w-full max-w-xs" data-testid="cii-band-bar">
        {CII_BANDS.map(band => {
          const isActive = ciiRating === band.rating;
          return (
            <div key={band.rating} className="flex-1 flex flex-col items-center gap-0.5">
              {isActive && (
                <div
                  className="w-0 h-0"
                  style={{
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: `8px solid ${band.color}`,
                  }}
                />
              )}
              <div
                className="w-full rounded-sm flex items-center justify-center text-white text-xs font-bold"
                style={{
                  backgroundColor: band.color,
                  height: isActive ? "40px" : "28px",
                  transition: "height 0.2s",
                  boxShadow: isActive ? `0 0 6px ${band.color}88` : "none",
                }}
                data-testid={`cii-band-${band.rating}${isActive ? "-active" : ""}`}
              >
                {band.rating}
              </div>
            </div>
          );
        })}
      </div>

      {/* AER, reference line, and YTD info */}
      <div className="text-xs text-gray-500 text-center space-y-0.5 mt-1">
        {aer !== null && (
          <p data-testid="cii-aer-value">AER: {aer.toFixed(4)} g CO₂/t·NM</p>
        )}
        {ciiRefLine !== null && (
          <p data-testid="cii-ref-line">Ref. line: {ciiRefLine.toFixed(4)} g CO₂/t·NM</p>
        )}
        {ytdDistanceNm !== null && (
          <p data-testid="cii-ytd-distance">YTD Distance: {Math.round(ytdDistanceNm).toLocaleString()} NM</p>
        )}
      </div>
    </div>
  );
}

// ── ROB Status Cards ──────────────────────────────────────────────────────────

function RobCard({
  fuelKey,
  rob,
  enduranceDays,
}: {
  fuelKey: FuelKey;
  rob: number;
  enduranceDays: number | null;
}) {
  const badge = robBadge(enduranceDays);
  const hasData = rob > 0 || enduranceDays !== null;

  return (
    <Card className="flex-1 min-w-[140px]" data-testid={`rob-card-${fuelKey}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{FUEL_LABELS[fuelKey]}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${badge.color}`}
            data-testid={`rob-badge-${fuelKey}`}
          >
            {badge.label}
          </span>
        </div>
        {!hasData ? (
          <p className="text-sm text-gray-400 mt-1" data-testid={`rob-nodata-${fuelKey}`}>No data</p>
        ) : (
          <>
            <p
              className="text-2xl font-bold mt-0.5"
              style={{ color: FUEL_COLORS[fuelKey] }}
              data-testid={`rob-value-${fuelKey}`}
            >
              {fmt(rob, 1)} <span className="text-sm font-medium text-gray-400">MT</span>
            </p>
            <p className="text-xs text-gray-400 mt-1" data-testid={`rob-endurance-${fuelKey}`}>
              {enduranceDays !== null ? `${fmt(enduranceDays, 1)} days endurance` : "Endurance: N/A"}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Custom Chart Tooltips ─────────────────────────────────────────────────────

function ScatterTooltipContent({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as { date?: string; speed?: number; consumption?: number };
  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm p-2 text-xs">
      <p className="font-medium">{d?.date ? fmtDate(d.date) : ""}</p>
      <p>Speed: {fmt(d?.speed)} kn</p>
      <p>Consumption: {fmt(d?.consumption)} MT/day</p>
    </div>
  );
}

function TrendTooltipContent({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm p-2 text-xs space-y-0.5">
      <p className="font-semibold">{fmtDate(label ?? "")}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)} MT
        </p>
      ))}
    </div>
  );
}

// ── Loading Skeletons ─────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FuelDashboard() {
  const vesselCtx = useContext(VesselContext);
  const vesselId = vesselCtx?.vesselId ?? "";

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/technical/api/nr-fuel-dashboard", vesselId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/nr-fuel-dashboard/${vesselId}`);
      if (!res.ok) throw new Error("Failed to fetch fuel dashboard");
      return res.json() as Promise<DashboardData>;
    },
    enabled: !!vesselId && vesselId !== 'all' && vesselId !== 'my',
    refetchInterval: 60_000,
  });

  const fuelKeys: FuelKey[] = ["hfo", "lsmgo", "mgo", "vlsfo", "lpg"];

  // Bunker planning card border
  const enduranceDays = data?.totalEnduranceDays ?? null;
  let bunkerBorder = "border";
  if (enduranceDays !== null) {
    if (enduranceDays < 5) bunkerBorder = "border-2 border-red-500";
    else if (enduranceDays < 10) bunkerBorder = "border-2 border-amber-400";
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="fuel-dashboard">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Fuel Dashboard</h1>
        {(!vesselId || vesselId === 'all' || vesselId === 'my') && (
          <p className="text-sm text-amber-600">Select a vessel to view the dashboard.</p>
        )}
      </div>

      {/* ── Row 1: ROB Status Cards ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Droplets className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Fuel ROB Status</h2>
        </div>
        <div className="flex gap-3 flex-wrap">
          {isLoading
            ? fuelKeys.map(k => <CardSkeleton key={k} />)
            : fuelKeys.map(fuelKey => (
                <RobCard
                  key={fuelKey}
                  fuelKey={fuelKey}
                  rob={data?.robByFuelType?.[fuelKey] ?? 0}
                  enduranceDays={data?.enduranceDays?.[fuelKey] ?? null}
                />
              ))}
        </div>
      </div>

      {/* ── Row 2: Trend Chart (60%) + CII Gauge (40%) ──────────────────────── */}
      <div className="flex gap-4 flex-wrap">
        {/* Consumption Trend */}
        <Card className="flex-[3] min-w-[320px]" data-testid="consumption-trend-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-600">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              30-Day Consumption Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !data?.hasData || data.last30DaysConsumption.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400" data-testid="trend-empty-state">
                Submit your first noon report to see fuel trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={data.last30DaysConsumption}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} unit=" MT" width={48} />
                  <ReTooltip content={<TrendTooltipContent />} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Daily Total"
                    stroke="#1e40af"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg7Day"
                    name="7-Day Avg"
                    stroke="#93c5fd"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* CII Gauge */}
        <Card className="flex-[2] min-w-[260px]" data-testid="cii-gauge-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-600">
              <Gauge className="h-4 w-4 text-blue-600" />
              CII Rating (Year-to-Date)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <div className="h-48">
                <CIIGauge
                  ciiRating={data?.ciiRating ?? null}
                  aer={data?.aer ?? null}
                  ciiRefLine={data?.ciiRefLine ?? null}
                  ytdDistanceNm={data?.ytdDistanceNm ?? null}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Bunker Planning Card ──────────────────────────────────────── */}
      <Card className={bunkerBorder} data-testid="bunker-planning-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <Zap className="h-4 w-4 text-blue-600" />
            Bunker Planning
            {enduranceDays !== null && enduranceDays < 5 && (
              <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                Critical — Low Fuel
              </span>
            )}
            {enduranceDays !== null && enduranceDays >= 5 && enduranceDays < 10 && (
              <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                Warning — Low Fuel
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-0.5" data-testid="bunker-total-endurance-days">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Endurance</p>
                <p className="text-2xl font-bold text-gray-800">
                  {fmt(enduranceDays)}
                  <span className="text-sm font-medium text-gray-400 ml-1">days</span>
                </p>
              </div>
              <div className="space-y-0.5" data-testid="bunker-total-endurance-nm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Endurance (NM)</p>
                <p className="text-2xl font-bold text-gray-800">
                  {data?.totalEnduranceNM !== null && data?.totalEnduranceNM !== undefined
                    ? Math.round(data.totalEnduranceNM).toLocaleString()
                    : "—"}
                  <span className="text-sm font-medium text-gray-400 ml-1">NM</span>
                </p>
              </div>
              <div className="space-y-0.5" data-testid="bunker-min-next-port">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Min to Next Port</p>
                <p className="text-2xl font-bold text-gray-800">
                  {fmt(data?.minBunkerToNextPort ?? null)}
                  <span className="text-sm font-medium text-gray-400 ml-1">MT</span>
                </p>
                {data?.distanceToGo === null && (
                  <p className="text-xs text-gray-400">No distance to go set</p>
                )}
              </div>
              <div className="space-y-0.5" data-testid="bunker-recommended">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Recommended (+{data?.safetyMarginPct ?? 15}% margin)
                </p>
                <p className="text-2xl font-bold text-gray-800">
                  {fmt(data?.recommendedBunker ?? null)}
                  <span className="text-sm font-medium text-gray-400 ml-1">MT</span>
                </p>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">Based on 7-day average consumption</p>
        </CardContent>
      </Card>

      {/* ── Row 4: Speed vs Consumption Scatter ─────────────────────────────── */}
      <Card data-testid="speed-consumption-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600">
            Speed vs. Fuel Consumption (Historical)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !data?.hasData || data.speedConsumptionData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400" data-testid="scatter-empty-state">
              No data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="speed"
                  type="number"
                  name="Speed"
                  unit=" kn"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  label={{ value: "Speed (kn)", position: "insideBottom", offset: -2, fontSize: 10 }}
                />
                <YAxis
                  dataKey="consumption"
                  type="number"
                  name="Consumption"
                  unit=" MT"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  width={52}
                />
                <ReTooltip content={<ScatterTooltipContent />} />
                <Scatter
                  data={data.speedConsumptionData}
                  fill="#3b82f6"
                  opacity={0.75}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
