"use client"

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { ReactNode } from "react"

interface TransactionPageHeaderProps {
  onAddTransaction: () => void
  children?: ReactNode
}

export function TransactionPageHeader({ onAddTransaction, children }: TransactionPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">Manage your income and expenses</p>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
        {children}
        <Button className="ml-auto" onClick={onAddTransaction}>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </div>
    </div>
  )
}

