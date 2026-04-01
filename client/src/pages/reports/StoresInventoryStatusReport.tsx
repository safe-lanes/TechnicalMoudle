import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ArrowUpDown,
  Store,
  Droplets,
  Beaker,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator, formatReportDateRange } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { TablePagination, usePagination } from "@/components/reports/TablePagination";

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

type SortField = 'itemCode' | 'itemName' | 'category' | 'rob' | 'min' | 'status' | 'consumption' | 'trend' | 'daysUntilStockout' | 'priority';
type SortDirection = 'asc' | 'desc';
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
  const [sortField, setSortField] = useState<SortField>('itemCode');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, resetPage, paginateItems } = usePagination(25);

  useEffect(() => {
    resetPage();
  }, [searchQuery, statusFilter, categoryTab, activeTab]);

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

  const sortedStockItems = useMemo(() => {
    const items = [...filteredItems];
    items.sort((a, b) => {
      let cmp = 0;
      const robA = parseFloat(String(a.rob)) || 0;
      const robB = parseFloat(String(b.rob)) || 0;
      const minA = parseFloat(String(a.min)) || 0;
      const minB = parseFloat(String(b.min)) || 0;
      switch (sortField) {
        case 'itemCode': cmp = (a.itemCode || '').localeCompare(b.itemCode || ''); break;
        case 'itemName': cmp = (a.itemName || '').localeCompare(b.itemName || ''); break;
        case 'category': cmp = (a.itemType || '').localeCompare(b.itemType || ''); break;
        case 'rob': cmp = robA - robB; break;
        case 'min': cmp = minA - minB; break;
        case 'status': cmp = getStockStatus(robA, minA).localeCompare(getStockStatus(robB, minB)); break;
        default: cmp = (a.itemCode || '').localeCompare(b.itemCode || '');
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });
    return items;
  }, [filteredItems, sortField, sortDirection]);

  const consumptionItems = useMemo(() => {
    const items = filteredItems.map(item => {
      const rob = parseFloat(String(item.rob)) || 0;
      const consumption = consumptionMap[item.id]?.total30 || 0;
      const trend = getTrend(item.id);
      return { ...item, rob, consumption, avgMonthly: consumption, trend };
    });

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'itemCode': cmp = (a.itemCode || '').localeCompare(b.itemCode || ''); break;
        case 'itemName': cmp = (a.itemName || '').localeCompare(b.itemName || ''); break;
        case 'category': cmp = (a.itemType || '').localeCompare(b.itemType || ''); break;
        case 'rob': cmp = a.rob - b.rob; break;
        case 'consumption': cmp = a.consumption - b.consumption; break;
        case 'trend': cmp = a.trend.localeCompare(b.trend); break;
        default: cmp = (a.itemCode || '').localeCompare(b.itemCode || '');
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return items;
  }, [filteredItems, consumptionMap, sortField, sortDirection]);

  const reorderItems = useMemo(() => {
    const items = filteredItems
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

        return {
          ...item,
          rob,
          min,
          monthlyConsumption,
          daysUntilStockout,
          priority,
          suggestedQty,
        };
      })
      .filter(item => (item.rob - item.monthlyConsumption) <= item.min);

    items.sort((a, b) => {
      let cmp = 0;
      const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      switch (sortField) {
        case 'itemCode': cmp = (a.itemCode || '').localeCompare(b.itemCode || ''); break;
        case 'itemName': cmp = (a.itemName || '').localeCompare(b.itemName || ''); break;
        case 'category': cmp = (a.itemType || '').localeCompare(b.itemType || ''); break;
        case 'rob': cmp = a.rob - b.rob; break;
        case 'consumption': cmp = a.monthlyConsumption - b.monthlyConsumption; break;
        case 'daysUntilStockout': cmp = a.daysUntilStockout - b.daysUntilStockout; break;
        case 'priority': cmp = priorityOrder[a.priority] - priorityOrder[b.priority]; break;
        default: cmp = (a.itemCode || '').localeCompare(b.itemCode || '');
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return items;
  }, [filteredItems, consumptionMap, sortField, sortDirection]);

  const totalItems = storesItems.length;
  const lowStockCount = storesItems.filter(i => {
    const rob = parseFloat(String(i.rob)) || 0;
    const min = parseFloat(String(i.min)) || 0;
    return rob <= min;
  }).length;
  const lubricantsCount = storesItems.filter(i => i.itemType === 'lubes' || i.itemType === 'lubricants').length;
  const chemicalsCount = storesItems.filter(i => i.itemType === 'chemicals').length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      className="flex items-center gap-1 font-semibold text-sm text-gray-700 hover:text-gray-900"
      onClick={() => handleSort(field)}
      data-testid={`button-sort-${field}`}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-blue-600' : 'text-gray-400'}`} />
    </button>
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Critical':
        return <Badge className="bg-red-600 text-white border-red-700">Critical</Badge>;
      case 'Low':
        return <Badge className="bg-amber-500 text-white border-amber-600">Low</Badge>;
      default:
        return <Badge className="bg-green-600 text-white border-green-700">OK</Badge>;
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'Increasing':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><TrendingUp className="h-3 w-3 mr-1" />Increasing</Badge>;
      case 'Decreasing':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><TrendingDown className="h-3 w-3 mr-1" />Decreasing</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200"><Minus className="h-3 w-3 mr-1" />Stable</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return <Badge className="bg-red-600 text-white border-red-700">Critical</Badge>;
      case 'High':
        return <Badge className="bg-orange-500 text-white border-orange-600">High</Badge>;
      case 'Medium':
        return <Badge className="bg-yellow-500 text-white border-yellow-600">Medium</Badge>;
      default:
        return <Badge className="bg-gray-400 text-white border-gray-500">Low</Badge>;
    }
  };

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
        exportData = sortedStockItems.map((item, idx) => ({
          sno: idx + 1,
          itemCode: item.itemCode || '-',
          itemName: item.itemName || '-',
          category: categoryDisplayMap[item.itemType] || item.itemType || '-',
          rob: parseFloat(String(item.rob)) || 0,
          min: parseFloat(String(item.min)) || 0,
          status: getStockStatus(parseFloat(String(item.rob)) || 0, parseFloat(String(item.min)) || 0),
          locationA: item.locationA || '-',
          locationB: item.locationB || '-',
          uom: item.uom || '-',
        }));
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
        exportData = consumptionItems.map((item, idx) => ({
          sno: idx + 1,
          itemCode: item.itemCode || '-',
          itemName: item.itemName || '-',
          category: categoryDisplayMap[item.itemType] || item.itemType || '-',
          rob: item.rob,
          consumption: item.consumption.toFixed(2),
          avgMonthly: item.avgMonthly.toFixed(2),
          trend: item.trend,
        }));
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
          { header: 'Priority', field: 'priority', width: 20 },
          { header: 'Suggested Qty', field: 'suggestedQty', width: 25 },
        ];
        exportData = reorderItems.map((item, idx) => ({
          sno: idx + 1,
          itemCode: item.itemCode || '-',
          itemName: item.itemName || '-',
          category: categoryDisplayMap[item.itemType] || item.itemType || '-',
          rob: item.rob,
          avgMonthly: item.monthlyConsumption.toFixed(2),
          daysUntilStockout: formatDaysUntilStockout(item.daysUntilStockout),
          priority: item.priority,
          suggestedQty: item.suggestedQty.toFixed(1),
        }));
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
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-stock-status">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-center py-3 px-3 w-16">S.No</th>
                      <th className="text-left py-3 px-3"><SortButton field="itemCode" label="Item Code" /></th>
                      <th className="text-left py-3 px-3"><SortButton field="itemName" label="Item Name" /></th>
                      <th className="text-left py-3 px-3"><SortButton field="category" label="Category" /></th>
                      <th className="text-right py-3 px-3"><SortButton field="rob" label="Current ROB" /></th>
                      <th className="text-right py-3 px-3"><SortButton field="min" label="Min Stock" /></th>
                      <th className="text-left py-3 px-3"><SortButton field="status" label="Stock Status" /></th>
                      <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Location A</th>
                      <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Location B</th>
                      <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">UOM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortedStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-12">
                          <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">No items found</p>
                          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                        </td>
                      </tr>
                    ) : (
                      paginateItems(sortedStockItems).map((item, idx) => {
                        const globalIdx = (currentPage - 1) * pageSize + idx;
                        const rob = parseFloat(String(item.rob)) || 0;
                        const min = parseFloat(String(item.min)) || 0;
                        const status = getStockStatus(rob, min);
                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-gray-50 ${
                              status === 'Critical' ? 'bg-red-50/40' :
                              status === 'Low' ? 'bg-amber-50/30' : ''
                            }`}
                            data-testid={`row-stock-${item.id}`}
                          >
                            <td className="py-3 px-3 text-center text-sm text-gray-500">{globalIdx + 1}</td>
                            <td className="py-3 px-3 text-sm text-gray-700 font-mono">{item.itemCode || '-'}</td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-gray-900 text-sm">{item.itemName || '-'}</div>
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-700">{categoryDisplayMap[item.itemType] || item.itemType || '-'}</td>
                            <td className="py-3 px-3 text-right">
                              <span className={`font-semibold text-sm ${rob === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                {rob}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-sm text-gray-600">{min}</td>
                            <td className="py-3 px-3">{getStatusBadge(status)}</td>
                            <td className="py-3 px-3 text-sm text-gray-600">{item.locationA || '-'}</td>
                            <td className="py-3 px-3 text-sm text-gray-600">{item.locationB || '-'}</td>
                            <td className="py-3 px-3 text-sm text-gray-600">{item.uom || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'stock-status' && sortedStockItems.length > 0 && (
            <TablePagination
              totalItems={sortedStockItems.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}

          {activeTab === 'consumption' && (
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-consumption">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-center py-3 px-3 w-16">S.No</th>
                      <th className="text-left py-3 px-3"><SortButton field="itemCode" label="Item Code" /></th>
                      <th className="text-left py-3 px-3"><SortButton field="itemName" label="Item Name" /></th>
                      <th className="text-left py-3 px-3"><SortButton field="category" label="Category" /></th>
                      <th className="text-right py-3 px-3"><SortButton field="rob" label="Current ROB" /></th>
                      <th className="text-right py-3 px-3"><SortButton field="consumption" label="Last 30 Days" /></th>
                      <th className="text-right py-3 px-3 font-semibold text-sm text-gray-700">Avg Monthly Rate</th>
                      <th className="text-left py-3 px-3"><SortButton field="trend" label="Trend" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {consumptionItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12">
                          <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">No consumption data found</p>
                          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                        </td>
                      </tr>
                    ) : (
                      paginateItems(consumptionItems).map((item, idx) => {
                        const globalIdx = (currentPage - 1) * pageSize + idx;
                        return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50"
                          data-testid={`row-consumption-${item.id}`}
                        >
                          <td className="py-3 px-3 text-center text-sm text-gray-500">{globalIdx + 1}</td>
                          <td className="py-3 px-3 text-sm text-gray-700 font-mono">{item.itemCode || '-'}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-gray-900 text-sm">{item.itemName || '-'}</div>
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-700">{categoryDisplayMap[item.itemType] || item.itemType || '-'}</td>
                          <td className="py-3 px-3 text-right font-semibold text-sm text-gray-900">{item.rob}</td>
                          <td className="py-3 px-3 text-right text-sm text-gray-700">{item.consumption.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right text-sm text-gray-700">{item.avgMonthly.toFixed(2)}</td>
                          <td className="py-3 px-3">{getTrendBadge(item.trend)}</td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'consumption' && consumptionItems.length > 0 && (
            <TablePagination
              totalItems={consumptionItems.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}

          {activeTab === 'reorder' && (
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-reorder">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-center py-3 px-3 w-16">S.No</th>
                      <th className="text-left py-3 px-3"><SortButton field="itemCode" label="Item Code" /></th>
                      <th className="text-left py-3 px-3"><SortButton field="itemName" label="Item Name" /></th>
                      <th className="text-left py-3 px-3"><SortButton field="category" label="Category" /></th>
                      <th className="text-right py-3 px-3"><SortButton field="rob" label="Current ROB" /></th>
                      <th className="text-right py-3 px-3"><SortButton field="consumption" label="Avg Monthly" /></th>
                      <th className="text-right py-3 px-3"><SortButton field="daysUntilStockout" label="Days to Stockout" /></th>
                      <th className="text-left py-3 px-3"><SortButton field="priority" label="Priority" /></th>
                      <th className="text-right py-3 px-3 font-semibold text-sm text-gray-700">Suggested Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reorderItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12">
                          <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">No reorder requirements</p>
                          <p className="text-sm text-gray-400 mt-1">All items have sufficient stock levels</p>
                        </td>
                      </tr>
                    ) : (
                      paginateItems(reorderItems).map((item, idx) => {
                        const globalIdx = (currentPage - 1) * pageSize + idx;
                        return (
                        <tr
                          key={item.id}
                          className={`hover:bg-gray-50 ${
                            item.priority === 'Critical' ? 'bg-red-50/40' :
                            item.priority === 'High' ? 'bg-orange-50/30' : ''
                          }`}
                          data-testid={`row-reorder-${item.id}`}
                        >
                          <td className="py-3 px-3 text-center text-sm text-gray-500">{globalIdx + 1}</td>
                          <td className="py-3 px-3 text-sm text-gray-700 font-mono">{item.itemCode || '-'}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-gray-900 text-sm">{item.itemName || '-'}</div>
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-700">{categoryDisplayMap[item.itemType] || item.itemType || '-'}</td>
                          <td className="py-3 px-3 text-right font-semibold text-sm text-gray-900">{item.rob}</td>
                          <td className="py-3 px-3 text-right text-sm text-gray-700">{item.monthlyConsumption.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right text-sm text-gray-700">{formatDaysUntilStockout(item.daysUntilStockout)}</td>
                          <td className="py-3 px-3">{getPriorityBadge(item.priority)}</td>
                          <td className="py-3 px-3 text-right text-sm font-semibold text-gray-900">{item.suggestedQty.toFixed(1)}</td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reorder' && reorderItems.length > 0 && (
            <TablePagination
              totalItems={reorderItems.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </>
      )}
    </div>
  );
};

export default StoresInventoryStatusReport;