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

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['INCOME', 'EXPENSE']),
  group_id: z.string().uuid().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  groups: GroupWithCategories[]
  defaultGroupId: string | null
  onSubmit: (data: CategoryFormValues) => Promise<void>
  isSubmitting: boolean
}

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
    defaultValues: { name: '', type: 'EXPENSE', group_id: null, icon: '', color: '' },
  })

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
              <Dialog.Title>{isEditing ? 'Edit category' : 'New category'}</Dialog.Title>
              <Dialog.Description>
                {isEditing
                  ? 'Update the category details.'
                  : 'Create a category for tracking income or expenses.'}
              </Dialog.Description>
            </Dialog.Header>

            <Dialog.Body className={css({ display: 'flex', flexDir: 'column', gap: '4' })}>
              {/* Name */}
              <div className={fieldClass}>
                <label htmlFor="category-name" className={labelClass}>
                  Name *
                </label>
                <Input
                  id="category-name"
                  placeholder="e.g., Rent, Groceries, Spotify"
                  {...register('name')}
                />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
              </div>

              {/* Type */}
              <div className={fieldClass}>
                <label className={labelClass}>Type *</label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup.Root
                      value={field.value}
                      onValueChange={(d: { value: string | null }) => field.onChange(d.value)}
                      className={css({ display: 'flex', gap: '6' })}
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
                {errors.type && <p className={errorClass}>{errors.type.message}</p>}
              </div>

              {/* Group */}
              <div className={fieldClass}>
                <label className={labelClass}>Group</label>
                <Controller
                  name="group_id"
                  control={control}
                  render={({ field }) => (
                    <Select.Root
                      collection={groupCollection}
                      value={field.value ? [field.value] : ['__none__']}
                      onValueChange={(d: { value: string[] }) => {
                        const sel = d.value[0]
                        field.onChange(sel === '__none__' ? null : sel)
                      }}
                    >
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select a group" />
                        <Select.Indicator />
                        </Select.Trigger>
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content>
                          {groupItems.map((opt) => (
                            <Select.Item key={opt.value} item={opt}>
                              <Select.ItemText>{opt.label}</Select.ItemText>
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
              <div className={fieldClass}>
                <label htmlFor="category-icon" className={labelClass}>
                  Icon
                </label>
                <Input
                  id="category-icon"
                  placeholder="e.g., 🏠  🛒  🎵"
                  {...register('icon')}
                />
              </div>

              {/* Color */}
              <div className={fieldClass}>
                <label htmlFor="category-color" className={labelClass}>
                  Color
                </label>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                  <Input
                    id="category-color-swatch"
                    type="color"
                    className={css({ w: '10', h: '9', p: '1', cursor: 'pointer', flex: 'none' })}
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

            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" type="button" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button type="submit" loading={isSubmitting}>
                {isEditing ? 'Save changes' : 'Create category'}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
