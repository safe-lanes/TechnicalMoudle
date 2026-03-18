import { useState, useMemo } from "react";
import { Search, Calendar, History } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVessel } from "@/contexts/VesselContext";

interface HistoryRecord {
  id: number;
  componentId: string;
  componentCode: string;
  vesselCode: string;
  jobId: string | null;
  jobCode: string | null;
  workOrderId: string;
  workOrderNo: string;
  jobTitle: string;
  maintenanceType: string;
  dateCompleted: string;
  runningHoursAtCompletion: string | null;
  performedBy: string;
  approvedBy: string | null;
  status: string;
  missedCycles: number | null;
  isSkipped: boolean | null;
  backdatingDays: number;
}

interface VesselComponent {
  id: string;
  componentCode: string;
  name: string;
}

const WorkHistory: React.FC = () => {
  const [, setLocation] = useLocation();
  const { vesselId, vessels } = useVessel();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("all");
  const [selectedDateFilter, setSelectedDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const currentVessel = vessels.find(v => v.id === vesselId);

  const { data: records = [], isLoading: recordsLoading } = useQuery<HistoryRecord[]>({
    queryKey: [`/technical/api/maintenance-history/vessel/${vesselId}`],
    enabled: !!vesselId,
  });

  const { data: components = [], isLoading: componentsLoading } = useQuery<VesselComponent[]>({
    queryKey: [`/technical/api/components/${vesselId}`],
    enabled: !!vesselId,
  });

  const componentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of components) {
      if (c.componentCode) map.set(c.componentCode, c.name || c.componentCode);
    }
    return map;
  }, [components]);

  const isLoading = recordsLoading || componentsLoading;

  const filterByDate = (record: HistoryRecord): boolean => {
    if (!record.dateCompleted) return false;
    const completedDate = new Date(record.dateCompleted);
    const today = new Date();

    switch (selectedDateFilter) {
      case "lastMonth": {
        const threshold = new Date();
        threshold.setMonth(today.getMonth() - 1);
        return completedDate >= threshold;
      }
      case "lastQuarter": {
        const threshold = new Date();
        threshold.setMonth(today.getMonth() - 3);
        return completedDate >= threshold;
      }
      case "lastYear": {
        const threshold = new Date();
        threshold.setFullYear(today.getFullYear() - 1);
        return completedDate >= threshold;
      }
      case "custom": {
        if (!customStartDate || !customEndDate) return true;
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        return completedDate >= start && completedDate <= end;
      }
      default:
        return true;
    }
  };

  const filteredRecords = useMemo(() => {
    return records
      .filter(record => {
        const matchesComponent =
          selectedComponent === "all" || record.componentCode === selectedComponent;

        const matchesSearch =
          searchTerm === "" ||
          record.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.componentCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (componentMap.get(record.componentCode) ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.performedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.workOrderNo?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = filterByDate(record);

        return matchesComponent && matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        if (!a.dateCompleted) return 1;
        if (!b.dateCompleted) return -1;
        return new Date(b.dateCompleted).getTime() - new Date(a.dateCompleted).getTime();
      });
  }, [records, selectedComponent, searchTerm, selectedDateFilter, customStartDate, customEndDate, componentMap]);

  const vesselComponents = useMemo(() => {
    return [...components]
      .filter(c => c.componentCode)
      .sort((a, b) => {
        const nameA = a.name || a.componentCode;
        const nameB = b.name || b.componentCode;
        return nameA.localeCompare(nameB);
      });
  }, [components]);

  const handleRowClick = (record: HistoryRecord) => {
    setLocation(`/pms/work-order/${record.workOrderId}`);
  };

  const getStatusBadgeColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading work history...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <History className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Work History</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {currentVessel?.name || "Selected Vessel"} — Vessel-Level Maintenance History
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Filters row */}
          <div className="space-y-3">
            {/* Search + Component filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by job, component, performed by, WO number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white"
                  data-testid="input-search-work-history"
                />
              </div>

              <Select value={selectedComponent} onValueChange={setSelectedComponent}>
                <SelectTrigger className="w-[240px] bg-white" data-testid="select-component-filter">
                  <SelectValue placeholder="All Components" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Components</SelectItem>
                  {vesselComponents.map(c => (
                    <SelectItem key={c.componentCode} value={c.componentCode}>
                      {c.name || c.componentCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Date Range:</span>
              <Select value={selectedDateFilter} onValueChange={setSelectedDateFilter}>
                <SelectTrigger className="w-[180px] bg-white" data-testid="select-date-filter">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                  <SelectItem value="lastYear">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {selectedDateFilter === "custom" && (
                <>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-[150px] bg-white"
                    data-testid="input-custom-start-date"
                  />
                  <span className="text-gray-500">to</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-[150px] bg-white"
                    data-testid="input-custom-end-date"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Date Completed</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Component</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Job Title</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">RH at Completion</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Missed Cycles</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Backdating</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Performed By</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <History className="h-16 w-16 mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No work history found</p>
                        <p className="text-sm mt-1">
                          {searchTerm || selectedComponent !== "all" || selectedDateFilter !== "all"
                            ? "Try adjusting your filters"
                            : "No completed work orders have been recorded yet for this vessel"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(record => {
                    const missedCycles = record.missedCycles ?? 0;
                    const backdatingDays = record.backdatingDays ?? 0;
                    const componentName = componentMap.get(record.componentCode) ?? record.componentCode;

                    return (
                      <tr
                        key={record.id}
                        onClick={() => handleRowClick(record)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        data-testid={`history-row-${record.id}`}
                      >
                        <td className="py-3 px-4 text-sm text-gray-900 whitespace-nowrap">
                          {record.dateCompleted
                            ? new Date(record.dateCompleted).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-900">
                          <div className="font-medium">{componentName}</div>
                          <div className="text-xs text-gray-500">{record.componentCode}</div>
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-900 max-w-[220px]">
                          <div className="truncate" title={record.jobTitle}>{record.jobTitle}</div>
                          {record.maintenanceType && (
                            <div className="text-xs text-gray-500">{record.maintenanceType}</div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-900">
                          {record.runningHoursAtCompletion
                            ? `${parseFloat(record.runningHoursAtCompletion).toLocaleString()} hrs`
                            : "-"}
                        </td>

                        <td className="py-3 px-4 text-sm">
                          {missedCycles > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800"
                              data-testid={`badge-missed-cycles-${record.id}`}
                            >
                              ⚠ {missedCycles} {missedCycles === 1 ? "cycle" : "cycles"}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-sm">
                          {backdatingDays > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800"
                              data-testid={`badge-backdating-${record.id}`}
                            >
                              ↩ {backdatingDays} {backdatingDays === 1 ? "day" : "days"}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-900">{record.performedBy || "-"}</td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(record.status)}`}
                          >
                            {record.status || "N/A"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-600">
              Showing{" "}
              <span className="font-medium">{filteredRecords.length}</span>{" "}
              {filteredRecords.length === 1 ? "record" : "records"}
              {records.length !== filteredRecords.length && (
                <span className="text-gray-400"> (of {records.length} total)</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkHistory;
