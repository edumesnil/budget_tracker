"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useBudgetCalculations } from "@/hooks/use-budget-calculations"

export type Category = {
  id: string
  name: string
  type: "INCOME" | "EXPENSE"
  color: string | null
  icon: string | null
  user_id: string
}

export type Budget = {
  id: string
  category_id: string
  amount: number
  month: number | null
  year: number | null
  is_recurring: boolean
  category_name: string
  category_type: "INCOME" | "EXPENSE" | null
  category_color: string | null
  category_icon: string | null
}

export type BudgetWithActual = Budget & {
  actual: number
  percentage: number
}

export type MonthSummary = {
  totalIncome: number
  totalExpenses: number
  netBudget: number
  actualIncome: number
  actualExpenses: number
  netActual: number
  savingsRate: number
}

export type AnnualDataItem = MonthSummary & {
  month: number
}

export function useBudgetData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data state
  const [categories, setCategories] = useState<Category[]>([])
  const [baseBudgets, setBaseBudgets] = useState<Budget[]>([])
  const [customBudgets, setCustomBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<any[]>([])

  // View state
  const [activeView, setActiveView] = useState<"monthly" | "annual">("monthly")

  // Date state
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  // Budget modal state
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetToEdit, setBudgetToEdit] = useState<Budget | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null)

  // Calculate budget data using the useBudgetCalculations hook
  const { budgetWithActuals, monthlySummary, annualData } = useBudgetCalculations({
    baseBudgets,
    customBudgets,
    transactions,
    categories,
    selectedMonth,
    selectedYear,
  })

  // Month navigation functions
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  // Fetch all required data
  const fetchData = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const supabase = getSupabaseBrowser()

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name")

      if (categoriesError) throw categoriesError
      setCategories(categoriesData || [])

      // Fetch base budgets (recurring, no month/year)
      const { data: baseBudgetsData, error: baseBudgetsError } = await supabase
        .from("budgets")
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
        .eq("user_id", user.id)
        .eq("is_recurring", true)
        .is("month", null)
        .is("year", null)

      if (baseBudgetsError) throw baseBudgetsError

      // Transform the base budget data
      const formattedBaseBudgets = baseBudgetsData.map((budget: any) => ({
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

      setBaseBudgets(formattedBaseBudgets)

      // Fetch custom budgets for the selected year
      const { data: customBudgetsData, error: customBudgetsError } = await supabase
        .from("budgets")
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
        .eq("user_id", user.id)
        .eq("year", selectedYear)
        .not("month", "is", null)

      if (customBudgetsError) throw customBudgetsError

      // Transform the custom budget data
      const formattedCustomBudgets = customBudgetsData.map((budget: any) => ({
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

      setCustomBudgets(formattedCustomBudgets)

      // Fetch transactions for the selected year
      const startDate = new Date(selectedYear, 0, 1).toISOString().split("T")[0]
      const endDate = new Date(selectedYear, 11, 31).toISOString().split("T")[0]

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select(`
          id,
          date,
          amount,
          category_id,
          categories:category_id (
            name,
            type,
            color,
            icon
          )
        `)
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)

      if (transactionsError) throw transactionsError
      setTransactions(transactionsData || [])
    } catch (err: any) {
      console.error("Error fetching data:", err)
      setError(err.message || "Failed to load budget data")
    } finally {
      setLoading(false)
    }
  }

  // Budget operations
  const addBudget = async (categoryId: string, amount: number, isBase: boolean, applyToMonths: number[]) => {
    if (!user) return { success: false, error: "User not authenticated" }

    try {
      const supabase = getSupabaseBrowser()
      const selectedCategory = categories.find((c) => c.id === categoryId)

      if (!selectedCategory) {
        return { success: false, error: "Invalid category selected" }
      }

      // Adjust amount sign based on category type (always store as positive)
      const budgetAmount = Math.abs(Number(amount))

      if (isBase) {
        // Check if a base budget for this category already exists
        const existingBaseBudget = baseBudgets.find((b) => b.category_id === categoryId)

        if (existingBaseBudget) {
          return {
            success: false,
            error: `A base budget for ${selectedCategory.name} already exists. Please edit the existing budget instead.`,
          }
        }

        // Insert new base budget
        const { data: newBudget, error: insertError } = await supabase
          .from("budgets")
          .insert({
            user_id: user.id,
            category_id: categoryId,
            amount: budgetAmount,
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

        return {
          success: true,
          message: "Base budget added successfully!",
        }
      } else {
        // Insert custom budgets for each selected month
        const budgetsToInsert = applyToMonths.map((month) => ({
          user_id: user.id,
          category_id: categoryId,
          amount: budgetAmount,
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

        return {
          success: true,
          message: `Custom budget${applyToMonths.length > 1 ? "s" : ""} added successfully!`,
        }
      }
    } catch (err: any) {
      console.error("Error adding budget:", err)
      return { success: false, error: `Failed to add budget: ${err.message}` }
    }
  }

  const updateBudget = async (budgetId: string, amount: number, isBase: boolean, month: number) => {
    if (!user) return { success: false, error: "User not authenticated" }

    try {
      const supabase = getSupabaseBrowser()

      // Adjust amount sign based on category type (always store as positive)
      const budgetAmount = Math.abs(Number(amount))

      if (isBase) {
        // Updating a base budget
        const { data: updatedBudget, error: updateError } = await supabase
          .from("budgets")
          .update({
            amount: budgetAmount,
            is_recurring: true,
            month: null,
            year: null,
          })
          .eq("id", budgetId)
          .eq("user_id", user.id)
          .select()

        if (updateError) throw updateError

        // Update the budget in the local state
        setBaseBudgets((prev) =>
          prev.map((b) =>
            b.id === budgetId
              ? {
                  ...b,
                  amount: budgetAmount,
                  is_recurring: true,
                  month: null,
                  year: null,
                }
              : b,
          ),
        )

        return {
          success: true,
          message: "Base budget updated successfully!",
        }
      } else {
        // Updating a custom budget
        const { data: updatedBudget, error: updateError } = await supabase
          .from("budgets")
          .update({
            amount: budgetAmount,
            is_recurring: false,
            month: month,
            year: selectedYear,
          })
          .eq("id", budgetId)
          .eq("user_id", user.id)
          .select()

        if (updateError) throw updateError

        // Update the budget in the local state
        setCustomBudgets((prev) =>
          prev.map((b) =>
            b.id === budgetId
              ? {
                  ...b,
                  amount: budgetAmount,
                  is_recurring: false,
                  month: month,
                  year: selectedYear,
                }
              : b,
          ),
        )

        return {
          success: true,
          message: "Custom budget updated successfully!",
        }
      }
    } catch (err: any) {
      console.error("Error updating budget:", err)
      return { success: false, error: `Failed to update budget: ${err.message}` }
    }
  }

  const deleteBudget = async (budgetId: string) => {
    if (!user) return { success: false, error: "User not authenticated" }

    try {
      const supabase = getSupabaseBrowser()

      // Find the budget to delete
      const budgetToDelete = [...baseBudgets, ...customBudgets].find((b) => b.id === budgetId)

      if (!budgetToDelete) {
        return { success: false, error: "Budget not found" }
      }

      // Delete the budget
      const { error: deleteError } = await supabase.from("budgets").delete().eq("id", budgetId).eq("user_id", user.id)

      if (deleteError) throw deleteError

      // Update the local state
      if (budgetToDelete.month === null && budgetToDelete.year === null) {
        setBaseBudgets((prev) => prev.filter((b) => b.id !== budgetId))
      } else {
        setCustomBudgets((prev) => prev.filter((b) => b.id !== budgetId))
      }

      return {
        success: true,
        message: "Budget deleted successfully!",
      }
    } catch (err: any) {
      console.error("Error deleting budget:", err)
      return { success: false, error: `Failed to delete budget: ${err.message}` }
    }
  }

  // Load data when year changes
  useEffect(() => {
    fetchData()
  }, [user, selectedYear])

  // Dialog handlers
  const openAddBudgetModal = () => {
    setBudgetToEdit(null)
    setBudgetModalOpen(true)
  }

  const openEditBudgetModal = (budget: Budget) => {
    setBudgetToEdit(budget)
    setBudgetModalOpen(true)
  }

  const openDeleteDialog = (budget: Budget) => {
    setBudgetToDelete(budget)
    setDeleteDialogOpen(true)
  }

  return {
    // Data
    loading,
    error,
    categories,
    baseBudgets,
    customBudgets,
    transactions,
    budgetWithActuals,
    monthlySummary,
    annualData,

    // View state
    activeView,
    setActiveView,

    // Date state
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    goToPreviousMonth,
    goToNextMonth,

    // Budget modal state
    budgetModalOpen,
    setBudgetModalOpen,
    budgetToEdit,
    setBudgetToEdit,

    // Delete dialog state
    deleteDialogOpen,
    setDeleteDialogOpen,
    budgetToDelete,
    setBudgetToDelete,

    // Operations
    fetchData,
    addBudget,
    updateBudget,
    deleteBudget,

    // Dialog handlers
    openAddBudgetModal,
    openEditBudgetModal,
    openDeleteDialog,
  }
}

