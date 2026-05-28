import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield, FileText, Download, Loader2, AlertCircle } from "lucide-react";
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

const ClassItemsMasterList: React.FC<Props> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
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

  useEffect(() => { if (globalFilters) setGlobalComponent(globalFilters.component || ""); }, [globalFilters?.component]);
  useEffect(() => { if (globalFilters) setGlobalDepartment(globalFilters.department || ""); }, [globalFilters?.department]);

  const filterFingerprint = useMemo(() => JSON.stringify({
    v: globalFilters?.vessels, c: globalFilters?.component, d: globalFilters?.department,
  }), [globalFilters?.vessels, globalFilters?.component, globalFilters?.department]);

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
    if (extra) for (const k of Object.keys(extra)) p.set(k, extra[k]);
    return p;
  };

  const { data: masterData, isLoading, isFetching, isError, error } = useQuery<any>({
    queryKey: ['/technical/api/reports/class-items-master-list', effectiveVesselId, globalComponent, globalDepartment, globalVessels.join(',')],
    queryFn: async () => {
      const res = await fetch(`/technical/api/reports/class-items-master-list?${buildParams()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch class items master list (status ${res.status})`);
      return res.json();
    },
  });

  const buildPreviewData = (): ReportPreviewData | null => {
    if (!masterData) return null;
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');
    const rows = masterData.rows || [];
    const summary = masterData.summary || {};

    const columns = [
      { header: 'Sr. No.', field: 'sno', width: 6 },
      { header: 'Component Code', field: 'componentCode', width: 14 },
      { header: 'Component Name', field: 'componentName', width: 28 },
      { header: 'Department', field: 'department', width: 12 },
      { header: 'Maker', field: 'maker', width: 16 },
      { header: 'Model', field: 'model', width: 16 },
      { header: 'Criticality', field: 'criticality', width: 12 },
      { header: 'Class Society', field: 'classificationSociety', width: 14 },
      { header: 'Certificate No.', field: 'certificateNumber', width: 16 },
      { header: 'Survey Type', field: 'surveyType', width: 14 },
      { header: 'Last Class Survey', field: 'lastClassSurvey', width: 14 },
      { header: 'Next Class Survey Due', field: 'nextSurveyDue', width: 16 },
      { header: 'Class Requirements', field: 'classRequirements', width: 22 },
      ...(isMultiVessel ? [{ header: 'Vessel', field: 'vesselName', width: 18 }] : []),
    ];

    const finalData = rows.length > 0 ? rows : [{ sno: '-', componentCode: '-', componentName: 'No class items found', department: '-', maker: '-', model: '-', criticality: '-', classificationSociety: '-', certificateNumber: '-', surveyType: '-', lastClassSurvey: '-', nextSurveyDue: '-', classRequirements: '-' }];

    return {
      title: 'Class Items Master List',
      subtitle: `${rows.length} class items`,
      vessel: vesselName,
      dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
      columns,
      data: finalData,
      summary: [
        { label: 'Total Rows', value: summary.total ?? rows.length },
        { label: 'Components', value: summary.components ?? 0 },
        { label: 'With Class Reg', value: summary.withClassReg ?? 0 },
        { label: 'Without Class Reg', value: summary.withoutClassReg ?? 0 },
      ],
    };
  };

  useEffect(() => {
    if (embedded && selectedReportId === 'class-items-master-list' && masterData) {
      const data = buildPreviewData();
      if (data) setPreviewData(data);
      initialLoadRef.current = true;
      setIsFilterRefreshing(false);
    }
  }, [embedded, selectedReportId, masterData, isMultiVessel]);

  useEffect(() => {
    if (!embedded || !selectedReportId || !initialLoadRef.current) return;
    setIsFilterRefreshing(true);
  }, [filterFingerprint]);

  const handleExcelExport = async () => {
    const response = await fetch(`/technical/api/reports/class-items-master-list?${buildParams({ format: 'excel' })}`);
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers.get('Content-Disposition');
    const filenameMatch = disposition?.match(/filename="(.+)"/);
    a.download = filenameMatch ? filenameMatch[1] : `class-items-master-list.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handlePdfExport = async () => {
    const data = buildPreviewData();
    if (!data) {
      toast({ title: "No Data", description: "No class items data available.", variant: "destructive" });
      return;
    }
    pdfReportGenerator.generateReport(
      { title: data.title, subtitle: data.subtitle, vessel: data.vessel, orientation: 'landscape', dateRange: data.dateRange },
      data.columns, data.data
    );
  };

  const handleGenerateReport = async (reportFormat: 'PDF' | 'Excel') => {
    const reportKey = `class-items-master-${reportFormat}`;
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
          <div className="flex flex-col items-center justify-center py-16 text-sm text-red-600" data-testid="error-class-items-master-list">
            <AlertCircle className="h-6 w-6 mb-2" />
            <div>Failed to load class items master list.</div>
            <div className="text-xs text-gray-500 mt-1">{(error as any)?.message || 'Please try again.'}</div>
          </div>
        ) : (isLoading || isFilterRefreshing) && !previewData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-sm text-gray-500">Loading class items master list…</span>
          </div>
        ) : previewData ? (
          <InlineReportPreview reportData={previewData ? { ...previewData, reportId: previewData.reportId ?? 'class-items-master-list' } : null} embedded={embedded} />
        ) : (
          <div className="text-center py-16 text-sm text-gray-500">No data to display.</div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-class-items-master-list">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-class-items-master">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Class Items Master List</h1>
            <p className="text-sm text-gray-500">Components flagged as class items with their classification &amp; regulatory data.</p>
          </div>
        </div>
      </div>

      <CategoryFilters filters={categoryFilters} onFiltersChange={setCategoryFilters} showDateRange={false} />

      <Card data-testid="card-report-class-items-master-list">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <CardTitle className="text-base">Class Items Master List</CardTitle>
                <CardDescription className="mt-1">Component-level register of all components flagged as class items.</CardDescription>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">On-demand</Badge>
                  <Badge variant="outline">1-2 min</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleGenerateReport('PDF')} disabled={isFetching} data-testid="button-pdf-class-items-master">
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleGenerateReport('Excel')} disabled={isFetching} data-testid="button-excel-class-items-master">
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
};

export default ClassItemsMasterList;
