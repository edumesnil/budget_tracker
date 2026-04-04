import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { css } from '../../../styled-system/css'
import * as Dialog from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { CategoryGroup } from '@/types/database'

const groupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().optional(),
  color: z.string().optional(),
})

type GroupFormValues = z.infer<typeof groupSchema>

interface GroupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: CategoryGroup | null
  onSubmit: (data: GroupFormValues) => Promise<void>
  isSubmitting: boolean
}

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
    defaultValues: { name: '', icon: '', color: '' },
  })

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
              <Dialog.Title>{isEditing ? 'Edit group' : 'New group'}</Dialog.Title>
              <Dialog.Description>
                {isEditing
                  ? 'Update the category group details.'
                  : 'Create a group to organize related categories.'}
              </Dialog.Description>
            </Dialog.Header>

            <Dialog.Body className={css({ display: 'flex', flexDir: 'column', gap: '4' })}>
              <div className={fieldClass}>
                <label htmlFor="group-name" className={labelClass}>
                  Name *
                </label>
                <Input
                  id="group-name"
                  placeholder="e.g., Housing, Transportation, Food"
                  {...register('name')}
                />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
              </div>

              <div className={fieldClass}>
                <label htmlFor="group-icon" className={labelClass}>
                  Icon
                </label>
                <Input
                  id="group-icon"
                  placeholder="e.g., 🏠  🚗  🛒"
                  {...register('icon')}
                />
              </div>

              <div className={fieldClass}>
                <label htmlFor="group-color" className={labelClass}>
                  Color
                </label>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                  <Input
                    id="group-color-swatch"
                    type="color"
                    className={css({ w: '10', h: '9', p: '1', cursor: 'pointer', flex: 'none' })}
                    {...register('color')}
                  />
                  <Input
                    id="group-color"
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
                {isEditing ? 'Save changes' : 'Create group'}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
