import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Default: always refetch on mount
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    },
  },
});

// =============================================================================
// Per-entity staleTime constants
// Used in individual hooks via useQuery({ staleTime: STALE_TIMES.categories })
// =============================================================================

export const STALE_TIMES = {
  /** Categories rarely change — cache aggressively */
  categories: 5 * 60 * 1000, // 5 minutes

  /** Transactions: always refetch, but serve cache instantly while background fetch runs */
  transactions: 0,

  /** Budgets: moderate cache */
  budgets: 1 * 60 * 1000, // 1 minute

  /** Dashboard is a composite view — always fresh */
  dashboard: 0,

  /** Account snapshots: rarely updated */
  snapshots: 5 * 60 * 1000, // 5 minutes

  /** Merchant mappings: rarely change outside of imports */
  merchantMappings: 5 * 60 * 1000, // 5 minutes
} as const;
