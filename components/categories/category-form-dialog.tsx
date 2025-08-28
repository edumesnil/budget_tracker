"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, CircleDot } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { IconSelector } from "@/components/simple-icon-selector"
import { ColorPalette } from "@/components/color-palette"
import type { Category } from "@/hooks/use-category-data"
import { getIconByName } from "@/utils/icons"
import { AnimatePresence, motion } from "framer-motion"
import React from "react"

// Define the possible dialog states
type DialogState = "category" | "icon" | "color"

interface CategoryFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSave: (categoryData: {
    id?: string
    name: string
    type: "INCOME" | "EXPENSE"
    color: string
    icon: string
  }) => Promise<boolean>
  category?: Category | null
  error: string | null
}

export function CategoryFormDialog({
  isOpen,
  onOpenChange,
  onSave,
  category,
  error: externalError,
}: CategoryFormDialogProps) {
  // Form state
  const [name, setName] = useState(category?.name || "")
  const [type, setType] = useState<"INCOME" | "EXPENSE">(category?.type || "EXPENSE")
  const [color, setColor] = useState(category?.color || "#6366f1")
  const [icon, setIcon] = useState(category?.icon || "CircleDot")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dialogState, setDialogState] = useState<DialogState>("category")
  const [formError, setFormError] = useState<string | null>(null)

  // Reset form when dialog opens/closes or category changes
  useEffect(() => {
    if (isOpen) {
      setName(category?.name || "")
      setType(category?.type || "EXPENSE")
      setColor(category?.color || "#6366f1")
      setIcon(category?.icon || "CircleDot")
      setDialogState("category")
      setFormError(null)
      setIsSubmitting(false)
    }
  }, [isOpen, category])

  // Update form error when external error changes
  useEffect(() => {
    if (externalError) {
      setFormError(externalError)
    }
  }, [externalError])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Client-side validation
    if (!name.trim()) {
      setFormError("Please enter a category name")
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      const success = await onSave({
        id: category?.id,
        name,
        type,
        color: color || "#6366f1",
        icon: icon || "CircleDot",
      })

      if (success) {
        onOpenChange(false)
      } else {
        // If onSave returns false but no error was set, set a generic error
        setFormError("Failed to save category. Please try again.")
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle color selection
  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor)
    setDialogState("category")
  }

  // Get dialog class based on state
  const getDialogClass = () => {
    switch (dialogState) {
      case "category":
        return "w-[450px] max-w-[90vw]"
      case "color":
        return "w-[400px] max-w-[90vw]"
      case "icon":
        return "w-[500px] max-w-[90vw]"
      default:
        return "w-[450px] max-w-[90vw]"
    }
  }

  // Render dialog content based on current state
  const renderDialogContent = () => {
    return (
      <AnimatePresence mode="wait">
        {dialogState === "category" && (
          <motion.div
            key="category"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col"
          >
            <DialogHeader className="pb-4">
              <DialogTitle>{category ? "Edit" : "Add"} Category</DialogTitle>
              <DialogDescription>
                {category ? "Update the details of your category" : "Create a new income or expense category"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                {/* Streamlined category name input with icon and color buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-md flex-shrink-0"
                    style={{
                      backgroundColor: `${color}15`,
                      color: color,
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDialogState("icon")
                    }}
                  >
                    {icon ? (
                      React.createElement(getIconByName(icon), {
                        className: "h-5 w-5",
                      })
                    ) : (
                      <CircleDot className="h-5 w-5" />
                    )}
                  </Button>

                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Category name"
                    className="flex-1"
                    autoFocus
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-md flex-shrink-0 flex items-center justify-center"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDialogState("color")
                    }}
                  >
                    <div className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: color }} />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Category Type</Label>
                  <Select value={type} onValueChange={(value: "INCOME" | "EXPENSE") => setType(value)}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCOME">Income</SelectItem>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? category
                      ? "Updating..."
                      : "Adding..."
                    : category
                      ? "Update Category"
                      : "Add Category"}
                </Button>
              </DialogFooter>
            </form>
          </motion.div>
        )}

        {dialogState === "icon" && (
          <motion.div
            key="icon"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full"
          >
            <DialogHeader className="pb-4">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-2 h-8 w-8 p-0"
                  onClick={() => setDialogState("category")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>Select an Icon</DialogTitle>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <IconSelector
                value={icon}
                onValueChange={(selectedIcon) => {
                  setIcon(selectedIcon)
                  setDialogState("category")
                }}
                color={color}
              />
            </div>
          </motion.div>
        )}

        {dialogState === "color" && (
          <motion.div
            key="color"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col"
          >
            <DialogHeader className="pb-4">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-2 h-8 w-8 p-0"
                  onClick={() => setDialogState("category")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>Select a Color</DialogTitle>
              </div>
            </DialogHeader>
            <div className="py-2">
              <ColorPalette value={color} onValueChange={handleColorSelect} inDialog={true} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && onOpenChange(open)}>
      <DialogContent className={`${getDialogClass()} overflow-hidden`}>{renderDialogContent()}</DialogContent>
    </Dialog>
  )
}

