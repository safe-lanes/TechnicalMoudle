import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Marker } from "@/components/Marker";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useVessel } from "@/contexts/VesselContext";
import {
  ClipboardList,
  Clock,
  Package,
  Store,
  Biohazard,
  Settings2,
  Search,
  Download,
  Calendar,
  AlertTriangle,
  LifeBuoy
} from "lucide-react";
import MaintenanceReports from "./MaintenanceReports";
import RunningHoursReports from "./RunningHoursReports";
import SparesReports from "./SparesReports";
import StoresReports from "./StoresReports";
import IhmReports from "./IhmReports";
import ChangeRequestReports from "./ChangeRequestReports";
import CriticalEquipmentReports from "./CriticalEquipmentReports";
import LsaFfaReports from "./LsaFfaReports";
import MaintenancePlanner from "./MaintenancePlanner";
import GlobalFilters, { FilterValues } from "@/components/reports/GlobalFilters";

const LIMIT_REPORTS = false;

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


const ReportsModule = () => {
  const { isSailAdmin } = useUIRole();
  const { setVesselId } = useVessel();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalFilters, setGlobalFilters] = useState<FilterValues>({
    vessel: "all",
    department: "all",
    dateRange: { from: null, to: null },
    priority: "all"
  });

  const reportCategories: ReportCategory[] = [
    {
      id: "planner",
      title: "Maintenance Planner",
      description: "Consolidated planning view with calendar and RH-based jobs, workload by rank, and exports",
      icon: Calendar,
      reportCount: 1,
      lastGenerated: "Live",
      color: "border-blue-500",
      iconBg: "bg-blue-500",
      iconBgLight: "bg-blue-100 text-blue-600"
    },
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
      reportCount: 2,
      lastGenerated: "4 hours ago", 
      color: "border-blue-500",
      iconBg: "bg-blue-500",
      iconBgLight: "bg-blue-100 text-blue-600"
    },
    {
      id: "spares",
      title: "Inventory - Spares",
      description: "Stock levels, consumption, reorder proposals, and movement analysis",
      icon: Package,
      reportCount: 3,
      lastGenerated: "1 day ago",
      color: "border-blue-500",
      iconBg: "bg-blue-500",
      iconBgLight: "bg-blue-100 text-blue-600"
    },
    {
      id: "stores",
      title: "Inventory - Stores/Lubes/Chemicals",
      description: "Stores consumption, lubes tracking, chemical expiry, and non-moving items",
      icon: Store,
      reportCount: 5,
      lastGenerated: "6 hours ago",
      color: "border-blue-500",
      iconBg: "bg-blue-500",
      iconBgLight: "bg-blue-100 text-blue-600"
    },
    {
      id: "ihm",
      title: "IHM (Inventory of Hazardous Materials)",
      description: "Hazardous materials tracking and evidence documentation",
      icon: Biohazard,
      reportCount: 1,
      lastGenerated: "3 days ago",
      color: "border-blue-500",
      iconBg: "bg-blue-500",
      iconBgLight: "bg-blue-100 text-blue-600"
    },
    {
      id: "change-requests",
      title: "Modify PMS (Change Requests)",
      description: "Change request status and approved changes audit trail",
      icon: Settings2,
      reportCount: 1,
      lastGenerated: "5 hours ago",
      color: "border-blue-500",
      iconBg: "bg-blue-500",
      iconBgLight: "bg-blue-100 text-blue-600"
    },
    {
      id: "critical-equipment",
      title: "Critical Equipment",
      description: "Safety-critical components tracking, compliance reports, and maintenance oversight",
      icon: AlertTriangle,
      reportCount: 2,
      color: "border-red-500",
      iconBg: "bg-red-500",
      iconBgLight: "bg-red-100 text-red-600"
    },
    {
      id: "lsa-ffa-equipment",
      title: "LSA/FFA Equipment",
      description: "Life-saving and fire-fighting equipment tracking, statutory compliance reports, and maintenance schedules",
      icon: LifeBuoy,
      reportCount: 2,
      color: "border-orange-500",
      iconBg: "bg-orange-500",
      iconBgLight: "bg-orange-100 text-orange-600"
    },
  ];

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const handleBackToMain = () => {
    setSelectedCategory(null);
  };

  const handleFiltersChange = useCallback((filters: FilterValues) => {
    setGlobalFilters(filters);
    if (filters.vessel && filters.vessel !== "all") {
      setVesselId(filters.vessel);
    }
  }, [setVesselId]);

  const handleFiltersReset = useCallback(() => {
    setGlobalFilters({
      vessel: "all",
      department: "all",
      dateRange: { from: null, to: null },
      priority: "all"
    });
  }, []);

  const handleClearAll = () => {
    setSearchQuery("");
    handleFiltersReset();
  };

  const hasActiveFilters = () => {
    return searchQuery !== "" || 
           (globalFilters.vessel && globalFilters.vessel !== "all") ||
           globalFilters.dateRange.from !== null ||
           globalFilters.dateRange.to !== null;
  };

  // Render category-specific views
  if (selectedCategory === "planner") {
    return <MaintenancePlanner onBack={handleBackToMain} globalFilters={globalFilters} />;
  }

  if (selectedCategory === "maintenance") {
    return <MaintenanceReports onBack={handleBackToMain} globalFilters={globalFilters} />;
  }

  if (selectedCategory === "running-hours") {
    return <RunningHoursReports onBack={handleBackToMain} globalFilters={globalFilters} />;
  }

  if (selectedCategory === "spares") {
    return <SparesReports onBack={handleBackToMain} globalFilters={globalFilters} />;
  }

  if (selectedCategory === "stores") {
    return <StoresReports onBack={handleBackToMain} globalFilters={globalFilters} />;
  }

  if (selectedCategory === "ihm") {
    return <IhmReports onBack={handleBackToMain} globalFilters={globalFilters} />;
  }

  if (selectedCategory === "change-requests") {
    return <ChangeRequestReports onBack={handleBackToMain} globalFilters={globalFilters} />;
  }

  if (selectedCategory === "critical-equipment") {
    return <CriticalEquipmentReports onBack={handleBackToMain} globalFilters={globalFilters} />;
  }

  if (selectedCategory === "lsa-ffa-equipment") {
    return <LsaFfaReports onBack={handleBackToMain} globalFilters={globalFilters} />;
  }

  // TODO: Add other category components when implemented

  const plannerCategory = reportCategories.find(cat => cat.id === "planner")!;
  const PlannerIcon = plannerCategory.icon;

  if (LIMIT_REPORTS) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="G1"><Marker id="G1" />Reports</h1>
          {isSailAdmin && (
            <div className="flex gap-3">
              <Button variant="outline" className="flex items-center gap-2" data-testid="G5">
                <Marker id="G5" />
                <Calendar className="h-4 w-4" />
                Schedule Reports
              </Button>
              <Button variant="outline" className="flex items-center gap-2" data-testid="G6">
                <Marker id="G6" />
                <Download className="h-4 w-4" />
                Export Queue
              </Button>
            </div>
          )}
        </div>

        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${plannerCategory.color} max-w-md`}
          onClick={() => handleCategoryClick(plannerCategory.id)}
          data-testid="G21"
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${plannerCategory.iconBg} text-white`}>
                <Marker id="G21" />
                <PlannerIcon className="h-5 w-5" />
              </div>
              <Badge variant="secondary">{plannerCategory.reportCount} reports</Badge>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">{plannerCategory.title}</h3>
            <p className="text-sm text-gray-600 mb-3">{plannerCategory.description}</p>
            {plannerCategory.lastGenerated && (
              <p className="text-xs text-gray-500">Last generated: {plannerCategory.lastGenerated}</p>
            )}
          </CardContent>
        </Card>

        <p className="text-lg font-semibold text-gray-800 dark:text-white">Other Reports Coming Soon...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="G1"><Marker id="G1" />Reports</h1>
          {isSailAdmin && (
            <div className="flex gap-3">
              <Button variant="outline" className="flex items-center gap-2" data-testid="G5">
                <Marker id="G5" />
                <Calendar className="h-4 w-4" />
                Schedule Reports
              </Button>
              <Button variant="outline" className="flex items-center gap-2" data-testid="G6">
                <Marker id="G6" />
                <Download className="h-4 w-4" />
                Export Queue
              </Button>
            </div>
          )}
        </div>

        {/* Filters - Single Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <GlobalFilters
            filters={globalFilters}
            onFiltersChange={handleFiltersChange}
            onReset={handleFiltersReset}
            className="border-0 shadow-none bg-transparent p-0 mb-0 flex-shrink-0"
            vesselOnly
          />
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="G3"
            />
          </div>
          <GlobalFilters
            filters={globalFilters}
            onFiltersChange={handleFiltersChange}
            onReset={handleFiltersReset}
            className="border-0 shadow-none bg-transparent p-0 mb-0"
            dateOnly
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="text-gray-600"
            data-testid="button-clear-all-filters"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-6">

      {/* Report Categories - Full Width Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCategories.map((category, index) => {
          const Icon = category.icon;
          const markerId = `G${21 + index}`;
          return (
            <Card 
              key={category.id}
              className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
              onClick={() => handleCategoryClick(category.id)}
              data-testid={markerId}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded ${category.iconBgLight} flex-shrink-0`}>
                    <Marker id={markerId} />
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {category.title}
                      </h3>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {category.reportCount} reports
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                      {category.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      </div>
    </div>
  );
};

export default ReportsModule;