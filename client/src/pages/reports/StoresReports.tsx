import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Store,
  Droplets,
  Beaker,
  AlertTriangle,
  BarChart3,
  Eye,
  Loader2,
  FileText,
  Download,
  Calendar as CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
import { pdfReportGenerator, formatDate, formatReportDateRange } from "@/lib/pdfReportGenerator";
import ReportPreviewModal, { ReportPreviewData } from "@/components/reports/ReportPreviewModal";
import InlineReportPreview from "@/components/reports/InlineReportPreview";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";
import StoresInventoryStatusReport from "./StoresInventoryStatusReport";
import ChemicalsExpiryReport from "./ChemicalsExpiryReport";
import LowStockAlertReport from "./LowStockAlertReport";
import ConsumptionPatternReport from "./ConsumptionPatternReport";

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
  globalFilters?: {
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
  embedded?: boolean;
  selectedReportId?: string | null;
  actionTrigger?: { type: 'preview' | 'pdf' | 'excel'; ts: number } | null;
}

const StoresReports: React.FC<StoresReportsProps> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: globalFilters?.vessel || "all",
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId: contextVesselId } = useVessel();

  useEffect(() => {
    if (globalFilters?.vessel) {
      setCategoryFilters(prev => ({ ...prev, vessel: globalFilters.vessel }));
    }
  }, [globalFilters?.vessel]);

  useEffect(() => {
    if (globalFilters?.dateRange) {
      setCategoryFilters(prev => ({ ...prev, dateRange: globalFilters.dateRange }));
    }
  }, [globalFilters?.dateRange]);

  useEffect(() => {
    if (embedded && selectedReportId && !previewData && !selectedReport) {
      handlePreviewReport(selectedReportId);
    }
  }, [embedded, selectedReportId]);

  useEffect(() => {
    if (!actionTrigger || !embedded || !selectedReportId) return;
    if (actionTrigger.type === 'preview') {
      handlePreviewReport(selectedReportId);
    } else if (actionTrigger.type === 'pdf') {
      handleGenerateReport(selectedReportId, 'PDF');
    } else if (actionTrigger.type === 'excel') {
      handleGenerateReport(selectedReportId, 'Excel');
    }
  }, [actionTrigger]);

  const effectiveVesselId = categoryFilters.vessel === 'all' 
    ? 'all' 
    : (categoryFilters.vessel || contextVesselId);

  const { data: storesItems = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/stores', effectiveVesselId],
    queryFn: async () => {
      if (effectiveVesselId && effectiveVesselId !== 'all') {
        const res = await fetch(`/technical/api/stores/${effectiveVesselId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch stores');
        return res.json();
      }
      const res = await fetch('/technical/api/stores', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stores');
      return res.json();
    },
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
      id: "low-stock-alert",
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
    if (embedded && selectedReportId) return report.id === selectedReportId;
    const matchesSearch = report.name.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStockStatus = (rob: number, min: number): string => {
    if (rob === 0) return 'Critical';
    if (rob <= min) return 'Low';
    return 'OK';
  };

  const generateStoresReport = async (reportId: string, mode: 'preview' | 'download' = 'download') => {
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');

    switch (reportId) {
      case 'stores-inventory-status': {
        const columns = [
          { header: 'Item Code', field: 'itemCode', width: 30 },
          { header: 'Item Name', field: 'itemName', width: 55 },
          { header: 'Category', field: 'category', width: 30 },
          { header: 'ROB', field: 'rob', width: 20 },
          { header: 'Min', field: 'min', width: 20 },
          { header: 'Location A', field: 'locationA', width: 25 },
          { header: 'Location B', field: 'locationB', width: 25 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const data = storesItems.map((s: any) => {
          const rob = parseFloat(String(s.rob)) || 0;
          const min = parseFloat(String(s.min)) || 0;
          return {
            itemCode: s.itemCode || '-',
            itemName: s.itemName || '-',
            category: s.category || s.itemType || '-',
            rob,
            min,
            locationA: s.locationA || '-',
            locationB: s.locationB || '-',
            status: getStockStatus(rob, min)
          };
        });

        const summary = [
          { label: 'Total Items', value: data.length },
          { label: 'Low Stock', value: data.filter((d: any) => d.status === 'Low').length },
          { label: 'OK', value: data.filter((d: any) => d.status === 'OK').length }
        ];

        if (mode === 'preview') {
          setPreviewData({ title: 'Stores Inventory Status', subtitle: 'Complete inventory listing', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary });
          return;
        }
        pdfReportGenerator.generateReport(
          { title: 'Stores Inventory Status', subtitle: 'Complete inventory listing', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
          columns, data, summary
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

        const data = lubesItems.map((s: any) => {
          const rob = parseFloat(String(s.rob)) || 0;
          const min = parseFloat(String(s.min)) || 0;
          return {
            itemCode: s.itemCode || '-',
            itemName: s.itemName || '-',
            rob,
            min,
            uom: s.uom || 'L',
            status: getStockStatus(rob, min)
          };
        });

        const summary = [
          { label: 'Total Lubes', value: data.length },
          { label: 'Low Stock', value: data.filter((d: any) => d.status === 'Low').length }
        ];

        if (mode === 'preview') {
          setPreviewData({ title: 'Lubricants & Oil Analysis', subtitle: 'Stock levels and status', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary });
          return;
        }
        pdfReportGenerator.generateReport(
          { title: 'Lubricants & Oil Analysis', subtitle: 'Stock levels and status', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
          columns, data, summary
        );
        break;
      }

      case 'chemicals-tracking': {
        const chemicalsItems = storesItems.filter((s: any) => s.itemType === 'chemicals');

        const columns = [
          { header: 'Item Code', field: 'itemCode', width: 25 },
          { header: 'Item Name', field: 'itemName', width: 45 },
          { header: 'Batch #', field: 'batchNumber', width: 25 },
          { header: 'Expiry Date', field: 'expiryDate', width: 25 },
          { header: 'Hazard', field: 'hazardClassification', width: 25 },
          { header: 'SDS Ref', field: 'sdsReference', width: 25 },
          { header: 'ROB', field: 'rob', width: 20 },
          { header: 'Min', field: 'min', width: 20 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const today = new Date();
        const data = chemicalsItems.map((s: any) => {
          const rob = parseFloat(String(s.rob)) || 0;
          const min = parseFloat(String(s.min)) || 0;
          const expiryDate = s.expiryDate || '-';
          let expiryStatus = '-';
          if (s.expiryDate) {
            const d = new Date(s.expiryDate);
            const days = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            expiryStatus = days < 0 ? 'EXPIRED' : days <= 30 ? `${days}d` : days <= 90 ? `${days}d` : 'OK';
          }
          return {
            itemCode: s.itemCode || '-',
            itemName: s.itemName || '-',
            batchNumber: s.batchNumber || '-',
            expiryDate: expiryDate !== '-' ? `${expiryDate} (${expiryStatus})` : '-',
            hazardClassification: s.hazardClassification || 'None',
            sdsReference: s.sdsReference || '-',
            rob,
            min,
            status: getStockStatus(rob, min)
          };
        });

        const expiredCount = chemicalsItems.filter((s: any) => {
          if (!s.expiryDate) return false;
          return new Date(s.expiryDate) < today;
        }).length;
        const withSds = chemicalsItems.filter((s: any) => s.sdsReference && s.sdsReference.trim()).length;

        const summary = [
          { label: 'Total Chemicals', value: data.length },
          { label: 'Expired', value: expiredCount },
          { label: 'Low Stock', value: data.filter((d: any) => d.status === 'Low').length },
          { label: 'SDS Compliance', value: data.length > 0 ? `${Math.round((withSds / data.length) * 100)}%` : '0%' }
        ];

        if (mode === 'preview') {
          setPreviewData({ title: 'Chemicals Inventory & Expiry', subtitle: 'Chemical stock tracking with expiry & SDS compliance', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary });
          return;
        }
        pdfReportGenerator.generateReport(
          { title: 'Chemicals Inventory & Expiry', subtitle: 'Chemical stock tracking with expiry & SDS compliance', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
          columns, data, summary
        );
        break;
      }

      case 'low-stock-alert': {
        const reportRes = await fetch(`/technical/api/reports/stores-low-stock-alert/${effectiveVesselId}`, {
          credentials: 'include',
        });
        if (!reportRes.ok) throw new Error('Failed to fetch low stock alert data');
        const reportData = await reportRes.json();
        const items = reportData.items || [];
        const reportSummary = reportData.summary || {};

        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Priority', field: 'priority', width: 18 },
          { header: 'Item Code', field: 'itemCode', width: 22 },
          { header: 'Item Name', field: 'itemName', width: 40 },
          { header: 'Type', field: 'itemType', width: 20 },
          { header: 'Category', field: 'category', width: 22 },
          { header: 'ROB', field: 'rob', width: 15 },
          { header: 'Min Stock', field: 'minStock', width: 15 },
          { header: 'Deficit', field: 'deficit', width: 15 },
          { header: 'UOM', field: 'uom', width: 15 },
          { header: 'Avg Monthly', field: 'avgMonthly', width: 20 },
          { header: 'Days to Stockout', field: 'daysToStockout', width: 22 },
          { header: 'Est. Cost', field: 'estCost', width: 20 },
        ];

        const data = items.map((item: any, idx: number) => ({
          sno: idx + 1,
          priority: item.priority || '-',
          itemCode: item.itemCode || '-',
          itemName: item.itemName || '-',
          itemType: item.itemType || '-',
          category: item.category || '-',
          rob: item.rob,
          minStock: item.minStock,
          deficit: item.deficit,
          uom: item.uom || '-',
          avgMonthly: item.avgMonthlyConsumption,
          daysToStockout: item.daysUntilStockout ?? 'N/A',
          estCost: item.estimatedCost !== null ? `$${item.estimatedCost}` : 'N/A',
        }));

        const summary = [
          { label: 'Total Low Stock', value: reportSummary.totalLowStock || data.length },
          { label: 'Critical', value: reportSummary.criticalItems || 0 },
          { label: 'High Priority', value: reportSummary.highPriorityItems || 0 },
          { label: 'Medium Priority', value: reportSummary.mediumPriorityItems || 0 },
          { label: 'Est. Total Cost', value: reportSummary.estimatedTotalCost ? `$${reportSummary.estimatedTotalCost}` : '$0' },
        ];

        if (mode === 'preview') {
          setPreviewData({ title: 'Low Stock Alert Report', subtitle: 'Items requiring reorder', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary });
          return;
        }
        pdfReportGenerator.generateReport(
          { title: 'Low Stock Alert Report', subtitle: 'Items requiring reorder', vessel: vesselName, orientation: 'landscape', dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
          columns, data, summary
        );
        break;
      }

      case 'stores-consumption-analysis': {
        const apiRes = await fetch(`/technical/api/reports/stores-consumption-analysis/${effectiveVesselId}`, { credentials: 'include' });
        if (!apiRes.ok) throw new Error('Failed to fetch consumption analysis data');
        const freshData = await apiRes.json();

        if (mode === 'preview') {
          const topItems = freshData.topConsumedItems || [];
          const columns = [
            { header: 'S.No', field: 'sno', width: 12 },
            { header: 'Item Code', field: 'itemCode', width: 25 },
            { header: 'Item Name', field: 'itemName', width: 45 },
            { header: 'Category', field: 'category', width: 25 },
            { header: 'Total Consumed', field: 'totalConsumed', width: 25 },
            { header: 'Events', field: 'events', width: 15 },
            { header: 'Current ROB', field: 'rob', width: 20 },
          ];
          const data = topItems.map((i: any, idx: number) => ({
            sno: idx + 1,
            itemCode: i.itemCode || '-',
            itemName: i.itemName || '-',
            category: i.category || '-',
            totalConsumed: i.totalConsumed || 0,
            events: i.consumptionEvents || i.events || 0,
            rob: i.currentRob || i.rob || 0,
          }));
          const summaryInfo = freshData.summary || {};
          const summary = [
            { label: 'Total Items Analyzed', value: summaryInfo.totalItems || data.length },
            { label: 'Total Consumption', value: summaryInfo.totalConsumed || 0 },
            { label: 'Categories', value: (freshData.categoryBreakdown || []).length },
          ];
          setPreviewData({ title: 'Consumption Pattern Analysis', subtitle: 'Stores consumption patterns and trends', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary });
          return;
        }

        const daysOfData = freshData.summary?.dataQuality?.daysOfData || 0;
        const confidence = daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low';
        pdfReportGenerator.generateConsumptionAnalysisPDF(
          {
            title: 'Consumption Pattern Analysis',
            vessel: effectiveVesselId,
            vesselName: freshData.summary?.vesselName || vesselName,
            orientation: 'landscape',
            daysOfData,
            confidence,
          },
          {
            summary: freshData.summary,
            consumptionTrends: freshData.consumptionTrends || [],
            topConsumedItems: freshData.topConsumedItems || [],
            categoryBreakdown: freshData.categoryBreakdown || [],
            stockEfficiency: freshData.stockEfficiency || [],
            forecastData: freshData.forecastData || [],
            nonMovingItems: freshData.nonMovingItems || [],
          }
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

  const handlePreviewReport = async (reportId: string) => {
    try {
      toast({ title: "Loading Preview", description: "Preparing report data..." });
      await generateStoresReport(reportId, 'preview');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast({ title: "Preview Failed", description: error.message || "Failed to load report preview.", variant: "destructive" });
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
        await generateStoresReport(reportId, 'download');
        toast({ title: "Report Generated", description: `${format} report downloaded successfully!` });
      } else {
        if (reportId === 'stores-inventory-status') {
          const res = await fetch(`/technical/api/reports/stores-inventory-status/${effectiveVesselId}/excel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ tab: 'stock-status' }),
          });
          if (!res.ok) throw new Error('Failed to generate Excel');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `stores-inventory-status-${new Date().toISOString().slice(0, 10)}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast({ title: "Excel Exported", description: "Report downloaded as Excel file." });
        } else if (reportId === 'low-stock-alert') {
          const res = await fetch(`/technical/api/reports/stores-low-stock-alert/${effectiveVesselId}/excel`, {
            method: 'POST',
            credentials: 'include',
          });
          if (!res.ok) throw new Error('Failed to generate Excel');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `low-stock-alert-${new Date().toISOString().slice(0, 10)}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast({ title: "Excel Exported", description: "Low stock alert report downloaded as Excel file." });
        } else if (reportId === 'stores-consumption-analysis') {
          const res = await fetch(`/technical/api/reports/stores-consumption-analysis/${effectiveVesselId}/excel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({}),
          });
          if (!res.ok) throw new Error('Failed to generate Excel');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `consumption-pattern-analysis-${new Date().toISOString().slice(0, 10)}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast({ title: "Excel Exported", description: "Consumption pattern analysis downloaded as Excel file." });
        } else {
          toast({ title: "Excel Export", description: "Excel export coming soon. PDF is currently available." });
        }
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

  useEffect(() => {
    if (embedded && selectedReportId) {
      setSelectedReport(selectedReportId);
    }
  }, [embedded, selectedReportId]);

  if (selectedReport === 'stores-inventory-status') {
    return (
      <StoresInventoryStatusReport
        onBack={() => setSelectedReport(embedded ? selectedReportId : null)}
        vesselId={effectiveVesselId}
      />
    );
  }

  if (selectedReport === 'chemicals-tracking') {
    return (
      <ChemicalsExpiryReport
        onBack={() => setSelectedReport(embedded ? selectedReportId : null)}
        vesselId={effectiveVesselId}
      />
    );
  }

  if (selectedReport === 'low-stock-alert') {
    return (
      <LowStockAlertReport
        onBack={() => setSelectedReport(embedded ? selectedReportId : null)}
        vesselId={effectiveVesselId}
        source="stores"
      />
    );
  }

  if (selectedReport === 'stores-consumption-analysis') {
    return (
      <ConsumptionPatternReport
        onBack={() => setSelectedReport(embedded ? selectedReportId : null)}
        vesselId={effectiveVesselId}
      />
    );
  }

  return (
    <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              onClick={onBack}
              className="flex items-center gap-2"
              data-testid="button-back-to-reports"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Reports
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory - Stores/Lubes/Chemicals</h1>
              <p className="text-sm text-gray-500">5 reports for stores inventory management</p>
            </div>
          </div>

          <CategoryFilters
            filters={categoryFilters}
            onFiltersChange={setCategoryFilters}
            searchPlaceholder="Search stores reports..."
          />

          {(categoryFilters.dateRange?.from || categoryFilters.dateRange?.to) && (
            <div className="flex items-center gap-2 px-3 py-2 mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300">
              <CalendarIcon className="h-4 w-4 flex-shrink-0" />
              <span>
                Date range active: {categoryFilters.dateRange.from ? format(categoryFilters.dateRange.from, "MMM dd, yyyy") : "Start"}
                {" - "}
                {categoryFilters.dateRange.to ? format(categoryFilters.dateRange.to, "MMM dd, yyyy") : "End"}
                {" — applied when generating reports"}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-purple-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Store className="w-4 h-4 text-purple-500" />
              Total Items
            </CardDescription>
            <CardTitle className="text-3xl">{storesItems.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-red-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Low Stock
            </CardDescription>
            <CardTitle className="text-3xl text-red-600">{lowStockCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Droplets className="w-4 h-4 text-blue-500" />
              Lubricants
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">{lubesCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Beaker className="w-4 h-4 text-green-500" />
              Chemicals
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{chemicalsCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Report Name</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Frequency</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Priority</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Est. Time</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredReports.map((report) => (
              <tr 
                key={report.id} 
                className="hover:bg-gray-50 cursor-pointer"
                data-testid={`stores-report-row-${report.id}`}
                onClick={() => {
                  if (report.id === 'stores-inventory-status' || report.id === 'chemicals-tracking' || report.id === 'low-stock-alert' || report.id === 'stores-consumption-analysis') {
                    setSelectedReport(report.id);
                  }
                }}
              >
                <td className="py-3 px-4">
                  <div>
                    <div className="font-medium text-gray-900">{report.name}</div>
                    <div className="text-sm text-gray-500">{report.description}</div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Badge variant="outline">{report.frequency}</Badge>
                </td>
                <td className="py-3 px-4">
                  <Badge className={getPriorityColor(report.priority)}>
                    {report.priority.toUpperCase()}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs text-gray-500">{report.estimatedTime}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      title="Preview"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (report.id === 'stores-inventory-status' || report.id === 'chemicals-tracking' || report.id === 'low-stock-alert' || report.id === 'stores-consumption-analysis') {
                          setSelectedReport(report.id);
                        } else {
                          handlePreviewReport(report.id);
                        }
                      }}
                      data-testid={`button-preview-${report.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {report.outputs.includes('PDF') && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        title="Download PDF"
                        onClick={(e) => { e.stopPropagation(); handleGenerateReport(report.id, 'PDF'); }}
                        disabled={generatingReports.has(`${report.id}-PDF`)}
                        data-testid={`button-pdf-${report.id}`}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {report.outputs.includes('Excel') && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        title="Download Excel"
                        onClick={(e) => { e.stopPropagation(); handleGenerateReport(report.id, 'Excel'); }}
                        disabled={generatingReports.has(`${report.id}-Excel`)}
                        data-testid={`button-excel-${report.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}

      {embedded && previewData && (
        <InlineReportPreview reportData={previewData} />
      )}
      {!embedded && (
        <ReportPreviewModal
          open={!!previewData}
          onClose={() => setPreviewData(null)}
          reportData={previewData}
        />
      )}
    </div>
  );
};

export default StoresReports;
