import { useState, useMemo, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

type FilterMode = 'year-quarter' | 'year-month' | 'date-range';

export interface PeriodFilterValue {
  mode: FilterMode;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  month?: number; // 1-12
  dateFrom?: Date;
  dateTo?: Date;
}

interface PeriodFilterProps {
  value?: PeriodFilterValue;
  onChange: (value: PeriodFilterValue) => void;
  className?: string;
}

export const PeriodFilter = ({ value, onChange, className }: PeriodFilterProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'year-period' | 'date-range'>(
    value?.mode === 'date-range' ? 'date-range' : 'year-period'
  );
  
  // Current year and month for defaults
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  // Last 4 years, current year at leftmost
  const years = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  }, [currentYear]);

  const quarters = [1, 2, 3, 4] as const;
  const months = [
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

  // Local state for selections
  const [selectedYear, setSelectedYear] = useState(value?.year || currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4 | null>(value?.quarter || null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(value?.month || currentMonth);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(value?.dateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(value?.dateTo);
  const [showDateFromCal, setShowDateFromCal] = useState(false);
  const [showDateToCal, setShowDateToCal] = useState(false);
  const [pendingDateFrom, setPendingDateFrom] = useState<Date | undefined>(undefined);
  const [pendingDateTo, setPendingDateTo] = useState<Date | undefined>(undefined);

  // Sync internal state when value prop changes (e.g., after Clear button)
  useEffect(() => {
    if (value) {
      setMode(value.mode === 'date-range' ? 'date-range' : 'year-period');
      setSelectedYear(value.year || currentYear);
      setSelectedQuarter(value.quarter || null);
      setSelectedMonth(value.month || null);
      setDateFrom(value.dateFrom);
      setDateTo(value.dateTo);
    } else {
      // Reset to defaults when value is undefined/null
      setMode('year-period');
      setSelectedYear(currentYear);
      setSelectedQuarter(null);
      setSelectedMonth(currentMonth);
      setDateFrom(undefined);
      setDateTo(undefined);
    }
  }, [value, currentYear, currentMonth]);

  const handleQuarterClick = (quarter: 1 | 2 | 3 | 4) => {
    setSelectedQuarter(quarter);
    setSelectedMonth(null); // Clear month selection when quarter is selected
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    setSelectedQuarter(null); // Clear quarter selection when month is selected
  };

  const handleApply = () => {
    if (mode === 'year-period') {
      if (selectedQuarter !== null) {
        onChange({
          mode: 'year-quarter',
          year: selectedYear,
          quarter: selectedQuarter,
        });
      } else if (selectedMonth !== null) {
        onChange({
          mode: 'year-month',
          year: selectedYear,
          month: selectedMonth,
        });
      }
    } else {
      onChange({
        mode: 'date-range',
        dateFrom,
        dateTo,
      });
    }
    setOpen(false);
  };

  // Generate display text for the trigger button
  const getDisplayText = () => {
    if (!value) {
      return `${months[currentMonth - 1].label}-${currentYear}`;
    }

    if (value.mode === 'year-quarter' && value.year && value.quarter) {
      return `Q${value.quarter}-${value.year}`;
    }
    
    if (value.mode === 'year-month' && value.year && value.month) {
      return `${months[value.month - 1].label}-${value.year}`;
    }
    
    if (value.mode === 'date-range' && value.dateFrom && value.dateTo) {
      return `${format(value.dateFrom, 'dd/MM/yy')} - ${format(value.dateTo, 'dd/MM/yy')}`;
    }

    return `${months[currentMonth - 1].label}-${currentYear}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-8 w-40 justify-between text-xs text-[#0f172a] bg-white dark:bg-neutral-900 border-gray-300 dark:border-gray-600 ${className}`}
          data-testid="period-filter-trigger"
        >
          <span>{getDisplayText()}</span>
          <Calendar className="h-3 w-3 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-4" align="start" data-testid="period-filter-content">
        <div className="space-y-4">
          {/* Mode Selection */}
          <RadioGroup value={mode} onValueChange={(val) => setMode(val as 'year-period' | 'date-range')}>
            <div className="flex items-center space-x-2 mb-2">
              <RadioGroupItem value="year-period" id="mode-year-period" data-testid="radio-year-period" />
              <Label htmlFor="mode-year-period" className="text-sm font-normal cursor-pointer">
                Year + Quarter/Month
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="date-range" id="mode-date-range" data-testid="radio-date-range" />
              <Label htmlFor="mode-date-range" className="text-sm font-normal cursor-pointer">
                Date Range
              </Label>
            </div>
          </RadioGroup>

          {/* Year + Quarter/Month Mode */}
          {mode === 'year-period' && (
            <div className="space-y-4">
              {/* Year Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Year</Label>
                <div className="grid grid-cols-4 gap-2">
                  {years.map((year) => (
                    <Button
                      key={year}
                      variant={selectedYear === year ? 'default' : 'outline'}
                      className="h-9 text-sm"
                      onClick={() => setSelectedYear(year)}
                      data-testid={`year-button-${year}`}
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Quarter Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Quarter</Label>
                <div className="grid grid-cols-4 gap-2">
                  {quarters.map((quarter) => (
                    <Button
                      key={quarter}
                      variant={selectedQuarter === quarter ? 'default' : 'outline'}
                      className="h-9 text-sm"
                      onClick={() => handleQuarterClick(quarter)}
                      data-testid={`quarter-button-${quarter}`}
                    >
                      Q{quarter}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Month Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Month</Label>
                <div className="grid grid-cols-6 gap-2">
                  {months.map((month) => (
                    <Button
                      key={month.value}
                      variant={selectedMonth === month.value ? 'default' : 'outline'}
                      className="h-9 text-xs"
                      onClick={() => handleMonthClick(month.value)}
                      data-testid={`month-button-${month.label}`}
                    >
                      {month.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Date Range Mode */}
          {mode === 'date-range' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Date From</Label>
                <Popover open={showDateFromCal} onOpenChange={(isOpen) => {
                  setShowDateFromCal(isOpen);
                  if (isOpen) setPendingDateFrom(dateFrom);
                }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left text-xs h-9"
                      data-testid="date-from-trigger"
                    >
                      <Calendar className="mr-2 h-3 w-3" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Select date'}
                    </Button>
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
                        }}
                        data-testid="button-pf-date-from-ok"
                      >
                        OK
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Date To</Label>
                <Popover open={showDateToCal} onOpenChange={(isOpen) => {
                  setShowDateToCal(isOpen);
                  if (isOpen) setPendingDateTo(dateTo);
                }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left text-xs h-9"
                      data-testid="date-to-trigger"
                    >
                      <Calendar className="mr-2 h-3 w-3" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Select date'}
                    </Button>
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
          )}

          {/* Apply Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleApply}
              className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white px-8"
              data-testid="button-apply-period-filter"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
