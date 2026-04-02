import { useState, useMemo, useEffect, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

type FilterMode = 'year-only' | 'year-quarter' | 'year-months' | 'date-range';

export interface PeriodFilterValue {
  mode: FilterMode;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  months?: number[];
  dateFrom?: Date;
  dateTo?: Date;
}

interface PeriodFilterProps {
  value?: PeriodFilterValue | null;
  onChange: (value: PeriodFilterValue | null) => void;
  className?: string;
}

const MONTHS = [
  { value: 1, label: 'JAN' },
  { value: 2, label: 'FEB' },
  { value: 3, label: 'MAR' },
  { value: 4, label: 'APR' },
  { value: 5, label: 'MAY' },
  { value: 6, label: 'JUN' },
  { value: 7, label: 'JUL' },
  { value: 8, label: 'AUG' },
  { value: 9, label: 'SEP' },
  { value: 10, label: 'OCT' },
  { value: 11, label: 'NOV' },
  { value: 12, label: 'DEC' },
];

function getDisplayText(value: PeriodFilterValue | null | undefined): string {
  if (!value) return '';

  if (value.mode === 'year-only' && value.year) {
    return `${value.year}`;
  }

  if (value.mode === 'year-quarter' && value.year && value.quarter) {
    return `${value.year} / Q${value.quarter}`;
  }

  if (value.mode === 'year-months' && value.year && value.months && value.months.length > 0) {
    const sorted = [...value.months].sort((a, b) => a - b);
    if (sorted.length <= 3) {
      const labels = sorted.map(m => MONTHS[m - 1].label);
      return `${labels.join(', ')} - ${value.year}`;
    }
    return `${sorted.length} months - ${value.year}`;
  }

  if (value.mode === 'date-range' && value.dateFrom && value.dateTo) {
    return `${format(value.dateFrom, 'dd/MM/yy')} - ${format(value.dateTo, 'dd/MM/yy')}`;
  }

  return '';
}

export const PeriodFilter = ({ value, onChange, className }: PeriodFilterProps) => {
  const currentYear = new Date().getFullYear();

  const years = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  }, [currentYear]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'year-period' | 'date-range'>('year-period');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4 | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showDateFromCal, setShowDateFromCal] = useState(false);
  const [showDateToCal, setShowDateToCal] = useState(false);
  const [pendingDateFrom, setPendingDateFrom] = useState<Date | undefined>(undefined);
  const [pendingDateTo, setPendingDateTo] = useState<Date | undefined>(undefined);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (value) {
        setMode(value.mode === 'date-range' ? 'date-range' : 'year-period');
        if (value.mode === 'date-range') {
          setDateFrom(value.dateFrom);
          setDateTo(value.dateTo);
        } else {
          setSelectedYear(value.year || currentYear);
          setSelectedQuarter(value.quarter || null);
          setSelectedMonths(value.months || []);
        }
      } else {
        setMode('year-period');
        setSelectedYear(currentYear);
        setSelectedQuarter(null);
        setSelectedMonths([]);
        setDateFrom(undefined);
        setDateTo(undefined);
      }
      setDateRangeError(null);
      setShowDateFromCal(false);
      setShowDateToCal(false);
    }
  }, [open, value, currentYear]);

  const handleQuarterClick = (quarter: 1 | 2 | 3 | 4) => {
    setSelectedQuarter(prev => prev === quarter ? null : quarter);
    setSelectedMonths([]);
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        return prev.filter(m => m !== month);
      }
      return [...prev, month];
    });
    setSelectedQuarter(null);
  };

  const canApply = useMemo(() => {
    if (mode === 'year-period') {
      return true;
    }
    if (mode === 'date-range') {
      return !!dateFrom && !!dateTo;
    }
    return false;
  }, [mode, dateFrom, dateTo]);

  const handleApply = useCallback(() => {
    if (mode === 'date-range') {
      if (!dateFrom || !dateTo) {
        setDateRangeError('Both dates are required');
        return;
      }
      if (dateTo < dateFrom) {
        setDateRangeError('Date To cannot be earlier than Date From');
        return;
      }
      setDateRangeError(null);
      onChange({
        mode: 'date-range',
        dateFrom,
        dateTo,
      });
    } else {
      if (selectedQuarter !== null) {
        onChange({
          mode: 'year-quarter',
          year: selectedYear,
          quarter: selectedQuarter,
        });
      } else if (selectedMonths.length > 0) {
        onChange({
          mode: 'year-months',
          year: selectedYear,
          months: [...selectedMonths].sort((a, b) => a - b),
        });
      } else {
        onChange({
          mode: 'year-only',
          year: selectedYear,
        });
      }
    }
    setOpen(false);
  }, [mode, selectedYear, selectedQuarter, selectedMonths, dateFrom, dateTo, onChange]);

  const displayValue = getDisplayText(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 h-[32px] px-3 rounded-md border border-gray-300 bg-white dark:bg-neutral-900 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors ${className || ''}`}
          data-testid="period-filter-trigger"
        >
          <span className={`flex-1 text-left truncate ${displayValue ? 'text-[#0f172a] dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
            {displayValue || 'Period'}
          </span>
          <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-4"
        align="start"
        data-testid="period-filter-content"
      >
        <RadioGroup
          value={mode}
          onValueChange={(val) => {
            setMode(val as 'year-period' | 'date-range');
            setDateRangeError(null);
            setShowDateFromCal(false);
            setShowDateToCal(false);
          }}
          className="gap-3 mb-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="year-period" id="pf-mode-year-period" data-testid="radio-year-period" />
            <Label htmlFor="pf-mode-year-period" className="text-sm font-medium cursor-pointer">
              Year + Quarter/Month
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="date-range" id="pf-mode-date-range" data-testid="radio-date-range" />
            <Label htmlFor="pf-mode-date-range" className="text-sm font-medium cursor-pointer">
              Date Range
            </Label>
          </div>
        </RadioGroup>

        {mode === 'year-period' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Year</div>
              <div className="flex gap-2">
                {years.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className={`flex-1 h-8 rounded-md border text-xs font-medium transition-colors ${
                      selectedYear === yr
                        ? 'bg-[#1a2b4a] text-white border-[#1a2b4a]'
                        : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                    data-testid={`year-button-${yr}`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Quarter</div>
              <div className="flex gap-2">
                {([1, 2, 3, 4] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleQuarterClick(q)}
                    className={`flex-1 h-8 rounded-md border text-xs font-medium transition-colors ${
                      selectedQuarter === q
                        ? 'bg-[#1a2b4a] text-white border-[#1a2b4a]'
                        : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                    data-testid={`quarter-button-${q}`}
                  >
                    Q{q}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Month</div>
              <div className="grid grid-cols-6 gap-2">
                {MONTHS.map((month) => (
                  <button
                    key={month.value}
                    type="button"
                    onClick={() => handleMonthClick(month.value)}
                    className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                      selectedMonths.includes(month.value)
                        ? 'bg-[#1a2b4a] text-white border-[#1a2b4a]'
                        : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                    data-testid={`month-button-${month.label}`}
                  >
                    {month.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === 'date-range' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Date From</div>
                <Popover open={showDateFromCal} onOpenChange={(isOpen) => {
                  setShowDateFromCal(isOpen);
                  if (isOpen) setPendingDateFrom(dateFrom);
                }}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full h-8 px-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-900 text-xs cursor-pointer"
                      data-testid="date-from-trigger"
                    >
                      <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className={dateFrom ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}>
                        {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'Select date'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
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
                        onClick={() => setShowDateFromCal(false)}
                        data-testid="button-pf-date-from-cancel"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setDateFrom(pendingDateFrom);
                          setShowDateFromCal(false);
                          setDateRangeError(null);
                        }}
                        data-testid="button-pf-date-from-ok"
                      >
                        OK
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Date To</div>
                <Popover open={showDateToCal} onOpenChange={(isOpen) => {
                  setShowDateToCal(isOpen);
                  if (isOpen) setPendingDateTo(dateTo);
                }}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full h-8 px-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-900 text-xs cursor-pointer"
                      data-testid="date-to-trigger"
                    >
                      <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className={dateTo ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}>
                        {dateTo ? format(dateTo, 'dd MMM yyyy') : 'Select date'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
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
                        onClick={() => setShowDateToCal(false)}
                        data-testid="button-pf-date-to-cancel"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setDateTo(pendingDateTo);
                          setShowDateToCal(false);
                          setDateRangeError(null);
                        }}
                        data-testid="button-pf-date-to-ok"
                      >
                        OK
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {dateRangeError && (
              <p className="text-xs text-red-500" data-testid="date-range-error">{dateRangeError}</p>
            )}
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button
            size="sm"
            className="bg-[#1a3a7a] hover:bg-[#15306a] text-white text-xs px-6"
            onClick={handleApply}
            disabled={!canApply}
            data-testid="button-apply-period-filter"
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
