"use client"

import { Plus } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"

interface CategoryPageHeaderProps {
  onAddCategory: () => void
}

export function CategoryPageHeader({ onAddCategory }: CategoryPageHeaderProps) {
  return (
    <PageHeader
      title="Categories"
      description="Manage your income and expense categories"
      action={{
        label: "Add Category",
        icon: <Plus className="h-4 w-4 mr-2" />,
        onClick: onAddCategory,
      }}
    />
  )
}

