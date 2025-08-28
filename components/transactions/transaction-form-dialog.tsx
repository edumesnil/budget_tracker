"use client"

import { useState, useEffect } from "react"
import { CalendarIcon, DollarSign, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CategoryBadge } from "@/components/category-badge"
import { CategoryIcon } from "@/components/category-icon"
import { FormDialog } from "@/components/shared/form-dialog"
import type { Transaction, Category, TransactionFormData } from "@/hooks/use-transaction-data"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface TransactionFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (formData: TransactionFormData) => Promise<boolean>
  transaction: Transaction | null
  categories: Category[]
  fetchingCategories: boolean
  error: string | null
  mode: "add" | "edit"
}

export function TransactionFormDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  transaction,
  categories,
  fetchingCategories,
  error,
  mode,
}: TransactionFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formDescription, setFormDescription] = useState("")
  const [formAmount, setFormAmount] = useState("")
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0])
  const [formCategoryId, setFormCategoryId] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction && mode === "edit") {
      setFormDescription(transaction.description || "")
      setFormAmount(Math.abs(transaction.amount).toString())
      const transactionDate = new Date(transaction.date)
      setSelectedDate(transactionDate)
      setFormDate(transaction.date)
      setFormCategoryId(transaction.category_id || "")
      setFormNotes(transaction.notes || "")
    } else if (mode === "add") {
      setFormDescription("")
      setFormAmount("")
      setSelectedDate(new Date())
      setFormDate(new Date().toISOString().split("T")[0])
      setFormCategoryId("")
      setFormNotes("")
    }
  }, [transaction, mode])

  // Handle date change from calendar
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setFormDate(date.toISOString().split("T")[0])
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true)

    const formData: TransactionFormData = {
      description: formDescription,
      amount: formAmount,
      date: formDate,
      categoryId: formCategoryId,
      notes: formNotes,
    }

    const success = await onSubmit(formData)

    if (success) {
      onOpenChange(false)
    }

    setIsSubmitting(false)
  }

  return (
    <FormDialog
      title={`${mode === "edit" ? "Edit" : "Add"} Transaction`}
      description={
        mode === "edit" ? "Update the details of your transaction" : "Add a new income or expense transaction"
      }
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-4 py-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="e.g., Grocery shopping, Salary, etc."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter the amount without the sign. The sign will be determined by the category type.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={formCategoryId} onValueChange={setFormCategoryId}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {fetchingCategories ? (
                <SelectItem value="loading" disabled>
                  Loading categories...
                </SelectItem>
              ) : categories.length === 0 ? (
                <SelectItem value="none" disabled>
                  No categories found
                </SelectItem>
              ) : (
                <>
                  <SelectItem value="select-placeholder" disabled>
                    Select a category
                  </SelectItem>
                  {categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id}
                      className="flex justify-between p-0 focus:bg-accent"
                    >
                      <div className="flex items-center justify-between w-full px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <CategoryIcon icon={category.icon} color={category.color} size={16} />
                          <span>{category.name}</span>
                        </div>
                        <CategoryBadge type={category.type} />
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Add any additional notes here..."
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting
            ? mode === "edit"
              ? "Updating..."
              : "Adding..."
            : mode === "edit"
              ? "Update Transaction"
              : "Add Transaction"}
        </Button>
      </div>
    </FormDialog>
  )
}

