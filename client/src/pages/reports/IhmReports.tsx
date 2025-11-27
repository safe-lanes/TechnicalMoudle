import React, { useState } from 'react';
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
  FileText,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Package,
  Wrench,
  TrendingUp,
  Recycle,
  Shield,
  BarChart3,
  Eye,
  Loader2
} from 'lucide-react';
import { FEATURES } from '@/config/features';
import { reportGenerator } from "@/lib/reportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";

interface IhmSummary {
  totalComponents: number;
  knownStatus: number;
  unknownStatus: number;
  withIHM: number;
  withoutIHM: number;
  lastUpdated: string;
}

interface IhmMaterial {
  material: string;
  count: number;
  totalWeight: string;
  percentage: number;
}

interface IhmReport {
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
  reportType: 'inventory' | 'compliance';
}

interface IhmReportsProps {
  onBack: () => void;
}

const IhmReports: React.FC<IhmReportsProps> = ({ onBack }) => {
  const [reportType, setReportType] = useState("summary");
  const [dateRange, setDateRange] = useState("last30days");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();

  // Mock data - in real implementation, fetch from API
  const summary: IhmSummary = {
    totalComponents: 1247,
    knownStatus: 892,
    unknownStatus: 355,
    withIHM: 187,
    withoutIHM: 705,
    lastUpdated: "2025-01-02"
  };

  const materials: IhmMaterial[] = [
    { material: "Asbestos", count: 45, totalWeight: "125.5 kg", percentage: 24 },
    { material: "PCB", count: 32, totalWeight: "78.2 kg", percentage: 17 },
    { material: "PFOS", count: 28, totalWeight: "45.3 kg", percentage: 15 },
    { material: "Lead", count: 52, totalWeight: "210.8 kg", percentage: 28 },
    { material: "Mercury", count: 12, totalWeight: "3.5 kg", percentage: 6 },
    { material: "Ozone Depleting Substances", count: 18, totalWeight: "22.1 kg", percentage: 10 }
  ];

  const recentChanges = [
    {
      date: "2025-01-02",
      action: "Removed",
      component: "ME-COMP-001",
      material: "Asbestos",
      quantity: "5.2 kg",
      user: "Chief Engineer"
    },
    {
      date: "2025-01-01",
      action: "Installed",
      component: "AUX-COMP-045",
      material: "PCB",
      quantity: "2.1 kg",
      user: "2nd Engineer"
    },
    {
      date: "2024-12-30",
      action: "Replaced",
      component: "ELEC-COMP-012",
      material: "Lead",
      quantity: "8.7 kg",
      user: "3rd Engineer"
    }
  ];

  // Define the 2 IHM report types for the Reports module
  const reports: IhmReport[] = [
    {
      id: "ihm-inventory-status",
      name: "IHM Inventory Status Report",
      description: "Comprehensive inventory of hazardous materials onboard with quantities, locations, and safety compliance status",
      purpose: "Track hazardous materials inventory & regulatory compliance (Captain/Chief Eng)",
      frequency: "Monthly",
      fields: ["Material Name", "Hazard Class", "Quantity", "Location", "Container Type", "SDS Available", "Compliance Status", "Last Updated"],
      filters: ["Vessel", "Material Type", "Hazard Class", "Location", "Compliance Status"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Recycle,
      priority: "high",
      lastGenerated: "2 days ago",
      estimatedTime: "3-4 min",
      reportType: "inventory"
    },
    {
      id: "ihm-compliance-audit",
      name: "IHM Compliance & Audit Report",
      description: "Detailed compliance audit report covering IHM management procedures, documentation, and regulatory requirements",
      purpose: "IHM compliance verification & audit preparation (Captain/Environmental Officer)",
      frequency: "Quarterly",
      fields: ["Compliance Area", "Requirement", "Status", "Evidence", "Non-Conformities", "Corrective Actions", "Deadline", "Risk Assessment"],
      filters: ["Vessel", "Compliance Area", "Status", "Risk Level", "Due Actions"],
      outputs: ["PDF", "Excel"],
      icon: Shield,
      priority: "high",
      lastGenerated: "1 week ago",
      estimatedTime: "4-5 min",
      reportType: "compliance"
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFrequency = selectedFrequency === "all" || 
                           report.frequency.toLowerCase().includes(selectedFrequency.toLowerCase());
    
    const matchesType = selectedType === "all" || report.reportType === selectedType;
    
    return matchesSearch && matchesFrequency && matchesType;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'inventory': return 'bg-green-100 text-green-800';
      case 'compliance': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeStats = () => {
    const inventory = reports.filter(r => r.reportType === 'inventory').length;
    const compliance = reports.filter(r => r.reportType === 'compliance').length;
    const highPriority = reports.filter(r => r.priority === 'high').length;
    
    return { inventory, compliance, highPriority };
  };

  const stats = getTypeStats();

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

      // Get current filters - use first available vessel
      const vesselName = vessels[0]?.name || "Unknown Vessel";
      const vesselCode = vesselName.replace(/\s+/g, '_');
      const filters = {
        vessel: vesselName,
        frequency: selectedFrequency !== "all" ? selectedFrequency : undefined,
        type: selectedType !== "all" ? selectedType : undefined,
        search: searchQuery || undefined,
      };

      // Use the maintenance report generator - will create specific IHM generator later
      const blob = await reportGenerator.generateMaintenanceReport(reportId, format, filters);
      const report = reports.find(r => r.id === reportId);
      const filename = reportGenerator.generateFilename(
        report?.name || 'ihm-report', 
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

  const handleLegacyExport = () => {
    // Maintain compatibility with existing export functionality
    toast({
      title: "Exporting IHM Dashboard",
      description: "Generating comprehensive IHM dashboard export...",
    });
    
    // Generate a comprehensive IHM dashboard report
    handleGenerateReport('ihm-dashboard-legacy', 'PDF');
  };

  if (!FEATURES.IHM) {
    return (
      <div className="p-6 bg-[#fafafa] h-full">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">IHM Reports Not Available</h2>
          <p className="text-gray-500">IHM feature is currently disabled. Contact your administrator to enable this feature.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#fafafa] min-h-screen">
      {/* Header with Back Button - New Reports Module Style */}
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
              <div className="p-2 rounded-lg bg-emerald-500 text-white">
                <Recycle className="h-5 w-5" />
              </div>
              IHM (Inventory of Hazardous Materials)
            </h1>
            <p className="text-gray-600">2 specialized reports for hazardous materials inventory management and regulatory compliance</p>
          </div>
        </div>

        {/* Search and Filters - New Reports Module Style */}
        <div className="flex gap-4 items-center mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search IHM reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-ihm-reports"
            />
          </div>
          
          <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
            <SelectTrigger className="w-48" data-testid="select-frequency-filter">
              <SelectValue placeholder="Filter by frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-48" data-testid="select-type-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Legacy Export Button - Maintain Existing Functionality */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Last Updated: {summary.lastUpdated}
            </Button>
            <Button 
              onClick={handleLegacyExport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
              data-testid="button-export-ihm-dashboard"
            >
              <Download className="h-4 w-4" />
              Export IHM Dashboard
            </Button>
          </div>
        </div>

        {/* Legacy Report Type Selection - Maintain Existing Functionality */}
        <div className="flex gap-4 items-center">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[200px]" data-testid="select-report-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">IHM Summary</SelectItem>
              <SelectItem value="materials">Materials Breakdown</SelectItem>
              <SelectItem value="changes">Recent Changes</SelectItem>
              <SelectItem value="compliance">Compliance Status</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
              <SelectItem value="last30days">Last 30 Days</SelectItem>
              <SelectItem value="last90days">Last 90 Days</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* New Reports Module Style - Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-800" data-testid="text-ihm-total-reports">2</p>
              </div>
              <Recycle className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-ihm-high-priority">{stats.highPriority}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inventory Reports</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-ihm-inventory-count">{stats.inventory}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Compliance Reports</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-ihm-compliance-count">{stats.compliance}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Reports Module Style - Report Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow" data-testid={`ihm-report-card-${report.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge className={getPriorityColor(report.priority)} variant="secondary">
                          {report.priority.toUpperCase()}
                        </Badge>
                        <Badge className={getTypeColor(report.reportType)} variant="secondary">
                          {report.reportType.toUpperCase()}
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
                        <Badge key={index} className="text-xs bg-emerald-100 text-emerald-700">
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
        <div className="text-center py-8 mb-6">
          <Recycle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}

      {/* Legacy IHM Dashboard - Maintain Existing Functionality */}

      {/* Legacy IHM Summary Cards - Maintain Existing Dashboard */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-600" />
          IHM Component Status Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="p-4 bg-white" data-testid="card-total-components">
            <div className="flex items-center justify-between mb-2">
              <Package className="h-5 w-5 text-blue-500" />
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalComponents}</div>
            <div className="text-xs text-gray-600">Components</div>
          </Card>

          <Card className="p-4 bg-white" data-testid="card-known-status">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-xs text-gray-500">Known</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{summary.knownStatus}</div>
            <div className="text-xs text-gray-600">Status Known</div>
          </Card>

          <Card className="p-4 bg-white" data-testid="card-unknown-status">
            <div className="flex items-center justify-between mb-2">
              <HelpCircle className="h-5 w-5 text-gray-400" />
              <span className="text-xs text-gray-500">Unknown</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{summary.unknownStatus}</div>
            <div className="text-xs text-gray-600">Status Unknown</div>
          </Card>

          <Card className="p-4 bg-white" data-testid="card-with-ihm">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-xs text-gray-500">With IHM</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{summary.withIHM}</div>
            <div className="text-xs text-gray-600">Contains HazMat</div>
          </Card>

          <Card className="p-4 bg-white" data-testid="card-without-ihm">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-xs text-gray-500">Without IHM</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{summary.withoutIHM}</div>
            <div className="text-xs text-gray-600">No HazMat</div>
          </Card>
        </div>
      </div>

      {/* Legacy Materials Breakdown - Maintain Existing Functionality */}
      <Card className="p-6 bg-white mb-6" data-testid="card-materials-breakdown">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          Hazardous Materials Distribution
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Material</th>
                <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Components</th>
                <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Total Weight</th>
                <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Percentage</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((mat, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-3 text-sm text-gray-900">{mat.material}</td>
                  <td className="py-3 px-3 text-sm text-center text-gray-700">{mat.count}</td>
                  <td className="py-3 px-3 text-sm text-center text-gray-700">{mat.totalWeight}</td>
                  <td className="py-3 px-3 text-sm text-center text-gray-700">{mat.percentage}%</td>
                  <td className="py-3 px-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-emerald-600 h-2 rounded-full"
                        style={{ width: `${mat.percentage}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legacy Recent Changes - Maintain Existing Functionality */}
      <Card className="p-6 bg-white mb-6" data-testid="card-recent-changes">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-emerald-600" />
          Recent IHM Changes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Date</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Action</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Component</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Material</th>
                <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Quantity</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Performed By</th>
              </tr>
            </thead>
            <tbody>
              {recentChanges.map((change, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-3 text-sm text-gray-700">{change.date}</td>
                  <td className="py-3 px-3">
                    <span className={`text-sm px-2 py-1 rounded-full ${
                      change.action === 'Removed' ? 'bg-red-100 text-red-700' :
                      change.action === 'Installed' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {change.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-900">{change.component}</td>
                  <td className="py-3 px-3 text-sm text-gray-700">{change.material}</td>
                  <td className="py-3 px-3 text-sm text-center text-gray-700">{change.quantity}</td>
                  <td className="py-3 px-3 text-sm text-gray-700">{change.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* IHM Integration Notice */}
      <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-emerald-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-emerald-900">IHM Reports Integration</h4>
            <p className="text-sm text-emerald-800 mt-1">
              These reports maintain compatibility with existing IHM functionality while providing enhanced reporting capabilities. 
              All existing IHM data and workflows are preserved and integrated into this new reporting interface.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IhmReports;