import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Marker } from "@/components/Marker";
import { useVessel } from "@/contexts/VesselContext";
import {
  ClipboardList,
  Clock,
  Package,
  Store,
  Biohazard,
  Settings2,
  Search,
  AlertTriangle,
  LifeBuoy,
  ChevronRight,
  ChevronDown,
  FileText,
  Download,
} from "lucide-react";
import MaintenanceReports from "./MaintenanceReports";
import RunningHoursReports from "./RunningHoursReports";
import SparesReports from "./SparesReports";
import StoresReports from "./StoresReports";
import IhmReports from "./IhmReports";
import ChangeRequestReports from "./ChangeRequestReports";
import CriticalEquipmentReports from "./CriticalEquipmentReports";
import LsaFfaReports from "./LsaFfaReports";
import GlobalFilters, { FilterValues } from "@/components/reports/GlobalFilters";

interface ReportItem {
  id: string;
  name: string;
}

interface ReportCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  reports: ReportItem[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "maintenance",
    title: "Maintenance & Work Orders",
    icon: ClipboardList,
    reports: [
      { id: "due-jobs-7", name: "Due Jobs (7 days)" },
      { id: "overdue-jobs", name: "Overdue Jobs" },
      { id: "completed-jobs", name: "Completed Jobs Register" },
      { id: "monthly-summary", name: "Monthly Maintenance Summary" },
      { id: "critical-equipment", name: "Critical Equipment Status" },
      { id: "unplanned-jobs", name: "Unplanned/Breakdown Jobs" },
      { id: "postponement-log", name: "Job Postponement Log" },
      { id: "workload-distribution", name: "Crew Workload Distribution" },
    ],
  },
  {
    id: "running-hours",
    title: "Running Hours & Condition",
    icon: Clock,
    reports: [
      { id: "rh-utilization-summary", name: "Equipment Utilization Summary" },
      { id: "rh-anomaly-detection", name: "Running Hours Anomaly Detection" },
    ],
  },
  {
    id: "spares",
    title: "Inventory - Spares",
    icon: Package,
    reports: [
      { id: "spares-low-stock", name: "Low Stock Alert Report" },
      { id: "spares-consumption-analysis", name: "Consumption Pattern Analysis" },
      { id: "spares-critical-parts", name: "Critical Spares Report" },
    ],
  },
  {
    id: "stores",
    title: "Inventory - Stores/Lubes/Chemicals",
    icon: Store,
    reports: [
      { id: "stores-inventory-status", name: "Stores Inventory Status Report" },
      { id: "lubes-oil-analysis", name: "Lubricants & Oil Analysis Report" },
      { id: "chemicals-tracking", name: "Chemicals Inventory & Expiry Report" },
      { id: "low-stock-alert", name: "Low Stock Alert Report" },
      { id: "stores-consumption-analysis", name: "Consumption Pattern Analysis" },
    ],
  },
  {
    id: "ihm",
    title: "IHM (Inventory of Hazardous Materials)",
    icon: Biohazard,
    reports: [
      { id: "ihm-inventory-status", name: "IHM Inventory Status Report" },
    ],
  },
  {
    id: "change-requests",
    title: "Modify PMS (Change Requests)",
    icon: Settings2,
    reports: [
      { id: "change-requests-status", name: "Change Requests Status & Tracking" },
    ],
  },
  {
    id: "critical-equipment",
    title: "Critical Equipment",
    icon: AlertTriangle,
    reports: [
      { id: "critical-components-list", name: "Critical Components Master List" },
      { id: "critical-equipment-schedule", name: "Maintenance Schedule & Status" },
    ],
  },
  {
    id: "lsa-ffa-equipment",
    title: "LSA/FFA Equipment",
    icon: LifeBuoy,
    reports: [
      { id: "lsa-ffa-master-list", name: "LSA/FFA Equipment Master List" },
      { id: "lsa-ffa-maintenance-schedule", name: "Maintenance Schedule & Status" },
    ],
  },
];

export interface ReportActionTrigger {
  type: 'pdf' | 'excel';
  ts: number;
}

const ReportsModule = () => {
  const { setVesselId } = useVessel();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionTrigger, setActionTrigger] = useState<ReportActionTrigger | null>(null);
  const [globalFilters, setGlobalFilters] = useState<FilterValues>({
    vessel: "all",
    department: "all",
    dateRange: { from: null, to: null },
    priority: "all"
  });

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleReportSelect = (categoryId: string, reportId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedReportId(reportId);
    setActionTrigger(null);
    if (!expandedCategories.has(categoryId)) {
      setExpandedCategories(prev => new Set(prev).add(categoryId));
    }
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

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return REPORT_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return REPORT_CATEGORIES
      .map(cat => {
        const matchedReports = cat.reports.filter(r => r.name.toLowerCase().includes(q));
        const categoryMatches = cat.title.toLowerCase().includes(q);
        if (categoryMatches) return cat;
        if (matchedReports.length > 0) return { ...cat, reports: matchedReports };
        return null;
      })
      .filter(Boolean) as ReportCategory[];
  }, [searchQuery]);

  const selectedReportName = useMemo(() => {
    if (!selectedCategoryId || !selectedReportId) return null;
    const cat = REPORT_CATEGORIES.find(c => c.id === selectedCategoryId);
    return cat?.reports.find(r => r.id === selectedReportId)?.name || null;
  }, [selectedCategoryId, selectedReportId]);

  const renderCategoryContent = () => {
    if (!selectedCategoryId) return null;

    const noop = () => {};
    const embeddedProps = { onBack: noop, globalFilters, embedded: true as const, selectedReportId, actionTrigger };

    switch (selectedCategoryId) {
      case "maintenance":
        return <MaintenanceReports {...embeddedProps} />;
      case "running-hours":
        return <RunningHoursReports {...embeddedProps} />;
      case "spares":
        return <SparesReports {...embeddedProps} />;
      case "stores":
        return <StoresReports {...embeddedProps} />;
      case "ihm":
        return <IhmReports {...embeddedProps} />;
      case "change-requests":
        return <ChangeRequestReports {...embeddedProps} />;
      case "critical-equipment":
        return <CriticalEquipmentReports {...embeddedProps} />;
      case "lsa-ffa-equipment":
        return <LsaFfaReports {...embeddedProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex-shrink-0 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-foreground" data-testid="G1"><Marker id="G1" />Reports</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <GlobalFilters
            filters={globalFilters}
            onFiltersChange={handleFiltersChange}
            onReset={handleFiltersReset}
            className="border-0 shadow-none bg-transparent p-0 mb-0 flex-shrink-0"
            vesselOnly
          />
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
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

      <div className="flex flex-1 gap-0 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
        <div
          className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto"
          style={{ width: '300px' }}
          data-testid="report-tree-panel"
        >
          <div className="py-2">
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              const isExpanded = expandedCategories.has(category.id);
              const isCategorySelected = selectedCategoryId === category.id;

              return (
                <div key={category.id} data-testid={`tree-category-${category.id}`}>
                  <button
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      isCategorySelected && !selectedReportId
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                    onClick={() => toggleCategory(category.id)}
                    data-testid={`button-toggle-${category.id}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    )}
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{category.title}</span>
                    <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{category.reports.length}</span>
                  </button>

                  {isExpanded && (
                    <div className="ml-4">
                      {category.reports.map((report) => {
                        const isSelected = selectedCategoryId === category.id && selectedReportId === report.id;
                        return (
                          <button
                            key={report.id}
                            className={`w-full flex items-center gap-2 pl-7 pr-3 py-2 text-left text-sm transition-colors ${
                              isSelected
                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                            onClick={() => handleReportSelect(category.id, report.id)}
                            data-testid={`button-report-${report.id}`}
                          >
                            <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{report.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCategories.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No reports match your search.
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white dark:bg-background" data-testid="report-viewer-panel">
          {selectedCategoryId && selectedReportId ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground" data-testid="text-selected-report-name">{selectedReportName}</h2>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground">{REPORT_CATEGORIES.find(c => c.id === selectedCategoryId)?.title}</p>
                </div>
                <div className="flex items-center gap-2" data-testid="report-action-buttons">
                  <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-report-pdf"
                    onClick={() => setActionTrigger({ type: 'pdf', ts: Date.now() })}>
                    <FileText className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-report-excel"
                    onClick={() => setActionTrigger({ type: 'excel', ts: Date.now() })}>
                    <Download className="h-3.5 w-3.5" />
                    Excel
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderCategoryContent()}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center" data-testid="report-placeholder">
                <FileText className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">Select a Report</h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">
                  Expand a category in the tree on the left and click on a report to view it here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsModule;
