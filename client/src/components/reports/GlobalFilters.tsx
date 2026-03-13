import { useState } from "react";
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
  vesselOnly?: boolean;
  dateOnly?: boolean;
}

const MONTH_FULL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDateForInput = (d: Date | undefined) => {
  if (!d) return "";
  return `${d.getDate().toString().padStart(2, "0")} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
};

const GlobalFilters: React.FC<GlobalFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
  className,
  vesselOnly,
  dateOnly
}) => {
  const { data: vessels = [] } = useVessels();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<Date | undefined>(undefined);
  const [pendingTo, setPendingTo] = useState<Date | undefined>(undefined);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const [pendingDateFrom, setPendingDateFrom] = useState<Date | undefined>(undefined);
  const [pendingDateTo, setPendingDateTo] = useState<Date | undefined>(undefined);

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

  if (vesselOnly) {
    return (
      <div className={cn("", className)} data-testid="G7">
        <div className="flex items-center gap-2" data-testid="G8">
          <span className="text-sm font-medium text-gray-600">Vessel:</span>
          <Select value={filters.vessel} onValueChange={handleVesselChange}>
            <SelectTrigger data-testid="G9" className="w-[200px]">
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
      </div>
    );
  }

  if (dateOnly) {
    const hasDateFilter = !!(filters.dateRange.from || filters.dateRange.to);
    return (
      <div className={cn("", className)} data-testid="G7-date">
        <div className="flex items-center gap-3">
          <div className="min-w-[160px]">
            <Popover open={datePopoverOpen} onOpenChange={(isOpen) => {
              setDatePopoverOpen(isOpen);
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
                  data-testid="G15"
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
                          data-testid="button-date-from"
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
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowFromCal(false)} data-testid="button-date-from-cancel">Cancel</Button>
                          <Button size="sm" className="text-xs" onClick={() => { setPendingFrom(pendingDateFrom); setShowFromCal(false); }} data-testid="button-date-from-ok">OK</Button>
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
                          data-testid="button-date-to"
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
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowToCal(false)} data-testid="button-date-to-cancel">Cancel</Button>
                          <Button size="sm" className="text-xs" onClick={() => { setPendingTo(pendingDateTo); setShowToCal(false); }} data-testid="button-date-to-ok">OK</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t">
                  <Button variant="outline" size="sm" onClick={() => { handleDateRangeChange(null, null); setDatePopoverOpen(false); }} className="text-xs" data-testid="button-clear-date-range">Clear</Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDatePopoverOpen(false)} className="text-xs" data-testid="button-date-range-cancel">Cancel</Button>
                    <Button size="sm" className="text-xs" onClick={() => { handleDateRangeChange(pendingFrom || null, pendingTo || null); setDatePopoverOpen(false); }} data-testid="button-date-range-ok">OK</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mb-4", className)} data-testid="G7">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        {/* Vessel Selection */}
        <div className="flex items-center gap-2" data-testid="G8">
          <span className="text-sm font-medium text-gray-600">Vessel:</span>
          <Select value={filters.vessel} onValueChange={handleVesselChange}>
            <SelectTrigger data-testid="G9" className="w-[200px]">
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
          <Popover open={datePopoverOpen} onOpenChange={(isOpen) => {
            setDatePopoverOpen(isOpen);
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
                data-testid="G15"
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
                        data-testid="button-date-from"
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
                          data-testid="button-date-from-cancel"
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
                          data-testid="button-date-from-ok"
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
                        data-testid="button-date-to"
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
                          data-testid="button-date-to-cancel"
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
                          data-testid="button-date-to-ok"
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
                    setDatePopoverOpen(false);
                  }}
                  className="text-xs"
                  data-testid="button-clear-date-range"
                >
                  Clear
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePopoverOpen(false)}
                    className="text-xs"
                    data-testid="button-date-range-cancel"
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
                      setDatePopoverOpen(false);
                    }}
                    data-testid="button-date-range-ok"
                  >
                    OK
                  </Button>
                </div>
              </div>
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
