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
  Store,
  Droplets,
  Beaker,
  AlertTriangle,
  BarChart3,
  Eye,
  Loader2
} from "lucide-react";
import { pdfReportGenerator, formatDate } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";

interface StoresReport {
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
  category: 'stores' | 'lubes' | 'chemicals';
}

interface StoresReportsProps {
  onBack: () => void;
}

const StoresReports: React.FC<StoresReportsProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId } = useVessel();

  const { data: storesItems = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/stores', vesselId],
    enabled: !!vesselId && vesselId !== 'all',
  });

  const reports: StoresReport[] = [
    {
      id: "stores-inventory-status",
      name: "Stores Inventory Status Report",
      description: "Comprehensive overview of all store items with stock levels, consumption trends, and reorder requirements",
      purpose: "Monitor stock levels & plan procurement (Chief Steward/Office)",
      frequency: "Weekly",
      fields: ["Item Code/Name", "Category", "Current Stock", "Min Level", "Status"],
      outputs: ["PDF", "Excel"],
      icon: Store,
      priority: "high",
      estimatedTime: "2-3 min",
      category: "stores"
    },
    {
      id: "lubes-oil-analysis",
      name: "Lubricants & Oil Analysis Report",
      description: "Detailed analysis of lubricant consumption, oil testing results, and machinery lubrication schedules",
      purpose: "Track oil quality & optimize lubrication (Chief Eng/Office)",
      frequency: "Monthly",
      fields: ["Lube Type", "Grade", "ROB", "Consumption Rate", "Status"],
      outputs: ["PDF", "Excel"],
      icon: Droplets,
      priority: "high",
      estimatedTime: "3-4 min",
      category: "lubes"
    },
    {
      id: "chemicals-tracking",
      name: "Chemicals Inventory & Expiry Report",
      description: "Track chemical inventory, expiry dates, and safety data sheet compliance",
      purpose: "Safety compliance & inventory freshness (All departments)",
      frequency: "Monthly",
      fields: ["Chemical Name", "ROB", "Expiry Date", "MSDS Status", "Hazard Class"],
      outputs: ["PDF", "Excel"],
      icon: Beaker,
      priority: "high",
      estimatedTime: "2-3 min",
      category: "chemicals"
    },
    {
      id: "stores-low-stock",
      name: "Low Stock Alert Report",
      description: "Items below minimum levels requiring immediate attention",
      purpose: "Prevent stockouts (All stakeholders)",
      frequency: "Daily/Weekly",
      fields: ["Item", "Category", "ROB", "Min", "Shortage", "Status"],
      outputs: ["PDF", "Excel"],
      icon: AlertTriangle,
      priority: "high",
      estimatedTime: "< 1 min",
      category: "stores"
    },
    {
      id: "stores-consumption-analysis",
      name: "Consumption Pattern Analysis",
      description: "Historical consumption trends and forecasting",
      purpose: "Optimize stock levels & ordering frequency",
      frequency: "Monthly",
      fields: ["Item", "Monthly Consumption", "Trend", "Forecast"],
      outputs: ["PDF", "Excel"],
      icon: BarChart3,
      priority: "medium",
      estimatedTime: "3-5 min",
      category: "stores"
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || report.category === selectedCategory;
    return matchesSearch && matchesCategory;
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

  const generateStoresPDF = async (reportId: string) => {
    const vesselName = vessels.find(v => v.id === vesselId)?.name || vesselId || 'All Vessels';

    switch (reportId) {
      case 'stores-inventory-status': {
        const columns = [
          { header: 'Item Code', field: 'itemCode', width: 30 },
          { header: 'Item Name', field: 'itemName', width: 55 },
          { header: 'Category', field: 'category', width: 30 },
          { header: 'ROB', field: 'rob', width: 20 },
          { header: 'Min', field: 'min', width: 20 },
          { header: 'Location', field: 'location', width: 30 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const data = storesItems.map((s: any) => ({
          itemCode: s.itemCode || '-',
          itemName: s.itemName || '-',
          category: s.category || s.itemType || '-',
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
          { title: 'Stores Inventory Status', subtitle: 'Complete inventory listing', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'lubes-oil-analysis': {
        const lubesItems = storesItems.filter((s: any) => s.itemType === 'lubes');

        const columns = [
          { header: 'Item Code', field: 'itemCode', width: 30 },
          { header: 'Item Name', field: 'itemName', width: 60 },
          { header: 'ROB', field: 'rob', width: 25 },
          { header: 'Min', field: 'min', width: 25 },
          { header: 'UOM', field: 'uom', width: 25 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = lubesItems.map((s: any) => ({
          itemCode: s.itemCode || '-',
          itemName: s.itemName || '-',
          rob: s.rob || 0,
          min: s.min || 0,
          uom: s.uom || 'L',
          status: getStockStatus(s.rob || 0, s.min || 0)
        }));

        const summary = [
          { label: 'Total Lubes', value: data.length },
          { label: 'Low Stock', value: data.filter((d: any) => d.status === 'Low').length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Lubricants & Oil Analysis', subtitle: 'Stock levels and status', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'chemicals-tracking': {
        const chemicalsItems = storesItems.filter((s: any) => s.itemType === 'chemicals');

        const columns = [
          { header: 'Item Code', field: 'itemCode', width: 30 },
          { header: 'Item Name', field: 'itemName', width: 60 },
          { header: 'ROB', field: 'rob', width: 25 },
          { header: 'Min', field: 'min', width: 25 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = chemicalsItems.map((s: any) => ({
          itemCode: s.itemCode || '-',
          itemName: s.itemName || '-',
          rob: s.rob || 0,
          min: s.min || 0,
          status: getStockStatus(s.rob || 0, s.min || 0)
        }));

        const summary = [
          { label: 'Total Chemicals', value: data.length },
          { label: 'Low Stock', value: data.filter((d: any) => d.status === 'Low').length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Chemicals Inventory & Expiry', subtitle: 'Chemical stock tracking', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'stores-low-stock': {
        const lowStockItems = storesItems.filter((s: any) => (s.rob || 0) <= (s.min || 0));

        const columns = [
          { header: 'Item Code', field: 'itemCode', width: 30 },
          { header: 'Item Name', field: 'itemName', width: 55 },
          { header: 'Category', field: 'category', width: 30 },
          { header: 'ROB', field: 'rob', width: 20 },
          { header: 'Min', field: 'min', width: 20 },
          { header: 'Shortage', field: 'shortage', width: 25 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const data = lowStockItems.map((s: any) => ({
          itemCode: s.itemCode || '-',
          itemName: s.itemName || '-',
          category: s.category || s.itemType || '-',
          rob: s.rob || 0,
          min: s.min || 0,
          shortage: Math.max(0, (s.min || 0) - (s.rob || 0)),
          status: getStockStatus(s.rob || 0, s.min || 0)
        }));

        const summary = [
          { label: 'Low Stock Items', value: data.length },
          { label: 'Critical', value: data.filter((d: any) => d.shortage > 5).length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Low Stock Alert Report', subtitle: 'Items requiring reorder', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'stores-consumption-analysis': {
        const columns = [
          { header: 'Item Code', field: 'itemCode', width: 30 },
          { header: 'Item Name', field: 'itemName', width: 60 },
          { header: 'Category', field: 'category', width: 30 },
          { header: 'ROB', field: 'rob', width: 25 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = storesItems.map((s: any) => ({
          itemCode: s.itemCode || '-',
          itemName: s.itemName || '-',
          category: s.category || s.itemType || '-',
          rob: s.rob || 0,
          status: getStockStatus(s.rob || 0, s.min || 0)
        }));

        pdfReportGenerator.generateReport(
          { title: 'Consumption Pattern Analysis', subtitle: 'Historical consumption trends', vessel: vesselName },
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

    if (storesItems.length === 0) {
      toast({ title: "No Data Available", description: "No stores inventory data found for the selected vessel.", variant: "destructive" });
      return;
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateStoresPDF(reportId);
        toast({ title: "Report Generated", description: `${format} report downloaded successfully!` });
      } else {
        toast({ title: "Excel Export", description: "Excel export coming soon. PDF is currently available." });
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

  const lubesCount = storesItems.filter((s: any) => s.itemType === 'lubes').length;
  const chemicalsCount = storesItems.filter((s: any) => s.itemType === 'chemicals').length;
  const lowStockCount = storesItems.filter((s: any) => (s.rob || 0) < (s.min || 0)).length;

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
              <div className="p-2 rounded-lg bg-purple-500 text-white">
                <Store className="h-5 w-5" />
              </div>
              Inventory - Stores/Lubes/Chemicals
            </h1>
            <p className="text-gray-600">5 reports for stores inventory management</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search stores reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-800">{storesItems.length}</p>
              </div>
              <Store className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Lubricants</p>
                <p className="text-2xl font-bold text-blue-600">{lubesCount}</p>
              </div>
              <Droplets className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Chemicals</p>
                <p className="text-2xl font-bold text-green-600">{chemicalsCount}</p>
              </div>
              <Beaker className="h-8 w-8 text-green-500" />
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
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
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
                    <Button 
                      size="sm" 
                      onClick={() => handleGenerateReport(report.id, 'Excel')}
                      className="bg-green-600 hover:bg-green-700 text-white px-3"
                      disabled={generatingReports.has(`${report.id}-Excel`)}
                    >
                      {generatingReports.has(`${report.id}-Excel`) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excel'}
                    </Button>
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

export default StoresReports;
