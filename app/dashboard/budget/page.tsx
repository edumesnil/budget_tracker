"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useBudget } from "@/hooks/use-budget"

// Import our components
import { BudgetPageHeader } from "@/components/budget/budget-page-header"
import { MonthlyBudgetView } from "@/components/budget/monthly-budget-view"
import { AnnualBudgetView } from "@/components/budget/annual-budget-view"
import { BudgetForm } from "@/components/budget/budget-form"
import { DeleteBudgetDialog } from "@/components/budget/delete-budget-dialog"
import { LoadingState } from "@/components/shared/loading-state"

export default function BudgetPage() {
  const { toast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)

  // View state
  const [activeView, setActiveView] = useState<"monthly" | "annual">("monthly")

  // Budget modal state
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetToEdit, setBudgetToEdit] = useState<any>(null)

  // Delete dialog state
  const [budgetToDelete, setBudgetToDelete] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Use our custom hook for budget data and operations
  const budget = useBudget()

  // Open budget modal for adding
  const openAddBudgetModal = () => {
    setBudgetToEdit(null)
    setFormError(null)
    setBudgetModalOpen(true)
  }

  // Open budget modal for editing
  const openEditBudgetModal = (budget: any) => {
    setBudgetToEdit(budget)
    setFormError(null)
    setBudgetModalOpen(true)
  }

  // Open delete confirmation dialog
  const openDeleteDialog = (budget: any) => {
    setBudgetToDelete(budget)
    setDeleteDialogOpen(true)
  }

  // Handle budget form submission
  const handleBudgetSubmit = async (formData: {
    categoryId: string
    amount: number
    isBase: boolean
    applyToMonths: number[]
  }) => {
    setFormError(null)

    try {
      if (budgetToEdit) {
        // Update existing budget
        const result = await budget.updateBudget(
          budgetToEdit.id,
          formData.amount,
          formData.isBase,
          formData.applyToMonths[0],
        )

        if (!result.success) {
          setFormError(result.error || "Failed to update budget")
          return
        }

        toast({
          title: "Success",
          description: result.message,
          variant: "success",
          duration: 4000,
        })
      } else {
        // Add new budget
        const result = await budget.addBudget(
          formData.categoryId,
          formData.amount,
          formData.isBase,
          formData.applyToMonths,
        )

        if (!result.success) {
          setFormError(result.error || "Failed to add budget")
          return
        }

        toast({
          title: "Success",
          description: result.message,
          variant: "success",
          duration: 4000,
        })
      }

      // Close modal
      setBudgetModalOpen(false)
    } catch (err: any) {
      console.error("Error with budget:", err)
      setFormError(err.message || "An unexpected error occurred")
    }
  }

  // Handle budget deletion
  const handleDeleteBudget = async () => {
    if (!budgetToDelete) return

    const result = await budget.deleteBudget(budgetToDelete.id)

    if (result.success) {
      toast({
        title: "Success",
        description: result.message,
        variant: "success",
        duration: 4000,
      })

      // Close dialog
      setDeleteDialogOpen(false)
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to delete budget",
        variant: "destructive",
        duration: 4000,
      })
    }
  }

  if (budget.loading) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      {budget.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{budget.error}</AlertDescription>
        </Alert>
      )}

      <BudgetPageHeader
        activeView={activeView}
        onViewChange={setActiveView}
        selectedMonth={budget.selectedMonth}
        selectedYear={budget.selectedYear}
        onMonthChange={(month, year) => {
          budget.setSelectedMonth(month)
          budget.setSelectedYear(year)
        }}
        onPrevious={budget.goToPreviousMonth}
        onNext={budget.goToNextMonth}
        onAddBudget={openAddBudgetModal}
      />

      {/* Monthly View */}
      {activeView === "monthly" && (
        <MonthlyBudgetView
          budgetWithActuals={budget.budgetWithActuals}
          monthlySummary={budget.monthlySummary}
          selectedMonth={budget.selectedMonth}
          selectedYear={budget.selectedYear}
          onEditBudget={openEditBudgetModal}
          onDeleteBudget={openDeleteDialog}
        />
      )}

      {/* Annual View */}
      {activeView === "annual" && (
        <AnnualBudgetView
          annualData={budget.annualData}
          baseBudgets={budget.baseBudgets}
          onSelectMonth={(month) => {
            budget.setSelectedMonth(month)
            setActiveView("monthly")
          }}
          onEditBudget={openEditBudgetModal}
          onDeleteBudget={openDeleteDialog}
        />
      )}

      {/* Budget Form Dialog */}
      <BudgetForm
        open={budgetModalOpen}
        onOpenChange={setBudgetModalOpen}
        categories={budget.categories}
        budgetToEdit={budgetToEdit}
        selectedMonth={budget.selectedMonth}
        selectedYear={budget.selectedYear}
        onSubmit={handleBudgetSubmit}
        error={formError}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteBudgetDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        budget={budgetToDelete}
        onDelete={handleDeleteBudget}
      />
    </div>
  )
}

