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
  Package,
  AlertTriangle,
  TrendingDown,
  ShoppingCart,
  BarChart3,
  FileText,
  Clock,
  Eye,
  Loader2
} from "lucide-react";
import { pdfReportGenerator, formatDate } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";

interface SparesReport {
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

interface SparesReportsProps {
  onBack: () => void;
}

const SparesReports: React.FC<SparesReportsProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId } = useVessel();

  const { data: spares = [] } = useQuery<any[]>({
    queryKey: ['/api/spares', vesselId],
    enabled: !!vesselId && vesselId !== 'all',
  });

  const { data: spareHistory = [] } = useQuery<any[]>({
    queryKey: ['/api/spares', vesselId, 'history'],
    enabled: !!vesselId && vesselId !== 'all',
  });

  const reports: SparesReport[] = [
    {
      id: "spares-low-stock",
      name: "Low Stock Alert Report",
      description: "Critical and low stock items requiring immediate attention and ordering",
      purpose: "Prevent stockouts & maintain availability (Chief Eng/Office)",
      frequency: "Daily/Weekly",
      fields: ["Part Code/Name", "Current ROB", "Minimum Level", "Days Below Min", "Last Consumption", "Lead Time", "Supplier"],
      filters: ["Vessel", "Dept", "Stock Status", "Criticality", "Supplier"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: AlertTriangle,
      priority: "high",
      lastGenerated: "1 hour ago",
      estimatedTime: "< 1 min"
    },
    {
      id: "spares-consumption-analysis",
      name: "Consumption Pattern Analysis",
      description: "Historical consumption trends and forecasting for inventory optimization",
      purpose: "Optimize inventory levels & ordering (Office)",
      frequency: "Monthly",
      fields: ["Part", "Avg Monthly Consumption", "Trend", "Seasonal Patterns", "Usage Variance", "Forecast Next 3M"],
      filters: ["Vessel", "Dept", "Time Period", "Part Category", "High Movers"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: TrendingDown,
      priority: "medium",
      lastGenerated: "2 days ago",
      estimatedTime: "3-5 min"
    },
    {
      id: "spares-procurement-status",
      name: "Procurement & Delivery Status",
      description: "Outstanding orders, deliveries, and supplier performance tracking",
      purpose: "Track orders & supplier performance (Office/Procurement)",
      frequency: "Weekly",
      fields: ["Order No", "Part", "Supplier", "Order Date", "Expected Delivery", "Status", "Delay Days", "Critical Flag"],
      filters: ["Vessel", "Supplier", "Order Status", "Overdue Only", "Date Range"],
      outputs: ["PDF", "Excel"],
      icon: ShoppingCart,
      priority: "high",
      lastGenerated: "3 hours ago",
      estimatedTime: "1-2 min"
    },
    {
      id: "spares-cost-analysis",
      name: "Inventory Cost Analysis",
      description: "Cost tracking, budget analysis, and spend optimization by category and supplier",
      purpose: "Cost control & budget management (Office/Finance)",
      frequency: "Monthly",
      fields: ["Category", "Total Value", "Monthly Spend", "Budget vs Actual", "Cost/Unit Trends", "Top Cost Items"],
      filters: ["Vessel", "Cost Category", "Date Range", "Budget Threshold"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: BarChart3,
      priority: "medium",
      lastGenerated: "1 week ago",
      estimatedTime: "2-4 min"
    },
    {
      id: "spares-turnover-analysis",
      name: "Inventory Turnover Analysis",
      description: "Stock turnover rates, slow-moving items, and obsolescence identification",
      purpose: "Optimize stock levels & reduce obsolescence (Office)",
      frequency: "Quarterly",
      fields: ["Part", "Turnover Rate", "Days in Stock", "Last Movement", "Obsolescence Risk", "Action Required"],
      filters: ["Vessel", "Turnover Threshold", "Days Stationary", "Risk Level"],
      outputs: ["PDF", "Excel"],
      icon: Clock,
      priority: "low",
      lastGenerated: "2 weeks ago",
      estimatedTime: "3-5 min"
    },
    {
      id: "spares-inventory-snapshot",
      name: "Current Inventory Snapshot",
      description: "Complete inventory listing with stock levels and locations",
      purpose: "Stock visibility & audit (All stakeholders)",
      frequency: "Weekly",
      fields: ["Part Code", "Part Name", "Component", "ROB", "Min", "Max", "Location", "Status"],
      filters: ["Vessel", "Component", "Stock Status", "Location"],
      outputs: ["PDF", "Excel"],
      icon: Package,
      priority: "medium",
      lastGenerated: "1 day ago",
      estimatedTime: "1-2 min"
    },
    {
      id: "spares-critical-parts",
      name: "Critical Spares Report",
      description: "Status of critical and essential spare parts inventory",
      purpose: "Ensure critical equipment supportability (Office/Vessel)",
      frequency: "Weekly",
      fields: ["Part Code", "Part Name", "Equipment", "Criticality", "ROB", "Min Required", "Status"],
      filters: ["Vessel", "Criticality Level", "Stock Status"],
      outputs: ["PDF", "Dashboard"],
      icon: AlertTriangle,
      priority: "high",
      lastGenerated: "4 hours ago",
      estimatedTime: "< 1 min"
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase());
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

  const getStockStatus = (rob: number, min: number): string => {
    if (rob < min) return 'Low';
    if (rob === min) return 'At Min';
    return 'OK';
  };

  const generateSparesPDF = async (reportId: string) => {
    const vesselName = vessels.find(v => v.id === vesselId)?.name || vesselId || 'All Vessels';

    switch (reportId) {
      case 'spares-low-stock': {
        const lowStockItems = spares.filter((s: any) => (s.rob || 0) <= (s.min || 0));

        const columns = [
          { header: 'Part Code', field: 'partCode', width: 35 },
          { header: 'Part Name', field: 'partName', width: 55 },
          { header: 'Component', field: 'componentName', width: 45 },
          { header: 'ROB', field: 'rob', width: 20 },
          { header: 'Min', field: 'min', width: 20 },
          { header: 'Shortage', field: 'shortage', width: 25 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const data = lowStockItems.map((s: any) => ({
          partCode: s.partCode || '-',
          partName: s.partName || '-',
          componentName: s.componentName || '-',
          rob: s.rob || 0,
          min: s.min || 0,
          shortage: Math.max(0, (s.min || 0) - (s.rob || 0)),
          status: getStockStatus(s.rob || 0, s.min || 0)
        }));

        const summary = [
          { label: 'Low Stock Items', value: data.length },
          { label: 'Critical', value: data.filter((d: any) => d.status === 'Low').length },
          { label: 'At Minimum', value: data.filter((d: any) => d.status === 'At Min').length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Low Stock Alert Report', subtitle: 'Items requiring immediate attention', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'spares-inventory-snapshot': {
        const columns = [
          { header: 'Part Code', field: 'partCode', width: 30 },
          { header: 'Part Name', field: 'partName', width: 50 },
          { header: 'Component', field: 'componentName', width: 40 },
          { header: 'ROB', field: 'rob', width: 20 },
          { header: 'Min', field: 'min', width: 20 },
          { header: 'Location', field: 'location', width: 30 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const data = spares.map((s: any) => ({
          partCode: s.partCode || '-',
          partName: s.partName || '-',
          componentName: s.componentName || '-',
          rob: s.rob || 0,
          min: s.min || 0,
          location: s.location || '-',
          status: getStockStatus(s.rob || 0, s.min || 0)
        }));

        const summary = [
          { label: 'Total Items', value: data.length },
          { label: 'Low Stock', value: data.filter((d: any) => d.status === 'Low').length },
          { label: 'OK', value: data.filter((d: any) => d.status === 'OK').length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Inventory Snapshot', subtitle: 'Complete spares inventory listing', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'spares-critical-parts': {
        const criticalParts = spares.filter((s: any) => 
          s.critical === 'Critical' || s.critical === 'Yes' || s.criticality === 'Critical'
        );

        const columns = [
          { header: 'Part Code', field: 'partCode', width: 35 },
          { header: 'Part Name', field: 'partName', width: 55 },
          { header: 'Component', field: 'componentName', width: 45 },
          { header: 'ROB', field: 'rob', width: 20 },
          { header: 'Min', field: 'min', width: 20 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const data = criticalParts.map((s: any) => ({
          partCode: s.partCode || '-',
          partName: s.partName || '-',
          componentName: s.componentName || '-',
          rob: s.rob || 0,
          min: s.min || 0,
          status: getStockStatus(s.rob || 0, s.min || 0)
        }));

        const summary = [
          { label: 'Critical Parts', value: data.length },
          { label: 'Low Stock', value: data.filter((d: any) => d.status === 'Low').length },
          { label: 'OK', value: data.filter((d: any) => d.status === 'OK').length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Critical Spares Report', subtitle: 'Status of critical spare parts', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'spares-consumption-analysis': {
        const consumptionData = spareHistory
          .filter((h: any) => h.eventType === 'CONSUME')
          .reduce((acc: Record<string, any>, h: any) => {
            const key = h.partCode || h.spareId;
            if (!acc[key]) {
              acc[key] = { 
                partCode: h.partCode, 
                partName: h.partName, 
                totalConsumed: 0, 
                transactions: 0 
              };
            }
            acc[key].totalConsumed += Math.abs(h.qtyChange || 0);
            acc[key].transactions++;
            return acc;
          }, {});

        const columns = [
          { header: 'Part Code', field: 'partCode', width: 35 },
          { header: 'Part Name', field: 'partName', width: 60 },
          { header: 'Total Consumed', field: 'totalConsumed', width: 35 },
          { header: 'Transactions', field: 'transactions', width: 30 },
          { header: 'Avg Per Transaction', field: 'avgPerTransaction', width: 40 }
        ];

        const data = Object.values(consumptionData).map((item: any) => ({
          ...item,
          avgPerTransaction: item.transactions > 0 
            ? (item.totalConsumed / item.transactions).toFixed(1) 
            : '0'
        }));

        const summary = [
          { label: 'Parts Consumed', value: data.length },
          { label: 'Total Transactions', value: data.reduce((a: number, b: any) => a + b.transactions, 0) }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Consumption Pattern Analysis', subtitle: 'Historical consumption trends', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'spares-procurement-status':
      case 'spares-cost-analysis':
      case 'spares-turnover-analysis': {
        const columns = [
          { header: 'Part Code', field: 'partCode', width: 35 },
          { header: 'Part Name', field: 'partName', width: 60 },
          { header: 'ROB', field: 'rob', width: 25 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = spares.slice(0, 20).map((s: any) => ({
          partCode: s.partCode || '-',
          partName: s.partName || '-',
          rob: s.rob || 0,
          status: getStockStatus(s.rob || 0, s.min || 0)
        }));

        const reportTitles: Record<string, string> = {
          'spares-procurement-status': 'Procurement & Delivery Status',
          'spares-cost-analysis': 'Inventory Cost Analysis',
          'spares-turnover-analysis': 'Inventory Turnover Analysis'
        };

        pdfReportGenerator.generateReport(
          { title: reportTitles[reportId], subtitle: 'Based on current inventory data', vessel: vesselName },
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

    if (spares.length === 0) {
      toast({
        title: "No Data Available",
        description: "No spares inventory data found for the selected vessel.",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      
      toast({
        title: "Generating Report",
        description: `Creating ${format} report...`,
      });

      if (format === 'PDF') {
        await generateSparesPDF(reportId);
        toast({
          title: "Report Generated",
          description: `${format} report downloaded successfully!`,
        });
      } else {
        toast({
          title: "Excel Export",
          description: "Excel export coming soon. PDF is currently available.",
        });
      }
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Generation Failed",
        description: `Failed to generate report. Please try again.`,
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

  return (
    <div className="p-6 bg-[#fafafa] min-h-screen">
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
              <div className="p-2 rounded-lg bg-orange-500 text-white">
                <Package className="h-5 w-5" />
              </div>
              Inventory - Spares
            </h1>
            <p className="text-gray-600">7 reports for spare parts inventory management</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search spares reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
            <SelectTrigger className="w-48">
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
            <SelectTrigger className="w-48">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spares</p>
                <p className="text-2xl font-bold text-gray-800">{spares.length}</p>
              </div>
              <Package className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-red-600">
                  {spares.filter((s: any) => (s.rob || 0) < (s.min || 0)).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical Parts</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {spares.filter((s: any) => s.critical === 'Critical' || s.critical === 'Yes').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reports Available</p>
                <p className="text-2xl font-bold text-blue-600">7</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
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
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
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
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleGenerateReport(report.id, 'PDF')}
                    className="flex items-center gap-2"
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
                      >
                        {generatingReports.has(`${report.id}-Excel`) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Excel'
                        )}
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
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default SparesReports;
