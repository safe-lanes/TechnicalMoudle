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
  Search,
  Clock,
  TrendingUp,
  Activity,
  AlertTriangle,
  BarChart3,
  Gauge,
  Eye,
  Loader2
} from "lucide-react";
import { reportGenerator } from "@/lib/reportGenerator";
import { useToast } from "@/hooks/use-toast";

interface RunningHoursReport {
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

interface RunningHoursReportsProps {
  onBack: () => void;
}

const RunningHoursReports: React.FC<RunningHoursReportsProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const reports: RunningHoursReport[] = [
    {
      id: "rh-utilization-summary",
      name: "Equipment Utilization Summary",
      description: "Comprehensive utilization rates and performance metrics for all monitored equipment",
      purpose: "Monitor equipment usage efficiency (Chief Eng/Office)",
      frequency: "Weekly/Monthly",
      fields: ["Component", "Utilization Rate", "Avg Hours/Day", "Days Active", "Performance Rating", "Trend Analysis"],
      filters: ["Vessel", "Dept", "Equipment Type", "Date Range", "Utilization Threshold"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: TrendingUp,
      priority: "high",
      lastGenerated: "2 hours ago",
      estimatedTime: "2-3 min"
    },
    {
      id: "rh-anomaly-detection",
      name: "Running Hours Anomaly Detection",
      description: "Identify equipment with unusual running patterns or potential meter issues",
      purpose: "Quality control & meter validation (Tech Office)",
      frequency: "Weekly",
      fields: ["Component", "Expected vs Actual RH", "Anomaly Score", "Deviation %", "Last Updated", "Validation Status"],
      filters: ["Vessel", "Dept", "Anomaly Threshold", "Date Range", "Validation Status"],
      outputs: ["PDF", "Excel"],
      icon: AlertTriangle,
      priority: "high",
      lastGenerated: "1 day ago",
      estimatedTime: "1-2 min"
    },
    {
      id: "rh-performance-trends",
      name: "Equipment Performance Trends",
      description: "Long-term performance analysis showing efficiency trends and degradation patterns",
      purpose: "Predictive maintenance planning (Office)",
      frequency: "Monthly",
      fields: ["Component", "Performance Score", "Trend Direction", "Efficiency Change %", "Maintenance Impact", "Recommendations"],
      filters: ["Vessel", "Dept", "Time Period", "Performance Threshold", "Equipment Type"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: BarChart3,
      priority: "medium",
      lastGenerated: "3 days ago",
      estimatedTime: "3-5 min"
    },
    {
      id: "rh-condition-monitoring",
      name: "Equipment Condition Dashboard",
      description: "Real-time condition monitoring with health scores and maintenance alerts",
      purpose: "Operational awareness (Vessel/Office)",
      frequency: "Daily",
      fields: ["Component", "Health Score", "Operating Status", "Alert Level", "Last Service", "Next Due", "Critical Items"],
      filters: ["Vessel", "Dept", "Health Threshold", "Alert Level"],
      outputs: ["Dashboard", "PDF", "Excel"],
      icon: Activity,
      priority: "high",
      lastGenerated: "4 hours ago",
      estimatedTime: "< 1 min"
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

      // Get current filters
      const filters = {
        vessel: "MV Atlantic Star", // Will be dynamic later
        frequency: selectedFrequency !== "all" ? selectedFrequency : undefined,
        priority: selectedPriority !== "all" ? selectedPriority : undefined,
        search: searchQuery || undefined,
      };

      // For now, use the maintenance report generator - will create specific RH generator later
      const blob = await reportGenerator.generateMaintenanceReport(reportId, format, filters);
      const report = reports.find(r => r.id === reportId);
      const filename = reportGenerator.generateFilename(
        report?.name || 'running-hours-report', 
        format, 
        'MV_Atlantic_Star'
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
              <div className="p-2 rounded-lg bg-green-500 text-white">
                <Clock className="h-5 w-5" />
              </div>
              Running Hours & Condition
            </h1>
            <p className="text-gray-600">4 comprehensive reports for equipment monitoring and performance analysis</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search running hours reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-rh-reports"
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
                <p className="text-2xl font-bold text-gray-800" data-testid="text-rh-total-reports">4</p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-rh-high-priority">3</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Real-time</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-rh-realtime">2</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Generated Today</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-rh-generated-today">2</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow" data-testid={`rh-report-card-${report.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600">
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
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default RunningHoursReports;