"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { LoadingState } from "@/components/shared/loading-state"
import { TransactionPageHeader } from "@/components/transactions/transaction-page-header"
import { MonthSelector } from "@/components/shared/unified-month-selector"
import { TransactionTable } from "@/components/transactions/transaction-table"
import { TransactionDeleteDialog } from "@/components/transactions/transaction-delete-dialog"
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog"
import { useTransactionData, type Transaction, type TransactionFormData } from "@/hooks/use-transaction-data"

export default function TransactionsPage() {
  const {
    filteredTransactions,
    loading,
    error,
    setError,
    categories,
    fetchingCategories,
    fetchCategories,
    selectedMonth,
    selectedYear,
    monthNames,
    goToPreviousMonth,
    goToNextMonth,
    deleteTransaction,
    saveTransaction,
  } = useTransactionData()

  // Delete dialog state
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Transaction modal state (shared for both add and edit)
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [transactionMode, setTransactionMode] = useState<"add" | "edit">("add")
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null)

  // Open delete confirmation dialog
  const openDeleteDialog = (transaction: Transaction) => {
    setTransactionToDelete(transaction)
    setDeleteDialogOpen(true)
  }

  // Open add transaction modal
  const openAddTransactionModal = async () => {
    setTransactionMode("add")
    setTransactionToEdit(null)

    // Fetch categories if not already loaded
    if (categories.length === 0) {
      await fetchCategories()
    }

    setTransactionModalOpen(true)
  }

  // Open edit transaction modal
  const openEditTransactionModal = async (transaction: Transaction) => {
    setTransactionToEdit(transaction)
    setTransactionMode("edit")

    // Fetch categories if not already loaded
    if (categories.length === 0) {
      await fetchCategories()
    }

    setTransactionModalOpen(true)
  }

  // Handle transaction deletion
  const handleDelete = async () => {
    if (!transactionToDelete) return

    try {
      setIsDeleting(true)
      await deleteTransaction(transactionToDelete.id)
      setDeleteDialogOpen(false)
      setTransactionToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle transaction form submission (both add and edit)
  const handleTransactionSubmit = async (formData: TransactionFormData) => {
    return await saveTransaction(formData, transactionMode === "edit" ? transactionToEdit?.id : undefined)
  }

  // Handle month/year change
  const handleMonthYearChange = (value: { month: number; year: number }) => {
    // Since we can't directly access the state setters from the hook,
    // we'll simulate the month navigation logic
    if (value.month !== selectedMonth || value.year !== selectedYear) {
      if (value.year < selectedYear || (value.year === selectedYear && value.month < selectedMonth)) {
        // Going backward in time
        while (selectedYear > value.year || (selectedYear === value.year && selectedMonth > value.month)) {
          goToPreviousMonth()
        }
      } else {
        // Going forward in time
        while (selectedYear < value.year || (selectedYear === value.year && selectedMonth < value.month)) {
          goToNextMonth()
        }
      }
    }
  }

  // Render loading state while data is being fetched
  if (loading && !filteredTransactions) {
    return (
      <div className="space-y-6">
        <TransactionPageHeader onAddTransaction={openAddTransactionModal} />
        <LoadingState isLoading={true} isError={false} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-1">
        <TransactionPageHeader onAddTransaction={openAddTransactionModal}>
          {selectedMonth !== undefined && selectedYear !== undefined && (
            <MonthSelector
              value={{ month: selectedMonth, year: selectedYear }}
              onChange={(value) => {
                if (!(value instanceof Date)) {
                  handleMonthYearChange(value)
                }
              }}
              monthNames={monthNames}
              monthIndexBase={0}
              showDropdown={true}
            />
          )}
        </TransactionPageHeader>

        <LoadingState isLoading={loading} isError={false}>
          <TransactionTable
            transactions={filteredTransactions || []}
            onEdit={openEditTransactionModal}
            onDelete={openDeleteDialog}
            selectedMonth={selectedMonth || 0}
            selectedYear={selectedYear || new Date().getFullYear()}
            monthNames={monthNames || []}
          />
        </LoadingState>
      </div>

      {/* Delete Confirmation Dialog */}
      <TransactionDeleteDialog
        transaction={transactionToDelete}
        isOpen={deleteDialogOpen}
        isDeleting={isDeleting}
        onOpenChange={setDeleteDialogOpen}
        onConfirmDelete={handleDelete}
      />

      {/* Transaction Modal (shared for both add and edit) */}
      <TransactionFormDialog
        isOpen={transactionModalOpen}
        onOpenChange={setTransactionModalOpen}
        onSubmit={handleTransactionSubmit}
        transaction={transactionToEdit}
        categories={categories}
        fetchingCategories={fetchingCategories}
        error={error}
        mode={transactionMode}
      />
    </div>
  )
}

