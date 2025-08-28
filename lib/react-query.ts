import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds (reduced from 60s)
      gcTime: 300000, // 5 minutes
      refetchOnWindowFocus: true, // Changed to true
      retry: 1,
    },
    mutations: {
      // Add default mutation options
      onError: (err) => {
        console.error("Mutation error:", err)
      },
    },
  },
})

