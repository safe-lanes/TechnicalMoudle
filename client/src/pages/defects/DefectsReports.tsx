import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart3, PieChart, TrendingUp, FileSpreadsheet, FileText, FileDown, Play, AlertTriangle, CheckCircle, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const COMING_SOON = false;

interface ReportFilter {
  vesselId?: string;
  fleet?: string;
  period?: string;
  category?: string;
  type?: string;
  dueOverdue?: string;
  severity?: string;
  source?: string;
  portAtSea?: string;
  routineBreakdown?: string;
  reportedTo?: string;
  defermentOnly?: boolean;
}

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const reportConfigs: ReportConfig[] = [
  {
    id: 'open-defects',
    name: 'Open Defects Dashboard',
    description: 'KPIs: Total Open, Due this month, Overdue, Avg age, Top categories, By vessel/fleet',
    icon: AlertTriangle,
    color: 'bg-red-500'
  },
  {
    id: 'closure-performance',
    name: 'Closure Performance',
    description: 'Median days to close, % closed on time, by vessel/department/role',
    icon: TrendingUp,
    color: 'bg-blue-500'
  },
  {
    id: 'root-cause',
    name: 'Root Cause Analysis',
    description: 'Heatmap of Immediate vs Root causes, top frequent causes by vessel',
    icon: PieChart,
    color: 'bg-purple-500'
  },
  {
    id: 'deferments',
    name: 'Deferments Log',
    description: 'Count of deferred items, avg deferment days, reasons',
    icon: FileText,
    color: 'bg-orange-500'
  },
  {
    id: 'regulatory',
    name: 'Regulatory & Third-Party',
    description: 'Reports to Class/Flag/Port, statuses, outcomes',
    icon: FileSpreadsheet,
    color: 'bg-green-500'
  },
  {
    id: 'aging',
    name: 'Aging Report',
    description: 'Buckets: 0-7, 8-30, 31-60, 61-90, >90 days open',
    icon: BarChart3,
    color: 'bg-indigo-500'
  },
  {
    id: 'viq-sfi',
    name: 'VIQ/SFI Reference',
    description: 'Defects by VIQ ref and SFI code for audits',
    icon: CheckCircle,
    color: 'bg-teal-500'
  }
];

export default function DefectsReports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilter>({});
  const [reportData, setReportData] = useState<any>(null);

  const { data: vessels = [] } = useVessels();

  const runReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return apiRequest('POST', `/technical/api/defects/reports/${reportId}`, filters);
    },
    onSuccess: (data) => {
      setReportData(data);
    },
    onError: (error) => {
      console.error('Failed to generate report:', error);
    }
  });

  const handleRunReport = () => {
    if (selectedReport) {
      runReportMutation.mutate(selectedReport);
    }
  };

  const handleExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!selectedReport || !reportData) return;
    
    const filename = `Defects_${selectedReport}_${new Date().toISOString().split('T')[0]}.${format}`;
    console.log(`Exporting as ${filename}`);
  };

  const handleFilterChange = (key: keyof ReportFilter, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (COMING_SOON) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black dark:text-white">Defects Reports</h1>
        </div>
        <p className="text-lg text-muted-foreground">Coming Soon...</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white" data-testid="text-defects-reports-title">Defects Reports</h1>
            <p className="text-sm text-muted-foreground">{reportConfigs.length} reports for defect tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRunReport}
              disabled={!selectedReport || runReportMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
              data-testid="button-run-report"
            >
              <Play className="h-4 w-4 mr-1" />
              {runReportMutation.isPending ? 'Generating...' : 'Run Report'}
            </Button>
            {reportData && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('csv')}
                  data-testid="button-export-csv"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('xlsx')}
                  data-testid="button-export-excel"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('pdf')}
                  data-testid="button-export-pdf"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  PDF
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3" data-testid="defect-report-filters">
          <div className="min-w-[140px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Vessel</Label>
            <Select value={filters.vesselId || ''} onValueChange={(value) => handleFilterChange('vesselId', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-vessel">
                <SelectValue placeholder="All Vessels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels.map((vessel: any) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name || vessel.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[120px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Fleet</Label>
            <Select value={filters.fleet} onValueChange={(value) => handleFilterChange('fleet', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-fleet">
                <SelectValue placeholder="All Fleets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fleets</SelectItem>
                <SelectItem value="fleet1">Fleet 1</SelectItem>
                <SelectItem value="fleet2">Fleet 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[120px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Period</Label>
            <Select value={filters.period} onValueChange={(value) => handleFilterChange('period', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-period">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[130px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Category</Label>
            <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Defect">Defect</SelectItem>
                <SelectItem value="COC">COC</SelectItem>
                <SelectItem value="Observation">Observation</SelectItem>
                <SelectItem value="NCR">NCR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[110px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Type</Label>
            <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Routine">Routine</SelectItem>
                <SelectItem value="Corrective">Corrective</SelectItem>
                <SelectItem value="Emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[130px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Severity (VIQ)</Label>
            <Select value={filters.severity} onValueChange={(value) => handleFilterChange('severity', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-severity">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="1">Minor</SelectItem>
                <SelectItem value="2">Moderate</SelectItem>
                <SelectItem value="3">Major</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[110px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Source</Label>
            <Select value={filters.source} onValueChange={(value) => handleFilterChange('source', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-source">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="SIRE">SIRE</SelectItem>
                <SelectItem value="PSC">PSC</SelectItem>
                <SelectItem value="Internal">Internal</SelectItem>
                <SelectItem value="Class">Class</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[140px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Operating Condition</Label>
            <Select value={filters.portAtSea} onValueChange={(value) => handleFilterChange('portAtSea', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-operating-condition">
                <SelectValue placeholder="All Conditions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conditions</SelectItem>
                <SelectItem value="SAILING">Sailing</SelectItem>
                <SelectItem value="PORT">Port</SelectItem>
                <SelectItem value="ANCHOR">At Anchor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[130px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Occurrence Type</Label>
            <Select value={filters.routineBreakdown} onValueChange={(value) => handleFilterChange('routineBreakdown', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-occurrence-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ROUTINE">Routine</SelectItem>
                <SelectItem value="BREAKDOWN">Breakdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[110px]">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Reported To</Label>
            <Select value={filters.reportedTo} onValueChange={(value) => handleFilterChange('reportedTo', value)}>
              <SelectTrigger className="h-9" data-testid="select-defect-reported-to">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Class">Class</SelectItem>
                <SelectItem value="Flag">Flag</SelectItem>
                <SelectItem value="Port">Port</SelectItem>
                <SelectItem value="None">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Total Reports
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-defects-total-reports">{reportConfigs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Analysis Reports
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-defects-analysis-reports">
              {reportConfigs.filter(r => ['closure-performance', 'root-cause', 'aging'].includes(r.id)).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Compliance Reports
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-defects-compliance-reports">
              {reportConfigs.filter(r => ['regulatory', 'viq-sfi'].includes(r.id)).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <FileText className="w-4 h-4 text-orange-500" />
              Log Reports
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-defects-log-reports">
              {reportConfigs.filter(r => ['open-defects', 'deferments'].includes(r.id)).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="rounded-md border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Report Name</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Description</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {reportConfigs.map((report) => {
              const Icon = report.icon;
              const isSelected = selectedReport === report.id;
              return (
                <tr
                  key={report.id}
                  className={cn(
                    "hover:bg-gray-50 cursor-pointer",
                    isSelected && "bg-blue-50"
                  )}
                  onClick={() => setSelectedReport(report.id)}
                  data-testid={`defect-report-row-${report.id}`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-md text-white", report.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-gray-900">{report.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-500">{report.description}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Select Report"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReport(report.id);
                        }}
                        data-testid={`button-select-${report.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reportData && selectedReport && (
        <div className="mt-6 rounded-md border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4" data-testid="text-selected-report-title">
            {reportConfigs.find(r => r.id === selectedReport)?.name}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600" data-testid="text-total-open">125</div>
                <div className="text-sm text-gray-500">Total Open</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-amber-600" data-testid="text-due-this-month">32</div>
                <div className="text-sm text-gray-500">Due This Month</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600" data-testid="text-overdue">18</div>
                <div className="text-sm text-gray-500">Overdue</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600" data-testid="text-avg-days-open">14.5</div>
                <div className="text-sm text-gray-500">Avg Days Open</div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-gray-50 rounded-md p-12 text-center">
            <p className="text-gray-500">
              Report charts and detailed data will be displayed here
            </p>
          </div>
        </div>
      )}

      {!reportData && !selectedReport && (
        <div className="mt-6 text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a report to get started</h3>
          <p className="text-gray-500">Click on any report row above, then use the play button to generate it</p>
        </div>
      )}
    </div>
  );
}
