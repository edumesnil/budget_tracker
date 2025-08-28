"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { format, subMonths, addMonths } from "date-fns"
import { handleSupabaseError } from "@/lib/query-utils"
import { useQueries, useQueryClient } from "@tanstack/react-query"

export interface DashboardData {
  monthlyData: {
    totalIncome: number
    totalExpenses: number
    budgetedIncome: number
    budgetedExpenses: number
    incomeVariance: number
    expenseVariance: number
    netVariance: number
    month: string
  } | null
  categories: any[]
  categoryPerformance: any[]
  spendingTrend: any[]
  upcomingExpenses: any[]
  topOverBudgetCategories: any[]
  topUnderBudgetCategories: any[]
  monthOptions: { label: string; value: string }[]
}

// OPTIMIZATION 1: Optimize Query Keys and Caching
// Define consistent query key factory functions with more granular structure
const getDashboardBaseKey = (userId?: string) => ["dashboard", userId || "anonymous"]
const getTransactionsKey = (userId?: string, year?: number, month?: number) => [
  "dashboard",
  "transactions",
  userId || "anonymous",
  year,
  month,
]
const getBudgetsKey = (userId?: string, year?: number, month?: number) => [
  "dashboard",
  "budgets",
  userId || "anonymous",
  year,
  month,
]
const getBaseBudgetsKey = (userId?: string) => ["dashboard", "baseBudgets", userId || "anonymous"]
const getCategoriesKey = (userId?: string) => ["dashboard", "categories", userId || "anonymous"]
const getTrendKey = (userId?: string, year?: number, month?: number) => [
  "dashboard",
  "trend",
  userId || "anonymous",
  year,
  month,
]

export function useDashboardDataQuery(initialDate = new Date()) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [monthOptions, setMonthOptions] = useState<{ label: string; value: string }[]>([])

  // Generate month options for the dropdown (last 12 months)
  useEffect(() => {
    const currentDate = new Date()
    const options = []
    for (let i = 0; i < 12; i++) {
      const date = subMonths(currentDate, i)
      options.push({
        label: format(date, "MMMM yyyy"),
        value: format(date, "yyyy-MM"),
      })
    }
    setMonthOptions(options)
  }, [])

  // Selected month range - memoized to avoid recalculations
  const dateRange = useMemo(() => {
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
    return {
      startOfMonth,
      endOfMonth,
      startDateStr: startOfMonth.toISOString().split("T")[0],
      endDateStr: endOfMonth.toISOString().split("T")[0],
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
    }
  }, [selectedDate])

  // OPTIMIZATION 3 & 4: Split Queries for Better Performance & Implement Parallel Queries
  // Use useQueries to run multiple queries in parallel
  const queryResults = useQueries({
    queries: [
      // 1. Fetch transactions for the selected month
      {
        queryKey: getTransactionsKey(user?.id, dateRange.year, dateRange.month),
        queryFn: async () => {
          const supabase = await import("@/lib/supabase").then((mod) => mod.getSupabaseBrowser())
          const { data, error } = await supabase
            .from("transactions")
            .select(`
              id,
              date,
              amount,
              description,
              category_id,
              categories:category_id (
                id,
                name,
                type,
                color,
                icon
              )
            `)
            .eq("user_id", user?.id)
            .gte("date", dateRange.startDateStr)
            .lte("date", dateRange.endDateStr)

          if (error) throw error
          return data || []
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
        enabled: !!user?.id,
        retry: 2,
      },

      // 2. Fetch budget data for the selected month
      {
        queryKey: getBudgetsKey(user?.id, dateRange.year, dateRange.month),
        queryFn: async () => {
          const supabase = await import("@/lib/supabase").then((mod) => mod.getSupabaseBrowser())
          const { data, error } = await supabase
            .from("budgets")
            .select(`
              id,
              amount,
              category_id,
              categories:category_id (
                id,
                name,
                type,
                color,
                icon
              )
            `)
            .eq("user_id", user?.id)
            .eq("month", dateRange.month)
            .eq("year", dateRange.year)

          if (error) throw error
          return data || []
        },
        staleTime: 5 * 60 * 1000,
        cacheTime: 30 * 60 * 1000,
        enabled: !!user?.id,
        retry: 2,
      },

      // 3. Fetch base budgets (recurring monthly)
      {
        queryKey: getBaseBudgetsKey(user?.id),
        queryFn: async () => {
          const supabase = await import("@/lib/supabase").then((mod) => mod.getSupabaseBrowser())
          const { data, error } = await supabase
            .from("budgets")
            .select(`
              id,
              amount,
              category_id,
              categories:category_id (
                id,
                name,
                type,
                color,
                icon
              )
            `)
            .eq("user_id", user?.id)
            .eq("is_recurring", true)
            .is("month", null)
            .is("year", null)

          if (error) throw error
          return data || []
        },
        staleTime: 10 * 60 * 1000, // 10 minutes (base budgets change less frequently)
        cacheTime: 60 * 60 * 1000, // 1 hour
        enabled: !!user?.id,
        retry: 2,
      },

      // 4. Fetch categories
      {
        queryKey: getCategoriesKey(user?.id),
        queryFn: async () => {
          const supabase = await import("@/lib/supabase").then((mod) => mod.getSupabaseBrowser())
          const { data, error } = await supabase.from("categories").select("*").eq("user_id", user?.id)

          if (error) throw error
          return data || []
        },
        staleTime: 10 * 60 * 1000, // 10 minutes (categories change less frequently)
        cacheTime: 60 * 60 * 1000, // 1 hour
        enabled: !!user?.id,
        retry: 2,
      },

      // 5. Fetch transactions for spending trend (last 3 months)
      {
        queryKey: getTrendKey(user?.id, dateRange.year, dateRange.month),
        queryFn: async () => {
          const supabase = await import("@/lib/supabase").then((mod) => mod.getSupabaseBrowser())
          const threeMonthsAgo = subMonths(dateRange.endOfMonth, 2)
          const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0]

          const { data, error } = await supabase
            .from("transactions")
            .select("date, amount, categories:category_id (type)")
            .eq("user_id", user?.id)
            .gte("date", threeMonthsAgoStr)
            .lte("date", dateRange.endDateStr)

          if (error) throw error
          return data || []
        },
        staleTime: 5 * 60 * 1000,
        cacheTime: 30 * 60 * 1000,
        enabled: !!user?.id,
        retry: 2,
      },
    ],
  })

  // Extract data and loading states from parallel queries
  const [
    {
      data: transactions = [],
      isLoading: loadingTransactions,
      isFetching: fetchingTransactions,
      error: transactionsError,
    },
    { data: budgets = [], isLoading: loadingBudgets, isFetching: fetchingBudgets, error: budgetsError },
    { data: baseBudgets = [], isLoading: loadingBaseBudgets, isFetching: fetchingBaseBudgets, error: baseBudgetsError },
    { data: categories = [], isLoading: loadingCategories, isFetching: fetchingCategories, error: categoriesError },
    { data: trendTransactions = [], isLoading: loadingTrend, isFetching: fetchingTrend, error: trendError },
  ] = queryResults

  // OPTIMIZATION 2: Implement Proper Cache Invalidation
  const invalidateDashboardData = useCallback(() => {
    if (!user?.id) return

    // Invalidate all dashboard-related queries
    queryClient.invalidateQueries({
      queryKey: getDashboardBaseKey(user.id),
    })
  }, [queryClient, user?.id])

  // Prefetch adjacent months for smoother navigation
  useEffect(() => {
    if (!user?.id) return

    // Prefetch next month if not at current month
    const nextMonth = addMonths(selectedDate, 1)
    const currentDate = new Date()
    if (nextMonth <= currentDate) {
      const nextMonthYear = nextMonth.getFullYear()
      const nextMonthMonth = nextMonth.getMonth() + 1

      // Prefetch transactions for next month
      queryClient.prefetchQuery({
        queryKey: getTransactionsKey(user.id, nextMonthYear, nextMonthMonth),
        queryFn: async () => {
          const supabase = await import("@/lib/supabase").then((mod) => mod.getSupabaseBrowser())
          const startOfMonth = new Date(nextMonthYear, nextMonthMonth - 1, 1)
          const endOfMonth = new Date(nextMonthYear, nextMonthMonth, 0)

          const { data } = await supabase
            .from("transactions")
            .select(`
              id,
              date,
              amount,
              description,
              category_id,
              categories:category_id (
                id,
                name,
                type,
                color,
                icon
              )
            `)
            .eq("user_id", user.id)
            .gte("date", startOfMonth.toISOString().split("T")[0])
            .lte("date", endOfMonth.toISOString().split("T")[0])

          return data || []
        },
      })

      // Prefetch budgets for next month
      queryClient.prefetchQuery({
        queryKey: getBudgetsKey(user.id, nextMonthYear, nextMonthMonth),
        queryFn: async () => {
          const supabase = await import("@/lib/supabase").then((mod) => mod.getSupabaseBrowser())

          const { data } = await supabase
            .from("budgets")
            .select(`
              id,
              amount,
              category_id,
              categories:category_id (
                id,
                name,
                type,
                color,
                icon
              )
            `)
            .eq("user_id", user.id)
            .eq("month", nextMonthMonth)
            .eq("year", nextMonthYear)

          return data || []
        },
      })
    }

    // Prefetch previous month
    const prevMonth = subMonths(selectedDate, 1)
    const prevMonthYear = prevMonth.getFullYear()
    const prevMonthMonth = prevMonth.getMonth() + 1

    // Prefetch transactions for previous month
    queryClient.prefetchQuery({
      queryKey: getTransactionsKey(user.id, prevMonthYear, prevMonthMonth),
      queryFn: async () => {
        const supabase = await import("@/lib/supabase").then((mod) => mod.getSupabaseBrowser())
        const startOfMonth = new Date(prevMonthYear, prevMonthMonth - 1, 1)
        const endOfMonth = new Date(prevMonthYear, prevMonthMonth, 0)

        const { data } = await supabase
          .from("transactions")
          .select(`
            id,
            date,
            amount,
            description,
            category_id,
            categories:category_id (
              id,
              name,
              type,
              color,
              icon
            )
          `)
          .eq("user_id", user.id)
          .gte("date", startOfMonth.toISOString().split("T")[0])
          .lte("date", endOfMonth.toISOString().split("T")[0])

        return data || []
      },
    })

    // Prefetch budgets for previous month
    queryClient.prefetchQuery({
      queryKey: getBudgetsKey(user.id, prevMonthYear, prevMonthMonth),
      queryFn: async () => {
        const supabase = await import("@/lib/supabase").then((mod) => mod.getSupabaseBrowser())

        const { data } = await supabase
          .from("budgets")
          .select(`
            id,
            amount,
            category_id,
            categories:category_id (
              id,
              name,
              type,
              color,
              icon
            )
          `)
          .eq("user_id", user.id)
          .eq("month", prevMonthMonth)
          .eq("year", prevMonthYear)

        return data || []
      },
    })
  }, [selectedDate, user?.id, queryClient])

  // Process the data using memoization to avoid recalculations

  // 1. Calculate monthly summary
  const monthlyData = useMemo(() => {
    if (!transactions || !budgets || !baseBudgets) return null

    let totalIncome = 0
    let totalExpenses = 0

    transactions.forEach((transaction) => {
      if (transaction.amount > 0) {
        totalIncome += transaction.amount
      } else {
        totalExpenses += Math.abs(transaction.amount)
      }
    })

    // Combine base budgets and month-specific budgets
    const effectiveBudgets = [...baseBudgets]

    // Override base budgets with month-specific ones where applicable
    budgets.forEach((budget) => {
      const baseIndex = effectiveBudgets.findIndex((b) => b.category_id === budget.category_id)
      if (baseIndex >= 0) {
        effectiveBudgets[baseIndex] = budget
      } else {
        effectiveBudgets.push(budget)
      }
    })

    // Calculate budget totals
    let budgetedIncome = 0
    let budgetedExpenses = 0

    effectiveBudgets.forEach((budget) => {
      if (budget.categories?.type === "INCOME") {
        budgetedIncome += budget.amount
      } else if (budget.categories?.type === "EXPENSE") {
        budgetedExpenses += Math.abs(budget.amount)
      }
    })

    // Calculate variance
    const incomeVariance = totalIncome - budgetedIncome
    const expenseVariance = budgetedExpenses - totalExpenses
    const netVariance = totalIncome - totalExpenses - (budgetedIncome - budgetedExpenses)

    return {
      totalIncome,
      totalExpenses,
      budgetedIncome,
      budgetedExpenses,
      incomeVariance,
      expenseVariance,
      netVariance,
      month: format(selectedDate, "MMMM yyyy"),
      effectiveBudgets, // Pass this to other calculations
    }
  }, [transactions, budgets, baseBudgets, selectedDate])

  // 2. Calculate category performance
  const categoryPerformance = useMemo(() => {
    if (!transactions || !monthlyData?.effectiveBudgets) return []

    const categoryMap = new Map()

    // Initialize with budget amounts
    monthlyData.effectiveBudgets.forEach((budget) => {
      if (!budget.categories) return

      categoryMap.set(budget.category_id, {
        id: budget.category_id,
        name: budget.categories.name,
        type: budget.categories.type,
        color: budget.categories.color,
        icon: budget.categories.icon,
        budgeted: Math.abs(budget.amount),
        actual: 0,
        variance: 0,
        percentage: 0,
      })
    })

    // Add transaction amounts
    transactions.forEach((transaction) => {
      if (!transaction.category_id) return

      const category = categoryMap.get(transaction.category_id)

      if (category) {
        category.actual += Math.abs(transaction.amount)
      } else if (transaction.categories) {
        // Category has transactions but no budget
        categoryMap.set(transaction.category_id, {
          id: transaction.category_id,
          name: transaction.categories.name,
          type: transaction.categories.type,
          color: transaction.categories.color,
          icon: transaction.categories.icon,
          budgeted: 0,
          actual: Math.abs(transaction.amount),
          variance: 0,
          percentage: 100, // 100% over budget
        })
      }
    })

    // Calculate variance and percentage for each category
    categoryMap.forEach((category) => {
      if (category.type === "EXPENSE") {
        category.variance = category.budgeted - category.actual
        category.percentage = category.budgeted > 0 ? (category.actual / category.budgeted) * 100 : 100
      } else {
        category.variance = category.actual - category.budgeted
        category.percentage = category.budgeted > 0 ? (category.actual / category.budgeted) * 100 : 100
      }
    })

    // Convert to array
    return Array.from(categoryMap.values())
  }, [transactions, monthlyData?.effectiveBudgets])

  // 3. Process spending trend data
  const spendingTrend = useMemo(() => {
    if (!trendTransactions) return []

    const monthlySpending = {}

    trendTransactions.forEach((transaction) => {
      if (transaction.categories?.type !== "EXPENSE") return

      const month = transaction.date.substring(0, 7) // YYYY-MM format
      if (!monthlySpending[month]) {
        monthlySpending[month] = 0
      }
      monthlySpending[month] += Math.abs(transaction.amount)
    })

    // Convert to array for the chart
    return Object.entries(monthlySpending)
      .map(([month, amount]) => ({
        month: format(new Date(month + "-01"), "MMM"),
        amount,
      }))
      .sort((a, b) => {
        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
      })
  }, [trendTransactions])

  // 4. Generate top over/under budget categories
  const { topOverBudgetCategories, topUnderBudgetCategories } = useMemo(() => {
    if (!categoryPerformance) return { topOverBudgetCategories: [], topUnderBudgetCategories: [] }

    const overBudget = categoryPerformance
      .filter((cat) => cat.type === "EXPENSE" && cat.budgeted > 0)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)

    const underBudget = categoryPerformance
      .filter((cat) => cat.type === "EXPENSE" && cat.budgeted > 0 && cat.percentage < 100)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3)

    return { topOverBudgetCategories: overBudget, topUnderBudgetCategories: underBudget }
  }, [categoryPerformance])

  // 5. Generate upcoming expenses (simulated for this example)
  const upcomingExpenses = useMemo(() => {
    return [
      {
        id: "1",
        description: "Rent Payment",
        amount: 1200,
        dueDate: addMonths(new Date(), 1).setDate(1),
        category: "Housing",
        categoryColor: "#18a57b",
      },
      {
        id: "2",
        description: "Car Insurance",
        amount: 150,
        dueDate: new Date().setDate(new Date().getDate() + 5),
        category: "Insurance",
        categoryColor: "#f97316",
      },
      {
        id: "3",
        description: "Internet Bill",
        amount: 75,
        dueDate: new Date().setDate(new Date().getDate() + 12),
        category: "Utilities",
        categoryColor: "#6366f1",
      },
      {
        id: "4",
        description: "Phone Bill",
        amount: 85,
        dueDate: new Date().setDate(new Date().getDate() + 18),
        category: "Utilities",
        categoryColor: "#6366f1",
      },
    ].sort((a, b) => a.dueDate - b.dueDate)
  }, [])

  // OPTIMIZATION 5: Enhance Loading and Error States
  // Provide more granular loading states
  const isInitialLoading =
    loadingTransactions || loadingBudgets || loadingBaseBudgets || loadingCategories || loadingTrend

  const isRefetching =
    !isInitialLoading &&
    (fetchingTransactions || fetchingBudgets || fetchingBaseBudgets || fetchingCategories || fetchingTrend)

  // Combine all errors
  useEffect(() => {
    const allErrors = [transactionsError, budgetsError, baseBudgetsError, categoriesError, trendError].filter(Boolean)

    if (allErrors.length > 0) {
      setError(`Failed to load dashboard data: ${allErrors.map((err) => handleSupabaseError(err)).join(", ")}`)
    } else {
      setError(null)
    }
  }, [transactionsError, budgetsError, baseBudgetsError, categoriesError, trendError])

  // Handle month navigation
  const goToPreviousMonth = useCallback(() => {
    setSelectedDate((prevDate) => subMonths(prevDate, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    const nextMonth = addMonths(selectedDate, 1)
    const currentDate = new Date()
    if (nextMonth <= currentDate) {
      setSelectedDate(nextMonth)
    }
  }, [selectedDate])

  const handleMonthChange = useCallback((value: string) => {
    const [year, month] = value.split("-").map(Number)
    const newDate = new Date(year, month - 1, 1)
    setSelectedDate(newDate)
  }, [])

  // OPTIMIZATION 6: Implement Optimistic Updates
  // This function can be used by transaction and budget mutations
  const updateDashboardWithTransaction = useCallback(
    (newTransaction) => {
      if (!user?.id) return

      // Get the current month's transactions
      const currentTransactionsKey = getTransactionsKey(
        user.id,
        selectedDate.getFullYear(),
        selectedDate.getMonth() + 1,
      )

      // Optimistically update transactions
      queryClient.setQueryData(currentTransactionsKey, (oldTransactions: any[] = []) => {
        // Check if transaction belongs to current month
        const transactionDate = new Date(newTransaction.date)
        if (
          transactionDate.getMonth() === selectedDate.getMonth() &&
          transactionDate.getFullYear() === selectedDate.getFullYear()
        ) {
          // Add or update transaction
          const existingIndex = oldTransactions.findIndex((t) => t.id === newTransaction.id)
          if (existingIndex >= 0) {
            return [
              ...oldTransactions.slice(0, existingIndex),
              newTransaction,
              ...oldTransactions.slice(existingIndex + 1),
            ]
          } else {
            return [...oldTransactions, newTransaction]
          }
        }
        return oldTransactions
      })
    },
    [queryClient, selectedDate, user?.id],
  )

  // Combine all data for the return value
  const dashboardData: DashboardData = {
    monthlyData: monthlyData
      ? {
          totalIncome: monthlyData.totalIncome,
          totalExpenses: monthlyData.totalExpenses,
          budgetedIncome: monthlyData.budgetedIncome,
          budgetedExpenses: monthlyData.budgetedExpenses,
          incomeVariance: monthlyData.incomeVariance,
          expenseVariance: monthlyData.expenseVariance,
          netVariance: monthlyData.netVariance,
          month: monthlyData.month,
        }
      : null,
    categories,
    categoryPerformance,
    spendingTrend,
    upcomingExpenses,
    topOverBudgetCategories,
    topUnderBudgetCategories,
    monthOptions,
  }

  // Return the same API as the original hook, plus new optimization functions
  return {
    loading: isInitialLoading,
    isRefetching,
    error,
    selectedDate,
    setSelectedDate,
    goToPreviousMonth,
    goToNextMonth,
    handleMonthChange,
    invalidateDashboardData,
    updateDashboardWithTransaction,
    ...dashboardData,
  }
}

