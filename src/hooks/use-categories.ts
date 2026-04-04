import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { CategoryGroup, Category } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroupInput = {
  name: string
  icon?: string | null
  color?: string | null
  sort_order?: number
}

type CategoryInput = {
  name: string
  type: 'INCOME' | 'EXPENSE'
  group_id: string | null
  icon?: string | null
  color?: string | null
}

// The shape returned by the joined query — groups with nested categories
export type GroupWithCategories = CategoryGroup & {
  categories: Category[]
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const categoryKeys = {
  all: ['categories'] as const,
  groups: () => [...categoryKeys.all, 'groups'] as const,
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCategories() {
  const queryClient = useQueryClient()

  // -------------------------------------------------------------------------
  // Query: fetch groups with nested categories
  // -------------------------------------------------------------------------

  const query = useQuery({
    queryKey: categoryKeys.groups(),
    queryFn: async (): Promise<GroupWithCategories[]> => {
      // Fetch groups ordered by sort_order
      const { data: groups, error: groupsError } = await supabase
        .from('category_groups')
        .select('*')
        .order('sort_order', { ascending: true })

      if (groupsError) throw groupsError

      // Fetch all categories
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      if (categoriesError) throw categoriesError

      // Nest categories under their groups
      const groupsWithCategories: GroupWithCategories[] = (groups ?? []).map(
        (group) => ({
          ...group,
          categories: (categories ?? []).filter(
            (cat) => cat.group_id === group.id,
          ),
        }),
      )

      // Collect ungrouped categories (group_id is null)
      const ungrouped = (categories ?? []).filter((cat) => cat.group_id === null)

      // If there are ungrouped categories, add a virtual "Ungrouped" section
      if (ungrouped.length > 0) {
        groupsWithCategories.push({
          id: '__ungrouped__',
          user_id: '',
          name: 'Ungrouped',
          icon: null,
          color: null,
          sort_order: 999999,
          created_at: '',
          categories: ungrouped,
        })
      }

      return groupsWithCategories
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — categories rarely change
  })

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const allCategories = useMemo(() => {
    if (!query.data) return []
    return query.data.flatMap((group) => group.categories)
  }, [query.data])

  // -------------------------------------------------------------------------
  // Helper: cross-entity invalidation
  // -------------------------------------------------------------------------

  const invalidateDependents = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['budgets'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // -------------------------------------------------------------------------
  // Mutation: create group
  // -------------------------------------------------------------------------

  const createGroup = useMutation({
    mutationFn: async (input: GroupInput) => {
      const { data, error } = await supabase
        .from('category_groups')
        .insert({
          name: input.name,
          icon: input.icon ?? null,
          color: input.color ?? null,
          sort_order: input.sort_order ?? 0,
        })
        .select()
        .single()

      if (error) throw error
      return data as CategoryGroup
    },
    // Layer 1: cache update from mutation response
    onSuccess: (newGroup) => {
      queryClient.setQueryData<GroupWithCategories[]>(
        categoryKeys.groups(),
        (old = []) => {
          // Insert new group (with empty categories) before the virtual
          // "Ungrouped" section if it exists
          const newEntry: GroupWithCategories = {
            ...newGroup,
            categories: [],
          }
          const ungroupedIndex = old.findIndex(
            (g) => g.id === '__ungrouped__',
          )
          if (ungroupedIndex === -1) {
            return [...old, newEntry]
          }
          const copy = [...old]
          copy.splice(ungroupedIndex, 0, newEntry)
          return copy
        },
      )
    },
  })

  // -------------------------------------------------------------------------
  // Mutation: update group
  // -------------------------------------------------------------------------

  const updateGroup = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: GroupInput & { id: string }) => {
      const { data, error } = await supabase
        .from('category_groups')
        .update({
          name: input.name,
          icon: input.icon ?? null,
          color: input.color ?? null,
          sort_order: input.sort_order,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as CategoryGroup
    },
    // Layer 1: cache update from mutation response
    onSuccess: (updatedGroup) => {
      queryClient.setQueryData<GroupWithCategories[]>(
        categoryKeys.groups(),
        (old = []) =>
          old.map((g) =>
            g.id === updatedGroup.id
              ? { ...g, ...updatedGroup }
              : g,
          ),
      )
    },
  })

  // -------------------------------------------------------------------------
  // Mutation: delete group
  // -------------------------------------------------------------------------

  const deleteGroup = useMutation({
    // Layer 2: optimistic delete
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.groups() })
      const previous = queryClient.getQueryData<GroupWithCategories[]>(
        categoryKeys.groups(),
      )
      queryClient.setQueryData<GroupWithCategories[]>(
        categoryKeys.groups(),
        (old = []) => {
          const deletedGroup = old.find((g) => g.id === id)
          // Move orphaned categories to "Ungrouped"
          const orphanedCategories = deletedGroup?.categories ?? []
          const filtered = old.filter((g) => g.id !== id)

          if (orphanedCategories.length > 0) {
            const ungroupedIndex = filtered.findIndex(
              (g) => g.id === '__ungrouped__',
            )
            if (ungroupedIndex !== -1) {
              // Add to existing ungrouped section
              filtered[ungroupedIndex] = {
                ...filtered[ungroupedIndex],
                categories: [
                  ...filtered[ungroupedIndex].categories,
                  ...orphanedCategories.map((c) => ({
                    ...c,
                    group_id: null,
                  })),
                ],
              }
            } else {
              // Create ungrouped section
              filtered.push({
                id: '__ungrouped__',
                user_id: '',
                name: 'Ungrouped',
                icon: null,
                color: null,
                sort_order: 999999,
                created_at: '',
                categories: orphanedCategories.map((c) => ({
                  ...c,
                  group_id: null,
                })),
              })
            }
          }

          return filtered
        },
      )
      return { previous }
    },
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('category_groups')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(categoryKeys.groups(), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.groups() })
      invalidateDependents()
    },
  })

  // -------------------------------------------------------------------------
  // Mutation: create category
  // -------------------------------------------------------------------------

  const createCategory = useMutation({
    mutationFn: async (input: CategoryInput) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: input.name,
          type: input.type,
          group_id: input.group_id,
          icon: input.icon ?? null,
          color: input.color ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data as Category
    },
    // Layer 1: cache update from mutation response
    onSuccess: (newCategory) => {
      queryClient.setQueryData<GroupWithCategories[]>(
        categoryKeys.groups(),
        (old = []) =>
          old.map((group) => {
            // Add to the matching group
            if (
              newCategory.group_id &&
              group.id === newCategory.group_id
            ) {
              return {
                ...group,
                categories: [...group.categories, newCategory],
              }
            }
            // Or add to "Ungrouped" if no group_id
            if (
              !newCategory.group_id &&
              group.id === '__ungrouped__'
            ) {
              return {
                ...group,
                categories: [...group.categories, newCategory],
              }
            }
            return group
          }),
      )
      invalidateDependents()
    },
  })

  // -------------------------------------------------------------------------
  // Mutation: update category
  // -------------------------------------------------------------------------

  const updateCategory = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: CategoryInput & { id: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update({
          name: input.name,
          type: input.type,
          group_id: input.group_id,
          icon: input.icon ?? null,
          color: input.color ?? null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Category
    },
    // Layer 1: cache update from mutation response
    onSuccess: (updatedCategory) => {
      queryClient.setQueryData<GroupWithCategories[]>(
        categoryKeys.groups(),
        (old = []) => {
          return old.map((group) => {
            // Remove the category from its old group (if it was here)
            const withoutOld = group.categories.filter(
              (c) => c.id !== updatedCategory.id,
            )

            // Determine the target group for the updated category
            const targetGroupId =
              updatedCategory.group_id ?? '__ungrouped__'

            if (group.id === targetGroupId) {
              // Add the updated category to its (possibly new) group
              return {
                ...group,
                categories: [...withoutOld, updatedCategory],
              }
            }

            // For all other groups, just remove the old entry if present
            return { ...group, categories: withoutOld }
          })
        },
      )
      invalidateDependents()
    },
  })

  // -------------------------------------------------------------------------
  // Mutation: delete category
  // -------------------------------------------------------------------------

  const deleteCategory = useMutation({
    // Layer 2: optimistic delete
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.groups() })
      const previous = queryClient.getQueryData<GroupWithCategories[]>(
        categoryKeys.groups(),
      )
      queryClient.setQueryData<GroupWithCategories[]>(
        categoryKeys.groups(),
        (old = []) =>
          old.map((group) => ({
            ...group,
            categories: group.categories.filter((c) => c.id !== id),
          })),
      )
      return { previous }
    },
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(categoryKeys.groups(), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.groups() })
      invalidateDependents()
    },
  })

  // -------------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------------

  return {
    groups: query.data ?? [],
    allCategories,
    isLoading: query.isLoading,
    error: query.error,
    createGroup,
    updateGroup,
    deleteGroup,
    createCategory,
    updateCategory,
    deleteCategory,
  }
}
