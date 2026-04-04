import { useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { css } from '../../styled-system/css'
import { useBudgets } from '@/hooks/use-budgets'
import { useCategories } from '@/hooks/use-categories'
import { BudgetFormDialog } from '@/components/budgets/budget-form-dialog'
import { Button } from '@/components/ui/button'
import { Toaster, toaster } from '@/components/ui/toast'
import { formatCurrency, getCurrentPeriod } from '@/lib/utils'
import type { BudgetWithCategory, MergedBudget } from '@/hooks/use-budgets'
import * as Card from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Month label helper
// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthLabel(month: number, year: number) {
  return `${MONTHS[month - 1]} ${year}`
}

// ---------------------------------------------------------------------------
// Recurring badge
// ---------------------------------------------------------------------------

function RecurringBadge() {
  return (
    <span
      title="Using recurring template — no specific entry for this month"
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1',
        px: '1.5',
        py: '0.5',
        rounded: 'sm',
        fontSize: 'xs',
        fontWeight: '500',
        fontFamily: 'mono',
        color: 'fg.muted',
        bg: 'bg.muted',
        border: '1px solid',
        borderColor: 'border.subtle',
        letterSpacing: 'wide',
      })}
    >
      <RotateCcw size={10} />
      recurring
    </span>
  )
}

// ---------------------------------------------------------------------------
// Budget row
// ---------------------------------------------------------------------------

function BudgetRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: MergedBudget
  onEdit: () => void
  onDelete: () => void
}) {
  const { budget, isRecurringFallback } = entry
  const cat = budget.categories
  const isIncome = cat?.type === 'INCOME'

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: '2.5',
        px: '4',
        borderBottom: '1px solid',
        borderColor: 'border.subtle',
        _last: { borderBottom: 'none' },
        _hover: { bg: 'bg.subtle' },
        transition: 'background 120ms ease',
      })}
    >
      {/* Left: icon + name + recurring indicator */}
      <div className={css({ display: 'flex', alignItems: 'center', gap: '2.5', flex: '1' })}>
        {cat?.icon && (
          <span
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              w: '7',
              h: '7',
              rounded: 'md',
              fontSize: 'sm',
              flexShrink: 0,
            })}
            style={{
              backgroundColor: cat.color ? `${cat.color}20` : undefined,
              color: cat.color ?? undefined,
            }}
          >
            {cat.icon}
          </span>
        )}
        <span
          className={css({
            fontSize: 'sm',
            fontWeight: '500',
            color: 'fg.default',
          })}
        >
          {cat?.name ?? 'Unknown'}
        </span>
        {isRecurringFallback && <RecurringBadge />}
      </div>

      {/* Center: amount */}
      <div className={css({ mx: '4' })}>
        <span
          className={css({
            fontSize: 'sm',
            fontWeight: '600',
            fontFamily: 'mono',
            color: isIncome ? 'income' : 'fg.default',
          })}
        >
          {formatCurrency(Number(budget.amount))}
        </span>
      </div>

      {/* Right: actions */}
      <div className={css({ display: 'flex', gap: '1' })}>
        <Button variant="plain" size="xs" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="plain"
          size="xs"
          onClick={onDelete}
          className={css({
            color: 'fg.muted',
            _hover: { bg: 'bg.muted', color: 'fg.default' },
          })}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BudgetsPage() {
  const { month: initMonth, year: initYear } = getCurrentPeriod()
  const [month, setMonth] = useState(initMonth)
  const [year, setYear] = useState(initYear)

  const { budgetGroups, totals, isLoading, create, update, remove } = useBudgets(month, year)
  const { groups } = useCategories()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetWithCategory | null>(null)

  // Month navigation
  const prevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const handleAdd = () => {
    setEditingBudget(null)
    setDialogOpen(true)
  }

  const handleEdit = (b: BudgetWithCategory) => {
    setEditingBudget(b)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id)
      toaster.success({ title: 'Budget entry deleted' })
    } catch {
      toaster.error({ title: 'Error', description: 'Failed to delete budget entry.' })
    }
  }

  const handleSubmit = async (data: {
    category_id: string
    amount: number
    is_recurring: boolean
    month: number
    year: number
  }) => {
    try {
      if (editingBudget) {
        await update.mutateAsync({ id: editingBudget.id, ...data })
        toaster.success({ title: 'Budget updated' })
      } else {
        await create.mutateAsync(data)
        toaster.success({ title: 'Budget added' })
      }
      setDialogOpen(false)
    } catch {
      toaster.error({
        title: 'Error',
        description: `Failed to ${editingBudget ? 'update' : 'create'} budget.`,
      })
    }
  }

  const net = totals.projectedNet
  const netPositive = net >= 0

  return (
    <div className={css({ display: 'flex', flexDir: 'column', gap: '6' })}>
      {/* Page header */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pb: '2',
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        })}
      >
        <div>
          <h1
            className={css({
              fontSize: 'xl',
              fontWeight: '600',
              color: 'fg.default',
              letterSpacing: 'tight',
            })}
          >
            Budgets
          </h1>
          <p className={css({ color: 'fg.muted', mt: '0.5', fontSize: 'sm' })}>
            Set monthly budget amounts per category.
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          Add budget
        </Button>
      </div>

      {/* Month selector */}
      <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Previous month"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            w: '8',
            h: '8',
            borderRadius: 'md',
            border: '1px solid',
            borderColor: 'border.default',
            bg: 'bg.default',
            color: 'fg.muted',
            cursor: 'pointer',
            _hover: { bg: 'bg.subtle', color: 'fg.default' },
            transition: 'background 150ms ease, color 150ms ease',
          })}
        >
          <ChevronLeft size={14} />
        </button>

        <span
          className={css({
            fontSize: 'sm',
            fontWeight: '600',
            color: 'fg.default',
            minW: '36',
            textAlign: 'center',
            letterSpacing: 'tight',
          })}
        >
          {monthLabel(month, year)}
        </span>

        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            w: '8',
            h: '8',
            borderRadius: 'md',
            border: '1px solid',
            borderColor: 'border.default',
            bg: 'bg.default',
            color: 'fg.muted',
            cursor: 'pointer',
            _hover: { bg: 'bg.subtle', color: 'fg.default' },
            transition: 'background 150ms ease, color 150ms ease',
          })}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Summary bar */}
      {!isLoading && (
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '4',
          })}
        >
          {/* Income */}
          <Card.Root>
            <Card.Body>
              <p
                className={css({
                  fontSize: 'xs',
                  fontWeight: '600',
                  color: 'fg.muted',
                  letterSpacing: 'wide',
                  textTransform: 'uppercase',
                  mb: '1',
                })}
              >
                Budgeted income
              </p>
              <p
                className={css({
                  fontSize: 'lg',
                  fontWeight: '600',
                  fontFamily: 'mono',
                  color: 'income',
                })}
              >
                +{formatCurrency(totals.totalBudgetedIncome)}
              </p>
            </Card.Body>
          </Card.Root>

          {/* Expenses */}
          <Card.Root>
            <Card.Body>
              <p
                className={css({
                  fontSize: 'xs',
                  fontWeight: '600',
                  color: 'fg.muted',
                  letterSpacing: 'wide',
                  textTransform: 'uppercase',
                  mb: '1',
                })}
              >
                Budgeted expenses
              </p>
              <p
                className={css({
                  fontSize: 'lg',
                  fontWeight: '600',
                  fontFamily: 'mono',
                  color: 'expense',
                })}
              >
                −{formatCurrency(totals.totalBudgetedExpense)}
              </p>
            </Card.Body>
          </Card.Root>

          {/* Projected net */}
          <Card.Root>
            <Card.Body>
              <p
                className={css({
                  fontSize: 'xs',
                  fontWeight: '600',
                  color: 'fg.muted',
                  letterSpacing: 'wide',
                  textTransform: 'uppercase',
                  mb: '1',
                })}
              >
                Projected net
              </p>
              <p
                className={css({
                  fontSize: 'lg',
                  fontWeight: '600',
                  fontFamily: 'mono',
                  color: netPositive ? 'income' : 'expense',
                })}
              >
                {netPositive ? '+' : '−'}{formatCurrency(Math.abs(net))}
              </p>
            </Card.Body>
          </Card.Root>
        </div>
      )}

      {/* Budget groups */}
      {isLoading ? (
        <div
          className={css({
            py: '16',
            textAlign: 'center',
            color: 'fg.muted',
            fontSize: 'sm',
          })}
        >
          Loading budgets...
        </div>
      ) : budgetGroups.length === 0 ? (
        <div
          className={css({
            textAlign: 'center',
            py: '16',
            color: 'fg.muted',
          })}
        >
          <p className={css({ fontWeight: '500', mb: '1' })}>No budget entries</p>
          <p className={css({ fontSize: 'sm' })}>
            Add budget amounts for your categories, or check that recurring budgets are set up.
          </p>
        </div>
      ) : (
        <div className={css({ display: 'flex', flexDir: 'column', gap: '3' })}>
          {budgetGroups.map((group) => (
            <BudgetGroupSection
              key={group.groupId}
              group={group}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <BudgetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budget={editingBudget}
        groups={groups.filter((g) => g.id !== '__ungrouped__')}
        month={month}
        year={year}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />

      <Toaster />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Budget group section
// ---------------------------------------------------------------------------

import type { BudgetGroup } from '@/hooks/use-budgets'

function BudgetGroupSection({
  group,
  onEdit,
  onDelete,
}: {
  group: BudgetGroup
  onEdit: (b: BudgetWithCategory) => void
  onDelete: (id: string) => void
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const hasExpenses = group.totalExpense > 0
  const hasIncome = group.totalIncome > 0

  return (
    <Card.Root>
      {/* Group header */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: '4',
          py: '2.5',
          bg: 'bg.subtle',
          borderBottom: isCollapsed ? 'none' : '1px solid',
          borderColor: 'border.subtle',
          cursor: 'pointer',
          userSelect: 'none',
          borderRadius: isCollapsed ? 'inherit' : undefined,
        })}
        onClick={() => setIsCollapsed((v) => !v)}
      >
        {/* Left: chevron + icon + name + count */}
        <div className={css({ display: 'flex', alignItems: 'center', gap: '2.5' })}>
          <span
            className={css({
              fontSize: 'xs',
              color: 'fg.subtle',
              display: 'inline-block',
              transition: 'transform 200ms ease',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              lineHeight: '1',
            })}
          >
            ▾
          </span>

          {group.groupIcon && (
            <span style={{ color: group.groupColor ?? undefined }}>
              {group.groupIcon}
            </span>
          )}

          <span
            className={css({
              fontSize: 'sm',
              fontWeight: '600',
              color: 'fg.default',
            })}
          >
            {group.groupName}
          </span>

          <span
            className={css({
              fontSize: 'xs',
              color: 'fg.subtle',
              bg: 'bg.muted',
              px: '1.5',
              py: '0.5',
              rounded: 'full',
              fontFamily: 'mono',
            })}
          >
            {group.entries.length}
          </span>
        </div>

        {/* Right: group total */}
        <div
          className={css({ display: 'flex', alignItems: 'center', gap: '3' })}
          onClick={(e) => e.stopPropagation()}
        >
          {hasIncome && (
            <span
              className={css({
                fontSize: 'sm',
                fontWeight: '600',
                fontFamily: 'mono',
                color: 'income',
              })}
            >
              +{formatCurrency(group.totalIncome)}
            </span>
          )}
          {hasExpenses && (
            <span
              className={css({
                fontSize: 'sm',
                fontWeight: '600',
                fontFamily: 'mono',
                color: 'fg.muted',
              })}
            >
              {formatCurrency(group.totalExpense)}
            </span>
          )}
        </div>
      </div>

      {/* Category rows */}
      {!isCollapsed && (
        <div>
          {group.entries.length === 0 ? (
            <div
              className={css({
                py: '6',
                textAlign: 'center',
                color: 'fg.muted',
                fontSize: 'sm',
              })}
            >
              No budget entries in this group.
            </div>
          ) : (
            group.entries.map((entry) => (
              <BudgetRow
                key={entry.budget.id}
                entry={entry}
                onEdit={() => onEdit(entry.budget)}
                onDelete={() => onDelete(entry.budget.id)}
              />
            ))
          )}
        </div>
      )}
    </Card.Root>
  )
}
