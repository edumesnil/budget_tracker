import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { formatCurrency } from '@/lib/utils'
import type { BudgetGroup, MergedBudget } from '@/hooks/use-budgets'
import type { Transaction } from '@/types/database'
import * as Card from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  budgetGroups: BudgetGroup[]
  transactions: Transaction[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Spend ratio thresholds */
const THRESHOLD_WARN = 0.8
const THRESHOLD_OVER = 1.0

type HealthStatus = 'ok' | 'warn' | 'over'

function getStatus(ratio: number): HealthStatus {
  if (ratio > THRESHOLD_OVER) return 'over'
  if (ratio >= THRESHOLD_WARN) return 'warn'
  return 'ok'
}

function statusColor(s: HealthStatus): string {
  if (s === 'over') return 'var(--colors-expense)'
  if (s === 'warn') return 'var(--colors-chart-4)'
  return 'var(--colors-income)'
}

/** Build a map of category_id → total spent (EXPENSE only) from transactions */
function buildSpendMap(transactions: Transaction[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const tx of transactions) {
    if (!tx.category_id || tx.categories?.type !== 'EXPENSE') continue
    m.set(tx.category_id, (m.get(tx.category_id) ?? 0) + Number(tx.amount))
  }
  return m
}

// ---------------------------------------------------------------------------
// Category row inside expanded group
// ---------------------------------------------------------------------------

function CategoryRow({
  entry,
  spent,
}: {
  entry: MergedBudget
  spent: number
}) {
  const budgeted = Number(entry.budget.amount)
  const isIncome = entry.budget.categories?.type === 'INCOME'
  if (isIncome) return null

  const ratio = budgeted > 0 ? spent / budgeted : 0
  const pct = Math.min(ratio * 100, 100)
  const status = getStatus(ratio)
  const cat = entry.budget.categories

  return (
    <div
      className={css({
        display: 'flex',
        flexDir: 'column',
        gap: '1',
        py: '2',
        px: '3',
      })}
    >
      <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '1.5' })}>
          {cat?.icon && (
            <span className={css({ fontSize: 'sm' })} style={{ color: cat.color ?? undefined }}>
              {cat.icon}
            </span>
          )}
          <span className={css({ fontSize: 'xs', color: 'fg.default', fontWeight: '500' })}>
            {cat?.name ?? 'Unknown'}
          </span>
        </div>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '2', fontSize: 'xs' })}>
          <span className={css({ color: 'fg.muted' })}>{formatCurrency(spent)}</span>
          <span className={css({ color: 'fg.subtle' })}>/ {formatCurrency(budgeted)}</span>
        </div>
      </div>

      {/* Mini progress bar */}
      <div
        role="progressbar"
        aria-label={`${cat?.name ?? 'Category'}: ${Math.round(pct)}% of budget`}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={css({
          h: '1',
          rounded: 'full',
          bg: 'bg.muted',
          overflow: 'hidden',
        })}
      >
        <div
          className={css({ h: 'full', rounded: 'full', transition: 'width 300ms ease' })}
          style={{
            width: `${pct}%`,
            backgroundColor: statusColor(status),
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group card
// ---------------------------------------------------------------------------

function GroupCard({
  group,
  spendMap,
}: {
  group: BudgetGroup
  spendMap: Map<string, number>
}) {
  const [expanded, setExpanded] = useState(false)

  // Sum budgeted and actual for EXPENSE categories only
  let totalBudgeted = 0
  let totalActual = 0

  for (const e of group.entries) {
    if (e.budget.categories?.type !== 'EXPENSE') continue
    totalBudgeted += Number(e.budget.amount)
    totalActual += spendMap.get(e.budget.category_id) ?? 0
  }

  // Skip income-only groups from health cards (they don't have budget health)
  if (totalBudgeted === 0) return null

  const ratio = totalActual / totalBudgeted
  const pct = Math.min(ratio * 100, 100)
  const status = getStatus(ratio)
  const color = statusColor(status)

  const expenseEntries = group.entries.filter((e) => e.budget.categories?.type === 'EXPENSE')

  return (
    <Card.Root>
      {/* Header — clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={css({
          w: 'full',
          display: 'flex',
          flexDir: 'column',
          gap: '2',
          px: '4',
          pt: '3',
          pb: '3',
          cursor: 'pointer',
          textAlign: 'left',
          bg: 'transparent',
          border: 'none',
          _hover: { bg: 'bg.subtle' },
          transition: 'background 150ms ease',
          minH: '11', // 44px touch target
        })}
      >
        {/* Title row */}
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
            {group.groupIcon && (
              <span style={{ color: group.groupColor ?? undefined }}>{group.groupIcon}</span>
            )}
            <span
              className={css({
                fontSize: 'sm',
                fontWeight: '600',
                color: 'fg.default',
                letterSpacing: 'tight',
              })}
            >
              {group.groupName}
            </span>
          </div>

          <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
            <div className={css({ textAlign: 'right' })}>
              <span
                className={css({ fontSize: 'sm', fontWeight: '600' })}
                style={{ color }}
              >
                {formatCurrency(totalActual)}
              </span>
              <span className={css({ fontSize: 'xs', color: 'fg.muted', ml: '1' })}>
                / {formatCurrency(totalBudgeted)}
              </span>
            </div>

            <span
              className={css({ fontSize: 'xs', color: 'fg.subtle', transition: 'transform 200ms ease', lineHeight: '1' })}
              style={{ display: 'inline-block', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
            >
              ▾
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-label={`${group.groupName}: ${Math.round(ratio * 100)}% of budget`}
          aria-valuenow={Math.round(Math.min(ratio * 100, 100))}
          aria-valuemin={0}
          aria-valuemax={100}
          className={css({
            h: '1.5',
            rounded: 'full',
            bg: 'bg.muted',
            overflow: 'hidden',
            position: 'relative',
          })}
        >
          <div
            className={css({ h: 'full', rounded: 'full', transition: 'width 300ms ease' })}
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>

        {/* Over-budget indicator */}
        {status !== 'ok' && (
          <div className={css({ display: 'flex', justifyContent: 'flex-end' })}>
            <span
              className={css({ fontSize: 'xs', fontWeight: '500' })}
              style={{ color }}
            >
              {status === 'over'
                ? `+${formatCurrency(totalActual - totalBudgeted)} over`
                : `${Math.round(pct)}%`}
            </span>
          </div>
        )}
      </button>

      {/* Expanded category breakdown */}
      {expanded && expenseEntries.length > 0 && (
        <div
          className={css({
            bg: 'bg.subtle',
          })}
        >
          {expenseEntries.map((e) => (
            <CategoryRow
              key={e.budget.id}
              entry={e}
              spent={spendMap.get(e.budget.category_id) ?? 0}
            />
          ))}
        </div>
      )}
    </Card.Root>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BudgetHealthCards({ budgetGroups, transactions }: Props) {
  const spendMap = buildSpendMap(transactions)

  if (budgetGroups.length === 0) {
    return (
      <div className={css({ color: 'fg.muted', fontSize: 'sm', textAlign: 'center', py: '6' })}>
        No budget entries. Set up budgets to see health cards.
      </div>
    )
  }

  return (
    <div
      className={css({
        display: 'grid',
        gridTemplateColumns: { base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        gap: '3',
      })}
    >
      {budgetGroups.map((g) => (
        <GroupCard key={g.groupId} group={g} spendMap={spendMap} />
      ))}
    </div>
  )
}
