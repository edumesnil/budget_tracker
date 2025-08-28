"use client"

import type { Transaction } from "@/hooks/use-transaction-data"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface TransactionDeleteDialogProps {
  transaction: Transaction | null
  isOpen: boolean
  isDeleting: boolean
  onOpenChange: (open: boolean) => void
  onConfirmDelete: () => Promise<void>
}

export function TransactionDeleteDialog({
  transaction,
  isOpen,
  isDeleting,
  onOpenChange,
  onConfirmDelete,
}: TransactionDeleteDialogProps) {
  if (!transaction) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
          <DialogDescription>Are you sure you want to delete this transaction?</DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Date</p>
            <p>{new Date(transaction.date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Amount</p>
            <p className={transaction.amount >= 0 ? "text-green-600" : "text-red-600"}>
              {transaction.amount >= 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Description</p>
            <p>{transaction.description || "Unnamed Transaction"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Category</p>
            <p>{transaction.category_name}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirmDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

