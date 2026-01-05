import React, { useState, useMemo } from "react";
import { Search, Calendar, ArrowLeft } from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkOrderExecution } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const MaintenanceRecords: React.FC = () => {
  const { toast } = useToast();
  const [, params] = useRoute("/pms/maintenance-records/:componentId");
  const [, setLocation] = useLocation();
  const componentId = params?.componentId || "";
  
  // Get source workOrderId from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const sourceWorkOrderId = urlParams.get('sourceWorkOrderId');

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDateFilter, setSelectedDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Fetch work order executions for this component
  const { data: executions = [], isLoading: executionsLoading } = useQuery<WorkOrderExecution[]>({
    queryKey: [`/technical/api/work-order-executions/${componentId}`],
    enabled: !!componentId,
  });

  // Fetch component details first to get vesselId
  const { data: component, isLoading: componentLoading } = useQuery<any>({
    queryKey: [`/technical/api/components/details/${componentId}`],
    enabled: !!componentId,
  });

  // Fetch all work orders to get templates - filter by vesselId from component
  const { data: allWorkOrders = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ['/technical/api/work-orders', component?.vesselId],
    queryFn: async () => {
      if (!component?.vesselId) return [];
      const response = await fetch(`/technical/api/work-orders?vesselId=${component.vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch work orders');
      return await response.json();
    },
    enabled: !!componentId && !!component?.vesselId,
  });

  const isLoading = executionsLoading || templatesLoading || componentLoading;

  // Date filter logic
  const filterExecutionsByDate = (execution: WorkOrderExecution) => {
    if (!execution.dateCompleted) return false;

    const completedDate = new Date(execution.dateCompleted);
    const today = new Date();

    switch (selectedDateFilter) {
      case "lastMonth": {
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        return completedDate >= lastMonth;
      }
      case "lastQuarter": {
        const lastQuarter = new Date();
        lastQuarter.setMonth(today.getMonth() - 3);
        return completedDate >= lastQuarter;
      }
      case "lastYear": {
        const lastYear = new Date();
        lastYear.setFullYear(today.getFullYear() - 1);
        return completedDate >= lastYear;
      }
      case "custom": {
        if (!customStartDate || !customEndDate) return true;
        const startDate = new Date(customStartDate);
        const endDate = new Date(customEndDate);
        return completedDate >= startDate && completedDate <= endDate;
      }
      case "all":
      default:
        return true;
    }
  };

  // Filter and sort executions
  const filteredExecutions = useMemo(() => {
    return executions
      .filter(execution => {
        // Search filter
        const matchesSearch = searchTerm === "" || 
          execution.executionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          execution.performedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          execution.approvedBy?.toLowerCase().includes(searchTerm.toLowerCase());

        // Date filter
        const matchesDate = filterExecutionsByDate(execution);

        return matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        // Sort by date completed (newest first)
        if (!a.dateCompleted) return 1;
        if (!b.dateCompleted) return -1;
        return new Date(b.dateCompleted).getTime() - new Date(a.dateCompleted).getTime();
      });
  }, [executions, searchTerm, selectedDateFilter, customStartDate, customEndDate]);

  const handleRowClick = (execution: WorkOrderExecution) => {
    // Navigate to work order detail page (full-screen) with the execution/template ID
    // The work order page will handle fetching both template and execution data
    setLocation(`/pms/work-order/${execution.templateId || execution.id}`);
  };

  const getStatusBadgeColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "in progress":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading maintenance records...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (sourceWorkOrderId) {
                    setLocation(`/pms/components?openWorkOrderId=${sourceWorkOrderId}`);
                  } else {
                    setLocation('/pms/components');
                  }
                }}
                className="text-gray-600"
                data-testid="button-back-to-components"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Maintenance Records</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {component?.name || componentId} - Historical Maintenance Data
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by Execution ID, Performed By, Approved By..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
                data-testid="input-search-executions"
              />
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
                    placeholder="Start Date"
                    data-testid="input-custom-start-date"
                  />
                  <span className="text-gray-500">to</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-[150px] bg-white"
                    placeholder="End Date"
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
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">S.No</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Execution ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Date Completed</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Performed By</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Approved By</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Calendar className="h-16 w-16 mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No maintenance records found</p>
                        <p className="text-sm">
                          {searchTerm || selectedDateFilter !== "all"
                            ? "Try adjusting your filters"
                            : "No historical maintenance data available for this component"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExecutions.map((execution, index) => (
                    <tr
                      key={execution.id}
                      onClick={() => handleRowClick(execution)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      data-testid={`execution-row-${execution.executionId}`}
                    >
                      <td className="py-3 px-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="py-3 px-4 text-sm text-blue-600 font-medium">
                        {execution.executionId || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {execution.dateCompleted
                          ? new Date(execution.dateCompleted).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {execution.performedBy || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {execution.approvedBy || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(execution.status)}`}>
                          {execution.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Results Count */}
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-600">
              Showing {filteredExecutions.length} {filteredExecutions.length === 1 ? 'record' : 'records'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceRecords;
