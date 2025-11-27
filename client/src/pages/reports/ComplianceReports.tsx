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
  Search,
  Shield,
  FileCheck,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Eye,
  Loader2
} from "lucide-react";
import { reportGenerator } from "@/lib/reportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";

interface ComplianceReport {
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
  complianceArea: 'certificates' | 'class' | 'safety' | 'security' | 'environmental';
}

interface ComplianceReportsProps {
  onBack: () => void;
  globalFilters?: {
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
}

const ComplianceReports: React.FC<ComplianceReportsProps> = ({ onBack, globalFilters }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();

  const reports: ComplianceReport[] = [
    {
      id: "certificates-status",
      name: "Certificates Status & Renewal Report",
      description: "Comprehensive overview of all vessel certificates with expiry dates, renewal requirements, and compliance status",
      purpose: "Monitor certificate validity & plan renewals (Captain/Office)",
      frequency: "Monthly",
      fields: ["Certificate Name", "Issue Date", "Expiry Date", "Days to Expiry", "Issuing Authority", "Status", "Action Required"],
      filters: ["Vessel", "Certificate Type", "Expiry Period", "Authority", "Status"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: FileCheck,
      priority: "high",
      lastGenerated: "1 day ago",
      estimatedTime: "2-3 min",
      complianceArea: "certificates"
    },
    {
      id: "class-surveys-schedule",
      name: "Class Surveys & Inspections Schedule",
      description: "Detailed schedule of classification society surveys, inspections due, and survey preparation requirements",
      purpose: "Survey planning & class compliance (Captain/Chief Eng)",
      frequency: "Weekly",
      fields: ["Survey Type", "Due Date", "Class Society", "Scope", "Preparation Required", "Last Survey", "Next Milestone"],
      filters: ["Vessel", "Survey Type", "Class Society", "Due Period", "Status"],
      outputs: ["PDF", "Excel"],
      icon: Shield,
      priority: "high",
      lastGenerated: "3 days ago",
      estimatedTime: "3-4 min",
      complianceArea: "class"
    },
    {
      id: "safety-compliance-audit",
      name: "Safety Compliance Audit Report",
      description: "Comprehensive safety compliance status including SOLAS, MARPOL, and flag state requirements",
      purpose: "Safety compliance monitoring & audit preparation (Captain/Safety)",
      frequency: "Quarterly",
      fields: ["Regulation", "Compliance Status", "Last Check", "Non-Conformities", "Corrective Actions", "Deadline", "Risk Level"],
      filters: ["Vessel", "Regulation Type", "Compliance Status", "Risk Level", "Due Actions"],
      outputs: ["PDF", "Excel"],
      icon: AlertTriangle,
      priority: "high",
      lastGenerated: "1 week ago",
      estimatedTime: "4-5 min",
      complianceArea: "safety"
    },
    {
      id: "security-drills-training",
      name: "Security Drills & Training Compliance",
      description: "ISPS Code compliance tracking including security drills, training records, and security assessment status",
      purpose: "Security compliance & crew training monitoring (Captain/CSO)",
      frequency: "Monthly",
      fields: ["Drill Type", "Last Conducted", "Next Due", "Participants", "Training Status", "Certificate Validity", "Compliance Notes"],
      filters: ["Vessel", "Drill Type", "Training Status", "Due Period", "Compliance Level"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Shield,
      priority: "medium",
      lastGenerated: "2 weeks ago",
      estimatedTime: "2-3 min",
      complianceArea: "security"
    },
    {
      id: "environmental-compliance",
      name: "Environmental Compliance Report",
      description: "Environmental regulatory compliance including emissions, waste management, and ballast water treatment",
      purpose: "Environmental compliance & reporting (Chief Eng/Captain)",
      frequency: "Monthly",
      fields: ["Regulation", "Compliance Parameter", "Current Status", "Monitoring Results", "Limits", "Actions Required", "Reporting Due"],
      filters: ["Vessel", "Regulation Type", "Compliance Status", "Parameter", "Action Required"],
      outputs: ["PDF", "Excel"],
      icon: CheckCircle,
      priority: "medium",
      lastGenerated: "5 days ago",
      estimatedTime: "3-4 min",
      complianceArea: "environmental"
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFrequency = selectedFrequency === "all" || 
                           report.frequency.toLowerCase().includes(selectedFrequency.toLowerCase());
    
    const matchesArea = selectedArea === "all" || report.complianceArea === selectedArea;
    
    return matchesSearch && matchesFrequency && matchesArea;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAreaColor = (area: string) => {
    switch (area) {
      case 'certificates': return 'bg-purple-100 text-purple-800';
      case 'class': return 'bg-blue-100 text-blue-800';
      case 'safety': return 'bg-red-100 text-red-800';
      case 'security': return 'bg-orange-100 text-orange-800';
      case 'environmental': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAreaStats = () => {
    const certificates = reports.filter(r => r.complianceArea === 'certificates').length;
    const classReports = reports.filter(r => r.complianceArea === 'class').length;
    const safety = reports.filter(r => r.complianceArea === 'safety').length;
    const highPriority = reports.filter(r => r.priority === 'high').length;
    
    return { certificates, classReports, safety, highPriority };
  };

  const stats = getAreaStats();

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
        area: selectedArea !== "all" ? selectedArea : undefined,
        search: searchQuery || undefined,
      };

      // For now, use the maintenance report generator - will create specific compliance generator later
      const blob = await reportGenerator.generateMaintenanceReport(reportId, format, filters);
      const report = reports.find(r => r.id === reportId);
      const filename = reportGenerator.generateFilename(
        report?.name || 'compliance-report', 
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
              <div className="p-2 rounded-lg bg-purple-500 text-white">
                <Shield className="h-5 w-5" />
              </div>
              Compliance, Class & Certificates
            </h1>
            <p className="text-gray-600">5 comprehensive reports for regulatory compliance, classification, and certification management</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search compliance reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-compliance-reports"
            />
          </div>
          
          <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
            <SelectTrigger className="w-48" data-testid="select-frequency-filter">
              <SelectValue placeholder="Filter by frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-48" data-testid="select-area-filter">
              <SelectValue placeholder="Filter by area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              <SelectItem value="certificates">Certificates</SelectItem>
              <SelectItem value="class">Class Surveys</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="environmental">Environmental</SelectItem>
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
                <p className="text-2xl font-bold text-gray-800" data-testid="text-compliance-total-reports">5</p>
              </div>
              <Shield className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-compliance-high-priority">{stats.highPriority}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Certificates</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="text-compliance-certificates-count">{stats.certificates}</p>
              </div>
              <FileCheck className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Safety Reports</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-compliance-safety-count">{stats.safety}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow" data-testid={`compliance-report-card-${report.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge className={getPriorityColor(report.priority)} variant="secondary">
                          {report.priority.toUpperCase()}
                        </Badge>
                        <Badge className={getAreaColor(report.complianceArea)} variant="secondary">
                          {report.complianceArea.toUpperCase()}
                        </Badge>
                      </div>
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
                        <Badge key={index} className="text-xs bg-purple-100 text-purple-700">
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
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default ComplianceReports;