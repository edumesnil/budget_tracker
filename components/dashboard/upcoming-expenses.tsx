"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Clock, DollarSign, Eye } from "lucide-react"
import Link from "next/link"

interface UpcomingExpensesProps {
  upcomingExpenses: any[]
}

export function UpcomingExpenses({ upcomingExpenses }: UpcomingExpensesProps) {
  return (
    <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors duration-200">
      <CardHeader className="pb-2">
        <CardTitle>Upcoming Expenses</CardTitle>
        <CardDescription>Bills and payments due soon</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {upcomingExpenses.map((expense) => {
            const dueDate = new Date(expense.dueDate)
            const today = new Date()
            const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

            return (
              <div
                key={expense.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${expense.categoryColor}20`, color: expense.categoryColor }}
                  >
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{expense.description}</div>
                    <div className="text-sm text-muted-foreground">{expense.category}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="font-bold">${Math.round(expense.amount)}</div>
                  <div className="flex items-center text-xs">
                    <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                    <span
                      className={cn(
                        daysUntilDue <= 3
                          ? "text-expense"
                          : daysUntilDue <= 7
                            ? "text-yellow-500"
                            : "text-muted-foreground",
                      )}
                    >
                      {daysUntilDue === 0
                        ? "Due today"
                        : daysUntilDue === 1
                          ? "Due tomorrow"
                          : `Due in ${daysUntilDue} days`}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {upcomingExpenses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/20">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No upcoming expenses</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                You don't have any bills or payments due soon.
              </p>
            </div>
          )}

          <Link href="/dashboard/transactions">
            <Button variant="outline" size="sm" className="w-full mt-2">
              <Eye className="mr-2 h-4 w-4" />
              View All Transactions
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

