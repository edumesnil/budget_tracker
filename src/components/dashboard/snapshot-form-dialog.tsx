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
import type { AccountType } from '@/types/database'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ACCOUNT_TYPES: AccountType[] = ['CELI', 'REER', 'REEE', 'EMERGENCY', 'OTHER']

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CELI: 'CELI',
  REER: 'REER',
  REEE: 'REEE',
  EMERGENCY: 'Emergency Fund',
  OTHER: 'Other',
}

const schema = z.object({
  account_name: z.string().min(1, 'Account name is required'),
  account_type: z.enum(['CELI', 'REER', 'REEE', 'EMERGENCY', 'OTHER']),
  balance: z.number({ error: 'Balance is required' }).min(0, 'Balance must be 0 or more'),
  snapshot_date: z.string().min(1, 'Date is required'),
})

type FormValues = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SnapshotFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing account names from previous snapshots — for autocomplete suggestions */
  knownAccountNames: string[]
  isSubmitting: boolean
  onSubmit: (data: FormValues) => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SnapshotFormDialog({
  open,
  onOpenChange,
  knownAccountNames,
  isSubmitting,
  onSubmit,
}: SnapshotFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      account_name: '',
      account_type: 'CELI',
      balance: '' as unknown as number,
      snapshot_date: today(),
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        account_name: '',
        account_type: 'CELI',
        balance: '' as unknown as number,
        snapshot_date: today(),
      })
    }
  }, [open, reset])

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data)
  })

  // Account type select collection
  const typeItems = useMemo(
    () =>
      ACCOUNT_TYPES.map((t) => ({
        label: ACCOUNT_TYPE_LABELS[t],
        value: t,
      })),
    [],
  )
  const typeCollection = useMemo(
    () => createListCollection({ items: typeItems }),
    [typeItems],
  )

  const fieldClass = css({ display: 'flex', flexDir: 'column', gap: '1.5' })
  const labelClass = css({ fontSize: 'sm', fontWeight: '500', color: 'fg.default' })
  const errorClass = css({ fontSize: 'xs', color: 'fg.muted' })
  const datalistId = 'snapshot-account-names'

  return (
    <Dialog.Root open={open} onOpenChange={(d: { open: boolean }) => onOpenChange(d.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content className={css({ maxW: 'md', w: 'full' })}>
          <form onSubmit={handleFormSubmit}>
            <Dialog.Header>
              <Dialog.Title>Add snapshot</Dialog.Title>
              <Dialog.Description>
                Record the current balance for an account.
              </Dialog.Description>
            </Dialog.Header>

            <Dialog.Body className={css({ display: 'flex', flexDir: 'column', gap: '4' })}>
              {/* Account name with datalist suggestions */}
              <div className={fieldClass}>
                <label htmlFor="snapshot-account-name" className={labelClass}>
                  Account name *
                </label>
                <datalist id={datalistId}>
                  {knownAccountNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <Input
                  id="snapshot-account-name"
                  type="text"
                  list={datalistId}
                  placeholder="e.g. CELI Desjardins"
                  autoComplete="off"
                  {...register('account_name')}
                />
                {errors.account_name && (
                  <p className={errorClass}>{errors.account_name.message}</p>
                )}
              </div>

              {/* Account type */}
              <div className={fieldClass}>
                <label className={labelClass}>Account type *</label>
                <Controller
                  name="account_type"
                  control={control}
                  render={({ field }) => (
                    <Select.Root
                      collection={typeCollection}
                      value={field.value ? [field.value] : []}
                      onValueChange={(d: { value: string[] }) => {
                        field.onChange((d.value[0] ?? 'CELI') as AccountType)
                      }}
                    >
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select type" />
                        <Select.Indicator />
                        </Select.Trigger>
                        <Select.Indicator />
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content>
                          {typeItems.map((item) => (
                            <Select.Item key={item.value} item={item}>
                              <Select.ItemText>{item.label}</Select.ItemText>
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                  )}
                />
                {errors.account_type && (
                  <p className={errorClass}>{errors.account_type.message}</p>
                )}
              </div>

              {/* Balance */}
              <div className={fieldClass}>
                <label htmlFor="snapshot-balance" className={labelClass}>
                  Balance *
                </label>
                <Input
                  id="snapshot-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...register('balance', { valueAsNumber: true })}
                />
                {errors.balance && (
                  <p className={errorClass}>{errors.balance.message}</p>
                )}
              </div>

              {/* Snapshot date */}
              <div className={fieldClass}>
                <label htmlFor="snapshot-date" className={labelClass}>
                  Date *
                </label>
                <Input
                  id="snapshot-date"
                  type="date"
                  {...register('snapshot_date')}
                />
                {errors.snapshot_date && (
                  <p className={errorClass}>{errors.snapshot_date.message}</p>
                )}
              </div>
            </Dialog.Body>

            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" type="button" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button type="submit" loading={isSubmitting}>
                Save snapshot
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
