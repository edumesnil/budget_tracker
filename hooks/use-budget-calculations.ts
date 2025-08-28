"use client"

import { useMemo } from "react"

export function useBudgetCalculations({
  baseBudgets,
  customBudgets,
  transactions,
  categories,
  selectedMonth,
  selectedYear,
}: {
  baseBudgets: any[]
  customBudgets: any[]
  transactions: any[]
  categories: any[]
  selectedMonth: number
  selectedYear: number
}) {
  // Compute the effective budgets for the selected month
  const effectiveBudgets = useMemo(() => {
    // Start with base budgets
    const result = [...baseBudgets]

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

  // Calculate monthly budget summaries for the annual view
  const annualData = useMemo(() => {
    if (!baseBudgets.length && !customBudgets.length && !transactions.length) {
      return []
    }

    const monthlySummaries = []

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

    return monthlySummaries
  }, [baseBudgets, customBudgets, transactions, selectedYear])

  return {
    effectiveBudgets,
    budgetWithActuals,
    monthlySummary,
    annualData,
  }
}

