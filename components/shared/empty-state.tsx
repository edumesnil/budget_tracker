"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-8 border border-dashed rounded-lg">
      {icon && <div className="text-muted-foreground mb-4 text-4xl">{icon}</div>}
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-muted-foreground mt-2 max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-6">
          {action.label}
        </Button>
      )}
    </div>
  )
}

