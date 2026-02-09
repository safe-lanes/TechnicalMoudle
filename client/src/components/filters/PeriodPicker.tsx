import { useState, useCallback, useRef, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type PeriodMode = "yearQuarterMonth" | "dateRange";

interface PeriodValue {
  mode: PeriodMode;
  year?: number;
  quarter?: number;
  month?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

interface PeriodPickerProps {
  value?: PeriodValue | null;
  onChange: (value: PeriodValue | null) => void;
  className?: string;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_FULL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDisplayValue(value: PeriodValue | null | undefined): string {
  if (!value) return "";

  if (value.mode === "yearQuarterMonth") {
    if (value.month !== undefined && value.year) {
      return `${MONTHS[value.month]}-${value.year}`;
    }
    if (value.quarter !== undefined && value.year) {
      return `Q${value.quarter}-${value.year}`;
    }
    if (value.year) {
      return `${value.year}`;
    }
    return "";
  }

  if (value.mode === "dateRange") {
    if (value.dateFrom && value.dateTo) {
      const fmt = (d: Date) => `${d.getDate().toString().padStart(2, "0")} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
      return `${fmt(value.dateFrom)} - ${fmt(value.dateTo)}`;
    }
    if (value.dateFrom) {
      const d = value.dateFrom;
      return `From ${d.getDate().toString().padStart(2, "0")} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
    }
    return "";
  }

  return "";
}

export function PeriodPicker({ value, onChange, className }: PeriodPickerProps) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PeriodMode>("yearQuarterMonth");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showDateFromCal, setShowDateFromCal] = useState(false);
  const [showDateToCal, setShowDateToCal] = useState(false);

  useEffect(() => {
    if (open) {
      if (value) {
        setMode(value.mode);
        if (value.mode === "yearQuarterMonth") {
          setSelectedYear(value.year || currentYear);
          setSelectedQuarter(value.quarter);
          setSelectedMonth(value.month);
        } else {
          setDateFrom(value.dateFrom);
          setDateTo(value.dateTo);
        }
      } else {
        setMode("yearQuarterMonth");
        setSelectedYear(currentYear);
        setSelectedQuarter(undefined);
        setSelectedMonth(undefined);
        setDateFrom(undefined);
        setDateTo(undefined);
      }
      setShowDateFromCal(false);
      setShowDateToCal(false);
    }
  }, [open, value, currentYear]);

  const canApply = mode === "yearQuarterMonth" || (mode === "dateRange" && (!!dateFrom || !!dateTo));

  const handleApply = useCallback(() => {
    if (mode === "yearQuarterMonth") {
      onChange({
        mode,
        year: selectedYear,
        quarter: selectedQuarter,
        month: selectedMonth,
      });
    } else {
      if (dateFrom || dateTo) {
        onChange({
          mode,
          dateFrom,
          dateTo,
        });
      } else {
        onChange(null);
      }
    }
    setOpen(false);
  }, [mode, selectedYear, selectedQuarter, selectedMonth, dateFrom, dateTo, onChange]);

  const handleMonthClick = (monthIndex: number) => {
    setSelectedMonth(prev => prev === monthIndex ? undefined : monthIndex);
    setSelectedQuarter(undefined);
  };

  const handleQuarterClick = (q: number) => {
    setSelectedQuarter(prev => prev === q ? undefined : q);
    setSelectedMonth(undefined);
  };

  const displayValue = formatDisplayValue(value);

  const formatDateForInput = (d: Date | undefined) => {
    if (!d) return "";
    return `${d.getDate().toString().padStart(2, "0")} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-transparent text-xs cursor-pointer hover-elevate ${className || ""}`}
          data-testid="button-period-picker"
        >
          <span className={`flex-1 text-left truncate ${displayValue ? "text-foreground" : "text-muted-foreground"}`}>
            {displayValue || "Period"}
          </span>
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-4"
        align="start"
        data-testid="period-picker-popup"
      >
        <RadioGroup
          value={mode}
          onValueChange={(val) => {
            setMode(val as PeriodMode);
            setShowDateFromCal(false);
            setShowDateToCal(false);
          }}
          className="gap-3 mb-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yearQuarterMonth" id="period-yqm" data-testid="radio-year-quarter-month" />
            <Label htmlFor="period-yqm" className="text-sm font-medium cursor-pointer">Year + Quarter/Month</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dateRange" id="period-dr" data-testid="radio-date-range" />
            <Label htmlFor="period-dr" className="text-sm font-medium cursor-pointer">Date Range</Label>
          </div>
        </RadioGroup>

        {mode === "yearQuarterMonth" && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Year</div>
              <div className="flex gap-2">
                {years.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className={`flex-1 h-8 rounded-md border text-xs font-medium transition-colors ${
                      selectedYear === yr
                        ? "bg-[#1a2b4a] text-white border-[#1a2b4a]"
                        : "bg-background text-foreground border-input hover-elevate"
                    }`}
                    data-testid={`button-year-${yr}`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Quarter</div>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleQuarterClick(q)}
                    className={`flex-1 h-8 rounded-md border text-xs font-medium transition-colors ${
                      selectedQuarter === q
                        ? "bg-[#1a2b4a] text-white border-[#1a2b4a]"
                        : "bg-background text-foreground border-input hover-elevate"
                    }`}
                    data-testid={`button-quarter-q${q}`}
                  >
                    Q{q}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Month</div>
              <div className="grid grid-cols-6 gap-2">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMonthClick(i)}
                    className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                      selectedMonth === i
                        ? "bg-[#1a2b4a] text-white border-[#1a2b4a]"
                        : "bg-background text-foreground border-input hover-elevate"
                    }`}
                    data-testid={`button-month-${m.toLowerCase()}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === "dateRange" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Date From</div>
                <Popover open={showDateFromCal} onOpenChange={setShowDateFromCal}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full h-8 px-2 rounded-md border border-input bg-background text-xs cursor-pointer"
                      data-testid="button-date-from"
                    >
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className={dateFrom ? "text-foreground" : "text-muted-foreground"}>
                        {dateFrom ? formatDateForInput(dateFrom) : "Select date"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => {
                        setDateFrom(d || undefined);
                        setShowDateFromCal(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Date To</div>
                <Popover open={showDateToCal} onOpenChange={setShowDateToCal}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full h-8 px-2 rounded-md border border-input bg-background text-xs cursor-pointer"
                      data-testid="button-date-to"
                    >
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className={dateTo ? "text-foreground" : "text-muted-foreground"}>
                        {dateTo ? formatDateForInput(dateTo) : "Select date"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => {
                        setDateTo(d || undefined);
                        setShowDateToCal(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button
            size="sm"
            className="bg-[#1a3a7a] text-white text-xs px-6"
            onClick={handleApply}
            disabled={!canApply}
            data-testid="button-period-apply"
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type { PeriodValue };
