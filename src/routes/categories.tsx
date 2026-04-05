import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { css } from "../../styled-system/css";
import { useCategories, categoryKeys } from "@/hooks/use-categories";
import type { GroupWithCategories } from "@/hooks/use-categories";
import { supabase } from "@/lib/supabase";
import { CategoryList } from "@/components/categories/category-list";
import { GroupFormDialog } from "@/components/categories/group-form-dialog";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { toaster } from "@/lib/toaster";
import type { CategoryGroup, Category } from "@/types/database";

export default function CategoriesPage() {
  const { groups, isLoading, createGroup, updateGroup, createCategory, updateCategory } =
    useCategories();

  const queryClient = useQueryClient();

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);

  const handleAddGroup = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  };

  const handleEditGroup = (group: CategoryGroup) => {
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  const handleDeleteGroup = (groupId: string) => {
    const cacheKey = categoryKeys.groups();
    const prev = queryClient.getQueryData<GroupWithCategories[]>(cacheKey);
    const group = prev?.find((g) => g.id === groupId);
    let undone = false;

    // Optimistic remove
    queryClient.setQueryData<GroupWithCategories[]>(cacheKey, (old = []) => {
      const orphans = old.find((g) => g.id === groupId)?.categories ?? [];
      const filtered = old.filter((g) => g.id !== groupId);
      if (orphans.length > 0) {
        const uIdx = filtered.findIndex((g) => g.id === "__ungrouped__");
        if (uIdx !== -1) {
          filtered[uIdx] = {
            ...filtered[uIdx],
            categories: [
              ...filtered[uIdx].categories,
              ...orphans.map((c) => ({ ...c, group_id: null })),
            ],
          };
        } else {
          filtered.push({
            id: "__ungrouped__",
            user_id: "",
            name: "Ungrouped",
            icon: null,
            color: null,
            sort_order: 999999,
            created_at: "",
            categories: orphans.map((c) => ({ ...c, group_id: null })),
          });
        }
      }
      return filtered;
    });

    toaster.create({
      title: `"${group?.name}" deleted`,
      type: "info",
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          queryClient.setQueryData(cacheKey, prev);
        },
      },
      onStatusChange: async (d: { status: string }) => {
        if (d.status === "unmounted" && !undone) {
          const { error } = await supabase.from("category_groups").delete().eq("id", groupId);
          if (error) {
            queryClient.setQueryData(cacheKey, prev);
            toaster.error({ title: "Delete failed" });
          }
        }
      },
    });
  };

  const handleGroupSubmit = async (data: { name: string; icon?: string; color?: string }) => {
    try {
      if (editingGroup) {
        await updateGroup.mutateAsync({ id: editingGroup.id, ...data });
        toaster.success({ title: "Group updated" });
      } else {
        await createGroup.mutateAsync(data);
        toaster.success({ title: "Group created" });
      }
      setGroupDialogOpen(false);
    } catch {
      toaster.error({
        title: "Error",
        description: `Failed to ${editingGroup ? "update" : "create"} group.`,
      });
    }
  };

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

  const handleDeleteCategory = (categoryId: string) => {
    const cacheKey = categoryKeys.groups();
    const prev = queryClient.getQueryData<GroupWithCategories[]>(cacheKey);
    const cat = prev?.flatMap((g) => g.categories).find((c) => c.id === categoryId);
    let undone = false;

    queryClient.setQueryData<GroupWithCategories[]>(cacheKey, (old = []) =>
      old.map((g) => ({ ...g, categories: g.categories.filter((c) => c.id !== categoryId) })),
    );

    toaster.create({
      title: `"${cat?.name}" deleted`,
      type: "info",
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          queryClient.setQueryData(cacheKey, prev);
        },
      },
      onStatusChange: async (d: { status: string }) => {
        if (d.status === "unmounted" && !undone) {
          const { error } = await supabase.from("categories").delete().eq("id", categoryId);
          if (error) {
            queryClient.setQueryData(cacheKey, prev);
            toaster.error({ title: "Delete failed" });
          }
        }
      },
    });
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
        toaster.success({ title: "Category updated" });
      } else {
        await createCategory.mutateAsync(data);
        toaster.success({ title: "Category created" });
      }
      setCategoryDialogOpen(false);
    } catch {
      toaster.error({
        title: "Error",
        description: `Failed to ${editingCategory ? "update" : "create"} category.`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className={css({ py: "16", textAlign: "center", color: "fg.muted", fontSize: "sm" })}>
        Loading categories...
      </div>
    );
  }

  return (
    <div className={css({ display: "flex", flexDir: "column", gap: "6" })}>
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          pb: "2",
        })}
      >
        <div>
          <h1
            className={css({
              fontSize: "xl",
              fontWeight: "600",
              color: "fg.default",
              letterSpacing: "tight",
            })}
          >
            Categories
          </h1>
          <p className={css({ color: "fg.muted", mt: "0.5", fontSize: "sm" })}>
            Organize income and expense categories into groups.
          </p>
        </div>
        <Button size="sm" onClick={handleAddGroup}>
          New group
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className={css({ textAlign: "center", py: "16", color: "fg.muted" })}>
          <p className={css({ fontWeight: "500", mb: "1" })}>No category groups yet</p>
          <p className={css({ fontSize: "sm" })}>Create a group to start organizing categories.</p>
        </div>
      ) : (
        <div className={css({ display: "flex", flexDir: "column", gap: "3" })}>
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
