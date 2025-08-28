"use client"

import { useState, useCallback, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useSupabaseQuery, useSupabaseMutation, handleSupabaseError } from "@/lib/query-utils"
import { queryClient } from "@/lib/react-query"

export type Transaction = {
  id: string
  date: string
  description: string | null
  amount: number
  category_id: string | null
  category_name?: string
  category_type?: "INCOME" | "EXPENSE"
  notes?: string | null
  categories?: {
    icon?: string | null
    color?: string | null
  }
}

export type Category = {
  id: string
  name: string
  type: "INCOME" | "EXPENSE"
  color?: string | null
  icon?: string | null
}

export type TransactionFormData = {
  description: string
  amount: string
  date: string
  categoryId: string
  notes: string
}

// Define consistent query key factory functions
const transactionsKey = "transactions"
const categoriesKey = "categories"

export const getTransactionsQueryKey = (userId?: string, month?: number, year?: number) =>
  month !== undefined && year !== undefined
    ? [transactionsKey, userId || "anonymous", month, year]
    : [transactionsKey, userId || "anonymous"]

export const getCategoriesQueryKey = (userId?: string) => [categoriesKey, userId || "anonymous"]

// Type for optimistic update context
export type OptimisticContext = {
  previousTransactions: Transaction[]
}

// Helper function to sort transactions by date (descending)
const sortTransactionsByDate = (transactions: Transaction[]): Transaction[] => {
  return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function useTransactionData() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)

  // Month filter state
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  // Month names for the dropdown
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

  // Query keys - using the factory functions for consistency
  const monthlyTransactionsKey = getTransactionsQueryKey(user?.id, selectedMonth, selectedYear)
  const categoriesKey = getCategoriesQueryKey(user?.id)

  // Calculate date range for the selected month
  const getDateRangeForMonth = useCallback(() => {
    const startDate = new Date(selectedYear, selectedMonth, 1)
    const endDate = new Date(selectedYear, selectedMonth + 1, 0)
    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    }
  }, [selectedMonth, selectedYear])

  // Helper function to check if a transaction belongs to the current month
  const isTransactionInCurrentMonth = useCallback(
    (date: string) => {
      const transactionDate = new Date(date)
      return transactionDate.getMonth() === selectedMonth && transactionDate.getFullYear() === selectedYear
    },
    [selectedMonth, selectedYear],
  )

  // Fetch transactions query with date range filtering
  const {
    data: transactions = [],
    isLoading: loadingTransactions,
    isFetching: fetchingTransactions,
    refetch: refetchTransactions,
  } = useSupabaseQuery<Transaction[]>(
    monthlyTransactionsKey,
    async (supabase, userId) => {
      if (!userId) return []

      const { startDate, endDate } = getDateRangeForMonth()

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id,
          date,
          description,
          amount,
          category_id,
          notes,
          categories:category_id (
            name,
            type,
            icon,
            color
          )
        `)
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false })

      if (error) throw error

      // Transform the data to include category name and type
      return data.map((transaction: any) => ({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        category_id: transaction.category_id,
        category_name: transaction.categories?.name || "Uncategorized",
        category_type: transaction.categories?.type || null,
        notes: transaction.notes,
        categories: {
          icon: transaction.categories?.icon || null,
          color: transaction.categories?.color || null,
        },
      }))
    },
    {
      onError: (err) => {
        setError(`Failed to load transactions: ${handleSupabaseError(err)}`)
      },
      staleTime: 0, // Always consider data stale
      enabled: !!user?.id, // Only fetch when user is available
    },
  )

  // Effect to refetch transactions when month/year changes
  useEffect(() => {
    if (user?.id) {
      refetchTransactions()
    }
  }, [selectedMonth, selectedYear, user?.id, refetchTransactions])

  // Fetch categories query
  const {
    data: categories = [],
    isLoading: loadingCategories,
    isFetching: fetchingCategories,
  } = useSupabaseQuery<Category[]>(
    categoriesKey,
    async (supabase, userId) => {
      if (!userId) return []

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, type, color, icon")
        .eq("user_id", userId)
        .order("name")

      if (error) throw error
      return data || []
    },
    {
      onError: (err) => {
        console.error("Error fetching categories:", handleSupabaseError(err))
      },
      enabled: !!user?.id, // Only fetch when user is available
    },
  )

  // Create a stable fetch function for categories
  const fetchCategories = useCallback(() => {
    if (!user?.id) return Promise.resolve([])
    return queryClient.fetchQuery({
      queryKey: categoriesKey,
    })
  }, [categoriesKey, user?.id])

  // Delete transaction mutation
  const { mutateAsync: deleteTransactionMutation } = useSupabaseMutation<boolean, string>(
    async (transactionId, supabase, userId) => {
      if (!userId) throw new Error("User not authenticated")

      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId)
        .eq("user_id", userId)

      if (deleteError) throw deleteError
      return true
    },
    {
      // Optimistic update for better UX
      onMutate: async (transactionId) => {
        // Clear any existing errors
        setError(null)

        // Cancel any outgoing refetches to avoid overwriting our optimistic update
        await queryClient.cancelQueries({ queryKey: monthlyTransactionsKey })

        // Snapshot the previous value
        const previousTransactions = queryClient.getQueryData<Transaction[]>(monthlyTransactionsKey) || []

        // Optimistically remove the transaction from the UI
        queryClient.setQueryData<Transaction[]>(monthlyTransactionsKey, (old = []) =>
          old.filter((t) => t.id !== transactionId),
        )

        // Return the snapshot so we can rollback if something goes wrong
        return { previousTransactions }
      },
      onSuccess: () => {
        setError(null) // Explicitly clear error state
        toast({
          title: "Success",
          description: "Transaction deleted successfully!",
          variant: "success",
          duration: 3000,
        })
      },
      onError: (err, _, context) => {
        const errorMessage = handleSupabaseError(err)
        setError(`Failed to delete transaction: ${errorMessage}`)
        toast({
          title: "Error",
          description: `Failed to delete transaction: ${errorMessage}`,
          variant: "destructive",
          duration: 5000,
        })

        // Rollback to the previous state if we have it
        if (context?.previousTransactions) {
          queryClient.setQueryData(monthlyTransactionsKey, context.previousTransactions)
        }
      },
      // Always refetch after error or success to ensure data consistency
      onSettled: () => {
        // Force a refetch of the current month's data
        refetchTransactions()
      },
    },
  )

  // Save transaction mutation (handles both add and edit)
  const { mutateAsync: saveTransactionMutation } = useSupabaseMutation<
    Transaction | null,
    { formData: TransactionFormData; transactionId?: string }
  >(
    async ({ formData, transactionId }, supabase, userId) => {
      if (!userId) throw new Error("User not authenticated")

      // Validate inputs
      if (!formData.description) {
        throw new Error("Please enter a description")
      }

      if (!formData.amount || isNaN(Number.parseFloat(formData.amount))) {
        throw new Error("Please enter a valid amount")
      }

      if (!formData.date) {
        throw new Error("Please select a date")
      }

      if (!formData.categoryId) {
        throw new Error("Please select a category")
      }

      // Get the category to determine if it's income or expense
      let adjustedAmount = Number.parseFloat(formData.amount)
      const selectedCategory = categories.find((cat) => cat.id === formData.categoryId)

      // Adjust amount sign based on category type
      if (selectedCategory?.type === "EXPENSE") {
        adjustedAmount = Math.abs(adjustedAmount) * -1
      } else if (selectedCategory?.type === "INCOME") {
        adjustedAmount = Math.abs(adjustedAmount)
      }

      // Prepare the transaction data
      const transactionData = {
        description: formData.description,
        amount: adjustedAmount,
        date: formData.date,
        category_id: formData.categoryId,
        notes: formData.notes || null,
      }

      if (transactionId) {
        // Update existing transaction
        const { data, error: updateError } = await supabase
          .from("transactions")
          .update(transactionData)
          .eq("id", transactionId)
          .eq("user_id", userId)
          .select(`
            id,
            date,
            description,
            amount,
            category_id,
            notes,
            categories:category_id (
              name,
              type,
              icon,
              color
            )
          `)

        if (updateError) throw updateError

        if (data && data.length > 0) {
          const formattedTransaction = {
            id: data[0].id,
            date: data[0].date,
            description: data[0].description,
            amount: data[0].amount,
            category_id: data[0].category_id,
            category_name: data[0].categories?.name || "Uncategorized",
            category_type: data[0].categories?.type || null,
            notes: data[0].notes,
            categories: {
              icon: data[0].categories?.icon || null,
              color: data[0].categories?.color || null,
            },
          }
          return formattedTransaction
        }
        return null
      } else {
        // Insert new transaction
        const { data, error: insertError } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            ...transactionData,
          })
          .select(`
            id,
            date,
            description,
            amount,
            category_id,
            notes,
            categories:category_id (
              name,
              type,
              icon,
              color
            )
          `)

        if (insertError) throw insertError

        if (data && data.length > 0) {
          const formattedTransaction = {
            id: data[0].id,
            date: data[0].date,
            description: data[0].description,
            amount: data[0].amount,
            category_id: data[0].category_id,
            category_name: data[0].categories?.name || "Uncategorized",
            category_type: data[0].categories?.type || null,
            notes: data[0].notes,
            categories: {
              icon: data[0].categories?.icon || null,
              color: data[0].categories?.color || null,
            },
          }
          return formattedTransaction
        }
        return null
      }
    },
    {
      // Optimistic update for better UX
      onMutate: async ({ formData, transactionId }) => {
        // Clear any existing errors
        setError(null)

        // Cancel any outgoing refetches to avoid overwriting our optimistic update
        await queryClient.cancelQueries({ queryKey: monthlyTransactionsKey })

        // Snapshot the previous value
        const previousTransactions = queryClient.getQueryData<Transaction[]>(monthlyTransactionsKey) || []

        // Check if the transaction date is in the current month
        const isInCurrentMonth = isTransactionInCurrentMonth(formData.date)

        // If not in current month and it's a new transaction, don't update the UI optimistically
        if (!isInCurrentMonth && !transactionId) {
          return { previousTransactions }
        }

        // Get the category to determine if it's income or expense
        let adjustedAmount = Number.parseFloat(formData.amount)
        const selectedCategory = categories.find((cat) => cat.id === formData.categoryId)

        // Adjust amount sign based on category type
        if (selectedCategory?.type === "EXPENSE") {
          adjustedAmount = Math.abs(adjustedAmount) * -1
        } else if (selectedCategory?.type === "INCOME") {
          adjustedAmount = Math.abs(adjustedAmount)
        }

        // Create an optimistic transaction
        const optimisticTransaction: Transaction = {
          id: transactionId || `temp-${Date.now()}`,
          date: formData.date,
          description: formData.description,
          amount: adjustedAmount,
          category_id: formData.categoryId,
          category_name: selectedCategory?.name || "Uncategorized",
          category_type: selectedCategory?.type,
          notes: formData.notes,
          categories: {
            icon: selectedCategory?.icon || null,
            color: selectedCategory?.color || null,
          },
        }

        // Perform an optimistic update to the UI
        if (transactionId) {
          // For updates, check if the transaction is moving to a different month
          const existingTransaction = previousTransactions.find((t) => t.id === transactionId)
          const wasInCurrentMonth = existingTransaction ? isTransactionInCurrentMonth(existingTransaction.date) : false

          if (isInCurrentMonth) {
            // If staying in or moving into current month, update or add it
            queryClient.setQueryData<Transaction[]>(monthlyTransactionsKey, (old = []) => {
              const filteredTransactions = old.filter((t) => t.id !== transactionId)
              return sortTransactionsByDate([optimisticTransaction, ...filteredTransactions])
            })
          } else if (wasInCurrentMonth) {
            // If moving out of current month, remove it
            queryClient.setQueryData<Transaction[]>(monthlyTransactionsKey, (old = []) =>
              old.filter((t) => t.id !== transactionId),
            )
          }
        } else if (isInCurrentMonth) {
          // For new transactions in current month, add it to the list and maintain sort order
          queryClient.setQueryData<Transaction[]>(monthlyTransactionsKey, (old = []) => {
            return sortTransactionsByDate([optimisticTransaction, ...old])
          })
        }

        // Return the snapshot so we can rollback if something goes wrong
        return { previousTransactions }
      },
      onSuccess: (result, { transactionId }) => {
        setError(null) // Explicitly clear error state
        const message = transactionId ? "Transaction updated successfully!" : "Transaction created successfully!"

        toast({
          title: "Success",
          description: message,
          variant: "success",
          duration: 3000,
        })
      },
      onError: (err, { transactionId }, context) => {
        const errorMessage = handleSupabaseError(err)
        setError(`Failed to ${transactionId ? "update" : "create"} transaction: ${errorMessage}`)
        toast({
          title: "Error",
          description: `Failed to ${transactionId ? "update" : "create"} transaction: ${errorMessage}`,
          variant: "destructive",
          duration: 5000,
        })

        // Rollback to the previous state if we have it
        if (context?.previousTransactions) {
          queryClient.setQueryData(monthlyTransactionsKey, context.previousTransactions)
        }
      },
      // Always refetch after error or success to ensure data consistency
      onSettled: () => {
        // Force a refetch of the current month's data
        refetchTransactions()
      },
    },
  )

  // Handle month navigation
  const goToPreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      if (prev === 0) {
        setSelectedYear((prevYear) => prevYear - 1)
        return 11
      }
      return prev - 1
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      if (prev === 11) {
        setSelectedYear((prevYear) => prevYear + 1)
        return 0
      }
      return prev + 1
    })
  }, [])

  // Wrapper functions to match the original API
  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      try {
        return await deleteTransactionMutation(transactionId)
      } catch (err) {
        // Error is already handled in the mutation
        return false
      }
    },
    [deleteTransactionMutation],
  )

  const saveTransaction = useCallback(
    async (formData: TransactionFormData, transactionId?: string) => {
      try {
        const result = await saveTransactionMutation({ formData, transactionId })
        return !!result
      } catch (err) {
        // Error is already handled in the mutation
        return false
      }
    },
    [saveTransactionMutation],
  )

  // Update the loading state to match the original hook's behavior
  const loading = loadingTransactions || fetchingTransactions
  const fetchingCategoriesState = loadingCategories || fetchingCategories

  // Return the same API as the original hook
  return {
    transactions,
    filteredTransactions: transactions, // Now filtered at the query level
    loading,
    error,
    setError: useCallback((newError: string | null) => setError(newError), []),
    categories,
    fetchingCategories: fetchingCategoriesState,
    fetchCategories,
    selectedMonth,
    selectedYear,
    monthNames,
    goToPreviousMonth,
    goToNextMonth,
    deleteTransaction,
    saveTransaction,
  }
}

