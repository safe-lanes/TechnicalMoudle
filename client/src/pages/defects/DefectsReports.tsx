import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart3, PieChart, TrendingUp, FileSpreadsheet, FileText, FileDown, Play, AlertTriangle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

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

  const { data: vessels = [] } = useQuery({
    queryKey: ['/technical/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/technical/api/vessels');
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    }
  });

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
    // TODO: Implement actual export logic
    console.log(`Exporting as ${filename}`);
  };

  const handleFilterChange = (key: keyof ReportFilter, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-black dark:text-white">Defects Reports</h1>
        </div>
      </div>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left: Report Selector */}
        <div className="w-96 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Select Report</h2>
          <div className="space-y-2">
            {reportConfigs.map((report) => {
              const Icon = report.icon;
              return (
                <Card
                  key={report.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedReport === report.id && "ring-2 ring-blue-500"
                  )}
                  onClick={() => setSelectedReport(report.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-lg text-white", report.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm">{report.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {report.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right: Filter Panel and Report Display */}
        <div className="flex-1 flex flex-col">
          {/* Filter Panel */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Report Filters</h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleRunReport}
                  disabled={!selectedReport || runReportMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
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
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport('xlsx')}
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport('pdf')}
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Filter Controls Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Vessel</Label>
                <Select value={filters.vesselId || ''} onValueChange={(value) => handleFilterChange('vesselId', value)}>
                  <SelectTrigger className="h-8 text-xs">
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

              <div>
                <Label className="text-xs">Fleet</Label>
                <Select value={filters.fleet} onValueChange={(value) => handleFilterChange('fleet', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Fleets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fleets</SelectItem>
                    <SelectItem value="fleet1">Fleet 1</SelectItem>
                    <SelectItem value="fleet2">Fleet 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Period</Label>
                <Select value={filters.period} onValueChange={(value) => handleFilterChange('period', value)}>
                  <SelectTrigger className="h-8 text-xs">
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

              <div>
                <Label className="text-xs">Category</Label>
                <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                  <SelectTrigger className="h-8 text-xs">
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

              <div>
                <Label className="text-xs">Type</Label>
                <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                  <SelectTrigger className="h-8 text-xs">
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

              <div>
                <Label className="text-xs">Severity (VIQ)</Label>
                <Select value={filters.severity} onValueChange={(value) => handleFilterChange('severity', value)}>
                  <SelectTrigger className="h-8 text-xs">
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

              <div>
                <Label className="text-xs">Source</Label>
                <Select value={filters.source} onValueChange={(value) => handleFilterChange('source', value)}>
                  <SelectTrigger className="h-8 text-xs">
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
              
              <div>
                <Label className="text-xs">Operating Condition</Label>
                <Select value={filters.portAtSea} onValueChange={(value) => handleFilterChange('portAtSea', value)}>
                  <SelectTrigger className="h-8 text-xs">
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
              
              <div>
                <Label className="text-xs">Occurrence Type</Label>
                <Select value={filters.routineBreakdown} onValueChange={(value) => handleFilterChange('routineBreakdown', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ROUTINE">Routine</SelectItem>
                    <SelectItem value="BREAKDOWN">Breakdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Reported To</Label>
                <Select value={filters.reportedTo} onValueChange={(value) => handleFilterChange('reportedTo', value)}>
                  <SelectTrigger className="h-8 text-xs">
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

          {/* Report Display Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {!selectedReport ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a report from the left to get started</p>
                </div>
              </div>
            ) : !reportData ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Click "Run Report" to generate the report</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6">
                {/* Report content will be rendered based on the selected report type */}
                <h2 className="text-lg font-semibold mb-4">
                  {reportConfigs.find(r => r.id === selectedReport)?.name}
                </h2>
                
                {/* Sample KPI Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-600">125</div>
                      <div className="text-sm text-gray-500">Total Open</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-amber-600">32</div>
                      <div className="text-sm text-gray-500">Due This Month</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-red-600">18</div>
                      <div className="text-sm text-gray-500">Overdue</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-600">14.5</div>
                      <div className="text-sm text-gray-500">Avg Days Open</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Placeholder for charts and tables */}
                <div className="bg-gray-50 rounded-lg p-12 text-center">
                  <p className="text-gray-500">
                    Report charts and detailed data will be displayed here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}