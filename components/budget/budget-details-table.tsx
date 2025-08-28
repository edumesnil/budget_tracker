"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, RefreshCw, Calendar } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { CategoryBadge } from "@/components/category-badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CategoryIcon } from "@/components/category-icon"
import {
  CustomTable,
  CustomTableHeader,
  CustomTableBody,
  CustomTableRow,
  CustomTableCell,
  CustomTableHeaderCell,
} from "@/components/ui/custom-table"

type BudgetDetailsTableProps = {
  budgetData: any[]
  onEdit: (budget: any) => void
  onDelete: (budget: any) => void
}

export function BudgetDetailsTable({ budgetData, onEdit, onDelete }: BudgetDetailsTableProps) {
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expense">("all")

  // Filter budgets based on active tab
  const filteredBudgets = budgetData.filter((budget) => {
    if (activeTab === "all") return true
    if (activeTab === "income") return budget.category_type === "INCOME"
    if (activeTab === "expense") return budget.category_type === "EXPENSE"
    return true
  })

  // Function to get progress bar color based on percentage
  const getProgressColor = (percentage: number, type: "INCOME" | "EXPENSE" | null) => {
    if (type === "INCOME") {
      if (percentage >= 100) return "bg-income"
      if (percentage >= 75) return "bg-income/80"
      if (percentage >= 50) return "bg-yellow-500"
      return "bg-expense"
    } else {
      // For expenses
      if (percentage > 100) return "bg-expense"
      if (percentage >= 90) return "bg-yellow-500"
      if (percentage >= 75) return "bg-yellow-400"
      return "bg-income"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Details</CardTitle>
        <CardDescription>Track your budget vs. actual spending</CardDescription>
        <Tabs defaultValue="all" className="mt-2" onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expense">Expenses</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {filteredBudgets.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No budget items found. Add your first budget item to get started.</p>
          </div>
        ) : (
          <CustomTable>
            <CustomTableHeader className="grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_2fr_100px]">
              <CustomTableHeaderCell>Category</CustomTableHeaderCell>
              <CustomTableHeaderCell>Type</CustomTableHeaderCell>
              <CustomTableHeaderCell>Budget Type</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Budgeted</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Actual</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Difference</CustomTableHeaderCell>
              <CustomTableHeaderCell>Progress</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Actions</CustomTableHeaderCell>
            </CustomTableHeader>
            <CustomTableBody>
              {filteredBudgets.map((budget) => {
                const difference = budget.actual - budget.amount
                const isOverBudget =
                  (budget.category_type === "EXPENSE" && budget.percentage > 100) ||
                  (budget.category_type === "INCOME" && budget.percentage < 100)

                return (
                  <CustomTableRow key={budget.id} className="grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_2fr_100px]">
                    <CustomTableCell>
                      <div className="flex items-center gap-2">
                        <CategoryIcon
                          icon={budget.category_icon || null}
                          color={budget.category_color || null}
                          size={16}
                        />
                        {budget.category_name}
                      </div>
                    </CustomTableCell>
                    <CustomTableCell>
                      <CategoryBadge type={budget.category_type} />
                    </CustomTableCell>
                    <CustomTableCell>
                      {budget.month === null && budget.year === null ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Base
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                          <Calendar className="h-3 w-3 mr-1" />
                          Custom
                        </span>
                      )}
                    </CustomTableCell>
                    <CustomTableCell align="right">${Math.round(Math.abs(budget.amount))}</CustomTableCell>
                    <CustomTableCell align="right">${Math.round(Math.abs(budget.actual))}</CustomTableCell>
                    <CustomTableCell align="right" className={isOverBudget ? "amount-negative" : "amount-positive"}>
                      {budget.category_type === "EXPENSE" ? (difference > 0 ? "+" : "") : difference < 0 ? "" : "+"}$
                      {Math.abs(difference).toFixed(2)}
                    </CustomTableCell>
                    <CustomTableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(budget.percentage, 100)}
                          className="h-2"
                          indicatorClassName={getProgressColor(budget.percentage, budget.category_type)}
                        />
                        <span className="text-xs w-12 text-right">{Math.round(budget.percentage)}%</span>
                      </div>
                    </CustomTableCell>
                    <CustomTableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(budget)} className="h-8 w-8">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(budget)}
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CustomTableCell>
                  </CustomTableRow>
                )
              })}
            </CustomTableBody>
          </CustomTable>
        )}
      </CardContent>
    </Card>
  )
}

