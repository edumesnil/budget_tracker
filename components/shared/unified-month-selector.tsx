"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { addMonths, subMonths, getMonth, getYear } from "date-fns"

// Default month names
const DEFAULT_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

interface MonthSelectorProps {
  // Support both date object and month/year values
  value: Date | { month: number; year: number }

  // Callback when month changes
  onChange: (value: Date | { month: number; year: number }) => void

  // Optional props for customization
  monthNames?: string[]
  showDropdown?: boolean
  monthIndexBase?: 0 | 1 // 0 for Jan=0, 1 for Jan=1
  showPreviousYearMonths?: boolean
  disableNextButton?: boolean
  className?: string
}

export function MonthSelector({
  value,
  onChange,
  monthNames = DEFAULT_MONTH_NAMES,
  showDropdown = true,
  monthIndexBase = 1,
  showPreviousYearMonths = true,
  disableNextButton = false,
  className = "",
}: MonthSelectorProps) {
  // Convert value to month and year
  const isDateValue = value instanceof Date

  let selectedMonth: number
  let selectedYear: number

  if (isDateValue) {
    selectedMonth = getMonth(value) + monthIndexBase
    selectedYear = getYear(value)
  } else {
    selectedMonth = value.month
    selectedYear = value.year
  }

  // Ensure month is in the correct range based on monthIndexBase
  const normalizedMonth = monthIndexBase === 0 ? selectedMonth : selectedMonth - 1

  // Handle previous month
  const handlePrevious = () => {
    if (isDateValue) {
      onChange(subMonths(value as Date, 1))
    } else {
      let newMonth = selectedMonth - 1
      let newYear = selectedYear

      if (newMonth < monthIndexBase) {
        newMonth = monthIndexBase === 0 ? 11 : 12
        newYear -= 1
      }

      onChange({ month: newMonth, year: newYear })
    }
  }

  // Handle next month
  const handleNext = () => {
    if (isDateValue) {
      onChange(addMonths(value as Date, 1))
    } else {
      let newMonth = selectedMonth + 1
      let newYear = selectedYear

      const maxMonth = monthIndexBase === 0 ? 11 : 12
      if (newMonth > maxMonth) {
        newMonth = monthIndexBase
        newYear += 1
      }

      onChange({ month: newMonth, year: newYear })
    }
  }

  // Handle month/year selection from dropdown
  const handleMonthYearChange = (value: string) => {
    const [month, year] = value.split("-").map(Number)

    if (isDateValue) {
      // For Date objects, we need to create a new Date with the selected month/year
      const currentDate = value as Date
      const newDate = new Date(currentDate)
      newDate.setFullYear(year)
      newDate.setMonth(month - monthIndexBase)
      onChange(newDate)
    } else {
      onChange({ month, year })
    }
  }

  // Get display month name (adjusted for monthIndexBase)
  const getMonthName = (month: number) => {
    const index = monthIndexBase === 0 ? month : month - 1
    return monthNames[index]
  }

  // Simple display with just buttons
  if (!showDropdown) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Button variant="outline" size="icon" onClick={handlePrevious} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-medium min-w-[120px] text-center">
          {getMonthName(selectedMonth)} {selectedYear}
        </div>
        <Button variant="outline" size="icon" onClick={handleNext} disabled={disableNextButton} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Full selector with dropdown
  return (
    <div className={`flex items-center border rounded-md overflow-hidden ${className}`}>
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none border-r" onClick={handlePrevious}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Select value={`${selectedMonth}-${selectedYear}`} onValueChange={handleMonthYearChange}>
        <SelectTrigger className="w-[180px] border-0 rounded-none focus:ring-0 focus:ring-offset-0">
          <SelectValue placeholder="Select month">
            {getMonthName(selectedMonth)} {selectedYear}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Current year months */}
          {Array.from({ length: 12 }, (_, i) => {
            const month = i + monthIndexBase
            return (
              <SelectItem key={i} value={`${month}-${selectedYear}`}>
                {getMonthName(month)} {selectedYear}
              </SelectItem>
            )
          })}

          {/* Previous year months if enabled */}
          {showPreviousYearMonths &&
            Array.from({ length: 12 }, (_, i) => {
              const month = i + monthIndexBase
              return (
                <SelectItem key={i + 12} value={`${month}-${selectedYear - 1}`}>
                  {getMonthName(month)} {selectedYear - 1}
                </SelectItem>
              )
            })}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-none border-l"
        onClick={handleNext}
        disabled={disableNextButton}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

