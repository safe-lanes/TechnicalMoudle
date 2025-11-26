import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessel } from "@/contexts/VesselContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format as formatDate } from "date-fns";
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
  Loader2,
} from "lucide-react";
import { addDays, addMonths } from "date-fns";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  status: "OVERDUE" | "DUE_SOON" | "FUTURE";
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
  byStatus: { OVERDUE: number; DUE_SOON: number; FUTURE: number };
}

interface PlannerResponse {
  summary: PlannerSummary;
  jobs: PlannerJob[];
}

const RANKS = [
  "Chief Engineer",
  "2nd Engineer",
  "3rd Engineer",
  "4th Engineer",
  "Electrical Officer",
  "Fitter",
  "Motorman",
  "Oiler",
  "Wiper",
  "Chief Officer",
  "2nd Officer",
  "3rd Officer",
  "Bosun",
  "AB",
  "OS",
];

const DEPARTMENTS = ["Engine", "Deck", "Electrical", "Catering", "Safety"];

export default function MaintenancePlanner() {
  const { vesselId } = useVessel();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Filter state
  const [jobType, setJobType] = useState<string>("BOTH");
  const [dateWindow, setDateWindow] = useState<string>("30");
  const [rhWindow, setRhWindow] = useState<string>("500");
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [department, setDepartment] = useState<string>("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [expandedSummary, setExpandedSummary] = useState(true);

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      vesselId: vesselId || "V001",
      includeOverdue: includeOverdue ? "true" : "false",
    };

    if (jobType !== "BOTH") {
      params.jobType = jobType;
    }

    if (jobType === "CALENDAR" || jobType === "BOTH") {
      const today = new Date();
      params.toDate = addDays(today, parseInt(dateWindow)).toISOString().split("T")[0];
    }

    if (jobType === "RH" || jobType === "BOTH") {
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
    queryKey: ["/api/maintenance-planner", queryParams],
    queryFn: async () => {
      const searchParams = new URLSearchParams(queryParams);
      const response = await fetch(`/api/maintenance-planner?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch planner data");
      return response.json();
    },
    enabled: !!vesselId,
    staleTime: 60000,
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (exportFormat: "excel" | "pdf") => {
      const searchParams = new URLSearchParams({ ...queryParams, format: exportFormat });
      const response = await fetch(`/api/maintenance-planner/export?${searchParams.toString()}`);
      
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
              onClick={() => setLocation("/pms/reports")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Maintenance Planner</h1>
              <p className="text-sm text-gray-500">
                Planning view for {vesselId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate("excel")}
              disabled={exportMutation.isPending}
              data-testid="button-export-excel"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
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
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Jobs</p>
                        <p className="text-3xl font-bold text-gray-900" data-testid="text-total-jobs">
                          {data.summary.totalJobs}
                        </p>
                      </div>
                      <Wrench className="h-10 w-10 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                {/* Total Man-Hours Card */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Man-Hours</p>
                        <p className="text-3xl font-bold text-gray-900" data-testid="text-total-hours">
                          {data.summary.totalManHours}
                        </p>
                      </div>
                      <Clock className="h-10 w-10 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                {/* Status Breakdown Card */}
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500 mb-2">By Status</p>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600" data-testid="text-overdue-count">
                          {data.summary.byStatus.OVERDUE}
                        </p>
                        <p className="text-xs text-gray-500">Overdue</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-500" data-testid="text-due-soon-count">
                          {data.summary.byStatus.DUE_SOON}
                        </p>
                        <p className="text-xs text-gray-500">Due Soon</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-600" data-testid="text-future-count">
                          {data.summary.byStatus.FUTURE}
                        </p>
                        <p className="text-xs text-gray-500">Upcoming</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Workload by Rank */}
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500 mb-2">Top Workloads</p>
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
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Reset
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
                  <Label>Job Type</Label>
                  <Select value={jobType} onValueChange={setJobType}>
                    <SelectTrigger data-testid="select-job-type">
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
                  <Label>Date Window (Calendar Jobs)</Label>
                  <div className="flex gap-1">
                    {["7", "30", "60", "90"].map((days) => (
                      <Button
                        key={days}
                        variant={dateWindow === days ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateWindow(days)}
                        data-testid={`button-date-${days}`}
                      >
                        {days}d
                      </Button>
                    ))}
                  </div>
                </div>

                {/* RH Window */}
                <div className="space-y-2">
                  <Label>RH Window (RH Jobs)</Label>
                  <div className="flex gap-1">
                    {["250", "500", "1000"].map((hrs) => (
                      <Button
                        key={hrs}
                        variant={rhWindow === hrs ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRhWindow(hrs)}
                        data-testid={`button-rh-${hrs}`}
                      >
                        ≤{hrs}h
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Department */}
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger data-testid="select-department">
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
                    data-testid="checkbox-include-overdue"
                  />
                  <Label htmlFor="includeOverdue" className="text-sm cursor-pointer">
                    Include Overdue
                  </Label>
                </div>

                {/* Critical Only */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="criticalOnly"
                    checked={criticalOnly}
                    onCheckedChange={(checked) => setCriticalOnly(checked === true)}
                    data-testid="checkbox-critical-only"
                  />
                  <Label htmlFor="criticalOnly" className="text-sm cursor-pointer">
                    Critical Only
                  </Label>
                </div>

                {/* Rank Multi-select */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">Ranks:</Label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-select-ranks">
                        <Users className="h-4 w-4 mr-2" />
                        {selectedRanks.length === 0 ? "All Ranks" : `${selectedRanks.length} selected`}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Select Ranks</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                        {RANKS.map((rank) => (
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
                      <div className="flex justify-between mt-4">
                        <Button variant="outline" size="sm" onClick={() => setSelectedRanks([])}>
                          Clear All
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedRanks([...RANKS])}>
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
            <CardTitle className="text-base">
              Maintenance Jobs
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Status</TableHead>
                      <TableHead>Job Code</TableHead>
                      <TableHead className="max-w-[200px]">Job Title</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Dept</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Due Date / RH</TableHead>
                      <TableHead className="text-center">Hours</TableHead>
                      <TableHead className="text-center">Spares</TableHead>
                      <TableHead>WO Status</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.jobs.map((job) => (
                      <TableRow
                        key={job.jobId}
                        className={
                          job.status === "OVERDUE"
                            ? "bg-red-50"
                            : job.status === "DUE_SOON"
                            ? "bg-orange-50"
                            : ""
                        }
                        data-testid={`row-job-${job.jobId}`}
                      >
                        <TableCell>
                          {getStatusBadge(job.status)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {job.jobCode}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={job.jobTitle}>
                          <div className="flex items-center gap-1">
                            {job.criticalFlag && (
                              <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                            )}
                            <span className="truncate">{job.jobTitle}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{job.componentCode}</div>
                            <div className="text-gray-500 text-xs truncate max-w-[150px]" title={job.componentName}>
                              {job.componentName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{job.department}</TableCell>
                        <TableCell className="text-sm">{job.assignedRank}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {job.jobType === "CALENDAR" ? (
                              <><Calendar className="h-3 w-3 mr-1" /> Cal</>
                            ) : (
                              <><Clock className="h-3 w-3 mr-1" /> RH</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {job.jobType === "CALENDAR" ? (
                            job.nextDueDate ? formatDate(new Date(job.nextDueDate), "dd MMM yyyy") : "-"
                          ) : (
                            <span>
                              {job.remainingHours !== null ? `${Math.round(job.remainingHours)} hrs` : "-"}
                              {job.parentRH !== null && (
                                <span className="text-xs text-gray-400 block">
                                  @ {Math.round(job.parentRH)} RH
                                </span>
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {job.estimatedManHours > 0 ? job.estimatedManHours : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger>
                              {getSpareStatusIcon(job.spareStatus)}
                            </TooltipTrigger>
                            <TooltipContent>
                              Spare Status: {job.spareStatus}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-sm">
                          {job.woNo ? (
                            <div>
                              <div className="font-mono text-xs">{job.woNo}</div>
                              <Badge variant="outline" className="text-xs mt-1">
                                {job.woStatus}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-gray-400">No WO</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setLocation(`/pms/components?id=${job.componentId}`)}
                                  data-testid={`button-view-component-${job.jobId}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Component</TooltipContent>
                            </Tooltip>
                            {job.woId && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setLocation(`/pms/work-order/${job.woId}`)}
                                    data-testid={`button-view-wo-${job.jobId}`}
                                  >
                                    <Wrench className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Work Order</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
