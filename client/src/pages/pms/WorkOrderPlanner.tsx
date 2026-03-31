import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export default function WorkOrderPlanner({ onBack, vesselId, vesselName }: WorkOrderPlannerProps) {
  const { toast } = useToast();

  const [selectedDays, setSelectedDays] = useState("30");
  const [customDays, setCustomDays] = useState("");
  const [selectedRank, setSelectedRank] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
    enabled: !!vesselId,
    staleTime: 30000,
  });

  const items = data?.items || [];

  const uniqueRanks = useMemo(() => {
    const ranks = items
      .map(item => item.assignedTo?.trim())
      .filter((rank): rank is string => !!rank && rank.length > 0 && rank !== "Unassigned");
    return Array.from(new Set(ranks)).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [queryParams]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

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

  const handlePlannedDateChange = (item: PlannerItem, value: string) => {
    savePlannedDateMutation.mutate({
      jobId: item.jobId,
      componentId: item.componentId,
      plannedDate: value || null,
    });
  };

  const handleExportExcel = async () => {
    try {
      const searchParams = new URLSearchParams(queryParams);
      const response = await fetch(`/technical/api/work-orders/planner/export?${searchParams.toString()}`);
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
        { header: "Component", field: "component", width: 35 },
        { header: "Job Title", field: "jobTitle", width: 45 },
        { header: "Basis", field: "basis", width: 15 },
        { header: "Frequency", field: "frequency", width: 18 },
        { header: "Due Date/RH", field: "dueInfo", width: 20 },
        { header: "Status", field: "statusIndicator", width: 18 },
        { header: "Assigned To", field: "assignedTo", width: 20 },
        { header: "W.O No", field: "woNo", width: 25 },
        { header: "Planned Date", field: "plannedDate", width: 18 },
      ];

      const tableData = items.map((item, idx) => ({
        sno: idx + 1,
        component: item.componentName,
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
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

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
            data-testid="button-planner-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            data-testid="button-planner-export-pdf"
          >
            <FileText className="h-4 w-4 mr-1" />
            PDF
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

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#e8f4fe] dark:bg-gray-700">
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-12">S.No</TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs">Component</TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs">Job Title</TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-24">Basis</TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-24">Frequency</TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-28">Due Date / RH</TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-24">Status</TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-28">Assigned To</TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-28">W.O No</TableHead>
                <TableHead className="text-[#0f172a] dark:text-white font-semibold text-xs w-36">Planned Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">Loading planner data...</p>
                  </TableCell>
                </TableRow>
              ) : paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                    No jobs found for the selected planning horizon
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                    <TableRow
                      key={`${item.jobId}-${item.componentId}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      data-testid={`row-planner-${globalIdx}`}
                    >
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
                        <input
                          type="date"
                          value={item.plannedDate || ""}
                          onChange={(e) => handlePlannedDateChange(item, e.target.value)}
                          className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                          data-testid={`input-planned-date-${globalIdx}`}
                        />
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
    </div>
  );
}
