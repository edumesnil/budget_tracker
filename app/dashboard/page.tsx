"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { MonthSelector } from "@/components/shared/unified-month-selector"
import { FinancialOverview } from "@/components/dashboard/financial-overview"
import { CategoryPerformance } from "@/components/dashboard/category-performance"
import { SpendingTrend } from "@/components/dashboard/spending-trend"
import { UpcomingExpenses } from "@/components/dashboard/upcoming-expenses"

export default function DashboardPage() {
  const {
    loading,
    error,
    selectedDate,
    monthOptions,
    goToPreviousMonth,
    goToNextMonth,
    handleMonthChange,
    monthlyData,
    topOverBudgetCategories,
    topUnderBudgetCategories,
    spendingTrend,
    upcomingExpenses,
  } = useDashboardData()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  const currentDate = new Date()
  const isNextDisabled = format(selectedDate, "yyyy-MM") === format(currentDate, "yyyy-MM")

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Financial Dashboard</h1>

        {/* Month selector - using the same style as budget page */}
        <MonthSelector
          value={selectedDate}
          onChange={(value) => {
            if (value instanceof Date) {
              handleMonthChange(format(value, "yyyy-MM"))
            }
          }}
          showDropdown={true}
          disableNextButton={isNextDisabled}
        />
      </div>

      {/* 1. Financial Overview Section */}
      {monthlyData && <FinancialOverview monthlyData={monthlyData} />}

      {/* 2. Category Performance Panel */}
      <CategoryPerformance
        topOverBudgetCategories={topOverBudgetCategories}
        topUnderBudgetCategories={topUnderBudgetCategories}
      />

      {/* 3. Spending Trend Visualization */}
      <SpendingTrend spendingTrend={spendingTrend} />

      {/* 4. Upcoming Expenses Forecast */}
      <UpcomingExpenses upcomingExpenses={upcomingExpenses} />
    </div>
  )
}

