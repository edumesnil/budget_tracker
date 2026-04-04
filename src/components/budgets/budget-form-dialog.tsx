import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createListCollection } from '@ark-ui/react/select'
import { css } from '../../../styled-system/css'
import * as Dialog from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import * as Select from '@/components/ui/select'
import * as Checkbox from '@/components/ui/checkbox'
import type { BudgetWithCategory } from '@/hooks/use-budgets'
import type { GroupWithCategories } from '@/hooks/use-categories'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  category_id: z.string().uuid('Category is required'),
  amount: z.number().positive('Amount must be positive'),
  is_recurring: z.boolean(),
})

type FormValues = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BudgetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing budget for edit mode; null for create */
  budget: BudgetWithCategory | null
  /** Category groups for the select, must not include virtual __ungrouped__ */
  groups: GroupWithCategories[]
  month: number
  year: number
  onSubmit: (data: FormValues & { month: number; year: number }) => Promise<void>
  isSubmitting: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  groups,
  month,
  year,
  onSubmit,
  isSubmitting,
}: BudgetFormDialogProps) {
  const isEditing = budget !== null

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category_id: '',
      amount: 0,
      is_recurring: false,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        category_id: budget?.category_id ?? '',
        amount: budget ? Number(budget.amount) : ('' as unknown as number),
        is_recurring: budget?.is_recurring ?? false,
      })
    }
  }, [open, budget, reset])

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit({ ...data, month, year })
  })

  // Build flat category list for Select, grouped by group name
  const categoryItems = useMemo(() => {
    const items: { label: string; value: string; group: string }[] = []
    for (const g of groups) {
      if (g.id === '__ungrouped__') continue
      for (const cat of g.categories) {
        items.push({ label: cat.name, value: cat.id, group: g.name })
      }
    }
    const ungrouped = groups.find((g) => g.id === '__ungrouped__')
    if (ungrouped) {
      for (const cat of ungrouped.categories) {
        items.push({ label: cat.name, value: cat.id, group: 'Ungrouped' })
      }
    }
    return items
  }, [groups])

  const categoryCollection = useMemo(
    () => createListCollection({ items: categoryItems }),
    [categoryItems],
  )

  const groupedItems = useMemo(() => {
    const map = new Map<string, typeof categoryItems>()
    for (const item of categoryItems) {
      const existing = map.get(item.group) ?? []
      existing.push(item)
      map.set(item.group, existing)
    }
    return map
  }, [categoryItems])

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  const fieldClass = css({ display: 'flex', flexDir: 'column', gap: '1.5' })
  const labelClass = css({ fontSize: 'sm', fontWeight: '500', color: 'fg.default' })
  const errorClass = css({ fontSize: 'xs', color: 'fg.muted' })

  return (
    <Dialog.Root open={open} onOpenChange={(d: { open: boolean }) => onOpenChange(d.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content className={css({ maxW: 'md', w: 'full' })}>
          <form onSubmit={handleFormSubmit}>
            <Dialog.Header>
              <Dialog.Title>
                {isEditing ? 'Edit budget' : 'New budget'}
              </Dialog.Title>
              <Dialog.Description>
                {isEditing
                  ? `Update budget for ${MONTHS[month - 1]} ${year}.`
                  : `Set a budget amount for ${MONTHS[month - 1]} ${year}.`}
              </Dialog.Description>
            </Dialog.Header>

            <Dialog.Body className={css({ display: 'flex', flexDir: 'column', gap: '4' })}>
              {/* Category */}
              <div className={fieldClass}>
                <label className={labelClass}>Category *</label>
                <Controller
                  name="category_id"
                  control={control}
                  render={({ field }) => (
                    <Select.Root
                      collection={categoryCollection}
                      value={field.value ? [field.value] : []}
                      onValueChange={(d: { value: string[] }) => {
                        field.onChange(d.value[0] ?? '')
                      }}
                      disabled={isEditing}
                    >
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select a category" />
                        <Select.Indicator />
                        </Select.Trigger>
                        <Select.Indicator />
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content
                          className={css({ maxH: '64', overflowY: 'auto' })}
                        >
                          {Array.from(groupedItems.entries()).map(([grp, items]) => (
                            <Select.ItemGroup key={grp}>
                              <Select.ItemGroupLabel
                                className={css({
                                  fontSize: 'xs',
                                  fontWeight: '600',
                                  color: 'fg.muted',
                                  letterSpacing: 'wider',
                                  textTransform: 'uppercase',
                                  px: '3',
                                  py: '1.5',
                                })}
                              >
                                {grp}
                              </Select.ItemGroupLabel>
                              {items.map((item) => (
                                <Select.Item key={item.value} item={item}>
                                  <Select.ItemText>{item.label}</Select.ItemText>
                                  <Select.ItemIndicator />
                                </Select.Item>
                              ))}
                            </Select.ItemGroup>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                  )}
                />
                {errors.category_id && (
                  <p className={errorClass}>{errors.category_id.message}</p>
                )}
              </div>

              {/* Amount */}
              <div className={fieldClass}>
                <label htmlFor="budget-amount" className={labelClass}>
                  Amount *
                </label>
                <Input
                  id="budget-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...register('amount', { valueAsNumber: true })}
                />
                {errors.amount && (
                  <p className={errorClass}>{errors.amount.message}</p>
                )}
              </div>

              {/* Recurring */}
              <div className={css({ display: 'flex', alignItems: 'center', gap: '2.5' })}>
                <Controller
                  name="is_recurring"
                  control={control}
                  render={({ field }) => (
                    <Checkbox.Root
                      id="budget-recurring"
                      checked={field.value}
                      onCheckedChange={(d) => field.onChange(d.checked === true)}
                    >
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Label
                        className={css({
                          fontSize: 'sm',
                          color: 'fg.default',
                          cursor: 'pointer',
                        })}
                      >
                        Apply to future months
                      </Checkbox.Label>
                      <Checkbox.HiddenInput />
                    </Checkbox.Root>
                  )}
                />
              </div>

              {/* Recurring note */}
              <p
                className={css({
                  fontSize: 'xs',
                  color: 'fg.muted',
                  lineHeight: '1.5',
                })}
              >
                When checked, this amount becomes the default for months without a specific entry.
              </p>
            </Dialog.Body>

            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" type="button" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button type="submit" loading={isSubmitting}>
                {isEditing ? 'Save changes' : 'Add budget'}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
