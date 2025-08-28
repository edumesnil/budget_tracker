"use client"

import { memo } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CategoryBadge } from "@/components/category-badge"
import { CategoryIcon } from "@/components/category-icon"
import type { Category } from "@/hooks/use-category-data"
import {
  CustomTable,
  CustomTableHeader,
  CustomTableBody,
  CustomTableRow,
  CustomTableCell,
  CustomTableHeaderCell,
} from "@/components/ui/custom-table"
import { LoadingState } from "@/components/shared/loading-state"
import { EmptyState } from "@/components/shared/empty-state"

interface CategoryListProps {
  categories: Category[]
  loading: boolean
  onEditCategory: (category: Category) => void
  onDeleteCategory: (category: Category) => void
}

// Memoized category row component to prevent unnecessary re-renders
const CategoryRow = memo(
  ({
    category,
    onEdit,
    onDelete,
  }: {
    category: Category
    onEdit: () => void
    onDelete: () => void
  }) => (
    <CustomTableRow key={category.id} className="grid-cols-[2fr_1fr_120px]">
      <CustomTableCell>
        <div className="flex items-center gap-3">
          <CategoryIcon icon={category.icon} color={category.color} size={18} />
          <span>{category.name}</span>
        </div>
      </CustomTableCell>
      <CustomTableCell>
        <CategoryBadge type={category.type} />
      </CustomTableCell>
      <CustomTableCell align="right">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CustomTableCell>
    </CustomTableRow>
  ),
)

CategoryRow.displayName = "CategoryRow"

export function CategoryList({ categories, loading, onEditCategory, onDeleteCategory }: CategoryListProps) {
  // Add a key to the Card component to force re-render when categories change
  const categoriesKey = categories.map((c) => c.id).join("-")

  if (loading) {
    return <LoadingState />
  }

  if (!categories || categories.length === 0) {
    return <EmptyState title="No categories found" description="Add your first category to get started." icon="Tag" />
  }

  return (
    <Card key={categoriesKey}>
      <CardContent>
        <CustomTable>
          <CustomTableHeader className="grid-cols-[2fr_1fr_120px]">
            <CustomTableHeaderCell>Name</CustomTableHeaderCell>
            <CustomTableHeaderCell>Type</CustomTableHeaderCell>
            <CustomTableHeaderCell align="right">Actions</CustomTableHeaderCell>
          </CustomTableHeader>
          <CustomTableBody>
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onEdit={() => onEditCategory(category)}
                onDelete={() => onDeleteCategory(category)}
              />
            ))}
          </CustomTableBody>
        </CustomTable>
      </CardContent>
    </Card>
  )
}

