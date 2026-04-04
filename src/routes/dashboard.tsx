import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { css } from '../../styled-system/css'
import { useTransactions } from '@/hooks/use-transactions'
import { useBudgets } from '@/hooks/use-budgets'
import { useTrendTransactions } from '@/hooks/use-trend-transactions'
import { BudgetHealthCards } from '@/components/dashboard/budget-health-cards'
import { SpendingTrend } from '@/components/dashboard/spending-trend'
import { SnapshotWidget } from '@/components/dashboard/snapshot-widget'
import { formatCurrency, getCurrentPeriod } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthLabel(month: number, year: number) {
  return `${MONTHS[month - 1]} ${year}`
}

// ---------------------------------------------------------------------------
// Month selector (shared pattern from budgets/transactions pages)
// ---------------------------------------------------------------------------

function MonthSelector({
  month,
  year,
  onPrev,
  onNext,
}: {
  month: number
  year: number
  onPrev: () => void
  onNext: () => void
}) {
  const btnCss = css({
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
  })

  return (
    <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
      <button type="button" onClick={onPrev} aria-label="Previous month" className={btnCss}>
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
      <button type="button" onClick={onNext} aria-label="Next month" className={btnCss}>
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pre-import state
// ---------------------------------------------------------------------------

function PreImportView({
  month,
  year,
  budgetGroups,
  budgetTotals,
  isLoadingBudgets,
}: {
  month: number
  year: number
  budgetGroups: ReturnType<typeof useBudgets>['budgetGroups']
  budgetTotals: ReturnType<typeof useBudgets>['totals']
  isLoadingBudgets: boolean
}) {
  const monthName = MONTHS[month - 1]

  return (
    <div className={css({ display: 'flex', flexDir: 'column', gap: '6' })}>
      {/* Status banner */}
      <div
        className={css({
          px: '4',
          py: '3',
          borderWidth: '1px',
          borderColor: 'border.default',
          rounded: 'lg',
          bg: 'bg.subtle',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '3',
        })}
      >
        <div>
          <p className={css({ fontSize: 'sm', fontWeight: '500', color: 'fg.default' })}>
            No transactions for {monthName} {year}
          </p>
          <p className={css({ fontSize: 'xs', color: 'fg.muted', mt: '0.5' })}>
            Upload a statement when ready, or add transactions manually.
          </p>
        </div>
        <Link
          to="/transactions"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '1.5',
            px: '3',
            py: '1.5',
            borderRadius: 'md',
            border: '1px solid',
            borderColor: 'border.default',
            bg: 'bg.default',
            color: 'fg.default',
            fontSize: 'xs',
            fontWeight: '500',
            cursor: 'pointer',
            textDecoration: 'none',
            minH: '11',
            _hover: { bg: 'bg.subtle' },
            transition: 'background 150ms ease',
          })}
        >
          <Plus size={12} />
          Add transaction
        </Link>
      </div>

      {/* Budget plan grid */}
      {isLoadingBudgets ? (
        <div className={css({ color: 'fg.muted', fontSize: 'sm', py: '4' })}>Loading budget plan...</div>
      ) : budgetGroups.length > 0 ? (
        <div className={css({ display: 'flex', flexDir: 'column', gap: '3' })}>
          <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' })}>
            <h2 className={css({ fontSize: 'sm', fontWeight: '600', color: 'fg.default' })}>
              Budget plan
            </h2>
            <span className={css({ fontSize: 'xs', color: 'fg.muted' })}>
              Projected net:{' '}
              <span
                className={css({ fontFamily: 'mono', fontWeight: '600' })}
                style={{ color: budgetTotals.projectedNet >= 0 ? 'hsl(174, 60%, 35%)' : 'hsl(3, 72%, 54%)' }}
              >
                {budgetTotals.projectedNet >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(budgetTotals.projectedNet))}
              </span>
            </span>
          </div>

          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: { base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: '3',
            })}
          >
            {budgetGroups.map((group) => {
              const expenseTotal = group.totalExpense
              const incomeTotal = group.totalIncome
              const isIncomeGroup = incomeTotal > 0 && expenseTotal === 0
              const displayAmount = isIncomeGroup ? incomeTotal : expenseTotal
              if (displayAmount === 0) return null

              return (
                <div
                  key={group.groupId}
                  className={css({
                    borderWidth: '1px',
                    borderColor: 'border.default',
                    rounded: 'lg',
                    bg: 'bg.default',
                    px: '4',
                    py: '3',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  })}
                >
                  <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                    {group.groupIcon && (
                      <span style={{ color: group.groupColor ?? undefined }}>{group.groupIcon}</span>
                    )}
                    <span className={css({ fontSize: 'sm', fontWeight: '500', color: 'fg.default' })}>
                      {group.groupName}
                    </span>
                  </div>
                  <span
                    className={css({ fontSize: 'sm', fontWeight: '600', fontFamily: 'mono' })}
                    style={{ color: isIncomeGroup ? 'hsl(174, 60%, 35%)' : 'var(--colors-fg-default)' }}
                  >
                    {isIncomeGroup ? '+' : ''}{formatCurrency(displayAmount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className={css({ color: 'fg.muted', fontSize: 'sm', py: '4' })}>
          No budget entries. Set up budgets to see your plan.
        </div>
      )}

      {/* Net worth snapshot */}
      <SnapshotWidget />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Post-import state
// ---------------------------------------------------------------------------

function PostImportView({
  month,
  year,
  transactions,
  transactionTotals,
  budgetGroups,
  trendTransactions,
}: {
  month: number
  year: number
  transactions: ReturnType<typeof useTransactions>['transactions']
  transactionTotals: ReturnType<typeof useTransactions>['totals']
  budgetGroups: ReturnType<typeof useBudgets>['budgetGroups']
  trendTransactions: ReturnType<typeof useTrendTransactions>['data']
}) {
  const { net, totalIncome, totalExpenses } = transactionTotals
  const surplus = net >= 0

  return (
    <div className={css({ display: 'flex', flexDir: 'column', gap: '6' })}>
      {/* Hero: surplus / deficit */}
      <div
        className={css({
          borderWidth: '1px',
          borderColor: 'border.default',
          rounded: 'xl',
          bg: 'bg.default',
          px: '6',
          py: '5',
        })}
      >
        <p
          className={css({
            fontSize: 'xs',
            fontWeight: '600',
            color: 'fg.muted',
            letterSpacing: 'wide',
            textTransform: 'uppercase',
            mb: '2',
          })}
        >
          {surplus ? 'Monthly surplus' : 'Monthly deficit'} — {MONTHS[month - 1]} {year}
        </p>

        <p
          className={css({
            fontSize: '4xl',
            fontWeight: '700',
            fontFamily: 'mono',
            letterSpacing: 'tight',
            lineHeight: '1',
          })}
          style={{ color: surplus ? 'hsl(174, 60%, 35%)' : 'hsl(3, 72%, 54%)' }}
        >
          {surplus ? '+' : '−'}{formatCurrency(Math.abs(net))}
        </p>

        <div className={css({ display: 'flex', gap: '6', mt: '3' })}>
          <div>
            <p className={css({ fontSize: 'xs', color: 'fg.muted', mb: '0.5' })}>Income</p>
            <p
              className={css({ fontSize: 'sm', fontWeight: '600', fontFamily: 'mono', color: 'income' })}
            >
              +{formatCurrency(totalIncome)}
            </p>
          </div>
          <div>
            <p className={css({ fontSize: 'xs', color: 'fg.muted', mb: '0.5' })}>Expenses</p>
            <p
              className={css({ fontSize: 'sm', fontWeight: '600', fontFamily: 'mono', color: 'expense' })}
            >
              −{formatCurrency(totalExpenses)}
            </p>
          </div>
          <div>
            <p className={css({ fontSize: 'xs', color: 'fg.muted', mb: '0.5' })}>Transactions</p>
            <p className={css({ fontSize: 'sm', fontWeight: '600', fontFamily: 'mono', color: 'fg.default' })}>
              {transactions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Budget health cards */}
      <div>
        <h2
          className={css({
            fontSize: 'sm',
            fontWeight: '600',
            color: 'fg.default',
            mb: '3',
            letterSpacing: 'tight',
          })}
        >
          Budget health
        </h2>
        <BudgetHealthCards budgetGroups={budgetGroups} transactions={transactions} />
      </div>

      {/* Month-over-month trend */}
      <div
        className={css({
          borderWidth: '1px',
          borderColor: 'border.default',
          rounded: 'xl',
          bg: 'bg.default',
          overflow: 'hidden',
        })}
      >
        <div
          className={css({
            px: '4',
            py: '3',
            borderBottom: '1px solid',
            borderColor: 'border.subtle',
            bg: 'bg.subtle',
          })}
        >
          <h2 className={css({ fontSize: 'sm', fontWeight: '600', color: 'fg.default' })}>
            6-month trend
          </h2>
          <p className={css({ fontSize: 'xs', color: 'fg.muted', mt: '0.5' })}>
            Income vs expenses
          </p>
        </div>
        <div className={css({ px: '4', py: '3' })}>
          <SpendingTrend
            transactions={trendTransactions ?? []}
            currentMonth={month}
            currentYear={year}
          />
        </div>
      </div>

      {/* Net worth snapshot */}
      <SnapshotWidget />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { month: initMonth, year: initYear } = getCurrentPeriod()
  const [month, setMonth] = useState(initMonth)
  const [year, setYear] = useState(initYear)

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else { setMonth((m) => m - 1) }
  }

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else { setMonth((m) => m + 1) }
  }

  const { transactions, isLoading: txLoading, totals } = useTransactions(month, year)
  const { budgetGroups, totals: budgetTotals, isLoading: budgetsLoading } = useBudgets(month, year)
  const { data: trendTxs } = useTrendTransactions(month, year)

  const hasTransactions = !txLoading && transactions.length > 0
  const isLoading = txLoading || budgetsLoading

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
            Dashboard
          </h1>
          <p className={css({ color: 'fg.muted', mt: '0.5', fontSize: 'sm' })}>
            {hasTransactions ? 'Actual vs budget' : 'Budget plan'}
          </p>
        </div>
        <MonthSelector month={month} year={year} onPrev={prevMonth} onNext={nextMonth} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div
          className={css({
            py: '16',
            textAlign: 'center',
            color: 'fg.muted',
            fontSize: 'sm',
          })}
        >
          Loading...
        </div>
      ) : hasTransactions ? (
        <PostImportView
          month={month}
          year={year}
          transactions={transactions}
          transactionTotals={totals}
          budgetGroups={budgetGroups}
          trendTransactions={trendTxs}
        />
      ) : (
        <PreImportView
          month={month}
          year={year}
          budgetGroups={budgetGroups}
          budgetTotals={budgetTotals}
          isLoadingBudgets={budgetsLoading}
        />
      )}
    </div>
  )
}
