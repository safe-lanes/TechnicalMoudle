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
  Store,
  Droplets,
  Beaker,
  AlertTriangle,
  BarChart3,
  Eye,
  Loader2
} from "lucide-react";
import { reportGenerator } from "@/lib/reportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";

interface StoresReport {
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
  category: 'stores' | 'lubes' | 'chemicals';
}

interface StoresReportsProps {
  onBack: () => void;
}

const StoresReports: React.FC<StoresReportsProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();

  const reports: StoresReport[] = [
    {
      id: "stores-inventory-status",
      name: "Stores Inventory Status Report",
      description: "Comprehensive overview of all store items with stock levels, consumption trends, and reorder requirements",
      purpose: "Monitor stock levels & plan procurement (Chief Steward/Office)",
      frequency: "Weekly",
      fields: ["Item Code/Name", "Category", "Current Stock", "Min Level", "Consumption Rate", "Last Received", "Expiry Dates"],
      filters: ["Vessel", "Category", "Stock Status", "Expiry Alert", "Date Range"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Store,
      priority: "high",
      lastGenerated: "2 hours ago",
      estimatedTime: "2-3 min",
      category: "stores"
    },
    {
      id: "lubes-oil-analysis",
      name: "Lubricants & Oil Analysis Report",
      description: "Detailed analysis of lubricant consumption, oil testing results, and machinery lubrication schedules",
      purpose: "Optimize lubrication & prevent machinery damage (Chief Eng)",
      frequency: "Monthly",
      fields: ["Oil Type", "Equipment", "Last Change", "Analysis Results", "Viscosity", "Contamination Level", "Next Due"],
      filters: ["Vessel", "Oil Type", "Equipment", "Test Results", "Due Soon"],
      outputs: ["PDF", "Excel"],
      icon: Droplets,
      priority: "high",
      lastGenerated: "1 week ago",
      estimatedTime: "3-5 min",
      category: "lubes"
    },
    {
      id: "chemicals-consumption",
      name: "Chemicals Consumption & Safety Report",
      description: "Tracking of chemical usage, safety data sheets compliance, and disposal requirements",
      purpose: "Safety compliance & regulatory adherence (Chief Eng/Safety)",
      frequency: "Monthly",
      fields: ["Chemical Name", "Usage Rate", "Safety Category", "MSDS Status", "Storage Conditions", "Disposal Requirements"],
      filters: ["Vessel", "Chemical Type", "Safety Level", "MSDS Expiry", "Usage Pattern"],
      outputs: ["PDF", "Excel"],
      icon: Beaker,
      priority: "high",
      lastGenerated: "3 days ago",
      estimatedTime: "2-4 min",
      category: "chemicals"
    },
    {
      id: "stores-expiry-monitoring",
      name: "Expiry & Shelf Life Monitoring",
      description: "Critical monitoring of expiry dates for food, chemicals, and medical supplies with disposal tracking",
      purpose: "Prevent waste & ensure safety compliance (Chief Steward/Safety)",
      frequency: "Daily",
      fields: ["Item", "Category", "Expiry Date", "Days Remaining", "Disposal Method", "Cost Impact", "Action Required"],
      filters: ["Vessel", "Category", "Days to Expiry", "Risk Level", "Item Type"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: AlertTriangle,
      priority: "high",
      lastGenerated: "6 hours ago",
      estimatedTime: "< 1 min",
      category: "stores"
    },
    {
      id: "stores-cost-analysis",
      name: "Stores Cost Analysis & Budget Report",
      description: "Financial analysis of stores spending, budget variance, and cost optimization opportunities",
      purpose: "Cost control & budget management (Office/Finance)",
      frequency: "Monthly",
      fields: ["Category", "Monthly Spend", "Budget vs Actual", "Cost/Unit Trends", "Supplier Analysis", "Savings Opportunities"],
      filters: ["Vessel", "Category", "Cost Threshold", "Budget Period", "Supplier"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: BarChart3,
      priority: "medium",
      lastGenerated: "2 weeks ago",
      estimatedTime: "3-4 min",
      category: "stores"
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFrequency = selectedFrequency === "all" || 
                           report.frequency.toLowerCase().includes(selectedFrequency.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || report.category === selectedCategory;
    
    return matchesSearch && matchesFrequency && matchesCategory;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'stores': return 'bg-blue-100 text-blue-800';
      case 'lubes': return 'bg-purple-100 text-purple-800';
      case 'chemicals': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryStats = () => {
    const stores = reports.filter(r => r.category === 'stores').length;
    const lubes = reports.filter(r => r.category === 'lubes').length;
    const chemicals = reports.filter(r => r.category === 'chemicals').length;
    const highPriority = reports.filter(r => r.priority === 'high').length;
    
    return { stores, lubes, chemicals, highPriority };
  };

  const stats = getCategoryStats();

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
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        search: searchQuery || undefined,
      };

      // For now, use the maintenance report generator - will create specific stores generator later
      const blob = await reportGenerator.generateMaintenanceReport(reportId, format, filters);
      const report = reports.find(r => r.id === reportId);
      const filename = reportGenerator.generateFilename(
        report?.name || 'stores-report', 
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
              <div className="p-2 rounded-lg bg-cyan-500 text-white">
                <Store className="h-5 w-5" />
              </div>
              Inventory - Stores/Lubes/Chemicals
            </h1>
            <p className="text-gray-600">5 comprehensive reports for stores, lubricants, and chemicals inventory management</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search stores/lubes/chemicals reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-stores-reports"
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

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48" data-testid="select-category-filter">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="stores">Stores</SelectItem>
              <SelectItem value="lubes">Lubricants</SelectItem>
              <SelectItem value="chemicals">Chemicals</SelectItem>
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
                <p className="text-2xl font-bold text-gray-800" data-testid="text-stores-total-reports">5</p>
              </div>
              <Store className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-stores-high-priority">{stats.highPriority}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Stores Items</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-stores-stores-count">{stats.stores}</p>
              </div>
              <Store className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Chemicals</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="text-stores-chemicals-count">{stats.chemicals}</p>
              </div>
              <Beaker className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow" data-testid={`stores-report-card-${report.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-100 text-cyan-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge className={getPriorityColor(report.priority)} variant="secondary">
                          {report.priority.toUpperCase()}
                        </Badge>
                        <Badge className={getCategoryColor(report.category)} variant="secondary">
                          {report.category.toUpperCase()}
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
                        <Badge key={index} className="text-xs bg-cyan-100 text-cyan-700">
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
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default StoresReports;