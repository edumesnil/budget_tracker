"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useDashboardDataQuery } from "@/hooks/use-dashboard-data-query"
import { LoadingState } from "@/components/shared/loading-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"

export function DashboardComparison() {
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Original implementation
  const original = useDashboardData()

  // React Query implementation
  const reactQuery = useDashboardDataQuery(selectedDate)

  // Sync the date between both implementations
  useEffect(() => {
    if (original.selectedDate && original.selectedDate.getTime() !== selectedDate.getTime()) {
      setSelectedDate(original.selectedDate)
    }
  }, [original.selectedDate, selectedDate])

  // Handle month navigation
  const goToPreviousMonth = () => {
    original.goToPreviousMonth()
  }

  const goToNextMonth = () => {
    original.goToNextMonth()
  }

  const handleMonthChange = (value: string) => {
    original.handleMonthChange(value)
    setSelectedDate(new Date(value + "-01"))
  }

  // Force React Query implementation to update when selectedDate changes
  useEffect(() => {
    // This is needed because the React Query implementation needs to know when to refetch
    reactQuery.setSelectedDate(selectedDate)
  }, [selectedDate, reactQuery.setSelectedDate])

  if (original.loading || reactQuery.loading) {
    return <LoadingState />
  }

  // Helper function to check if values are equal (with tolerance for floating point)
  const areEqual = (a: number, b: number): boolean => {
    return Math.abs(a - b) < 0.01
  }

  // Helper function to highlight differences
  const highlightDiff = (a: number, b: number): string => {
    return areEqual(a, b) ? "text-foreground" : "text-red-500 font-bold"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard Implementation Comparison</h2>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select value={format(selectedDate, "yyyy-MM")} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month">{format(selectedDate, "MMMM yyyy")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {original.monthOptions?.map((option) => (
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

      <Tabs defaultValue="monthly">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="spending">Spending Trend</TabsTrigger>
          <TabsTrigger value="overBudget">Over Budget</TabsTrigger>
          <TabsTrigger value="underBudget">Under Budget</TabsTrigger>
        </TabsList>

        {/* Monthly Summary Comparison */}
        <TabsContent value="monthly">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Original Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                {original.monthlyData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-medium">Income</h3>
                        <p>Actual: ${original.monthlyData.totalIncome.toFixed(2)}</p>
                        <p>Budgeted: ${original.monthlyData.budgetedIncome.toFixed(2)}</p>
                        <p>Variance: ${original.monthlyData.incomeVariance.toFixed(2)}</p>
                      </div>
                      <div>
                        <h3 className="font-medium">Expenses</h3>
                        <p>Actual: ${original.monthlyData.totalExpenses.toFixed(2)}</p>
                        <p>Budgeted: ${original.monthlyData.budgetedExpenses.toFixed(2)}</p>
                        <p>Variance: ${original.monthlyData.expenseVariance.toFixed(2)}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium">Net Variance</h3>
                      <p>${original.monthlyData.netVariance.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>React Query Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                {reactQuery.monthlyData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-medium">Income</h3>
                        <p
                          className={highlightDiff(
                            original.monthlyData?.totalIncome || 0,
                            reactQuery.monthlyData.totalIncome,
                          )}
                        >
                          Actual: ${reactQuery.monthlyData.totalIncome.toFixed(2)}
                        </p>
                        <p
                          className={highlightDiff(
                            original.monthlyData?.budgetedIncome || 0,
                            reactQuery.monthlyData.budgetedIncome,
                          )}
                        >
                          Budgeted: ${reactQuery.monthlyData.budgetedIncome.toFixed(2)}
                        </p>
                        <p
                          className={highlightDiff(
                            original.monthlyData?.incomeVariance || 0,
                            reactQuery.monthlyData.incomeVariance,
                          )}
                        >
                          Variance: ${reactQuery.monthlyData.incomeVariance.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-medium">Expenses</h3>
                        <p
                          className={highlightDiff(
                            original.monthlyData?.totalExpenses || 0,
                            reactQuery.monthlyData.totalExpenses,
                          )}
                        >
                          Actual: ${reactQuery.monthlyData.totalExpenses.toFixed(2)}
                        </p>
                        <p
                          className={highlightDiff(
                            original.monthlyData?.budgetedExpenses || 0,
                            reactQuery.monthlyData.budgetedExpenses,
                          )}
                        >
                          Budgeted: ${reactQuery.monthlyData.budgetedExpenses.toFixed(2)}
                        </p>
                        <p
                          className={highlightDiff(
                            original.monthlyData?.expenseVariance || 0,
                            reactQuery.monthlyData.expenseVariance,
                          )}
                        >
                          Variance: ${reactQuery.monthlyData.expenseVariance.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium">Net Variance</h3>
                      <p
                        className={highlightDiff(
                          original.monthlyData?.netVariance || 0,
                          reactQuery.monthlyData.netVariance,
                        )}
                      >
                        ${reactQuery.monthlyData.netVariance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Category Performance Comparison */}
        <TabsContent value="categories">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Original Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {original.categoryPerformance?.slice(0, 10).map((category) => (
                    <div key={category.id} className="flex justify-between">
                      <span>{category.name}</span>
                      <span>
                        ${category.actual.toFixed(2)} / ${category.budgeted.toFixed(2)}({category.percentage.toFixed(0)}
                        %)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>React Query Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {reactQuery.categoryPerformance?.slice(0, 10).map((category) => {
                    // Find matching category in original data
                    const originalCategory = original.categoryPerformance?.find((c) => c.id === category.id)

                    return (
                      <div key={category.id} className="flex justify-between">
                        <span>{category.name}</span>
                        <span
                          className={
                            originalCategory ? highlightDiff(originalCategory.percentage, category.percentage) : ""
                          }
                        >
                          ${category.actual.toFixed(2)} / ${category.budgeted.toFixed(2)}(
                          {category.percentage.toFixed(0)}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Spending Trend Comparison */}
        <TabsContent value="spending">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Original Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {original.spendingTrend?.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{item.month}</span>
                      <span>${(item.amount as number).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>React Query Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reactQuery.spendingTrend?.map((item, index) => {
                    // Find matching month in original data
                    const originalItem = original.spendingTrend?.find((i) => i.month === item.month)

                    return (
                      <div key={index} className="flex justify-between">
                        <span>{item.month}</span>
                        <span
                          className={
                            originalItem ? highlightDiff(originalItem.amount as number, item.amount as number) : ""
                          }
                        >
                          ${(item.amount as number).toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Over Budget Categories Comparison */}
        <TabsContent value="overBudget">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Original Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {original.topOverBudgetCategories?.map((category) => (
                    <div key={category.id} className="flex justify-between">
                      <span>{category.name}</span>
                      <span>
                        ${category.actual.toFixed(2)} / ${category.budgeted.toFixed(2)}({category.percentage.toFixed(0)}
                        %)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>React Query Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reactQuery.topOverBudgetCategories?.map((category) => {
                    // Find matching category in original data
                    const originalCategory = original.topOverBudgetCategories?.find((c) => c.id === category.id)

                    return (
                      <div key={category.id} className="flex justify-between">
                        <span>{category.name}</span>
                        <span
                          className={
                            originalCategory ? highlightDiff(originalCategory.percentage, category.percentage) : ""
                          }
                        >
                          ${category.actual.toFixed(2)} / ${category.budgeted.toFixed(2)}(
                          {category.percentage.toFixed(0)}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Under Budget Categories Comparison */}
        <TabsContent value="underBudget">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Original Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {original.topUnderBudgetCategories?.map((category) => (
                    <div key={category.id} className="flex justify-between">
                      <span>{category.name}</span>
                      <span>
                        ${category.actual.toFixed(2)} / ${category.budgeted.toFixed(2)}({category.percentage.toFixed(0)}
                        %)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>React Query Implementation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reactQuery.topUnderBudgetCategories?.map((category) => {
                    // Find matching category in original data
                    const originalCategory = original.topUnderBudgetCategories?.find((c) => c.id === category.id)

                    return (
                      <div key={category.id} className="flex justify-between">
                        <span>{category.name}</span>
                        <span
                          className={
                            originalCategory ? highlightDiff(originalCategory.percentage, category.percentage) : ""
                          }
                        >
                          ${category.actual.toFixed(2)} / ${category.budgeted.toFixed(2)}(
                          {category.percentage.toFixed(0)}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

