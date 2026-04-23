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

interface ClassItemsReportsProps {
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

const ClassItemsReports: React.FC<ClassItemsReportsProps> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
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
    if (globalFilters?.dateRange) {
      setCategoryFilters(prev => ({ ...prev, dateRange: globalFilters.dateRange }));
    }
  }, [globalFilters?.dateRange]);

  useEffect(() => {
    if (globalFilters) setGlobalComponent(globalFilters.component || "");
  }, [globalFilters?.component]);

  useEffect(() => {
    if (globalFilters) setGlobalDepartment(globalFilters.department || "");
  }, [globalFilters?.department]);

  const filterFingerprint = useMemo(() => JSON.stringify({
    v: globalFilters?.vessels,
    c: globalFilters?.component,
    d: globalFilters?.department,
  }), [globalFilters?.vessels, globalFilters?.component, globalFilters?.department]);

  const effectiveVesselId = (globalFilters?.vessels !== undefined)
    ? (globalFilters.vessels.length === 1 ? globalFilters.vessels[0] : 'all')
    : (categoryFilters.vessel === 'all' ? 'all' : (categoryFilters.vessel || contextVesselId));

  const isMultiVessel = effectiveVesselId === 'all';

  const { data: classItemsData, isLoading, isFetching, isError, error } = useQuery<any>({
    queryKey: ['/technical/api/reports/class-items-master-list', effectiveVesselId, globalComponent, globalDepartment, globalVessels.join(',')],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('vesselId', effectiveVesselId || 'all');
      if (isMultiVessel && globalVessels.length > 0) params.set('vesselIds', globalVessels.join(','));
      if (globalComponent) params.set('componentSearch', globalComponent);
      if (globalDepartment) params.set('department', globalDepartment);
      const res = await fetch(`/technical/api/reports/class-items-master-list?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch class items report (status ${res.status})`);
      return res.json();
    },
  });

  const buildPreviewData = (): ReportPreviewData | null => {
    if (!classItemsData) return null;
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');
    const rows = classItemsData.rows || [];
    const summary = classItemsData.summary || {};

    const columns = [
      { header: 'S.No', field: 'sno', width: 6 },
      ...(isMultiVessel ? [{ header: 'Vessel', field: 'vesselName', width: 18 }] : []),
      { header: 'Job Code', field: 'jobCode', width: 14 },
      { header: 'Job Title', field: 'jobTitle', width: 30 },
      { header: 'Task Type', field: 'taskType', width: 14 },
      { header: 'Frequency', field: 'frequency', width: 12 },
      { header: 'Last Done', field: 'lastDoneDate', width: 14 },
      { header: 'Next Due', field: 'nextDueDate', width: 14 },
      { header: 'Class Related', field: 'classRelated', width: 12 },
      { header: 'Component Code', field: 'componentCode', width: 16 },
      { header: 'Component Name', field: 'componentName', width: 26 },
      { header: 'Department', field: 'department', width: 12 },
      { header: 'Class Society', field: 'classificationSociety', width: 14 },
      { header: 'Certificate No.', field: 'certificateNumber', width: 16 },
      { header: 'Last Class Survey', field: 'lastClassSurvey', width: 14 },
      { header: 'Next Class Survey', field: 'nextSurveyDue', width: 14 },
      { header: 'Survey Type', field: 'surveyType', width: 16 },
      { header: 'Class Requirements', field: 'classRequirements', width: 22 },
      { header: 'Survey Status', field: 'surveyStatus', width: 12 },
      { header: 'Remarks', field: 'remarks', width: 22 },
      { header: 'Class Code', field: 'classCode', width: 12 },
      { header: 'Information', field: 'information', width: 22 },
    ];

    const finalData = rows.length > 0 ? rows : [{ sno: '-', jobCode: '-', jobTitle: 'No class-related jobs found', taskType: '-', frequency: '-', lastDoneDate: '-', nextDueDate: '-', classRelated: '-', componentCode: '-', componentName: '-', department: '-', classificationSociety: '-', certificateNumber: '-', lastClassSurvey: '-', nextSurveyDue: '-', surveyType: '-', classRequirements: '-', surveyStatus: '-', remarks: '-', classCode: '-', information: '-' }];

    const summaryItems = [
      { label: 'Total Rows', value: summary.total ?? rows.length },
      { label: 'Class Jobs', value: summary.jobs ?? 0 },
      { label: 'With Class Reg', value: summary.withClassReg ?? 0 },
      { label: 'Without Class Reg', value: summary.withoutClassReg ?? 0 },
    ];

    return {
      title: 'Class Items Master List',
      subtitle: `${rows.length} class-related job rows`,
      vessel: vesselName,
      dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
      columns,
      data: finalData,
      summary: summaryItems,
    };
  };

  useEffect(() => {
    if (embedded && selectedReportId === 'class-items-master-list' && classItemsData) {
      const data = buildPreviewData();
      if (data) setPreviewData(data);
      initialLoadRef.current = true;
      setIsFilterRefreshing(false);
    }
  }, [embedded, selectedReportId, classItemsData, isMultiVessel]);

  useEffect(() => {
    if (!embedded || !selectedReportId || !initialLoadRef.current) return;
    setIsFilterRefreshing(true);
  }, [filterFingerprint]);

  const handleExcelExport = async () => {
    const params = new URLSearchParams();
    params.set('vesselId', effectiveVesselId || 'all');
    params.set('format', 'excel');
    if (globalVessels.length > 0) params.set('vesselIds', globalVessels.join(','));
    if (globalComponent) params.set('componentSearch', globalComponent);
    if (globalDepartment) params.set('department', globalDepartment);
    const response = await fetch(`/technical/api/reports/class-items-master-list?${params.toString()}`);
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers.get('Content-Disposition');
    const filenameMatch = disposition?.match(/filename="(.+)"/);
    a.download = filenameMatch ? filenameMatch[1] : `class-items-master-list.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handlePdfExport = async () => {
    const data = buildPreviewData();
    if (!data) {
      toast({ title: "No Data", description: "No class items data available.", variant: "destructive" });
      return;
    }
    pdfReportGenerator.generateReport(
      {
        title: data.title,
        subtitle: data.subtitle,
        vessel: data.vessel,
        orientation: 'landscape',
        dateRange: data.dateRange,
      },
      data.columns,
      data.data
    );
  };

  const handleGenerateReport = async (reportFormat: 'PDF' | 'Excel') => {
    const reportKey = `class-items-${reportFormat}`;
    if (generatingReports.has(reportKey)) return;
    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${reportFormat} report...` });
      if (reportFormat === 'PDF') {
        await handlePdfExport();
      } else {
        await handleExcelExport();
      }
      toast({ title: "Report Generated", description: `${reportFormat} report downloaded successfully!` });
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message || `Failed to generate ${reportFormat} report.`, variant: "destructive" });
    } finally {
      setGeneratingReports(prev => {
        const next = new Set(prev);
        next.delete(reportKey);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!actionTrigger || !embedded || !selectedReportId) return;
    if (actionTrigger.type === 'pdf') handleGenerateReport('PDF');
    else if (actionTrigger.type === 'excel') handleGenerateReport('Excel');
  }, [actionTrigger]);

  const reports = [
    {
      id: "class-items-master-list",
      name: "Class Items Master List",
      description: "All class-related jobs enriched with linked component identity and Section G classification & regulatory data.",
      frequency: "On-demand",
      icon: Shield,
      priority: "high" as const,
      estimatedTime: "1-2 min",
      outputs: ["PDF", "Excel"],
    },
  ];

  if (embedded) {
    return (
      <div className="w-full">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-red-600" data-testid="error-class-items-report">
            <AlertCircle className="h-6 w-6 mb-2" />
            <div>Failed to load class items report.</div>
            <div className="text-xs text-gray-500 mt-1">{(error as any)?.message || 'Please try again.'}</div>
          </div>
        ) : (isLoading || isFilterRefreshing) && !previewData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-sm text-gray-500">Loading class items report…</span>
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
    <div className="container mx-auto p-6 space-y-6" data-testid="page-class-items-reports">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-class-items">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Class Items Reports</h1>
            <p className="text-sm text-gray-500">Reports for class-related jobs and Section G classification data.</p>
          </div>
        </div>
      </div>

      <CategoryFilters
        filters={categoryFilters}
        onFiltersChange={setCategoryFilters}
        showDateRange={false}
      />

      <div className="grid gap-4">
        {reports.map(r => (
          <Card key={r.id} data-testid={`card-report-${r.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <r.icon className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <CardTitle className="text-base" data-testid={`text-report-name-${r.id}`}>{r.name}</CardTitle>
                    <CardDescription className="mt-1">{r.description}</CardDescription>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{r.frequency}</Badge>
                      <Badge variant="outline">{r.estimatedTime}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleGenerateReport('PDF')} disabled={isFetching} data-testid={`button-pdf-${r.id}`}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleGenerateReport('Excel')} disabled={isFetching} data-testid={`button-excel-${r.id}`}>
                    <Download className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ClassItemsReports;
