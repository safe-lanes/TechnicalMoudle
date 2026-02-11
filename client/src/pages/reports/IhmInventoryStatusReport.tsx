import { useState, useEffect, useMemo } from "react";
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
  ArrowUpDown,
  Search,
  Download,
  FileText,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
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
}

type SortField = 'itemCode' | 'itemName' | 'itemType' | 'componentOrCategory' | 'ihmStatus' | 'evidenceType' | 'currentROB' | 'location';
type SortDirection = 'asc' | 'desc';

const IhmInventoryStatusReport: React.FC<IhmInventoryStatusReportProps> = ({ onBack, vesselId: propVesselId }) => {
  const { vesselId: contextVesselId, vessels } = useVessel();
  const effectiveVesselId = propVesselId || contextVesselId;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("itemCode");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [itemTypeFilter]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('vesselId', effectiveVesselId || '');
    if (itemTypeFilter !== 'all') params.set('itemType', itemTypeFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('sortBy', sortField);
    params.set('sortOrder', sortDirection);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return params.toString();
  }, [effectiveVesselId, itemTypeFilter, debouncedSearch, sortField, sortDirection, page, pageSize]);

  const { data, isLoading, error, refetch } = useQuery<IhmInventoryStatusResponse>({
    queryKey: ['/technical/api/reports/ihm-inventory-status', queryParams],
    queryFn: async () => {
      const res = await fetch(`/technical/api/reports/ihm-inventory-status?${queryParams}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch IHM inventory status');
      return res.json();
    },
    enabled: !!effectiveVesselId && effectiveVesselId !== 'all',
  });

  const summary = data?.summary || { totalItems: 0, ihmPresent: 0, noIhm: 0, unknown: 0 };
  const items = data?.items || [];
  const pagination = data?.pagination || { currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 25 };
  const categoryCounts = data?.categoryCounts || { all: 0, spares: 0, stores: 0 };

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

  const getIhmStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <Badge className="bg-red-600 text-white border-red-700" data-testid="badge-ihm-present">
            <AlertCircle className="h-3 w-3 mr-1" />Present
          </Badge>
        );
      case 'not_present':
        return (
          <Badge className="bg-green-600 text-white border-green-700" data-testid="badge-ihm-not-present">
            <CheckCircle className="h-3 w-3 mr-1" />Not Present
          </Badge>
        );
      case 'unknown':
      default:
        return (
          <Badge className="bg-amber-500 text-white border-amber-600" data-testid="badge-ihm-unknown">
            <HelpCircle className="h-3 w-3 mr-1" />Unknown
          </Badge>
        );
    }
  };

  const getItemTypeDisplay = (item: IhmInventoryItem) => {
    if (item.itemType === 'spare') return 'Spare';
    if (item.storeCategory) return item.storeCategory.charAt(0).toUpperCase() + item.storeCategory.slice(1);
    return 'Store';
  };

  const vesselName = vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'All Vessels';

  const handleExportPdf = async () => {
    setGeneratingPdf(true);
    try {
      const allParams = new URLSearchParams();
      allParams.set('vesselId', effectiveVesselId || '');
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

      const exportData = allData.items.map((item, idx) => ({
        sno: idx + 1,
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
        { title: 'IHM Inventory Status Report', subtitle: 'Confirmed hazardous materials present on board', vessel: vesselName },
        columns,
        exportData,
        summaryData
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

  const startItem = (pagination.currentPage - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems);

  if (!effectiveVesselId || effectiveVesselId === 'all') {
    return (
      <div className="p-6 bg-white min-h-screen">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack} data-testid="button-back-ihm-inventory">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">IHM Inventory Status Report</h1>
        </div>
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2" data-testid="text-select-vessel">Select a Vessel</h3>
          <p className="text-gray-500">Please select a vessel from the dropdown above to view the IHM inventory status report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white min-h-screen">
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
            <>
              <div className="rounded-lg border border-gray-200 overflow-x-auto bg-white mb-4">
                <table className="w-full" data-testid="ihm-inventory-table">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 w-16">S.No</th>
                      <th className="text-left py-3 px-4"><SortButton field="itemCode" label="Item Code" /></th>
                      <th className="text-left py-3 px-4"><SortButton field="itemName" label="Item Name" /></th>
                      <th className="text-left py-3 px-4"><SortButton field="itemType" label="Item Type" /></th>
                      <th className="text-left py-3 px-4"><SortButton field="componentOrCategory" label="Component / Category" /></th>
                      <th className="text-left py-3 px-4"><SortButton field="ihmStatus" label="IHM Status" /></th>
                      <th className="text-left py-3 px-4"><SortButton field="evidenceType" label="Evidence Type" /></th>
                      <th className="text-left py-3 px-4"><SortButton field="currentROB" label="Current ROB" /></th>
                      <th className="text-left py-3 px-4"><SortButton field="location" label="Location" /></th>
                      <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">UOM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50" data-testid={`row-ihm-item-${item.id}`}>
                        <td className="py-3 px-4 text-sm text-gray-500">{startItem + index}</td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900" data-testid={`text-item-code-${item.id}`}>{item.itemCode || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-900" data-testid={`text-item-name-${item.id}`}>{item.itemName || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{getItemTypeDisplay(item)}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{item.componentOrCategory || '-'}</td>
                        <td className="py-3 px-4">{getIhmStatusBadge(item.ihmStatus)}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{item.evidenceType || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{item.currentROB ?? '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{item.location || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">{item.uom || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-4" data-testid="pagination">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600" data-testid="text-page-info">
                    Showing {startItem}-{endItem} of {pagination.totalItems} items
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Page size:</span>
                    <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setPage(1); }}>
                      <SelectTrigger className="w-[80px]" data-testid="select-page-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={pagination.currentPage <= 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <span className="text-sm text-gray-600 px-2">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.currentPage >= pagination.totalPages}
                    data-testid="button-next-page"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default IhmInventoryStatusReport;
