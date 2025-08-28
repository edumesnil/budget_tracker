"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { IconSelector } from "@/components/simple-icon-selector"
import { ColorPicker } from "@/components/color-picker"
import { CategoryIcon } from "@/components/category-icon"
import { createCategory, updateCategory } from "@/lib/actions"
import type { Category } from "@/lib/definitions"

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Please enter a valid hex color code.",
  }),
  icon: z.string().min(1, {
    message: "Please select an icon.",
  }),
})

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category
}

export function CategoryDialog({ open, onOpenChange, category }: CategoryDialogProps) {
  const router = useRouter()
  const [showIconSelector, setShowIconSelector] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name || "",
      color: category?.color || "#6E56CF",
      icon: category?.icon || "Tag",
    },
  })

  const { control, handleSubmit, watch, setValue, formState } = form
  const color = watch("color")
  const icon = watch("icon")

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (category) {
        await updateCategory({
          id: category.id,
          ...values,
        })
      } else {
        await createCategory(values)
      }

      onOpenChange(false)
      router.refresh()
    } catch (error) {
      console.error("Failed to save category:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[60vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{category ? "Edit" : "Create"} Category</DialogTitle>
          <DialogDescription>
            {category ? "Update your category details below." : "Add a new category to organize your transactions."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {!showIconSelector ? (
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Category name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <ColorPicker color={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <FormControl>
                        <div
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => setShowIconSelector(true)}
                        >
                          <CategoryIcon icon={field.value} color={color} className="h-8 w-8" />
                          <div className="flex-1 flex justify-between items-center border rounded-md px-3 py-2">
                            <span>{field.value}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowIconSelector(true)
                              }}
                            >
                              Change
                            </Button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={!formState.isDirty}>
                    {category ? "Save changes" : "Create category"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Select an Icon</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowIconSelector(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <IconSelector
                value={icon}
                onValueChange={(value) => {
                  setValue("icon", value, { shouldDirty: true })
                  setShowIconSelector(false)
                }}
                color={color}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

