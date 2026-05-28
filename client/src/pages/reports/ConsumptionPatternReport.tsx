import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft, Package, TrendingDown, Activity, Calendar,
  AlertTriangle, FileText, Download, Loader2,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";

interface ConsumptionPatternReportProps {
  onBack: () => void;
  vesselId: string | null;
  embedded?: boolean;
  globalVessels?: string[];
  globalComponent?: string;
  globalDateFrom?: Date | null;
  globalDateTo?: Date | null;
}

type ActiveTab = "trends" | "items" | "categories" | "efficiency" | "forecast";

const PIE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const ConsumptionPatternReport: React.FC<ConsumptionPatternReportProps> = ({ onBack, vesselId, embedded, globalVessels = [], globalComponent = "" }) => {
  const { toast } = useToast();

  const [itemType, setItemType] = useState("all");
  const [category, setCategory] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ itemType: "all", category: "" });
  const [activeTab, setActiveTab] = useState<ActiveTab>("trends");
  const [nonMovingOpen, setNonMovingOpen] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);


  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.itemType && appliedFilters.itemType !== "all") params.set("itemType", appliedFilters.itemType);
    if (appliedFilters.category) params.set("category", appliedFilters.category);
    const qs = params.toString();
    return `/technical/api/reports/stores-consumption-analysis/${vesselId}${qs ? `?${qs}` : ""}`;
  }, [vesselId, appliedFilters]);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/technical/api/reports/stores-consumption-analysis", vesselId, appliedFilters],
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
      stores: t.byType?.stores || 0,
      lubricants: t.byType?.lubricants || 0,
      chemicals: t.byType?.chemicals || 0,
      others: t.byType?.others || 0,
    }));
  }, [data?.consumptionTrends]);
  const topConsumedItems = data?.topConsumedItems || [];
  const categoryBreakdown = data?.categoryBreakdown || [];
  const stockEfficiency = data?.stockEfficiency || [];
  const forecastData = data?.forecastData || [];
  const nonMovingItems = data?.nonMovingItems || [];

  const handleApplyFilters = () => {
    setAppliedFilters({ itemType, category });
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
      if (appliedFilters.itemType && appliedFilters.itemType !== "all") params.set("itemType", appliedFilters.itemType);
      if (appliedFilters.category) params.set("category", appliedFilters.category);
      const qs = params.toString();
      const url = `/technical/api/reports/stores-consumption-analysis/${vesselId}${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const freshData = await res.json();

      const daysOfData = freshData.summary?.dataQuality?.daysOfData || 0;
      const confidence = daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low';

      pdfReportGenerator.generateConsumptionAnalysisPDF(
        {
          title: "Consumption Pattern Analysis",
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
      const res = await fetch(`/technical/api/reports/stores-consumption-analysis/${vesselId}/excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          itemType: appliedFilters.itemType !== "all" ? appliedFilters.itemType : undefined,
          category: appliedFilters.category || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate Excel");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consumption-analysis-${vesselId}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
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

  const trendsColumns = [
    { header: "Month", field: "month" },
    { header: "Total Qty", field: "totalQty" },
    { header: "Events", field: "eventCount" },
    { header: "Item Count", field: "itemCount" },
    { header: "Stores", field: "stores" },
    { header: "Lubricants", field: "lubricants" },
    { header: "Chemicals", field: "chemicals" },
    { header: "Others", field: "others" },
  ];

  const trendsData = useMemo(() => {
    return consumptionTrends.map((t: any) => ({
      month: t.month,
      totalQty: Number(t.totalQty).toLocaleString(),
      eventCount: t.eventCount,
      itemCount: t.itemCount,
      stores: t.stores,
      lubricants: t.lubricants,
      chemicals: t.chemicals,
      others: t.others,
    }));
  }, [consumptionTrends]);

  const itemsColumns = [
    { header: "S.No", field: "sNo", width: 70 },
    { header: "Item Code", field: "itemCode" },
    { header: "Item Name", field: "itemName" },
    { header: "Type", field: "itemType" },
    { header: "Category", field: "category" },
    { header: "UOM", field: "uom" },
    { header: "Total Consumed", field: "totalConsumed" },
    { header: "Events", field: "eventCount" },
    { header: "Avg Monthly", field: "avgMonthlyConsumption" },
    { header: "ROB", field: "currentRob" },
    { header: "Min", field: "minStock" },
    { header: "Last Consumed", field: "lastConsumedDate" },
  ];

  const itemsData = useMemo(() => {
    return filteredItems.map((item: any, idx: number) => ({
      sNo: idx + 1,
      itemCode: item.itemCode,
      itemName: item.itemName + (item.hasSingleEvent ? " (1 event)" : ""),
      itemType: item.itemType,
      category: item.category,
      uom: item.uom,
      totalConsumed: Number(item.totalConsumed).toLocaleString(),
      eventCount: item.eventCount,
      avgMonthlyConsumption: Number(item.avgMonthlyConsumption || 0).toFixed(1) + (item.adjustmentNote ? " *adjusted" : ""),
      currentRob: item.currentRob,
      minStock: item.minStock,
      lastConsumedDate: item.lastConsumedDate ? format(new Date(item.lastConsumedDate), "dd MMM yyyy") : "-",
    }));
  }, [filteredItems]);

  const categoryColumns = [
    { header: "Category", field: "category" },
    { header: "Type", field: "itemType" },
    { header: "Total Qty", field: "totalQty" },
    { header: "Items", field: "itemCount" },
    { header: "% Share", field: "percentage" },
  ];

  const categoryData = useMemo(() => {
    return categoryBreakdown.map((c: any) => ({
      category: c.category,
      itemType: c.itemType,
      totalQty: Number(c.totalQty).toLocaleString(),
      itemCount: c.itemCount,
      percentage: Number(c.percentage).toFixed(1) + "%",
    }));
  }, [categoryBreakdown]);

  const efficiencyColumns = [
    { header: "S.No", field: "sNo", width: 70 },
    { header: "Item Code", field: "itemCode" },
    { header: "Item Name", field: "itemName" },
    { header: "Type", field: "itemType" },
    { header: "ROB", field: "currentRob" },
    { header: "Min", field: "minStock" },
    { header: "Consumed", field: "totalConsumed" },
    { header: "Turnover", field: "turnover" },
    { header: "Movement", field: "movement" },
    { header: "Days to Stockout", field: "daysToStockout" },
    { header: "Below Min", field: "belowMin" },
  ];

  const efficiencyData = useMemo(() => {
    return stockEfficiency.map((item: any, idx: number) => {
      let movement = item.movementSpeed || "-";
      if (movement === "fast") movement = "Fast";
      else if (movement === "slow") movement = "Slow";
      else if (movement === "very-slow") movement = "Very Slow";
      else if (movement === "non-moving") movement = "Non-Moving";
      if (item.movementNote) movement += ` (${item.movementNote})`;

      let daysToStockout = "-";
      if (item.movementSpeed === "non-moving") {
        daysToStockout = "\u221E";
      } else if (item.daysUntilStockout != null) {
        daysToStockout = String(item.daysUntilStockout);
        if (item.stockoutRange) {
          daysToStockout += ` (${item.stockoutRange.lower}-${item.stockoutRange.upper}d)`;
        }
      }

      return {
        sNo: idx + 1,
        itemCode: item.itemCode,
        itemName: item.itemName + (item.negativeRob ? " [Negative ROB]" : ""),
        itemType: item.itemType,
        currentRob: item.currentRob,
        minStock: item.minStock,
        totalConsumed: Number(item.totalConsumed).toLocaleString(),
        turnover: Number(item.stockTurnoverRatio || 0).toFixed(2),
        movement,
        daysToStockout,
        belowMin: item.belowMinStock ? "Yes" : "No",
      };
    });
  }, [stockEfficiency]);

  const nonMovingColumns = [
    { header: "S.No", field: "sNo", width: 70 },
    { header: "Item Code", field: "itemCode" },
    { header: "Item Name", field: "itemName" },
    { header: "Type", field: "itemType" },
    { header: "ROB", field: "currentRob" },
    { header: "Min", field: "minStock" },
  ];

  const nonMovingData = useMemo(() => {
    return nonMovingItems.map((item: any, idx: number) => ({
      sNo: idx + 1,
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemType: item.itemType,
      currentRob: item.currentRob,
      minStock: item.minStock,
    }));
  }, [nonMovingItems]);

  const forecastColumns = [
    { header: "S.No", field: "sNo", width: 70 },
    { header: "Item Code", field: "itemCode" },
    { header: "Item Name", field: "itemName" },
    { header: "UOM", field: "uom" },
    { header: "Avg Monthly", field: "avgMonthly" },
    { header: "Projected", field: "projected" },
    { header: "ROB", field: "currentRob" },
    { header: "Min", field: "minStock" },
    { header: "Reorder Pt", field: "reorderPoint" },
    { header: "Months Left", field: "monthsLeft" },
    { header: "Reorder?", field: "reorderNeeded" },
    { header: "Suggested Qty", field: "suggestedQty" },
    { header: "Confidence", field: "confidence" },
  ];

  const forecastTableData = useMemo(() => {
    return forecastData.map((f: any, idx: number) => {
      let avgMonthly = Number(f.avgMonthlyConsumption || 0).toFixed(1);
      if (f.rawAvgMonthlyConsumption && f.rawAvgMonthlyConsumption !== f.avgMonthlyConsumption) {
        avgMonthly += ` (raw: ${Number(f.rawAvgMonthlyConsumption).toFixed(1)})`;
      }

      let confidence = "-";
      if (f.confidenceLevel === "high") confidence = "High";
      else if (f.confidenceLevel === "medium") confidence = "Medium";
      else if (f.confidenceLevel === "low") confidence = "Low";

      return {
        sNo: idx + 1,
        itemCode: f.itemCode,
        itemName: f.itemName + (f.reorderReasoning && f.reorderNeeded ? ` (${f.reorderReasoning})` : ""),
        uom: f.uom,
        avgMonthly,
        projected: Number(f.projectedNextMonth || 0).toFixed(1),
        currentRob: f.currentRob,
        minStock: f.minStock,
        reorderPoint: f.reorderPoint != null ? Number(f.reorderPoint).toFixed(0) : "-",
        monthsLeft: f.monthsOfStockRemaining != null ? Number(f.monthsOfStockRemaining).toFixed(1) : "-",
        reorderNeeded: f.reorderNeeded ? "Yes" : "No",
        suggestedQty: f.suggestedReorderQty || "-",
        confidence,
      };
    });
  }, [forecastData]);

  if (!vesselId) {
    return (
      <div className={embedded ? "p-4" : "bg-white min-h-screen p-6"}>
        {!embedded && (
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Consumption Pattern Analysis</h1>
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
            <h1 className="text-2xl font-bold text-gray-900">Consumption Pattern Analysis</h1>
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
          <Select value={itemType} onValueChange={setItemType}>
            <SelectTrigger className="w-40" data-testid="select-item-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="stores">Stores</SelectItem>
              <SelectItem value="lubricants">Lubricants</SelectItem>
              <SelectItem value="chemicals">Chemicals</SelectItem>
              <SelectItem value="others">Others</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleApplyFilters} data-testid="button-apply-filters">Apply Filters</Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-500">Loading consumption data...</span>
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
                    <CardDescription>Items Consumed</CardDescription>
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
                  </div>
                  <Calendar className="h-8 w-8 text-green-500" />
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
                        <Line type="monotone" dataKey="totalQty" name="Total" stroke="#1e40af" strokeWidth={2} />
                        <Line type="monotone" dataKey="stores" name="Stores" stroke="#3b82f6" />
                        <Line type="monotone" dataKey="lubricants" name="Lubricants" stroke="#ef4444" />
                        <Line type="monotone" dataKey="chemicals" name="Chemicals" stroke="#22c55e" />
                        <Line type="monotone" dataKey="others" name="Others" stroke="#f59e0b" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              ) : (
                <p className="text-gray-500 text-center py-8">No trend data available</p>
              )}
              {consumptionTrends.length > 0 && (
                <ReportAgGridTable
                  reportId="stores-consumption-analysis"
                  columns={trendsColumns}
                  data={trendsData}
                  height="400px"
                />
              )}
            </div>
          )}

          {activeTab === "items" && (
            <div className="space-y-6">
              {topConsumedItems.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Top 10 Consumed Items</CardTitle></CardHeader>
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
                  reportId="stores-consumption-analysis"
                  columns={itemsColumns}
                  data={itemsData}
                  height="60vh"
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
                  <div className="px-6 pb-6 flex flex-col md:flex-row gap-4 items-center">
                    <div className="w-full md:w-[55%]">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={categoryBreakdown} dataKey="totalQty" nameKey="category" cx="50%" cy="50%" outerRadius={110}>
                            {categoryBreakdown.map((_: any, i: number) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={({ active, payload }: any) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
                                  <p className="font-medium text-gray-900 dark:text-gray-100">{d.category}</p>
                                  <p className="text-gray-600 dark:text-gray-400">Qty: {Number(d.totalQty).toLocaleString()}</p>
                                  <p className="text-gray-600 dark:text-gray-400">Share: {Number(d.percentage).toFixed(1)}%</p>
                                </div>
                              );
                            }
                            return null;
                          }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-[45%] max-h-[300px] overflow-y-auto pr-2">
                      <div className="space-y-2">
                        {categoryBreakdown.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm" data-testid={`legend-item-${i}`}>
                            <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-gray-700 dark:text-gray-300 truncate">{item.category}</span>
                            <span className="text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">({Number(item.percentage).toFixed(1)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              {categoryBreakdown.length > 0 ? (
                <ReportAgGridTable
                  reportId="stores-consumption-analysis"
                  columns={categoryColumns}
                  data={categoryData}
                  height="400px"
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
                    reportId="stores-consumption-analysis"
                    columns={efficiencyColumns}
                    data={efficiencyData}
                    height="60vh"
                  />
                  <p className="text-xs text-gray-500 italic">Movement classification based on {summary?.dataQuality?.daysOfData || "N/A"}-day sample period</p>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">No stock efficiency data available</p>
              )}

              {nonMovingItems.length > 0 && (
                <Collapsible open={nonMovingOpen} onOpenChange={setNonMovingOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" data-testid="button-non-moving-toggle">
                      <span>Non-Moving Items ({nonMovingItems.length} items)</span>
                      {nonMovingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3">
                      <ReportAgGridTable
                        reportId="stores-consumption-analysis"
                        columns={nonMovingColumns}
                        data={nonMovingData}
                        height="400px"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {activeTab === "forecast" && (
            <div className="space-y-6">
              {forecastData.some((f: any) => f.confidenceLevel === "low") && (
                <Card className="bg-amber-50 border-amber-300">
                  <CardHeader className="flex flex-row items-center gap-2 flex-wrap">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <CardTitle className="text-sm text-amber-800">Some forecasts have low confidence due to limited data. Use with caution.</CardTitle>
                  </CardHeader>
                </Card>
              )}
              {forecastData.length > 0 ? (
                <ReportAgGridTable
                  reportId="stores-consumption-analysis"
                  columns={forecastColumns}
                  data={forecastTableData}
                  height="60vh"
                />
              ) : (
                <p className="text-gray-500 text-center py-8">No forecast data available</p>
              )}
            </div>
          )}
        </>
      )}

      {!isLoading && !error && !data && (
        <div className="text-center py-20 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No consumption data found</p>
          <p className="text-sm">Try adjusting the date range or filters</p>
        </div>
      )}
    </div>
  );
};

export default ConsumptionPatternReport;
