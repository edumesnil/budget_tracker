import { BanknoteIcon, ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type IncomeExpenseCardProps = {
  title: string
  amount: number
  type: "income" | "expense"
  budgetComparison?: {
    amount: number
    isUnder: boolean
  }
  showViewDetails?: boolean
}

export function IncomeExpenseCard({
  title,
  amount,
  type,
  budgetComparison,
  showViewDetails = false,
}: IncomeExpenseCardProps) {
  const colorClass = type === "income" ? "text-income" : "text-expense"
  const bgColorClass = type === "income" ? "bg-income/10" : "bg-expense/10"
  const icon =
    type === "income" ? (
      <ArrowDownIcon className={`h-4 w-4 ${colorClass}`} />
    ) : (
      <ArrowUpIcon className={`h-4 w-4 ${colorClass}`} />
    )

  return (
    <Card className="shadow-sm border border-border/60 hover:border-primary/30 transition-colors duration-200">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-6 h-6 rounded ${bgColorClass}`}>
              <BanknoteIcon className={`h-4 w-4 ${colorClass}`} />
            </div>
            <div className="flex items-center">
              <CardTitle className="text-lg font-medium">{title}</CardTitle>
              <span className="text-xs text-muted-foreground ml-2">vs. Budget</span>
            </div>
          </div>
          <div className={`flex items-center justify-center w-6 h-6 rounded ${bgColorClass}`}>{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>${Math.round(amount)}</div>
        {budgetComparison && (
          <div className={`text-sm mt-1 ${budgetComparison.isUnder ? "text-success" : "text-destructive"}`}>
            {budgetComparison.isUnder ? "↓" : "↑"} ${Math.round(budgetComparison.amount)}{" "}
            {budgetComparison.isUnder ? "Under" : "Over"} budget
          </div>
        )}
        {showViewDetails && (
          <div className="flex justify-between items-center mt-4">
            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${type === "income" ? "bg-income" : "bg-expense"}`}
                style={{
                  width: budgetComparison
                    ? `${Math.min(100, (amount / (amount + budgetComparison.amount)) * 100)}%`
                    : "0%",
                }}
              />
            </div>
            <a href="#" className="text-sm text-muted-foreground ml-4 whitespace-nowrap">
              View Details
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

