import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  ShoppingCart,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Package,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";

interface LowStockAlertItem {
  id: number;
  partCode: string;
  partName: string;
  componentName: string;
  componentCode: string;
  currentQty: number;
  minThreshold: number;
  maxThreshold: number;
  shortage: number;
  shortagePercent: number;
  unitCost: number;
  valueAtRisk: number;
  criticality: string;
  leadTime: string;
  supplier: string;
  lastOrderDate: string;
  avgDailyConsumption: number;
  reorderRecommendation: number;
  priorityScore: number;
  severityLevel: 'critical' | 'warning' | 'low';
  location: string;
}

interface LowStockAlertResponse {
  summary: {
    totalAlerts: number;
    criticalCount: number;
    warningCount: number;
    lowCount: number;
    totalValueAtRisk: number;
  };
  items: LowStockAlertItem[];
}

interface LowStockAlertReportProps {
  onBack: () => void;
  vesselId?: string;
}

type SortField = 'priority' | 'shortage' | 'partName' | 'value' | 'criticality' | 'currentQty';
type SortDirection = 'asc' | 'desc';

const LowStockAlertReport: React.FC<LowStockAlertReportProps> = ({ onBack, vesselId: propVesselId }) => {
  const { vesselId: contextVesselId } = useVessel();
  const effectiveVesselId = propVesselId || contextVesselId;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [criticality, setCriticality] = useState("all");
  const [thresholdPercent, setThresholdPercent] = useState("100");
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (criticality !== 'all') params.set('criticality', criticality);
    if (thresholdPercent !== '100') params.set('thresholdPercent', thresholdPercent);
    params.set('sortBy', sortField);
    const qs = params.toString();
    return `/technical/api/reports/low-stock-alert/${effectiveVesselId}${qs ? `?${qs}` : ''}`;
  }, [effectiveVesselId, criticality, thresholdPercent, sortField]);

  const { data, isLoading, error } = useQuery<LowStockAlertResponse>({
    queryKey: ['/technical/api/reports/low-stock-alert', effectiveVesselId, criticality, thresholdPercent, sortField],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
    enabled: !!effectiveVesselId && effectiveVesselId !== 'all',
  });

  const markOrderedMutation = useMutation({
    mutationFn: async (spareId: number) => {
      await apiRequest('PATCH', `/technical/api/reports/low-stock-alert/${effectiveVesselId}/mark-ordered/${spareId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === '/technical/api/reports/low-stock-alert',
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/spares', effectiveVesselId] });
      toast({ title: "Marked as Ordered", description: "Spare part order date has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark as ordered.", variant: "destructive" });
    },
  });

  const filteredAndSortedItems = useMemo(() => {
    if (!data?.items) return [];
    let items = [...data.items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.partCode.toLowerCase().includes(q) ||
          i.partName.toLowerCase().includes(q) ||
          i.componentName.toLowerCase().includes(q) ||
          i.supplier.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'priority': cmp = a.priorityScore - b.priorityScore; break;
        case 'shortage': cmp = a.shortage - b.shortage; break;
        case 'partName': cmp = a.partName.localeCompare(b.partName); break;
        case 'value': cmp = a.valueAtRisk - b.valueAtRisk; break;
        case 'criticality': cmp = a.criticality.localeCompare(b.criticality); break;
        case 'currentQty': cmp = a.currentQty - b.currentQty; break;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return items;
  }, [data?.items, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-600 text-white border-red-700">CRITICAL</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500 text-white border-amber-600">WARNING</Badge>;
      default:
        return <Badge variant="outline">LOW</Badge>;
    }
  };

  const handleExportPdf = async () => {
    if (!data?.items || data.items.length === 0) {
      toast({ title: "No Data", description: "No items to export.", variant: "destructive" });
      return;
    }
    setGeneratingPdf(true);
    try {
      const columns = [
        { header: 'Part Code', field: 'partCode', width: 30 },
        { header: 'Part Name', field: 'partName', width: 45 },
        { header: 'Component', field: 'componentName', width: 40 },
        { header: 'Qty', field: 'currentQty', width: 15 },
        { header: 'Min', field: 'minThreshold', width: 15 },
        { header: 'Shortage', field: 'shortage', width: 20 },
        { header: 'Severity', field: 'severityLevel', width: 22 },
        { header: 'Supplier', field: 'supplier', width: 30 },
        { header: 'Reorder Qty', field: 'reorderRecommendation', width: 25 },
      ];

      const exportData = filteredAndSortedItems.map((i) => ({
        partCode: i.partCode,
        partName: i.partName,
        componentName: i.componentName,
        currentQty: i.currentQty,
        minThreshold: i.minThreshold,
        shortage: `${i.shortage} (${i.shortagePercent}%)`,
        severityLevel: i.severityLevel.toUpperCase(),
        supplier: i.supplier,
        reorderRecommendation: i.reorderRecommendation,
      }));

      const summaryData = [
        { label: 'Total Alerts', value: data.summary.totalAlerts },
        { label: 'Critical', value: data.summary.criticalCount },
        { label: 'Warning', value: data.summary.warningCount },
        { label: 'Value at Risk', value: `$${data.summary.totalValueAtRisk.toLocaleString()}` },
      ];

      pdfReportGenerator.generateReport(
        { title: 'Low Stock Alert Report', subtitle: 'Items below minimum threshold levels' },
        columns,
        exportData,
        summaryData
      );
      toast({ title: "PDF Generated", description: "Report downloaded successfully." });
    } catch (e) {
      toast({ title: "Export Failed", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const [generatingExcel, setGeneratingExcel] = useState(false);

  const handleExportExcel = async () => {
    if (!data?.items || data.items.length === 0) {
      toast({ title: "No Data", description: "No items to export.", variant: "destructive" });
      return;
    }
    setGeneratingExcel(true);
    try {
      const body: Record<string, string> = {};
      if (criticality !== 'all') body.criticality = criticality;
      if (thresholdPercent !== '100') body.thresholdPercent = thresholdPercent;
      body.sortBy = sortField;

      const res = await fetch(`/technical/api/reports/low-stock-alert/${effectiveVesselId}/excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to generate Excel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `low-stock-alert-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Excel Exported", description: "Report downloaded as Excel file." });
    } catch (err) {
      toast({ title: "Export Failed", description: "Failed to generate Excel report.", variant: "destructive" });
    } finally {
      setGeneratingExcel(false);
    }
  };

  const summary = data?.summary;

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

  if (!effectiveVesselId || effectiveVesselId === 'all') {
    return (
      <div className="p-6 bg-white min-h-screen">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack} data-testid="button-back-low-stock">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Low Stock Alert Report</h1>
        </div>
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Vessel</h3>
          <p className="text-gray-500">Please select a vessel from the dropdown above to view the low stock alert report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} data-testid="button-back-low-stock">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Low Stock Alert Report</h1>
            <p className="text-sm text-gray-500">Critical and low stock items requiring immediate attention</p>
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
            disabled={isLoading || generatingExcel}
            data-testid="button-export-excel"
          >
            <Download className="h-4 w-4 mr-2" /> {generatingExcel ? 'Generating...' : 'Export Excel'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Generating report...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Failed to Load Report</h3>
          <p className="text-gray-500">Please try again or select a different vessel.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card data-testid="card-total-alerts">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Total Alerts
                </CardDescription>
                <CardTitle className="text-3xl">{summary?.totalAlerts || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card data-testid="card-critical-count">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Critical
                </CardDescription>
                <CardTitle className="text-3xl text-red-600">{summary?.criticalCount || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card data-testid="card-warning-count">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4 text-amber-500" />
                  Warning
                </CardDescription>
                <CardTitle className="text-3xl text-amber-600">{summary?.warningCount || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card data-testid="card-value-at-risk">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-blue-500" />
                  Value at Risk
                </CardDescription>
                <CardTitle className="text-3xl text-blue-600">
                  ${(summary?.totalValueAtRisk || 0).toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search parts, components, suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-low-stock"
              />
            </div>
            <Select value={criticality} onValueChange={setCriticality}>
              <SelectTrigger className="w-[160px]" data-testid="select-criticality">
                <SelectValue placeholder="Criticality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="non-critical">Non-Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={thresholdPercent} onValueChange={setThresholdPercent}>
              <SelectTrigger className="w-[180px]" data-testid="select-threshold">
                <SelectValue placeholder="Threshold" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">At or Below Min</SelectItem>
                <SelectItem value="75">Below 75% of Min</SelectItem>
                <SelectItem value="50">Below 50% of Min</SelectItem>
                <SelectItem value="25">Below 25% of Min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-low-stock-alerts">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-3"><SortButton field="priority" label="Severity" /></th>
                    <th className="text-left py-3 px-3"><SortButton field="partName" label="Part Details" /></th>
                    <th className="text-left py-3 px-3">Component</th>
                    <th className="text-right py-3 px-3"><SortButton field="currentQty" label="Qty" /></th>
                    <th className="text-right py-3 px-3">Min</th>
                    <th className="text-right py-3 px-3"><SortButton field="shortage" label="Shortage" /></th>
                    <th className="text-left py-3 px-3"><SortButton field="criticality" label="Criticality" /></th>
                    <th className="text-left py-3 px-3">Lead Time</th>
                    <th className="text-left py-3 px-3">Supplier</th>
                    <th className="text-right py-3 px-3"><SortButton field="value" label="Value at Risk" /></th>
                    <th className="text-right py-3 px-3">Reorder Qty</th>
                    <th className="text-left py-3 px-3">Last Ordered</th>
                    <th className="text-center py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAndSortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12">
                        <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No low stock alerts found</p>
                        <p className="text-sm text-gray-400 mt-1">All items are above minimum threshold levels</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50 ${
                          item.severityLevel === 'critical' ? 'bg-red-50/40' :
                          item.severityLevel === 'warning' ? 'bg-amber-50/30' : ''
                        }`}
                        data-testid={`row-low-stock-${item.id}`}
                      >
                        <td className="py-3 px-3">{getSeverityBadge(item.severityLevel)}</td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-900 text-sm">{item.partName}</div>
                          <div className="text-xs text-gray-500">{item.partCode}</div>
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-700">{item.componentName}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-semibold text-sm ${
                            item.currentQty === 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {item.currentQty}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-gray-600">{item.minThreshold}</td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-semibold text-sm text-red-600">{item.shortage}</span>
                          <span className="text-xs text-gray-400 ml-1">({item.shortagePercent}%)</span>
                        </td>
                        <td className="py-3 px-3">
                          {item.criticality === 'Critical' ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">Critical</Badge>
                          ) : (
                            <Badge variant="outline">Standard</Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-600">{item.leadTime}</td>
                        <td className="py-3 px-3 text-sm text-gray-600">{item.supplier}</td>
                        <td className="py-3 px-3 text-right text-sm font-medium text-gray-900">
                          {item.valueAtRisk > 0 ? `$${item.valueAtRisk.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-sm font-semibold text-blue-600">{item.reorderRecommendation}</span>
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-500">{item.lastOrderDate}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Mark as Ordered"
                              onClick={() => markOrderedMutation.mutate(item.id)}
                              disabled={markOrderedMutation.isPending}
                              data-testid={`button-mark-ordered-${item.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Generate PO"
                              onClick={() => {
                                toast({
                                  title: "Purchase Order",
                                  description: `PO generation for ${item.partName} - feature coming soon.`,
                                });
                              }}
                              data-testid={`button-generate-po-${item.id}`}
                            >
                              <ShoppingCart className="h-4 w-4 text-blue-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredAndSortedItems.length > 0 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>
                Showing {filteredAndSortedItems.length} of {data?.summary.totalAlerts || 0} alerts
              </span>
              <span>
                Avg daily consumption calculated from 90-day history
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LowStockAlertReport;
