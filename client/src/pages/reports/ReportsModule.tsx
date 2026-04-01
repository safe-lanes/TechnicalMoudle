import { useState, useCallback, useMemo, useEffect } from "react";
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
  BarChart3,
  Pencil,
  Expand,
  Minimize2,
  Check,
  X,
  GripVertical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const { vesselId, setVesselId } = useVessel();
  const { toast } = useToast();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionTrigger, setActionTrigger] = useState<ReportActionTrigger | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editCategoryOrder, setEditCategoryOrder] = useState<ReportCategory[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<ReportCategory[]>(REPORT_CATEGORIES);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [globalFilters, setGlobalFilters] = useState<FilterValues>({
    vessels: vesselId ? [vesselId] : [],
    component: "",
    dateRange: { from: null, to: null },
  });

  useEffect(() => {
    if (vesselId) {
      setGlobalFilters(prev => {
        if (prev.vessels.length === 1 && prev.vessels[0] === vesselId) return prev;
        return { ...prev, vessels: [vesselId] };
      });
    }
  }, [vesselId]);

  const expandAll = () => {
    setExpandedCategories(new Set(categoryOrder.map(c => c.id)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const handleEnterEditMode = () => {
    setEditCategoryOrder([...categoryOrder]);
    setIsEditMode(true);
  };

  const handleSaveEditMode = () => {
    setCategoryOrder(editCategoryOrder);
    setIsEditMode(false);
    setEditCategoryOrder([]);
    setDragSourceId(null);
    setDragOverId(null);
    toast({ title: "Saved", description: "Category ordering saved." });
  };

  const handleCancelEditMode = () => {
    setIsEditMode(false);
    setEditCategoryOrder([]);
    setDragSourceId(null);
    setDragOverId(null);
  };

  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDragSourceId(categoryId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (categoryId !== dragSourceId) {
      setDragOverId(categoryId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragSourceId || dragSourceId === targetId) return;
    setEditCategoryOrder(prev => {
      const sourceIdx = prev.findIndex(c => c.id === dragSourceId);
      const targetIdx = prev.findIndex(c => c.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1) return prev;
      const newOrder = [...prev];
      const [moved] = newOrder.splice(sourceIdx, 1);
      newOrder.splice(targetIdx, 0, moved);
      return newOrder;
    });
    setDragSourceId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragSourceId(null);
    setDragOverId(null);
  };

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
    if (filters.vessels.length === 1) {
      setVesselId(filters.vessels[0]);
    }
  }, [setVesselId]);

  const handleFiltersReset = useCallback(() => {
    setGlobalFilters({
      vessels: vesselId ? [vesselId] : [],
      component: "",
      dateRange: { from: null, to: null },
    });
  }, [vesselId]);

  const handleClearAll = () => {
    handleFiltersReset();
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categoryOrder;
    const q = searchQuery.toLowerCase();
    return categoryOrder
      .map(cat => {
        const matchedReports = cat.reports.filter(r => r.name.toLowerCase().includes(q));
        const categoryMatches = cat.title.toLowerCase().includes(q);
        if (categoryMatches) return cat;
        if (matchedReports.length > 0) return { ...cat, reports: matchedReports };
        return null;
      })
      .filter(Boolean) as ReportCategory[];
  }, [searchQuery, categoryOrder]);

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

        <GlobalFilters
          filters={globalFilters}
          onFiltersChange={handleFiltersChange}
          onReset={handleClearAll}
        />
        <div className="flex items-center gap-3 mt-2">
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
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden rounded-lg shadow-sm">
        <div
          className="flex-shrink-0 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col rounded-l-lg"
          style={{ width: '300px' }}
          data-testid="report-tree-panel"
        >
          <div className="flex-shrink-0 bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm flex items-center justify-between gap-2 rounded-tl-lg">
            <div className="flex items-center gap-2">
              <Marker id="G2" /> REPORTS
            </div>
            <div className="flex items-center gap-1">
              {isEditMode ? (
                <>
                  <button
                    onClick={handleSaveEditMode}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                    data-testid="button-save-reports"
                  >
                    <Check className="h-3 w-3" />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditMode}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                    data-testid="button-cancel-reports"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleEnterEditMode}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                    data-testid="button-edit-reports"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={expandAll}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                    data-testid="button-expand-all-reports"
                  >
                    <Expand className="h-3 w-3" />
                    Expand
                  </button>
                  <button
                    onClick={collapseAll}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                    data-testid="button-collapse-all-reports"
                  >
                    <Minimize2 className="h-3 w-3" />
                    Collapse
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {(isEditMode ? editCategoryOrder : filteredCategories).map((category) => {
              const Icon = category.icon;
              const isExpanded = expandedCategories.has(category.id);
              const isCategorySelected = selectedCategoryId === category.id;
              const isDragOver = dragOverId === category.id;

              return (
                <div
                  key={category.id}
                  data-testid={`tree-category-${category.id}`}
                  draggable={isEditMode}
                  onDragStart={isEditMode ? (e) => handleDragStart(e, category.id) : undefined}
                  onDragOver={isEditMode ? (e) => handleDragOver(e, category.id) : undefined}
                  onDrop={isEditMode ? (e) => handleDrop(e, category.id) : undefined}
                  onDragEnd={isEditMode ? handleDragEnd : undefined}
                >
                  <div
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium transition-colors border-b border-gray-100 dark:border-gray-800 ${
                      isDragOver
                        ? 'bg-blue-100 dark:bg-blue-900/40 border-t-2 border-t-blue-400'
                        : isCategorySelected
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    } ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                    onClick={() => { if (!isEditMode) toggleCategory(category.id); }}
                    data-testid={`button-toggle-${category.id}`}
                  >
                    {isEditMode && (
                      <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                    )}
                    {!isEditMode && (isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                    ))}
                    <Icon className="h-4 w-4 flex-shrink-0 text-[#52baf3]" />
                    <span className="truncate flex-1">{category.title}</span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0">{category.reports.length}</span>
                  </div>

                  {!isEditMode && isExpanded && (
                    <div className="bg-gray-50/50 dark:bg-gray-800/30">
                      {category.reports.map((report) => {
                        const isSelected = selectedCategoryId === category.id && selectedReportId === report.id;
                        return (
                          <button
                            key={report.id}
                            className={`w-full flex items-center gap-2 pl-10 pr-3 py-2 text-left text-[13px] transition-colors border-b border-gray-50 dark:border-gray-800/50 ${
                              isSelected
                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-medium border-l-2 border-l-blue-500'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                            onClick={() => handleReportSelect(category.id, report.id)}
                            data-testid={`button-report-${report.id}`}
                          >
                            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                            <span className="truncate">{report.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {!isEditMode && filteredCategories.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No reports match your search.
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white dark:bg-background border border-l-0 border-gray-200 dark:border-gray-700 rounded-r-lg" data-testid="report-viewer-panel">
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
            <div className="flex items-center justify-center h-full bg-gray-50/30 dark:bg-gray-900/20">
              <div className="text-center px-6" data-testid="report-placeholder">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-5">
                  <BarChart3 className="h-8 w-8 text-[#52baf3]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">Select a Report</h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
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
