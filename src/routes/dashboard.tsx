import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { css } from "../../styled-system/css";
import { useTransactions } from "@/hooks/use-transactions";
import { useBudgets } from "@/hooks/use-budgets";
import { useTrendTransactions } from "@/hooks/use-trend-transactions";
import { BudgetHealthCards } from "@/components/dashboard/budget-health-cards";
import { SpendingTrend } from "@/components/dashboard/spending-trend";
import { SnapshotWidget } from "@/components/dashboard/snapshot-widget";
import { formatCurrency, getCurrentPeriod } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import * as Card from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthLabel(month: number, year: number) {
  return `${MONTHS[month - 1]} ${year}`;
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
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const btnCss = css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    w: "8",
    h: "8",
    borderRadius: "md",
    bg: "bg.default",
    color: "fg.muted",
    cursor: "pointer",
    _hover: { bg: "bg.subtle", color: "fg.default" },
    transition: "background 150ms ease, color 150ms ease",
  });

  return (
    <div className={css({ display: "flex", alignItems: "center", gap: "3" })}>
      <button type="button" onClick={onPrev} aria-label="Previous month" className={btnCss}>
        <ChevronLeft size={14} />
      </button>
      <span
        className={css({
          fontSize: "sm",
          fontWeight: "600",
          color: "fg.default",
          minW: "36",
          textAlign: "center",
          letterSpacing: "tight",
        })}
      >
        {monthLabel(month, year)}
      </span>
      <button type="button" onClick={onNext} aria-label="Next month" className={btnCss}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
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
  month: number;
  year: number;
  budgetGroups: ReturnType<typeof useBudgets>["budgetGroups"];
  budgetTotals: ReturnType<typeof useBudgets>["totals"];
  isLoadingBudgets: boolean;
}) {
  const monthName = MONTHS[month - 1];

  return (
    <div className={css({ display: "flex", flexDir: "column", gap: "6" })}>
      {/* Status banner */}
      <Card.Root>
        <Card.Body className={css({ pt: "6" })}>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "3",
            })}
          >
            <div>
              <p className={css({ fontSize: "sm", fontWeight: "500", color: "fg.default" })}>
                No transactions for {monthName} {year}
              </p>
              <p className={css({ fontSize: "xs", color: "fg.muted", mt: "0.5" })}>
                Upload a statement when ready, or add transactions manually.
              </p>
            </div>
            <Button size="xs" variant="outline" asChild>
              <Link to="/transactions">
                <Plus size={12} />
                Add transaction
              </Link>
            </Button>
          </div>
        </Card.Body>
      </Card.Root>

      {/* Budget plan grid */}
      {isLoadingBudgets ? (
        <div className={css({ color: "fg.muted", fontSize: "sm", py: "4" })}>
          Loading budget plan...
        </div>
      ) : budgetGroups.length > 0 ? (
        <div className={css({ display: "flex", flexDir: "column", gap: "3" })}>
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            })}
          >
            <h2 className={css({ fontSize: "sm", fontWeight: "600", color: "fg.default" })}>
              Budget plan
            </h2>
            <span className={css({ fontSize: "xs", color: "fg.muted" })}>
              Projected net:{" "}
              <span
                className={css({
                  fontWeight: "600",
                  color: budgetTotals.projectedNet >= 0 ? "income" : "expense",
                })}
              >
                {budgetTotals.projectedNet >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(budgetTotals.projectedNet))}
              </span>
            </span>
          </div>

          <div
            className={css({
              display: "grid",
              gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              gap: "3",
            })}
          >
            {budgetGroups.map((group) => {
              const expenseTotal = group.totalExpense;
              const incomeTotal = group.totalIncome;
              const isIncomeGroup = incomeTotal > 0 && expenseTotal === 0;
              const displayAmount = isIncomeGroup ? incomeTotal : expenseTotal;
              if (displayAmount === 0) return null;

              return (
                <Card.Root key={group.groupId}>
                  <Card.Body className={css({ pt: "6" })}>
                    <div
                      className={css({
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      })}
                    >
                      <div className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                        {group.groupIcon && (
                          <span style={{ color: group.groupColor ?? undefined }}>
                            {group.groupIcon}
                          </span>
                        )}
                        <span
                          className={css({
                            fontSize: "sm",
                            fontWeight: "500",
                            color: "fg.default",
                          })}
                        >
                          {group.groupName}
                        </span>
                      </div>
                      <span
                        className={css({
                          fontSize: "sm",
                          fontWeight: "600",
                          color: isIncomeGroup ? "income" : "fg.default",
                        })}
                      >
                        {isIncomeGroup ? "+" : ""}
                        {formatCurrency(displayAmount)}
                      </span>
                    </div>
                  </Card.Body>
                </Card.Root>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={css({ color: "fg.muted", fontSize: "sm", py: "4" })}>
          No budget entries. Set up budgets to see your plan.
        </div>
      )}

      {/* Net worth snapshot */}
      <SnapshotWidget />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post-import state
// ---------------------------------------------------------------------------

type TrendView = "6m" | "12m" | "ytd";

function PostImportView({
  month,
  year,
  transactions,
  transactionTotals,
  budgetGroups,
  trendTransactions,
  trendView,
  onTrendViewChange,
  trendMonthCount,
}: {
  month: number;
  year: number;
  transactions: ReturnType<typeof useTransactions>["transactions"];
  transactionTotals: ReturnType<typeof useTransactions>["totals"];
  budgetGroups: ReturnType<typeof useBudgets>["budgetGroups"];
  trendTransactions: ReturnType<typeof useTrendTransactions>["data"];
  trendView: TrendView;
  onTrendViewChange: (view: TrendView) => void;
  trendMonthCount: number;
}) {
  const { net, totalIncome, totalExpenses } = transactionTotals;
  const surplus = net >= 0;

  return (
    <div className={css({ display: "flex", flexDir: "column", gap: "6" })}>
      {/* Hero: surplus / deficit */}
      <Card.Root>
        <Card.Body className={css({ pt: "6" })}>
          <p
            className={css({
              fontSize: "xs",
              fontWeight: "600",
              color: "fg.muted",
              letterSpacing: "wide",
              textTransform: "uppercase",
              mb: "2",
            })}
          >
            {surplus ? "Monthly surplus" : "Monthly deficit"} — {MONTHS[month - 1]} {year}
          </p>

          <p
            className={css({
              fontSize: "4xl",
              fontWeight: "700",
              letterSpacing: "tight",
              lineHeight: "1",
              color: surplus ? "income" : "expense",
            })}
          >
            {surplus ? "+" : "−"}
            {formatCurrency(Math.abs(net))}
          </p>

          <div className={css({ display: "flex", gap: "6", mt: "3" })}>
            <div>
              <p className={css({ fontSize: "xs", color: "fg.muted", mb: "0.5" })}>Income</p>
              <p className={css({ fontSize: "sm", fontWeight: "600", color: "income" })}>
                +{formatCurrency(totalIncome)}
              </p>
            </div>
            <div>
              <p className={css({ fontSize: "xs", color: "fg.muted", mb: "0.5" })}>Expenses</p>
              <p className={css({ fontSize: "sm", fontWeight: "600", color: "expense" })}>
                −{formatCurrency(totalExpenses)}
              </p>
            </div>
            <div>
              <p className={css({ fontSize: "xs", color: "fg.muted", mb: "0.5" })}>Transactions</p>
              <p className={css({ fontSize: "sm", fontWeight: "600", color: "fg.default" })}>
                {transactions.length}
              </p>
            </div>
          </div>
        </Card.Body>
      </Card.Root>

      {/* Budget health cards */}
      <div>
        <h2
          className={css({
            fontSize: "sm",
            fontWeight: "600",
            color: "fg.default",
            mb: "3",
            letterSpacing: "tight",
          })}
        >
          Budget health
        </h2>
        <BudgetHealthCards budgetGroups={budgetGroups} transactions={transactions} />
      </div>

      {/* Month-over-month trend */}
      <Card.Root>
        <Card.Header>
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            })}
          >
            <div>
              <Card.Title className={css({ fontSize: "sm", fontWeight: "600" })}>
                Spending trend
              </Card.Title>
              <Card.Description>Income vs expenses</Card.Description>
            </div>
            <div className={css({ display: "flex", gap: "1" })}>
              {(["6m", "12m", "ytd"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onTrendViewChange(v)}
                  className={css({
                    px: "2.5",
                    py: "1",
                    rounded: "md",
                    fontSize: "xs",
                    fontWeight: "500",
                    cursor: "pointer",
                    border: "none",
                    color: trendView === v ? "colorPalette.fg" : "fg.muted",
                    bg: trendView === v ? "colorPalette.3" : "transparent",
                    _hover: { bg: trendView === v ? "colorPalette.3" : "bg.subtle" },
                    transition: "background 150ms, color 150ms",
                  })}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <SpendingTrend
            transactions={trendTransactions ?? []}
            currentMonth={month}
            currentYear={year}
            monthCount={trendMonthCount}
          />
        </Card.Body>
      </Card.Root>

      {/* Net worth snapshot */}
      <SnapshotWidget />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { month: initMonth, year: initYear } = getCurrentPeriod();
  const [month, setMonth] = useState(initMonth);
  const [year, setYear] = useState(initYear);
  const [trendView, setTrendView] = useState<TrendView>("6m");

  const trendMonthCount = useMemo(() => {
    if (trendView === "12m") return 12;
    if (trendView === "ytd") return month;
    return 6;
  }, [trendView, month]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const { transactions, isLoading: txLoading, totals } = useTransactions(month, year);
  const { budgetGroups, totals: budgetTotals, isLoading: budgetsLoading } = useBudgets(month, year);
  const { data: trendTxs } = useTrendTransactions(month, year, trendMonthCount);

  const hasTransactions = !txLoading && transactions.length > 0;
  const isLoading = txLoading || budgetsLoading;

  return (
    <div className={css({ display: "flex", flexDir: "column", gap: "6" })}>
      {/* Page header */}
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          pb: "2",
        })}
      >
        <div>
          <h1
            className={css({
              fontSize: "xl",
              fontWeight: "600",
              color: "fg.default",
              letterSpacing: "tight",
            })}
          >
            Dashboard
          </h1>
          <p className={css({ color: "fg.muted", mt: "0.5", fontSize: "sm" })}>
            {hasTransactions ? "Actual vs budget" : "Budget plan"}
          </p>
        </div>
        <MonthSelector month={month} year={year} onPrev={prevMonth} onNext={nextMonth} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div
          className={css({
            py: "16",
            textAlign: "center",
            color: "fg.muted",
            fontSize: "sm",
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
          trendView={trendView}
          onTrendViewChange={setTrendView}
          trendMonthCount={trendMonthCount}
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
  );
}
