"use client"
import { CalendarIcon } from "lucide-react"
import { addDays, format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  className?: string
}

export function DateRangePicker({ dateRange, onDateRangeChange, className }: DateRangePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn("w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
          />
          <div className="flex justify-between p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onDateRangeChange({
                  from: new Date(),
                  to: new Date(),
                })
              }
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onDateRangeChange({
                  from: addDays(new Date(), -7),
                  to: new Date(),
                })
              }
            >
              Last 7 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onDateRangeChange({
                  from: addDays(new Date(), -30),
                  to: new Date(),
                })
              }
            >
              Last 30 days
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
