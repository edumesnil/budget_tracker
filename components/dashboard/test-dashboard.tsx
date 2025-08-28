"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from "lucide-react"
import { useDashboardDataQuery } from "@/hooks/use-dashboard-data-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"

export function TestDashboard() {
  const {
    loading,
    isRefetching,
    error,
    monthlyData,
    categoryPerformance,
    spendingTrend,
    topOverBudgetCategories,
    topUnderBudgetCategories,
    monthOptions,
    selectedDate,
    goToPreviousMonth,
    goToNextMonth,
    handleMonthChange,
    invalidateDashboardData,
  } = useDashboardDataQuery()

  // OPTIMIZATION 5: Enhanced Loading States with Skeleton UI
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Dashboard Data Test (React Query)</h2>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div>
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="mt-4">
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // OPTIMIZATION 5: Enhanced Error States with Retry Button
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Dashboard Data Test (React Query)</h2>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading dashboard data</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit mt-2 flex items-center gap-2"
              onClick={invalidateDashboardData}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard Data Test (React Query)</h2>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`}
            onValueChange={handleMonthChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            disabled={new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1) > new Date()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* OPTIMIZATION 5: Show refetching indicator */}
      {isRefetching && (
        <div className="flex items-center justify-end text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Refreshing data...</span>
        </div>
      )}

      {/* Monthly Summary */}
      {monthlyData && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Summary - {monthlyData.month}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium">Income</h3>
                <p>Actual: ${monthlyData.totalIncome.toFixed(2)}</p>
                <p>Budgeted: ${monthlyData.budgetedIncome.toFixed(2)}</p>
                <p>Variance: ${monthlyData.incomeVariance.toFixed(2)}</p>
                <div className="mt-2">
                  <Progress
                    value={
                      monthlyData.budgetedIncome > 0
                        ? Math.min((monthlyData.totalIncome / monthlyData.budgetedIncome) * 100, 100)
                        : 100
                    }
                    className="h-2"
                  />
                </div>
              </div>
              <div>
                <h3 className="font-medium">Expenses</h3>
                <p>Actual: ${monthlyData.totalExpenses.toFixed(2)}</p>
                <p>Budgeted: ${monthlyData.budgetedExpenses.toFixed(2)}</p>
                <p>Variance: ${monthlyData.expenseVariance.toFixed(2)}</p>
                <div className="mt-2">
                  <Progress
                    value={
                      monthlyData.budgetedExpenses > 0
                        ? Math.min((monthlyData.totalExpenses / monthlyData.budgetedExpenses) * 100, 100)
                        : 100
                    }
                    className="h-2"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-medium">Net Variance</h3>
              <p>${monthlyData.netVariance.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categoryPerformance.slice(0, 5).map((category) => (
              <div key={category.id} className="flex justify-between">
                <span>{category.name}</span>
                <span>
                  ${category.actual.toFixed(2)} / ${category.budgeted.toFixed(2)}({category.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Spending Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Spending Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {spendingTrend.map((item, index) => (
              <div key={index} className="flex justify-between">
                <span>{item.month}</span>
                <span>${(item.amount as number).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Over Budget Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Top Over Budget Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topOverBudgetCategories.map((category) => (
              <div key={category.id} className="flex justify-between">
                <span>{category.name}</span>
                <span>
                  ${category.actual.toFixed(2)} / ${category.budgeted.toFixed(2)}({category.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Under Budget Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Top Under Budget Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topUnderBudgetCategories.map((category) => (
              <div key={category.id} className="flex justify-between">
                <span>{category.name}</span>
                <span>
                  ${category.actual.toFixed(2)} / ${category.budgeted.toFixed(2)}({category.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* OPTIMIZATION 2: Manual refresh button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={invalidateDashboardData}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>
    </div>
  )
}

