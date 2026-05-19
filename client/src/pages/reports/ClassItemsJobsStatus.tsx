import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardList, FileText, Download, Loader2, AlertCircle } from "lucide-react";
import { pdfReportGenerator, formatReportDateRange } from "@/lib/pdfReportGenerator";
import { ReportPreviewData } from "@/components/reports/ReportPreviewModal";
import InlineReportPreview from "@/components/reports/InlineReportPreview";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";

interface Props {
  onBack: () => void;
  globalFilters?: {
    vessels: string[];
    component: string;
    department?: string;
    dateRange: { from: Date | null; to: Date | null };
  };
  embedded?: boolean;
  selectedReportId?: string | null;
  actionTrigger?: { type: 'pdf' | 'excel'; ts: number } | null;
}

const fmtDateParam = (d: Date | null | undefined) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const ClassItemsJobsStatus: React.FC<Props> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: (globalFilters?.vessels?.length === 1 ? globalFilters.vessels[0] : "all"),
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [globalVessels, setGlobalVessels] = useState<string[]>(globalFilters?.vessels || []);
  const [globalComponent, setGlobalComponent] = useState<string>(globalFilters?.component || "");
  const [globalDepartment, setGlobalDepartment] = useState<string>(globalFilters?.department || "");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const [isFilterRefreshing, setIsFilterRefreshing] = useState(false);
  const initialLoadRef = useRef(false);
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId: contextVesselId } = useVessel();

  useEffect(() => {
    if (globalFilters?.vessels) {
      setGlobalVessels(globalFilters.vessels);
      const v = globalFilters.vessels.length === 1 ? globalFilters.vessels[0] : "all";
      setCategoryFilters(prev => ({ ...prev, vessel: v }));
    }
  }, [globalFilters?.vessels]);

  useEffect(() => {
    if (globalFilters?.dateRange) setCategoryFilters(prev => ({ ...prev, dateRange: globalFilters.dateRange }));
  }, [globalFilters?.dateRange]);

  useEffect(() => { if (globalFilters) setGlobalComponent(globalFilters.component || ""); }, [globalFilters?.component]);
  useEffect(() => { if (globalFilters) setGlobalDepartment(globalFilters.department || ""); }, [globalFilters?.department]);

  const dateFrom = globalFilters?.dateRange?.from || null;
  const dateTo = globalFilters?.dateRange?.to || null;

  const filterFingerprint = useMemo(() => JSON.stringify({
    v: globalFilters?.vessels, c: globalFilters?.component, d: globalFilters?.department,
    f: fmtDateParam(dateFrom), t: fmtDateParam(dateTo),
  }), [globalFilters?.vessels, globalFilters?.component, globalFilters?.department, dateFrom, dateTo]);

  const effectiveVesselId = (globalFilters?.vessels !== undefined)
    ? (globalFilters.vessels.length === 1 ? globalFilters.vessels[0] : 'all')
    : (categoryFilters.vessel === 'all' ? 'all' : (categoryFilters.vessel || contextVesselId));

  const isMultiVessel = effectiveVesselId === 'all';

  const buildParams = (extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set('vesselId', effectiveVesselId || 'all');
    if (isMultiVessel && globalVessels.length > 0) p.set('vesselIds', globalVessels.join(','));
    if (globalComponent) p.set('search', globalComponent);
    if (globalDepartment) p.set('department', globalDepartment);
    const f = fmtDateParam(dateFrom); if (f) p.set('dateFrom', f);
    const t = fmtDateParam(dateTo); if (t) p.set('dateTo', t);
    if (extra) for (const k of Object.keys(extra)) p.set(k, extra[k]);
    return p;
  };

  const { data: jobsData, isLoading, isFetching, isError, error } = useQuery<any>({
    queryKey: ['/technical/api/reports/class-items-jobs', effectiveVesselId, globalComponent, globalDepartment, globalVessels.join(','), fmtDateParam(dateFrom), fmtDateParam(dateTo)],
    queryFn: async () => {
      const res = await fetch(`/technical/api/reports/class-items-jobs?${buildParams()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch class items jobs (status ${res.status})`);
      return res.json();
    },
  });

  const buildPreviewData = (): ReportPreviewData | null => {
    if (!jobsData) return null;
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');
    const rows = jobsData.rows || [];
    const summary = jobsData.summary || {};

    const columns = [
      { header: 'Sr. No.', field: 'sno', width: 6 },
      { header: 'Job Code', field: 'jobCode', width: 14 },
      { header: 'Job Title', field: 'jobTitle', width: 30 },
      { header: 'Component Code', field: 'componentCode', width: 14 },
      { header: 'Component Name', field: 'componentName', width: 26 },
      { header: 'Department', field: 'department', width: 12 },
      { header: 'Task Type', field: 'taskType', width: 12 },
      { header: 'Maintenance Basis', field: 'maintenanceBasis', width: 14 },
      { header: 'Frequency', field: 'frequency', width: 12 },
      { header: 'Assigned To', field: 'assignedTo', width: 14 },
      { header: 'Approver', field: 'approver', width: 14 },
      { header: 'Job Priority', field: 'jobPriority', width: 12 },
      { header: 'Criticality', field: 'criticality', width: 12 },
      { header: 'Last Done Date', field: 'lastDoneDate', width: 14 },
      { header: 'Last Done RH', field: 'lastDoneRH', width: 12 },
      { header: 'Next Due Date', field: 'nextDueDate', width: 14 },
      { header: 'Next Due RH', field: 'nextDueRH', width: 12 },
      { header: 'Status', field: 'status', width: 12 },
      ...(isMultiVessel ? [{ header: 'Vessel', field: 'vesselName', width: 18 }] : []),
    ];

    const finalData = rows.length > 0 ? rows : [{ sno: '-', jobCode: '-', jobTitle: 'No class-related jobs found', componentCode: '-', componentName: '-', department: '-', taskType: '-', maintenanceBasis: '-', frequency: '-', assignedTo: '-', approver: '-', jobPriority: '-', criticality: '-', lastDoneDate: '-', lastDoneRH: '-', nextDueDate: '-', nextDueRH: '-', status: '-' }];

    return {
      title: 'Class Items Jobs Status',
      subtitle: `${rows.length} class-related jobs`,
      vessel: vesselName,
      dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
      columns,
      data: finalData,
      summary: [
        { label: 'Total WOs', value: summary.total ?? rows.length },
        { label: 'Overdue', value: summary.overdue ?? 0 },
        { label: 'Due', value: summary.due ?? 0 },
        { label: 'Active', value: summary.active ?? 0 },
        { label: 'Completed', value: summary.completed ?? 0 },
      ],
    };
  };

  useEffect(() => {
    if (embedded && selectedReportId === 'class-items-jobs-status' && jobsData) {
      const data = buildPreviewData();
      if (data) setPreviewData(data);
      initialLoadRef.current = true;
      setIsFilterRefreshing(false);
    }
  }, [embedded, selectedReportId, jobsData, isMultiVessel]);

  useEffect(() => {
    if (!embedded || !selectedReportId || !initialLoadRef.current) return;
    setIsFilterRefreshing(true);
  }, [filterFingerprint]);

  const handleExcelExport = async () => {
    const response = await fetch(`/technical/api/reports/class-items-jobs?${buildParams({ format: 'excel' })}`);
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers.get('Content-Disposition');
    const filenameMatch = disposition?.match(/filename="(.+)"/);
    a.download = filenameMatch ? filenameMatch[1] : `class-items-jobs-status.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handlePdfExport = async () => {
    const data = buildPreviewData();
    if (!data) {
      toast({ title: "No Data", description: "No class items jobs data available.", variant: "destructive" });
      return;
    }
    pdfReportGenerator.generateReport(
      { title: data.title, subtitle: data.subtitle, vessel: data.vessel, orientation: 'landscape', dateRange: data.dateRange },
      data.columns, data.data
    );
  };

  const handleGenerateReport = async (reportFormat: 'PDF' | 'Excel') => {
    const reportKey = `class-items-jobs-${reportFormat}`;
    if (generatingReports.has(reportKey)) return;
    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${reportFormat} report...` });
      if (reportFormat === 'PDF') await handlePdfExport(); else await handleExcelExport();
      toast({ title: "Report Generated", description: `${reportFormat} report downloaded successfully!` });
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message || `Failed to generate ${reportFormat} report.`, variant: "destructive" });
    } finally {
      setGeneratingReports(prev => { const n = new Set(prev); n.delete(reportKey); return n; });
    }
  };

  useEffect(() => {
    if (!actionTrigger || !embedded || !selectedReportId) return;
    if (actionTrigger.type === 'pdf') handleGenerateReport('PDF');
    else if (actionTrigger.type === 'excel') handleGenerateReport('Excel');
  }, [actionTrigger]);

  if (embedded) {
    return (
      <div className="w-full">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-red-600" data-testid="error-class-items-jobs-status">
            <AlertCircle className="h-6 w-6 mb-2" />
            <div>Failed to load class items jobs report.</div>
            <div className="text-xs text-gray-500 mt-1">{(error as any)?.message || 'Please try again.'}</div>
          </div>
        ) : (isLoading || isFilterRefreshing) && !previewData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-sm text-gray-500">Loading class items jobs report…</span>
          </div>
        ) : previewData ? (
          <InlineReportPreview reportData={previewData} embedded={embedded} />
        ) : (
          <div className="text-center py-16 text-sm text-gray-500">No data to display.</div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-class-items-jobs-status">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-class-items-jobs">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Class Items Jobs Status</h1>
            <p className="text-sm text-gray-500">Class-related jobs with last done / next due / status.</p>
          </div>
        </div>
      </div>

      <CategoryFilters filters={categoryFilters} onFiltersChange={setCategoryFilters} />

      <Card data-testid="card-report-class-items-jobs-status">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <ClipboardList className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <CardTitle className="text-base">Class Items Jobs Status</CardTitle>
                <CardDescription className="mt-1">Job-level register of class-related maintenance with status derivation.</CardDescription>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">On-demand</Badge>
                  <Badge variant="outline">1-2 min</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleGenerateReport('PDF')} disabled={isFetching} data-testid="button-pdf-class-items-jobs">
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleGenerateReport('Excel')} disabled={isFetching} data-testid="button-excel-class-items-jobs">
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
};

export default ClassItemsJobsStatus;
