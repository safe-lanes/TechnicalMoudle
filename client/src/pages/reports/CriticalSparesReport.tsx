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
  Package,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator, formatReportDateRange } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { TablePagination, usePagination } from "@/components/reports/TablePagination";

interface CriticalSpareRow {
  sNo: number;
  vesselName: string;
  partCode: string;
  partName: string;
  rob: number;
  minStock: number | null;
  stockStatus: 'ZERO' | 'LOW' | 'OK' | 'NOT_SET';
  shortageQty: number;
  criticalityLevel: 'CRITICAL' | 'ESSENTIAL' | 'NORMAL';
  linkedToCriticalEquipment: boolean;
  criticalComponents: string;
  relatedJobs: string;
  department: string | null;
  remarks: string;
}

interface CriticalSparesResponse {
  success: boolean;
  reportMeta: {
    reportType: string;
    vesselId: string;
    vesselName: string;
    generatedAt: string;
    totalSpares: number;
    totalCritical: number;
    totalEssential: number;
    totalLinkedCriticalEquip: number;
    totalZeroStock: number;
    totalLowStock: number;
  };
  data: CriticalSpareRow[];
  summary: {
    byStatus: { ZERO: number; LOW: number; OK: number; NOT_SET: number };
    byCriticality: { CRITICAL: number; ESSENTIAL: number; NORMAL: number };
    totalShortage: number;
  };
}

interface CriticalSparesReportProps {
  onBack: () => void;
  vesselId?: string;
}

type SortField = 'partCode' | 'partName' | 'rob' | 'shortageQty' | 'stockStatus' | 'criticalityLevel';
type SortDirection = 'asc' | 'desc';

const CriticalSparesReport: React.FC<CriticalSparesReportProps> = ({ onBack, vesselId: propVesselId }) => {
  const { vesselId: contextVesselId } = useVessel();
  const effectiveVesselId = propVesselId || contextVesselId;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("all");
  const [criticalityFilter, setCriticalityFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>('stockStatus');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, resetPage, paginateItems } = usePagination(25);

  useEffect(() => {
    resetPage();
  }, [searchQuery, stockStatusFilter, criticalityFilter]);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('vesselId', effectiveVesselId || '');
    if (stockStatusFilter !== 'all') params.set('stockStatus', stockStatusFilter);
    return `/technical/api/reports/critical-spares/preview?${params.toString()}`;
  }, [effectiveVesselId, stockStatusFilter]);

  const { data, isLoading, error } = useQuery<CriticalSparesResponse>({
    queryKey: ['/technical/api/reports/critical-spares/preview', effectiveVesselId, stockStatusFilter],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
    enabled: !!effectiveVesselId,
  });

  const filteredAndSortedItems = useMemo(() => {
    if (!data?.data) return [];
    let items = [...data.data];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.partCode.toLowerCase().includes(q) ||
          i.partName.toLowerCase().includes(q) ||
          (i.criticalComponents && i.criticalComponents.toLowerCase().includes(q)) ||
          (i.relatedJobs && i.relatedJobs.toLowerCase().includes(q))
      );
    }

    if (criticalityFilter !== 'all') {
      items = items.filter(i => i.criticalityLevel === criticalityFilter);
    }

    items.sort((a, b) => {
      let cmp = 0;
      const statusPriority: Record<string, number> = { ZERO: 1, LOW: 2, OK: 3, NOT_SET: 4 };
      const critPriority: Record<string, number> = { CRITICAL: 1, ESSENTIAL: 2, NORMAL: 3 };
      switch (sortField) {
        case 'stockStatus': cmp = (statusPriority[a.stockStatus] || 5) - (statusPriority[b.stockStatus] || 5); break;
        case 'criticalityLevel': cmp = (critPriority[a.criticalityLevel] || 4) - (critPriority[b.criticalityLevel] || 4); break;
        case 'shortageQty': cmp = a.shortageQty - b.shortageQty; break;
        case 'rob': cmp = a.rob - b.rob; break;
        case 'partName': cmp = a.partName.localeCompare(b.partName); break;
        case 'partCode': cmp = a.partCode.localeCompare(b.partCode); break;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return items;
  }, [data?.data, searchQuery, criticalityFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStockStatusBadge = (status: string) => {
    switch (status) {
      case 'ZERO':
        return <Badge className="bg-red-600 text-white border-red-700">Out of Stock</Badge>;
      case 'LOW':
        return <Badge className="bg-amber-500 text-white border-amber-600">Low Stock</Badge>;
      case 'NOT_SET':
        return <Badge variant="outline" className="text-gray-500">Not Set</Badge>;
      default:
        return <Badge className="bg-green-600 text-white border-green-700">Adequate</Badge>;
    }
  };

  const getCriticalityBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Critical</Badge>;
      case 'ESSENTIAL':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Essential</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500">Normal</Badge>;
    }
  };

  const getRowBg = (row: CriticalSpareRow) => {
    if (row.stockStatus === 'ZERO') return 'bg-red-50/50';
    if (row.stockStatus === 'LOW' && row.criticalityLevel === 'CRITICAL') return 'bg-orange-50/50';
    if (row.stockStatus === 'LOW') return 'bg-amber-50/30';
    return '';
  };

  const handleExportPdf = async () => {
    if (!data?.data || data.data.length === 0) {
      toast({ title: "No Data", description: "No items to export.", variant: "destructive" });
      return;
    }
    setGeneratingPdf(true);
    try {
      const columns = [
        { header: 'S.No', field: 'sNo', width: 10 },
        { header: 'Part Code', field: 'partCode', width: 28 },
        { header: 'Part Name', field: 'partName', width: 45 },
        { header: 'ROB', field: 'rob', width: 12 },
        { header: 'Min Stock', field: 'minStock', width: 15 },
        { header: 'Status', field: 'stockStatus', width: 18 },
        { header: 'Shortage', field: 'shortageQty', width: 15 },
        { header: 'Criticality', field: 'criticalityLevel', width: 18 },
        { header: 'Critical Equip', field: 'criticalEquip', width: 20 },
        { header: 'Remarks', field: 'remarks', width: 45 },
      ];

      const exportData = filteredAndSortedItems.map((i, idx) => ({
        sNo: idx + 1,
        partCode: i.partCode,
        partName: i.partName,
        rob: i.rob,
        minStock: i.minStock ?? '-',
        stockStatus: i.stockStatus,
        shortageQty: i.shortageQty,
        criticalityLevel: i.criticalityLevel,
        criticalEquip: i.linkedToCriticalEquipment ? 'YES' : 'NO',
        remarks: i.remarks,
      }));

      const summaryData = [
        { label: 'Total Critical Spares', value: data.reportMeta.totalSpares },
        { label: 'Critical Equipment Spares', value: data.reportMeta.totalLinkedCriticalEquip },
        { label: 'Out of Stock', value: data.reportMeta.totalZeroStock },
        { label: 'Low Stock', value: data.reportMeta.totalLowStock },
        { label: 'Total Shortage', value: `${data.summary.totalShortage} units` },
      ];

      pdfReportGenerator.generateReport(
        { title: 'Critical Spares Report', subtitle: 'Status of Critical and Essential Spare Parts Inventory', vessel: data.reportMeta.vesselName, orientation: 'landscape', dateRange: 'All Time' },
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

  const handleExportExcel = async () => {
    if (!data?.data || data.data.length === 0) {
      toast({ title: "No Data", description: "No items to export.", variant: "destructive" });
      return;
    }
    setGeneratingExcel(true);
    try {
      const filters: Record<string, any> = {};
      if (stockStatusFilter !== 'all') filters.stockStatus = [stockStatusFilter];

      const res = await fetch('/technical/api/reports/critical-spares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vesselId: effectiveVesselId, filters }),
      });
      if (!res.ok) throw new Error('Failed to generate Excel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `critical-spares-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
  const meta = data?.reportMeta;

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

  if (!effectiveVesselId) {
    return (
      <div className="p-6 bg-white min-h-screen">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack} data-testid="button-back-critical-spares">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Critical Spares Report</h1>
        </div>
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Vessel</h3>
          <p className="text-gray-500">Please select a vessel from the dropdown above to view the critical spares report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} data-testid="button-back-critical-spares">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Critical Spares Report</h1>
            <p className="text-sm text-gray-500">Status of critical and essential spare parts inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleExportPdf}
            disabled={generatingPdf || isLoading}
            data-testid="button-export-pdf-critical"
          >
            {generatingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isLoading || generatingExcel}
            data-testid="button-export-excel-critical"
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
            <Card data-testid="card-total-critical-spares">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Package className="w-4 h-4 text-blue-500" />
                  Total Critical Spares
                </CardDescription>
                <CardTitle className="text-3xl">{meta?.totalSpares || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card data-testid="card-critical-equipment-spares">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  Critical Equipment Spares
                </CardDescription>
                <CardTitle className="text-3xl text-red-600">{meta?.totalLinkedCriticalEquip || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card data-testid="card-out-of-stock">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Out of Stock Critical Parts
                </CardDescription>
                <CardTitle className="text-3xl text-red-600">{meta?.totalZeroStock || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card data-testid="card-low-stock">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  Low Stock Critical Parts
                </CardDescription>
                <CardTitle className="text-3xl text-amber-600">{meta?.totalLowStock || 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search parts, components, jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-critical-spares"
              />
            </div>
            <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-stock-status">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ZERO">Out of Stock</SelectItem>
                <SelectItem value="LOW">Low Stock</SelectItem>
                <SelectItem value="OK">Adequate</SelectItem>
                <SelectItem value="NOT_SET">Not Set</SelectItem>
              </SelectContent>
            </Select>
            <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-criticality-filter">
                <SelectValue placeholder="Criticality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Criticality</SelectItem>
                <SelectItem value="CRITICAL">Critical Only</SelectItem>
                <SelectItem value="ESSENTIAL">Essential Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-critical-spares">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-center py-3 px-3 w-14 font-semibold text-sm text-gray-700">S.No</th>
                    <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700"><SortButton field="partCode" label="Part Code" /></th>
                    <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700"><SortButton field="partName" label="Part Name" /></th>
                    <th className="text-right py-3 px-3 font-semibold text-sm text-gray-700"><SortButton field="rob" label="ROB" /></th>
                    <th className="text-right py-3 px-3 font-semibold text-sm text-gray-700">Min Stock</th>
                    <th className="text-center py-3 px-3 font-semibold text-sm text-gray-700"><SortButton field="stockStatus" label="Stock Status" /></th>
                    <th className="text-right py-3 px-3 font-semibold text-sm text-gray-700"><SortButton field="shortageQty" label="Shortage" /></th>
                    <th className="text-center py-3 px-3 font-semibold text-sm text-gray-700"><SortButton field="criticalityLevel" label="Criticality" /></th>
                    <th className="text-center py-3 px-3 font-semibold text-sm text-gray-700">Critical Equip</th>
                    <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Critical Components</th>
                    <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Related Jobs</th>
                    <th className="text-center py-3 px-3 font-semibold text-sm text-gray-700">Dept</th>
                    <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAndSortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12">
                        <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No critical spares found</p>
                        <p className="text-sm text-gray-400 mt-1">No spare parts match the current filter criteria</p>
                      </td>
                    </tr>
                  ) : (
                    paginateItems(filteredAndSortedItems).map((item, idx) => {
                      const globalIdx = (currentPage - 1) * pageSize + idx;
                      return (
                      <tr
                        key={`${item.partCode}-${globalIdx}`}
                        className={`hover:bg-gray-50 ${getRowBg(item)}`}
                        data-testid={`row-critical-spare-${globalIdx}`}
                      >
                        <td className="py-3 px-3 text-center text-sm text-gray-500">{globalIdx + 1}</td>
                        <td className="py-3 px-3 text-sm text-gray-700 font-mono">{item.partCode}</td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-900 text-sm max-w-[200px] truncate" title={item.partName}>{item.partName}</div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-semibold text-sm ${item.rob === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.rob}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-gray-600">{item.minStock ?? '-'}</td>
                        <td className="py-3 px-3 text-center">{getStockStatusBadge(item.stockStatus)}</td>
                        <td className="py-3 px-3 text-right">
                          {item.shortageQty > 0 ? (
                            <span className="font-semibold text-sm text-red-600">{item.shortageQty}</span>
                          ) : (
                            <span className="text-sm text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">{getCriticalityBadge(item.criticalityLevel)}</td>
                        <td className="py-3 px-3 text-center">
                          {item.linkedToCriticalEquipment ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200">YES</Badge>
                          ) : (
                            <span className="text-sm text-gray-400">NO</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-sm text-gray-700 max-w-[180px] truncate" title={item.criticalComponents}>
                            {item.criticalComponents || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-sm text-gray-700 max-w-[180px] truncate" title={item.relatedJobs}>
                            {item.relatedJobs || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center text-sm text-gray-600">{item.department || '-'}</td>
                        <td className="py-3 px-3">
                          <div className="text-sm text-gray-600 max-w-[250px]" title={item.remarks}>
                            {item.remarks}
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredAndSortedItems.length > 0 && (
            <div className="mt-4">
              <TablePagination
                totalItems={filteredAndSortedItems.length}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}

          {filteredAndSortedItems.length > 0 && (
            <div className="flex items-center justify-between mt-4 flex-wrap gap-4">
              <span className="text-sm text-gray-500">
                Showing {filteredAndSortedItems.length} of {meta?.totalSpares || 0} critical/essential spares
              </span>
              {summary && (
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Critical: <strong className="text-red-600">{summary.byCriticality.CRITICAL || 0}</strong></span>
                  <span>Essential: <strong className="text-amber-600">{summary.byCriticality.ESSENTIAL || 0}</strong></span>
                  <span>Total Shortage: <strong className="text-red-600">{summary.totalShortage} units</strong></span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CriticalSparesReport;
