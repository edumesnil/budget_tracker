"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MonthlySummaryCards } from "./monthly-summary-cards"
import { BudgetChart } from "./budget-chart"
import { BudgetTable } from "./budget-table"
import type { BudgetWithActual } from "@/hooks/use-budget"

type MonthlyBudgetViewProps = {
  budgetWithActuals: BudgetWithActual[]
  monthlySummary: {
    budgetIncome: number
    budgetExpense: number
    actualIncome: number
    actualExpense: number
    netBudget: number
    netActual: number
  }
  selectedMonth: number
  selectedYear: number
  onEditBudget: (budget: any) => void
  onDeleteBudget: (budget: any) => void
}

export function MonthlyBudgetView({
  budgetWithActuals,
  monthlySummary,
  selectedMonth,
  selectedYear,
  onEditBudget,
  onDeleteBudget,
}: MonthlyBudgetViewProps) {
  const monthNames = [
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

  return (
    <>
      {/* Summary Cards */}
      <MonthlySummaryCards summary={monthlySummary} />

      {/* Budget Chart - fixed height container */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Budget Overview</CardTitle>
          <CardDescription>
            Visual comparison of budget vs. actual for {monthNames[selectedMonth - 1]} {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <div className="h-[300px] w-full">
            <BudgetChart budgetData={budgetWithActuals} month={selectedMonth} year={selectedYear} />
          </div>
        </CardContent>
      </Card>

      {/* Budget Table */}
      <BudgetTable
        budgets={budgetWithActuals}
        monthName={monthNames[selectedMonth - 1]}
        year={selectedYear}
        onEdit={onEditBudget}
        onDelete={onDeleteBudget}
      />
    </>
  )
}

