import { useState } from 'react'
import { css } from '../../styled-system/css'
import { useCategories } from '@/hooks/use-categories'
import { CategoryList } from '@/components/categories/category-list'
import { GroupFormDialog } from '@/components/categories/group-form-dialog'
import { CategoryFormDialog } from '@/components/categories/category-form-dialog'
import { Button } from '@/components/ui/button'
import { Toaster, toaster } from '@/components/ui/toast'
import type { CategoryGroup, Category } from '@/types/database'

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
  } = useCategories()

  // Dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null)

  // ---- Group actions ----

  const handleAddGroup = () => {
    setEditingGroup(null)
    setGroupDialogOpen(true)
  }

  const handleEditGroup = (group: CategoryGroup) => {
    setEditingGroup(group)
    setGroupDialogOpen(true)
  }

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup.mutateAsync(groupId)
      toaster.success({
        title: 'Group deleted',
        description: 'Category group has been removed.',
      })
    } catch {
      toaster.error({
        title: 'Error',
        description: 'Failed to delete group. Please try again.',
      })
    }
  }

  const handleGroupSubmit = async (data: {
    name: string
    icon?: string
    color?: string
  }) => {
    try {
      if (editingGroup) {
        await updateGroup.mutateAsync({ id: editingGroup.id, ...data })
        toaster.success({
          title: 'Group updated',
          description: `"${data.name}" has been updated.`,
        })
      } else {
        await createGroup.mutateAsync(data)
        toaster.success({
          title: 'Group created',
          description: `"${data.name}" has been added.`,
        })
      }
      setGroupDialogOpen(false)
    } catch {
      toaster.error({
        title: 'Error',
        description: `Failed to ${editingGroup ? 'update' : 'create'} group.`,
      })
    }
  }

  // ---- Category actions ----

  const handleAddCategory = (groupId: string | null) => {
    setEditingCategory(null)
    setTargetGroupId(groupId === '__ungrouped__' ? null : groupId)
    setCategoryDialogOpen(true)
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setTargetGroupId(category.group_id)
    setCategoryDialogOpen(true)
  }

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await deleteCategory.mutateAsync(categoryId)
      toaster.success({
        title: 'Category deleted',
        description: 'Category has been removed.',
      })
    } catch {
      toaster.error({
        title: 'Error',
        description: 'Failed to delete category. Please try again.',
      })
    }
  }

  const handleCategorySubmit = async (data: {
    name: string
    type: 'INCOME' | 'EXPENSE'
    group_id: string | null
    icon?: string
    color?: string
  }) => {
    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({ id: editingCategory.id, ...data })
        toaster.success({
          title: 'Category updated',
          description: `"${data.name}" has been updated.`,
        })
      } else {
        await createCategory.mutateAsync(data)
        toaster.success({
          title: 'Category created',
          description: `"${data.name}" has been added.`,
        })
      }
      setCategoryDialogOpen(false)
    } catch {
      toaster.error({
        title: 'Error',
        description: `Failed to ${editingCategory ? 'update' : 'create'} category.`,
      })
    }
  }

  // ---- Render ----

  if (isLoading) {
    return (
      <div className={css({ p: '6', textAlign: 'center', color: 'fg.muted' })}>
        Loading categories...
      </div>
    )
  }

  return (
    <div className={css({ display: 'flex', flexDir: 'column', gap: '6', p: '6' })}>
      {/* Page header */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        })}
      >
        <div>
          <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>
            Categories
          </h1>
          <p className={css({ color: 'fg.muted', mt: '1' })}>
            Manage category groups and categories for tracking income and expenses.
          </p>
        </div>
        <Button onClick={handleAddGroup}>Add Group</Button>
      </div>

      {/* Groups with nested categories */}
      {groups.length === 0 ? (
        <div
          className={css({
            textAlign: 'center',
            py: '12',
            color: 'fg.muted',
          })}
        >
          <p className={css({ fontSize: 'lg', fontWeight: 'medium' })}>
            No category groups yet
          </p>
          <p className={css({ mt: '2' })}>
            Create your first group to start organizing categories.
          </p>
        </div>
      ) : (
        <div className={css({ display: 'flex', flexDir: 'column', gap: '4' })}>
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
        groups={groups.filter((g) => g.id !== '__ungrouped__')}
        defaultGroupId={targetGroupId}
        onSubmit={handleCategorySubmit}
        isSubmitting={createCategory.isPending || updateCategory.isPending}
      />

      <Toaster />
    </div>
  )
}
