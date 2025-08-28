"use client"

import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CategoryIcon } from "@/components/category-icon"
import {
  CustomTable,
  CustomTableHeader,
  CustomTableBody,
  CustomTableRow,
  CustomTableCell,
  CustomTableHeaderCell,
} from "@/components/ui/custom-table"
import { EmptyState } from "@/components/shared/empty-state"
import type { Transaction } from "@/hooks/use-transaction-data"
import { Receipt } from "lucide-react"

interface TransactionTableProps {
  transactions: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  selectedMonth: number
  selectedYear: number
  monthNames: string[]
}

export function TransactionTable({
  transactions,
  onEdit,
  onDelete,
  selectedMonth,
  selectedYear,
  monthNames,
}: TransactionTableProps) {
  return (
    <Card>
      <CardContent>
        {transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt />}
            title="No transactions found"
            description={`No transactions found for ${monthNames[selectedMonth]} ${selectedYear}. Add your first transaction to get started.`}
          />
        ) : (
          <CustomTable>
            <CustomTableHeader className="grid-cols-[1fr_2fr_1fr_1fr_100px]">
              <CustomTableHeaderCell>Date</CustomTableHeaderCell>
              <CustomTableHeaderCell>Description</CustomTableHeaderCell>
              <CustomTableHeaderCell>Category</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Amount</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Actions</CustomTableHeaderCell>
            </CustomTableHeader>
            <CustomTableBody>
              {transactions.map((transaction) => (
                <CustomTableRow key={transaction.id} className="grid-cols-[1fr_2fr_1fr_1fr_100px]">
                  <CustomTableCell>{new Date(transaction.date).toLocaleDateString()}</CustomTableCell>
                  <CustomTableCell>{transaction.description || "Unnamed Transaction"}</CustomTableCell>
                  <CustomTableCell>
                    <div className="flex items-center gap-2">
                      {transaction.category_id && (
                        <CategoryIcon
                          icon={transaction.categories?.icon}
                          color={transaction.categories?.color}
                          size={16}
                        />
                      )}
                      {transaction.category_name}
                    </div>
                  </CustomTableCell>
                  <CustomTableCell
                    align="right"
                    className={transaction.amount >= 0 ? "amount-positive" : "amount-negative"}
                  >
                    {transaction.amount >= 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
                  </CustomTableCell>
                  <CustomTableCell align="right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(transaction)} className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(transaction)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CustomTableCell>
                </CustomTableRow>
              ))}
            </CustomTableBody>
          </CustomTable>
        )}
      </CardContent>
    </Card>
  )
}

