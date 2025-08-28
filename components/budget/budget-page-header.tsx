"use client"

import { Button } from "@/components/ui/button"
import { ViewSelector } from "@/components/budget/view-selector"
import { MonthSelector } from "@/components/shared/unified-month-selector"
import { PlusCircle } from "lucide-react"

interface BudgetPageHeaderProps {
  activeView: "monthly" | "annual"
  onViewChange: (view: "monthly" | "annual") => void
  selectedMonth: number
  selectedYear: number
  onMonthChange: (month: number, year: number) => void
  onPrevious: () => void
  onNext: () => void
  onAddBudget: () => void
}

export function BudgetPageHeader({
  activeView,
  onViewChange,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onPrevious,
  onNext,
  onAddBudget,
}: BudgetPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Budget</h1>
        <p className="text-muted-foreground">Manage your monthly and annual budgets</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
        {activeView === "monthly" && (
          <MonthSelector
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={(value) => {
              if (!(value instanceof Date)) {
                onMonthChange(value.month, value.year)
              }
            }}
            monthIndexBase={1}
            showDropdown={true}
          />
        )}

        <div className="flex items-center gap-2 ml-auto">
          <ViewSelector activeView={activeView} onViewChange={onViewChange} />
          <Button onClick={onAddBudget} size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Budget
          </Button>
        </div>
      </div>
    </div>
  )
}

