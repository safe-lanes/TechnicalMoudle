import { useState, useMemo, useEffect } from "react";
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
  ArrowLeft,
  AlertTriangle,
  Search,
  FileText,
  Loader2,
  ArrowUpDown,
  Beaker,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  FlaskConical,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator, formatReportDateRange } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { format } from "date-fns";
import { TablePagination, usePagination } from "@/components/reports/TablePagination";

interface ChemicalItem {
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
  manufactureDate: string | null;
  expiryDate: string | null;
  batchNumber: string | null;
  lotNumber: string | null;
  shelfLifeMonths: number | null;
  sdsReference: string | null;
  sdsDocumentUrl: string | null;
  sdsLastUpdated: string | null;
  hazardClassification: string | null;
  unNumber: string | null;
  flashPoint: string | null;
  storageTempMin: number | null;
  storageTempMax: number | null;
  disposalInstructions: string | null;
  ppeRequirements: string | null;
  emergencyContact: string | null;
  daysUntilExpiry: number | null;
  expiryStatus: "Expired" | "Critical" | "High" | "Medium" | "OK" | "No Date";
  stockStatus: "Critical" | "Low" | "OK";
  hasSds: boolean;
}

interface ChemicalsSummary {
  totalChemicals: number;
  expiredCount: number;
  expiringSoonCount: number;
  sdsCompliancePercent: number;
  withSds: number;
  withoutSds: number;
  lowStockCount: number;
}

interface ChemicalsExpiryResponse {
  items: ChemicalItem[];
  summary: ChemicalsSummary;
}

interface ChemicalsExpiryReportProps {
  onBack: () => void;
  vesselId?: string;
  embedded?: boolean;
  globalVessels?: string[];
  globalComponent?: string;
}

type SortField = 'itemCode' | 'itemName' | 'batchNumber' | 'manufactureDate' | 'expiryDate' | 'daysUntilExpiry' | 'rob' | 'min' | 'stockStatus' | 'locationA' | 'hazardClassification' | 'hasSds';
type SortDirection = 'asc' | 'desc';

function formatDate(date: string | null): string {
  if (!date) return '-';
  try {
    return format(new Date(date), 'dd MMM yyyy');
  } catch {
    return '-';
  }
}

function getExpiryStatusBadge(status: string) {
  switch (status) {
    case 'Expired':
      return <Badge className="bg-red-600 text-white border-red-700">Expired</Badge>;
    case 'Critical':
      return <Badge className="bg-orange-500 text-white border-orange-600">Critical</Badge>;
    case 'High':
      return <Badge className="bg-yellow-500 text-white border-yellow-600">High</Badge>;
    case 'Medium':
      return <Badge className="bg-yellow-400 text-gray-900 border-yellow-500">Medium</Badge>;
    case 'OK':
      return <Badge className="bg-green-500 text-white border-green-600">OK</Badge>;
    case 'No Date':
      return <Badge className="bg-gray-400 text-white border-gray-500">No Date</Badge>;
    default:
      return <Badge className="bg-gray-400 text-white border-gray-500">{status}</Badge>;
  }
}

function getStockStatusBadge(status: string) {
  switch (status) {
    case 'Critical':
      return <Badge className="bg-red-600 text-white border-red-700">Critical</Badge>;
    case 'Low':
      return <Badge className="bg-amber-500 text-white border-amber-600">Low</Badge>;
    default:
      return <Badge className="bg-green-600 text-white border-green-700">OK</Badge>;
  }
}

function getHazardBadge(hazardClass: string | null) {
  if (!hazardClass || hazardClass === 'None') {
    return <Badge className="bg-gray-100 text-gray-700 border-gray-200">None</Badge>;
  }
  switch (hazardClass) {
    case 'Flammable':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Flammable</Badge>;
    case 'Toxic':
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Toxic</Badge>;
    case 'Corrosive':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Corrosive</Badge>;
    case 'Oxidizer':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Oxidizer</Badge>;
    case 'Compressed Gas':
      return <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200">Compressed Gas</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{hazardClass}</Badge>;
  }
}

function getExpiryDateColor(item: ChemicalItem): string {
  if (!item.expiryDate) return 'text-gray-500';
  if (item.expiryStatus === 'Expired') return 'text-red-600 font-semibold';
  if (item.daysUntilExpiry !== null && item.daysUntilExpiry <= 30) return 'text-orange-500 font-semibold';
  if (item.daysUntilExpiry !== null && item.daysUntilExpiry > 90) return 'text-green-600';
  return 'text-gray-900';
}

const ChemicalsExpiryReport: React.FC<ChemicalsExpiryReportProps> = ({ onBack, vesselId: propVesselId, embedded, globalVessels = [], globalComponent = "" }) => {
  const { vesselId: contextVesselId } = useVessel();
  const effectiveVesselId = propVesselId || contextVesselId;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [hazardFilter, setHazardFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>('itemCode');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, resetPage, paginateItems } = usePagination(25);

  useEffect(() => {
    resetPage();
  }, [searchQuery, expiryFilter, hazardFilter, stockFilter]);

  const { data, isLoading, error } = useQuery<ChemicalsExpiryResponse>({
    queryKey: [`/technical/api/reports/chemicals-expiry/${effectiveVesselId}`],
    enabled: !!effectiveVesselId,
  });

  const items = data?.items || [];
  const summary = data?.summary || {
    totalChemicals: 0,
    expiredCount: 0,
    expiringSoonCount: 0,
    sdsCompliancePercent: 0,
    withSds: 0,
    withoutSds: 0,
    lowStockCount: 0,
  };

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (globalVessels.length > 0) {
      result = result.filter((i: any) => !i.vesselId || globalVessels.includes(i.vesselId));
    }

    if (globalComponent && globalComponent.trim()) {
      const gc = globalComponent.toLowerCase();
      result = result.filter(i =>
        (i.itemCode || '').toLowerCase().includes(gc) ||
        (i.itemName || '').toLowerCase().includes(gc)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        (i.itemCode || '').toLowerCase().includes(q) ||
        (i.itemName || '').toLowerCase().includes(q) ||
        (i.batchNumber || '').toLowerCase().includes(q)
      );
    }

    if (expiryFilter !== 'all') {
      switch (expiryFilter) {
        case 'expired':
          result = result.filter(i => i.expiryStatus === 'Expired');
          break;
        case '30':
          result = result.filter(i => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 30);
          break;
        case '60':
          result = result.filter(i => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 60);
          break;
        case '90':
          result = result.filter(i => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 90);
          break;
        case 'ok':
          result = result.filter(i => i.expiryStatus === 'OK');
          break;
        case 'no-date':
          result = result.filter(i => i.expiryStatus === 'No Date');
          break;
      }
    }

    if (hazardFilter !== 'all') {
      result = result.filter(i => (i.hazardClassification || 'None') === hazardFilter);
    }

    if (stockFilter !== 'all') {
      result = result.filter(i => i.stockStatus === stockFilter);
    }

    return result;
  }, [items, searchQuery, expiryFilter, hazardFilter, stockFilter, globalComponent, globalVessels]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'itemCode': cmp = (a.itemCode || '').localeCompare(b.itemCode || ''); break;
        case 'itemName': cmp = (a.itemName || '').localeCompare(b.itemName || ''); break;
        case 'batchNumber': cmp = (a.batchNumber || '').localeCompare(b.batchNumber || ''); break;
        case 'manufactureDate': cmp = (a.manufactureDate || '').localeCompare(b.manufactureDate || ''); break;
        case 'expiryDate': cmp = (a.expiryDate || '').localeCompare(b.expiryDate || ''); break;
        case 'daysUntilExpiry': cmp = (a.daysUntilExpiry ?? 99999) - (b.daysUntilExpiry ?? 99999); break;
        case 'rob': cmp = (parseFloat(String(a.rob)) || 0) - (parseFloat(String(b.rob)) || 0); break;
        case 'min': cmp = (parseFloat(String(a.min)) || 0) - (parseFloat(String(b.min)) || 0); break;
        case 'stockStatus': {
          const order: Record<string, number> = { Critical: 0, Low: 1, OK: 2 };
          cmp = (order[a.stockStatus] ?? 3) - (order[b.stockStatus] ?? 3);
          break;
        }
        case 'locationA': cmp = (a.locationA || '').localeCompare(b.locationA || ''); break;
        case 'hazardClassification': cmp = (a.hazardClassification || '').localeCompare(b.hazardClassification || ''); break;
        case 'hasSds': cmp = (a.hasSds ? 1 : 0) - (b.hasSds ? 1 : 0); break;
        default: cmp = (a.itemCode || '').localeCompare(b.itemCode || '');
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [filteredItems, sortField, sortDirection]);

  const expiredItems = useMemo(() => {
    return items
      .filter(i => i.expiryStatus === 'Expired')
      .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0));
  }, [items]);

  const expiringSoonItems = useMemo(() => {
    return items
      .filter(i => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 90)
      .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0));
  }, [items]);

  const missingSdsItems = useMemo(() => {
    return items.filter(i => !i.hasSds);
  }, [items]);

  const hazardBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(i => {
      const hc = i.hazardClassification || 'None';
      counts[hc] = (counts[hc] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);

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

  const handleExportPdf = async () => {
    setGeneratingPdf(true);
    try {
      const columns = [
        { header: 'Chem Code', field: 'itemCode', width: 22 },
        { header: 'Chemical Name', field: 'itemName', width: 45 },
        { header: 'Batch #', field: 'batchNumber', width: 22 },
        { header: 'Expiry Date', field: 'expiryDate', width: 25 },
        { header: 'Days Left', field: 'daysUntilExpiry', width: 20 },
        { header: 'Expiry Status', field: 'expiryStatus', width: 22 },
        { header: 'ROB', field: 'rob', width: 18 },
        { header: 'Min', field: 'min', width: 18 },
        { header: 'Stock Status', field: 'stockStatus', width: 22 },
        { header: 'Location', field: 'locationA', width: 20 },
        { header: 'Hazard Class', field: 'hazardClassification', width: 25 },
        { header: 'SDS', field: 'sdsStatus', width: 15 },
      ];

      const exportData = sortedItems.map(item => ({
        itemCode: item.itemCode || '-',
        itemName: item.itemName || '-',
        batchNumber: item.batchNumber || '-',
        expiryDate: formatDate(item.expiryDate),
        daysUntilExpiry: item.daysUntilExpiry !== null ? item.daysUntilExpiry : '-',
        expiryStatus: item.expiryStatus,
        rob: parseFloat(String(item.rob)) || 0,
        min: parseFloat(String(item.min)) || 0,
        stockStatus: item.stockStatus,
        locationA: item.locationA || '-',
        hazardClassification: item.hazardClassification || 'None',
        sdsStatus: item.hasSds ? 'Yes' : 'No',
      }));

      if (exportData.length === 0) {
        toast({ title: "No Data", description: "No chemicals to export.", variant: "destructive" });
        setGeneratingPdf(false);
        return;
      }

      const summaryData = [
        { label: 'Total Chemicals', value: summary.totalChemicals },
        { label: 'Expired', value: summary.expiredCount },
        { label: 'Expiring Soon', value: summary.expiringSoonCount },
        { label: 'SDS Compliance', value: `${summary.sdsCompliancePercent}%` },
      ];

      pdfReportGenerator.generateReport(
        { title: 'Chemicals Inventory & Expiry Report', subtitle: 'Expiry tracking & SDS compliance', dateRange: 'All Time' },
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


  if (!effectiveVesselId) {
    return (
      <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
        {!embedded && (
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={onBack} data-testid="button-back-chemicals">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Chemicals Inventory & Expiry Report</h1>
          </div>
        )}
        <div className="text-center py-16">
          <Beaker className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Vessel</h3>
          <p className="text-gray-500">Please select a vessel from the dropdown above to view the chemicals expiry report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} data-testid="button-back-chemicals">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Chemicals Inventory & Expiry Report</h1>
              <p className="text-sm text-gray-500">Track chemical inventory, expiry dates, and SDS compliance</p>
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
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by code, name, batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-chemicals"
          />
        </div>
        <Select value={expiryFilter} onValueChange={setExpiryFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-expiry-filter">
            <SelectValue placeholder="Expiry Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expiry Status</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="30">Expiring in 30 days</SelectItem>
            <SelectItem value="60">Expiring in 60 days</SelectItem>
            <SelectItem value="90">Expiring in 90 days</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="no-date">No Expiry Date</SelectItem>
          </SelectContent>
        </Select>
        <Select value={hazardFilter} onValueChange={setHazardFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-hazard-filter">
            <SelectValue placeholder="Hazard Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Hazard Classes</SelectItem>
            <SelectItem value="Flammable">Flammable</SelectItem>
            <SelectItem value="Toxic">Toxic</SelectItem>
            <SelectItem value="Corrosive">Corrosive</SelectItem>
            <SelectItem value="Oxidizer">Oxidizer</SelectItem>
            <SelectItem value="Compressed Gas">Compressed Gas</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-stock-filter">
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading chemicals data...</span>
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
              <Card className="bg-purple-50 border-purple-200" data-testid="card-total-chemicals">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <FlaskConical className="w-4 h-4 text-purple-500" />
                    Total Chemicals
                  </CardDescription>
                  <CardTitle className="text-3xl">{summary.totalChemicals}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-red-50 border-red-200" data-testid="card-expired">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Expired
                  </CardDescription>
                  <CardTitle className="text-3xl text-red-600">{summary.expiredCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-orange-50 border-orange-200" data-testid="card-expiring-soon">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-orange-500" />
                    Expiring Soon
                  </CardDescription>
                  <CardTitle className="text-3xl text-orange-600">{summary.expiringSoonCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-blue-50 border-blue-200" data-testid="card-sds-compliance">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4 text-blue-500" />
                    SDS Compliance
                  </CardDescription>
                  <CardTitle className="text-3xl text-blue-600">{summary.sdsCompliancePercent}%</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          {expiredItems.length > 0 && (
            <Card className="mb-6 border-red-300 bg-red-50/30" data-testid="section-expired-alert">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Expired Chemicals Alert ({expiredItems.length})
                </CardTitle>
                <CardDescription className="text-red-600">These chemicals have passed their expiry date and require immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-red-200 overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="table-expired">
                      <thead>
                        <tr className="bg-red-50 border-b border-red-200">
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Chem Code</th>
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Chemical Name</th>
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Expiry Date</th>
                          <th className="text-right py-3 px-3 font-semibold text-sm text-gray-700">Days Overdue</th>
                          <th className="text-right py-3 px-3 font-semibold text-sm text-gray-700">ROB</th>
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Location</th>
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Batch #</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {expiredItems.map(item => (
                          <tr key={item.id} className="hover:bg-red-50/50" data-testid={`row-expired-${item.id}`}>
                            <td className="py-3 px-3 text-sm font-mono text-gray-700">{item.itemCode || '-'}</td>
                            <td className="py-3 px-3 text-sm font-medium text-gray-900">{item.itemName || '-'}</td>
                            <td className="py-3 px-3 text-sm text-red-600 font-semibold">{formatDate(item.expiryDate)}</td>
                            <td className="py-3 px-3 text-right text-sm text-red-600 font-semibold">
                              {item.daysUntilExpiry !== null ? Math.abs(item.daysUntilExpiry) : '-'}
                            </td>
                            <td className="py-3 px-3 text-right text-sm text-gray-900">{parseFloat(String(item.rob)) || 0}</td>
                            <td className="py-3 px-3 text-sm text-gray-600">{item.locationA || '-'}</td>
                            <td className="py-3 px-3 text-sm text-gray-600">{item.batchNumber || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {expiringSoonItems.length > 0 && (
            <Card className="mb-6 border-orange-300 bg-orange-50/30" data-testid="section-expiring-soon">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <Clock className="h-5 w-5" />
                  Expiring Soon ({expiringSoonItems.length})
                </CardTitle>
                <CardDescription className="text-orange-600">Chemicals expiring within the next 90 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-orange-200 overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="table-expiring-soon">
                      <thead>
                        <tr className="bg-orange-50 border-b border-orange-200">
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Chem Code</th>
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Chemical Name</th>
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Expiry Date</th>
                          <th className="text-right py-3 px-3 font-semibold text-sm text-gray-700">Days Until Expiry</th>
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Urgency</th>
                          <th className="text-right py-3 px-3 font-semibold text-sm text-gray-700">ROB</th>
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Location</th>
                          <th className="text-left py-3 px-3 font-semibold text-sm text-gray-700">Batch #</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100">
                        {expiringSoonItems.map(item => {
                          const days = item.daysUntilExpiry ?? 0;
                          let urgencyBadge;
                          if (days <= 30) {
                            urgencyBadge = <Badge className="bg-orange-500 text-white border-orange-600">Critical</Badge>;
                          } else if (days <= 60) {
                            urgencyBadge = <Badge className="bg-yellow-500 text-white border-yellow-600">High</Badge>;
                          } else {
                            urgencyBadge = <Badge className="bg-yellow-400 text-gray-900 border-yellow-500">Medium</Badge>;
                          }
                          return (
                            <tr key={item.id} className="hover:bg-orange-50/50" data-testid={`row-expiring-${item.id}`}>
                              <td className="py-3 px-3 text-sm font-mono text-gray-700">{item.itemCode || '-'}</td>
                              <td className="py-3 px-3 text-sm font-medium text-gray-900">{item.itemName || '-'}</td>
                              <td className="py-3 px-3 text-sm text-orange-600">{formatDate(item.expiryDate)}</td>
                              <td className="py-3 px-3 text-right text-sm font-semibold text-orange-600">{days}</td>
                              <td className="py-3 px-3">{urgencyBadge}</td>
                              <td className="py-3 px-3 text-right text-sm text-gray-900">{parseFloat(String(item.rob)) || 0}</td>
                              <td className="py-3 px-3 text-sm text-gray-600">{item.locationA || '-'}</td>
                              <td className="py-3 px-3 text-sm text-gray-600">{item.batchNumber || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6" data-testid="section-full-inventory">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-blue-600" />
                Full Chemicals Inventory
              </CardTitle>
              <CardDescription>All chemicals with expiry tracking and compliance status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="table-full-inventory">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-3"><SortButton field="itemCode" label="Chem Code" /></th>
                        <th className="text-left py-3 px-3"><SortButton field="itemName" label="Chemical Name" /></th>
                        <th className="text-left py-3 px-3"><SortButton field="batchNumber" label="Batch #" /></th>
                        <th className="text-left py-3 px-3"><SortButton field="manufactureDate" label="Mfg Date" /></th>
                        <th className="text-left py-3 px-3"><SortButton field="expiryDate" label="Expiry Date" /></th>
                        <th className="text-right py-3 px-3"><SortButton field="daysUntilExpiry" label="Days Left" /></th>
                        <th className="text-right py-3 px-3"><SortButton field="rob" label="ROB" /></th>
                        <th className="text-right py-3 px-3"><SortButton field="min" label="Min" /></th>
                        <th className="text-left py-3 px-3"><SortButton field="stockStatus" label="Stock" /></th>
                        <th className="text-left py-3 px-3"><SortButton field="locationA" label="Location" /></th>
                        <th className="text-left py-3 px-3"><SortButton field="hazardClassification" label="Hazard" /></th>
                        <th className="text-center py-3 px-3"><SortButton field="hasSds" label="SDS" /></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedItems.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="text-center py-12">
                            <Beaker className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No chemicals found</p>
                            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                          </td>
                        </tr>
                      ) : (
                        paginateItems(sortedItems).map((item, idx) => {
                          const rob = parseFloat(String(item.rob)) || 0;
                          const min = parseFloat(String(item.min)) || 0;
                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-gray-50 ${
                                item.expiryStatus === 'Expired' ? 'bg-red-50/40' :
                                item.stockStatus === 'Critical' ? 'bg-red-50/30' :
                                item.stockStatus === 'Low' ? 'bg-amber-50/30' : ''
                              }`}
                              data-testid={`row-chemical-${item.id}`}
                            >
                              <td className="py-3 px-3 text-sm font-mono text-gray-700">{item.itemCode || '-'}</td>
                              <td className="py-3 px-3">
                                <div className="font-medium text-gray-900 text-sm">{item.itemName || '-'}</div>
                              </td>
                              <td className="py-3 px-3 text-sm text-gray-600">{item.batchNumber || '-'}</td>
                              <td className="py-3 px-3 text-sm text-gray-600">{formatDate(item.manufactureDate)}</td>
                              <td className={`py-3 px-3 text-sm ${getExpiryDateColor(item)}`}>
                                {formatDate(item.expiryDate)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {item.daysUntilExpiry !== null ? getExpiryStatusBadge(item.expiryStatus) : <span className="text-sm text-gray-400">-</span>}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span className={`font-semibold text-sm ${rob === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                  {rob}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right text-sm text-gray-600">{min}</td>
                              <td className="py-3 px-3">{getStockStatusBadge(item.stockStatus)}</td>
                              <td className="py-3 px-3 text-sm text-gray-600">{item.locationA || '-'}</td>
                              <td className="py-3 px-3">{getHazardBadge(item.hazardClassification)}</td>
                              <td className="py-3 px-3 text-center">
                                {item.hasSds ? (
                                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto" data-testid={`icon-sds-yes-${item.id}`} />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-500 mx-auto" data-testid={`icon-sds-no-${item.id}`} />
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {sortedItems.length > 0 && (
                <TablePagination
                  totalItems={sortedItems.length}
                  pageSize={pageSize}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card className="border-blue-200 bg-blue-50/30" data-testid="section-sds-compliance">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <ShieldAlert className="h-5 w-5" />
                  SDS Compliance
                </CardTitle>
                <CardDescription>Safety Data Sheet compliance overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Compliance Rate</span>
                    <span className="text-sm font-semibold text-blue-700">{summary.sdsCompliancePercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(summary.sdsCompliancePercent, 100)}%` }}
                      data-testid="progress-sds-compliance"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">{summary.withSds} with SDS</span>
                    <span className="text-xs text-gray-500">{summary.withoutSds} without SDS</span>
                  </div>
                </div>

                {missingSdsItems.length > 0 && (
                  <div className="rounded-lg border border-blue-200 overflow-hidden bg-white mt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full" data-testid="table-missing-sds">
                        <thead>
                          <tr className="bg-blue-50 border-b border-blue-200">
                            <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Chem Code</th>
                            <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Chemical Name</th>
                            <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Hazard Class</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100">
                          {missingSdsItems.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50/50" data-testid={`row-missing-sds-${item.id}`}>
                              <td className="py-2 px-3 text-sm font-mono text-gray-700">{item.itemCode || '-'}</td>
                              <td className="py-2 px-3 text-sm text-gray-900">{item.itemName || '-'}</td>
                              <td className="py-2 px-3">{getHazardBadge(item.hazardClassification)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="section-hazard-breakdown">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-gray-600" />
                  Hazard Classification Breakdown
                </CardTitle>
                <CardDescription>Distribution of chemicals by hazard classification</CardDescription>
              </CardHeader>
              <CardContent>
                {hazardBreakdown.length === 0 ? (
                  <p className="text-sm text-gray-500">No chemical data available.</p>
                ) : (
                  <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                    <table className="w-full" data-testid="table-hazard-breakdown">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Hazard Classification</th>
                          <th className="text-right py-2 px-3 font-semibold text-sm text-gray-700">Count</th>
                          <th className="text-right py-2 px-3 font-semibold text-sm text-gray-700">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {hazardBreakdown.map(([classification, count]) => (
                          <tr key={classification} className="hover:bg-gray-50" data-testid={`row-hazard-${classification}`}>
                            <td className="py-2 px-3">{getHazardBadge(classification)}</td>
                            <td className="py-2 px-3 text-right text-sm font-semibold text-gray-900">{count}</td>
                            <td className="py-2 px-3 text-right text-sm text-gray-600">
                              {items.length > 0 ? Math.round((count / items.length) * 100) : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default ChemicalsExpiryReport;
