import { cn } from "@/lib/utils"

type CategoryBadgeProps = {
  type: "INCOME" | "EXPENSE" | null
  className?: string
}

export function CategoryBadge({ type, className }: CategoryBadgeProps) {
  if (!type) return null

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium",
        type === "INCOME" ? "bg-income/10 text-income" : "bg-expense/10 text-expense/90",
        className,
      )}
    >
      {type === "INCOME" ? "Income" : "Expense"}
    </span>
  )
}

