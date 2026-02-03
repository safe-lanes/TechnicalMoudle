import { Button } from "@/components/ui/button";
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
  Calendar as CalendarIcon,
  X,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useVessels } from "@/hooks/useVessels";

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

  const handleVesselChange = (value: string) => {
    onFiltersChange({ ...filters, vessel: value });
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
    <div className={cn("mb-4", className)} data-testid="G7">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        {/* Vessel Selection */}
        <div className="flex-1 min-w-[140px]">
          <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block" data-testid="G8">
            Vessel
          </Label>
          <Select value={filters.vessel} onValueChange={handleVesselChange}>
            <SelectTrigger data-testid="G9" className="h-9">
              <SelectValue placeholder="All Vessels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              {vessels.map((vessel) => (
                <SelectItem key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Selection */}
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block" data-testid="G14">
            Date Range
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9",
                  !filters.dateRange.from && !filters.dateRange.to && "text-muted-foreground"
                )}
                data-testid="G15"
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
                    data-testid="button-clear-date-range"
                  >
                    Clear Date Range
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Reset Button */}
        {getActiveFiltersCount() > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="flex items-center gap-1"
            data-testid="button-reset-filters"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      {/* Active Filters Display - Compact */}
      {getActiveFiltersCount() > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.vessel && filters.vessel !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              {getSelectedVessel()}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVesselChange("all")}
                data-testid="button-clear-vessel-filter"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {(filters.dateRange.from || filters.dateRange.to) && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              {formatDateRange()}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateRange}
                data-testid="button-clear-date-filter"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalFilters;
