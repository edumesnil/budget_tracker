"use client"

import { useState, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useSupabaseQuery, useSupabaseMutation, handleSupabaseError } from "@/lib/query-utils"
import { queryClient } from "@/lib/react-query"

export type Category = {
  id: string
  name: string
  type: "INCOME" | "EXPENSE"
  color: string | null
  icon: string | null
}

// Input type for creating/updating categories
type CategoryInput = {
  id?: string
  name: string
  type: "INCOME" | "EXPENSE"
  color: string
  icon: string
}

// Define a consistent query key factory function
export const getCategoriesQueryKey = (userId?: string) => ["categories", userId || "anonymous"]

export function useCategoryDataQuery() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Query key for categories
  const categoriesKey = getCategoriesQueryKey(user?.id)

  // Fetch categories query
  const {
    data: categories = [],
    isLoading,
    isFetching,
    refetch,
  } = useSupabaseQuery<Category[]>(
    categoriesKey,
    async (supabase, userId) => {
      const { data, error } = await supabase.from("categories").select("*").eq("user_id", userId).order("name")

      if (error) throw error
      return data || []
    },
    {
      onError: (err) => {
        setError(`Failed to load categories: ${handleSupabaseError(err)}`)
      },
      // Set to 0 to always consider data stale after mutations
      staleTime: 0,
      // But keep the data in cache for longer
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  )

  // Create a stable refetch function
  const fetchCategories = useCallback(() => {
    setError(null)
    return refetch()
  }, [refetch])

  // Create/update category mutation
  const { mutateAsync: saveCategoryMutation } = useSupabaseMutation<
    Category | null,
    { categoryData: CategoryInput; isEditing: boolean }
  >(
    async ({ categoryData, isEditing }, supabase, userId) => {
      // Validate inputs
      if (!categoryData.name.trim()) {
        throw new Error("Please enter a category name")
      }

      if (isEditing && categoryData.id) {
        // Update existing category
        const { data, error: updateError } = await supabase
          .from("categories")
          .update({
            name: categoryData.name.trim(),
            type: categoryData.type,
            color: categoryData.color,
            icon: categoryData.icon,
          })
          .eq("id", categoryData.id)
          .eq("user_id", userId)
          .select()

        if (updateError) throw updateError
        return data?.[0] || null
      } else {
        // Insert new category
        const { data, error: insertError } = await supabase
          .from("categories")
          .insert({
            user_id: userId,
            name: categoryData.name.trim(),
            type: categoryData.type,
            color: categoryData.color,
            icon: categoryData.icon,
          })
          .select()

        if (insertError) throw insertError
        return data?.[0] || null
      }
    },
    {
      // Optimistic update for better UX
      onMutate: async ({ categoryData, isEditing }) => {
        // Clear any existing errors
        setError(null)

        // Cancel any outgoing refetches to avoid overwriting our optimistic update
        await queryClient.cancelQueries({ queryKey: categoriesKey })

        // Snapshot the previous value
        const previousCategories = queryClient.getQueryData<Category[]>(categoriesKey) || []

        // Perform an optimistic update to the UI
        if (isEditing && categoryData.id) {
          queryClient.setQueryData<Category[]>(categoriesKey, (old = []) =>
            old.map((cat) =>
              cat.id === categoryData.id
                ? {
                    ...cat,
                    name: categoryData.name,
                    type: categoryData.type,
                    color: categoryData.color,
                    icon: categoryData.icon,
                  }
                : cat,
            ),
          )
        } else {
          // For new categories, create a temporary ID
          const tempCategory: Category = {
            id: `temp-${Date.now()}`,
            name: categoryData.name,
            type: categoryData.type,
            color: categoryData.color,
            icon: categoryData.icon,
          }
          queryClient.setQueryData<Category[]>(categoriesKey, (old = []) => [...old, tempCategory])
        }

        // Return the snapshot so we can rollback if something goes wrong
        return { previousCategories }
      },
      onSuccess: (result, { isEditing }) => {
        const message = isEditing ? "Category updated successfully!" : "Category added successfully!"
        setSuccess(message)
        toast({
          title: "Success",
          description: message,
          variant: "success",
          duration: 3000,
        })

        // Update the cache with the actual result from the server
        if (result) {
          queryClient.setQueryData<Category[]>(categoriesKey, (oldData = []) => {
            // Remove any temporary entries
            const filteredData = oldData.filter((cat) => !cat.id.startsWith("temp-"))

            if (isEditing) {
              // For updates, replace the existing category
              return filteredData.map((cat) => (cat.id === result.id ? result : cat))
            } else {
              // For new categories, add the real one
              return [...filteredData, result]
            }
          })
        }

        // Force a refetch to ensure cache is in sync with server
        // Use invalidateQueries with refetchType: 'all' to ensure immediate refetching
        queryClient.invalidateQueries({
          queryKey: categoriesKey,
          exact: true,
          refetchType: "all",
        })

        // Also invalidate any related queries that might depend on categories
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
          refetchType: "inactive", // Only refetch if the query is being observed
        })
      },
      onError: (err, { isEditing }, context) => {
        const errorMessage = handleSupabaseError(err)
        setError(`Failed to ${isEditing ? "update" : "add"} category: ${errorMessage}`)
        toast({
          title: "Error",
          description: `Failed to ${isEditing ? "update" : "add"} category: ${errorMessage}`,
          variant: "destructive",
          duration: 5000,
        })

        // Rollback to the previous state if we have it
        if (context?.previousCategories) {
          queryClient.setQueryData(categoriesKey, context.previousCategories)
        }
      },
      // Always refetch after error or success
      onSettled: () => {
        // Use invalidateQueries with refetchType: 'all' to ensure immediate refetching
        queryClient.invalidateQueries({
          queryKey: categoriesKey,
          exact: true,
          refetchType: "all",
        })
      },
    },
  )

  // Delete category mutation
  const { mutateAsync: deleteCategoryMutation } = useSupabaseMutation<
    boolean,
    { categoryId: string; replacementCategoryId: string | null }
  >(
    async ({ categoryId, replacementCategoryId }, supabase, userId) => {
      // If a replacement category is selected, update transactions first
      if (replacementCategoryId) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ category_id: replacementCategoryId })
          .eq("category_id", categoryId)
          .eq("user_id", userId)

        if (updateError) throw updateError
      } else {
        // If no replacement category, set category_id to null for affected transactions
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ category_id: null })
          .eq("category_id", categoryId)
          .eq("user_id", userId)

        if (updateError) throw updateError
      }

      // Now delete the category
      const { error: deleteError } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId)
        .eq("user_id", userId)

      if (deleteError) throw deleteError

      return true
    },
    {
      // Optimistic update for better UX
      onMutate: async ({ categoryId }) => {
        // Clear any existing errors
        setError(null)

        // Cancel any outgoing refetches to avoid overwriting our optimistic update
        await queryClient.cancelQueries({ queryKey: categoriesKey })

        // Snapshot the previous value
        const previousCategories = queryClient.getQueryData<Category[]>(categoriesKey) || []

        // Optimistically remove the category from the UI
        queryClient.setQueryData<Category[]>(categoriesKey, (old = []) => old.filter((cat) => cat.id !== categoryId))

        // Return the snapshot so we can rollback if something goes wrong
        return { previousCategories }
      },
      onSuccess: () => {
        setSuccess("Category deleted successfully!")
        toast({
          title: "Success",
          description: "Category deleted successfully!",
          variant: "success",
          duration: 3000,
        })

        // Also invalidate transactions query since they might reference categories
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
          refetchType: "inactive", // Only refetch if the query is being observed
        })
      },
      onError: (err, _, context) => {
        const errorMessage = handleSupabaseError(err)
        setError(`Failed to delete category: ${errorMessage}`)
        toast({
          title: "Error",
          description: `Failed to delete category: ${errorMessage}`,
          variant: "destructive",
          duration: 5000,
        })

        // Rollback to the previous state if we have it
        if (context?.previousCategories) {
          queryClient.setQueryData(categoriesKey, context.previousCategories)
        }
      },
      // Always refetch after error or success
      onSettled: () => {
        // Use invalidateQueries with refetchType: 'all' to ensure immediate refetching
        queryClient.invalidateQueries({
          queryKey: categoriesKey,
          exact: true,
          refetchType: "all",
        })
      },
    },
  )

  // Wrapper functions to match the original API
  const saveCategory = useCallback(
    async (categoryData: CategoryInput, isEditing: boolean) => {
      try {
        const result = await saveCategoryMutation({ categoryData, isEditing })
        return !!result
      } catch (err) {
        // Error is already handled in the mutation
        return false
      }
    },
    [saveCategoryMutation],
  )

  const deleteCategory = useCallback(
    async (categoryId: string, replacementCategoryId: string | null) => {
      try {
        return await deleteCategoryMutation({ categoryId, replacementCategoryId })
      } catch (err) {
        // Error is already handled in the mutation
        return false
      }
    },
    [deleteCategoryMutation],
  )

  // Update the loading state to match the original hook's behavior
  const loading = isLoading || isFetching

  // Return the same API as the original hook
  return {
    categories,
    loading,
    error,
    success,
    fetchCategories,
    saveCategory,
    deleteCategory,
    setError: useCallback((newError: string | null) => setError(newError), []),
  }
}

