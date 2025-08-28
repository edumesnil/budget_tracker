"use client"

import { useState, useCallback, useEffect } from "react"
import { CategoryList } from "@/components/categories/category-list"
import { CategoryFormDialog } from "@/components/categories/category-form-dialog"
import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog"
import { CategoryPageHeader } from "@/components/categories/category-page-header"
import { useCategoryData } from "@/hooks/use-category-data"
import type { Category } from "@/hooks/use-category-data"
import { useToast } from "@/hooks/use-toast"
import { queryClient } from "@/lib/react-query"
import { getCategoriesQueryKey } from "@/hooks/use-category-data-query"
import { useAuth } from "@/contexts/auth-context"

export function CategoriesWrapper() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  // Get categories data
  const {
    categories: allCategories,
    loading,
    error,
    success,
    fetchCategories,
    saveCategory,
    deleteCategory,
    setError,
  } = useCategoryData()

  // Force a refetch when the component mounts
  useEffect(() => {
    fetchCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle add category
  const handleAddCategory = useCallback(() => {
    setSelectedCategory(null)
    setIsAddDialogOpen(true)
  }, [])

  // Handle category edit
  const handleEditCategory = useCallback((category: Category) => {
    setSelectedCategory(category)
    setIsAddDialogOpen(true)
  }, [])

  // Handle category delete
  const handleDeleteCategory = useCallback((category: Category) => {
    setSelectedCategory(category)
    setIsDeleteDialogOpen(true)
  }, [])

  // Handle category save
  const handleSaveCategory = useCallback(
    async (categoryData: {
      id?: string
      name: string
      type: "INCOME" | "EXPENSE"
      color: string
      icon: string
    }) => {
      const isEditing = !!categoryData.id
      const result = await saveCategory(categoryData, isEditing)

      // Force a refetch after saving
      if (result && user) {
        const categoriesKey = getCategoriesQueryKey(user.id)
        queryClient.invalidateQueries({ queryKey: categoriesKey })
        setTimeout(() => fetchCategories(), 100)
      }

      return result
    },
    [saveCategory, fetchCategories, user],
  )

  // Handle category delete confirmation
  const handleDeleteConfirm = useCallback(
    async (categoryId: string, replacementCategoryId: string | null) => {
      const result = await deleteCategory(categoryId, replacementCategoryId)

      // Force a refetch after deleting
      if (result && user) {
        const categoriesKey = getCategoriesQueryKey(user.id)
        queryClient.invalidateQueries({ queryKey: categoriesKey })
        setTimeout(() => fetchCategories(), 100)
      }

      return result
    },
    [deleteCategory, fetchCategories, user],
  )

  // Show toast for errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
      setError(null)
    }
  }, [error, toast, setError])

  // Show toast for success
  useEffect(() => {
    if (success) {
      toast({
        title: "Success",
        description: success,
        variant: "success",
      })
    }
  }, [success, toast])

  return (
    <div className="space-y-6">
      <CategoryPageHeader onAddCategory={handleAddCategory} />

      <CategoryList
        categories={allCategories}
        loading={loading}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      <CategoryFormDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSave={handleSaveCategory}
        category={selectedCategory}
        error={error}
      />

      <CategoryDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDelete={handleDeleteConfirm}
        category={selectedCategory}
        categories={allCategories}
      />
    </div>
  )
}

