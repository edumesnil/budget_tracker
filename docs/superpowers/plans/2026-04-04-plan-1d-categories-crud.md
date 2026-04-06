# Plan 1D: Categories CRUD

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan.

**Goal:** Full CRUD for category groups and categories with instant UI updates via React Query cache manipulation.

**Architecture:** One hook manages both groups and categories. Mutations update cache directly from server response (no refetch). Optimistic deletes with rollback. Cross-entity invalidation for dependent queries.

**Tech Stack:** TanStack React Query v5, Supabase, react-hook-form, Zod, Park UI, Panda CSS

**Depends on:** Plan 1A (scaffold), Plan 1B (database + types), Plan 1C (auth + routing)
**Enables:** Plan 2 (Transactions, Budgets, Dashboard)

---

## Files to Create

| #   | File                                                 | Purpose                                                         |
| --- | ---------------------------------------------------- | --------------------------------------------------------------- |
| 1   | `src/hooks/use-categories.ts`                        | React Query hook: queries + mutations for groups and categories |
| 2   | `src/routes/categories.tsx`                          | Categories page route                                           |
| 3   | `src/components/categories/group-form-dialog.tsx`    | Dialog for create/edit category group                           |
| 4   | `src/components/categories/category-form-dialog.tsx` | Dialog for create/edit category                                 |
| 5   | `src/components/categories/category-list.tsx`        | Renders groups with nested categories                           |

## Dependencies (must exist before this plan)

- `src/lib/supabase.ts` — Supabase client singleton (Plan 1A)
- `src/lib/query-client.ts` — React Query client config (Plan 1A)
- `src/types/database.ts` — TypeScript types for all DB tables (Plan 1B)
- `src/routes/_layout.tsx` — Dashboard shell with auth guard (Plan 1C)
- `src/app.tsx` — Router setup that includes the categories route (Plan 1C)
- Park UI components installed: `dialog`, `input`, `button`, `radio-group`, `select`, `toast` (Plan 1A)

---

## File 1: `src/hooks/use-categories.ts`

### Purpose

Single hook that manages both category groups and categories. Returns query data plus six mutation functions. Implements all three layers from the design spec: cache update from response, optimistic delete, and cross-entity invalidation.

### Complete Code

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { CategoryGroup, Category } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroupInput = {
  name: string;
  icon?: string | null;
  color?: string | null;
  sort_order?: number;
};

type CategoryInput = {
  name: string;
  type: "INCOME" | "EXPENSE";
  group_id: string | null;
  icon?: string | null;
  color?: string | null;
};

// The shape returned by the joined query — groups with nested categories
export type GroupWithCategories = CategoryGroup & {
  categories: Category[];
};

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const categoryKeys = {
  all: ["categories"] as const,
  groups: () => [...categoryKeys.all, "groups"] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCategories() {
  const queryClient = useQueryClient();

  // -------------------------------------------------------------------------
  // Query: fetch groups with nested categories
  // -------------------------------------------------------------------------

  const query = useQuery({
    queryKey: categoryKeys.groups(),
    queryFn: async (): Promise<GroupWithCategories[]> => {
      // Fetch groups ordered by sort_order
      const { data: groups, error: groupsError } = await supabase
        .from("category_groups")
        .select("*")
        .order("sort_order", { ascending: true });

      if (groupsError) throw groupsError;

      // Fetch all categories
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      if (categoriesError) throw categoriesError;

      // Nest categories under their groups
      const groupsWithCategories: GroupWithCategories[] = (groups ?? []).map((group) => ({
        ...group,
        categories: (categories ?? []).filter((cat) => cat.group_id === group.id),
      }));

      // Collect ungrouped categories (group_id is null)
      const ungrouped = (categories ?? []).filter((cat) => cat.group_id === null);

      // If there are ungrouped categories, add a virtual "Ungrouped" section
      if (ungrouped.length > 0) {
        groupsWithCategories.push({
          id: "__ungrouped__",
          user_id: "",
          name: "Ungrouped",
          icon: null,
          color: null,
          sort_order: 999999,
          created_at: "",
          categories: ungrouped,
        });
      }

      return groupsWithCategories;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — categories rarely change
  });

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const allCategories = useMemo(() => {
    if (!query.data) return [];
    return query.data.flatMap((group) => group.categories);
  }, [query.data]);

  // -------------------------------------------------------------------------
  // Helper: cross-entity invalidation
  // -------------------------------------------------------------------------

  const invalidateDependents = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  // -------------------------------------------------------------------------
  // Mutation: create group
  // -------------------------------------------------------------------------

  const createGroup = useMutation({
    mutationFn: async (input: GroupInput) => {
      const { data, error } = await supabase
        .from("category_groups")
        .insert({
          name: input.name,
          icon: input.icon ?? null,
          color: input.color ?? null,
          sort_order: input.sort_order ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CategoryGroup;
    },
    // Layer 1: cache update from mutation response
    onSuccess: (newGroup) => {
      queryClient.setQueryData<GroupWithCategories[]>(categoryKeys.groups(), (old = []) => {
        // Insert new group (with empty categories) before the virtual
        // "Ungrouped" section if it exists
        const newEntry: GroupWithCategories = {
          ...newGroup,
          categories: [],
        };
        const ungroupedIndex = old.findIndex((g) => g.id === "__ungrouped__");
        if (ungroupedIndex === -1) {
          return [...old, newEntry];
        }
        const copy = [...old];
        copy.splice(ungroupedIndex, 0, newEntry);
        return copy;
      });
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: update group
  // -------------------------------------------------------------------------

  const updateGroup = useMutation({
    mutationFn: async ({ id, ...input }: GroupInput & { id: string }) => {
      const { data, error } = await supabase
        .from("category_groups")
        .update({
          name: input.name,
          icon: input.icon ?? null,
          color: input.color ?? null,
          sort_order: input.sort_order,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as CategoryGroup;
    },
    // Layer 1: cache update from mutation response
    onSuccess: (updatedGroup) => {
      queryClient.setQueryData<GroupWithCategories[]>(categoryKeys.groups(), (old = []) =>
        old.map((g) => (g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g)),
      );
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: delete group
  // -------------------------------------------------------------------------

  const deleteGroup = useMutation({
    // Layer 2: optimistic delete
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.groups() });
      const previous = queryClient.getQueryData<GroupWithCategories[]>(categoryKeys.groups());
      queryClient.setQueryData<GroupWithCategories[]>(categoryKeys.groups(), (old = []) => {
        const deletedGroup = old.find((g) => g.id === id);
        // Move orphaned categories to "Ungrouped"
        const orphanedCategories = deletedGroup?.categories ?? [];
        const filtered = old.filter((g) => g.id !== id);

        if (orphanedCategories.length > 0) {
          const ungroupedIndex = filtered.findIndex((g) => g.id === "__ungrouped__");
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
            };
          } else {
            // Create ungrouped section
            filtered.push({
              id: "__ungrouped__",
              user_id: "",
              name: "Ungrouped",
              icon: null,
              color: null,
              sort_order: 999999,
              created_at: "",
              categories: orphanedCategories.map((c) => ({
                ...c,
                group_id: null,
              })),
            });
          }
        }

        return filtered;
      });
      return { previous };
    },
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("category_groups").delete().eq("id", id);

      if (error) throw error;
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(categoryKeys.groups(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.groups() });
      invalidateDependents();
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: create category
  // -------------------------------------------------------------------------

  const createCategory = useMutation({
    mutationFn: async (input: CategoryInput) => {
      const { data, error } = await supabase
        .from("categories")
        .insert({
          name: input.name,
          type: input.type,
          group_id: input.group_id,
          icon: input.icon ?? null,
          color: input.color ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Category;
    },
    // Layer 1: cache update from mutation response
    onSuccess: (newCategory) => {
      queryClient.setQueryData<GroupWithCategories[]>(categoryKeys.groups(), (old = []) =>
        old.map((group) => {
          // Add to the matching group
          if (newCategory.group_id && group.id === newCategory.group_id) {
            return {
              ...group,
              categories: [...group.categories, newCategory],
            };
          }
          // Or add to "Ungrouped" if no group_id
          if (!newCategory.group_id && group.id === "__ungrouped__") {
            return {
              ...group,
              categories: [...group.categories, newCategory],
            };
          }
          return group;
        }),
      );
      invalidateDependents();
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: update category
  // -------------------------------------------------------------------------

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...input }: CategoryInput & { id: string }) => {
      const { data, error } = await supabase
        .from("categories")
        .update({
          name: input.name,
          type: input.type,
          group_id: input.group_id,
          icon: input.icon ?? null,
          color: input.color ?? null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Category;
    },
    // Layer 1: cache update from mutation response
    onSuccess: (updatedCategory) => {
      queryClient.setQueryData<GroupWithCategories[]>(categoryKeys.groups(), (old = []) => {
        return old.map((group) => {
          // Remove the category from its old group (if it was here)
          const withoutOld = group.categories.filter((c) => c.id !== updatedCategory.id);

          // Determine the target group for the updated category
          const targetGroupId = updatedCategory.group_id ?? "__ungrouped__";

          if (group.id === targetGroupId) {
            // Add the updated category to its (possibly new) group
            return {
              ...group,
              categories: [...withoutOld, updatedCategory],
            };
          }

          // For all other groups, just remove the old entry if present
          return { ...group, categories: withoutOld };
        });
      });
      invalidateDependents();
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: delete category
  // -------------------------------------------------------------------------

  const deleteCategory = useMutation({
    // Layer 2: optimistic delete
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.groups() });
      const previous = queryClient.getQueryData<GroupWithCategories[]>(categoryKeys.groups());
      queryClient.setQueryData<GroupWithCategories[]>(categoryKeys.groups(), (old = []) =>
        old.map((group) => ({
          ...group,
          categories: group.categories.filter((c) => c.id !== id),
        })),
      );
      return { previous };
    },
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);

      if (error) throw error;
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(categoryKeys.groups(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.groups() });
      invalidateDependents();
    },
  });

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
  };
}
```

### Key Design Decisions

1. **Two separate Supabase queries joined client-side** rather than a Supabase join. Supabase's `.select('*, categories(*)')` on `category_groups` would work, but two simple queries give cleaner control over ordering and the "Ungrouped" virtual section.

2. **Virtual "Ungrouped" group** (`id: '__ungrouped__'`). Categories with `group_id: null` get collected into a synthetic group for display. This avoids special-casing null groups throughout the UI layer.

3. **`categoryKeys` factory.** Consistent query key structure. All invalidation uses these keys. The `all` key is the root — invalidating `['categories']` catches everything.

4. **`allCategories` derived via `useMemo`.** A flat list of all categories across all groups, useful for select dropdowns in other forms (transactions, budgets).

5. **Layer 1 (cache update from response)** applied to create/update mutations. The mutation returns the inserted/updated row via `.select().single()`. The `onSuccess` handler uses `setQueryData` to surgically insert or replace the item in the cached group tree. No refetch, no loading flash.

6. **Layer 2 (optimistic delete with rollback)** applied to delete mutations. `onMutate` snapshots the cache, removes the item, returns the snapshot. `onError` rolls back. `onSettled` invalidates to re-sync with server truth.

7. **Cross-entity invalidation** in `invalidateDependents()`. When categories change, transactions, budgets, and dashboard queries are invalidated because they reference categories. Called on category create/update/delete and group delete (since group delete orphans categories).

---

## File 2: `src/routes/categories.tsx`

### Purpose

The categories page. Orchestrates state for dialogs and connects the hook to the UI components. Shows all groups with their nested categories. Provides actions for CRUD on both groups and categories.

### Complete Code

```tsx
import { useState } from "react";
import { css } from "../../styled-system/css";
import { useCategories, type GroupWithCategories } from "@/hooks/use-categories";
import { CategoryList } from "@/components/categories/category-list";
import { GroupFormDialog } from "@/components/categories/group-form-dialog";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { Button } from "@/components/ui/button";
import { Toaster, toaster } from "@/components/ui/toast";
import type { CategoryGroup, Category } from "@/types/database";

export default function CategoriesPage() {
  const {
    groups,
    isLoading,
    createGroup,
    updateGroup,
    deleteGroup,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();

  // Dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);

  // ---- Group actions ----

  const handleAddGroup = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  };

  const handleEditGroup = (group: CategoryGroup) => {
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup.mutateAsync(groupId);
      toaster.success({
        title: "Group deleted",
        description: "Category group has been removed.",
      });
    } catch {
      toaster.error({
        title: "Error",
        description: "Failed to delete group. Please try again.",
      });
    }
  };

  const handleGroupSubmit = async (data: { name: string; icon?: string; color?: string }) => {
    try {
      if (editingGroup) {
        await updateGroup.mutateAsync({ id: editingGroup.id, ...data });
        toaster.success({
          title: "Group updated",
          description: `"${data.name}" has been updated.`,
        });
      } else {
        await createGroup.mutateAsync(data);
        toaster.success({
          title: "Group created",
          description: `"${data.name}" has been added.`,
        });
      }
      setGroupDialogOpen(false);
    } catch {
      toaster.error({
        title: "Error",
        description: `Failed to ${editingGroup ? "update" : "create"} group.`,
      });
    }
  };

  // ---- Category actions ----

  const handleAddCategory = (groupId: string | null) => {
    setEditingCategory(null);
    setTargetGroupId(groupId === "__ungrouped__" ? null : groupId);
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setTargetGroupId(category.group_id);
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await deleteCategory.mutateAsync(categoryId);
      toaster.success({
        title: "Category deleted",
        description: "Category has been removed.",
      });
    } catch {
      toaster.error({
        title: "Error",
        description: "Failed to delete category. Please try again.",
      });
    }
  };

  const handleCategorySubmit = async (data: {
    name: string;
    type: "INCOME" | "EXPENSE";
    group_id: string | null;
    icon?: string;
    color?: string;
  }) => {
    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({ id: editingCategory.id, ...data });
        toaster.success({
          title: "Category updated",
          description: `"${data.name}" has been updated.`,
        });
      } else {
        await createCategory.mutateAsync(data);
        toaster.success({
          title: "Category created",
          description: `"${data.name}" has been added.`,
        });
      }
      setCategoryDialogOpen(false);
    } catch {
      toaster.error({
        title: "Error",
        description: `Failed to ${editingCategory ? "update" : "create"} category.`,
      });
    }
  };

  // ---- Render ----

  if (isLoading) {
    return (
      <div className={css({ p: "6", textAlign: "center", color: "fg.muted" })}>
        Loading categories...
      </div>
    );
  }

  return (
    <div className={css({ display: "flex", flexDir: "column", gap: "6", p: "6" })}>
      {/* Page header */}
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        })}
      >
        <div>
          <h1 className={css({ fontSize: "2xl", fontWeight: "bold" })}>Categories</h1>
          <p className={css({ color: "fg.muted", mt: "1" })}>
            Manage category groups and categories for tracking income and expenses.
          </p>
        </div>
        <Button onClick={handleAddGroup}>Add Group</Button>
      </div>

      {/* Groups with nested categories */}
      {groups.length === 0 ? (
        <div
          className={css({
            textAlign: "center",
            py: "12",
            color: "fg.muted",
          })}
        >
          <p className={css({ fontSize: "lg", fontWeight: "medium" })}>No category groups yet</p>
          <p className={css({ mt: "2" })}>
            Create your first group to start organizing categories.
          </p>
        </div>
      ) : (
        <div className={css({ display: "flex", flexDir: "column", gap: "4" })}>
          {groups.map((group) => (
            <CategoryList
              key={group.id}
              group={group}
              onEditGroup={handleEditGroup}
              onDeleteGroup={handleDeleteGroup}
              onAddCategory={handleAddCategory}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <GroupFormDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        group={editingGroup}
        onSubmit={handleGroupSubmit}
        isSubmitting={createGroup.isPending || updateGroup.isPending}
      />

      <CategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
        groups={groups.filter((g) => g.id !== "__ungrouped__")}
        defaultGroupId={targetGroupId}
        onSubmit={handleCategorySubmit}
        isSubmitting={createCategory.isPending || updateCategory.isPending}
      />

      <Toaster />
    </div>
  );
}
```

### Key Design Decisions

1. **Page owns dialog state.** The `open`/`onOpenChange` pattern keeps dialog state in the page, not inside child components. This avoids prop-drilling callbacks and makes it easy to pre-fill forms (e.g., setting `targetGroupId` when clicking "Add Category" on a specific group).

2. **Toast notifications at the page level.** Success/error toasts are triggered in the page's handler functions, not inside the hook. This keeps the hook reusable (other pages that use categories don't get surprise toasts) and gives the page full control over messaging.

3. **`__ungrouped__` group filtered out of dialog options.** The virtual ungrouped section is a display concern. The group select in the category form shows only real groups.

4. **Mutation `isPending` passed to dialogs.** Disables submit button and shows loading state while the mutation is in flight.

---

## File 3: `src/components/categories/group-form-dialog.tsx`

### Purpose

Dialog for creating or editing a category group. Uses react-hook-form with Zod validation. Park UI Dialog + Input + Button.

### Complete Code

```tsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { css } from "../../../styled-system/css";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CategoryGroup } from "@/types/database";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const groupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  icon: z.string().optional(),
  color: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CategoryGroup | null;
  onSubmit: (data: GroupFormValues) => Promise<void>;
  isSubmitting: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GroupFormDialog({
  open,
  onOpenChange,
  group,
  onSubmit,
  isSubmitting,
}: GroupFormDialogProps) {
  const isEditing = group !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      icon: "",
      color: "",
    },
  });

  // Reset form when dialog opens or group changes
  useEffect(() => {
    if (open) {
      reset({
        name: group?.name ?? "",
        icon: group?.icon ?? "",
        color: group?.color ?? "",
      });
    }
  }, [open, group, reset]);

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit({
      name: data.name,
      icon: data.icon || undefined,
      color: data.color || undefined,
    });
  });

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content className={css({ maxW: "md", w: "full" })}>
          <form onSubmit={handleFormSubmit}>
            <Dialog.Header>
              <Dialog.Title>{isEditing ? "Edit Group" : "New Group"}</Dialog.Title>
              <Dialog.Description>
                {isEditing
                  ? "Update the category group details."
                  : "Create a new category group to organize your categories."}
              </Dialog.Description>
            </Dialog.Header>

            <Dialog.Body className={css({ display: "flex", flexDir: "column", gap: "4" })}>
              {/* Name */}
              <div className={css({ display: "flex", flexDir: "column", gap: "1.5" })}>
                <label
                  htmlFor="group-name"
                  className={css({ fontSize: "sm", fontWeight: "medium" })}
                >
                  Name *
                </label>
                <Input
                  id="group-name"
                  placeholder="e.g., MAISON, AUTO, NOURRITURE"
                  {...register("name")}
                />
                {errors.name && (
                  <p className={css({ fontSize: "sm", color: "red.500" })}>{errors.name.message}</p>
                )}
              </div>

              {/* Icon */}
              <div className={css({ display: "flex", flexDir: "column", gap: "1.5" })}>
                <label
                  htmlFor="group-icon"
                  className={css({ fontSize: "sm", fontWeight: "medium" })}
                >
                  Icon
                </label>
                <Input
                  id="group-icon"
                  placeholder="e.g., Home, Car, ShoppingCart"
                  {...register("icon")}
                />
              </div>

              {/* Color */}
              <div className={css({ display: "flex", flexDir: "column", gap: "1.5" })}>
                <label
                  htmlFor="group-color"
                  className={css({ fontSize: "sm", fontWeight: "medium" })}
                >
                  Color
                </label>
                <div className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                  <Input
                    id="group-color"
                    type="color"
                    className={css({ w: "12", h: "10", p: "1", cursor: "pointer" })}
                    {...register("color")}
                  />
                  <Input
                    placeholder="#6366f1"
                    className={css({ flex: "1" })}
                    {...register("color")}
                  />
                </div>
              </div>
            </Dialog.Body>

            <Dialog.Footer
              className={css({ display: "flex", gap: "3", justifyContent: "flex-end" })}
            >
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" type="button" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update Group"
                    : "Create Group"}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
```

### Key Design Decisions

1. **Form reset on open.** `useEffect` watches `open` and `group` to reset form values. This ensures the form is fresh when adding and pre-filled when editing.

2. **Dual color input.** A native color picker (`type="color"`) paired with a text input bound to the same field. Users can use the picker or type a hex value directly.

3. **Park UI Dialog anatomy.** Uses `Dialog.Root`, `Dialog.Backdrop`, `Dialog.Positioner`, `Dialog.Content`, `Dialog.Header`, `Dialog.Body`, `Dialog.Footer`, `Dialog.CloseTrigger` — the standard Park UI/Ark UI dialog structure.

4. **Form wraps the dialog content.** The `<form>` element wraps everything inside `Dialog.Content` so that Enter key submission works naturally.

---

## File 4: `src/components/categories/category-form-dialog.tsx`

### Purpose

Dialog for creating or editing a category. Fields: name, type (INCOME/EXPENSE), group, icon, color. Uses react-hook-form + Zod. Park UI Dialog + Input + RadioGroup + Select + Button.

### Complete Code

```tsx
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { css } from "../../../styled-system/css";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import type { Category } from "@/types/database";
import type { GroupWithCategories } from "@/hooks/use-categories";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["INCOME", "EXPENSE"]),
  group_id: z.string().uuid().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  groups: GroupWithCategories[];
  defaultGroupId: string | null;
  onSubmit: (data: CategoryFormValues) => Promise<void>;
  isSubmitting: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  groups,
  defaultGroupId,
  onSubmit,
  isSubmitting,
}: CategoryFormDialogProps) {
  const isEditing = category !== null;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      type: "EXPENSE",
      group_id: null,
      icon: "",
      color: "",
    },
  });

  // Reset form when dialog opens or category changes
  useEffect(() => {
    if (open) {
      reset({
        name: category?.name ?? "",
        type: category?.type ?? "EXPENSE",
        group_id: category?.group_id ?? defaultGroupId ?? null,
        icon: category?.icon ?? "",
        color: category?.color ?? "",
      });
    }
  }, [open, category, defaultGroupId, reset]);

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit({
      name: data.name,
      type: data.type,
      group_id: data.group_id,
      icon: data.icon || undefined,
      color: data.color || undefined,
    });
  });

  // Build group options for select
  const groupOptions = [
    { label: "No group", value: "__none__" },
    ...groups.map((g) => ({ label: g.name, value: g.id })),
  ];

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content className={css({ maxW: "md", w: "full" })}>
          <form onSubmit={handleFormSubmit}>
            <Dialog.Header>
              <Dialog.Title>{isEditing ? "Edit Category" : "New Category"}</Dialog.Title>
              <Dialog.Description>
                {isEditing
                  ? "Update the category details."
                  : "Create a new category for tracking income or expenses."}
              </Dialog.Description>
            </Dialog.Header>

            <Dialog.Body className={css({ display: "flex", flexDir: "column", gap: "4" })}>
              {/* Name */}
              <div className={css({ display: "flex", flexDir: "column", gap: "1.5" })}>
                <label
                  htmlFor="category-name"
                  className={css({ fontSize: "sm", fontWeight: "medium" })}
                >
                  Name *
                </label>
                <Input
                  id="category-name"
                  placeholder="e.g., Hypothèque, Épicerie, Spotify"
                  {...register("name")}
                />
                {errors.name && (
                  <p className={css({ fontSize: "sm", color: "red.500" })}>{errors.name.message}</p>
                )}
              </div>

              {/* Type (INCOME / EXPENSE) */}
              <div className={css({ display: "flex", flexDir: "column", gap: "1.5" })}>
                <label className={css({ fontSize: "sm", fontWeight: "medium" })}>Type *</label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup.Root
                      value={field.value}
                      onValueChange={(details) => field.onChange(details.value)}
                      className={css({ display: "flex", gap: "4" })}
                    >
                      <RadioGroup.Item value="EXPENSE">
                        <RadioGroup.ItemControl />
                        <RadioGroup.ItemText>Expense</RadioGroup.ItemText>
                        <RadioGroup.ItemHiddenInput />
                      </RadioGroup.Item>
                      <RadioGroup.Item value="INCOME">
                        <RadioGroup.ItemControl />
                        <RadioGroup.ItemText>Income</RadioGroup.ItemText>
                        <RadioGroup.ItemHiddenInput />
                      </RadioGroup.Item>
                    </RadioGroup.Root>
                  )}
                />
                {errors.type && (
                  <p className={css({ fontSize: "sm", color: "red.500" })}>{errors.type.message}</p>
                )}
              </div>

              {/* Group select */}
              <div className={css({ display: "flex", flexDir: "column", gap: "1.5" })}>
                <label className={css({ fontSize: "sm", fontWeight: "medium" })}>Group</label>
                <Controller
                  name="group_id"
                  control={control}
                  render={({ field }) => (
                    <Select.Root
                      items={groupOptions}
                      value={field.value ? [field.value] : ["__none__"]}
                      onValueChange={(details) => {
                        const selected = details.value[0];
                        field.onChange(selected === "__none__" ? null : selected);
                      }}
                    >
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select a group" />
                        </Select.Trigger>
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content>
                          {groupOptions.map((option) => (
                            <Select.Item key={option.value} item={option}>
                              <Select.ItemText>{option.label}</Select.ItemText>
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                  )}
                />
              </div>

              {/* Icon */}
              <div className={css({ display: "flex", flexDir: "column", gap: "1.5" })}>
                <label
                  htmlFor="category-icon"
                  className={css({ fontSize: "sm", fontWeight: "medium" })}
                >
                  Icon
                </label>
                <Input
                  id="category-icon"
                  placeholder="e.g., Home, ShoppingCart, Music"
                  {...register("icon")}
                />
              </div>

              {/* Color */}
              <div className={css({ display: "flex", flexDir: "column", gap: "1.5" })}>
                <label
                  htmlFor="category-color"
                  className={css({ fontSize: "sm", fontWeight: "medium" })}
                >
                  Color
                </label>
                <div className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                  <Input
                    id="category-color-picker"
                    type="color"
                    className={css({ w: "12", h: "10", p: "1", cursor: "pointer" })}
                    {...register("color")}
                  />
                  <Input
                    id="category-color"
                    placeholder="#6366f1"
                    className={css({ flex: "1" })}
                    {...register("color")}
                  />
                </div>
              </div>
            </Dialog.Body>

            <Dialog.Footer
              className={css({ display: "flex", gap: "3", justifyContent: "flex-end" })}
            >
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" type="button" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update Category"
                    : "Create Category"}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
```

### Key Design Decisions

1. **Controller for RadioGroup and Select.** These are Ark UI state-machine components that don't expose a native `ref` — they need `Controller` from react-hook-form, not `register`.

2. **`__none__` sentinel for "No group".** The Select component needs a string value. We use `'__none__'` as the placeholder and convert it to `null` in the `onValueChange` handler. The Zod schema accepts `null` for `group_id`.

3. **`defaultGroupId` prop.** When the user clicks "Add Category" on a specific group, the form pre-selects that group. When clicking "Add Category" on the ungrouped section, it defaults to no group.

4. **Dual color input.** Same pattern as the group form — native picker + text field.

5. **`EXPENSE` as default type.** Most categories are expenses. The user can switch to `INCOME` via the radio group.

---

## File 5: `src/components/categories/category-list.tsx`

### Purpose

Renders a single category group as a collapsible card with its nested categories. Each group header shows the group name, category count, and action buttons (add category, edit group, delete group). Each category row shows icon, name, type badge, and action buttons (edit, delete).

### Complete Code

```tsx
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { Button } from "@/components/ui/button";
import type { CategoryGroup, Category } from "@/types/database";
import type { GroupWithCategories } from "@/hooks/use-categories";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryListProps {
  group: GroupWithCategories;
  onEditGroup: (group: CategoryGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddCategory: (groupId: string | null) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: "INCOME" | "EXPENSE" }) {
  const isIncome = type === "INCOME";
  return (
    <span
      className={css({
        display: "inline-flex",
        alignItems: "center",
        px: "2",
        py: "0.5",
        rounded: "full",
        fontSize: "xs",
        fontWeight: "medium",
        bg: isIncome ? "green.100" : "red.100",
        color: isIncome ? "green.800" : "red.800",
        _dark: {
          bg: isIncome ? "green.900/30" : "red.900/30",
          color: isIncome ? "green.300" : "red.300",
        },
      })}
    >
      {type}
    </span>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: "2.5",
        px: "4",
        borderBottomWidth: "1px",
        borderColor: "border.muted",
        _last: { borderBottomWidth: "0" },
        _hover: { bg: "bg.muted" },
        transition: "colors",
        transitionDuration: "150ms",
      })}
    >
      {/* Left: icon + name */}
      <div className={css({ display: "flex", alignItems: "center", gap: "3", flex: "1" })}>
        {category.icon && (
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              w: "8",
              h: "8",
              rounded: "md",
              fontSize: "sm",
            })}
            style={{
              backgroundColor: category.color ? `${category.color}15` : undefined,
              color: category.color ?? undefined,
            }}
          >
            {category.icon}
          </span>
        )}
        <span className={css({ fontWeight: "medium" })}>{category.name}</span>
      </div>

      {/* Center: type badge */}
      <div className={css({ mx: "4" })}>
        <TypeBadge type={category.type} />
      </div>

      {/* Right: actions */}
      <div className={css({ display: "flex", gap: "1" })}>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className={css({
            color: "red.500",
            _hover: { color: "red.700", bg: "red.50" },
            _dark: { _hover: { bg: "red.900/20" } },
          })}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CategoryList({
  group,
  onEditGroup,
  onDeleteGroup,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: CategoryListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isVirtualUngrouped = group.id === "__ungrouped__";

  return (
    <div
      className={css({
        borderWidth: "1px",
        borderColor: "border.default",
        rounded: "lg",
        overflow: "hidden",
        bg: "bg.default",
      })}
    >
      {/* Group header */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: "4",
          py: "3",
          bg: "bg.subtle",
          borderBottomWidth: isCollapsed ? "0" : "1px",
          borderColor: "border.default",
          cursor: "pointer",
          userSelect: "none",
        })}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {/* Left: collapse indicator + name + count */}
        <div className={css({ display: "flex", alignItems: "center", gap: "3" })}>
          <span
            className={css({
              fontSize: "sm",
              color: "fg.muted",
              transition: "transform",
              transitionDuration: "200ms",
              transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
            })}
          >
            ▼
          </span>

          {group.icon && (
            <span className={css({ fontSize: "lg" })} style={{ color: group.color ?? undefined }}>
              {group.icon}
            </span>
          )}

          <span className={css({ fontWeight: "semibold", fontSize: "md" })}>{group.name}</span>

          <span
            className={css({
              fontSize: "sm",
              color: "fg.muted",
              bg: "bg.muted",
              px: "2",
              py: "0.5",
              rounded: "full",
            })}
          >
            {group.categories.length} {group.categories.length === 1 ? "category" : "categories"}
          </span>
        </div>

        {/* Right: group actions */}
        <div className={css({ display: "flex", gap: "1" })} onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => onAddCategory(group.id)}>
            + Add
          </Button>

          {!isVirtualUngrouped && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onEditGroup(group)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteGroup(group.id)}
                className={css({
                  color: "red.500",
                  _hover: { color: "red.700", bg: "red.50" },
                  _dark: { _hover: { bg: "red.900/20" } },
                })}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Category rows */}
      {!isCollapsed && (
        <div>
          {group.categories.length === 0 ? (
            <div
              className={css({
                py: "6",
                textAlign: "center",
                color: "fg.muted",
                fontSize: "sm",
              })}
            >
              No categories in this group.{" "}
              <button
                type="button"
                onClick={() => onAddCategory(group.id)}
                className={css({
                  color: "accent.default",
                  textDecoration: "underline",
                  cursor: "pointer",
                  _hover: { color: "accent.emphasized" },
                })}
              >
                Add one
              </button>
            </div>
          ) : (
            group.categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onEdit={() => onEditCategory(category)}
                onDelete={() => onDeleteCategory(category.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

### Key Design Decisions

1. **Collapsible sections via local state.** Each group independently tracks its collapsed state. No external library needed — a boolean toggle + conditional rendering.

2. **`stopPropagation` on action buttons.** The group header is clickable to toggle collapse. Action buttons inside the header must stop propagation to avoid toggling collapse when the user clicks Edit/Delete/Add.

3. **Virtual "Ungrouped" handling.** When `group.id === '__ungrouped__'`, the Edit and Delete group buttons are hidden (you can't edit or delete the virtual section). The "Add" button still works — it creates a category with `group_id: null`.

4. **Inline color application.** Category icons get their background and color from the `style` prop, not Panda CSS, since colors are user-defined hex values stored in the database.

5. **Empty state with inline CTA.** When a group has zero categories, the empty state includes a clickable "Add one" link that opens the category form pre-targeted to that group.

---

## Route Registration

The categories route must be registered in `src/app.tsx`. Add to the router configuration:

```tsx
// In src/app.tsx, inside the route definitions:
import CategoriesPage from '@/routes/categories'

// Inside the layout route's children array:
{ path: 'categories', element: <CategoriesPage /> }
```

This is expected to already be scaffolded by Plan 1C (auth + routing). If not, the implementer should add it.

---

## Verification Checklist

After implementation, verify each of these behaviors:

### Group CRUD

- [ ] Click "Add Group" opens the group form dialog with empty fields
- [ ] Fill in name, click "Create Group" — group appears in the list instantly (no page reload)
- [ ] Click "Edit" on a group — dialog opens with pre-filled values
- [ ] Change name, click "Update Group" — group name updates instantly in the list
- [ ] Click "Delete" on a group — group disappears instantly, its categories move to "Ungrouped"
- [ ] If delete fails (network error), the group reappears (rollback)

### Category CRUD

- [ ] Click "+ Add" on a group — category form opens with that group pre-selected
- [ ] Fill in name, select type, click "Create Category" — category appears under the correct group instantly
- [ ] Click "Edit" on a category — dialog opens with pre-filled values including current group
- [ ] Change group from A to B, click "Update Category" — category moves from A to B in the list
- [ ] Click "Delete" on a category — category disappears instantly from the group
- [ ] If delete fails, the category reappears (rollback)

### Cache Behavior

- [ ] After creating a category, navigate to another page and back — category is still there (cached)
- [ ] Cache does not refetch within 5 minutes unless a mutation occurs
- [ ] After category mutation, transaction/budget/dashboard queries are invalidated (check React Query devtools)

### Toast Notifications

- [ ] Success toast on create, update, delete
- [ ] Error toast if server returns an error
- [ ] No duplicate toasts

### Edge Cases

- [ ] Creating a category with no group (group_id = null) — appears in "Ungrouped" section
- [ ] Deleting the last group — only "Ungrouped" section remains
- [ ] Empty state shown when no groups exist at all
- [ ] Form validation: name required, type required, shows error message if blank

---

## Implementation Order

Execute these steps sequentially:

1. **Create `src/hooks/use-categories.ts`** — the hook is the foundation. All UI depends on it.
2. **Create `src/components/categories/category-list.tsx`** — the display component. Can be tested with mock data before mutations work.
3. **Create `src/components/categories/group-form-dialog.tsx`** — group form. Simpler than category form (no select, no radio group).
4. **Create `src/components/categories/category-form-dialog.tsx`** — category form. Depends on groups data for the select dropdown.
5. **Create `src/routes/categories.tsx`** — the page that wires everything together.
6. **Register route in `src/app.tsx`** — add the route to the router config (if not already done by Plan 1C).
7. **Verify** — run through the verification checklist above.

---

## Notes for Implementers

- **Park UI component API may vary.** The Dialog, Select, and RadioGroup components shown here follow the Ark UI anatomy. If the installed Park UI components have a different wrapper API (e.g., pre-composed components), adapt accordingly. Check `src/components/ui/dialog.tsx`, `src/components/ui/select.tsx`, and `src/components/ui/radio-group.tsx` for the actual exported API.

- **Panda CSS import path.** The `css` function is imported from `../../../styled-system/css` (or wherever Panda generates its output). The exact path depends on the Panda config's `outdir` setting. Adjust relative imports or use a path alias if configured.

- **Supabase client import.** The hook imports `supabase` from `@/lib/supabase`. This expects a named export (not the v1 `getSupabaseBrowser()` function). Plan 1A should set this up as a simple singleton: `export const supabase = createClient(url, key)`.

- **No `useAuth` in the hook.** Unlike v1 which passed `userId` to every query, v2 uses Supabase RLS. The auth token is in the client headers; the `user_id` filter is enforced by RLS policies server-side. The hook does not need to know the user ID.

- **Toast import.** The page imports `toaster` from `@/components/ui/toast`. This is the Park UI toast utility (programmatic API). If the installed toast component uses a different API (e.g., `createToaster`), adjust the import.
