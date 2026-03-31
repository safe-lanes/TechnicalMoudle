import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Search,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  CalendarCheck,
} from "lucide-react";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { format } from "date-fns";

interface PlannerItem {
  jobId: string;
  jobCode: string;
  jobTitle: string;
  jobType: "CALENDAR" | "RH";
  componentId: string;
  componentCode: string;
  componentName: string;
  assignedTo: string;
  maintenanceBasis: string;
  frequency: string;
  dueInfo: string;
  status: string;
  woNo: string | null;
  woStatus: string | null;
  plannedDate: string | null;
}

interface PlannerResponse {
  items: PlannerItem[];
  total: number;
}

interface WorkOrderPlannerProps {
  onBack: () => void;
  vesselId: string;
  vesselName: string;
}

type SortField = "componentName" | "jobTitle" | "maintenanceBasis" | "frequency" | "dueInfo" | "status" | "assignedTo" | "woNo" | "plannedDate";
type SortDirection = "asc" | "desc";

const STATUS_PRIORITY: Record<string, number> = {
  "Overdue": 0,
  "Due (Grace P)": 1,
  "Due": 2,
  "Upcoming": 3,
};

function itemKey(item: PlannerItem): string {
  return `${item.jobId}::${item.componentId}`;
}

function comparePlannerItems(a: PlannerItem, b: PlannerItem, field: SortField, direction: SortDirection): number {
  let cmp = 0;
  switch (field) {
    case "componentName":
      cmp = (a.componentName || "").localeCompare(b.componentName || "");
      break;
    case "jobTitle":
      cmp = (a.jobTitle || "").localeCompare(b.jobTitle || "");
      break;
    case "maintenanceBasis":
      cmp = (a.maintenanceBasis || "").localeCompare(b.maintenanceBasis || "");
      break;
    case "frequency":
      cmp = (a.frequency || "").localeCompare(b.frequency || "");
      break;
    case "dueInfo": {
      const aIsRH = a.dueInfo.includes("RH");
      const bIsRH = b.dueInfo.includes("RH");
      if (aIsRH && bIsRH) {
        cmp = parseFloat(a.dueInfo.replace(/[^0-9.]/g, "")) - parseFloat(b.dueInfo.replace(/[^0-9.]/g, ""));
      } else if (!aIsRH && !bIsRH) {
        cmp = (a.dueInfo || "").localeCompare(b.dueInfo || "");
      } else {
        cmp = aIsRH ? 1 : -1;
      }
      break;
    }
    case "status":
      cmp = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
      break;
    case "assignedTo":
      cmp = (a.assignedTo || "").localeCompare(b.assignedTo || "");
      break;
    case "woNo":
      cmp = (a.woNo || "").localeCompare(b.woNo || "");
      break;
    case "plannedDate":
      cmp = (a.plannedDate || "9999").localeCompare(b.plannedDate || "9999");
      break;
  }
  return direction === "desc" ? -cmp : cmp;
}

export default function WorkOrderPlanner({ onBack, vesselId, vesselName }: WorkOrderPlannerProps) {
  const { toast } = useToast();

  const [selectedDays, setSelectedDays] = useState("30");
  const [customDays, setCustomDays] = useState("");
  const [selectedRank, setSelectedRank] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [plannerStateFilter, setPlannerStateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState("");
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [overwriteContext, setOverwriteContext] = useState<{
    planned: Array<{ jobId: string; componentId: string }>;
    unplanned: Array<{ jobId: string; componentId: string }>;
    date: string;
  } | null>(null);

  const effectiveDays = selectedDays === "custom"
    ? (parseInt(customDays) || 30)
    : parseInt(selectedDays);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      vesselId,
      days: String(effectiveDays),
    };
    if (selectedRank && selectedRank !== "all") {
      params.rank = selectedRank;
    }
    if (searchTerm) {
      params.search = searchTerm;
    }
    return params;
  }, [vesselId, effectiveDays, selectedRank, searchTerm]);

  const { data, isLoading, isFetching } = useQuery<PlannerResponse>({
    queryKey: ["/technical/api/work-orders/planner", queryParams],
    queryFn: async () => {
      const searchParams = new URLSearchParams(queryParams);
      const response = await fetch(`/technical/api/work-orders/planner?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch planner data");
      return response.json();
    },
    enabled: !!vesselId && vesselId !== 'all',
    staleTime: 30000,
  });

  const rawItems = data?.items || [];

  const rankQueryParams = useMemo(() => {
    const params: Record<string, string> = {
      vesselId,
      days: String(effectiveDays),
    };
    if (searchTerm) {
      params.search = searchTerm;
    }
    return params;
  }, [vesselId, effectiveDays, searchTerm]);

  const { data: rankData } = useQuery<PlannerResponse>({
    queryKey: ["/technical/api/work-orders/planner", rankQueryParams],
    queryFn: async () => {
      const searchParams = new URLSearchParams(rankQueryParams);
      const response = await fetch(`/technical/api/work-orders/planner?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch planner data");
      return response.json();
    },
    enabled: !!vesselId && vesselId !== 'all' && selectedRank !== 'all',
    staleTime: 60000,
  });

  const uniqueRanks = useMemo(() => {
    const sourceItems = selectedRank !== 'all' && rankData?.items ? rankData.items : rawItems;
    const ranks = sourceItems
      .map(item => item.assignedTo?.trim())
      .filter((rank): rank is string => !!rank && rank.length > 0 && rank !== "Unassigned");
    return Array.from(new Set(ranks)).sort((a, b) => a.localeCompare(b));
  }, [rawItems, rankData, selectedRank]);

  const filteredItems = useMemo(() => {
    let result = rawItems;
    if (plannerStateFilter === "unplanned") {
      result = result.filter(item => !item.plannedDate);
    } else if (plannerStateFilter === "planned") {
      result = result.filter(item => !!item.plannedDate);
    }
    return result;
  }, [rawItems, plannerStateFilter]);

  const sortedItems = useMemo(() => {
    if (!sortField) return filteredItems;
    return [...filteredItems].sort((a, b) => comparePlannerItems(a, b, sortField, sortDirection));
  }, [filteredItems, sortField, sortDirection]);

  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [queryParams, plannerStateFilter, sortField, sortDirection]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(start, start + itemsPerPage);
  }, [sortedItems, currentPage, itemsPerPage]);

  useEffect(() => {
    setSelectedKeys(new Set());
    setBulkDate("");
  }, [queryParams, plannerStateFilter]);

  const savePlannedDateMutation = useMutation({
    mutationFn: async ({ jobId, componentId, plannedDate }: { jobId: string; componentId: string; plannedDate: string | null }) => {
      const response = await apiRequest("PATCH", "/technical/api/work-orders/planner/planned-date", {
        vesselId,
        jobId,
        componentId,
        plannedDate,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/work-orders/planner"] });
      toast({ title: "Saved", description: "Planned date updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save planned date", variant: "destructive" });
    },
  });

  const bulkSaveMutation = useMutation({
    mutationFn: async ({ items, plannedDate }: { items: Array<{ jobId: string; componentId: string }>; plannedDate: string }) => {
      const response = await apiRequest("PATCH", "/technical/api/work-orders/planner/bulk-planned-date", {
        vesselId,
        items,
        plannedDate,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/work-orders/planner"] });
      setSelectedKeys(new Set());
      setBulkDate("");
      toast({ title: "Bulk Update Complete", description: `${data.total} planned date${data.total !== 1 ? "s" : ""} saved` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to bulk save planned dates", variant: "destructive" });
    },
  });

  const handlePlannedDateChange = (item: PlannerItem, value: string) => {
    savePlannedDateMutation.mutate({
      jobId: item.jobId,
      componentId: item.componentId,
      plannedDate: value || null,
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-blue-600" />
      : <ArrowDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  const toggleRowSelection = useCallback((key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    const visibleKeys = paginatedItems.filter(item => !!item.componentId).map(itemKey);
    const allSelected = visibleKeys.length > 0 && visibleKeys.every(k => selectedKeys.has(k));
    if (allSelected) {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        visibleKeys.forEach(k => next.delete(k));
        return next;
      });
    } else {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        visibleKeys.forEach(k => next.add(k));
        return next;
      });
    }
  }, [paginatedItems, selectedKeys]);

  const isAllVisibleSelected = useMemo(() => {
    const visibleKeys = paginatedItems.filter(item => !!item.componentId).map(itemKey);
    return visibleKeys.length > 0 && visibleKeys.every(k => selectedKeys.has(k));
  }, [paginatedItems, selectedKeys]);

  const isSomeVisibleSelected = useMemo(() => {
    const visibleKeys = paginatedItems.filter(item => !!item.componentId).map(itemKey);
    return visibleKeys.some(k => selectedKeys.has(k)) && !isAllVisibleSelected;
  }, [paginatedItems, selectedKeys, isAllVisibleSelected]);

  const handleBulkApply = () => {
    if (!bulkDate || selectedKeys.size === 0) return;

    const selectedItems = sortedItems.filter(item => selectedKeys.has(itemKey(item)));
    const planned = selectedItems.filter(item => !!item.plannedDate).map(item => ({ jobId: item.jobId, componentId: item.componentId }));
    const unplanned = selectedItems.filter(item => !item.plannedDate).map(item => ({ jobId: item.jobId, componentId: item.componentId }));

    if (planned.length > 0) {
      setOverwriteContext({ planned, unplanned, date: bulkDate });
      setShowOverwriteDialog(true);
    } else {
      bulkSaveMutation.mutate({ items: unplanned, plannedDate: bulkDate });
    }
  };

  const handleOverwriteChoice = (choice: "unplanned" | "all") => {
    if (!overwriteContext) return;
    const items = choice === "all"
      ? [...overwriteContext.planned, ...overwriteContext.unplanned]
      : overwriteContext.unplanned;
    if (items.length > 0) {
      bulkSaveMutation.mutate({ items, plannedDate: overwriteContext.date });
    }
    setShowOverwriteDialog(false);
    setOverwriteContext(null);
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch(`/technical/api/work-orders/planner/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: sortedItems }),
      });
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${vesselName}_Work_Order_Planner_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: "Export Complete", description: "Planner exported to Excel" });
    } catch {
      toast({ title: "Export Failed", description: "Failed to export planner data", variant: "destructive" });
    }
  };

  const handleExportPdf = () => {
    try {
      const columns = [
        { header: "S.No", field: "sno", width: 10 },
        { header: "Component", field: "component", width: 30 },
        { header: "Job Code", field: "jobCode", width: 20 },
        { header: "Job Title", field: "jobTitle", width: 35 },
        { header: "Basis", field: "basis", width: 15 },
        { header: "Frequency", field: "frequency", width: 18 },
        { header: "Due Date/RH", field: "dueInfo", width: 20 },
        { header: "Status", field: "statusIndicator", width: 18 },
        { header: "Assigned To", field: "assignedTo", width: 20 },
        { header: "W.O No", field: "woNo", width: 25 },
        { header: "Planned Date", field: "plannedDate", width: 18 },
      ];

      const tableData = sortedItems.map((item, idx) => ({
        sno: idx + 1,
        component: item.componentName,
        jobCode: item.jobCode,
        jobTitle: item.jobTitle,
        basis: item.maintenanceBasis,
        frequency: item.frequency,
        dueInfo: item.dueInfo,
        statusIndicator: item.status,
        assignedTo: item.assignedTo,
        woNo: item.woNo || "-",
        plannedDate: item.plannedDate || "-",
      }));

      pdfReportGenerator.generateReport(
        {
          title: "Work Order Planner",
          subtitle: `Planning Horizon: ${effectiveDays} Days | Projected RH: ${(24 * effectiveDays).toLocaleString()} hrs`,
          vessel: vesselName,
          orientation: "landscape",
          pageSize: "a4",
        },
        columns,
        tableData
      );

      toast({ title: "Export Complete", description: "Planner exported to PDF" });
    } catch {
      toast({ title: "Export Failed", description: "Failed to export planner PDF", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Overdue":
        return <Badge variant="destructive" className="text-xs" data-testid="badge-status-overdue">Overdue</Badge>;
      case "Due (Grace P)":
        return <Badge className="bg-amber-500 text-white text-xs" data-testid="badge-status-grace">Grace Period</Badge>;
      case "Due":
        return <Badge className="bg-orange-500 text-white text-xs" data-testid="badge-status-due">Due</Badge>;
      case "Upcoming":
        return <Badge variant="secondary" className="text-xs" data-testid="badge-status-upcoming">Upcoming</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const clearFilters = () => {
    setSelectedDays("30");
    setCustomDays("");
    setSelectedRank("all");
    setSearchTerm("");
    setPlannerStateFilter("all");
    setSortField(null);
    setSortDirection("asc");
    setSelectedKeys(new Set());
    setBulkDate("");
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const colSpan = 12;

  const SortableHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <TableHead
      className={`text-[#0f172a] dark:text-white font-semibold text-xs cursor-pointer select-none hover:bg-[#d0e8f8] dark:hover:bg-gray-600 transition-colors ${className || ""}`}
      onClick={() => handleSort(field)}
      data-testid={`header-sort-${field}`}
    >
      <div className="flex items-center">
        {label}
        {getSortIcon(field)}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="button-back-to-wo"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Work Orders
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900" data-testid="text-planner-title">
              Work Order Planner
            </h2>
            <p className="text-xs text-gray-500">
              {vesselName} — Planning horizon: {effectiveDays} days | RH projection: {(24 * effectiveDays).toLocaleString()} hrs (max)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            title={`Export all ${totalItems} filtered items to Excel`}
            data-testid="button-planner-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel ({totalItems})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            title={`Export all ${totalItems} filtered items to PDF`}
            data-testid="button-planner-export-pdf"
          >
            <FileText className="h-4 w-4 mr-1" />
            PDF ({totalItems})
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-600">Days:</span>
          <Select value={selectedDays} onValueChange={(v) => { setSelectedDays(v); if (v !== "custom") setCustomDays(""); }}>
            <SelectTrigger className="w-28" data-testid="select-planner-days">
              <SelectValue placeholder="30 Days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="60">60 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {selectedDays === "custom" && (
            <Input
              type="number"
              min="1"
              max="365"
              placeholder="Days"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="w-20"
              data-testid="input-planner-custom-days"
            />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-600">Rank:</span>
          <Select value={selectedRank} onValueChange={setSelectedRank}>
            <SelectTrigger className="w-40" data-testid="select-planner-rank">
              <SelectValue placeholder="All Ranks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ranks</SelectItem>
              {uniqueRanks.map((rank) => (
                <SelectItem key={rank} value={rank}>{rank}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-600">Status:</span>
          <Select value={plannerStateFilter} onValueChange={setPlannerStateFilter}>
            <SelectTrigger className="w-36" data-testid="select-planner-state">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unplanned">Unplanned Only</SelectItem>
              <SelectItem value="planned">Planned Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            data-testid="input-planner-search"
          />
        </div>

        <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-planner-clear">
          Clear
        </Button>

        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}

        <div className="ml-auto text-sm text-gray-500" data-testid="text-planner-total">
          {totalItems} job{totalItems !== 1 ? "s" : ""} found
        </div>
      </div>

      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3" data-testid="bulk-action-bar">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {selectedKeys.size} row{selectedKeys.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              className="text-sm border border-blue-300 dark:border-blue-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              data-testid="input-bulk-date"
            />
            <Button
              size="sm"
              onClick={handleBulkApply}
              disabled={!bulkDate || bulkSaveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-bulk-apply"
            >
              {bulkSaveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <CalendarCheck className="h-4 w-4 mr-1" />
              )}
              Apply Planned Date
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedKeys(new Set()); setBulkDate(""); }}
            className="text-blue-700 dark:text-blue-300 hover:text-blue-900"
            data-testid="button-clear-selection"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Selection
          </Button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#e8f4fe] dark:bg-gray-700">
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-10">
                  <Checkbox
                    checked={isAllVisibleSelected ? true : (isSomeVisibleSelected ? "indeterminate" : false)}
                    onCheckedChange={toggleSelectAllVisible}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-12">S.No</TableHead>
                <SortableHeader field="componentName" label="Component" />
                <SortableHeader field="jobTitle" label="Job Title" />
                <SortableHeader field="maintenanceBasis" label="Basis" className="w-24" />
                <SortableHeader field="frequency" label="Frequency" className="w-24" />
                <SortableHeader field="dueInfo" label="Due Date / RH" className="w-28" />
                <SortableHeader field="status" label="Status" className="w-24" />
                <SortableHeader field="assignedTo" label="Assigned To" className="w-28" />
                <SortableHeader field="woNo" label="W.O No" className="w-28" />
                <SortableHeader field="plannedDate" label="Planned Date" className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vesselId === 'all' ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-12 text-gray-500">
                    Please select a specific vessel to use the Planner view
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">Loading planner data...</p>
                  </TableCell>
                </TableRow>
              ) : paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-12 text-gray-500">
                    No jobs found for the selected planning horizon
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                  const key = itemKey(item);
                  const isSelected = selectedKeys.has(key);
                  const isPlanned = !!item.plannedDate;

                  let rowBg = "hover:bg-gray-50 dark:hover:bg-gray-700";
                  if (isSelected) {
                    rowBg = "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30";
                  } else if (isPlanned) {
                    rowBg = "bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20";
                  }

                  return (
                    <TableRow
                      key={key}
                      className={rowBg}
                      data-testid={`row-planner-${globalIdx}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRowSelection(key)}
                          disabled={!item.componentId}
                          data-testid={`checkbox-row-${globalIdx}`}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{globalIdx}</TableCell>
                      <TableCell className="text-sm font-medium text-gray-900 dark:text-white" data-testid={`text-component-${globalIdx}`}>
                        {item.componentName}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 dark:text-gray-300" data-testid={`text-jobtitle-${globalIdx}`}>
                        <div>{item.jobTitle}</div>
                        <div className="text-xs text-gray-400">{item.jobCode}</div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{item.maintenanceBasis}</TableCell>
                      <TableCell className="text-sm text-gray-600">{item.frequency}</TableCell>
                      <TableCell className="text-sm text-gray-600 font-medium" data-testid={`text-due-${globalIdx}`}>
                        {item.dueInfo}
                      </TableCell>
                      <TableCell data-testid={`text-status-${globalIdx}`}>
                        {getStatusBadge(item.status)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{item.assignedTo}</TableCell>
                      <TableCell className="text-sm text-blue-600">
                        {item.woNo || <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={item.plannedDate || ""}
                            onChange={(e) => handlePlannedDateChange(item, e.target.value)}
                            disabled={!item.componentId}
                            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 flex-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid={`input-planned-date-${globalIdx}`}
                          />
                          {isPlanned && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-400 text-green-700 dark:text-green-400 whitespace-nowrap" data-testid={`badge-planned-${globalIdx}`}>
                              Planned
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Show</span>
              <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-16 h-8" data-testid="select-planner-pagesize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>items per page</span>
            </div>

            <div className="text-sm text-gray-600" data-testid="text-planner-showing">
              Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} jobs
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => goToPage(1)} disabled={currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 mx-2">
                Page {currentPage} of {totalPages || 1}
              </span>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-overwrite-confirm">
          <DialogHeader>
            <DialogTitle>Some rows already have a Planned Date</DialogTitle>
            <DialogDescription>
              {overwriteContext && (
                <>
                  <strong>{overwriteContext.planned.length}</strong> of {overwriteContext.planned.length + overwriteContext.unplanned.length} selected
                  row{overwriteContext.planned.length + overwriteContext.unplanned.length !== 1 ? "s" : ""} already
                  {overwriteContext.planned.length === 1 ? " has" : " have"} an existing planned date.
                  How would you like to proceed?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            {overwriteContext && overwriteContext.unplanned.length > 0 && (
              <Button
                onClick={() => handleOverwriteChoice("unplanned")}
                variant="outline"
                className="w-full justify-start"
                data-testid="button-apply-unplanned-only"
              >
                Apply to unplanned only ({overwriteContext.unplanned.length} row{overwriteContext.unplanned.length !== 1 ? "s" : ""})
              </Button>
            )}
            <Button
              onClick={() => handleOverwriteChoice("all")}
              className="w-full justify-start bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-overwrite-all"
            >
              Overwrite all selected ({overwriteContext ? overwriteContext.planned.length + overwriteContext.unplanned.length : 0} row{overwriteContext && overwriteContext.planned.length + overwriteContext.unplanned.length !== 1 ? "s" : ""})
            </Button>
            <Button
              onClick={() => { setShowOverwriteDialog(false); setOverwriteContext(null); }}
              variant="ghost"
              className="w-full justify-start"
              data-testid="button-cancel-overwrite"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
