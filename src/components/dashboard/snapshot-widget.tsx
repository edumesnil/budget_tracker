import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { useSnapshots } from '@/hooks/use-snapshots'
import { SnapshotFormDialog } from './snapshot-form-dialog'
import { Button } from '@/components/ui/button'
import { Toaster, toaster } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AccountType } from '@/types/database'
import * as Card from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_ORDER: AccountType[] = ['CELI', 'REER', 'REEE', 'EMERGENCY', 'OTHER']

const TYPE_LABELS: Record<AccountType, string> = {
  CELI: 'CELI',
  REER: 'REER',
  REEE: 'REEE',
  EMERGENCY: 'Emergency Fund',
  OTHER: 'Other',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AccountRow({
  accountName,
  balance,
  snapshotDate,
}: {
  accountName: string
  balance: number
  snapshotDate: string
}) {
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: '2',
        borderBottom: '1px solid',
        borderColor: 'border.subtle',
        _last: { borderBottom: 'none' },
      })}
    >
      <div className={css({ display: 'flex', flexDir: 'column', gap: '0.5' })}>
        <span className={css({ fontSize: 'sm', fontWeight: '500', color: 'fg.default' })}>
          {accountName}
        </span>
        <span className={css({ fontSize: 'xs', color: 'fg.muted' })}>
          {formatDate(snapshotDate)}
        </span>
      </div>
      <span
        className={css({
          fontSize: 'sm',
          fontWeight: '600',
          fontFamily: 'mono',
          color: 'fg.default',
        })}
      >
        {formatCurrency(balance)}
      </span>
    </div>
  )
}

function TypeSection({
  type,
  accounts,
}: {
  type: AccountType
  accounts: Array<{ name: string; balance: number; date: string }>
}) {
  if (accounts.length === 0) return null

  const sectionTotal = accounts.reduce((sum, a) => sum + a.balance, 0)

  return (
    <div className={css({ display: 'flex', flexDir: 'column', gap: '0' })}>
      {/* Section header */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: '1.5',
          mb: '0.5',
        })}
      >
        <span
          className={css({
            fontSize: 'xs',
            fontWeight: '600',
            letterSpacing: 'wide',
            textTransform: 'uppercase',
            color: 'fg.muted',
          })}
        >
          {TYPE_LABELS[type]}
        </span>
        {accounts.length > 1 && (
          <span
            className={css({
              fontSize: 'xs',
              fontWeight: '600',
              fontFamily: 'mono',
              color: 'fg.muted',
            })}
          >
            {formatCurrency(sectionTotal)}
          </span>
        )}
      </div>

      {/* Account rows */}
      <Card.Root>
        <Card.Body className={css({ px: '3', py: '0' })}>
          {accounts.map((a) => (
            <AccountRow
              key={a.name}
              accountName={a.name}
              balance={a.balance}
              snapshotDate={a.date}
            />
          ))}
        </Card.Body>
      </Card.Root>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export function SnapshotWidget() {
  const { latestByAccount, grandTotal, isLoading, create } = useSnapshots()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Group latest snapshots by account_type, preserving TYPE_ORDER
  const accountsByType = TYPE_ORDER.reduce<
    Record<AccountType, Array<{ name: string; balance: number; date: string }>>
  >(
    (acc, t) => {
      acc[t] = []
      return acc
    },
    {} as Record<AccountType, Array<{ name: string; balance: number; date: string }>>,
  )

  for (const [name, snap] of latestByAccount.entries()) {
    accountsByType[snap.account_type].push({
      name,
      balance: Number(snap.balance),
      date: snap.snapshot_date,
    })
  }

  const hasAnyData = latestByAccount.size > 0

  // Known account names for autocomplete in the form
  const knownAccountNames = Array.from(latestByAccount.keys())

  const handleSubmit = async (data: {
    account_name: string
    account_type: AccountType
    balance: number
    snapshot_date: string
  }) => {
    try {
      await create.mutateAsync(data)
      toaster.success({ title: 'Snapshot saved' })
      setDialogOpen(false)
    } catch {
      toaster.error({ title: 'Error', description: 'Failed to save snapshot.' })
    }
  }

  return (
    <Card.Root>
      <Card.Header>
        <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
          <div>
            <Card.Title className={css({ fontSize: 'sm', fontWeight: '600' })}>
              Net worth
            </Card.Title>
            <Card.Description>
              Investments &amp; emergency fund
            </Card.Description>
          </div>
          <Button size="xs" variant="outline" onClick={() => setDialogOpen(true)}>
            Update balances
          </Button>
        </div>
      </Card.Header>

      {/* Grand total */}
      <div
        className={css({
          px: '4',
          py: '3',
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        })}
      >
        {isLoading ? (
          <div
            className={css({
              h: '8',
              w: '40',
              rounded: 'md',
              bg: 'bg.muted',
            })}
          />
        ) : (
          <span
            className={css({
              fontSize: '2xl',
              fontWeight: '700',
              fontFamily: 'mono',
              color: 'fg.default',
              letterSpacing: 'tight',
            })}
          >
            {formatCurrency(grandTotal)}
          </span>
        )}
      </div>

      {/* Account sections */}
      <Card.Body className={css({ display: 'flex', flexDir: 'column', gap: '3' })}>
        {isLoading ? (
          <div
            className={css({
              py: '6',
              textAlign: 'center',
              color: 'fg.muted',
              fontSize: 'sm',
            })}
          >
            Loading...
          </div>
        ) : !hasAnyData ? (
          <div
            className={css({
              py: '6',
              textAlign: 'center',
              color: 'fg.muted',
            })}
          >
            <p className={css({ fontWeight: '500', fontSize: 'sm', mb: '0.5' })}>
              No balances recorded
            </p>
            <p className={css({ fontSize: 'xs' })}>
              Add your first account snapshot to start tracking.
            </p>
          </div>
        ) : (
          TYPE_ORDER.map((type) => (
            <TypeSection
              key={type}
              type={type}
              accounts={accountsByType[type]}
            />
          ))
        )}
      </Card.Body>

      <SnapshotFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        knownAccountNames={knownAccountNames}
        isSubmitting={create.isPending}
        onSubmit={handleSubmit}
      />

      <Toaster />
    </Card.Root>
  )
}
