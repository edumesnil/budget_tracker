import { useState } from "react";
import { css } from "../../styled-system/css";
import { useCategories } from "@/hooks/use-categories";
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

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup.mutateAsync(groupId);
      toaster.success({ title: "Group deleted", description: "Category group has been removed." });
    } catch {
      toaster.error({ title: "Error", description: "Failed to delete group. Please try again." });
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
        toaster.success({ title: "Group created", description: `"${data.name}" has been added.` });
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

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await deleteCategory.mutateAsync(categoryId);
      toaster.success({ title: "Category deleted", description: "Category has been removed." });
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

  if (isLoading) {
    return (
      <div className={css({ py: "16", textAlign: "center", color: "fg.muted", fontSize: "sm" })}>
        Loading categories...
      </div>
    );
  }

  return (
    <div className={css({ display: "flex", flexDir: "column", gap: "6" })}>
      {/* Page header */}
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

      {/* Groups */}
      {groups.length === 0 ? (
        <div
          className={css({
            textAlign: "center",
            py: "16",
            color: "fg.muted",
          })}
        >
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
