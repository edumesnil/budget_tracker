"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2 } from "lucide-react"
import { CategoryBadge } from "@/components/category-badge"
import { CategoryIcon } from "@/components/category-icon"
import type { BaseBudget } from "@/hooks/use-budget"
import {
  CustomTable,
  CustomTableHeader,
  CustomTableBody,
  CustomTableRow,
  CustomTableCell,
  CustomTableHeaderCell,
} from "@/components/ui/custom-table"

type BaseBudgetTableProps = {
  budgets: BaseBudget[]
  onEdit: (budget: BaseBudget) => void
  onDelete: (budget: BaseBudget) => void
}

export function BaseBudgetTable({ budgets, onEdit, onDelete }: BaseBudgetTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Base Budget</CardTitle>
        <CardDescription>Your recurring monthly budget items</CardDescription>
      </CardHeader>
      <CardContent>
        {budgets.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              No base budget items found. Add your first budget item to get started.
            </p>
          </div>
        ) : (
          <CustomTable>
            <CustomTableHeader className="grid-cols-[2fr_1fr_1fr_100px]">
              <CustomTableHeaderCell>Category</CustomTableHeaderCell>
              <CustomTableHeaderCell>Type</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Amount</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Actions</CustomTableHeaderCell>
            </CustomTableHeader>
            <CustomTableBody>
              {budgets.map((budget) => (
                <CustomTableRow key={budget.id} className="grid-cols-[2fr_1fr_1fr_100px]">
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
                  <CustomTableCell align="right">${Math.abs(budget.amount).toFixed(2)}</CustomTableCell>
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
              ))}
            </CustomTableBody>
          </CustomTable>
        )}
      </CardContent>
    </Card>
  )
}

