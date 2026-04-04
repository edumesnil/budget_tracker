import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createListCollection } from '@ark-ui/react/select'
import { css } from '../../../styled-system/css'
import * as Dialog from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import * as RadioGroup from '@/components/ui/radio-group'
import * as Select from '@/components/ui/select'
import type { Category } from '@/types/database'
import type { GroupWithCategories } from '@/hooks/use-categories'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['INCOME', 'EXPENSE']),
  group_id: z.string().uuid().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  groups: GroupWithCategories[]
  defaultGroupId: string | null
  onSubmit: (data: CategoryFormValues) => Promise<void>
  isSubmitting: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  groups,
  defaultGroupId,
  onSubmit,
  isSubmitting,
}: CategoryFormDialogProps) {
  const isEditing = category !== null

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: 'EXPENSE',
      group_id: null,
      icon: '',
      color: '',
    },
  })

  // Reset form when dialog opens or category changes
  useEffect(() => {
    if (open) {
      reset({
        name: category?.name ?? '',
        type: category?.type ?? 'EXPENSE',
        group_id: category?.group_id ?? defaultGroupId ?? null,
        icon: category?.icon ?? '',
        color: category?.color ?? '',
      })
    }
  }, [open, category, defaultGroupId, reset])

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit({
      name: data.name,
      type: data.type,
      group_id: data.group_id,
      icon: data.icon || undefined,
      color: data.color || undefined,
    })
  })

  // Build group options for select
  const groupItems = useMemo(
    () => [
      { label: 'No group', value: '__none__' },
      ...groups.map((g) => ({ label: g.name, value: g.id })),
    ],
    [groups],
  )

  const groupCollection = useMemo(
    () => createListCollection({ items: groupItems }),
    [groupItems],
  )

  return (
    <Dialog.Root open={open} onOpenChange={(details: { open: boolean }) => onOpenChange(details.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content className={css({ maxW: 'md', w: 'full' })}>
          <form onSubmit={handleFormSubmit}>
            <Dialog.Header>
              <Dialog.Title>
                {isEditing ? 'Edit Category' : 'New Category'}
              </Dialog.Title>
              <Dialog.Description>
                {isEditing
                  ? 'Update the category details.'
                  : 'Create a new category for tracking income or expenses.'}
              </Dialog.Description>
            </Dialog.Header>

            <Dialog.Body className={css({ display: 'flex', flexDir: 'column', gap: '4' })}>
              {/* Name */}
              <div className={css({ display: 'flex', flexDir: 'column', gap: '1.5' })}>
                <label
                  htmlFor="category-name"
                  className={css({ fontSize: 'sm', fontWeight: 'medium' })}
                >
                  Name *
                </label>
                <Input
                  id="category-name"
                  placeholder="e.g., Hypotheque, Epicerie, Spotify"
                  {...register('name')}
                />
                {errors.name && (
                  <p className={css({ fontSize: 'sm', color: 'red.500' })}>
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Type (INCOME / EXPENSE) */}
              <div className={css({ display: 'flex', flexDir: 'column', gap: '1.5' })}>
                <label className={css({ fontSize: 'sm', fontWeight: 'medium' })}>
                  Type *
                </label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup.Root
                      value={field.value}
                      onValueChange={(details: { value: string | null }) => field.onChange(details.value)}
                      className={css({ display: 'flex', gap: '4' })}
                    >
                      <RadioGroup.Item value="EXPENSE">
                        <RadioGroup.ItemControl />
                        <RadioGroup.ItemText>Expense</RadioGroup.ItemText>
                        <RadioGroup.ItemHiddenInput />
                      </RadioGroup.Item>
                      <RadioGroup.Item value="INCOME">
                        <RadioGroup.ItemControl />
                        <RadioGroup.ItemText>Income</RadioGroup.ItemText>
                        <RadioGroup.ItemHiddenInput />
                      </RadioGroup.Item>
                    </RadioGroup.Root>
                  )}
                />
                {errors.type && (
                  <p className={css({ fontSize: 'sm', color: 'red.500' })}>
                    {errors.type.message}
                  </p>
                )}
              </div>

              {/* Group select */}
              <div className={css({ display: 'flex', flexDir: 'column', gap: '1.5' })}>
                <label className={css({ fontSize: 'sm', fontWeight: 'medium' })}>
                  Group
                </label>
                <Controller
                  name="group_id"
                  control={control}
                  render={({ field }) => (
                    <Select.Root
                      collection={groupCollection}
                      value={field.value ? [field.value] : ['__none__']}
                      onValueChange={(details: { value: string[] }) => {
                        const selected = details.value[0]
                        field.onChange(
                          selected === '__none__' ? null : selected,
                        )
                      }}
                    >
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select a group" />
                        </Select.Trigger>
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content>
                          {groupItems.map((option) => (
                            <Select.Item key={option.value} item={option}>
                              <Select.ItemText>{option.label}</Select.ItemText>
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                  )}
                />
              </div>

              {/* Icon */}
              <div className={css({ display: 'flex', flexDir: 'column', gap: '1.5' })}>
                <label
                  htmlFor="category-icon"
                  className={css({ fontSize: 'sm', fontWeight: 'medium' })}
                >
                  Icon
                </label>
                <Input
                  id="category-icon"
                  placeholder="e.g., Home, ShoppingCart, Music"
                  {...register('icon')}
                />
              </div>

              {/* Color */}
              <div className={css({ display: 'flex', flexDir: 'column', gap: '1.5' })}>
                <label
                  htmlFor="category-color"
                  className={css({ fontSize: 'sm', fontWeight: 'medium' })}
                >
                  Color
                </label>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                  <Input
                    id="category-color-picker"
                    type="color"
                    className={css({ w: '12', h: '10', p: '1', cursor: 'pointer' })}
                    {...register('color')}
                  />
                  <Input
                    id="category-color"
                    placeholder="#6366f1"
                    className={css({ flex: '1' })}
                    {...register('color')}
                  />
                </div>
              </div>
            </Dialog.Body>

            <Dialog.Footer className={css({ display: 'flex', gap: '3', justifyContent: 'flex-end' })}>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" type="button" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isEditing
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditing
                    ? 'Update Category'
                    : 'Create Category'}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
