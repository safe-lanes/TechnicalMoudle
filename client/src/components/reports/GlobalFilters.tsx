import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Filter,
  Calendar as CalendarIcon,
  Ship,
  Building,
  AlertTriangle,
  X,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useVessels } from "@/hooks/useVessels";
import { useDepartments } from "@/hooks/useDepartments";

export interface FilterValues {
  vessel: string;
  department: string;
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  priority: string;
}

interface GlobalFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onReset: () => void;
  className?: string;
}

const GlobalFilters: React.FC<GlobalFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
  className
}) => {
  const { data: vessels = [] } = useVessels();
  const { data: departmentsList = [] } = useDepartments();
  
  const departments = departmentsList.map(d => ({
    id: d.listKey,
    name: d.listValue,
    icon: ""
  }));

  const priorities = [
    { id: "high", name: "High Priority", color: "bg-red-100 text-red-800" },
    { id: "medium", name: "Medium Priority", color: "bg-yellow-100 text-yellow-800" },
    { id: "low", name: "Low Priority", color: "bg-green-100 text-green-800" }
  ];

  const handleVesselChange = (value: string) => {
    onFiltersChange({ ...filters, vessel: value });
  };

  const handleDepartmentChange = (value: string) => {
    onFiltersChange({ ...filters, department: value });
  };

  const handlePriorityChange = (value: string) => {
    onFiltersChange({ ...filters, priority: value });
  };

  const handleDateRangeChange = (from: Date | null, to: Date | null) => {
    onFiltersChange({
      ...filters,
      dateRange: { from, to }
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.vessel && filters.vessel !== "all") count++;
    if (filters.department && filters.department !== "all") count++;
    if (filters.priority && filters.priority !== "all") count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    return count;
  };

  const clearDateRange = () => {
    handleDateRangeChange(null, null);
  };

  const getSelectedVessel = () => {
    const vessel = vessels.find(v => v.id === filters.vessel);
    return vessel ? vessel.name : "All Vessels";
  };

  const getSelectedDepartment = () => {
    const dept = departments.find(d => d.id === filters.department);
    return dept ? dept.name : "All Departments";
  };

  const getSelectedPriority = () => {
    const priority = priorities.find(p => p.id === filters.priority);
    return priority ? priority.name : "All Priorities";
  };

  const formatDateRange = () => {
    if (!filters.dateRange.from && !filters.dateRange.to) return "Select date range";
    if (filters.dateRange.from && !filters.dateRange.to) {
      return `From ${format(filters.dateRange.from, "MMM dd, yyyy")}`;
    }
    if (!filters.dateRange.from && filters.dateRange.to) {
      return `Until ${format(filters.dateRange.to, "MMM dd, yyyy")}`;
    }
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, "MMM dd")} - ${format(filters.dateRange.to, "MMM dd, yyyy")}`;
    }
    return "Select date range";
  };

  return (
    <Card className={cn("mb-6", className)} data-testid="global-filters">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">Global Filters</h3>
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {getActiveFiltersCount()} active
              </Badge>
            )}
          </div>
          {getActiveFiltersCount() > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="flex items-center gap-2"
              data-testid="button-reset-filters"
            >
              <RotateCcw className="h-4 w-4" />
              Reset All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Vessel Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Ship className="h-4 w-4" />
              Vessel
            </Label>
            <Select value={filters.vessel} onValueChange={handleVesselChange}>
              <SelectTrigger data-testid="select-vessel-filter">
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{vessel.name}</span>
                      <span className="text-xs text-gray-500">{vessel.id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Building className="h-4 w-4" />
              Department
            </Label>
            <Select value={filters.department} onValueChange={handleDepartmentChange}>
              <SelectTrigger data-testid="select-department-filter">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className="flex items-center gap-2">
                      <span>{dept.icon}</span>
                      <span>{dept.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Priority
            </Label>
            <Select value={filters.priority} onValueChange={handlePriorityChange}>
              <SelectTrigger data-testid="select-priority-filter">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {priorities.map((priority) => (
                  <SelectItem key={priority.id} value={priority.id}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", priority.color.split(' ')[0])} />
                      <span>{priority.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Date Range
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateRange.from && !filters.dateRange.to && "text-muted-foreground"
                  )}
                  data-testid="button-date-range-filter"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  selected={{
                    from: filters.dateRange.from || undefined,
                    to: filters.dateRange.to || undefined,
                  }}
                  onSelect={(range) => {
                    handleDateRangeChange(
                      range?.from || null,
                      range?.to || null
                    );
                  }}
                  numberOfMonths={2}
                />
                {(filters.dateRange.from || filters.dateRange.to) && (
                  <div className="p-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearDateRange}
                      className="w-full"
                    >
                      Clear Date Range
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active Filters Display */}
        {getActiveFiltersCount() > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Label className="text-sm font-medium text-gray-600 mb-2 block">Active Filters:</Label>
            <div className="flex flex-wrap gap-2">
              {filters.vessel && filters.vessel !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Ship className="h-3 w-3" />
                  {getSelectedVessel()}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => handleVesselChange("all")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {filters.department && filters.department !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {getSelectedDepartment()}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => handleDepartmentChange("all")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {filters.priority && filters.priority !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {getSelectedPriority()}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => handlePriorityChange("all")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {(filters.dateRange.from || filters.dateRange.to) && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {formatDateRange()}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={clearDateRange}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GlobalFilters;