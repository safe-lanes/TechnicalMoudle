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

const MONTH_FULL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDateForInput = (d: Date | undefined) => {
  if (!d) return "";
  return `${d.getDate().toString().padStart(2, "0")} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
};

const CategoryFilters: React.FC<CategoryFiltersProps> = ({
  filters,
  onFiltersChange,
  searchPlaceholder = "Search reports...",
  showDateRange = true,
  className
}) => {
  const { data: vessels = [] } = useVessels();
  const [catDatePopoverOpen, setCatDatePopoverOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<Date | undefined>(undefined);
  const [pendingTo, setPendingTo] = useState<Date | undefined>(undefined);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const [pendingDateFrom, setPendingDateFrom] = useState<Date | undefined>(undefined);
  const [pendingDateTo, setPendingDateTo] = useState<Date | undefined>(undefined);

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
              setPendingFrom(filters.dateRange.from || undefined);
              setPendingTo(filters.dateRange.to || undefined);
              setShowFromCal(false);
              setShowToCal(false);
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
            <PopoverContent className="w-auto p-4" align="start">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">From</div>
                  <Popover open={showFromCal} onOpenChange={(isOpen) => {
                    setShowFromCal(isOpen);
                    if (isOpen) setPendingDateFrom(pendingFrom);
                  }}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 w-full h-8 px-2 rounded-md border border-input bg-background text-xs cursor-pointer"
                        data-testid="button-cat-date-from"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={pendingFrom ? "text-foreground" : "text-muted-foreground"}>
                          {pendingFrom ? formatDateForInput(pendingFrom) : "Select date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={pendingDateFrom}
                        onSelect={(d) => setPendingDateFrom(d || undefined)}
                        initialFocus
                      />
                      <div className="flex justify-end gap-2 p-3 pt-0 border-t mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setShowFromCal(false)}
                          data-testid="button-cat-date-from-cancel"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setPendingFrom(pendingDateFrom);
                            setShowFromCal(false);
                          }}
                          data-testid="button-cat-date-from-ok"
                        >
                          OK
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">To</div>
                  <Popover open={showToCal} onOpenChange={(isOpen) => {
                    setShowToCal(isOpen);
                    if (isOpen) setPendingDateTo(pendingTo);
                  }}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 w-full h-8 px-2 rounded-md border border-input bg-background text-xs cursor-pointer"
                        data-testid="button-cat-date-to"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={pendingTo ? "text-foreground" : "text-muted-foreground"}>
                          {pendingTo ? formatDateForInput(pendingTo) : "Select date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={pendingDateTo}
                        onSelect={(d) => setPendingDateTo(d || undefined)}
                        initialFocus
                      />
                      <div className="flex justify-end gap-2 p-3 pt-0 border-t mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setShowToCal(false)}
                          data-testid="button-cat-date-to-cancel"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setPendingTo(pendingDateTo);
                            setShowToCal(false);
                          }}
                          data-testid="button-cat-date-to-ok"
                        >
                          OK
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t">
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
                        pendingFrom || null,
                        pendingTo || null
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
