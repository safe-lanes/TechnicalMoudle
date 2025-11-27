import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  Download,
  Filter,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  TrendingUp,
  Users,
  Settings,
  Eye,
  Play,
  Loader2
} from "lucide-react";
import { reportGenerator } from "@/lib/reportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";

interface MaintenanceReport {
  id: string;
  name: string;
  description: string;
  purpose: string;
  frequency: string;
  fields: string[];
  filters: string[];
  outputs: string[];
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
  lastGenerated?: string;
  estimatedTime: string;
}

interface MaintenanceReportsProps {
  onBack: () => void;
  globalFilters?: {
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
}

const MaintenanceReports: React.FC<MaintenanceReportsProps> = ({ onBack, globalFilters }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();

  const reports: MaintenanceReport[] = [
    {
      id: "due-jobs-7",
      name: "Due Jobs (7 days)",
      description: "Upcoming work orders due in the next 7 days",
      purpose: "Plan upcoming work (Chief Eng/Chief Off)",
      frequency: "Daily/Weekly",
      fields: ["WO No/Title", "Component", "Dept", "Priority", "Due Date/Hour", "Required Spares/Tools/Permits", "Risk Notes"],
      filters: ["Vessel", "Dept", "Priority", "Window (7/14/30)", "Component/System"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Clock,
      priority: "high",
      lastGenerated: "2 hours ago",
      estimatedTime: "< 1 min"
    },
    {
      id: "overdue-jobs",
      name: "Overdue Jobs",
      description: "Work orders that are past their due dates requiring immediate attention",
      purpose: "Focus late work & escalation (Vessel/Office)",
      frequency: "Daily",
      fields: ["WO", "Component", "Days Overdue", "Reason/Comments", "Escalation Status", "Approver"],
      filters: ["Vessel", "Dept", "Priority", "Critical"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: AlertTriangle,
      priority: "high",
      lastGenerated: "1 hour ago",
      estimatedTime: "< 1 min"
    },
    {
      id: "completed-jobs",
      name: "Completed Jobs Register",
      description: "Comprehensive register of all completed maintenance work",
      purpose: "Evidence of work done (Audits/Office)",
      frequency: "Weekly/Monthly",
      fields: ["WO", "Component", "Dates (Start/Finish)", "Man-Hours", "Performed By", "Part-B Notes", "Attachments"],
      filters: ["Vessel", "Dept", "Date Range", "Component"],
      outputs: ["PDF bundle", "Excel"],
      icon: CheckCircle,
      priority: "medium",
      lastGenerated: "1 day ago",
      estimatedTime: "2-3 min"
    },
    {
      id: "monthly-summary",
      name: "Monthly Maintenance Summary",
      description: "KPI overview and performance metrics for management",
      purpose: "KPI overview (Management)",
      frequency: "Monthly",
      fields: ["Planned vs Completed", "On-time %", "Avg Days Late", "Breakdown by Dept/System/Criticality", "Trend vs last 3 months"],
      filters: ["Vessel", "Dept", "Period"],
      outputs: ["PDF", "Dashboard"],
      icon: TrendingUp,
      priority: "medium",
      lastGenerated: "3 days ago",
      estimatedTime: "3-5 min"
    },
    {
      id: "critical-equipment",
      name: "Critical Equipment Status",
      description: "Status monitoring for safety-critical components",
      purpose: "Safety-critical control (Office/Vessel)",
      frequency: "Weekly",
      fields: ["List of Critical Components", "Due/Completed/Overdue Counts", "Top Overdue with risk notes"],
      filters: ["Vessel", "Dept"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Settings,
      priority: "high",
      lastGenerated: "6 hours ago",
      estimatedTime: "1-2 min"
    },
    {
      id: "unplanned-jobs",
      name: "Unplanned/Breakdown Jobs",
      description: "Analysis of corrective maintenance and equipment failures",
      purpose: "Track corrective maintenance (Tech Office)",
      frequency: "Monthly",
      fields: ["WO", "Failure Category", "Root Cause", "Time to Repair", "Recurrence Flag", "Follow-up Actions"],
      filters: ["Vessel", "Dept", "Date Range"],
      outputs: ["Excel", "PDF"],
      icon: AlertTriangle,
      priority: "medium",
      lastGenerated: "1 week ago",
      estimatedTime: "2-4 min"
    },
    {
      id: "postponement-log",
      name: "Job Postponement Log",
      description: "Governance tracking of deferred maintenance work",
      purpose: "Governance of deferrals (QA/Office)",
      frequency: "Monthly",
      fields: ["WO", "Original Due", "New Due", "Reason", "Approver", "Justification"],
      filters: ["Vessel", "Dept", "Period"],
      outputs: ["Excel", "PDF"],
      icon: Calendar,
      priority: "medium",
      lastGenerated: "2 days ago",
      estimatedTime: "1-2 min"
    },
    {
      id: "priority-performance",
      name: "Work Priority Performance",
      description: "Analysis of work execution versus assigned priorities",
      purpose: "Execution vs priority (Office)",
      frequency: "Monthly",
      fields: ["On-time % by Priority", "Late Buckets", "Exception Notes"],
      filters: ["Vessel", "Dept", "Priority"],
      outputs: ["Dashboard", "Excel"],
      icon: TrendingUp,
      priority: "low",
      lastGenerated: "5 days ago",
      estimatedTime: "2-3 min"
    },
    {
      id: "manhours-analysis",
      name: "Man-Hours Planned vs Actual",
      description: "Resource planning analysis comparing estimated vs actual hours",
      purpose: "Resourcing (Office)",
      frequency: "Monthly",
      fields: ["WO", "Planned Hrs", "Actual Hrs", "Variance", "Rank Mix", "Comments"],
      filters: ["Vessel", "Dept", "Date Range"],
      outputs: ["Excel", "PDF"],
      icon: Users,
      priority: "medium",
      lastGenerated: "1 week ago",
      estimatedTime: "3-4 min"
    },
    {
      id: "workload-distribution",
      name: "Crew Workload Distribution",
      description: "Analysis of task distribution across crew ranks and assignments",
      purpose: "Balance tasks across ranks (Vessel/Office)",
      frequency: "Monthly",
      fields: ["Jobs/Hours by Assignee/Rank", "Overtime Flags", "Backlog by Rank"],
      filters: ["Vessel", "Dept", "Period"],
      outputs: ["Dashboard", "Excel"],
      icon: Users,
      priority: "low",
      lastGenerated: "1 week ago",
      estimatedTime: "2-3 min"
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFrequency = selectedFrequency === "all" || 
                           report.frequency.toLowerCase().includes(selectedFrequency.toLowerCase());
    
    const matchesPriority = selectedPriority === "all" || report.priority === selectedPriority;
    
    return matchesSearch && matchesFrequency && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel' | 'CSV') => {
    const reportKey = `${reportId}-${format}`;
    
    if (generatingReports.has(reportKey)) {
      return; // Already generating this report
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      
      toast({
        title: "Generating Report",
        description: `Creating ${format} report for ${reports.find(r => r.id === reportId)?.name}...`,
      });

      // Get current filters - use globalFilters vessel or first available vessel
      const vesselName = globalFilters?.vessel || vessels[0]?.name || "Unknown Vessel";
      const vesselCode = vesselName.replace(/\s+/g, '_');
      const filters = {
        vessel: vesselName,
        frequency: selectedFrequency !== "all" ? selectedFrequency : undefined,
        priority: selectedPriority !== "all" ? selectedPriority : undefined,
        search: searchQuery || undefined,
      };

      const blob = await reportGenerator.generateMaintenanceReport(reportId, format, filters);
      const report = reports.find(r => r.id === reportId);
      const filename = reportGenerator.generateFilename(
        report?.name || 'maintenance-report', 
        format, 
        vesselCode
      );
      
      await reportGenerator.downloadReport(blob, filename);
      
      toast({
        title: "Report Generated",
        description: `${format} report downloaded successfully!`,
        variant: "default",
      });
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Generation Failed",
        description: `Failed to generate ${format} report. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportKey);
        return newSet;
      });
    }
  };

  const handlePreviewReport = (reportId: string) => {
    // For now, generate a PDF preview
    handleGenerateReport(reportId, 'PDF');
  };

  return (
    <div className="p-6 bg-[#fafafa] min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button 
            variant="outline" 
            onClick={onBack}
            className="flex items-center gap-2"
            data-testid="button-back-to-reports"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Button>
          <div className="h-6 border-l border-gray-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500 text-white">
                <FileText className="h-5 w-5" />
              </div>
              Maintenance & Work Orders
            </h1>
            <p className="text-gray-600">10 comprehensive reports for maintenance planning and tracking</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search maintenance reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-maintenance-reports"
            />
          </div>
          
          <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
            <SelectTrigger className="w-48" data-testid="select-frequency-filter">
              <SelectValue placeholder="Filter by frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPriority} onValueChange={setSelectedPriority}>
            <SelectTrigger className="w-48" data-testid="select-priority-filter">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
              <SelectItem value="low">Low Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-800" data-testid="text-maintenance-total-reports">10</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-maintenance-high-priority">3</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Daily Reports</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-maintenance-daily-reports">2</p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Generated Today</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-maintenance-generated-today">4</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow" data-testid={`maintenance-report-card-${report.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <Badge className={getPriorityColor(report.priority)} variant="secondary">
                        {report.priority.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{report.frequency}</p>
                    <p>{report.estimatedTime}</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <p className="text-gray-700 text-sm mb-2">{report.description}</p>
                  <p className="text-xs text-gray-500"><strong>Purpose:</strong> {report.purpose}</p>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Key Fields:</p>
                    <div className="flex flex-wrap gap-1">
                      {report.fields.slice(0, 3).map((field, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                      {report.fields.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{report.fields.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Outputs:</p>
                    <div className="flex gap-1">
                      {report.outputs.map((output, index) => (
                        <Badge key={index} className="text-xs bg-green-100 text-green-700">
                          {output}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {report.lastGenerated && (
                  <p className="text-xs text-gray-500">Last generated: {report.lastGenerated}</p>
                )}

                <div className="flex gap-2 pt-3 border-t">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handlePreviewReport(report.id)}
                    className="flex items-center gap-2"
                    data-testid={`button-preview-${report.id}`}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  
                  <div className="flex gap-1">
                    {report.outputs.includes('PDF') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGenerateReport(report.id, 'PDF')}
                        className="bg-red-600 hover:bg-red-700 text-white px-3"
                        disabled={generatingReports.has(`${report.id}-PDF`)}
                        data-testid={`button-pdf-${report.id}`}
                      >
                        {generatingReports.has(`${report.id}-PDF`) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'PDF'
                        )}
                      </Button>
                    )}
                    {report.outputs.includes('Excel') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGenerateReport(report.id, 'Excel')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3"
                        disabled={generatingReports.has(`${report.id}-Excel`)}
                        data-testid={`button-excel-${report.id}`}
                      >
                        {generatingReports.has(`${report.id}-Excel`) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Excel'
                        )}
                      </Button>
                    )}
                    {report.outputs.includes('Dashboard') && (
                      <Button 
                        size="sm" 
                        onClick={() => {
                          toast({
                            title: "Dashboard View",
                            description: "Dashboard view will be implemented in the next phase",
                          });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3"
                        data-testid={`button-dashboard-${report.id}`}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default MaintenanceReports;