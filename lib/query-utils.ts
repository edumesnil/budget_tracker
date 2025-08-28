"use client"

import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import type { PostgrestError } from "@supabase/supabase-js"
import { queryClient } from "@/lib/react-query" // Fixed import path

// Type guard for PostgrestError
export function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "details" in error &&
    "hint" in error
  )
}

// Helper function to handle Supabase errors
export function handleSupabaseError(error: unknown): string {
  if (isPostgrestError(error)) {
    return `${error.message} (${error.code})`
  }
  return error instanceof Error ? error.message : String(error)
}

// Type for Supabase query function
type SupabaseQueryFn<T> = (supabase: ReturnType<typeof getSupabaseBrowser>, userId: string) => Promise<T>

// Add a helper function for cache updates
export function updateQueryCache<T>(queryKey: unknown[], updater: (oldData: T | undefined) => T) {
  queryClient.setQueryData<T>(queryKey, (oldData) => updater(oldData))
}

// Hook for Supabase queries with React Query
export function useSupabaseQuery<T>(
  queryKey: unknown[],
  queryFn: SupabaseQueryFn<T>,
  options?: Omit<UseQueryOptions<T, unknown>, "queryKey" | "queryFn">,
) {
  const { user } = useAuth()

  return useQuery<T, unknown>({
    queryKey,
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated")
      const supabase = getSupabaseBrowser()
      return queryFn(supabase, user.id)
    },
    enabled: !!user,
    // Add a retry delay to give mutations time to complete
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    ...options,
  })
}

// Hook for Supabase mutations with React Query
export function useSupabaseMutation<TData, TVariables>(
  mutationFn: (
    variables: TVariables,
    supabase: ReturnType<typeof getSupabaseBrowser>,
    userId: string,
  ) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, unknown, TVariables>, "mutationFn">,
) {
  const { user } = useAuth()

  return useMutation<TData, unknown, TVariables>({
    mutationFn: async (variables) => {
      if (!user) throw new Error("User not authenticated")
      const supabase = getSupabaseBrowser()
      return mutationFn(variables, supabase, user.id)
    },
    // Add a default onSettled handler that logs completion
    onSettled: (data, error, variables, context) => {
      if (error) {
        console.error("Mutation error:", error)
      }
      // Call the user-provided onSettled if it exists
      options?.onSettled?.(data, error, variables, context)
    },
    ...options,
  })
}

