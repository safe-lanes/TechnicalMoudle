import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft, Package, TrendingDown, Activity, Calendar as CalendarIcon,
  AlertTriangle, FileText, Download, Loader2,
  ChevronDown, ChevronUp,
} from "lucide-react";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";

const MONTH_FULL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDateForDisplay = (d: Date | undefined) => {
  if (!d) return "";
  return `${d.getDate().toString().padStart(2, "0")} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
};

interface SparesConsumptionPatternReportProps {
  onBack: () => void;
  vesselId: string | null;
  initialDateFrom?: Date | null;
  initialDateTo?: Date | null;
  embedded?: boolean;
  globalVessels?: string[];
  globalComponent?: string;
}

type ActiveTab = "trends" | "items" | "categories" | "efficiency" | "forecast";

const PIE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const SparesConsumptionPatternReport: React.FC<SparesConsumptionPatternReportProps> = ({ onBack, vesselId, initialDateFrom, initialDateTo, embedded, globalVessels = [], globalComponent = "" }) => {
  const { toast } = useToast();

  const toDateStr = (d: Date | null | undefined) => d ? format(d, "yyyy-MM-dd") : "";
  const [dateFrom, setDateFrom] = useState<Date | undefined>(initialDateFrom ?? undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(initialDateTo ?? undefined);
  const [startDate, setStartDate] = useState(toDateStr(initialDateFrom));
  const [endDate, setEndDate] = useState(toDateStr(initialDateTo));
  const [category, setCategory] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ startDate: toDateStr(initialDateFrom), endDate: toDateStr(initialDateTo), category: "" });
  const [activeTab, setActiveTab] = useState<ActiveTab>("trends");
  const [nonMovingOpen, setNonMovingOpen] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<Date | undefined>(dateFrom);
  const [pendingTo, setPendingTo] = useState<Date | undefined>(dateTo);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const [pendingDateFrom, setPendingDateFrom] = useState<Date | undefined>(undefined);
  const [pendingDateTo, setPendingDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const newFrom = initialDateFrom ?? undefined;
    const newTo = initialDateTo ?? undefined;
    setDateFrom(newFrom);
    setDateTo(newTo);
    setPendingFrom(newFrom);
    setPendingTo(newTo);
    const sf = toDateStr(initialDateFrom);
    const ef = toDateStr(initialDateTo);
    setStartDate(sf);
    setEndDate(ef);
    setAppliedFilters(prev => ({ ...prev, startDate: sf, endDate: ef }));
  }, [initialDateFrom, initialDateTo]);

  const formatDateRange = () => {
    if (!dateFrom && !dateTo) return "Select date range";
    if (dateFrom && !dateTo) return `From ${format(dateFrom, "MMM dd, yyyy")}`;
    if (!dateFrom && dateTo) return `Until ${format(dateTo, "MMM dd, yyyy")}`;
    if (dateFrom && dateTo) return `${format(dateFrom, "MMM dd")} - ${format(dateTo, "MMM dd, yyyy")}`;
    return "Select date range";
  };

  const handleDateRangeApply = (from: Date | undefined, to: Date | undefined) => {
    setDateFrom(from);
    setDateTo(to);
    setStartDate(from ? format(from, "yyyy-MM-dd") : "");
    setEndDate(to ? format(to, "yyyy-MM-dd") : "");
  };

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
    if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);
    if (appliedFilters.category) params.set("category", appliedFilters.category);
    const qs = params.toString();
    return `/technical/api/reports/spares-consumption-analysis/${vesselId}${qs ? `?${qs}` : ""}`;
  }, [vesselId, appliedFilters]);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/technical/api/reports/spares-consumption-analysis", vesselId, appliedFilters],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!vesselId,
  });

  const summary = data?.summary;
  const consumptionTrends = useMemo(() => {
    return (data?.consumptionTrends || []).map((t: any) => ({
      ...t,
      spares: t.byType?.spares || 0,
    }));
  }, [data?.consumptionTrends]);
  const topConsumedItems = data?.topConsumedItems || [];
  const categoryBreakdown = data?.categoryBreakdown || [];
  const stockEfficiency = data?.stockEfficiency || [];
  const forecastData = data?.forecastData || [];
  const nonMovingItems = data?.nonMovingItems || [];


  const handleApplyFilters = () => {
    setAppliedFilters({ startDate, endDate, category });
  };

  const filteredItems = useMemo(() => {
    let items = [...topConsumedItems];
    if (globalVessels.length > 0) {
      items = items.filter((i: any) => !i.vesselId || globalVessels.includes(i.vesselId));
    }
    if (globalComponent && globalComponent.trim()) {
      const gc = globalComponent.toLowerCase();
      items = items.filter((i: Record<string, unknown>) =>
        ((i.itemCode as string) || '').toLowerCase().includes(gc) ||
        ((i.itemName as string) || '').toLowerCase().includes(gc) ||
        ((i.category as string) || '').toLowerCase().includes(gc)
      );
    }
    return items;
  }, [topConsumedItems, globalComponent, globalVessels]);

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!vesselId) return;
    setGeneratingPdf(true);
    try {
      const params = new URLSearchParams();
      if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);
      if (appliedFilters.category) params.set("category", appliedFilters.category);
      const qs = params.toString();
      const url = `/technical/api/reports/spares-consumption-analysis/${vesselId}${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const freshData = await res.json();

      const daysOfData = freshData.summary?.dataQuality?.daysOfData || 0;
      const confidence = daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low';

      pdfReportGenerator.generateConsumptionAnalysisPDF(
        {
          title: "Spares Consumption Pattern Analysis",
          vessel: vesselId,
          vesselName: freshData.summary?.vesselName || vesselId,
          orientation: "landscape",
          daysOfData,
          confidence,
        },
        {
          summary: freshData.summary,
          consumptionTrends: freshData.consumptionTrends || [],
          topConsumedItems: freshData.topConsumedItems || [],
          categoryBreakdown: freshData.categoryBreakdown || [],
          stockEfficiency: freshData.stockEfficiency || [],
          forecastData: freshData.forecastData || [],
          nonMovingItems: freshData.nonMovingItems || [],
        }
      );
      toast({ title: "PDF Generated", description: "Comprehensive 6-section report downloaded" });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!vesselId) return;
    setGeneratingExcel(true);
    try {
      const res = await fetch(`/technical/api/reports/spares-consumption-analysis/${vesselId}/excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
          category: appliedFilters.category || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate Excel");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spares-consumption-analysis-${vesselId}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Excel Generated", description: "Report downloaded successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to generate Excel report", variant: "destructive" });
    } finally {
      setGeneratingExcel(false);
    }
  };

  if (!vesselId) {
    return (
      <div className={embedded ? "p-4" : "bg-white min-h-screen p-6"}>
        {!embedded && (
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Spares Consumption Pattern Analysis</h1>
          </div>
        )}
        <Card><CardHeader><CardTitle>Please select a specific vessel</CardTitle><CardDescription>This report requires a specific vessel to be selected.</CardDescription></CardHeader></Card>
      </div>
    );
  }

  return (
    <div className={embedded ? "p-4 space-y-6" : "bg-white min-h-screen p-6 space-y-6"}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Spares Consumption Pattern Analysis</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={handleExportPdf} disabled={!data || generatingPdf || (summary?.totalConsumptionEvents ?? 0) === 0} data-testid="button-export-pdf">
              {generatingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />} PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={!data || generatingExcel || (summary?.totalConsumptionEvents ?? 0) === 0} data-testid="button-export-excel">
              {generatingExcel ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Excel
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <Label className="text-xs font-medium text-gray-500 mb-1 block">Date Range</Label>
          <Popover open={datePopoverOpen} onOpenChange={(isOpen) => {
            setDatePopoverOpen(isOpen);
            if (isOpen) {
              setPendingFrom(dateFrom);
              setPendingTo(dateTo);
              setShowFromCal(false);
              setShowToCal(false);
            }
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9",
                  !dateFrom && !dateTo && "text-muted-foreground"
                )}
                data-testid="button-consumption-date-range"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDateRange()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">From</div>
                  <Popover open={showFromCal} onOpenChange={(isOpen) => {
                    setShowFromCal(isOpen);
                    if (isOpen) setPendingDateFrom(pendingFrom);
                  }}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 w-full h-8 px-2 rounded-md border border-input bg-background text-xs cursor-pointer"
                        data-testid="button-consumption-date-from"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={pendingFrom ? "text-foreground" : "text-muted-foreground"}>
                          {pendingFrom ? formatDateForDisplay(pendingFrom) : "Select date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={pendingDateFrom}
                        onSelect={(d) => setPendingDateFrom(d || undefined)}
                        initialFocus
                      />
                      <div className="flex justify-end gap-2 p-3 pt-0 border-t mt-2">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowFromCal(false)} data-testid="button-consumption-date-from-cancel">Cancel</Button>
                        <Button size="sm" className="text-xs" onClick={() => { setPendingFrom(pendingDateFrom); setShowFromCal(false); }} data-testid="button-consumption-date-from-ok">OK</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">To</div>
                  <Popover open={showToCal} onOpenChange={(isOpen) => {
                    setShowToCal(isOpen);
                    if (isOpen) setPendingDateTo(pendingTo);
                  }}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 w-full h-8 px-2 rounded-md border border-input bg-background text-xs cursor-pointer"
                        data-testid="button-consumption-date-to"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={pendingTo ? "text-foreground" : "text-muted-foreground"}>
                          {pendingTo ? formatDateForDisplay(pendingTo) : "Select date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={pendingDateTo}
                        onSelect={(d) => setPendingDateTo(d || undefined)}
                        initialFocus
                      />
                      <div className="flex justify-end gap-2 p-3 pt-0 border-t mt-2">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowToCal(false)} data-testid="button-consumption-date-to-cancel">Cancel</Button>
                        <Button size="sm" className="text-xs" onClick={() => { setPendingTo(pendingDateTo); setShowToCal(false); }} data-testid="button-consumption-date-to-ok">OK</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => { handleDateRangeApply(undefined, undefined); setDatePopoverOpen(false); }} className="text-xs" data-testid="button-clear-consumption-date-range">Clear</Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDatePopoverOpen(false)} className="text-xs" data-testid="button-consumption-date-range-cancel">Cancel</Button>
                  <Button size="sm" className="text-xs" onClick={() => { handleDateRangeApply(pendingFrom, pendingTo); setDatePopoverOpen(false); }} data-testid="button-consumption-date-range-ok">OK</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 mb-1 block">Category</Label>
          <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="Filter by category..." className="border border-gray-300 rounded-md px-3 py-2 text-sm w-48 h-9" data-testid="input-category" />
        </div>
        <Button onClick={handleApplyFilters} data-testid="button-apply-filters" className="h-9">Apply Filters</Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-500">Loading spares consumption data...</span>
        </div>
      )}

      {error && (
        <Card><CardHeader><CardTitle className="text-red-600">Error Loading Data</CardTitle><CardDescription>{(error as Error).message}</CardDescription></CardHeader></Card>
      )}

      {!isLoading && !error && data && (
        <>
          {summary?.dataQuality?.isLimitedData && (
            <Card className="bg-amber-50 border-amber-300">
              <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-amber-800 text-sm">{summary.dataQuality.message}</CardTitle>
                </div>
                <Badge className="bg-amber-200 text-amber-800 border-amber-400">{summary.dataQuality.confidenceLevel}</Badge>
              </CardHeader>
            </Card>
          )}

          {!embedded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-items-consumed">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <div>
                    <CardDescription>Spares Consumed</CardDescription>
                    <CardTitle className="text-2xl">{summary?.totalItemsConsumed ?? 0} <span className="text-sm font-normal text-gray-500">/ {summary?.totalInventoryItems ?? 0}</span></CardTitle>
                  </div>
                  <Package className="h-8 w-8 text-blue-500" />
                </CardHeader>
              </Card>
              <Card data-testid="card-total-qty">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <div>
                    <CardDescription>Total Qty Consumed</CardDescription>
                    <CardTitle className="text-2xl">{Number(summary?.totalQuantityConsumed ?? 0).toLocaleString()}</CardTitle>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-500" />
                </CardHeader>
              </Card>
              <Card data-testid="card-events">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <div>
                    <CardDescription>Consumption Events</CardDescription>
                    <CardTitle className="text-2xl">{summary?.totalConsumptionEvents ?? 0}</CardTitle>
                  </div>
                  <Activity className="h-8 w-8 text-purple-500" />
                </CardHeader>
              </Card>
              <Card data-testid="card-data-period">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <div>
                    <CardDescription>Data Period</CardDescription>
                    <CardTitle className="text-2xl">{summary?.dataQuality?.daysOfData ?? 0} <span className="text-sm font-normal text-gray-500">days</span></CardTitle>
                    {summary?.dataQuality?.distinctEventDays != null && (
                      <p className="text-xs text-gray-500 mt-1">{summary.dataQuality.distinctEventDays} active day{summary.dataQuality.distinctEventDays !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                  <CalendarIcon className="h-8 w-8 text-green-500" />
                </CardHeader>
              </Card>
            </div>
          )}

          <div className="border-b border-gray-200">
            <div className="flex gap-0 overflow-x-auto">
              {([
                { key: "trends", label: "Consumption Trends" },
                { key: "items", label: "Item Analysis" },
                { key: "categories", label: "Category Analysis" },
                { key: "efficiency", label: "Stock Efficiency" },
                { key: "forecast", label: "Forecasting" },
              ] as { key: ActiveTab; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}
                  data-testid={`tab-${tab.key}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "trends" && (
            <div className="space-y-6">
              {consumptionTrends.length > 0 ? (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Monthly Consumption Trends</CardTitle></CardHeader>
                  <div className="px-6 pb-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={consumptionTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="totalQty" name="Total Qty" stroke="#1e40af" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              ) : (
                <p className="text-gray-500 text-center py-8">No trend data available</p>
              )}
              {consumptionTrends.length > 0 && (
                <ReportAgGridTable
                  columns={[
                    { header: "Month", field: "month" },
                    { header: "Total Qty", field: "totalQtyDisplay" },
                    { header: "Events", field: "eventCount" },
                    { header: "Item Count", field: "itemCount" },
                  ]}
                  data={consumptionTrends.map((t: any) => ({
                    ...t,
                    totalQtyDisplay: Number(t.totalQty).toLocaleString(),
                  }))}
                  height="300px"
                />
              )}
            </div>
          )}

          {activeTab === "items" && (
            <div className="space-y-6">
              {topConsumedItems.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Top 10 Consumed Spares</CardTitle></CardHeader>
                  <div className="px-6 pb-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topConsumedItems.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="itemCode" fontSize={10} angle={-30} textAnchor="end" height={60} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="totalConsumed" name="Total Consumed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
              {filteredItems.length > 0 ? (
                <ReportAgGridTable
                  columns={[
                    { header: "S.No", field: "sNo", width: 70 },
                    { header: "Part Code", field: "itemCode" },
                    { header: "Part Name", field: "itemNameDisplay" },
                    { header: "Component", field: "category" },
                    { header: "UOM", field: "uom" },
                    { header: "Total Consumed", field: "totalConsumedDisplay" },
                    { header: "Events", field: "eventCount" },
                    { header: "Avg Monthly", field: "avgMonthlyDisplay" },
                    { header: "ROB", field: "currentRob" },
                    { header: "Min", field: "minStock" },
                    { header: "Last Consumed", field: "lastConsumedDisplay" },
                  ]}
                  data={filteredItems.map((item: any, idx: number) => ({
                    sNo: idx + 1,
                    itemCode: item.itemCode,
                    itemNameDisplay: item.hasSingleEvent ? `${item.itemName} (1 event)` : item.itemName,
                    category: item.category,
                    uom: item.uom,
                    totalConsumedDisplay: Number(item.totalConsumed).toLocaleString(),
                    eventCount: item.eventCount,
                    avgMonthlyDisplay: item.adjustmentNote
                      ? `${Number(item.avgMonthlyConsumption || 0).toFixed(1)} *adjusted`
                      : Number(item.avgMonthlyConsumption || 0).toFixed(1),
                    currentRob: item.currentRob,
                    minStock: item.minStock,
                    lastConsumedDisplay: item.lastConsumedDate ? format(new Date(item.lastConsumedDate), "dd MMM yyyy") : "-",
                  }))}
                  height="500px"
                />
              ) : (
                <p className="text-gray-500 text-center py-8">No item data available</p>
              )}
            </div>
          )}

          {activeTab === "categories" && (
            <div className="space-y-6">
              {categoryBreakdown.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Category Distribution</CardTitle></CardHeader>
                  <div className="px-6 pb-6 flex justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={categoryBreakdown} dataKey="totalQty" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ category, percentage }: any) => `${category} (${Number(percentage).toFixed(1)}%)`}>
                          {categoryBreakdown.map((_: any, i: number) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
              {categoryBreakdown.length > 0 ? (
                <ReportAgGridTable
                  columns={[
                    { header: "Category", field: "category" },
                    { header: "Total Qty", field: "totalQtyDisplay" },
                    { header: "Items", field: "itemCount" },
                    { header: "% Share", field: "percentageDisplay" },
                  ]}
                  data={categoryBreakdown.map((c: any) => ({
                    category: c.category,
                    totalQtyDisplay: Number(c.totalQty).toLocaleString(),
                    itemCount: c.itemCount,
                    percentageDisplay: `${Number(c.percentage).toFixed(1)}%`,
                  }))}
                  height="300px"
                />
              ) : (
                <p className="text-gray-500 text-center py-8">No category data available</p>
              )}
            </div>
          )}

          {activeTab === "efficiency" && (
            <div className="space-y-6">
              {stockEfficiency.length > 0 ? (
                <>
                  <ReportAgGridTable
                    columns={[
                      { header: "S.No", field: "sNo", width: 70 },
                      { header: "Part Code", field: "itemCode" },
                      { header: "Part Name", field: "itemNameDisplay" },
                      { header: "ROB", field: "currentRob" },
                      { header: "Min", field: "minStock" },
                      { header: "Consumed", field: "totalConsumedDisplay" },
                      { header: "Turnover", field: "turnoverDisplay" },
                      { header: "Movement", field: "movementDisplay" },
                      { header: "Days to Stockout", field: "daysToStockoutDisplay" },
                      { header: "Below Min", field: "belowMinDisplay" },
                    ]}
                    data={stockEfficiency.map((item: any, idx: number) => {
                      const movementLabels: Record<string, string> = { fast: "Fast", slow: "Slow", "very-slow": "Very Slow", "non-moving": "Non-Moving" };
                      const movementText = movementLabels[item.movementSpeed] || item.movementSpeed || "-";
                      let daysText = "-";
                      if (item.movementSpeed === "non-moving") {
                        daysText = "\u221E";
                      } else if (item.daysUntilStockout != null) {
                        daysText = item.stockoutRange ? `${item.daysUntilStockout} (${item.stockoutRange.lower}-${item.stockoutRange.upper}d)` : String(item.daysUntilStockout);
                      }
                      return {
                        sNo: idx + 1,
                        itemCode: item.itemCode,
                        itemNameDisplay: item.negativeRob ? `${item.itemName} [Negative ROB]` : item.itemName,
                        currentRob: item.currentRob,
                        minStock: item.minStock,
                        totalConsumedDisplay: Number(item.totalConsumed).toLocaleString(),
                        turnoverDisplay: Number(item.stockTurnoverRatio || 0).toFixed(2),
                        movementDisplay: item.movementNote ? `${movementText} (${item.movementNote})` : movementText,
                        daysToStockoutDisplay: daysText,
                        belowMinDisplay: item.belowMinStock ? "Yes" : "No",
                      };
                    })}
                    height="500px"
                  />
                  <p className="text-xs text-gray-500 italic">Movement classification based on {summary?.dataQuality?.daysOfData || "N/A"}-day period ({summary?.dataQuality?.distinctEventDays || 0} active days)</p>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">No stock efficiency data available</p>
              )}

              {nonMovingItems.length > 0 && (
                <Collapsible open={nonMovingOpen} onOpenChange={setNonMovingOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" data-testid="button-non-moving-toggle">
                      <span>Non-Moving Spares ({nonMovingItems.length} items)</span>
                      {nonMovingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3">
                      <ReportAgGridTable
                        columns={[
                          { header: "S.No", field: "sNo", width: 70 },
                          { header: "Part Code", field: "itemCode" },
                          { header: "Part Name", field: "itemName" },
                          { header: "ROB", field: "currentRob" },
                          { header: "Min Stock", field: "minStock" },
                        ]}
                        data={nonMovingItems.map((item: any, idx: number) => ({
                          sNo: idx + 1,
                          itemCode: item.itemCode,
                          itemName: item.itemName,
                          currentRob: item.currentRob,
                          minStock: item.minStock,
                        }))}
                        height="300px"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {activeTab === "forecast" && (
            <div className="space-y-6">
              {forecastData.length > 0 ? (
                <>
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Reorder Recommendations</CardTitle></CardHeader>
                    <div className="px-6 pb-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={forecastData.filter((f: any) => f.reorderNeeded).slice(0, 15)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="itemCode" fontSize={10} angle={-30} textAnchor="end" height={60} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="currentRob" name="Current ROB" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="reorderPoint" name="Reorder Point" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="suggestedReorderQty" name="Suggested Order" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <ReportAgGridTable
                    columns={[
                      { header: "S.No", field: "sNo", width: 70 },
                      { header: "Part Code", field: "itemCode" },
                      { header: "Part Name", field: "itemName" },
                      { header: "UOM", field: "uom" },
                      { header: "Avg Monthly", field: "avgMonthlyDisplay" },
                      { header: "Projected", field: "projectedDisplay" },
                      { header: "ROB", field: "currentRob" },
                      { header: "Min", field: "minStock" },
                      { header: "Months Left", field: "monthsLeftDisplay" },
                      { header: "Reorder", field: "reorderDisplay" },
                      { header: "Suggested Qty", field: "suggestedQtyDisplay" },
                      { header: "Reasoning", field: "reorderReasoning" },
                    ]}
                    data={forecastData.map((item: any, idx: number) => ({
                      sNo: idx + 1,
                      itemCode: item.itemCode,
                      itemName: item.itemName,
                      uom: item.uom,
                      avgMonthlyDisplay: Number(item.avgMonthlyConsumption || 0).toFixed(1),
                      projectedDisplay: Number(item.projectedNextMonth || 0).toFixed(1),
                      currentRob: item.currentRob,
                      minStock: item.minStock,
                      monthsLeftDisplay: item.monthsOfStockRemaining != null ? String(item.monthsOfStockRemaining) : "-",
                      reorderDisplay: item.reorderNeeded ? "Yes" : "No",
                      suggestedQtyDisplay: item.suggestedReorderQty || "-",
                      reorderReasoning: item.reorderReasoning || "-",
                    }))}
                    height="500px"
                  />
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
                      <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-blue-800 text-sm">Confidence: {summary?.dataQuality?.confidenceLevel?.toUpperCase() || 'N/A'}</CardTitle>
                        <CardDescription className="text-blue-700 text-xs mt-1">
                          Forecasts based on {summary?.dataQuality?.daysOfData || 0} days of data ({summary?.dataQuality?.distinctEventDays || 0} active). {summary?.dataQuality?.isLimitedData ? 'Collect more data for accurate predictions.' : 'Sufficient data for reliable projections.'}
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">No forecast data available. Consumption data needed for projections.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SparesConsumptionPatternReport;
