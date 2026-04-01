import { useState, useMemo, useEffect, Fragment } from "react";
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
  AlertTriangle, FileText, Download, Loader2, ArrowUpDown,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { TablePagination, usePagination } from "@/components/reports/TablePagination";

interface ConsumptionPatternReportProps {
  onBack: () => void;
  vesselId: string | null;
  embedded?: boolean;
  globalVessels?: string[];
  globalComponent?: string;
}

type ActiveTab = "trends" | "items" | "categories" | "efficiency" | "forecast";
type SortField = "itemCode" | "itemName" | "itemType" | "category" | "uom" | "totalConsumed" | "eventCount" | "avgMonthlyConsumption" | "currentRob" | "minStock" | "lastConsumedDate";
type SortDirection = "asc" | "desc";

const PIE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const ConsumptionPatternReport: React.FC<ConsumptionPatternReportProps> = ({ onBack, vesselId, embedded, globalVessels = [], globalComponent = "" }) => {
  const { toast } = useToast();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [itemType, setItemType] = useState("all");
  const [category, setCategory] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ startDate: "", endDate: "", itemType: "all", category: "" });
  const [activeTab, setActiveTab] = useState<ActiveTab>("trends");
  const [sortField, setSortField] = useState<SortField>("totalConsumed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [nonMovingOpen, setNonMovingOpen] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, resetPage, paginateItems } = usePagination(25);

  useEffect(() => {
    resetPage();
  }, [activeTab, appliedFilters]);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
    if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);
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
  const recentTransactions = data?.recentTransactions || [];

  const handleApplyFilters = () => {
    setAppliedFilters({ startDate, endDate, itemType, category });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedItems = useMemo(() => {
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
    items.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return items;
  }, [topConsumedItems, sortField, sortDirection, globalComponent, globalVessels]);

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!vesselId) return;
    setGeneratingPdf(true);
    try {
      const params = new URLSearchParams();
      if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);
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
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
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

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  );

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
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" data-testid="input-start-date" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" data-testid="input-end-date" />
        </div>
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
                <div className="overflow-x-auto">
                  <table className="w-full rounded-lg border border-gray-200 overflow-hidden bg-white" data-testid="table-trends">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Events</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Count</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stores</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lubricants</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chemicals</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Others</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {consumptionTrends.map((t: any, i: number) => (
                        <tr key={i} className="text-sm">
                          <td className="px-3 py-2 font-medium">{t.month}</td>
                          <td className="px-3 py-2">{Number(t.totalQty).toLocaleString()}</td>
                          <td className="px-3 py-2">{t.eventCount}</td>
                          <td className="px-3 py-2">{t.itemCount}</td>
                          <td className="px-3 py-2">{t.stores}</td>
                          <td className="px-3 py-2">{t.lubricants}</td>
                          <td className="px-3 py-2">{t.chemicals}</td>
                          <td className="px-3 py-2">{t.others}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
              {sortedItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full rounded-lg border border-gray-200 overflow-hidden bg-white" data-testid="table-items">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                        <SortHeader field="itemCode" label="Item Code" />
                        <SortHeader field="itemName" label="Item Name" />
                        <SortHeader field="itemType" label="Type" />
                        <SortHeader field="category" label="Category" />
                        <SortHeader field="uom" label="UOM" />
                        <SortHeader field="totalConsumed" label="Total Consumed" />
                        <SortHeader field="eventCount" label="Events" />
                        <SortHeader field="avgMonthlyConsumption" label="Avg Monthly" />
                        <SortHeader field="currentRob" label="ROB" />
                        <SortHeader field="minStock" label="Min" />
                        <SortHeader field="lastConsumedDate" label="Last Consumed" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginateItems(sortedItems).map((item: any, idx: number) => {
                        const globalIdx = (currentPage - 1) * pageSize + idx;
                        const itemTxns = recentTransactions.filter((t: any) => t.itemId === item.itemId);
                        return (
                          <Fragment key={item.itemId}>
                            <tr
                              className="text-sm cursor-pointer"
                              onClick={() => setExpandedItemId(expandedItemId === item.itemId ? null : item.itemId)}
                              data-testid={`row-item-${item.itemId}`}
                            >
                              <td className="px-3 py-2">{globalIdx + 1}</td>
                              <td className="px-3 py-2 font-medium">{item.itemCode}</td>
                              <td className="px-3 py-2">
                                {item.itemName}
                                {item.hasSingleEvent && <Badge variant="outline" className="ml-2 text-xs border-blue-300 text-blue-600">1 event</Badge>}
                              </td>
                              <td className="px-3 py-2">{item.itemType}</td>
                              <td className="px-3 py-2">{item.category}</td>
                              <td className="px-3 py-2">{item.uom}</td>
                              <td className="px-3 py-2 font-medium">{Number(item.totalConsumed).toLocaleString()}</td>
                              <td className="px-3 py-2">{item.eventCount}</td>
                              <td className="px-3 py-2">
                                {Number(item.avgMonthlyConsumption || 0).toFixed(1)}
                                {item.adjustmentNote && (
                                  <span className="block text-xs text-amber-600 mt-0.5" title={item.adjustmentNote}>*adjusted</span>
                                )}
                              </td>
                              <td className="px-3 py-2">{item.currentRob}</td>
                              <td className="px-3 py-2">{item.minStock}</td>
                              <td className="px-3 py-2">{item.lastConsumedDate ? format(new Date(item.lastConsumedDate), "dd MMM yyyy") : "-"}</td>
                            </tr>
                            {expandedItemId === item.itemId && itemTxns.length > 0 && (
                              <tr>
                                <td colSpan={12} className="bg-gray-50 px-6 py-3">
                                  <p className="text-sm font-medium text-gray-700 mb-2">Recent Transactions for {item.itemName}</p>
                                  <table className="w-full text-sm border border-gray-200 rounded" data-testid={`subtable-txn-${item.itemId}`}>
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-2 py-1 text-left text-xs text-gray-500">Date</th>
                                        <th className="px-2 py-1 text-left text-xs text-gray-500">Qty Consumed</th>
                                        <th className="px-2 py-1 text-left text-xs text-gray-500">ROB After</th>
                                        <th className="px-2 py-1 text-left text-xs text-gray-500">User</th>
                                        <th className="px-2 py-1 text-left text-xs text-gray-500">Remarks</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {itemTxns.map((txn: any) => (
                                        <tr key={txn.id}>
                                          <td className="px-2 py-1">{txn.date ? format(new Date(txn.date), "dd MMM yyyy") : "-"}</td>
                                          <td className="px-2 py-1">{txn.qtyConsumed}</td>
                                          <td className="px-2 py-1">{txn.robAfter}</td>
                                          <td className="px-2 py-1">{txn.userId || "-"}</td>
                                          <td className="px-2 py-1">{txn.remarks || "-"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                            {expandedItemId === item.itemId && itemTxns.length === 0 && (
                              <tr><td colSpan={12} className="bg-gray-50 px-6 py-3 text-sm text-gray-500">No recent transactions found for this item.</td></tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No item data available</p>
              )}
              {sortedItems.length > 0 && (
                <TablePagination
                  totalItems={sortedItems.length}
                  pageSize={pageSize}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
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
                <div className="overflow-x-auto">
                  <table className="w-full rounded-lg border border-gray-200 overflow-hidden bg-white" data-testid="table-categories">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {categoryBreakdown.map((c: any, i: number) => (
                        <tr key={i} className="text-sm">
                          <td className="px-3 py-2 font-medium">{c.category}</td>
                          <td className="px-3 py-2">{c.itemType}</td>
                          <td className="px-3 py-2">{Number(c.totalQty).toLocaleString()}</td>
                          <td className="px-3 py-2">{c.itemCount}</td>
                          <td className="px-3 py-2">{Number(c.percentage).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No category data available</p>
              )}
            </div>
          )}

          {activeTab === "efficiency" && (
            <div className="space-y-6">
              {stockEfficiency.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full rounded-lg border border-gray-200 overflow-hidden bg-white" data-testid="table-efficiency">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROB</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consumed</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Turnover</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Movement</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days to Stockout</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Below Min</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paginateItems(stockEfficiency).map((item: any, idx: number) => {
                          const globalIdx = (currentPage - 1) * pageSize + idx;
                          return (
                          <tr key={item.itemId || globalIdx} className="text-sm" data-testid={`row-efficiency-${item.itemId}`}>
                            <td className="px-3 py-2">{globalIdx + 1}</td>
                            <td className="px-3 py-2 font-medium">{item.itemCode}</td>
                            <td className="px-3 py-2">
                              {item.itemName}
                              {item.negativeRob && <Badge className="ml-2 bg-red-100 text-red-700 border-red-300 text-xs">Negative ROB</Badge>}
                            </td>
                            <td className="px-3 py-2">{item.itemType}</td>
                            <td className="px-3 py-2">{item.currentRob}</td>
                            <td className="px-3 py-2">{item.minStock}</td>
                            <td className="px-3 py-2">{Number(item.totalConsumed).toLocaleString()}</td>
                            <td className="px-3 py-2">{Number(item.stockTurnoverRatio || 0).toFixed(2)}</td>
                            <td className="px-3 py-2">
                              {item.movementSpeed === "fast" && <Badge className="bg-green-100 text-green-700 border-green-300">Fast</Badge>}
                              {item.movementSpeed === "slow" && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Slow</Badge>}
                              {item.movementSpeed === "very-slow" && <Badge className="bg-orange-100 text-orange-700 border-orange-300">Very Slow</Badge>}
                              {item.movementSpeed === "non-moving" && <Badge className="bg-gray-100 text-gray-600 border-gray-300">Non-Moving</Badge>}
                              {item.movementNote && <span className="block text-xs text-gray-500 mt-0.5">{item.movementNote}</span>}
                            </td>
                            <td className="px-3 py-2">
                              {item.movementSpeed === "non-moving" ? "\u221E" : (
                                item.daysUntilStockout != null ? (
                                  <span>
                                    {item.daysUntilStockout}
                                    {item.stockoutRange && (
                                      <span className="block text-xs text-gray-500">{item.stockoutRange.lower}-{item.stockoutRange.upper}d</span>
                                    )}
                                  </span>
                                ) : "-"
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {item.belowMinStock ? <Badge className="bg-red-100 text-red-700 border-red-300">Yes</Badge> : <Badge className="bg-green-100 text-green-700 border-green-300">No</Badge>}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {stockEfficiency.length > 0 && (
                    <TablePagination
                      totalItems={stockEfficiency.length}
                      pageSize={pageSize}
                      currentPage={currentPage}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
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
                    <div className="overflow-x-auto mt-3">
                      <table className="w-full rounded-lg border border-gray-200 overflow-hidden bg-white" data-testid="table-non-moving">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROB</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {paginateItems(nonMovingItems).map((item: any, idx: number) => {
                            const globalIdx = (currentPage - 1) * pageSize + idx;
                            return (
                            <tr key={item.itemId || globalIdx} className="text-sm">
                              <td className="px-3 py-2">{globalIdx + 1}</td>
                              <td className="px-3 py-2 font-medium">{item.itemCode}</td>
                              <td className="px-3 py-2">{item.itemName}</td>
                              <td className="px-3 py-2">{item.itemType}</td>
                              <td className="px-3 py-2">{item.currentRob}</td>
                              <td className="px-3 py-2">{item.minStock}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {nonMovingItems.length > 0 && (
                      <TablePagination
                        totalItems={nonMovingItems.length}
                        pageSize={pageSize}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                      />
                    )}
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
                <>
                <div className="overflow-x-auto">
                  <table className="w-full rounded-lg border border-gray-200 overflow-hidden bg-white" data-testid="table-forecast">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">UOM</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Monthly</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projected</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROB</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder Pt</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Months Left</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder?</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested Qty</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginateItems(forecastData).map((f: any, idx: number) => {
                        const globalIdx = (currentPage - 1) * pageSize + idx;
                        return (
                        <tr key={f.itemId || globalIdx} className="text-sm" data-testid={`row-forecast-${f.itemId}`}>
                          <td className="px-3 py-2">{globalIdx + 1}</td>
                          <td className="px-3 py-2 font-medium">{f.itemCode}</td>
                          <td className="px-3 py-2">
                            {f.itemName}
                            {f.reorderReasoning && f.reorderNeeded && (
                              <span className="block text-xs text-gray-500 mt-0.5">{f.reorderReasoning}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{f.uom}</td>
                          <td className="px-3 py-2">
                            {Number(f.avgMonthlyConsumption || 0).toFixed(1)}
                            {f.rawAvgMonthlyConsumption && f.rawAvgMonthlyConsumption !== f.avgMonthlyConsumption && (
                              <span className="block text-xs text-amber-600">raw: {Number(f.rawAvgMonthlyConsumption).toFixed(1)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{Number(f.projectedNextMonth || 0).toFixed(1)}</td>
                          <td className="px-3 py-2">{f.currentRob}</td>
                          <td className="px-3 py-2">{f.minStock}</td>
                          <td className="px-3 py-2">{f.reorderPoint != null ? Number(f.reorderPoint).toFixed(0) : "-"}</td>
                          <td className="px-3 py-2">{f.monthsOfStockRemaining != null ? Number(f.monthsOfStockRemaining).toFixed(1) : "-"}</td>
                          <td className="px-3 py-2">
                            {f.reorderNeeded ? <Badge className="bg-red-100 text-red-700 border-red-300">Yes</Badge> : <span className="text-gray-400">No</span>}
                          </td>
                          <td className="px-3 py-2">{f.suggestedReorderQty || "-"}</td>
                          <td className="px-3 py-2">
                            {f.confidenceLevel === "high" && <Badge className="bg-green-100 text-green-700 border-green-300">High</Badge>}
                            {f.confidenceLevel === "medium" && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Medium</Badge>}
                            {f.confidenceLevel === "low" && <Badge className="bg-red-100 text-red-700 border-red-300">Low</Badge>}
                            {!f.confidenceLevel && <span className="text-gray-400">-</span>}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  totalItems={forecastData.length}
                  pageSize={pageSize}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
                </>
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
