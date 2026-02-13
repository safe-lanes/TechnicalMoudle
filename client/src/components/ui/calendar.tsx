import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, CaptionProps, useNavigation } from "react-day-picker"
import { setMonth, setYear } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function CustomCaption({ displayMonth, displayIndex }: CaptionProps) {
  const { goToMonth } = useNavigation()
  const index = displayIndex ?? 0

  const currentYear = new Date().getFullYear()
  const yearRange: number[] = []
  for (let y = currentYear - 10; y <= currentYear + 10; y++) {
    yearRange.push(y)
  }

  const navigateToMonth = (targetDate: Date) => {
    const adjusted = new Date(targetDate)
    adjusted.setMonth(adjusted.getMonth() - index)
    goToMonth(adjusted)
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10)
    navigateToMonth(setMonth(displayMonth, newMonth))
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10)
    navigateToMonth(setYear(displayMonth, newYear))
  }

  return (
    <div className="flex items-center justify-between gap-1 px-1">
      <button
        type="button"
        onClick={() => {
          const prev = new Date(displayMonth)
          prev.setMonth(prev.getMonth() - 1)
          navigateToMonth(prev)
        }}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        )}
        data-testid="button-calendar-prev-month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1">
        <select
          value={displayMonth.getMonth()}
          onChange={handleMonthChange}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          data-testid="select-calendar-month"
        >
          {MONTHS.map((month, i) => (
            <option key={month} value={i}>{month}</option>
          ))}
        </select>

        <select
          value={displayMonth.getFullYear()}
          onChange={handleYearChange}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          data-testid="select-calendar-year"
        >
          {yearRange.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => {
          const next = new Date(displayMonth)
          next.setMonth(next.getMonth() + 1)
          navigateToMonth(next)
        }}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        )}
        data-testid="button-calendar-next-month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden",
        nav: "hidden",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
