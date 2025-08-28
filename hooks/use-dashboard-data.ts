"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseBrowser } from "@/lib/supabase"
import { format, subMonths, addMonths } from "date-fns"

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

export function useDashboardData(initialDate = new Date()) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    monthlyData: null,
    categories: [],
    categoryPerformance: [],
    spendingTrend: [],
    upcomingExpenses: [],
    topOverBudgetCategories: [],
    topUnderBudgetCategories: [],
    monthOptions: [],
  })

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
    setDashboardData((prev) => ({ ...prev, monthOptions: options }))
  }, [])

  // Handle month navigation
  const goToPreviousMonth = () => {
    setSelectedDate((prevDate) => subMonths(prevDate, 1))
  }

  const goToNextMonth = () => {
    const nextMonth = addMonths(selectedDate, 1)
    const currentDate = new Date()
    if (nextMonth <= currentDate) {
      setSelectedDate(nextMonth)
    }
  }

  const handleMonthChange = (value: string) => {
    const [year, month] = value.split("-").map(Number)
    const newDate = new Date(year, month - 1, 1)
    setSelectedDate(newDate)
  }

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        const supabase = getSupabaseBrowser()

        // Selected month range
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)

        // Format dates for queries
        const startDateStr = startOfMonth.toISOString().split("T")[0]
        const endDateStr = endOfMonth.toISOString().split("T")[0]

        // 1. Fetch transactions for the selected month
        const { data: transactions, error: transactionsError } = await supabase
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
          .gte("date", startDateStr)
          .lte("date", endDateStr)

        if (transactionsError) throw transactionsError

        // 2. Fetch budget data for the selected month
        const { data: budgets, error: budgetsError } = await supabase
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
          .eq("month", selectedDate.getMonth() + 1)
          .eq("year", selectedDate.getFullYear())

        if (budgetsError) throw budgetsError

        // 3. Fetch base budgets (recurring monthly)
        const { data: baseBudgets, error: baseBudgetsError } = await supabase
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
          .eq("month", 0)

        if (baseBudgetsError) throw baseBudgetsError

        // 4. Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("*")
          .eq("user_id", user.id)

        if (categoriesError) throw categoriesError

        // 5. Fetch transactions for spending trend (last 3 months)
        const threeMonthsAgo = subMonths(endOfMonth, 2)
        const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0]

        const { data: trendTransactions, error: trendError } = await supabase
          .from("transactions")
          .select("date, amount, categories:category_id (type)")
          .eq("user_id", user.id)
          .gte("date", threeMonthsAgoStr)
          .lte("date", endDateStr)

        if (trendError) throw trendError

        // Process the data

        // 1. Calculate monthly summary
        let totalIncome = 0
        let totalExpenses = 0

        transactions?.forEach((transaction) => {
          if (transaction.amount > 0) {
            totalIncome += transaction.amount
          } else {
            totalExpenses += Math.abs(transaction.amount)
          }
        })

        // Combine base budgets and month-specific budgets
        const effectiveBudgets = [...(baseBudgets || [])]

        // Override base budgets with month-specific ones where applicable
        budgets?.forEach((budget) => {
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

        // 2. Calculate category performance
        const categoryMap = new Map()

        // Initialize with budget amounts
        effectiveBudgets.forEach((budget) => {
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
        transactions?.forEach((transaction) => {
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

        // Convert to array and sort
        const categoryPerformanceArray = Array.from(categoryMap.values())

        // 3. Process spending trend data
        const monthlySpending = {}

        trendTransactions?.forEach((transaction) => {
          if (transaction.categories?.type !== "EXPENSE") return

          const month = transaction.date.substring(0, 7) // YYYY-MM format
          if (!monthlySpending[month]) {
            monthlySpending[month] = 0
          }
          monthlySpending[month] += Math.abs(transaction.amount)
        })

        // Convert to array for the chart
        const trendData = Object.entries(monthlySpending)
          .map(([month, amount]) => ({
            month: format(new Date(month), "MMM"),
            amount,
          }))
          .sort((a, b) => {
            return new Date(a.month) > new Date(b.month) ? 1 : -1
          })

        // 4. Generate upcoming expenses (simulated for this example)
        // In a real app, you would fetch scheduled transactions or recurring bills
        const upcomingExpensesData = [
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
        ]

        // Sort upcoming expenses by due date
        upcomingExpensesData.sort((a, b) => a.dueDate - b.dueDate)

        const overBudget = categoryPerformanceArray
          .filter((cat) => cat.type === "EXPENSE" && cat.budgeted > 0)
          .sort((a, b) => b.percentage - a.percentage)
          .slice(0, 3)

        const underBudget = categoryPerformanceArray
          .filter((cat) => cat.type === "EXPENSE" && cat.budgeted > 0 && cat.percentage < 100)
          .sort((a, b) => a.percentage - b.percentage)
          .slice(0, 3)

        // Update state with processed data
        setDashboardData({
          monthlyData: {
            totalIncome,
            totalExpenses,
            budgetedIncome,
            budgetedExpenses,
            incomeVariance,
            expenseVariance,
            netVariance,
            month: format(selectedDate, "MMMM yyyy"),
          },
          categories: categoriesData || [],
          categoryPerformance: categoryPerformanceArray,
          spendingTrend: trendData,
          upcomingExpenses: upcomingExpensesData,
          topOverBudgetCategories: overBudget,
          topUnderBudgetCategories: underBudget,
          monthOptions: dashboardData.monthOptions,
        })
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err)
        setError(err.message || "Failed to load dashboard data")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user, selectedDate])

  return {
    loading,
    error,
    selectedDate,
    setSelectedDate,
    goToPreviousMonth,
    goToNextMonth,
    handleMonthChange,
    ...dashboardData,
  }
}

