import { useState } from "react";
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
  Search,
  Clock,
  TrendingUp,
  Activity,
  AlertTriangle,
  Gauge,
  Eye,
  Loader2
} from "lucide-react";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";

interface RunningHoursReport {
  id: string;
  name: string;
  description: string;
  purpose: string;
  frequency: string;
  fields: string[];
  outputs: string[];
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
}

interface RunningHoursReportsProps {
  onBack: () => void;
}

const RunningHoursReports: React.FC<RunningHoursReportsProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId } = useVessel();

  const { data: components = [] } = useQuery<any[]>({
    queryKey: ['/api/components', vesselId],
    enabled: !!vesselId && vesselId !== 'all',
  });

  const { data: runningHours = [] } = useQuery<any[]>({
    queryKey: ['/api/running-hours', vesselId],
    enabled: !!vesselId && vesselId !== 'all',
  });

  const reports: RunningHoursReport[] = [
    {
      id: "rh-utilization-summary",
      name: "Equipment Utilization Summary",
      description: "Comprehensive utilization rates and performance metrics for all monitored equipment",
      purpose: "Monitor equipment usage efficiency (Chief Eng/Office)",
      frequency: "Weekly/Monthly",
      fields: ["Component", "Current RH", "Last Updated", "Status"],
      outputs: ["PDF", "Excel"],
      icon: TrendingUp,
      priority: "high",
      estimatedTime: "2-3 min"
    },
    {
      id: "rh-anomaly-detection",
      name: "Running Hours Anomaly Detection",
      description: "Identify equipment with unusual running patterns or potential meter issues",
      purpose: "Detect equipment issues early (Chief Eng/Office)",
      frequency: "Weekly",
      fields: ["Component", "Expected RH", "Actual RH", "Variance", "Flag"],
      outputs: ["PDF", "Excel"],
      icon: AlertTriangle,
      priority: "high",
      estimatedTime: "2-3 min"
    },
    {
      id: "rh-maintenance-triggers",
      name: "RH-Based Maintenance Triggers",
      description: "Equipment approaching running hours-based maintenance thresholds",
      purpose: "Plan RH-based maintenance (Chief Eng)",
      frequency: "Daily/Weekly",
      fields: ["Component", "Current RH", "Next Due RH", "Remaining", "Job"],
      outputs: ["PDF", "Dashboard"],
      icon: Gauge,
      priority: "high",
      estimatedTime: "1-2 min"
    },
    {
      id: "rh-condition-monitoring",
      name: "Condition Monitoring Trends",
      description: "Track equipment condition indicators over time",
      purpose: "Predictive maintenance planning (Office)",
      frequency: "Monthly",
      fields: ["Component", "Condition Score", "Trend", "Last Reading", "Notes"],
      outputs: ["PDF", "Excel"],
      icon: Activity,
      priority: "medium",
      estimatedTime: "3-5 min"
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = selectedPriority === "all" || report.priority === selectedPriority;
    return matchesSearch && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const generateRunningHoursPDF = async (reportId: string) => {
    const vesselName = vessels.find(v => v.id === vesselId)?.name || vesselId || 'All Vessels';

    const componentsWithRH = components.filter((c: any) => 
      c.runningHours !== undefined && c.runningHours !== null
    );

    switch (reportId) {
      case 'rh-utilization-summary': {
        const columns = [
          { header: 'Code', field: 'code', width: 30 },
          { header: 'Component Name', field: 'name', width: 60 },
          { header: 'Running Hours', field: 'runningHours', width: 35 },
          { header: 'Last Updated', field: 'lastUpdated', width: 35 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = componentsWithRH.map((c: any) => ({
          code: c.componentCode || c.code || '-',
          name: c.name || '-',
          runningHours: c.runningHours || 0,
          lastUpdated: c.rhLastUpdated || 'N/A',
          status: c.runningHours > 0 ? 'Active' : 'Inactive'
        }));

        const summary = [
          { label: 'Total Components', value: data.length },
          { label: 'Active', value: data.filter((d: any) => d.status === 'Active').length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Equipment Utilization Summary', subtitle: 'Running hours overview', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'rh-anomaly-detection': {
        const columns = [
          { header: 'Code', field: 'code', width: 30 },
          { header: 'Component', field: 'name', width: 55 },
          { header: 'Current RH', field: 'runningHours', width: 30 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = componentsWithRH.map((c: any) => ({
          code: c.componentCode || c.code || '-',
          name: c.name || '-',
          runningHours: c.runningHours || 0,
          status: 'Normal'
        }));

        pdfReportGenerator.generateReport(
          { title: 'Running Hours Anomaly Detection', subtitle: 'Equipment monitoring report', vessel: vesselName },
          columns,
          data
        );
        break;
      }

      case 'rh-maintenance-triggers': {
        const columns = [
          { header: 'Code', field: 'code', width: 30 },
          { header: 'Component', field: 'name', width: 55 },
          { header: 'Current RH', field: 'runningHours', width: 30 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = componentsWithRH.map((c: any) => ({
          code: c.componentCode || c.code || '-',
          name: c.name || '-',
          runningHours: c.runningHours || 0,
          status: 'OK'
        }));

        const summary = [
          { label: 'Components with RH', value: data.length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'RH-Based Maintenance Triggers', subtitle: 'Equipment approaching maintenance', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'rh-condition-monitoring': {
        const columns = [
          { header: 'Code', field: 'code', width: 30 },
          { header: 'Component', field: 'name', width: 60 },
          { header: 'Running Hours', field: 'runningHours', width: 35 },
          { header: 'Condition', field: 'condition', width: 30 }
        ];

        const data = componentsWithRH.map((c: any) => ({
          code: c.componentCode || c.code || '-',
          name: c.name || '-',
          runningHours: c.runningHours || 0,
          condition: 'Good'
        }));

        pdfReportGenerator.generateReport(
          { title: 'Condition Monitoring Trends', subtitle: 'Equipment condition report', vessel: vesselName },
          columns,
          data
        );
        break;
      }

      default:
        toast({
          title: "Report Not Available",
          description: "This report type is not yet implemented",
          variant: "destructive"
        });
    }
  };

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel') => {
    const reportKey = `${reportId}-${format}`;
    
    if (generatingReports.has(reportKey)) return;

    const componentsWithRH = components.filter((c: any) => 
      c.runningHours !== undefined && c.runningHours !== null
    );

    if (componentsWithRH.length === 0) {
      toast({ 
        title: "No Data Available", 
        description: "No components with running hours data found. Please ensure equipment has running hours recorded.",
        variant: "destructive" 
      });
      return;
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateRunningHoursPDF(reportId);
        toast({ title: "Report Generated", description: `${format} report downloaded successfully!` });
      } else {
        toast({ title: "Excel Export", description: "Excel export coming soon." });
      }
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast({ title: "Generation Failed", description: "Failed to generate report.", variant: "destructive" });
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportKey);
        return newSet;
      });
    }
  };

  const componentsWithRH = components.filter((c: any) => c.runningHours !== undefined && c.runningHours !== null);

  return (
    <div className="p-6 bg-[#fafafa] min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
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
            <p className="text-gray-600">4 reports for equipment monitoring</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search running hours reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedPriority} onValueChange={setSelectedPriority}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Components with RH</p>
                <p className="text-2xl font-bold text-gray-800">{componentsWithRH.length}</p>
              </div>
              <Gauge className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Components</p>
                <p className="text-2xl font-bold text-blue-600">{components.length}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reports Available</p>
                <p className="text-2xl font-bold text-purple-600">4</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600">3</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow">
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

                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Key Fields:</p>
                  <div className="flex flex-wrap gap-1">
                    {report.fields.slice(0, 4).map((field, index) => (
                      <Badge key={index} variant="outline" className="text-xs">{field}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <Button size="sm" variant="outline" onClick={() => handleGenerateReport(report.id, 'PDF')} className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      onClick={() => handleGenerateReport(report.id, 'PDF')}
                      className="bg-red-600 hover:bg-red-700 text-white px-3"
                      disabled={generatingReports.has(`${report.id}-PDF`)}
                    >
                      {generatingReports.has(`${report.id}-PDF`) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'PDF'}
                    </Button>
                    {report.outputs.includes('Excel') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGenerateReport(report.id, 'Excel')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3"
                        disabled={generatingReports.has(`${report.id}-Excel`)}
                      >
                        {generatingReports.has(`${report.id}-Excel`) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excel'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default RunningHoursReports;
