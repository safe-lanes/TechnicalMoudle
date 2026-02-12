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
  Shield,
  FileCheck,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Eye,
  Loader2,
  FileText,
  Download
} from "lucide-react";
import { pdfReportGenerator, formatDate, formatReportDateRange } from "@/lib/pdfReportGenerator";
import ReportPreviewModal, { ReportPreviewData } from "@/components/reports/ReportPreviewModal";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";

interface ComplianceReport {
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
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: globalFilters?.vessel || "all",
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
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

  const effectiveVesselId = categoryFilters.vessel === 'all' 
    ? 'all' 
    : (categoryFilters.vessel || contextVesselId);

  const { data: certificates = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/certificates', effectiveVesselId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveVesselId && effectiveVesselId !== 'all') {
        params.set('vesselId', effectiveVesselId);
      }
      const url = `/technical/api/certificates${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch certificates');
      return res.json();
    },
  });

  const { data: surveys = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/surveys', effectiveVesselId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveVesselId && effectiveVesselId !== 'all') {
        params.set('vesselId', effectiveVesselId);
      }
      const url = `/technical/api/surveys${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch surveys');
      return res.json();
    },
  });

  const reports: ComplianceReport[] = [
    {
      id: "certificates-status",
      name: "Certificates Status & Renewal Report",
      description: "Comprehensive overview of all vessel certificates with expiry dates and renewal requirements",
      purpose: "Monitor certificate validity & plan renewals (Captain/Office)",
      frequency: "Monthly",
      fields: ["Certificate Name", "Issue Date", "Expiry Date", "Days to Expiry", "Status"],
      outputs: ["PDF", "Excel"],
      icon: FileCheck,
      priority: "high",
      estimatedTime: "2-3 min"
    },
    {
      id: "surveys-due",
      name: "Surveys Due Report",
      description: "Upcoming and overdue class and statutory surveys",
      purpose: "Plan survey activities (Office/Vessel)",
      frequency: "Monthly",
      fields: ["Survey Type", "Due Date", "Status", "Last Completed", "Notes"],
      outputs: ["PDF", "Excel"],
      icon: Calendar,
      priority: "high",
      estimatedTime: "2-3 min"
    },
    {
      id: "expiring-certificates",
      name: "Expiring Certificates Alert",
      description: "Certificates expiring within the next 90 days",
      purpose: "Urgent renewal planning (Captain/Office)",
      frequency: "Weekly",
      fields: ["Certificate", "Expiry Date", "Days Remaining", "Priority", "Action"],
      outputs: ["PDF", "Dashboard"],
      icon: AlertTriangle,
      priority: "high",
      estimatedTime: "< 1 min"
    },
    {
      id: "compliance-summary",
      name: "Compliance Summary Report",
      description: "Overall compliance status across all regulatory areas",
      purpose: "Management overview (Office)",
      frequency: "Monthly",
      fields: ["Area", "Total Items", "Compliant", "Non-Compliant", "Percentage"],
      outputs: ["PDF", "Dashboard"],
      icon: Shield,
      priority: "medium",
      estimatedTime: "3-5 min"
    },
    {
      id: "certificate-history",
      name: "Certificate Renewal History",
      description: "Historical record of certificate renewals and amendments",
      purpose: "Audit trail (Office/Auditors)",
      frequency: "Quarterly",
      fields: ["Certificate", "Renewal Date", "Previous Expiry", "New Expiry", "Authority"],
      outputs: ["PDF", "Excel"],
      icon: CheckCircle,
      priority: "low",
      estimatedTime: "2-3 min"
    }
  ];

  const filteredReports = reports.filter(report => {
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

  const getDaysToExpiry = (expiryDate: string | Date | null): number => {
    if (!expiryDate) return 999;
    const expiry = new Date(expiryDate);
    const today = new Date();
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (daysToExpiry: number): string => {
    if (daysToExpiry < 0) return 'Expired';
    if (daysToExpiry <= 30) return 'Critical';
    if (daysToExpiry <= 90) return 'Due Soon';
    return 'Valid';
  };

  const generateComplianceReport = async (reportId: string, mode: 'preview' | 'download' = 'download') => {
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');

    switch (reportId) {
      case 'certificates-status': {
        const columns = [
          { header: 'Certificate', field: 'name', width: 55 },
          { header: 'Issue Date', field: 'issueDate', width: 30 },
          { header: 'Expiry Date', field: 'expiryDate', width: 30 },
          { header: 'Days to Expiry', field: 'daysToExpiry', width: 35 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = certificates.map((c: any) => {
          const days = getDaysToExpiry(c.expiryDate);
          return {
            name: c.name || c.certificateName || '-',
            issueDate: formatDate(c.issueDate),
            expiryDate: formatDate(c.expiryDate),
            daysToExpiry: days,
            status: getExpiryStatus(days)
          };
        });

        const summary = [
          { label: 'Total Certificates', value: data.length },
          { label: 'Valid', value: data.filter((d: any) => d.status === 'Valid').length },
          { label: 'Expiring Soon', value: data.filter((d: any) => d.status === 'Due Soon' || d.status === 'Critical').length },
          { label: 'Expired', value: data.filter((d: any) => d.status === 'Expired').length }
        ];

        if (mode === 'preview') {
          setPreviewData({ title: 'Certificates Status Report', subtitle: 'Certificate validity overview', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary });
          return;
        }
        pdfReportGenerator.generateReport({ title: 'Certificates Status Report', subtitle: 'Certificate validity overview', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) }, columns, data, summary);
        break;
      }

      case 'surveys-due': {
        const columns = [
          { header: 'Survey Type', field: 'name', width: 55 },
          { header: 'Due Date', field: 'dueDate', width: 35 },
          { header: 'Days to Due', field: 'daysToDue', width: 30 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = surveys.map((s: any) => {
          const days = getDaysToExpiry(s.dueDate || s.expiryDate);
          return {
            name: s.name || s.surveyType || '-',
            dueDate: formatDate(s.dueDate || s.expiryDate),
            daysToDue: days,
            status: getExpiryStatus(days)
          };
        });

        const summary = [
          { label: 'Total Surveys', value: data.length },
          { label: 'Due Soon', value: data.filter((d: any) => d.daysToDue <= 90 && d.daysToDue >= 0).length },
          { label: 'Overdue', value: data.filter((d: any) => d.daysToDue < 0).length }
        ];

        if (mode === 'preview') {
          setPreviewData({ title: 'Surveys Due Report', subtitle: 'Upcoming and overdue surveys', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary });
          return;
        }
        pdfReportGenerator.generateReport({ title: 'Surveys Due Report', subtitle: 'Upcoming and overdue surveys', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) }, columns, data, summary);
        break;
      }

      case 'expiring-certificates': {
        const expiringCerts = certificates.filter((c: any) => {
          const days = getDaysToExpiry(c.expiryDate);
          return days <= 90 && days >= 0;
        });

        const columns = [
          { header: 'Certificate', field: 'name', width: 60 },
          { header: 'Expiry Date', field: 'expiryDate', width: 35 },
          { header: 'Days Remaining', field: 'daysRemaining', width: 35 },
          { header: 'Priority', field: 'priority', width: 30 }
        ];

        const data = expiringCerts.map((c: any) => {
          const days = getDaysToExpiry(c.expiryDate);
          return {
            name: c.name || c.certificateName || '-',
            expiryDate: formatDate(c.expiryDate),
            daysRemaining: days,
            priority: days <= 30 ? 'Critical' : 'High'
          };
        });

        const summary = [
          { label: 'Expiring Soon', value: data.length },
          { label: 'Critical (<30 days)', value: data.filter((d: any) => d.daysRemaining <= 30).length }
        ];

        if (mode === 'preview') {
          setPreviewData({ title: 'Expiring Certificates Alert', subtitle: 'Certificates requiring urgent attention', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary });
          return;
        }
        pdfReportGenerator.generateReport({ title: 'Expiring Certificates Alert', subtitle: 'Certificates requiring urgent attention', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) }, columns, data, summary);
        break;
      }

      case 'compliance-summary': {
        const totalCerts = certificates.length;
        const totalSurveys = surveys.length;
        const expiredCerts = certificates.filter((c: any) => getDaysToExpiry(c.expiryDate) < 0).length;
        const expiredSurveys = surveys.filter((s: any) => getDaysToExpiry(s.dueDate || s.expiryDate) < 0).length;

        const columns = [
          { header: 'Area', field: 'area', width: 50 },
          { header: 'Total', field: 'total', width: 30 },
          { header: 'Compliant', field: 'compliant', width: 30 },
          { header: 'Non-Compliant', field: 'nonCompliant', width: 35 },
          { header: 'Compliance %', field: 'percentage', width: 35 }
        ];

        const data = [
          {
            area: 'Certificates',
            total: totalCerts,
            compliant: totalCerts - expiredCerts,
            nonCompliant: expiredCerts,
            percentage: totalCerts > 0 ? `${Math.round((totalCerts - expiredCerts) / totalCerts * 100)}%` : 'N/A'
          },
          {
            area: 'Surveys',
            total: totalSurveys,
            compliant: totalSurveys - expiredSurveys,
            nonCompliant: expiredSurveys,
            percentage: totalSurveys > 0 ? `${Math.round((totalSurveys - expiredSurveys) / totalSurveys * 100)}%` : 'N/A'
          }
        ];

        const overallCompliance = (totalCerts + totalSurveys) > 0 
          ? Math.round(((totalCerts - expiredCerts) + (totalSurveys - expiredSurveys)) / (totalCerts + totalSurveys) * 100)
          : 100;

        const summary = [
          { label: 'Overall Compliance', value: `${overallCompliance}%` },
          { label: 'Total Items', value: totalCerts + totalSurveys },
          { label: 'Non-Compliant', value: expiredCerts + expiredSurveys }
        ];

        if (mode === 'preview') {
          setPreviewData({ title: 'Compliance Summary Report', subtitle: 'Overall compliance status', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary });
          return;
        }
        pdfReportGenerator.generateReport({ title: 'Compliance Summary Report', subtitle: 'Overall compliance status', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) }, columns, data, summary);
        break;
      }

      case 'certificate-history': {
        const columns = [
          { header: 'Certificate', field: 'name', width: 60 },
          { header: 'Issue Date', field: 'issueDate', width: 35 },
          { header: 'Expiry Date', field: 'expiryDate', width: 35 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = certificates.map((c: any) => ({
          name: c.name || c.certificateName || '-',
          issueDate: formatDate(c.issueDate),
          expiryDate: formatDate(c.expiryDate),
          status: getExpiryStatus(getDaysToExpiry(c.expiryDate))
        }));

        if (mode === 'preview') {
          setPreviewData({ title: 'Certificate Renewal History', subtitle: 'Historical record of certificates', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data });
          return;
        }
        pdfReportGenerator.generateReport({ title: 'Certificate Renewal History', subtitle: 'Historical record of certificates', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) }, columns, data);
        break;
      }

      default:
        toast({ title: "Report Not Available", description: "This report is not yet implemented", variant: "destructive" });
    }
  };

  const handlePreviewReport = async (reportId: string) => {
    if (certificates.length === 0 && surveys.length === 0) {
      toast({ title: "No Data Available", description: "No certificates or surveys data found for the selected vessel.", variant: "destructive" });
      return;
    }
    try {
      toast({ title: "Loading Preview", description: "Preparing report data..." });
      await generateComplianceReport(reportId, 'preview');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast({ title: "Preview Failed", description: error.message || "Failed to load report preview.", variant: "destructive" });
    }
  };

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel') => {
    const reportKey = `${reportId}-${format}`;
    
    if (generatingReports.has(reportKey)) return;

    if (certificates.length === 0 && surveys.length === 0) {
      toast({ title: "No Data Available", description: "No certificates or surveys data found for the selected vessel.", variant: "destructive" });
      return;
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateComplianceReport(reportId, 'download');
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

  const expiringCertificates = certificates.filter((c: any) => {
    const days = getDaysToExpiry(c.expiryDate);
    return days <= 90 && days >= 0;
  }).length;

  const expiredCertificates = certificates.filter((c: any) => getDaysToExpiry(c.expiryDate) < 0).length;
  const highPriorityCount = reports.filter(r => r.priority === 'high').length;

  return (
    <div className="p-6 bg-white min-h-screen">
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
            <h1 className="text-2xl font-bold text-gray-900">Compliance & Certificates</h1>
            <p className="text-sm text-gray-500">5 reports for regulatory compliance tracking</p>
          </div>
        </div>

        <CategoryFilters
          filters={categoryFilters}
          onFiltersChange={setCategoryFilters}
          searchPlaceholder="Search compliance reports..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-blue-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <FileCheck className="w-4 h-4 text-blue-500" />
              Total Certificates
            </CardDescription>
            <CardTitle className="text-3xl">{certificates.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-yellow-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Expiring Soon
            </CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{expiringCertificates}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-red-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Expired
            </CardDescription>
            <CardTitle className="text-3xl text-red-600">{expiredCertificates}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-green-500" />
              Total Surveys
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{surveys.length}</CardTitle>
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
                data-testid={`compliance-report-row-${report.id}`}
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
                      onClick={() => handlePreviewReport(report.id)}
                      data-testid={`button-preview-${report.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {report.outputs.includes('PDF') && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        title="Download PDF"
                        onClick={() => handleGenerateReport(report.id, 'PDF')}
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
                        onClick={() => handleGenerateReport(report.id, 'Excel')}
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
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}

      <ReportPreviewModal
        open={!!previewData}
        onClose={() => setPreviewData(null)}
        reportData={previewData}
      />
    </div>
  );
};

export default ComplianceReports;
