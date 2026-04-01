import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  RotateCcw,
  Ship,
  Search,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useVessels } from "@/hooks/useVessels";
import { useQuery } from "@tanstack/react-query";

export interface FilterValues {
  vessels: string[];
  component: string;
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
}

interface ComponentRecord {
  id?: string;
  name?: string;
  componentName?: string;
  componentCode?: string;
  code?: string;
}

interface ComponentSuggestion {
  id: string;
  name: string;
  code: string;
}

interface GlobalFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onReset: () => void;
  className?: string;
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
}) => {
  const { data: vessels = [] } = useVessels();
  const [vesselPopoverOpen, setVesselPopoverOpen] = useState(false);
  const [vesselSearch, setVesselSearch] = useState("");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<Date | undefined>(undefined);
  const [pendingTo, setPendingTo] = useState<Date | undefined>(undefined);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const [pendingDateFrom, setPendingDateFrom] = useState<Date | undefined>(undefined);
  const [pendingDateTo, setPendingDateTo] = useState<Date | undefined>(undefined);

  const [componentInput, setComponentInput] = useState(filters.component || "");
  const [componentDropdownOpen, setComponentDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const componentInputRef = useRef<HTMLInputElement>(null);
  const componentDropdownRef = useRef<HTMLDivElement>(null);

  const selectedVesselIds = useMemo(() => {
    if (filters.vessels.length === 0 || filters.vessels.length === vessels.length) {
      return vessels.map(v => v.id);
    }
    return filters.vessels;
  }, [filters.vessels, vessels]);

  const { data: componentsRaw = [] } = useQuery<ComponentRecord[]>({
    queryKey: ['/technical/api/components', selectedVesselIds],
    queryFn: async () => {
      const idsToFetch = selectedVesselIds;
      if (idsToFetch.length === 0) return [];
      const results: ComponentRecord[] = [];
      const seen = new Set<string>();
      await Promise.all(
        idsToFetch.map(async (vid) => {
          try {
            const res = await fetch(`/technical/api/components/${vid}`, { credentials: 'include' });
            if (!res.ok) return;
            const data: ComponentRecord[] = await res.json();
            for (const c of data) {
              const key = c.componentCode || c.code || c.name || c.componentName || "";
              if (key && !seen.has(key)) {
                seen.add(key);
                results.push(c);
              }
            }
          } catch { /* skip failed vessel */ }
        })
      );
      return results;
    },
    enabled: selectedVesselIds.length > 0,
  });

  const componentSuggestions = useMemo((): ComponentSuggestion[] => {
    if (!componentInput.trim() || componentInput.length < 2) return [];
    const q = componentInput.toLowerCase();
    return (componentsRaw || [])
      .filter((c: ComponentRecord) => {
        const name = (c.name || c.componentName || "").toLowerCase();
        const code = (c.componentCode || c.code || "").toLowerCase();
        return name.includes(q) || code.includes(q);
      })
      .slice(0, 10)
      .map((c: ComponentRecord) => ({
        id: c.id || c.componentCode || "",
        name: c.name || c.componentName || "",
        code: c.componentCode || c.code || "",
      }));
  }, [componentInput, componentsRaw]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [componentSuggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        componentDropdownRef.current &&
        !componentDropdownRef.current.contains(e.target as Node) &&
        componentInputRef.current &&
        !componentInputRef.current.contains(e.target as Node)
      ) {
        setComponentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleVesselToggle = (vesselId: string) => {
    const current = filters.vessels;
    const next = current.includes(vesselId)
      ? current.filter(v => v !== vesselId)
      : [...current, vesselId];
    onFiltersChange({ ...filters, vessels: next });
  };

  const handleSelectAllVessels = () => {
    if (filters.vessels.length === vessels.length) {
      onFiltersChange({ ...filters, vessels: [] });
    } else {
      onFiltersChange({ ...filters, vessels: vessels.map(v => v.id) });
    }
  };

  const handleDateRangeChange = (from: Date | null, to: Date | null) => {
    onFiltersChange({ ...filters, dateRange: { from, to } });
  };

  const handleComponentSelect = (name: string) => {
    setComponentInput(name);
    setComponentDropdownOpen(false);
    onFiltersChange({ ...filters, component: name });
  };

  const handleComponentInputChange = (val: string) => {
    setComponentInput(val);
    setComponentDropdownOpen(val.length >= 2);
    if (!val.trim()) {
      onFiltersChange({ ...filters, component: "" });
    }
  };

  const handleComponentKeyDown = (e: React.KeyboardEvent) => {
    if (!componentDropdownOpen || componentSuggestions.length === 0) {
      if (e.key === "Enter") {
        onFiltersChange({ ...filters, component: componentInput });
        setComponentDropdownOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, componentSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < componentSuggestions.length) {
        handleComponentSelect(componentSuggestions[highlightedIndex].name);
      } else {
        onFiltersChange({ ...filters, component: componentInput });
        setComponentDropdownOpen(false);
      }
    } else if (e.key === "Escape") {
      setComponentDropdownOpen(false);
    }
  };

  const getVesselSummary = () => {
    if (filters.vessels.length === 0) return "All Vessels";
    if (filters.vessels.length === 1) {
      const v = vessels.find(v => v.id === filters.vessels[0]);
      return v?.name || filters.vessels[0];
    }
    if (filters.vessels.length === vessels.length) return "All Vessels";
    return `${filters.vessels.length} vessels selected`;
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

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.vessels.length > 0 && filters.vessels.length < vessels.length) count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.component) count++;
    return count;
  };

  const filteredVessels = useMemo(() => {
    if (!vesselSearch.trim()) return vessels;
    const q = vesselSearch.toLowerCase();
    return vessels.filter(v => v.name.toLowerCase().includes(q));
  }, [vesselSearch, vessels]);

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-semibold text-blue-600 dark:text-blue-400">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)} data-testid="global-filter-bar">
      <Popover open={vesselPopoverOpen} onOpenChange={setVesselPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={vesselPopoverOpen}
            className="w-[220px] justify-between h-9 text-sm font-normal"
            data-testid="select-vessel-multi"
          >
            <div className="flex items-center gap-2 truncate">
              <Ship className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{getVesselSummary()}</span>
            </div>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Search vessels..."
              value={vesselSearch}
              onChange={(e) => setVesselSearch(e.target.value)}
              className="h-8 text-sm"
              data-testid="input-vessel-search"
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
              onClick={handleSelectAllVessels}
              data-testid="button-select-all-vessels"
            >
              <div className={cn(
                "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0",
                filters.vessels.length === vessels.length || filters.vessels.length === 0
                  ? "bg-primary border-primary"
                  : "border-gray-300 dark:border-gray-600"
              )}>
                {(filters.vessels.length === vessels.length || filters.vessels.length === 0) && (
                  <Check className="h-3 w-3 text-primary-foreground" />
                )}
              </div>
              <span className="font-medium">All Vessels</span>
            </button>
            {filteredVessels.map((vessel) => {
              const isChecked = filters.vessels.includes(vessel.id);
              return (
                <button
                  key={vessel.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                  onClick={() => handleVesselToggle(vessel.id)}
                  data-testid={`checkbox-vessel-${vessel.id}`}
                >
                  <div className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0",
                    isChecked
                      ? "bg-primary border-primary"
                      : "border-gray-300 dark:border-gray-600"
                  )}>
                    {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="truncate">{vessel.name}</span>
                </button>
              );
            })}
            {filteredVessels.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">No vessels found</div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="relative w-[240px]" data-testid="component-search-wrapper">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={componentInputRef}
          placeholder="Search components..."
          value={componentInput}
          onChange={(e) => handleComponentInputChange(e.target.value)}
          onKeyDown={handleComponentKeyDown}
          onFocus={() => { if (componentInput.length >= 2) setComponentDropdownOpen(true); }}
          className="pl-9 h-9 text-sm"
          data-testid="input-component-search"
        />
        {componentInput && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setComponentInput(""); onFiltersChange({ ...filters, component: "" }); setComponentDropdownOpen(false); }}
            data-testid="button-clear-component"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {componentDropdownOpen && componentSuggestions.length > 0 && (
          <div
            ref={componentDropdownRef}
            className="absolute z-50 top-full left-0 mt-1 w-full bg-popover border rounded-md shadow-lg overflow-hidden"
            data-testid="component-suggestions"
          >
            <div className="max-h-[200px] overflow-y-auto p-1">
              {componentSuggestions.map((s, i) => (
                <button
                  key={s.id || i}
                  type="button"
                  className={cn(
                    "w-full flex flex-col items-start px-3 py-2 text-sm rounded transition-colors",
                    i === highlightedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => handleComponentSelect(s.name)}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  data-testid={`suggestion-component-${i}`}
                >
                  <span>{highlightMatch(s.name, componentInput)}</span>
                  {s.code && (
                    <span className="text-xs text-muted-foreground">{highlightMatch(s.code, componentInput)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {componentDropdownOpen && componentInput.length >= 2 && componentSuggestions.length === 0 && selectedVesselIds.length > 0 && (
          <div
            ref={componentDropdownRef}
            className="absolute z-50 top-full left-0 mt-1 w-full bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground text-center"
          >
            No components found
          </div>
        )}
      </div>

      <div className="min-w-[180px]">
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
              data-testid="button-date-range"
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

      {getActiveFiltersCount() > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          data-testid="button-clear-all-filters"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear All
        </Button>
      )}

      {getActiveFiltersCount() > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.vessels.length > 0 && filters.vessels.length < vessels.length && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs py-0.5">
              {getVesselSummary()}
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, vessels: [] })}
                className="ml-0.5 hover:text-foreground"
                data-testid="button-clear-vessel-filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.component && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs py-0.5">
              {filters.component}
              <button
                type="button"
                onClick={() => { setComponentInput(""); onFiltersChange({ ...filters, component: "" }); }}
                className="ml-0.5 hover:text-foreground"
                data-testid="button-clear-component-filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(filters.dateRange.from || filters.dateRange.to) && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs py-0.5">
              {formatDateRange()}
              <button
                type="button"
                onClick={() => handleDateRangeChange(null, null)}
                className="ml-0.5 hover:text-foreground"
                data-testid="button-clear-date-filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalFilters;
