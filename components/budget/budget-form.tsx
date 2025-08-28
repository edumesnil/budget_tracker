"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle, RefreshCw, Calendar } from "lucide-react"
import type { Budget, Category } from "@/hooks/use-budget"

type BudgetFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  budgetToEdit: Budget | null
  selectedMonth: number
  selectedYear: number
  onSubmit: (formData: {
    categoryId: string
    amount: number
    isBase: boolean
    applyToMonths: number[]
  }) => Promise<void>
  error: string | null
}

export function BudgetForm({
  open,
  onOpenChange,
  categories,
  budgetToEdit,
  selectedMonth,
  selectedYear,
  onSubmit,
  error,
}: BudgetFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formCategoryId, setFormCategoryId] = useState("")
  const [formAmount, setFormAmount] = useState("")
  const [formBudgetType, setFormBudgetType] = useState<"base" | "custom">("base")
  const [formApplyToMonths, setFormApplyToMonths] = useState<number[]>([])

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

  // Reset form when dialog opens/closes or budgetToEdit changes
  useEffect(() => {
    if (open) {
      if (budgetToEdit) {
        setFormCategoryId(budgetToEdit.category_id)
        setFormAmount(Math.abs(budgetToEdit.amount).toString())
        setFormBudgetType(budgetToEdit.month === 0 ? "base" : "custom")
        setFormApplyToMonths(budgetToEdit.month && budgetToEdit.month !== 0 ? [budgetToEdit.month] : [selectedMonth])
      } else {
        setFormCategoryId("")
        setFormAmount("")
        setFormBudgetType("base")
        setFormApplyToMonths([selectedMonth])
      }
    }
  }, [open, budgetToEdit, selectedMonth])

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      await onSubmit({
        categoryId: formCategoryId,
        amount: Number(formAmount),
        isBase: formBudgetType === "base",
        applyToMonths: formApplyToMonths,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{budgetToEdit ? "Edit" : "Add"} Budget Item</DialogTitle>
          <DialogDescription>
            {budgetToEdit ? "Update your budget amount for this category" : "Set a budget amount for a category"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Budget Type</Label>
            <RadioGroup
              value={formBudgetType}
              onValueChange={(value) => setFormBudgetType(value as "base" | "custom")}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="base" id="base" />
                <Label htmlFor="base" className="flex items-center gap-2 cursor-pointer">
                  <RefreshCw className="h-4 w-4" />
                  Base Budget (repeats monthly)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="flex items-center gap-2 cursor-pointer">
                  <Calendar className="h-4 w-4" />
                  Custom Budget (specific month)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formCategoryId}
              onValueChange={setFormCategoryId}
              disabled={!!budgetToEdit && formBudgetType === "base"}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select-placeholder" disabled>
                  Select a category
                </SelectItem>
                {/* Income Categories */}
                <SelectItem value="income-header" disabled className="font-semibold">
                  Income Categories
                </SelectItem>
                {categories
                  .filter((cat) => cat.type === "INCOME")
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}

                {/* Expense Categories */}
                <SelectItem value="expense-header" disabled className="font-semibold mt-2">
                  Expense Categories
                </SelectItem>
                {categories
                  .filter((cat) => cat.type === "EXPENSE")
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Budget Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">Enter the amount you want to budget for this category.</p>
          </div>

          {formBudgetType === "custom" && (
            <div className="space-y-2">
              <Label>Apply to Months</Label>
              <div className="grid grid-cols-3 gap-2">
                {monthNames.map((name, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={`month-${index + 1}`}
                      checked={formApplyToMonths.includes(index + 1)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormApplyToMonths((prev) => [...prev, index + 1])
                        } else {
                          setFormApplyToMonths((prev) => prev.filter((m) => m !== index + 1))
                        }
                      }}
                      disabled={budgetToEdit !== null}
                    />
                    <Label htmlFor={`month-${index + 1}`} className="text-sm cursor-pointer">
                      {name}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {budgetToEdit
                  ? "You can only edit one month at a time when updating an existing budget."
                  : "Select the months to apply this budget to."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? budgetToEdit
                ? "Updating..."
                : "Adding..."
              : budgetToEdit
                ? "Update Budget"
                : "Add Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

