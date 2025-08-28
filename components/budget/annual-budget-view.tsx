"use client"

import { AnnualSummaryTable } from "./annual-summary-table"
import { BaseBudgetTable } from "./base-budget-table"
import type { Budget, MonthlyBudgetSummary } from "@/hooks/use-budget"

type AnnualBudgetViewProps = {
  annualData: MonthlyBudgetSummary[]
  baseBudgets: Budget[]
  onSelectMonth: (month: number) => void
  onEditBudget: (budget: any) => void
  onDeleteBudget: (budget: any) => void
}

export function AnnualBudgetView({
  annualData,
  baseBudgets,
  onSelectMonth,
  onEditBudget,
  onDeleteBudget,
}: AnnualBudgetViewProps) {
  return (
    <>
      {/* Annual Summary */}
      <AnnualSummaryTable annualData={annualData} onSelectMonth={onSelectMonth} />

      {/* Base Budget Management */}
      <BaseBudgetTable budgets={baseBudgets} onEdit={onEditBudget} onDelete={onDeleteBudget} />
    </>
  )
}

