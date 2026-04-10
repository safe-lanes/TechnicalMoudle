import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  AlertTriangle,
  Search,
  Download,
  FileText,
  Loader2,
  Store,
  Droplets,
  Beaker,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator, formatReportDateRange } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";

interface StoresItem {
  id: number;
  vesselId: string;
  itemType: string;
  itemCode: string;
  itemName: string;
  category: string;
  specification: string;
  uom: string;
  rob: string | number;
  robLocationA: string | number;
  robLocationB: string | number;
  locationA: string;
  locationB: string;
  min: string | number;
  max: string | number;
  unitCost: string | number;
  supplier: string;
  lastOrderDate: string;
  leadTime: string;
  ihm: boolean;
  deleted: boolean;
  isActive: boolean;
}

interface StoresLedger {
  id: number;
  vesselId: string;
  section: string;
  itemId: number;
  partCode: string;
  itemName: string;
  uom: string;
  eventType: string;
  qtyChangeBase: string | number;
  qtyDisplay: string | number;
  uomDisplay: string;
  robAfterBase: string | number;
  dateLocal: string;
  tz: string;
  timestampUTC: string;
  place: string;
  ref: string;
  userId: string;
  remarks: string;
}

interface StoresInventoryStatusReportProps {
  onBack: () => void;
  vesselId?: string;
  embedded?: boolean;
  globalVessels?: string[];
  globalComponent?: string;
}

type ActiveTab = 'stock-status' | 'consumption' | 'reorder';

const categoryDisplayMap: Record<string, string> = {
  stores: 'Stores',
  lubes: 'Lubricants',
  lubricants: 'Lubricants',
  chemicals: 'Chemicals',
  others: 'Others',
};

function getStockStatus(rob: number, min: number): 'Critical' | 'Low' | 'OK' {
  if (rob === 0) return 'Critical';
  if (rob <= min) return 'Low';
  return 'OK';
}

function getLocation(item: StoresItem): string {
  const a = item.locationA || '';
  const b = item.locationB || '';
  if (a && b) return `${a} / ${b}`;
  return a || b || '-';
}

const StoresInventoryStatusReport: React.FC<StoresInventoryStatusReportProps> = ({ onBack, vesselId: propVesselId, embedded, globalVessels = [], globalComponent = "" }) => {
  const { vesselId: contextVesselId } = useVessel();
  const effectiveVesselId = propVesselId || contextVesselId;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryTab, setCategoryTab] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<ActiveTab>('stock-status');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const { data: rawStoresItems = [], isLoading: loadingItems, error: errorItems } = useQuery<StoresItem[]>({
    queryKey: [`/technical/api/stores/${effectiveVesselId}`],
    enabled: !!effectiveVesselId,
  });

  const { data: rawLedger = [], isLoading: loadingLedger, error: errorLedger } = useQuery<StoresLedger[]>({
    queryKey: [`/technical/api/stores/${effectiveVesselId}/history`],
    enabled: !!effectiveVesselId,
  });

  const isLoading = loadingItems || loadingLedger;
  const error = errorItems || errorLedger;

  const storesItems = useMemo(() => {
    let items = rawStoresItems.filter(item => !item.deleted && item.isActive !== false);
    if (globalVessels.length > 0) {
      items = items.filter((i: any) => !i.vesselId || globalVessels.includes(i.vesselId));
    }
    if (globalComponent && globalComponent.trim()) {
      const gc = globalComponent.toLowerCase();
      items = items.filter(item =>
        (item.itemCode || '').toLowerCase().includes(gc) ||
        (item.itemName || '').toLowerCase().includes(gc)
      );
    }
    return items;
  }, [rawStoresItems, globalComponent, globalVessels]);

  const consumptionMap = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    const map: Record<number, { total30: number; first15: number; last15: number }> = {};

    rawLedger.forEach(entry => {
      if (entry.eventType !== 'CONSUME') return;
      const entryDate = entry.timestampUTC ? new Date(entry.timestampUTC) : (entry.dateLocal ? new Date(entry.dateLocal) : null);
      if (!entryDate || entryDate < thirtyDaysAgo) return;

      const itemId = entry.itemId;
      if (!map[itemId]) map[itemId] = { total30: 0, first15: 0, last15: 0 };

      const qty = Math.abs(parseFloat(String(entry.qtyChangeBase)) || 0);
      map[itemId].total30 += qty;

      if (entryDate >= fifteenDaysAgo) {
        map[itemId].last15 += qty;
      } else {
        map[itemId].first15 += qty;
      }
    });

    return map;
  }, [rawLedger]);

  const getTrend = (itemId: number): 'Increasing' | 'Stable' | 'Decreasing' => {
    const data = consumptionMap[itemId];
    if (!data || (data.first15 === 0 && data.last15 === 0)) return 'Stable';
    const avg = (data.first15 + data.last15) / 2;
    if (avg === 0) return 'Stable';
    if (data.last15 > data.first15 * 1.1) return 'Increasing';
    if (data.first15 > data.last15 * 1.1) return 'Decreasing';
    return 'Stable';
  };

  const preTabFilteredItems = useMemo(() => {
    let items = [...storesItems];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        (i.itemCode || '').toLowerCase().includes(q) ||
        (i.itemName || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      items = items.filter(i => {
        const rob = parseFloat(String(i.rob)) || 0;
        const min = parseFloat(String(i.min)) || 0;
        const status = getStockStatus(rob, min);
        return status === statusFilter;
      });
    }

    return items;
  }, [storesItems, searchQuery, statusFilter]);

  const filteredItems = useMemo(() => {
    let items = [...preTabFilteredItems];

    if (categoryTab !== 'all') {
      if (categoryTab === 'lubes') {
        items = items.filter(i => i.itemType === 'lubes' || i.itemType === 'lubricants');
      } else if (categoryTab === 'others') {
        items = items.filter(i => !['stores', 'lubes', 'lubricants', 'chemicals'].includes(i.itemType));
      } else {
        items = items.filter(i => i.itemType === categoryTab);
      }
    }

    return items;
  }, [preTabFilteredItems, categoryTab]);

  const stockStatusData = useMemo(() => {
    return filteredItems.map((item, idx) => {
      const rob = parseFloat(String(item.rob)) || 0;
      const min = parseFloat(String(item.min)) || 0;
      const status = getStockStatus(rob, min);
      return {
        sno: idx + 1,
        itemCode: item.itemCode || '-',
        itemName: item.itemName || '-',
        category: categoryDisplayMap[item.itemType] || item.itemType || '-',
        rob,
        min,
        status,
        locationA: item.locationA || '-',
        locationB: item.locationB || '-',
        uom: item.uom || '-',
      };
    });
  }, [filteredItems]);

  const consumptionData = useMemo(() => {
    return filteredItems.map((item, idx) => {
      const rob = parseFloat(String(item.rob)) || 0;
      const consumption = consumptionMap[item.id]?.total30 || 0;
      const trend = getTrend(item.id);
      return {
        sno: idx + 1,
        itemCode: item.itemCode || '-',
        itemName: item.itemName || '-',
        category: categoryDisplayMap[item.itemType] || item.itemType || '-',
        rob,
        consumption: parseFloat(consumption.toFixed(2)),
        avgMonthly: parseFloat(consumption.toFixed(2)),
        trend,
      };
    });
  }, [filteredItems, consumptionMap]);

  const reorderData = useMemo(() => {
    return filteredItems
      .map(item => {
        const rob = parseFloat(String(item.rob)) || 0;
        const min = parseFloat(String(item.min)) || 0;
        const monthlyConsumption = consumptionMap[item.id]?.total30 || 0;
        const dailyConsumption = monthlyConsumption / 30;
        const daysUntilStockout = dailyConsumption > 0 ? rob / dailyConsumption : Infinity;
        const suggestedQty = Math.max(0, (min * 2) - rob);

        let priority: 'Critical' | 'High' | 'Medium' | 'Low';
        if (daysUntilStockout < 7) priority = 'Critical';
        else if (daysUntilStockout < 14) priority = 'High';
        else if (daysUntilStockout < 30) priority = 'Medium';
        else priority = 'Low';

        return { item, rob, min, monthlyConsumption, daysUntilStockout, priority, suggestedQty };
      })
      .filter(r => (r.rob - r.monthlyConsumption) <= r.min)
      .map((r, idx) => ({
        sno: idx + 1,
        itemCode: r.item.itemCode || '-',
        itemName: r.item.itemName || '-',
        category: categoryDisplayMap[r.item.itemType] || r.item.itemType || '-',
        rob: r.rob,
        avgMonthly: parseFloat(r.monthlyConsumption.toFixed(2)),
        daysUntilStockout: formatDaysUntilStockout(r.daysUntilStockout),
        suggestedQty: parseFloat(r.suggestedQty.toFixed(1)),
        priority: r.priority,
      }));
  }, [filteredItems, consumptionMap]);

  const totalItems = storesItems.length;
  const lowStockCount = storesItems.filter(i => {
    const rob = parseFloat(String(i.rob)) || 0;
    const min = parseFloat(String(i.min)) || 0;
    return rob <= min;
  }).length;
  const lubricantsCount = storesItems.filter(i => i.itemType === 'lubes' || i.itemType === 'lubricants').length;
  const chemicalsCount = storesItems.filter(i => i.itemType === 'chemicals').length;

  const formatDaysUntilStockout = (days: number): string => {
    if (!isFinite(days) || days > 365) return '>365';
    return Math.round(days).toString();
  };

  const handleExportPdf = async () => {
    setGeneratingPdf(true);
    try {
      let columns: { header: string; field: string; width?: number }[];
      let exportData: any[];
      let title: string;
      let subtitle: string;

      if (activeTab === 'stock-status') {
        title = 'Stores Inventory Status - Stock Status';
        subtitle = 'Current stock levels and status overview';
        columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Item Code', field: 'itemCode', width: 25 },
          { header: 'Item Name', field: 'itemName', width: 50 },
          { header: 'Category', field: 'category', width: 25 },
          { header: 'Current ROB', field: 'rob', width: 22 },
          { header: 'Min Stock', field: 'min', width: 20 },
          { header: 'Status', field: 'status', width: 20 },
          { header: 'Location A', field: 'locationA', width: 20 },
          { header: 'Location B', field: 'locationB', width: 20 },
          { header: 'UOM', field: 'uom', width: 15 },
        ];
        exportData = stockStatusData;
      } else if (activeTab === 'consumption') {
        title = 'Stores Inventory Status - Consumption Trends';
        subtitle = 'Last 30 days consumption analysis';
        columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Item Code', field: 'itemCode', width: 25 },
          { header: 'Item Name', field: 'itemName', width: 50 },
          { header: 'Category', field: 'category', width: 25 },
          { header: 'Current ROB', field: 'rob', width: 22 },
          { header: '30 Day Consumption', field: 'consumption', width: 30 },
          { header: 'Avg Monthly', field: 'avgMonthly', width: 25 },
          { header: 'Trend', field: 'trend', width: 22 },
        ];
        exportData = consumptionData;
      } else {
        title = 'Stores Inventory Status - Reorder Requirements';
        subtitle = 'Items requiring reorder attention';
        columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Item Code', field: 'itemCode', width: 25 },
          { header: 'Item Name', field: 'itemName', width: 45 },
          { header: 'Category', field: 'category', width: 25 },
          { header: 'Current ROB', field: 'rob', width: 22 },
          { header: 'Avg Monthly', field: 'avgMonthly', width: 25 },
          { header: 'Days to Stockout', field: 'daysUntilStockout', width: 28 },
          { header: 'Suggested Qty', field: 'suggestedQty', width: 25 },
        ];
        exportData = reorderData;
      }

      if (exportData.length === 0) {
        toast({ title: "No Data", description: "No items to export.", variant: "destructive" });
        setGeneratingPdf(false);
        return;
      }

      const summaryData = [
        { label: 'Total Items', value: totalItems },
        { label: 'Low Stock', value: lowStockCount },
        { label: 'Lubricants', value: lubricantsCount },
        { label: 'Chemicals', value: chemicalsCount },
      ];

      pdfReportGenerator.generateReport(
        { title, subtitle, dateRange: 'All Time' },
        columns,
        exportData
      );
      toast({ title: "PDF Generated", description: "Report downloaded successfully." });
    } catch (e) {
      toast({ title: "Export Failed", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (storesItems.length === 0) {
      toast({ title: "No Data", description: "No items to export.", variant: "destructive" });
      return;
    }
    setGeneratingPdf(true);
    try {
      const res = await fetch(`/technical/api/reports/stores-inventory-status/${effectiveVesselId}/excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tab: activeTab,
          categoryFilter: categoryTab !== 'all' ? categoryTab : undefined,
          statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate Excel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stores-inventory-status-${activeTab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Excel Exported", description: "Report downloaded as Excel file." });
    } catch (err) {
      toast({ title: "Export Failed", description: "Failed to generate Excel report.", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (!effectiveVesselId) {
    return (
      <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
        {!embedded && (
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={onBack} data-testid="button-back-stores-inventory">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Stores Inventory Status Report</h1>
          </div>
        )}
        <div className="text-center py-16">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Vessel</h3>
          <p className="text-gray-500">Please select a vessel from the dropdown above to view the stores inventory status report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} data-testid="button-back-stores-inventory">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stores Inventory Status Report</h1>
              <p className="text-sm text-gray-500">Comprehensive overview of all store items with stock levels, consumption trends, and reorder requirements</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={generatingPdf || isLoading}
              data-testid="button-export-pdf"
            >
              {generatingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={generatingPdf || isLoading}
              data-testid="button-export-excel"
            >
              <Download className="h-4 w-4 mr-2" /> Export Excel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading inventory data...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Failed to Load Report</h3>
          <p className="text-gray-500">Please try again or select a different vessel.</p>
        </div>
      ) : (
        <>
          {!embedded && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-l-4 border-l-purple-500 bg-white" data-testid="card-total-items">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Store className="w-4 h-4 text-purple-500" />
                    Total Items
                  </CardDescription>
                  <CardTitle className="text-3xl">{totalItems}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-l-4 border-l-red-500 bg-white" data-testid="card-low-stock">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Low Stock
                  </CardDescription>
                  <CardTitle className="text-3xl text-red-600">{lowStockCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-l-4 border-l-blue-500 bg-white" data-testid="card-lubricants">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    Lubricants
                  </CardDescription>
                  <CardTitle className="text-3xl text-blue-600">{lubricantsCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-l-4 border-l-green-500 bg-white" data-testid="card-chemicals">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Beaker className="w-4 h-4 text-green-500" />
                    Chemicals
                  </CardDescription>
                  <CardTitle className="text-3xl text-green-600">{chemicalsCount}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by code, name, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-stores"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OK">OK</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {[
              { key: 'all', label: 'All', count: preTabFilteredItems.length },
              { key: 'stores', label: 'Stores', count: preTabFilteredItems.filter(i => i.itemType === 'stores').length },
              { key: 'lubes', label: 'Lubricants', count: preTabFilteredItems.filter(i => i.itemType === 'lubes' || i.itemType === 'lubricants').length },
              { key: 'chemicals', label: 'Chemicals', count: preTabFilteredItems.filter(i => i.itemType === 'chemicals').length },
              { key: 'others', label: 'Others', count: preTabFilteredItems.filter(i => !['stores', 'lubes', 'lubricants', 'chemicals'].includes(i.itemType)).length },
            ].filter(t => t.key === 'all' || t.count > 0).map(tab => (
              <button
                key={tab.key}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  categoryTab === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setCategoryTab(tab.key)}
                data-testid={`button-category-tab-${tab.key}`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'stock-status'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('stock-status')}
              data-testid="tab-stock-status"
            >
              Stock Status
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'consumption'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('consumption')}
              data-testid="tab-consumption"
            >
              Consumption Trends
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'reorder'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('reorder')}
              data-testid="tab-reorder"
            >
              Reorder Requirements
            </button>
          </div>

          {activeTab === 'stock-status' && (
            <ReportAgGridTable
              columns={[
                { header: 'S.No', field: 'sno', width: 70 },
                { header: 'Item Code', field: 'itemCode', width: 120 },
                { header: 'Item Name', field: 'itemName', width: 200 },
                { header: 'Category', field: 'category', width: 120 },
                { header: 'Current ROB', field: 'rob', width: 110 },
                { header: 'Min Stock', field: 'min', width: 100 },
                { header: 'Stock Status', field: 'status', width: 110 },
                { header: 'Location A', field: 'locationA', width: 110 },
                { header: 'Location B', field: 'locationB', width: 110 },
                { header: 'UOM', field: 'uom', width: 80 },
              ]}
              data={stockStatusData}
            />
          )}

          {activeTab === 'consumption' && (
            <ReportAgGridTable
              columns={[
                { header: 'S.No', field: 'sno', width: 70 },
                { header: 'Item Code', field: 'itemCode', width: 120 },
                { header: 'Item Name', field: 'itemName', width: 200 },
                { header: 'Category', field: 'category', width: 120 },
                { header: 'Current ROB', field: 'rob', width: 110 },
                { header: 'Last 30 Days', field: 'consumption', width: 130 },
                { header: 'Avg Monthly Rate', field: 'avgMonthly', width: 130 },
                { header: 'Trend', field: 'trend', width: 110 },
              ]}
              data={consumptionData}
            />
          )}

          {activeTab === 'reorder' && (
            <ReportAgGridTable
              columns={[
                { header: 'S.No', field: 'sno', width: 70 },
                { header: 'Item Code', field: 'itemCode', width: 120 },
                { header: 'Item Name', field: 'itemName', width: 200 },
                { header: 'Category', field: 'category', width: 120 },
                { header: 'Current ROB', field: 'rob', width: 110 },
                { header: 'Avg Monthly', field: 'avgMonthly', width: 120 },
                { header: 'Days to Stockout', field: 'daysUntilStockout', width: 140 },
                { header: 'Suggested Qty', field: 'suggestedQty', width: 120 },
                { header: 'Priority', field: 'priority', width: 100 },
              ]}
              data={reorderData}
            />
          )}
        </>
      )}
    </div>
  );
};

export default StoresInventoryStatusReport;