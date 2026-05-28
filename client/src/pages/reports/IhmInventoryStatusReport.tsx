import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Search,
  Download,
  FileText,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Package,
} from "lucide-react";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator, formatReportDateRange } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";

interface IhmInventoryItem {
  id: number;
  itemCode: string;
  itemName: string;
  itemType: 'spare' | 'store';
  storeCategory: string;
  componentOrCategory: string;
  ihmStatus: 'present' | 'not_present' | 'unknown';
  evidenceType: string;
  hazardClassification: string;
  sdsReference: string;
  currentROB: number;
  uom: string;
  location: string;
  partNumber: string;
  lastUpdated: string;
}

interface IhmInventoryStatusResponse {
  summary: {
    totalItems: number;
    ihmPresent: number;
    noIhm: number;
    unknown: number;
  };
  items: IhmInventoryItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
  };
  categoryCounts: {
    all: number;
    spares: number;
    stores: number;
  };
}

interface IhmInventoryStatusReportProps {
  onBack: () => void;
  vesselId?: string;
  embedded?: boolean;
  globalVessels?: string[];
  globalComponent?: string;
}

type SortField = 'itemCode' | 'itemName' | 'itemType' | 'componentOrCategory' | 'ihmStatus' | 'evidenceType' | 'currentROB' | 'location';
type SortDirection = 'asc' | 'desc';

const IhmInventoryStatusReport: React.FC<IhmInventoryStatusReportProps> = ({ onBack, vesselId: propVesselId, embedded, globalVessels = [], globalComponent = "" }) => {
  const { vesselId: contextVesselId, vessels } = useVessel();
  const effectiveVesselId = propVesselId || contextVesselId;
  const { toast } = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("itemCode");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleGridSortChanged = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field as SortField);
    setSortDirection(direction);
  }, []);

  const isMultiVessel = effectiveVesselId === 'all' && globalVessels.length > 0;
  const vesselIdsParam = isMultiVessel ? globalVessels.join(',') : '';

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('vesselId', effectiveVesselId || '');
    if (vesselIdsParam) params.set('vesselIds', vesselIdsParam);
    if (itemTypeFilter !== 'all') params.set('itemType', itemTypeFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('sortBy', sortField);
    params.set('sortOrder', sortDirection);
    params.set('page', '1');
    params.set('pageSize', '10000');
    return params.toString();
  }, [effectiveVesselId, vesselIdsParam, itemTypeFilter, debouncedSearch, sortField, sortDirection]);

  const { data, isLoading, error, refetch } = useQuery<IhmInventoryStatusResponse>({
    queryKey: ['/technical/api/reports/ihm-inventory-status', queryParams],
    queryFn: async () => {
      const res = await fetch(`/technical/api/reports/ihm-inventory-status?${queryParams}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch IHM inventory status');
      return res.json();
    },
    enabled: !!effectiveVesselId,
  });

  const rawItems: IhmInventoryItem[] = data?.items || [];
  const filteredByGlobal = useMemo(() => {
    let result = rawItems;
    if (globalVessels.length > 0 && vessels.length > 0 && globalVessels.length < vessels.length) {
      result = result.filter((item: IhmInventoryItem & { vesselId?: string }) => !item.vesselId || globalVessels.includes(item.vesselId));
    }
    if (globalComponent) {
      const q = globalComponent.toLowerCase();
      result = result.filter((item: IhmInventoryItem) => {
        const name = (item.itemName || item.componentOrCategory || "").toLowerCase();
        const code = (item.itemCode || "").toLowerCase();
        return name.includes(q) || code.includes(q);
      });
    }
    return result;
  }, [rawItems, globalVessels, globalComponent, vessels.length]);

  const summary = useMemo(() => {
    if (globalVessels.length === 0 && !globalComponent && data?.summary) return data.summary;
    return {
      totalItems: filteredByGlobal.length,
      ihmPresent: filteredByGlobal.filter((i: IhmInventoryItem) => i.ihmStatus === 'present').length,
      noIhm: filteredByGlobal.filter((i: IhmInventoryItem) => i.ihmStatus === 'not_present').length,
      unknown: filteredByGlobal.filter((i: IhmInventoryItem) => i.ihmStatus !== 'present' && i.ihmStatus !== 'not_present').length,
    };
  }, [filteredByGlobal, globalVessels.length, globalComponent, data?.summary]);
  const items = filteredByGlobal;
  const categoryCounts = data?.categoryCounts || { all: 0, spares: 0, stores: 0 };

  const getItemTypeDisplay = (item: IhmInventoryItem) => {
    if (item.itemType === 'spare') return 'Spare';
    if (item.storeCategory) return item.storeCategory.charAt(0).toUpperCase() + item.storeCategory.slice(1);
    return 'Store';
  };

  const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');

  const handleExportPdf = async () => {
    setGeneratingPdf(true);
    try {
      const allParams = new URLSearchParams();
      allParams.set('vesselId', effectiveVesselId || '');
      if (vesselIdsParam) allParams.set('vesselIds', vesselIdsParam);
      if (itemTypeFilter !== 'all') allParams.set('itemType', itemTypeFilter);
      if (debouncedSearch) allParams.set('search', debouncedSearch);
      allParams.set('sortBy', sortField);
      allParams.set('sortOrder', sortDirection);
      allParams.set('page', '1');
      allParams.set('pageSize', '10000');

      const res = await fetch(`/technical/api/reports/ihm-inventory-status?${allParams.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch data for PDF');
      const allData: IhmInventoryStatusResponse = await res.json();

      if (allData.items.length === 0) {
        toast({ title: "No Data", description: "No items to export.", variant: "destructive" });
        setGeneratingPdf(false);
        return;
      }

      const columns = [
        { header: 'S.No', field: 'sno', width: 12 },
        ...(isMultiVessel ? [{ header: 'Vessel', field: 'vesselName', width: 25 }] : []),
        { header: 'Item Code', field: 'itemCode', width: 25 },
        { header: 'Item Name', field: 'itemName', width: 45 },
        { header: 'Item Type', field: 'itemType', width: 20 },
        { header: 'Component / Category', field: 'componentOrCategory', width: 35 },
        { header: 'IHM Status', field: 'ihmStatus', width: 22 },
        { header: 'Evidence Type', field: 'evidenceType', width: 25 },
        { header: 'Current ROB', field: 'currentROB', width: 20 },
        { header: 'Location', field: 'location', width: 25 },
        { header: 'UOM', field: 'uom', width: 15 },
      ];

      const exportData = allData.items.map((item: any, idx: number) => ({
        sno: idx + 1,
        vesselName: item.vesselName || '-',
        itemCode: item.itemCode || '-',
        itemName: item.itemName || '-',
        itemType: item.itemType === 'spare' ? 'Spare' : (item.storeCategory || 'Store'),
        componentOrCategory: item.componentOrCategory || '-',
        ihmStatus: item.ihmStatus === 'present' ? 'Present' : item.ihmStatus === 'not_present' ? 'Not Present' : 'Unknown',
        evidenceType: item.evidenceType || '-',
        currentROB: item.currentROB ?? '-',
        location: item.location || '-',
        uom: item.uom || '-',
      }));

      const summaryData = [
        { label: 'Total Items', value: allData.summary.totalItems },
        { label: 'IHM Present', value: allData.summary.ihmPresent },
        { label: 'No IHM', value: allData.summary.noIhm },
        { label: 'Unknown', value: allData.summary.unknown },
      ];

      pdfReportGenerator.generateReport(
        { title: 'IHM Inventory Status Report', subtitle: 'Confirmed hazardous materials present on board', vessel: vesselName, dateRange: 'All Time' },
        columns,
        exportData
      );
      toast({ title: "PDF Generated", description: "Report downloaded successfully." });
    } catch (e: any) {
      console.error("PDF export error:", e);
      toast({ title: "Export Failed", description: e?.message || "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const res = await fetch('/technical/api/reports/ihm-inventory-status/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          vesselId: effectiveVesselId,
          vesselIds: vesselIdsParam ? vesselIdsParam.split(',').filter(Boolean) : undefined,
          itemType: itemTypeFilter !== 'all' ? itemTypeFilter : undefined,
          search: debouncedSearch || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate Excel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ihm-inventory-status-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);
      toast({ title: "Excel Exported", description: "Report downloaded as Excel file." });
    } catch (err: any) {
      console.error("Excel export error:", err);
      toast({ title: "Export Failed", description: err?.message || "Failed to generate Excel report.", variant: "destructive" });
    } finally {
      setExportingExcel(false);
    }
  };


  if (!effectiveVesselId) {
    return (
      <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
        {!embedded && (
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={onBack} data-testid="button-back-ihm-inventory">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">IHM Inventory Status Report</h1>
          </div>
        )}
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2" data-testid="text-select-vessel">Select a Vessel</h3>
          <p className="text-gray-500">Please select a vessel from the dropdown above to view the IHM inventory status report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} data-testid="button-back-ihm-inventory">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="text-report-title">IHM Inventory Status Report</h1>
              <p className="text-sm text-gray-500">Confirmed hazardous materials present on board</p>
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
              disabled={exportingExcel || isLoading}
              data-testid="button-export-excel"
            >
              {exportingExcel ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Export Excel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16" data-testid="loading-spinner">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading inventory data...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16" data-testid="error-state">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Failed to Load Report</h3>
          <p className="text-gray-500 mb-4">Please try again or select a different vessel.</p>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-retry">
            Retry
          </Button>
        </div>
      ) : (
        <>
          {!embedded && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card className="border-l-4 border-l-red-500 bg-white" data-testid="card-total-items">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    Total IHM Items
                  </CardDescription>
                  <CardTitle className="text-3xl text-red-600">{summary.totalItems}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-l-4 border-l-blue-500 bg-white" data-testid="card-spares">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Package className="w-4 h-4 text-blue-500" />
                    Spares with IHM
                  </CardDescription>
                  <CardTitle className="text-3xl text-blue-600">{categoryCounts.spares}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-l-4 border-l-purple-500 bg-white" data-testid="card-stores">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Package className="w-4 h-4 text-purple-500" />
                    Stores with IHM
                  </CardDescription>
                  <CardTitle className="text-3xl text-purple-600">{categoryCounts.stores}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by code, name, component..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 mb-4" data-testid="item-type-tabs">
            <Button
              variant={itemTypeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setItemTypeFilter('all')}
              data-testid="tab-all"
            >
              All ({categoryCounts.all})
            </Button>
            <Button
              variant={itemTypeFilter === 'spare' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setItemTypeFilter('spare')}
              data-testid="tab-spares"
            >
              Spares ({categoryCounts.spares})
            </Button>
            <Button
              variant={itemTypeFilter === 'store' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setItemTypeFilter('store')}
              data-testid="tab-stores"
            >
              Stores ({categoryCounts.stores})
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-16" data-testid="empty-state">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No IHM inventory items found</h3>
              <p className="text-gray-500">Try adjusting your filters or search criteria.</p>
            </div>
          ) : (
            <div data-testid="ihm-inventory-table">
              <ReportAgGridTable
                reportId="ihm-inventory-status"
                columns={[
                  { header: 'S.No', field: 'sno', width: 70 },
                  ...(isMultiVessel ? [{ header: 'Vessel', field: 'vesselName', width: 150 }] : []),
                  { header: 'Item Code', field: 'itemCode', width: 120 },
                  { header: 'Item Name', field: 'itemName', width: 200 },
                  { header: 'Item Type', field: 'itemType', width: 100 },
                  { header: 'Component / Category', field: 'componentOrCategory', width: 180 },
                  { header: 'IHM Status', field: 'ihmStatus', width: 120 },
                  { header: 'Evidence Type', field: 'evidenceType', width: 130 },
                  { header: 'Current ROB', field: 'currentROB', width: 110 },
                  { header: 'Location', field: 'location', width: 130 },
                  { header: 'UOM', field: 'uom', width: 80 },
                ]}
                data={items.map((item: any, index: number) => ({
                  sno: index + 1,
                  vesselName: item.vesselName || '-',
                  itemCode: item.itemCode || '-',
                  itemName: item.itemName || '-',
                  itemType: getItemTypeDisplay(item),
                  componentOrCategory: item.componentOrCategory || '-',
                  ihmStatus: item.ihmStatus === 'present' ? 'Present' : item.ihmStatus === 'not_present' ? 'Not Present' : 'Unknown',
                  evidenceType: item.evidenceType || '-',
                  currentROB: item.currentROB ?? '-',
                  location: item.location || '-',
                  uom: item.uom || '-',
                }))}
                height="60vh"
                onSortChanged={handleGridSortChanged}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IhmInventoryStatusReport;
