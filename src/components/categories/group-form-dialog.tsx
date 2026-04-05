import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Portal } from '@ark-ui/react/portal'
import { css } from '../../../styled-system/css'
import * as Dialog from '@/components/ui/dialog'
import * as Field from '@/components/ui/field'
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

  return (
    <Dialog.Root open={open} onOpenChange={(d: { open: boolean }) => onOpenChange(d.open)}>
      <Portal>
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
              <Field.Root invalid={!!errors.name}>
                <Field.Label>Name *</Field.Label>
                <Input
                  placeholder="e.g., Housing, Transportation, Food"
                  {...register('name')}
                />
                <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
              </Field.Root>

              <Field.Root>
                <Field.Label>Icon</Field.Label>
                <Input
                  placeholder="e.g., 🏠  🚗  🛒"
                  {...register('icon')}
                />
              </Field.Root>

              <Field.Root>
                <Field.Label>Color</Field.Label>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                  <Input
                    type="color"
                    className={css({ w: '10', h: '9', p: '1', cursor: 'pointer', flex: 'none' })}
                    {...register('color')}
                  />
                  <Input
                    placeholder="#6366f1"
                    className={css({ flex: '1' })}
                    {...register('color')}
                  />
                </div>
              </Field.Root>
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
      </Portal>
    </Dialog.Root>
  )
}
