import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  AlertTriangle,
  Search,
  FileText,
  Loader2,
  ArrowUpDown,
  Package,
  Droplets,
  FlaskConical,
  DollarSign,
  AlertCircle,
  Clock,
  TrendingDown,
  ShoppingCart,
  History,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { format } from "date-fns";

interface LowStockItem {
  id: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  category: string;
  rob: number;
  minStock: number;
  maxStock: number;
  deficit: number;
  deficitPercent: number;
  uom: string;
  location: string;
  priority: 'Critical' | 'High' | 'Medium';
  lastConsumedDate: string | null;
  avgMonthlyConsumption: number;
  daysUntilStockout: number | null;
  estimatedCost: number | null;
  supplier: string | null;
  leadTime: string | null;
  lastOrderDate: string | null;
  unitCost: number | null;
}

interface LowStockAlertResponse {
  summary: {
    totalLowStock: number;
    criticalItems: number;
    highPriorityItems: number;
    mediumPriorityItems: number;
    storesCount: number;
    lubesCount: number;
    chemicalsCount: number;
    estimatedTotalCost: number;
  };
  items: LowStockItem[];
}

interface LowStockAlertReportProps {
  onBack: () => void;
  vesselId?: string;
  source?: 'spares' | 'stores';
}

type SortField = 'priority' | 'itemCode' | 'itemName' | 'itemType' | 'category' | 'rob' | 'minStock' | 'deficit' | 'deficitPercent' | 'uom' | 'avgMonthlyConsumption' | 'daysUntilStockout' | 'estimatedCost' | 'supplier' | 'leadTime';
type SortDirection = 'asc' | 'desc';

function formatCurrency(val: number | null | undefined): string {
  if (val == null || val === 0) return 'N/A';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'Critical':
      return <Badge className="bg-red-600 text-white border-red-700">CRITICAL</Badge>;
    case 'High':
      return <Badge className="bg-orange-500 text-white border-orange-600">HIGH</Badge>;
    case 'Medium':
      return <Badge className="bg-yellow-500 text-white border-yellow-600">MEDIUM</Badge>;
    default:
      return <Badge>{priority}</Badge>;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'stores':
      return <Badge variant="outline" className="border-purple-300 text-purple-700">Stores</Badge>;
    case 'lubricants':
    case 'lubes':
      return <Badge variant="outline" className="border-blue-300 text-blue-700">Lubricants</Badge>;
    case 'chemicals':
      return <Badge variant="outline" className="border-green-300 text-green-700">Chemicals</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function getDaysUntilStockoutDisplay(days: number | null) {
  if (days === null) return <span className="text-gray-400">N/A</span>;
  if (days === 0) return <span className="text-red-600 font-bold">0 days</span>;
  if (days < 7) return <span className="text-orange-500 font-semibold">{days} days</span>;
  if (days < 30) return <span className="text-yellow-600">{days} days</span>;
  return <span className="text-green-600">{days} days</span>;
}

const LowStockAlertReport: React.FC<LowStockAlertReportProps> = ({ onBack, vesselId: propVesselId, source = 'stores' }) => {
  const { vesselId: contextVesselId, vessels } = useVessel();
  const effectiveVesselId = propVesselId || contextVesselId;
  const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels?.find((v: any) => v.id === effectiveVesselId)?.name || effectiveVesselId);
  const { toast } = useToast();
  const isSpares = source === 'spares';
  const apiBase = isSpares ? '/technical/api/reports/low-stock-alert' : '/technical/api/reports/stores-low-stock-alert';

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewingSnapshotId, setViewingSnapshotId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<LowStockAlertResponse>({
    queryKey: [apiBase, effectiveVesselId, source],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/${effectiveVesselId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const raw = await res.json();
      if (isSpares) {
        const mappedItems: LowStockItem[] = (raw.items || []).map((s: any) => ({
          id: s.id,
          itemCode: s.partCode || '-',
          itemName: s.partName || '-',
          itemType: 'spare',
          category: s.componentName || '-',
          rob: s.currentQty ?? 0,
          minStock: s.minQty ?? 0,
          maxStock: 0,
          deficit: s.shortage ?? 0,
          deficitPercent: s.minQty ? Math.round((s.shortage / s.minQty) * 100) : 0,
          uom: s.uom || '-',
          location: s.location || '-',
          priority: s.status === 'Critical' ? 'Critical' : s.status === 'At Minimum' ? 'Medium' : 'High',
          lastConsumedDate: null,
          avgMonthlyConsumption: 0,
          daysUntilStockout: null,
          estimatedCost: null,
          supplier: null,
          leadTime: null,
          lastOrderDate: null,
          unitCost: null,
        }));
        const criticalCount = mappedItems.filter(i => i.priority === 'Critical').length;
        const highCount = mappedItems.filter(i => i.priority === 'High').length;
        const mediumCount = mappedItems.filter(i => i.priority === 'Medium').length;
        return {
          summary: {
            totalLowStock: raw.summary?.totalLowStock ?? mappedItems.length,
            criticalItems: raw.summary?.criticalCount ?? criticalCount,
            highPriorityItems: highCount,
            mediumPriorityItems: raw.summary?.atMinCount ?? mediumCount,
            storesCount: 0,
            lubesCount: 0,
            chemicalsCount: 0,
            estimatedTotalCost: 0,
          },
          items: mappedItems,
        };
      }
      return raw;
    },
    enabled: !!effectiveVesselId,
  });

  const { data: snapshotsData, isLoading: snapshotsLoading } = useQuery<any[]>({
    queryKey: ['/technical/api/reports/snapshots', effectiveVesselId, 'low-stock-alert'],
    queryFn: async () => {
      const res = await fetch(`/technical/api/reports/snapshots/${effectiveVesselId}?reportType=low-stock-alert&limit=20`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!effectiveVesselId && effectiveVesselId !== 'all' && historyOpen,
  });

  const { data: snapshotDetail } = useQuery<any>({
    queryKey: ['/technical/api/reports/snapshots/detail', viewingSnapshotId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/reports/snapshots/detail/${viewingSnapshotId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!viewingSnapshotId,
  });

  const items = data?.items || [];
  const summary = data?.summary || {
    totalLowStock: 0,
    criticalItems: 0,
    highPriorityItems: 0,
    mediumPriorityItems: 0,
    storesCount: 0,
    lubesCount: 0,
    chemicalsCount: 0,
    estimatedTotalCost: 0,
  };

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        (i.itemCode || '').toLowerCase().includes(q) ||
        (i.itemName || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q) ||
        (i.supplier || '').toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'all') {
      if (categoryFilter === 'lubricants') {
        result = result.filter(i => i.itemType === 'lubes' || i.itemType === 'lubricants');
      } else {
        result = result.filter(i => i.itemType === categoryFilter);
      }
    }

    if (priorityFilter !== 'all') {
      result = result.filter(i => i.priority === priorityFilter);
    }

    return result;
  }, [items, searchQuery, categoryFilter, priorityFilter]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    const priorityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2 };
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'priority':
          cmp = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
          if (cmp === 0) cmp = b.deficit - a.deficit;
          break;
        case 'itemCode': cmp = (a.itemCode || '').localeCompare(b.itemCode || ''); break;
        case 'itemName': cmp = (a.itemName || '').localeCompare(b.itemName || ''); break;
        case 'itemType': cmp = (a.itemType || '').localeCompare(b.itemType || ''); break;
        case 'category': cmp = (a.category || '').localeCompare(b.category || ''); break;
        case 'rob': cmp = a.rob - b.rob; break;
        case 'minStock': cmp = a.minStock - b.minStock; break;
        case 'deficit': cmp = a.deficit - b.deficit; break;
        case 'deficitPercent': cmp = a.deficitPercent - b.deficitPercent; break;
        case 'uom': cmp = (a.uom || '').localeCompare(b.uom || ''); break;
        case 'avgMonthlyConsumption': cmp = a.avgMonthlyConsumption - b.avgMonthlyConsumption; break;
        case 'daysUntilStockout': cmp = (a.daysUntilStockout ?? 99999) - (b.daysUntilStockout ?? 99999); break;
        case 'estimatedCost': cmp = (a.estimatedCost ?? 0) - (b.estimatedCost ?? 0); break;
        case 'supplier': cmp = (a.supplier || '').localeCompare(b.supplier || ''); break;
        case 'leadTime': cmp = (a.leadTime || '').localeCompare(b.leadTime || ''); break;
        default: cmp = 0;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [filteredItems, sortField, sortDirection]);

  const criticalItems = useMemo(() => filteredItems.filter(i => i.priority === 'Critical'), [filteredItems]);
  const highPriorityItems = useMemo(() => filteredItems.filter(i => i.priority === 'High'), [filteredItems]);
  const mediumPriorityItems = useMemo(() => filteredItems.filter(i => i.priority === 'Medium'), [filteredItems]);

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
      className="flex items-center gap-1 font-medium text-xs uppercase text-gray-600 hover:text-gray-900"
      onClick={() => handleSort(field)}
      data-testid={`button-sort-${field}`}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-blue-600' : 'text-gray-400'}`} />
    </button>
  );

  const handlePdfExport = async () => {
    setGeneratingPdf(true);
    try {
      const columns = isSpares ? [
        { header: 'S.No', field: 'sno', width: 12 },
        { header: 'Priority', field: 'priority', width: 20 },
        { header: 'Part Code', field: 'itemCode', width: 28 },
        { header: 'Part Name', field: 'itemName', width: 45 },
        { header: 'Component', field: 'category', width: 40 },
        { header: 'Current Qty', field: 'rob', width: 18 },
        { header: 'Min Qty', field: 'minStock', width: 18 },
        { header: 'Shortage', field: 'deficit', width: 18 },
      ] : [
        { header: 'S.No', field: 'sno', width: 12 },
        { header: 'Priority', field: 'priority', width: 20 },
        { header: 'Item Code', field: 'itemCode', width: 22 },
        { header: 'Item Name', field: 'itemName', width: 40 },
        { header: 'Type', field: 'itemType', width: 20 },
        { header: 'Category', field: 'category', width: 22 },
        { header: 'ROB', field: 'rob', width: 15 },
        { header: 'Min Stock', field: 'minStock', width: 15 },
        { header: 'Deficit', field: 'deficit', width: 15 },
        { header: 'UOM', field: 'uom', width: 15 },
        { header: 'Avg Monthly', field: 'avgMonthly', width: 20 },
        { header: 'Days to Stockout', field: 'daysToStockout', width: 22 },
        { header: 'Est. Cost', field: 'estCost', width: 20 },
      ];

      const exportData = sortedItems.map((item, idx) => ({
        sno: idx + 1,
        priority: item.priority,
        itemCode: item.itemCode || '-',
        itemName: item.itemName || '-',
        itemType: item.itemType || '-',
        category: item.category || '-',
        rob: item.rob,
        minStock: item.minStock,
        deficit: item.deficit,
        uom: item.uom || '-',
        avgMonthly: item.avgMonthlyConsumption,
        daysToStockout: item.daysUntilStockout ?? 'N/A',
        estCost: item.estimatedCost !== null ? `$${item.estimatedCost}` : 'N/A',
      }));

      if (exportData.length === 0) {
        toast({ title: "No Data", description: "No low stock items to export.", variant: "destructive" });
        setGeneratingPdf(false);
        return;
      }

      const summaryData = isSpares ? [
        { label: 'Total Low Stock', value: summary.totalLowStock },
        { label: 'Critical', value: summary.criticalItems },
        { label: 'At Minimum', value: summary.mediumPriorityItems },
      ] : [
        { label: 'Total Low Stock', value: summary.totalLowStock },
        { label: 'Critical', value: summary.criticalItems },
        { label: 'High Priority', value: summary.highPriorityItems },
        { label: 'Medium Priority', value: summary.mediumPriorityItems },
        { label: 'Est. Total Cost', value: formatCurrency(summary.estimatedTotalCost) },
      ];

      pdfReportGenerator.generateReport(
        {
          title: isSpares ? 'Spares Low Stock Alert Report' : 'Low Stock Alert Report',
          subtitle: `Vessel: ${vesselName || 'Unknown'} | Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
          vessel: vesselName || 'Unknown',
          orientation: 'landscape',
        },
        columns,
        exportData,
        summaryData
      );
      toast({ title: "PDF Generated", description: "Low stock alert report downloaded" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExcelExport = async () => {
    setGeneratingExcel(true);
    try {
      const response = await fetch(`/technical/api/reports/stores-low-stock-alert/${effectiveVesselId}/excel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to generate Excel');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `low-stock-alert-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Excel Generated", description: "Low stock alert Excel report downloaded" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate Excel", variant: "destructive" });
    } finally {
      setGeneratingExcel(false);
    }
  };

  const renderPriorityTable = (priorityItems: LowStockItem[], label: string) => (
    <div className="rounded-lg border overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full" data-testid={`table-${label.toLowerCase()}`}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-3 px-3 font-medium text-xs uppercase text-gray-600">{isSpares ? 'Part Code' : 'Item Code'}</th>
              <th className="text-left py-3 px-3 font-medium text-xs uppercase text-gray-600">{isSpares ? 'Part Name' : 'Item Name'}</th>
              <th className="text-left py-3 px-3 font-medium text-xs uppercase text-gray-600">{isSpares ? 'Component' : 'Category'}</th>
              {!isSpares && <th className="text-left py-3 px-3 font-medium text-xs uppercase text-gray-600">Type</th>}
              <th className="text-right py-3 px-3 font-medium text-xs uppercase text-gray-600">{isSpares ? 'Current Qty' : 'ROB'}</th>
              <th className="text-right py-3 px-3 font-medium text-xs uppercase text-gray-600">{isSpares ? 'Min Qty' : 'Min'}</th>
              <th className="text-right py-3 px-3 font-medium text-xs uppercase text-gray-600">{isSpares ? 'Shortage' : 'Deficit'}</th>
              {!isSpares && <th className="text-left py-3 px-3 font-medium text-xs uppercase text-gray-600">UOM</th>}
              {!isSpares && <th className="text-right py-3 px-3 font-medium text-xs uppercase text-gray-600">Avg Monthly</th>}
              {!isSpares && <th className="text-right py-3 px-3 font-medium text-xs uppercase text-gray-600">Days to Stockout</th>}
              {!isSpares && <th className="text-right py-3 px-3 font-medium text-xs uppercase text-gray-600">Est. Cost</th>}
              {!isSpares && <th className="text-left py-3 px-3 font-medium text-xs uppercase text-gray-600">Supplier</th>}
              {!isSpares && <th className="text-left py-3 px-3 font-medium text-xs uppercase text-gray-600">Lead Time</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {priorityItems.map(item => (
              <tr key={item.id} className="hover:bg-gray-50/50 text-sm" data-testid={`row-${label.toLowerCase()}-${item.id}`}>
                <td className="py-3 px-3 font-mono text-gray-700">{item.itemCode || '-'}</td>
                <td className="py-3 px-3 font-medium text-gray-900">{item.itemName || '-'}</td>
                <td className="py-3 px-3 text-gray-600">{item.category || '-'}</td>
                {!isSpares && <td className="py-3 px-3">{getTypeBadge(item.itemType)}</td>}
                <td className="py-3 px-3 text-right font-semibold text-gray-900">{item.rob}</td>
                <td className="py-3 px-3 text-right text-gray-600">{item.minStock}</td>
                <td className="py-3 px-3 text-right font-semibold text-red-600">{item.deficit}</td>
                {!isSpares && <td className="py-3 px-3 text-gray-600">{item.uom || '-'}</td>}
                {!isSpares && <td className="py-3 px-3 text-right text-gray-600">{item.avgMonthlyConsumption}</td>}
                {!isSpares && <td className="py-3 px-3 text-right">{getDaysUntilStockoutDisplay(item.daysUntilStockout)}</td>}
                {!isSpares && <td className="py-3 px-3 text-right text-gray-700">{formatCurrency(item.estimatedCost)}</td>}
                {!isSpares && <td className="py-3 px-3 text-gray-600">{item.supplier || '-'}</td>}
                {!isSpares && <td className="py-3 px-3 text-gray-600">{item.leadTime || '-'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!effectiveVesselId) {
    return (
      <div className="p-6 bg-white min-h-screen">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack} data-testid="button-back-low-stock">
            <ArrowLeft className="h-4 w-4 mr-2" /> {isSpares ? 'Back to Spares Reports' : 'Back to Stores Reports'}
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{isSpares ? 'Spares Low Stock Alert Report' : 'Low Stock Alert Report'}</h1>
        </div>
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Vessel</h3>
          <p className="text-gray-500">Please select a vessel from the dropdown above to view the low stock alert report.</p>
        </div>
      </div>
    );
  }

  const totalForBars = Math.max(summary.storesCount + summary.lubesCount + summary.chemicalsCount, 1);

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} data-testid="button-back-low-stock">
            <ArrowLeft className="h-4 w-4 mr-2" /> {isSpares ? 'Back to Spares Reports' : 'Back to Stores Reports'}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isSpares ? 'Spares Low Stock Alert Report' : 'Low Stock Alert Report'}</h1>
            <p className="text-sm text-gray-500">{isSpares ? 'Spare parts below minimum stock levels requiring attention' : 'Items below minimum stock levels requiring attention'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handlePdfExport}
            disabled={generatingPdf || isLoading}
            data-testid="button-export-pdf"
          >
            {generatingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Export PDF
          </Button>
          {!isSpares && (
            <Button
              variant="outline"
              onClick={handleExcelExport}
              disabled={generatingExcel || isLoading}
              data-testid="button-export-excel"
            >
              {generatingExcel ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
              Export Excel
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={isSpares ? "Search by code, name, component..." : "Search by code, name, category, supplier..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-low-stock"
          />
        </div>
        {!isSpares && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="stores">Stores</SelectItem>
              <SelectItem value="lubricants">Lubricants</SelectItem>
              <SelectItem value="chemicals">Chemicals</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-priority-filter">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading low stock data...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Failed to Load Report</h3>
          <p className="text-gray-500">Please try again or select a different vessel.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Card className="bg-red-50 border-red-200" data-testid="card-total-low-stock">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Total Low Stock
                </CardDescription>
                <CardTitle className="text-3xl text-red-600">{summary.totalLowStock}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-red-50 border-red-200" data-testid="card-critical-items">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Critical
                </CardDescription>
                <CardTitle className="text-3xl text-red-600">{summary.criticalItems}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-orange-50 border-orange-200" data-testid="card-high-priority">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  High Priority
                </CardDescription>
                <CardTitle className="text-3xl text-orange-600">{summary.highPriorityItems}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-yellow-50 border-yellow-200" data-testid="card-medium-priority">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  Medium Priority
                </CardDescription>
                <CardTitle className="text-3xl text-yellow-600">{summary.mediumPriorityItems}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {!isSpares && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-purple-50 border-purple-200" data-testid="card-stores-count">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Package className="w-4 h-4 text-purple-500" />
                    Stores Items
                  </CardDescription>
                  <CardTitle className="text-3xl text-purple-700">{summary.storesCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-blue-50 border-blue-200" data-testid="card-lubes-count">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    Lubricants
                  </CardDescription>
                  <CardTitle className="text-3xl text-blue-700">{summary.lubesCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-green-50 border-green-200" data-testid="card-chemicals-count">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <FlaskConical className="w-4 h-4 text-green-500" />
                    Chemicals
                  </CardDescription>
                  <CardTitle className="text-3xl text-green-700">{summary.chemicalsCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-gray-50 border-gray-200" data-testid="card-estimated-cost">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    Est. Total Cost
                  </CardDescription>
                  <CardTitle className="text-2xl text-gray-700">{formatCurrency(summary.estimatedTotalCost)}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          {criticalItems.length > 0 && (
            <Card className="mb-6 border-red-300 bg-red-50/30" data-testid="section-critical-alert">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  Critical Alert - Out of Stock Items ({criticalItems.length})
                </CardTitle>
                <CardDescription className="text-red-600">These items are completely depleted and require immediate ordering</CardDescription>
              </CardHeader>
              <CardContent>
                {renderPriorityTable(criticalItems, 'critical')}
              </CardContent>
            </Card>
          )}

          {highPriorityItems.length > 0 && (
            <Card className="mb-6 border-orange-300 bg-orange-50/30" data-testid="section-high-priority">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="h-5 w-5" />
                  High Priority - Stock Below 50% of Minimum ({highPriorityItems.length})
                </CardTitle>
                <CardDescription className="text-orange-600">These items need to be ordered soon</CardDescription>
              </CardHeader>
              <CardContent>
                {renderPriorityTable(highPriorityItems, 'high')}
              </CardContent>
            </Card>
          )}

          {mediumPriorityItems.length > 0 && (
            <Card className="mb-6 border-yellow-300 bg-yellow-50/30" data-testid="section-medium-priority">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-700">
                  <Clock className="h-5 w-5" />
                  Medium Priority - Stock Below Minimum ({mediumPriorityItems.length})
                </CardTitle>
                <CardDescription className="text-yellow-600">These items are below minimum but not critical yet</CardDescription>
              </CardHeader>
              <CardContent>
                {renderPriorityTable(mediumPriorityItems, 'medium')}
              </CardContent>
            </Card>
          )}

          <Card className="mb-6" data-testid="section-all-items">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-blue-600" />
                All Low Stock Items
              </CardTitle>
              <CardDescription>Complete list of items below minimum stock levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="table-all-items">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-3"><SortButton field="priority" label="Priority" /></th>
                        <th className="text-left py-3 px-3"><SortButton field="itemCode" label={isSpares ? "Part Code" : "Item Code"} /></th>
                        <th className="text-left py-3 px-3"><SortButton field="itemName" label={isSpares ? "Part Name" : "Item Name"} /></th>
                        {!isSpares && <th className="text-left py-3 px-3"><SortButton field="itemType" label="Type" /></th>}
                        <th className="text-left py-3 px-3"><SortButton field="category" label={isSpares ? "Component" : "Category"} /></th>
                        <th className="text-right py-3 px-3"><SortButton field="rob" label={isSpares ? "Current Qty" : "ROB"} /></th>
                        <th className="text-right py-3 px-3"><SortButton field="minStock" label={isSpares ? "Min Qty" : "Min Stock"} /></th>
                        <th className="text-right py-3 px-3"><SortButton field="deficit" label={isSpares ? "Shortage" : "Deficit"} /></th>
                        <th className="text-right py-3 px-3"><SortButton field="deficitPercent" label={isSpares ? "Shortage %" : "Deficit %"} /></th>
                        {!isSpares && <th className="text-left py-3 px-3"><SortButton field="uom" label="UOM" /></th>}
                        {!isSpares && <th className="text-right py-3 px-3"><SortButton field="avgMonthlyConsumption" label="Avg Monthly" /></th>}
                        {!isSpares && <th className="text-right py-3 px-3"><SortButton field="daysUntilStockout" label="Days to Stockout" /></th>}
                        {!isSpares && <th className="text-right py-3 px-3"><SortButton field="estimatedCost" label="Est. Cost" /></th>}
                        {!isSpares && <th className="text-left py-3 px-3"><SortButton field="supplier" label="Supplier" /></th>}
                        {!isSpares && <th className="text-left py-3 px-3"><SortButton field="leadTime" label="Lead Time" /></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedItems.length === 0 ? (
                        <tr>
                          <td colSpan={isSpares ? 8 : 15} className="text-center py-12">
                            <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No low stock items found</p>
                            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                          </td>
                        </tr>
                      ) : (
                        sortedItems.map(item => (
                          <tr
                            key={item.id}
                            className={`hover:bg-gray-50 text-sm ${
                              item.priority === 'Critical' ? 'bg-red-50/40' :
                              item.priority === 'High' ? 'bg-orange-50/30' : ''
                            }`}
                            data-testid={`row-item-${item.id}`}
                          >
                            <td className="py-3 px-3">{getPriorityBadge(item.priority)}</td>
                            <td className="py-3 px-3 font-mono text-gray-700">{item.itemCode || '-'}</td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-gray-900">{item.itemName || '-'}</div>
                            </td>
                            {!isSpares && <td className="py-3 px-3">{getTypeBadge(item.itemType)}</td>}
                            <td className="py-3 px-3 text-gray-600">{item.category || '-'}</td>
                            <td className="py-3 px-3 text-right">
                              <span className={`font-semibold ${item.rob === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                {item.rob}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-gray-600">{item.minStock}</td>
                            <td className="py-3 px-3 text-right font-semibold text-red-600">{item.deficit}</td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      item.deficitPercent >= 80 ? 'bg-red-500' :
                                      item.deficitPercent >= 50 ? 'bg-orange-500' : 'bg-yellow-500'
                                    }`}
                                    style={{ width: `${Math.min(item.deficitPercent, 100)}%` }}
                                  />
                                </div>
                                <span className="text-gray-600 w-10 text-right">{item.deficitPercent}%</span>
                              </div>
                            </td>
                            {!isSpares && <td className="py-3 px-3 text-gray-600">{item.uom || '-'}</td>}
                            {!isSpares && <td className="py-3 px-3 text-right text-gray-600">{item.avgMonthlyConsumption}</td>}
                            {!isSpares && <td className="py-3 px-3 text-right">{getDaysUntilStockoutDisplay(item.daysUntilStockout)}</td>}
                            {!isSpares && <td className="py-3 px-3 text-right text-gray-700">{formatCurrency(item.estimatedCost)}</td>}
                            {!isSpares && <td className="py-3 px-3 text-gray-600">{item.supplier || '-'}</td>}
                            {!isSpares && <td className="py-3 px-3 text-gray-600">{item.leadTime || '-'}</td>}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {sortedItems.length > 0 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>Showing {sortedItems.length} of {items.length} items</span>
                </div>
              )}
            </CardContent>
          </Card>

          {!isSpares && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card data-testid="section-category-breakdown">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-gray-600" />
                    Category Breakdown
                  </CardTitle>
                  <CardDescription>Distribution of low stock items by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-purple-700">Stores</span>
                        <span className="text-sm font-semibold text-purple-700">{summary.storesCount}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-purple-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${(summary.storesCount / totalForBars) * 100}%` }}
                          data-testid="bar-stores"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-blue-700">Lubricants</span>
                        <span className="text-sm font-semibold text-blue-700">{summary.lubesCount}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${(summary.lubesCount / totalForBars) * 100}%` }}
                          data-testid="bar-lubricants"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-green-700">Chemicals</span>
                        <span className="text-sm font-semibold text-green-700">{summary.chemicalsCount}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${(summary.chemicalsCount / totalForBars) * 100}%` }}
                          data-testid="bar-chemicals"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="section-recommended-actions">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-gray-600" />
                    Recommended Actions
                  </CardTitle>
                  <CardDescription>Summary of required actions based on stock analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Total items requiring attention</span>
                      <span className="text-sm font-semibold text-gray-900">{summary.totalLowStock}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Estimated reorder cost</span>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(summary.estimatedTotalCost)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Critical items</span>
                      <span className="text-sm font-semibold text-red-600">{summary.criticalItems}</span>
                  </div>
                  <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    {summary.criticalItems > 0 ? (
                      <p className="text-sm text-gray-700">
                        <AlertCircle className="h-4 w-4 text-red-500 inline mr-1" />
                        <span className="font-semibold">Create purchase orders for {summary.criticalItems} critical item{summary.criticalItems !== 1 ? 's' : ''} immediately</span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-700">
                        <Clock className="h-4 w-4 text-yellow-500 inline mr-1" />
                        <span className="font-semibold">Monitor {summary.totalLowStock} item{summary.totalLowStock !== 1 ? 's' : ''} below minimum stock levels</span>
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          <Card data-testid="section-report-history">
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer">
                  <CardTitle className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-gray-600" />
                      Report History
                    </div>
                    {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                  <CardDescription>View previously generated report snapshots</CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {snapshotsLoading ? (
                    <div className="flex items-center justify-center py-8" data-testid="loading-snapshots">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                      <span className="text-sm text-gray-500">Loading history...</span>
                    </div>
                  ) : !snapshotsData || snapshotsData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500" data-testid="empty-snapshots">
                      <History className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No report snapshots yet. Generate a report to create the first snapshot.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {snapshotsData.map((snapshot: any) => {
                        const snapshotSummary = snapshot.summaryData as any;
                        const isViewing = viewingSnapshotId === snapshot.id;
                        return (
                          <div key={snapshot.id} className="border border-gray-200 rounded-md" data-testid={`snapshot-row-${snapshot.id}`}>
                            <div className="flex items-center justify-between gap-4 p-3 flex-wrap">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium text-gray-900">
                                    {format(new Date(snapshot.generatedAt), 'dd MMM yyyy, HH:mm')}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {snapshot.itemCount} items | Format: {snapshot.exportFormat.toUpperCase()} | By: {snapshot.generatedBy || 'System'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {snapshotSummary && (
                                  <div className="flex items-center gap-1">
                                    {snapshotSummary.criticalItems > 0 && (
                                      <Badge className="bg-red-600 text-white border-red-700 text-xs">{snapshotSummary.criticalItems} Critical</Badge>
                                    )}
                                    {snapshotSummary.highPriorityItems > 0 && (
                                      <Badge className="bg-orange-500 text-white border-orange-600 text-xs">{snapshotSummary.highPriorityItems} High</Badge>
                                    )}
                                    {snapshotSummary.mediumPriorityItems > 0 && (
                                      <Badge className="bg-yellow-500 text-white border-yellow-600 text-xs">{snapshotSummary.mediumPriorityItems} Medium</Badge>
                                    )}
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setViewingSnapshotId(isViewing ? null : snapshot.id)}
                                  data-testid={`button-view-snapshot-${snapshot.id}`}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  {isViewing ? 'Hide' : 'View'}
                                </Button>
                              </div>
                            </div>
                            {isViewing && snapshotDetail && (
                              <div className="border-t border-gray-200 p-3 bg-gray-50">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs" data-testid={`snapshot-table-${snapshot.id}`}>
                                    <thead>
                                      <tr className="bg-gray-100">
                                        <th className="px-2 py-1 text-left font-medium text-gray-600">S.No</th>
                                        <th className="px-2 py-1 text-left font-medium text-gray-600">Priority</th>
                                        <th className="px-2 py-1 text-left font-medium text-gray-600">Item Code</th>
                                        <th className="px-2 py-1 text-left font-medium text-gray-600">Item Name</th>
                                        <th className="px-2 py-1 text-left font-medium text-gray-600">Type</th>
                                        <th className="px-2 py-1 text-left font-medium text-gray-600">Category</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">ROB</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">Min Stock</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">Deficit</th>
                                        <th className="px-2 py-1 text-left font-medium text-gray-600">UOM</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">Avg Monthly</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">Days to Stockout</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">Est. Cost</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(snapshotDetail.itemsData as any[]).map((item: any, idx: number) => (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                          <td className="px-2 py-1">{idx + 1}</td>
                                          <td className="px-2 py-1">{getPriorityBadge(item.priority)}</td>
                                          <td className="px-2 py-1 font-mono">{item.itemCode}</td>
                                          <td className="px-2 py-1">{item.itemName}</td>
                                          <td className="px-2 py-1">{item.itemType}</td>
                                          <td className="px-2 py-1">{item.category}</td>
                                          <td className="px-2 py-1 text-right">{item.rob}</td>
                                          <td className="px-2 py-1 text-right">{item.minStock}</td>
                                          <td className="px-2 py-1 text-right">{item.deficit}</td>
                                          <td className="px-2 py-1">{item.uom}</td>
                                          <td className="px-2 py-1 text-right">{item.avgMonthlyConsumption}</td>
                                          <td className="px-2 py-1 text-right">{item.daysUntilStockout ?? 'N/A'}</td>
                                          <td className="px-2 py-1 text-right">{item.estimatedCost !== null ? `$${item.estimatedCost}` : 'N/A'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </>
      )}
    </div>
  );
};

export default LowStockAlertReport;
