import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Clock,
  Package,
  Store,
  FileCheck,
  Biohazard,
  Settings2,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Calendar,
  TrendingUp,
  BarChart3,
  FileText,
  Users,
  Shield
} from "lucide-react";
import MaintenanceReports from "./MaintenanceReports";

interface ReportCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  reportCount: number;
  lastGenerated?: string;
  color: string;
  iconBg: string;
  iconBgLight: string;
}

interface RecentReport {
  id: string;
  name: string;
  category: string;
  generatedAt: string;
  generatedBy: string;
  format: string;
  status: 'completed' | 'processing' | 'failed';
}

const ReportsModule = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const reportCategories: ReportCategory[] = [
    {
      id: "maintenance",
      title: "Maintenance & Work Orders",
      description: "Due jobs, overdue tasks, completion summaries, and work performance reports",
      icon: ClipboardList,
      reportCount: 10,
      lastGenerated: "2 hours ago",
      color: "border-blue-500",
      iconBg: "bg-blue-500",
      iconBgLight: "bg-blue-100 text-blue-600"
    },
    {
      id: "running-hours",
      title: "Running Hours & Condition",
      description: "Equipment utilization, anomalies, and condition monitoring trends",
      icon: Clock,
      reportCount: 4,
      lastGenerated: "4 hours ago", 
      color: "border-green-500",
      iconBg: "bg-green-500",
      iconBgLight: "bg-green-100 text-green-600"
    },
    {
      id: "spares",
      title: "Inventory - Spares",
      description: "Stock levels, consumption, reorder proposals, and movement analysis",
      icon: Package,
      reportCount: 7,
      lastGenerated: "1 day ago",
      color: "border-orange-500",
      iconBg: "bg-orange-500",
      iconBgLight: "bg-orange-100 text-orange-600"
    },
    {
      id: "stores",
      title: "Inventory - Stores/Lubes/Chemicals",
      description: "Stores consumption, lubes tracking, chemical expiry, and non-moving items",
      icon: Store,
      reportCount: 5,
      lastGenerated: "6 hours ago",
      color: "border-purple-500",
      iconBg: "bg-purple-500",
      iconBgLight: "bg-purple-100 text-purple-600"
    },
    {
      id: "compliance",
      title: "Compliance, Class & Certificates",
      description: "Certificate expiry, survey planning, ISM compliance, and regulatory mapping",
      icon: FileCheck,
      reportCount: 5,
      lastGenerated: "1 day ago",
      color: "border-teal-500",
      iconBg: "bg-teal-500",
      iconBgLight: "bg-teal-100 text-teal-600"
    },
    {
      id: "ihm",
      title: "IHM (Inventory of Hazardous Materials)",
      description: "Hazardous materials tracking and evidence documentation",
      icon: Biohazard,
      reportCount: 2,
      lastGenerated: "3 days ago",
      color: "border-red-500",
      iconBg: "bg-red-500",
      iconBgLight: "bg-red-100 text-red-600"
    },
    {
      id: "change-requests",
      title: "Modify PMS (Change Requests)",
      description: "Change request status and approved changes audit trail",
      icon: Settings2,
      reportCount: 2,
      lastGenerated: "5 hours ago",
      color: "border-indigo-500",
      iconBg: "bg-indigo-500",
      iconBgLight: "bg-indigo-100 text-indigo-600"
    },
    {
      id: "admin",
      title: "Alerts, Approvals & Admin",
      description: "Alert monitoring, approval trails, data quality, and user activity",
      icon: AlertTriangle,
      reportCount: 6,
      lastGenerated: "2 hours ago",
      color: "border-yellow-500",
      iconBg: "bg-yellow-500",
      iconBgLight: "bg-yellow-100 text-yellow-600"
    }
  ];

  const recentReports: RecentReport[] = [
    {
      id: "1",
      name: "Due Jobs (7 days)",
      category: "Maintenance & Work Orders",
      generatedAt: "2 hours ago",
      generatedBy: "Chief Engineer",
      format: "PDF",
      status: "completed"
    },
    {
      id: "2", 
      name: "Current Stock Snapshot",
      category: "Inventory - Spares",
      generatedAt: "4 hours ago",
      generatedBy: "2nd Engineer",
      format: "Excel",
      status: "completed"
    },
    {
      id: "3",
      name: "Running Hours Ledger",
      category: "Running Hours & Condition", 
      generatedAt: "6 hours ago",
      generatedBy: "3rd Engineer",
      format: "PDF",
      status: "completed"
    },
    {
      id: "4",
      name: "Monthly Maintenance Summary",
      category: "Maintenance & Work Orders",
      generatedAt: "1 day ago",
      generatedBy: "Chief Engineer", 
      format: "Dashboard",
      status: "completed"
    }
  ];

  const quickAccessReports = [
    { name: "Due Jobs (7 days)", category: "maintenance", frequency: "Daily" },
    { name: "Overdue Jobs", category: "maintenance", frequency: "Daily" },
    { name: "Current Stock Snapshot", category: "spares", frequency: "Weekly" },
    { name: "Low Stock Risk", category: "spares", frequency: "Weekly" },
    { name: "Certificate Expiry", category: "compliance", frequency: "Weekly" },
    { name: "RH Anomalies", category: "running-hours", frequency: "Weekly" }
  ];

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const handleBackToMain = () => {
    setSelectedCategory(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Render category-specific views
  if (selectedCategory === "maintenance") {
    return <MaintenanceReports onBack={handleBackToMain} />;
  }

  // TODO: Add other category components when implemented
  // if (selectedCategory === "running-hours") {
  //   return <RunningHoursReports onBack={handleBackToMain} />;
  // }

  return (
    <div className="p-6 bg-[#fafafa] min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
            <p className="text-gray-600">Generate and export comprehensive reports across all PMS modules</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2" data-testid="button-schedule-reports">
              <Calendar className="h-4 w-4" />
              Schedule Reports
            </Button>
            <Button variant="outline" className="flex items-center gap-2" data-testid="button-export-queue">
              <Download className="h-4 w-4" />
              Export Queue
            </Button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-reports"
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2" data-testid="button-filters">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-800" data-testid="text-total-reports">41</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Generated Today</p>
                <p className="text-2xl font-bold text-gray-800" data-testid="text-generated-today">12</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Export Queue</p>
                <p className="text-2xl font-bold text-gray-800" data-testid="text-export-queue">3</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold text-gray-800" data-testid="text-scheduled">8</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Categories */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Report Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <Card 
                      key={category.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${category.color}`}
                      onClick={() => handleCategoryClick(category.id)}
                      data-testid={`category-card-${category.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`p-2 rounded-lg ${category.iconBg} text-white`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <Badge variant="secondary">{category.reportCount} reports</Badge>
                        </div>
                        <h3 className="font-semibold text-gray-800 mb-2">{category.title}</h3>
                        <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                        {category.lastGenerated && (
                          <p className="text-xs text-gray-500">Last generated: {category.lastGenerated}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Access Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickAccessReports.map((report, index) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer" data-testid={`quick-access-${index}`}>
                  <div>
                    <p className="font-medium text-sm text-gray-800">{report.name}</p>
                    <p className="text-xs text-gray-500">{report.frequency}</p>
                  </div>
                  <Button size="sm" variant="ghost" data-testid={`button-quick-download-${index}`}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentReports.map((report) => (
                <div key={report.id} className="border-b border-gray-100 pb-3 last:border-b-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm text-gray-800">{report.name}</p>
                      <p className="text-xs text-gray-500">{report.category}</p>
                    </div>
                    <Badge className={getStatusColor(report.status)} variant="secondary">
                      {report.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{report.generatedAt} by {report.generatedBy}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">{report.format}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportsModule;