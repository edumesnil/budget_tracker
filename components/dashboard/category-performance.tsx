"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CategoryIcon } from "@/components/category-icon"
import { cn } from "@/lib/utils"
import { Eye, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"

interface CategoryPerformanceProps {
  topOverBudgetCategories: any[]
  topUnderBudgetCategories: any[]
}

export function CategoryPerformance({ topOverBudgetCategories, topUnderBudgetCategories }: CategoryPerformanceProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Over Budget Categories */}
      <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors duration-200">
        <CardHeader className="pb-2">
          <CardTitle>Top Overspending Categories</CardTitle>
          <CardDescription>Categories exceeding their budgets</CardDescription>
        </CardHeader>
        <CardContent>
          {topOverBudgetCategories.length > 0 ? (
            <div className="space-y-4">
              {topOverBudgetCategories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CategoryIcon icon={category.icon} color={category.color} size={16} />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="text-sm font-medium text-expense">
                      {category.percentage > 100 && `+${Math.round(category.percentage - 100)}%`}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      ${category.actual.toFixed(2)} of ${category.budgeted.toFixed(2)}
                    </span>
                    <span className="text-expense">${Math.abs(category.variance).toFixed(2)} over</span>
                  </div>
                  <Progress
                    value={Math.min(category.percentage, 100)}
                    className="h-2"
                    indicatorClassName={cn(
                      "transition-all duration-300",
                      category.percentage > 100
                        ? "bg-expense"
                        : category.percentage > 85
                          ? "bg-yellow-500"
                          : "bg-income",
                    )}
                  />
                </div>
              ))}
              <Link href="/dashboard/budget">
                <Button variant="outline" size="sm" className="w-full mt-2">
                  <Eye className="mr-2 h-4 w-4" />
                  View Full Budget
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/20">
                <TrendingUp className="h-6 w-6 text-income" />
              </div>
              <h3 className="mt-4 text-lg font-medium">Great job!</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                You're staying within budget across all your expense categories.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Under Budget Categories */}
      <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors duration-200">
        <CardHeader className="pb-2">
          <CardTitle>Top Saving Categories</CardTitle>
          <CardDescription>Categories under their budgets</CardDescription>
        </CardHeader>
        <CardContent>
          {topUnderBudgetCategories.length > 0 ? (
            <div className="space-y-4">
              {topUnderBudgetCategories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CategoryIcon icon={category.icon} color={category.color} size={16} />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="text-sm font-medium text-income">
                      {category.percentage < 100 && `-${(100 - category.percentage).toFixed(0)}%`}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      ${category.actual.toFixed(2)} of ${category.budgeted.toFixed(2)}
                    </span>
                    <span className="text-income">${Math.abs(category.variance).toFixed(2)} saved</span>
                  </div>
                  <Progress value={category.percentage} className="h-2" indicatorClassName="bg-income" />
                </div>
              ))}
              <Link href="/dashboard/budget">
                <Button variant="outline" size="sm" className="w-full mt-2">
                  <Eye className="mr-2 h-4 w-4" />
                  View Full Budget
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900/20">
                <TrendingDown className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No savings found</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                You're either on track with your budget or over budget in your categories.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

