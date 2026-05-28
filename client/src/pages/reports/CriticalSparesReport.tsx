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
  Package,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator, formatReportDateRange } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";

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
  embedded?: boolean;
  globalVessels?: string[];
  globalComponent?: string;
}

const CriticalSparesReport: React.FC<CriticalSparesReportProps> = ({ onBack, vesselId: propVesselId, embedded, globalVessels = [], globalComponent = "" }) => {
  const { vesselId: contextVesselId } = useVessel();
  const effectiveVesselId = propVesselId || contextVesselId;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("all");
  const [criticalityFilter, setCriticalityFilter] = useState("all");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);

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

    if (globalVessels.length > 0) {
      items = items.filter((i: any) => !i.vesselId || globalVessels.includes(i.vesselId));
    }

    if (globalComponent && globalComponent.trim()) {
      const gc = globalComponent.toLowerCase();
      items = items.filter(
        (i) =>
          i.partCode.toLowerCase().includes(gc) ||
          i.partName.toLowerCase().includes(gc) ||
          (i.criticalComponents && i.criticalComponents.toLowerCase().includes(gc))
      );
    }

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

    return items;
  }, [data?.data, searchQuery, criticalityFilter, globalComponent, globalVessels]);

  const getStockStatusText = (status: string) => {
    switch (status) {
      case 'ZERO': return 'Out of Stock';
      case 'LOW': return 'Low Stock';
      case 'NOT_SET': return 'Not Set';
      default: return 'Adequate';
    }
  };

  const getCriticalityText = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'Critical';
      case 'ESSENTIAL': return 'Essential';
      default: return 'Normal';
    }
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
  const meta = useMemo(() => {
    const base = filteredAndSortedItems;
    return {
      totalSpares: base.length,
      totalLinkedCriticalEquip: base.filter((i: any) => i.criticalComponents && i.criticalComponents.length > 0).length,
      totalZeroStock: base.filter((i: any) => i.stockStatus === 'ZERO').length,
      totalLowStock: base.filter((i: any) => i.stockStatus === 'LOW').length,
    };
  }, [filteredAndSortedItems]);

  const reportColumns = useMemo(() => [
    { header: 'S.No', field: 'sNo', width: 70 },
    { header: 'Part Code', field: 'partCode', width: 130 },
    { header: 'Part Name', field: 'partName', width: 200 },
    { header: 'ROB', field: 'rob', width: 80 },
    { header: 'Min Stock', field: 'minStock', width: 100 },
    { header: 'Stock Status', field: 'stockStatusText', width: 120 },
    { header: 'Shortage', field: 'shortageQty', width: 100 },
    { header: 'Criticality', field: 'criticalityText', width: 110 },
    { header: 'Critical Equip', field: 'criticalEquip', width: 120 },
    { header: 'Critical Components', field: 'criticalComponents', width: 180 },
    { header: 'Related Jobs', field: 'relatedJobs', width: 180 },
    { header: 'Dept', field: 'department', width: 100 },
    { header: 'Remarks', field: 'remarks', width: 200 },
  ], []);

  const reportData = useMemo(() => {
    return filteredAndSortedItems.map((item, idx) => ({
      sNo: idx + 1,
      partCode: item.partCode,
      partName: item.partName,
      rob: item.rob,
      minStock: item.minStock ?? '-',
      stockStatusText: getStockStatusText(item.stockStatus),
      shortageQty: item.shortageQty,
      criticalityText: getCriticalityText(item.criticalityLevel),
      criticalEquip: item.linkedToCriticalEquipment ? 'YES' : 'NO',
      criticalComponents: item.criticalComponents || '-',
      relatedJobs: item.relatedJobs || '-',
      department: item.department || '-',
      remarks: item.remarks || '-',
    }));
  }, [filteredAndSortedItems]);

  if (!effectiveVesselId) {
    return (
      <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
        {!embedded && (
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={onBack} data-testid="button-back-critical-spares">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Critical Spares Report</h1>
          </div>
        )}
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Vessel</h3>
          <p className="text-gray-500">Please select a vessel from the dropdown above to view the critical spares report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
      {!embedded && (
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
      )}

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
          {!embedded && (
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
          )}

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

          <ReportAgGridTable
            reportId="spares-critical-parts"
            columns={reportColumns}
            data={reportData}
            height="60vh"
          />

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
