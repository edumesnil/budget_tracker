"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseBrowser } from "@/lib/supabase"

export type Category = {
  id: string
  name: string
  type: "INCOME" | "EXPENSE"
  color: string | null
  icon?: string | null
}

export type Budget = {
  id: string
  category_id: string
  amount: number
  month: number | null
  year: number | null
  is_recurring: boolean
  category_name?: string
  category_type?: "INCOME" | "EXPENSE"
  category_color?: string | null
  category_icon?: string | null
}

export type BudgetWithActual = Budget & {
  actual: number
  percentage: number
}

export type MonthlyBudgetSummary = {
  month: number
  year: number
  totalIncome: number
  totalExpenses: number
  actualIncome: number
  actualExpenses: number
  netBudget: number
  netActual: number
}

export type MonthlySummary = {
  budgetIncome: number
  budgetExpense: number
  actualIncome: number
  actualExpense: number
  netBudget: number
  netActual: number
}

export function useBudget(initialMonth = new Date().getMonth() + 1, initialYear = new Date().getFullYear()) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [baseBudgets, setBaseBudgets] = useState<Budget[]>([])
  const [customBudgets, setCustomBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [annualData, setAnnualData] = useState<MonthlyBudgetSummary[]>([])

  // Month navigation
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

      // Fetch base budgets (recurring, month=0)
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
        .eq("month", 0) // Look for month=0 instead of null

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

      // Also update the custom budgets formatting in the same way
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
            color
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

  // Calculate monthly budget summaries for the annual view
  useEffect(() => {
    if (!baseBudgets.length && !customBudgets.length && !transactions.length) {
      setAnnualData([])
      return
    }

    const monthlySummaries: MonthlyBudgetSummary[] = []

    // Process each month of the selected year
    for (let month = 1; month <= 12; month++) {
      // Get custom budgets for this month
      const monthCustomBudgets = customBudgets.filter((budget) => budget.month === month)

      // Calculate budget totals
      let totalIncome = 0
      let totalExpenses = 0

      // Add base budget amounts
      baseBudgets.forEach((budget) => {
        if (budget.category_type === "INCOME") {
          totalIncome += budget.amount
        } else if (budget.category_type === "EXPENSE") {
          totalExpenses += budget.amount
        }
      })

      // Add custom budget amounts for this month
      monthCustomBudgets.forEach((budget) => {
        if (budget.category_type === "INCOME") {
          totalIncome += budget.amount
        } else if (budget.category_type === "EXPENSE") {
          totalExpenses += budget.amount
        }
      })

      // Calculate actual totals from transactions
      const monthStart = new Date(selectedYear, month - 1, 1)
      const monthEnd = new Date(selectedYear, month, 0)

      const monthTransactions = transactions.filter((transaction) => {
        const transactionDate = new Date(transaction.date)
        return transactionDate >= monthStart && transactionDate <= monthEnd
      })

      let actualIncome = 0
      let actualExpenses = 0

      monthTransactions.forEach((transaction) => {
        if (transaction.amount > 0) {
          actualIncome += transaction.amount
        } else {
          actualExpenses += Math.abs(transaction.amount)
        }
      })

      monthlySummaries.push({
        month,
        year: selectedYear,
        totalIncome,
        totalExpenses,
        actualIncome,
        actualExpenses,
        netBudget: totalIncome - totalExpenses,
        netActual: actualIncome - actualExpenses,
      })
    }

    setAnnualData(monthlySummaries)
  }, [baseBudgets, customBudgets, transactions, selectedYear])

  // Load data when year changes
  useEffect(() => {
    fetchData()
  }, [user, selectedYear])

  // Compute the effective budgets for the selected month
  const effectiveBudgets = useMemo(() => {
    // Start with base budgets (filter for month=0)
    const result = [...baseBudgets].filter((budget) => budget.month === 0)

    // Add custom budgets for the selected month
    const monthCustomBudgets = customBudgets.filter((budget) => budget.month === selectedMonth)

    // For each custom budget, either add it or override the base budget
    monthCustomBudgets.forEach((customBudget) => {
      const baseIndex = result.findIndex((b) => b.category_id === customBudget.category_id)

      if (baseIndex >= 0) {
        // Override the base budget
        result[baseIndex] = { ...customBudget }
      } else {
        // Add as a new budget item
        result.push(customBudget)
      }
    })

    return result
  }, [baseBudgets, customBudgets, selectedMonth])

  // Calculate budget vs actual spending for the selected month
  const budgetWithActuals = useMemo(() => {
    if (effectiveBudgets.length === 0 && transactions.length === 0) {
      return []
    }

    // Filter transactions for the selected month
    const monthStart = new Date(selectedYear, selectedMonth - 1, 1)
    const monthEnd = new Date(selectedYear, selectedMonth, 0)

    const monthTransactions = transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date)
      return transactionDate >= monthStart && transactionDate <= monthEnd
    })

    // Create a map of category_id to actual spending
    const actualByCategory: Record<string, number> = {}

    monthTransactions.forEach((transaction) => {
      const categoryId = transaction.category_id
      if (categoryId) {
        if (!actualByCategory[categoryId]) {
          actualByCategory[categoryId] = 0
        }
        actualByCategory[categoryId] += transaction.amount
      }
    })

    // Calculate budget vs actual for each budget item
    const withActuals = effectiveBudgets.map((budget) => {
      const actual = actualByCategory[budget.category_id] || 0
      const percentage = budget.amount !== 0 ? (Math.abs(actual) / Math.abs(budget.amount)) * 100 : 0

      return {
        ...budget,
        actual,
        percentage,
      }
    })

    // Add categories that have transactions but no budget
    const budgetCategoryIds = new Set(effectiveBudgets.map((b) => b.category_id))

    Object.keys(actualByCategory).forEach((categoryId) => {
      if (!budgetCategoryIds.has(categoryId)) {
        const category = categories.find((c) => c.id === categoryId)
        if (category) {
          withActuals.push({
            id: `temp-${categoryId}`,
            category_id: categoryId,
            amount: 0,
            month: selectedMonth,
            year: selectedYear,
            is_recurring: false,
            category_name: category.name,
            category_type: category.type,
            category_color: category.color,
            actual: actualByCategory[categoryId],
            percentage: 100, // 100% over budget since budget is 0
          })
        }
      }
    })

    return withActuals
  }, [effectiveBudgets, transactions, categories, selectedMonth, selectedYear])

  // Calculate summary statistics for the selected month
  const monthlySummary = useMemo(() => {
    let budgetIncome = 0
    let budgetExpense = 0
    let actualIncome = 0
    let actualExpense = 0

    budgetWithActuals.forEach((item) => {
      if (item.category_type === "INCOME") {
        budgetIncome += Math.abs(item.amount)
        actualIncome += Math.abs(item.actual)
      } else if (item.category_type === "EXPENSE") {
        budgetExpense += Math.abs(item.amount)
        actualExpense += Math.abs(item.actual)
      }
    })

    return {
      budgetIncome,
      budgetExpense,
      actualIncome,
      actualExpense,
      netBudget: budgetIncome - budgetExpense,
      netActual: actualIncome - actualExpense,
    }
  }, [budgetWithActuals])

  // Budget CRUD operations
  const addBudget = async (categoryId: string, amount: number, isBase: boolean, applyToMonths: number[] = []) => {
    if (!user) return { success: false, error: "User not authenticated" }

    try {
      const supabase = getSupabaseBrowser()
      const selectedCategory = categories.find((c) => c.id === categoryId)

      if (!selectedCategory) {
        return { success: false, error: "Invalid category selected" }
      }

      // Adjust amount sign based on category type (always store as positive)
      const budgetAmount = Math.abs(amount)

      if (isBase) {
        // Check if a base budget for this category already exists
        const existingBaseBudget = baseBudgets.find((b) => b.category_id === categoryId)

        if (existingBaseBudget) {
          // Update the existing base budget instead of creating a new one
          return await updateBudget(existingBaseBudget.id, budgetAmount, true)
        }

        // Insert new base budget with month=0 instead of null
        const { data: newBudget, error: insertError } = await supabase
          .from("budgets")
          .insert({
            user_id: user.id,
            category_id: categoryId,
            amount: budgetAmount,
            month: 0, // Use 0 instead of null
            year: selectedYear,
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

        return { success: true, message: "Base budget added successfully!" }
      } else {
        // For custom budgets, check each month and update existing budgets
        const results = await Promise.all(
          applyToMonths.map(async (month) => {
            // Check if a budget for this category, month, and year already exists
            const existingBudget = customBudgets.find(
              (b) => b.category_id === categoryId && b.month === month && b.year === selectedYear,
            )

            if (existingBudget) {
              // Update the existing budget
              return await updateBudget(existingBudget.id, budgetAmount, false, month)
            } else {
              // Insert a new budget for this month
              const { data: newBudget, error: insertError } = await supabase
                .from("budgets")
                .insert({
                  user_id: user.id,
                  category_id: categoryId,
                  amount: budgetAmount,
                  month: month,
                  year: selectedYear,
                  is_recurring: false,
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
                setCustomBudgets((prev) => [...prev, formattedBudget])
              }

              return { success: true, message: `Budget for ${month}/${selectedYear} added successfully!` }
            }
          }),
        )

        // Check if all operations were successful
        const allSuccessful = results.every((result) => result.success)
        if (!allSuccessful) {
          const errors = results.filter((result) => !result.success).map((result) => result.error)
          return { success: false, error: `Some budgets could not be added: ${errors.join(", ")}` }
        }

        return {
          success: true,
          message: `Custom budget${applyToMonths.length > 1 ? "s" : ""} added/updated successfully!`,
        }
      }
    } catch (err: any) {
      console.error("Error adding budget:", err)
      return { success: false, error: err.message || "Failed to add budget" }
    }
  }

  const updateBudget = async (budgetId: string, amount: number, isBase: boolean, month?: number) => {
    if (!user) return { success: false, error: "User not authenticated" }

    try {
      const supabase = getSupabaseBrowser()
      const budgetAmount = Math.abs(amount)

      if (isBase) {
        // Updating a base budget - use month=0 instead of null to indicate base budget
        const { error: updateError } = await supabase
          .from("budgets")
          .update({
            amount: budgetAmount,
            is_recurring: true,
            month: 0, // Use 0 instead of null for base budgets
            year: selectedYear,
          })
          .eq("id", budgetId)
          .eq("user_id", user.id)

        if (updateError) throw updateError

        // Update the budget in the local state
        setBaseBudgets((prev) =>
          prev.map((b) =>
            b.id === budgetId
              ? {
                  ...b,
                  amount: budgetAmount,
                  is_recurring: true,
                  month: 0, // Use 0 in state as well
                  year: selectedYear,
                }
              : b,
          ),
        )

        return { success: true, message: "Base budget updated successfully!" }
      } else {
        // Updating a custom budget
        const { error: updateError } = await supabase
          .from("budgets")
          .update({
            amount: budgetAmount,
            is_recurring: false,
            month: month || selectedMonth,
            year: selectedYear,
          })
          .eq("id", budgetId)
          .eq("user_id", user.id)

        if (updateError) throw updateError

        // Update the budget in the local state
        setCustomBudgets((prev) =>
          prev.map((b) =>
            b.id === budgetId
              ? {
                  ...b,
                  amount: budgetAmount,
                  is_recurring: false,
                  month: month || selectedMonth,
                  year: selectedYear,
                }
              : b,
          ),
        )

        return { success: true, message: "Custom budget updated successfully!" }
      }
    } catch (err: any) {
      console.error("Error updating budget:", err)
      return { success: false, error: err.message || "Failed to update budget" }
    }
  }

  const deleteBudget = async (budgetId: string) => {
    if (!user) return { success: false, error: "User not authenticated" }

    try {
      const supabase = getSupabaseBrowser()

      // Find the budget to determine if it's base or custom
      const baseBudget = baseBudgets.find((b) => b.id === budgetId)
      const customBudget = customBudgets.find((b) => b.id === budgetId)

      // Delete the budget
      const { error: deleteError } = await supabase.from("budgets").delete().eq("id", budgetId).eq("user_id", user.id)

      if (deleteError) throw deleteError

      // Update local state by removing the deleted budget
      if (baseBudget) {
        setBaseBudgets((prev) => prev.filter((budget) => budget.id !== budgetId))
      } else if (customBudget) {
        setCustomBudgets((prev) => prev.filter((budget) => budget.id !== budgetId))
      }

      return { success: true, message: "Budget deleted successfully!" }
    } catch (err: any) {
      console.error("Error deleting budget:", err)
      return { success: false, error: err.message || "Failed to delete budget" }
    }
  }

  return {
    // State
    loading,
    error,
    categories,
    baseBudgets,
    customBudgets,
    selectedMonth,
    selectedYear,
    annualData,
    effectiveBudgets,
    budgetWithActuals,
    monthlySummary,

    // Actions
    setSelectedMonth,
    setSelectedYear,
    goToPreviousMonth,
    goToNextMonth,
    fetchData,
    addBudget,
    updateBudget,
    deleteBudget,
  }
}

