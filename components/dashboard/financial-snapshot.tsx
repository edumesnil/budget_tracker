import { IncomeExpenseCard } from "./income-expense-card"

type FinancialSnapshotProps = {
  currentMonthIncome: number
  currentMonthExpenses: number
  budgetIncome: number
  budgetExpenses: number
}

export function FinancialSnapshot({
  currentMonthIncome,
  currentMonthExpenses,
  budgetIncome,
  budgetExpenses,
}: FinancialSnapshotProps) {
  const incomeDifference = budgetIncome - currentMonthIncome
  const expenseDifference = budgetExpenses - currentMonthExpenses

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <IncomeExpenseCard
        title="Income"
        amount={currentMonthIncome}
        type="income"
        budgetComparison={{
          amount: Math.abs(incomeDifference),
          isUnder: incomeDifference > 0,
        }}
        showViewDetails={true}
      />
      <IncomeExpenseCard
        title="Expenses"
        amount={currentMonthExpenses}
        type="expense"
        budgetComparison={{
          amount: Math.abs(expenseDifference),
          isUnder: expenseDifference > 0,
        }}
        showViewDetails={true}
      />
    </div>
  )
}

