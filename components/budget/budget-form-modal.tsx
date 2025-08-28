"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, RefreshCw, Calendar } from "lucide-react"
import { CategoryIcon } from "@/components/category-icon"

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

type BudgetFormModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  budgetToEdit: any | null
  categories: any[]
  selectedMonth: number
  selectedYear: number
  baseBudgets: any[]
  setBaseBudgets: (budgets: any[]) => void
  setCustomBudgets: (budgets: any[]) => void
  refreshData: () => void
}

export function BudgetFormModal({
  open,
  onOpenChange,
  budgetToEdit,
  categories,
  selectedMonth,
  selectedYear,
  baseBudgets,
  setBaseBudgets,
  setCustomBudgets,
  refreshData,
}: BudgetFormModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formBudgetType, setFormBudgetType] = useState<"base" | "custom">(
    budgetToEdit?.month === null && budgetToEdit?.year === null ? "base" : "custom",
  )
  const [formCategoryId, setFormCategoryId] = useState(budgetToEdit?.category_id || "")
  const [formAmount, setFormAmount] = useState(budgetToEdit ? Math.abs(budgetToEdit.amount).toString() : "")
  const [formApplyToMonths, setFormApplyToMonths] = useState<number[]>(
    budgetToEdit?.month ? [budgetToEdit.month] : [selectedMonth],
  )

  // Reset form when modal opens/closes or budgetToEdit changes
  const resetForm = () => {
    setFormBudgetType(budgetToEdit?.month === null && budgetToEdit?.year === null ? "base" : "custom")
    setFormCategoryId(budgetToEdit?.category_id || "")
    setFormAmount(budgetToEdit ? Math.abs(budgetToEdit.amount).toString() : "")
    setFormApplyToMonths(budgetToEdit?.month ? [budgetToEdit.month] : [selectedMonth])
    setError(null)
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!user) return

    try {
      setIsSubmitting(true)
      setError(null)

      // Validate inputs
      if (!formCategoryId) {
        setError("Please select a category")
        setIsSubmitting(false)
        return
      }

      if (!formAmount || isNaN(Number(formAmount)) || Number(formAmount) <= 0) {
        setError("Please enter a valid amount greater than zero")
        setIsSubmitting(false)
        return
      }

      if (formBudgetType === "custom" && formApplyToMonths.length === 0) {
        setError("Please select at least one month")
        setIsSubmitting(false)
        return
      }

      const supabase = getSupabaseBrowser()
      const selectedCategory = categories.find((c) => c.id === formCategoryId)

      if (!selectedCategory) {
        setError("Invalid category selected")
        setIsSubmitting(false)
        return
      }

      // Adjust amount sign based on category type (always store as positive)
      const amount = Math.abs(Number(formAmount))

      if (budgetToEdit) {
        // Update existing budget
        if (formBudgetType === "base") {
          // Updating a base budget
          const { data: updatedBudget, error: updateError } = await supabase
            .from("budgets")
            .update({
              amount: amount,
              is_recurring: true,
              month: null,
              year: null,
            })
            .eq("id", budgetToEdit.id)
            .eq("user_id", user.id)
            .select()

          if (updateError) throw updateError

          // Update the budget in the local state
          setBaseBudgets((prev) =>
            prev.map((b) =>
              b.id === budgetToEdit.id
                ? {
                    ...b,
                    amount,
                    is_recurring: true,
                    month: null,
                    year: null,
                  }
                : b,
            ),
          )

          toast({
            title: "Success",
            description: "Base budget updated successfully!",
            variant: "success",
            duration: 4000,
          })
        } else {
          // Updating a custom budget
          const { data: updatedBudget, error: updateError } = await supabase
            .from("budgets")
            .update({
              amount: amount,
              is_recurring: false,
              month: formApplyToMonths[0],
              year: selectedYear,
            })
            .eq("id", budgetToEdit.id)
            .eq("user_id", user.id)
            .select()

          if (updateError) throw updateError

          // Update the budget in the local state
          setCustomBudgets((prev) =>
            prev.map((b) =>
              b.id === budgetToEdit.id
                ? {
                    ...b,
                    amount,
                    is_recurring: false,
                    month: formApplyToMonths[0],
                    year: selectedYear,
                  }
                : b,
            ),
          )

          toast({
            title: "Success",
            description: "Custom budget updated successfully!",
            variant: "success",
            duration: 4000,
          })
        }
      } else {
        // Creating new budget(s)
        if (formBudgetType === "base") {
          // Check if a base budget for this category already exists
          const existingBaseBudget = baseBudgets.find((b) => b.category_id === formCategoryId)

          if (existingBaseBudget) {
            setError(
              `A base budget for ${selectedCategory.name} already exists. Please edit the existing budget instead.`,
            )
            setIsSubmitting(false)
            return
          }

          // Insert new base budget
          const { data: newBudget, error: insertError } = await supabase
            .from("budgets")
            .insert({
              user_id: user.id,
              category_id: formCategoryId,
              amount: amount,
              month: null,
              year: null,
              is_recurring: true,
            })
            .select(`
              id,
              category_id,
              amount,
              month,
              year,
              is_recurring,
              categories:category_id (
                name,
                type,
                color,
                icon
              )
            `)

          if (insertError) throw insertError

          if (newBudget && newBudget.length > 0) {
            // Format the new budget
            const formattedBudget = {
              id: newBudget[0].id,
              category_id: newBudget[0].category_id,
              amount: newBudget[0].amount,
              month: newBudget[0].month,
              year: newBudget[0].year,
              is_recurring: newBudget[0].is_recurring,
              category_name: newBudget[0].categories?.name || "Unknown Category",
              category_type: newBudget[0].categories?.type || null,
              category_color: newBudget[0].categories?.color || null,
              category_icon: newBudget[0].categories?.icon || null,
            }

            // Add the new budget to the local state
            setBaseBudgets((prev) => [...prev, formattedBudget])
          }

          toast({
            title: "Success",
            description: "Base budget added successfully!",
            variant: "success",
            duration: 4000,
          })
        } else {
          // Insert custom budgets for each selected month
          const budgetsToInsert = formApplyToMonths.map((month) => ({
            user_id: user.id,
            category_id: formCategoryId,
            amount: amount,
            month: month,
            year: selectedYear,
            is_recurring: false,
          }))

          const { data: newBudgets, error: insertError } = await supabase
            .from("budgets")
            .insert(budgetsToInsert)
            .select(`
              id,
              category_id,
              amount,
              month,
              year,
              is_recurring,
              categories:category_id (
                name,
                type,
                color,
                icon
              )
            `)

          if (insertError) throw insertError

          if (newBudgets && newBudgets.length > 0) {
            // Format the new budgets
            const formattedBudgets = newBudgets.map((budget) => ({
              id: budget.id,
              category_id: budget.category_id,
              amount: budget.amount,
              month: budget.month,
              year: budget.year,
              is_recurring: budget.is_recurring,
              category_name: budget.categories?.name || "Unknown Category",
              category_type: budget.categories?.type || null,
              category_color: budget.categories?.color || null,
              category_icon: budget.categories?.icon || null,
            }))

            // Add the new budgets to the local state
            setCustomBudgets((prev) => [...prev, ...formattedBudgets])
          }

          toast({
            title: "Success",
            description: `Custom budget${formApplyToMonths.length > 1 ? "s" : ""} added successfully!`,
            variant: "success",
            duration: 4000,
          })
        }
      }

      // Close modal and reset form
      onOpenChange(false)
      resetForm()
    } catch (err: any) {
      console.error("Error with budget:", err)
      setError(`Failed to ${budgetToEdit ? "update" : "add"} budget: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen)
        if (!newOpen) resetForm()
      }}
    >
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
                      <div className="flex items-center gap-2">
                        <CategoryIcon icon={category.icon} color={category.color} size={16} />
                        {category.name}
                      </div>
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
                      <div className="flex items-center gap-2">
                        <CategoryIcon icon={category.icon} color={category.color} size={16} />
                        {category.name}
                      </div>
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
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              resetForm()
            }}
            disabled={isSubmitting}
          >
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

