"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { ArrowDownRight, ArrowUpRight, Banknote, HelpCircle, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FinancialOverviewProps {
  monthlyData: {
    totalIncome: number
    totalExpenses: number
    budgetedIncome: number
    budgetedExpenses: number
    incomeVariance: number
    expenseVariance: number
    netVariance: number
    month: string
  }
}

export function FinancialOverview({ monthlyData }: FinancialOverviewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left Column - Monthly Summary Card */}
      <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors duration-200">
        <CardHeader className="pb-2">
          <CardTitle>Monthly Summary</CardTitle>
          <CardDescription>Income vs. expenses for {monthlyData?.month}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col min-h-[300px]">
          {/* Main content area with fixed height to ensure consistent layout */}
          <div className="flex-1 flex flex-col items-center justify-center py-10">
            <div
              className={cn(
                "text-4xl font-bold flex items-center",
                monthlyData?.totalIncome >= monthlyData?.totalExpenses ? "text-income" : "text-expense",
              )}
            >
              {monthlyData?.totalIncome >= monthlyData?.totalExpenses ? (
                <ArrowUpRight className="mr-2 h-6 w-6" />
              ) : (
                <ArrowDownRight className="mr-2 h-6 w-6" />
              )}
              ${Math.round(Math.abs(monthlyData?.totalIncome - monthlyData?.totalExpenses))}
            </div>
            <span className="text-sm text-muted-foreground mt-2">Net Income</span>
          </div>

          {/* Budget Variance section */}
          <div className="border-t border-border/60 pt-4 pb-4">
            <div className="flex justify-between items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center">
                    <span className="text-sm font-medium">Budget Variance</span>
                    <HelpCircle className="h-3 w-3 ml-1 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      The difference between your actual net income and your budgeted net income for this month.
                      Positive means you're performing better than planned.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span
                className={cn(
                  "text-sm font-medium flex items-center",
                  monthlyData?.netVariance >= 0 ? "text-income" : "text-expense",
                )}
              >
                {monthlyData?.netVariance >= 0 ? (
                  <TrendingUp className="mr-1 h-4 w-4" />
                ) : (
                  <TrendingDown className="mr-1 h-4 w-4" />
                )}
                {monthlyData?.netVariance >= 0 ? "+" : ""}${Math.round(Math.abs(monthlyData?.netVariance))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right Column - Income and Expense Cards */}
      <div className="space-y-6">
        {/* Income Card */}
        <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors duration-200">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-income/10">
                  <Banknote className="h-4 w-4 text-income" />
                </div>
                <div className="flex items-center">
                  <CardTitle className="text-lg font-medium text-foreground">Income</CardTitle>
                  <span className="text-xs text-muted-foreground ml-1 self-baseline mt-1">vs. Budget</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <div className="text-3xl font-medium">${Math.round(monthlyData?.totalIncome)}</div>
              <div className="flex items-center mt-2">
                <div
                  className={cn(
                    "mr-auto flex items-center text-sm font-medium",
                    monthlyData?.incomeVariance >= 0 ? "text-income" : "text-expense",
                  )}
                >
                  {monthlyData?.incomeVariance >= 0 ? (
                    <ArrowUpRight className="mr-1 h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="mr-1 h-4 w-4" />
                  )}
                  ${Math.round(Math.abs(monthlyData?.incomeVariance))}{" "}
                  {monthlyData?.incomeVariance >= 0 ? "Over" : "Under"} budget
                </div>
                <Link href="/dashboard/budget" className="text-sm text-muted-foreground hover:underline">
                  View Details
                </Link>
              </div>
              <Progress
                value={
                  monthlyData?.budgetedIncome > 0
                    ? Math.min((monthlyData?.totalIncome / monthlyData?.budgetedIncome) * 100, 100)
                    : 100
                }
                className="h-2 mt-2"
                indicatorClassName={
                  monthlyData?.totalIncome >= monthlyData?.budgetedIncome ? "bg-income" : "bg-expense"
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Expenses Card */}
        <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors duration-200">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-expense/10">
                  <Banknote className="h-4 w-4 text-expense" />
                </div>
                <div className="flex items-center">
                  <CardTitle className="text-lg font-medium text-foreground">Expenses</CardTitle>
                  <span className="text-xs text-muted-foreground ml-1 self-baseline mt-1">vs. Budget</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <div className="text-3xl font-medium">${Math.round(monthlyData?.totalExpenses)}</div>
              <div className="flex items-center mt-2">
                <div
                  className={cn(
                    "mr-auto flex items-center text-sm font-medium",
                    monthlyData?.expenseVariance >= 0 ? "text-income" : "text-expense",
                  )}
                >
                  {monthlyData?.expenseVariance >= 0 ? (
                    <ArrowUpRight className="mr-1 h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="mr-1 h-4 w-4" />
                  )}
                  ${Math.round(Math.abs(monthlyData?.expenseVariance))}{" "}
                  {monthlyData?.expenseVariance >= 0 ? "Under" : "Over"} budget
                </div>
                <Link href="/dashboard/budget" className="text-sm text-muted-foreground hover:underline">
                  View Details
                </Link>
              </div>
              <Progress
                value={
                  monthlyData?.budgetedExpenses > 0
                    ? Math.min((monthlyData?.totalExpenses / monthlyData?.budgetedExpenses) * 100, 100)
                    : 100
                }
                className="h-2 mt-2"
                indicatorClassName={
                  monthlyData?.totalExpenses <= monthlyData?.budgetedExpenses ? "bg-income" : "bg-expense"
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

