import { useState } from "react";
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
import { Calendar as CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useVessels } from "@/hooks/useVessels";

export interface CategoryFilterValues {
  searchQuery: string;
  vessel: string;
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
}

interface CategoryFiltersProps {
  filters: CategoryFilterValues;
  onFiltersChange: (filters: CategoryFilterValues) => void;
  searchPlaceholder?: string;
  showDateRange?: boolean;
  className?: string;
}

const CategoryFilters: React.FC<CategoryFiltersProps> = ({
  filters,
  onFiltersChange,
  searchPlaceholder = "Search reports...",
  showDateRange = true,
  className
}) => {
  const { data: vessels = [] } = useVessels();
  const [catDatePopoverOpen, setCatDatePopoverOpen] = useState(false);
  const [catPendingRange, setCatPendingRange] = useState<{ from?: Date; to?: Date }>({});

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, searchQuery: value });
  };

  const handleVesselChange = (value: string) => {
    onFiltersChange({ ...filters, vessel: value });
  };

  const handleDateRangeChange = (from: Date | null, to: Date | null) => {
    onFiltersChange({
      ...filters,
      dateRange: { from, to }
    });
  };

  const handleClearAll = () => {
    onFiltersChange({
      searchQuery: "",
      vessel: "all",
      dateRange: { from: null, to: null }
    });
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

  const hasActiveFilters = () => {
    return filters.searchQuery !== "" || 
           (filters.vessel && filters.vessel !== "all") ||
           filters.dateRange.from !== null ||
           filters.dateRange.to !== null;
  };

  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)} data-testid="category-filters">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder={searchPlaceholder}
          value={filters.searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 h-9"
          data-testid="input-category-search"
        />
      </div>

      <div className="min-w-[160px]">
        <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
          Vessel
        </Label>
        <Select value={filters.vessel} onValueChange={handleVesselChange}>
          <SelectTrigger data-testid="select-category-vessel" className="h-9">
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

      {showDateRange && (
        <div className="min-w-[180px]">
          <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
            Date Range
          </Label>
          <Popover open={catDatePopoverOpen} onOpenChange={(isOpen) => {
            setCatDatePopoverOpen(isOpen);
            if (isOpen) {
              setCatPendingRange({
                from: filters.dateRange.from || undefined,
                to: filters.dateRange.to || undefined,
              });
            }
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9",
                  !filters.dateRange.from && !filters.dateRange.to && "text-muted-foreground"
                )}
                data-testid="button-category-date-range"
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
                  from: catPendingRange.from,
                  to: catPendingRange.to,
                }}
                onSelect={(range) => {
                  setCatPendingRange({
                    from: range?.from || undefined,
                    to: range?.to || undefined,
                  });
                }}
                numberOfMonths={2}
              />
              <div className="flex items-center justify-between gap-2 p-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleDateRangeChange(null, null);
                    setCatDatePopoverOpen(false);
                  }}
                  className="text-xs"
                  data-testid="button-clear-category-date-range"
                >
                  Clear
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCatDatePopoverOpen(false)}
                    className="text-xs"
                    data-testid="button-cat-date-range-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      handleDateRangeChange(
                        catPendingRange.from || null,
                        catPendingRange.to || null
                      );
                      setCatDatePopoverOpen(false);
                    }}
                    data-testid="button-cat-date-range-ok"
                  >
                    OK
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {hasActiveFilters() && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="text-gray-600 h-9"
          data-testid="button-clear-category-filters"
        >
          Clear
        </Button>
      )}
    </div>
  );
};

export default CategoryFilters;
