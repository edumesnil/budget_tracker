import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { css } from '../../../styled-system/css'
import * as Dialog from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { CategoryGroup } from '@/types/database'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const groupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().optional(),
  color: z.string().optional(),
})

type GroupFormValues = z.infer<typeof groupSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GroupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: CategoryGroup | null
  onSubmit: (data: GroupFormValues) => Promise<void>
  isSubmitting: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GroupFormDialog({
  open,
  onOpenChange,
  group,
  onSubmit,
  isSubmitting,
}: GroupFormDialogProps) {
  const isEditing = group !== null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: '',
      icon: '',
      color: '',
    },
  })

  // Reset form when dialog opens or group changes
  useEffect(() => {
    if (open) {
      reset({
        name: group?.name ?? '',
        icon: group?.icon ?? '',
        color: group?.color ?? '',
      })
    }
  }, [open, group, reset])

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit({
      name: data.name,
      icon: data.icon || undefined,
      color: data.color || undefined,
    })
  })

  return (
    <Dialog.Root open={open} onOpenChange={(details: { open: boolean }) => onOpenChange(details.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content className={css({ maxW: 'md', w: 'full' })}>
          <form onSubmit={handleFormSubmit}>
            <Dialog.Header>
              <Dialog.Title>
                {isEditing ? 'Edit Group' : 'New Group'}
              </Dialog.Title>
              <Dialog.Description>
                {isEditing
                  ? 'Update the category group details.'
                  : 'Create a new category group to organize your categories.'}
              </Dialog.Description>
            </Dialog.Header>

            <Dialog.Body className={css({ display: 'flex', flexDir: 'column', gap: '4' })}>
              {/* Name */}
              <div className={css({ display: 'flex', flexDir: 'column', gap: '1.5' })}>
                <label
                  htmlFor="group-name"
                  className={css({ fontSize: 'sm', fontWeight: 'medium' })}
                >
                  Name *
                </label>
                <Input
                  id="group-name"
                  placeholder="e.g., MAISON, AUTO, NOURRITURE"
                  {...register('name')}
                />
                {errors.name && (
                  <p className={css({ fontSize: 'sm', color: 'red.500' })}>
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Icon */}
              <div className={css({ display: 'flex', flexDir: 'column', gap: '1.5' })}>
                <label
                  htmlFor="group-icon"
                  className={css({ fontSize: 'sm', fontWeight: 'medium' })}
                >
                  Icon
                </label>
                <Input
                  id="group-icon"
                  placeholder="e.g., Home, Car, ShoppingCart"
                  {...register('icon')}
                />
              </div>

              {/* Color */}
              <div className={css({ display: 'flex', flexDir: 'column', gap: '1.5' })}>
                <label
                  htmlFor="group-color"
                  className={css({ fontSize: 'sm', fontWeight: 'medium' })}
                >
                  Color
                </label>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                  <Input
                    id="group-color"
                    type="color"
                    className={css({ w: '12', h: '10', p: '1', cursor: 'pointer' })}
                    {...register('color')}
                  />
                  <Input
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
                    ? 'Update Group'
                    : 'Create Group'}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
