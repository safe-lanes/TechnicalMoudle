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
  Shield,
  FileCheck,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Eye,
  Loader2
} from "lucide-react";
import { pdfReportGenerator, formatDate } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";

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

const ComplianceReports: React.FC<ComplianceReportsProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId } = useVessel();

  const { data: certificates = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/certificates', vesselId],
    enabled: !!vesselId && vesselId !== 'all',
  });

  const { data: surveys = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/surveys', vesselId],
    enabled: !!vesselId && vesselId !== 'all',
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

  const generateCompliancePDF = async (reportId: string) => {
    const vesselName = vessels.find(v => v.id === vesselId)?.name || vesselId || 'All Vessels';

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

        pdfReportGenerator.generateReport(
          { title: 'Certificates Status Report', subtitle: 'Certificate validity overview', vessel: vesselName },
          columns,
          data,
          summary
        );
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

        pdfReportGenerator.generateReport(
          { title: 'Surveys Due Report', subtitle: 'Upcoming and overdue surveys', vessel: vesselName },
          columns,
          data,
          summary
        );
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

        pdfReportGenerator.generateReport(
          { title: 'Expiring Certificates Alert', subtitle: 'Certificates requiring urgent attention', vessel: vesselName },
          columns,
          data,
          summary
        );
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

        pdfReportGenerator.generateReport(
          { title: 'Compliance Summary Report', subtitle: 'Overall compliance status', vessel: vesselName },
          columns,
          data,
          summary
        );
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

        pdfReportGenerator.generateReport(
          { title: 'Certificate Renewal History', subtitle: 'Historical record of certificates', vessel: vesselName },
          columns,
          data
        );
        break;
      }

      default:
        toast({ title: "Report Not Available", description: "This report is not yet implemented", variant: "destructive" });
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
        await generateCompliancePDF(reportId);
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
              <div className="p-2 rounded-lg bg-teal-500 text-white">
                <FileCheck className="h-5 w-5" />
              </div>
              Compliance, Class & Certificates
            </h1>
            <p className="text-gray-600">5 reports for compliance monitoring</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search compliance reports..."
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
                <p className="text-sm text-gray-600">Total Certificates</p>
                <p className="text-2xl font-bold text-gray-800">{certificates.length}</p>
              </div>
              <FileCheck className="h-8 w-8 text-teal-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expiring Soon</p>
                <p className="text-2xl font-bold text-yellow-600">{expiringCertificates}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expired</p>
                <p className="text-2xl font-bold text-red-600">{expiredCertificates}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Surveys</p>
                <p className="text-2xl font-bold text-blue-600">{surveys.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
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
                    <div className="p-2 rounded-lg bg-teal-100 text-teal-600">
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

export default ComplianceReports;
