import { BanknoteIcon, ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MonthlySummary } from "@/hooks/use-budget"

type MonthlySummaryCardsProps = {
  summary: MonthlySummary
}

export function MonthlySummaryCards({ summary }: MonthlySummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="shadow-sm border border-border/60 hover:border-primary/30 transition-colors duration-200">
        <CardHeader
          rightContent={
            <div className="flex items-center justify-center w-6 h-6 rounded bg-income/10">
              <ArrowDownIcon className="h-4 w-4 text-income" />
            </div>
          }
          className="pb-2"
        >
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-income/10">
              <BanknoteIcon className="h-4 w-4 text-income" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Budgeted Income</CardTitle>
            <span className="text-xs text-muted-foreground ml-1">vs. Budget</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-income">${Math.round(summary.budgetIncome)}</div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border border-border/60 hover:border-primary/30 transition-colors duration-200">
        <CardHeader
          rightContent={
            <div className="flex items-center justify-center w-6 h-6 rounded bg-income/10">
              <ArrowDownIcon className="h-4 w-4 text-income" />
            </div>
          }
          className="pb-2"
        >
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-income/10">
              <BanknoteIcon className="h-4 w-4 text-income" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Actual Income</CardTitle>
            <span className="text-xs text-muted-foreground ml-1">vs. Budget</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-income">${Math.round(summary.actualIncome)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {summary.budgetIncome > 0
              ? `${Math.round((summary.actualIncome / summary.budgetIncome) * 100)}% of budget`
              : "No income budget set"}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border border-border/60 hover:border-primary/30 transition-colors duration-200">
        <CardHeader
          rightContent={
            <div className="flex items-center justify-center w-6 h-6 rounded bg-expense/10">
              <ArrowUpIcon className="h-4 w-4 text-expense" />
            </div>
          }
          className="pb-2"
        >
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-expense/10">
              <BanknoteIcon className="h-4 w-4 text-expense" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Budgeted Expenses</CardTitle>
            <span className="text-xs text-muted-foreground ml-1">vs. Budget</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-expense">${Math.round(summary.budgetExpense)}</div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border border-border/60 hover:border-primary/30 transition-colors duration-200">
        <CardHeader
          rightContent={
            <div className="flex items-center justify-center w-6 h-6 rounded bg-expense/10">
              <ArrowUpIcon className="h-4 w-4 text-expense" />
            </div>
          }
          className="pb-2"
        >
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-expense/10">
              <BanknoteIcon className="h-4 w-4 text-expense" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Actual Expenses</CardTitle>
            <span className="text-xs text-muted-foreground ml-1">vs. Budget</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-expense">${Math.round(summary.actualExpense)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {summary.budgetExpense > 0
              ? `${Math.round((summary.actualExpense / summary.budgetExpense) * 100)}% of budget`
              : "No expense budget set"}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

