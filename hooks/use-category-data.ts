"use client"

import { useCategoryDataQuery, type Category } from "./use-category-data-query"

// Re-export the Category type
export type { Category }

// This hook now serves as a wrapper around the React Query implementation
export function useCategoryData() {
  // Use the React Query implementation
  return useCategoryDataQuery()
}

