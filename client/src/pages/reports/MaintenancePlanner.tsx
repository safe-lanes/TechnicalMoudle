import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessel } from "@/contexts/VesselContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format as formatDate } from "date-fns";
import { Marker } from "@/components/Marker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Minus,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  Eye,
  Wrench,
  Package,
  Users,
  BarChart3,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import { addDays, addMonths } from "date-fns";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUIRole } from "@/contexts/UIRoleContext";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";
import type { ReportColumn } from "@/components/reports/ReportPreviewModal";

interface PlannerJob {
  jobId: string;
  jobCode: string;
  jobTitle: string;
  jobType: "CALENDAR" | "RH";
  componentId: string;
  componentCode: string;
  componentName: string;
  department: string;
  assignedRank: string;
  criticalFlag: boolean;
  classRelatedFlag: boolean;
  estimatedManHours: number;
  nextDueDate: string | null;
  remainingHours: number | null;
  parentRH: number | null;
  status: "OVERDUE" | "DUE_GRACE" | "DUE_SOON" | "FUTURE";
  woId: string | null;
  woNo: string | null;
  woStatus: string | null;
  spareStatus: "OK" | "LOW" | "ZERO" | "NOT_SET";
  frequencyValue: string | null;
  frequencyUnit: string | null;
  lastDoneDate: string | null;
  lastDoneRH: string | null;
}

interface PlannerSummary {
  totalJobs: number;
  totalManHours: number;
  byRank: { rank: string; jobs: number; manHours: number }[];
  byDepartment: { department: string; jobs: number; manHours: number }[];
  byStatus: { OVERDUE: number; DUE_GRACE: number; DUE_SOON: number; FUTURE: number };
}

interface PlannerResponse {
  summary: PlannerSummary;
  jobs: PlannerJob[];
}

const DEPARTMENTS = ["Engine", "Deck", "Electrical", "Catering", "Safety"];

interface MaintenancePlannerProps {
  onBack?: () => void;
  globalFilters?: {
    vessels: string[];
    component: string;
    dateRange: { from: Date | null; to: Date | null };
  };
}

export default function MaintenancePlanner({ onBack, globalFilters }: MaintenancePlannerProps) {
  const { vesselId: contextVesselId, setVesselId, vessels } = useVessel();
  const globalVessels = globalFilters?.vessels || [];
  const globalComponent = globalFilters?.component || "";
  const vesselId = globalVessels.length === 1
    ? globalVessels[0]
    : (globalVessels.length === 0 ? 'all' : contextVesselId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isSailAdmin, isClientAdmin } = useUIRole();

  const [jobType, setJobType] = useState<string>("BOTH");
  const [dateWindow, setDateWindow] = useState<string>("30");
  const [rhWindow, setRhWindow] = useState<string>("500");
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [department, setDepartment] = useState<string>("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [expandedSummary, setExpandedSummary] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Build query params
  // FIXED: Only send calendar params for CALENDAR type, only RH params for RH type
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      vesselId: vesselId || "",
      includeOverdue: includeOverdue ? "true" : "false",
    };

    if (jobType !== "BOTH") {
      params.jobType = jobType;
    }

    // FIXED: Only apply date window filter for CALENDAR and BOTH job types
    if (jobType === "CALENDAR" || jobType === "BOTH") {
      const today = new Date();
      params.fromDate = today.toISOString().split("T")[0];
      params.toDate = addDays(today, parseInt(dateWindow)).toISOString().split("T")[0];
    }

    // FIXED: Only apply RH window filter for RH and BOTH job types
    if (jobType === "RH" || jobType === "BOTH") {
      params.remainingHoursMin = "0";
      params.remainingHoursMax = rhWindow;
    }

    if (selectedRanks.length > 0) {
      params.ranks = selectedRanks.join(",");
    }

    if (department !== "all") {
      params.department = department;
    }

    if (criticalOnly) {
      params.criticalOnly = "true";
    }

    return params;
  }, [vesselId, jobType, dateWindow, rhWindow, includeOverdue, selectedRanks, department, criticalOnly]);

  // Fetch planner data
  const { data, isLoading, refetch, isFetching } = useQuery<PlannerResponse>({
    queryKey: ["/technical/api/maintenance-planner", queryParams],
    queryFn: async () => {
      const searchParams = new URLSearchParams(queryParams);
      const response = await fetch(`/technical/api/maintenance-planner?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch planner data");
      return response.json();
    },
    enabled: !!vesselId && vesselId !== 'all',
    staleTime: 60000,
  });

  const filteredPlannerJobs = useMemo(() => {
    if (!data?.jobs) return [];
    let result = data.jobs;
    if (globalVessels.length > 0 && globalVessels.length < (vessels?.length || 0)) {
      result = result.filter(job => {
        const jobVessel = (job as PlannerJob & { vesselId?: string }).vesselId;
        return !jobVessel || globalVessels.includes(jobVessel);
      });
    }
    if (globalComponent) {
      const q = globalComponent.toLowerCase();
      result = result.filter(job => {
        const name = (job.componentName || "").toLowerCase();
        const code = (job.componentCode || "").toLowerCase();
        return name.includes(q) || code.includes(q);
      });
    }
    return result;
  }, [data?.jobs, globalVessels, globalComponent, vessels?.length]);

  const totalJobs = filteredPlannerJobs.length;
  const totalPages = Math.ceil(totalJobs / pageSize);

  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredPlannerJobs.slice(startIndex, endIndex);
  }, [filteredPlannerJobs, currentPage, pageSize]);

  const uniqueRanks = useMemo(() => {
    if (!data?.jobs) return [];
    const ranks = data.jobs
      .map(job => job.assignedRank?.trim())
      .filter((rank): rank is string => !!rank && rank.length > 0);
    const uniqueSet = Array.from(new Set(ranks));
    return uniqueSet.sort((a, b) => a.localeCompare(b));
  }, [data?.jobs]);

  // Reset to page 1 when filters change (tracked via queryParams)
  const queryParamsString = JSON.stringify(queryParams);
  useEffect(() => {
    setCurrentPage(1);
  }, [queryParamsString]);

  // Ensure current page is valid when data shrinks
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (exportFormat: "excel" | "pdf") => {
      const searchParams = new URLSearchParams({ ...queryParams, format: exportFormat });
      const response = await fetch(`/technical/api/maintenance-planner/export?${searchParams.toString()}`);
      
      if (!response.ok) throw new Error("Export failed");
      
      if (exportFormat === "excel") {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `maintenance-planner-${formatDate(new Date(), "yyyy-MM-dd")}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      
      return exportFormat;
    },
    onSuccess: (exportFormat) => {
      toast({
        title: "Export Successful",
        description: `Maintenance planner exported to ${exportFormat.toUpperCase()}`,
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to export maintenance planner",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OVERDUE":
        return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
      case "DUE_GRACE":
        return <Badge className="bg-amber-500 text-white text-xs">Grace Period</Badge>;
      case "DUE_SOON":
        return <Badge className="bg-orange-500 text-white text-xs">Due Soon</Badge>;
      case "FUTURE":
        return <Badge variant="secondary" className="text-xs">Upcoming</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getSpareStatusIcon = (status: string) => {
    switch (status) {
      case "OK":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "LOW":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "ZERO":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get WO status badge with proper styling based on status
  const getWOStatusBadge = (woStatus: string | null) => {
    if (!woStatus) return null;
    
    switch (woStatus) {
      case "Completed":
        return <Badge className="bg-green-500 text-white text-xs">{woStatus}</Badge>;
      case "In Progress":
        return <Badge className="bg-blue-500 text-white text-xs">{woStatus}</Badge>;
      case "Pending":
      case "Open":
        return <Badge className="bg-yellow-500 text-white text-xs">{woStatus}</Badge>;
      case "Rejected":
        return <Badge variant="destructive" className="text-xs">{woStatus}</Badge>;
      case "Due (Grace P)":
      case "Due (No Grace P)":
        return <Badge className="bg-orange-500 text-white text-xs">{woStatus}</Badge>;
      case "Overdue":
        return <Badge variant="destructive" className="text-xs">{woStatus}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{woStatus}</Badge>;
    }
  };

  const toggleRank = (rank: string) => {
    setSelectedRanks((prev) =>
      prev.includes(rank) ? prev.filter((r) => r !== rank) : [...prev, rank]
    );
  };

  const clearFilters = () => {
    setJobType("BOTH");
    setDateWindow("30");
    setRhWindow("500");
    setIncludeOverdue(true);
    setSelectedRanks([]);
    setDepartment("all");
    setCriticalOnly(false);
  };

  if (!vesselId) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please select a vessel to view the maintenance planner.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onBack?.()}
              data-testid="G21.3"
            >
              <Marker id="G21.3" />
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="G21.1"><Marker id="G21.1" />Maintenance Planner</h1>
              <p className="text-sm text-gray-500" data-testid="G21.2">
                <Marker id="G21.2" />Planning view for {vesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === vesselId)?.name || vesselId)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Vessel Selector - Only visible for Client Admin */}
            {isClientAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Vessel:</span>
                <Select value={vesselId === 'all' ? '' : vesselId} onValueChange={setVesselId}>
                  <SelectTrigger className="w-[200px]" data-testid="select-vessel">
                    <SelectValue placeholder="Choose vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels.map(vessel => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="G21.5"
            >
              <Marker id="G21.5" />
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate("excel")}
              disabled={exportMutation.isPending}
              data-testid="G21.6"
            >
              <Marker id="G21.6" />
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2" data-testid="G21.4">
                <Marker id="G21.4" />
                <BarChart3 className="h-5 w-5" />
                Summary
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedSummary(!expandedSummary)}
              >
                {expandedSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            {expandedSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Jobs Card */}
                <Card data-testid="G21.7">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500"><Marker id="G21.7" />Total Jobs</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {data.summary.totalJobs}
                        </p>
                      </div>
                      <Wrench className="h-10 w-10 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                {/* Total Man-Hours Card */}
                <Card data-testid="G21.8">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500"><Marker id="G21.8" />Total Man-Hours</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {data.summary.totalManHours}
                        </p>
                      </div>
                      <Clock className="h-10 w-10 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                {/* Status Breakdown Card - aligned with work order table statuses */}
                <Card data-testid="G21.9">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500 mb-2"><Marker id="G21.9" />By Status</p>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {data.summary.byStatus.OVERDUE}
                        </p>
                        <p className="text-xs text-gray-500">Overdue</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-amber-500">
                          {data.summary.byStatus.DUE_GRACE}
                        </p>
                        <p className="text-xs text-gray-500">Grace Period</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-500">
                          {data.summary.byStatus.DUE_SOON}
                        </p>
                        <p className="text-xs text-gray-500">Due Soon</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-600">
                          {data.summary.byStatus.FUTURE}
                        </p>
                        <p className="text-xs text-gray-500">Upcoming</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Workload by Rank */}
                <Card data-testid="G21.10">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500 mb-2"><Marker id="G21.10" />Top Workloads</p>
                    <div className="space-y-1">
                      {data.summary.byRank.slice(0, 3).map((r) => (
                        <div key={r.rank} className="flex justify-between text-sm">
                          <span className="text-gray-600 truncate">{r.rank}</span>
                          <span className="font-medium">{r.jobs} jobs ({r.manHours}h)</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2" data-testid="G21.11">
                <Marker id="G21.11" />
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
              <div className="flex items-center gap-2" data-testid="G21.21">
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="G21.20">
                  <Marker id="G21.20" />Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Job Type */}
                <div className="space-y-2">
                  <Label data-testid="G21.12"><Marker id="G21.12" />Job Type</Label>
                  <Select value={jobType} onValueChange={setJobType}>
                    <SelectTrigger data-testid="G21.13">
                      <Marker id="G21.13" />
                      <SelectValue placeholder="Select job type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOTH">All Jobs</SelectItem>
                      <SelectItem value="CALENDAR">Calendar-based</SelectItem>
                      <SelectItem value="RH">Running Hours-based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Window */}
                <div className="space-y-2">
                  <Label data-testid="G21.14"><Marker id="G21.14" />Date Window (Calendar Jobs)</Label>
                  <div className="flex gap-1" data-testid="G21.15">
                    <Marker id="G21.15" />
                    {["7", "30", "60", "90"].map((days) => (
                      <Button
                        key={days}
                        variant={dateWindow === days ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateWindow(days)}
                      >
                        {days}d
                      </Button>
                    ))}
                  </div>
                </div>

                {/* RH Window */}
                <div className="space-y-2">
                  <Label data-testid="G21.16"><Marker id="G21.16" />RH Window (RH Jobs)</Label>
                  <div className="flex gap-1" data-testid="G21.17">
                    <Marker id="G21.17" />
                    {["250", "500", "1000"].map((hrs) => (
                      <Button
                        key={hrs}
                        variant={rhWindow === hrs ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRhWindow(hrs)}
                      >
                        ≤{hrs}h
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Department */}
                <div className="space-y-2">
                  <Label data-testid="G21.18"><Marker id="G21.18" />Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger data-testid="G21.19">
                      <Marker id="G21.19" />
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Include Overdue */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeOverdue"
                    checked={includeOverdue}
                    onCheckedChange={(checked) => setIncludeOverdue(checked === true)}
                    data-testid="G21.22"
                  />
                  <Label htmlFor="includeOverdue" className="text-sm cursor-pointer">
                    <Marker id="G21.22" />Include Overdue
                  </Label>
                </div>

                {/* Critical Only */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="criticalOnly"
                    checked={criticalOnly}
                    onCheckedChange={(checked) => setCriticalOnly(checked === true)}
                    data-testid="G21.23"
                  />
                  <Label htmlFor="criticalOnly" className="text-sm cursor-pointer">
                    <Marker id="G21.23" />Critical Only
                  </Label>
                </div>

                {/* Rank Multi-select */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap" data-testid="G21.24"><Marker id="G21.24" />Ranks:</Label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="G21.25">
                        <Marker id="G21.25" />
                        <Users className="h-4 w-4 mr-2" />
                        {selectedRanks.length === 0 ? "All Ranks" : `${selectedRanks.length} selected`}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Select Ranks</DialogTitle>
                      </DialogHeader>
                      {uniqueRanks.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No ranks available. Load data first.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                          {uniqueRanks.map((rank) => (
                            <div key={rank} className="flex items-center gap-2">
                              <Checkbox
                                id={`rank-${rank}`}
                                checked={selectedRanks.includes(rank)}
                                onCheckedChange={() => toggleRank(rank)}
                              />
                              <Label htmlFor={`rank-${rank}`} className="text-sm cursor-pointer">
                                {rank}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between mt-4">
                        <Button variant="outline" size="sm" onClick={() => setSelectedRanks([])}>
                          Clear All
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedRanks([...uniqueRanks])}>
                          Select All
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Jobs Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base" data-testid="G21.26">
              <Marker id="G21.26" />Maintenance Jobs
              {data?.jobs && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({data.jobs.length} jobs)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : !data?.jobs || data.jobs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No maintenance jobs found matching the current filters.
              </div>
            ) : (
              <>
              <PlannerJobsGrid
                jobs={paginatedJobs}
                getStatusBadge={getStatusBadge}
                getSpareStatusIcon={getSpareStatusIcon}
                getWOStatusBadge={getWOStatusBadge}
                onViewComponent={(componentId) => setLocation(`/pms/components?id=${componentId}`)}
                onViewWorkOrder={(woId) => setLocation(`/pms/work-order/${woId}`)}
              />

              {/* Pagination Controls */}
              {totalPages > 0 && (
                <div className="flex items-center justify-between px-2 py-4 border-t">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalJobs)} of {totalJobs} jobs
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="pageSize" className="text-sm text-gray-600">Rows per page:</Label>
                      <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                        <SelectTrigger className="w-20 h-8" data-testid="select-page-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                      data-testid="button-first-page"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1 mx-2">
                      <span className="text-sm text-gray-600">Page</span>
                      <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={currentPage}
                        onChange={(e) => {
                          const page = parseInt(e.target.value);
                          if (page >= 1 && page <= totalPages) {
                            setCurrentPage(page);
                          }
                        }}
                        className="w-14 h-8 text-center"
                        data-testid="input-page-number"
                      />
                      <span className="text-sm text-gray-600">of {totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                      data-testid="button-last-page"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface PlannerJobsGridProps {
  jobs: PlannerJob[];
  getStatusBadge: (status: PlannerJob["status"]) => React.ReactNode;
  getSpareStatusIcon: (status: PlannerJob["spareStatus"]) => React.ReactNode;
  getWOStatusBadge: (status: string | null) => React.ReactNode;
  onViewComponent: (componentId: string) => void;
  onViewWorkOrder: (woId: string) => void;
}

const renderHeaderWithMarker = (id: string, label: string, extraClass?: string) => () => (
  <span data-testid={id} className={extraClass}><Marker id={id} />{label}</span>
);

const PlannerJobsGrid: React.FC<PlannerJobsGridProps> = ({
  jobs, getStatusBadge, getSpareStatusIcon, getWOStatusBadge, onViewComponent, onViewWorkOrder,
}) => {
  const columns: ReportColumn[] = useMemo(() => [
    {
      header: 'Status', field: 'status', width: 110, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.27', 'Status'),
      cellRenderer: (p: any) => (
        <span data-testid={`row-job-${p.data.jobId}`}>
          {p.node?.rowIndex === 0 && (
            <span data-testid="G21.39"><Marker id="G21.39" /></span>
          )}
          {getStatusBadge(p.data.status)}
        </span>
      ),
    },
    {
      header: 'Job Code', field: 'jobCode', width: 130, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.28', 'Job Code'),
      cellClass: 'font-mono text-sm',
      cellRenderer: (p: any) => (
        <span data-testid={p.node?.rowIndex === 0 ? 'G21.40' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.40" />}
          {p.data.jobCode}
        </span>
      ),
    },
    {
      header: 'Job Title', field: 'jobTitle', flex: 2, minWidth: 200, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.29', 'Job Title'),
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-1" title={p.data.jobTitle} data-testid={p.node?.rowIndex === 0 ? 'G21.41' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.41" />}
          {p.data.criticalFlag && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
          <span className="truncate">{p.data.jobTitle}</span>
        </div>
      ),
    },
    {
      header: 'Component', field: 'componentCode', flex: 1, minWidth: 160, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.30', 'Component'),
      cellRenderer: (p: any) => (
        <div className="text-sm" data-testid={p.node?.rowIndex === 0 ? 'G21.42' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.42" />}
          <div className="font-medium">{p.data.componentCode}</div>
          <div className="text-gray-500 text-xs truncate" title={p.data.componentName}>{p.data.componentName}</div>
        </div>
      ),
    },
    {
      header: 'Dept', field: 'department', width: 110, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.31', 'Dept'),
      cellClass: 'text-sm',
      cellRenderer: (p: any) => (
        <span data-testid={p.node?.rowIndex === 0 ? 'G21.43' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.43" />}{p.data.department}
        </span>
      ),
    },
    {
      header: 'Assigned', field: 'assignedRank', width: 130, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.32', 'Assigned'),
      cellClass: 'text-sm',
      cellRenderer: (p: any) => (
        <span data-testid={p.node?.rowIndex === 0 ? 'G21.44' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.44" />}{p.data.assignedRank}
        </span>
      ),
    },
    {
      header: 'Type', field: 'jobType', width: 90, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.33', 'Type'),
      cellRenderer: (p: any) => (
        <span data-testid={p.node?.rowIndex === 0 ? 'G21.45' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.45" />}
          <Badge variant="outline" className="text-xs">
            {p.data.jobType === 'CALENDAR'
              ? <><Calendar className="h-3 w-3 mr-1" /> Cal</>
              : <><Clock className="h-3 w-3 mr-1" /> RH</>}
          </Badge>
        </span>
      ),
    },
    {
      header: 'Due Date / RH', field: 'nextDueDate', width: 140, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.34', 'Due Date / RH'),
      cellClass: 'text-sm',
      cellRenderer: (p: any) => (
        <span data-testid={p.node?.rowIndex === 0 ? 'G21.46' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.46" />}
          {p.data.jobType === 'CALENDAR'
            ? (p.data.nextDueDate ? formatDate(new Date(p.data.nextDueDate), 'dd MMM yyyy') : '-')
            : (
              <span>
                {p.data.remainingHours !== null ? `${Math.round(p.data.remainingHours)} hrs` : '-'}
                {p.data.parentRH !== null && (
                  <span className="text-xs text-gray-400 block">@ {Math.round(p.data.parentRH)} RH</span>
                )}
              </span>
            )}
        </span>
      ),
    },
    {
      header: 'Hours', field: 'estimatedManHours', width: 90, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.35', 'Hours', 'text-center'),
      cellClass: 'text-center text-sm',
      cellRenderer: (p: any) => (
        <span data-testid={p.node?.rowIndex === 0 ? 'G21.47' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.47" />}
          {p.data.estimatedManHours > 0 ? p.data.estimatedManHours : '-'}
        </span>
      ),
    },
    {
      header: 'Spares', field: 'spareStatus', width: 90, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.36', 'Spares', 'text-center'),
      cellClass: 'text-center',
      cellRenderer: (p: any) => (
        <span data-testid={p.node?.rowIndex === 0 ? 'G21.48' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.48" />}
          <Tooltip>
            <TooltipTrigger>{getSpareStatusIcon(p.data.spareStatus)}</TooltipTrigger>
            <TooltipContent>Spare Status: {p.data.spareStatus}</TooltipContent>
          </Tooltip>
        </span>
      ),
    },
    {
      header: 'WO Status', field: 'woStatus', width: 130, sortable: true,
      headerComponent: renderHeaderWithMarker('G21.37', 'WO Status'),
      cellClass: 'text-sm',
      cellRenderer: (p: any) => (
        <span data-testid={p.node?.rowIndex === 0 ? 'G21.49' : undefined}>
          {p.node?.rowIndex === 0 && <Marker id="G21.49" />}
          {p.data.woNo ? (
            <div>
              <div className="font-mono text-xs">{p.data.woNo}</div>
              {getWOStatusBadge(p.data.woStatus)}
            </div>
          ) : (
            <Badge variant="outline" className="text-xs text-gray-400">Not Generated</Badge>
          )}
        </span>
      ),
    },
    {
      header: 'Actions', field: 'actions', width: 100, sortable: false, filter: false,
      headerComponent: renderHeaderWithMarker('G21.38', 'Actions'),
      cellRenderer: (p: any) => {
        const job: PlannerJob = p.data;
        const isFirst = p.node?.rowIndex === 0;
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={(e) => { e.stopPropagation(); onViewComponent(job.componentId); }}
                  data-testid={isFirst ? 'G21.50' : `button-view-component-${job.jobId}`}
                >
                  {isFirst && <Marker id="G21.50" />}
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Component</TooltipContent>
            </Tooltip>
            {job.woId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0"
                    onClick={(e) => { e.stopPropagation(); onViewWorkOrder(job.woId!); }}
                    data-testid={isFirst ? 'G21.51' : `button-view-wo-${job.jobId}`}
                  >
                    {isFirst && <Marker id="G21.51" />}
                    <Wrench className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Work Order</TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ], [getStatusBadge, getSpareStatusIcon, getWOStatusBadge, onViewComponent, onViewWorkOrder]);

  const getRowClass = (params: any): string | undefined => {
    const s = params?.data?.status;
    if (s === 'OVERDUE') return 'ag-row-status-overdue';
    if (s === 'DUE_GRACE') return 'ag-row-status-due-grace';
    if (s === 'DUE_SOON') return 'ag-row-status-due-soon';
    return undefined;
  };

  return (
    <div className="overflow-x-auto">
      <ReportAgGridTable
        columns={columns}
        data={jobs}
        domLayout="autoHeight"
        headerHeight={42}
        rowHeight={56}
        testId="grid-maintenance-planner-jobs"
        getRowClass={getRowClass}
        getRowId={(p: any) => `${p.data.jobId}-${p.data.componentId}`}
        noRowsMessage="No maintenance jobs found"
      />
    </div>
  );
};

