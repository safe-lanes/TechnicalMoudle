import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
  FileText,
  Loader2,
  Beaker,
  ShieldAlert,
  Clock,
  FlaskConical,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { format } from "date-fns";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";

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

function formatDate(date: string | null): string {
  if (!date) return '-';
  try {
    return format(new Date(date), 'dd MMM yyyy');
  } catch {
    return '-';
  }
}

function getUrgencyText(days: number): string {
  if (days <= 30) return 'Critical';
  if (days <= 60) return 'High';
  return 'Medium';
}

const ChemicalsExpiryReport: React.FC<ChemicalsExpiryReportProps> = ({ onBack, vesselId: propVesselId, embedded, globalVessels = [], globalComponent = "" }) => {
  const { vesselId: contextVesselId } = useVessel();
  const effectiveVesselId = propVesselId || contextVesselId;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [hazardFilter, setHazardFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const { data, isLoading, error } = useQuery<ChemicalsExpiryResponse>({
    queryKey: [`/technical/api/reports/chemicals-expiry/${effectiveVesselId}`],
    enabled: !!effectiveVesselId,
  });

  const items = data?.items || [];

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

  const summary = useMemo(() => {
    const base = filteredItems;
    const withSds = base.filter(i => i.hasSds).length;
    const withoutSds = base.length - withSds;
    return {
      totalChemicals: base.length,
      expiredCount: base.filter(i => i.expiryStatus === 'Expired').length,
      expiringSoonCount: base.filter(i => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 90 && i.expiryStatus !== 'Expired').length,
      sdsCompliancePercent: base.length > 0 ? Math.round((withSds / base.length) * 100) : 0,
      withSds,
      withoutSds,
      lowStockCount: base.filter(i => i.stockStatus === 'Low' || i.stockStatus === 'Critical').length,
    };
  }, [filteredItems]);

  const expiredItems = useMemo(() => {
    return filteredItems
      .filter(i => i.expiryStatus === 'Expired')
      .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0));
  }, [filteredItems]);

  const expiringSoonItems = useMemo(() => {
    return filteredItems
      .filter(i => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 90)
      .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0));
  }, [filteredItems]);

  const missingSdsItems = useMemo(() => {
    return filteredItems.filter(i => !i.hasSds);
  }, [filteredItems]);

  const hazardBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredItems.forEach(i => {
      const hc = i.hazardClassification || 'None';
      counts[hc] = (counts[hc] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredItems]);

  const handleExportPdf = async () => {
    setGeneratingPdf(true);
    try {
      const columns = [
        { header: 'S.No', field: 'sno', width: 12 },
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

      const exportData = filteredItems.map((item, index) => ({
        sno: index + 1,
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
                <ReportAgGridTable
                  columns={[
                    { header: 'S.No', field: 'sNo', width: 70 },
                    { header: 'Chem Code', field: 'itemCode', width: 120 },
                    { header: 'Chemical Name', field: 'itemName', width: 200 },
                    { header: 'Expiry Date', field: 'expiryDate', width: 120 },
                    { header: 'Days Overdue', field: 'daysOverdue', width: 120 },
                    { header: 'ROB', field: 'rob', width: 80 },
                    { header: 'Location', field: 'locationA', width: 120 },
                    { header: 'Batch #', field: 'batchNumber', width: 120 },
                  ]}
                  data={expiredItems.map((item, index) => ({
                    sNo: index + 1,
                    itemCode: item.itemCode || '-',
                    itemName: item.itemName || '-',
                    expiryDate: formatDate(item.expiryDate),
                    daysOverdue: item.daysUntilExpiry !== null ? Math.abs(item.daysUntilExpiry) : '-',
                    rob: parseFloat(String(item.rob)) || 0,
                    locationA: item.locationA || '-',
                    batchNumber: item.batchNumber || '-',
                  }))}
                  height="300px"
                />
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
                <ReportAgGridTable
                  columns={[
                    { header: 'S.No', field: 'sNo', width: 70 },
                    { header: 'Chem Code', field: 'itemCode', width: 120 },
                    { header: 'Chemical Name', field: 'itemName', width: 200 },
                    { header: 'Expiry Date', field: 'expiryDate', width: 120 },
                    { header: 'Days Until Expiry', field: 'daysUntilExpiry', width: 140 },
                    { header: 'Urgency', field: 'urgency', width: 100 },
                    { header: 'ROB', field: 'rob', width: 80 },
                    { header: 'Location', field: 'locationA', width: 120 },
                    { header: 'Batch #', field: 'batchNumber', width: 120 },
                  ]}
                  data={expiringSoonItems.map((item, index) => ({
                    sNo: index + 1,
                    itemCode: item.itemCode || '-',
                    itemName: item.itemName || '-',
                    expiryDate: formatDate(item.expiryDate),
                    daysUntilExpiry: item.daysUntilExpiry ?? 0,
                    urgency: getUrgencyText(item.daysUntilExpiry ?? 0),
                    rob: parseFloat(String(item.rob)) || 0,
                    locationA: item.locationA || '-',
                    batchNumber: item.batchNumber || '-',
                  }))}
                  height="400px"
                />
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
              <ReportAgGridTable
                columns={[
                  { header: 'S.No', field: 'sNo', width: 70 },
                  { header: 'Chem Code', field: 'itemCode', width: 120 },
                  { header: 'Chemical Name', field: 'itemName', width: 200 },
                  { header: 'Batch #', field: 'batchNumber', width: 120 },
                  { header: 'Mfg Date', field: 'manufactureDate', width: 120 },
                  { header: 'Expiry Date', field: 'expiryDate', width: 120 },
                  { header: 'Days Left', field: 'daysLeft', width: 100 },
                  { header: 'ROB', field: 'rob', width: 80 },
                  { header: 'Min', field: 'min', width: 80 },
                  { header: 'Stock', field: 'stockStatus', width: 90 },
                  { header: 'Location', field: 'locationA', width: 120 },
                  { header: 'Hazard', field: 'hazardClassification', width: 130 },
                  { header: 'SDS', field: 'sds', width: 70 },
                ]}
                data={filteredItems.map((item, index) => ({
                  sNo: index + 1,
                  itemCode: item.itemCode || '-',
                  itemName: item.itemName || '-',
                  batchNumber: item.batchNumber || '-',
                  manufactureDate: formatDate(item.manufactureDate),
                  expiryDate: formatDate(item.expiryDate),
                  daysLeft: item.daysUntilExpiry !== null ? `${item.daysUntilExpiry} (${item.expiryStatus})` : '-',
                  rob: parseFloat(String(item.rob)) || 0,
                  min: parseFloat(String(item.min)) || 0,
                  stockStatus: item.stockStatus,
                  locationA: item.locationA || '-',
                  hazardClassification: item.hazardClassification || 'None',
                  sds: item.hasSds ? 'Yes' : 'No',
                }))}
                height="60vh"
              />
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
                  <div className="mt-4">
                    <ReportAgGridTable
                      columns={[
                        { header: 'Chem Code', field: 'itemCode', width: 150 },
                        { header: 'Chemical Name', field: 'itemName', width: 250 },
                        { header: 'Hazard Class', field: 'hazardClassification', width: 150 },
                      ]}
                      data={missingSdsItems.map(item => ({
                        itemCode: item.itemCode || '-',
                        itemName: item.itemName || '-',
                        hazardClassification: item.hazardClassification || 'None',
                      }))}
                      height="300px"
                    />
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
                  <ReportAgGridTable
                    columns={[
                      { header: 'Hazard Classification', field: 'classification', width: 200 },
                      { header: 'Count', field: 'count', width: 100 },
                      { header: '%', field: 'percent', width: 100 },
                    ]}
                    data={hazardBreakdown.map(([classification, count]) => ({
                      classification,
                      count,
                      percent: items.length > 0 ? `${Math.round((count / items.length) * 100)}%` : '0%',
                    }))}
                    height="300px"
                  />
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
