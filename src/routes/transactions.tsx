import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { css } from "../../styled-system/css";
import { useTransactions, transactionKeys } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useRecurringTransactions } from "@/hooks/use-recurring-transactions";
import { supabase } from "@/lib/supabase";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { toaster } from "@/lib/toaster";
import { formatCurrency, getCurrentPeriod } from "@/lib/utils";
import type { Transaction } from "@/types/database";
import * as Card from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Month label helper
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
// Page
// ---------------------------------------------------------------------------

export default function TransactionsPage() {
  const { month: initMonth, year: initYear } = getCurrentPeriod();
  const [month, setMonth] = useState(initMonth);
  const [year, setYear] = useState(initYear);

  const { transactions, isLoading, create, update, totals } = useTransactions(month, year);
  const { groups } = useCategories();
  const {
    pending: recurringPending,
    apply: applyRecurring,
    prevMonth: rPrevMonth,
  } = useRecurringTransactions(month, year);

  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Month navigation
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

  const handleAdd = () => {
    setEditingTx(null);
    setDialogOpen(true);
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const cacheKey = transactionKeys.month(month, year);
    const prev = queryClient.getQueryData<Transaction[]>(cacheKey);
    const tx = prev?.find((t) => t.id === id);
    let undone = false;

    queryClient.setQueryData<Transaction[]>(cacheKey, (old = []) => old.filter((t) => t.id !== id));

    toaster.create({
      title: `"${tx?.description || "Transaction"}" deleted`,
      type: "info",
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          queryClient.setQueryData(cacheKey, prev);
        },
      },
      onStatusChange: async (d: { status: string }) => {
        if (d.status === "unmounted" && !undone) {
          const { error } = await supabase.from("transactions").delete().eq("id", id);
          if (error) {
            queryClient.setQueryData(cacheKey, prev);
            toaster.error({ title: "Delete failed" });
          }
        }
      },
    });
  };

  const handleSubmit = async (data: {
    amount: number;
    date: string;
    description?: string;
    notes?: string;
    category_id: string | null;
    is_recurring: boolean;
  }) => {
    try {
      if (editingTx) {
        await update.mutateAsync({ id: editingTx.id, ...data });
        toaster.success({ title: "Transaction updated" });
      } else {
        await create.mutateAsync(data);
        toaster.success({ title: "Transaction added" });
      }
      setDialogOpen(false);
    } catch {
      toaster.error({
        title: "Error",
        description: `Failed to ${editingTx ? "update" : "create"} transaction.`,
      });
    }
  };

  const net = totals.net;
  const netPositive = net >= 0;

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
            Transactions
          </h1>
          <p className={css({ color: "fg.muted", mt: "0.5", fontSize: "sm" })}>
            Track and manage your income and expenses.
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          Add transaction
        </Button>
      </div>

      {/* Month selector */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "3",
        })}
      >
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Previous month"
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            w: "8",
            h: "8",
            borderRadius: "md",
            bg: "bg.default",
            color: "fg.muted",
            cursor: "pointer",
            _hover: {
              bg: "bg.subtle",
              color: "fg.default",
            },
            transition: "background 150ms ease, color 150ms ease",
          })}
        >
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

        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            w: "8",
            h: "8",
            borderRadius: "md",
            bg: "bg.default",
            color: "fg.muted",
            cursor: "pointer",
            _hover: {
              bg: "bg.subtle",
              color: "fg.default",
            },
            transition: "background 150ms ease, color 150ms ease",
          })}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Summary bar */}
      {!isLoading && (
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "4",
          })}
        >
          {/* Income */}
          <Card.Root>
            <Card.Body className={css({ pt: "6" })}>
              <p
                className={css({
                  fontSize: "xs",
                  fontWeight: "600",
                  color: "fg.muted",
                  letterSpacing: "wide",
                  textTransform: "uppercase",
                  mb: "1",
                })}
              >
                Income
              </p>
              <p
                className={css({
                  fontSize: "lg",
                  fontWeight: "600",

                  color: "income",
                })}
              >
                +{formatCurrency(totals.totalIncome)}
              </p>
            </Card.Body>
          </Card.Root>

          {/* Expenses */}
          <Card.Root>
            <Card.Body className={css({ pt: "6" })}>
              <p
                className={css({
                  fontSize: "xs",
                  fontWeight: "600",
                  color: "fg.muted",
                  letterSpacing: "wide",
                  textTransform: "uppercase",
                  mb: "1",
                })}
              >
                Expenses
              </p>
              <p
                className={css({
                  fontSize: "lg",
                  fontWeight: "600",

                  color: "expense",
                })}
              >
                −{formatCurrency(totals.totalExpenses)}
              </p>
            </Card.Body>
          </Card.Root>

          {/* Net */}
          <Card.Root>
            <Card.Body className={css({ pt: "6" })}>
              <p
                className={css({
                  fontSize: "xs",
                  fontWeight: "600",
                  color: "fg.muted",
                  letterSpacing: "wide",
                  textTransform: "uppercase",
                  mb: "1",
                })}
              >
                Net
              </p>
              <p
                className={css({
                  fontSize: "lg",
                  fontWeight: "600",

                  color: netPositive ? "income" : "expense",
                })}
              >
                {netPositive ? "+" : "−"}
                {formatCurrency(Math.abs(net))}
              </p>
            </Card.Body>
          </Card.Root>
        </div>
      )}

      {/* Recurring transactions banner */}
      {recurringPending.length > 0 && (
        <Card.Root>
          <Card.Body className={css({ pt: "6" })}>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "3",
              })}
            >
              <div>
                <p className={css({ fontSize: "sm", fontWeight: "500", color: "fg.default" })}>
                  {recurringPending.length} recurring transaction
                  {recurringPending.length !== 1 ? "s" : ""} from {MONTHS[rPrevMonth - 1]}
                </p>
                <p className={css({ fontSize: "xs", color: "fg.muted", mt: "0.5" })}>
                  {recurringPending.map((tx) => tx.description).join(", ")}
                </p>
              </div>
              <Button
                size="xs"
                onClick={() => {
                  applyRecurring.mutateAsync(recurringPending).then(() => {
                    toaster.success({ title: "Recurring transactions applied" });
                  });
                }}
                loading={applyRecurring.isPending}
              >
                <RotateCw size={12} />
                Apply recurring
              </Button>
            </div>
          </Card.Body>
        </Card.Root>
      )}

      {/* Transaction table */}
      {isLoading ? (
        <div
          className={css({
            py: "16",
            textAlign: "center",
            color: "fg.muted",
            fontSize: "sm",
          })}
        >
          Loading transactions...
        </div>
      ) : (
        <TransactionTable transactions={transactions} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editingTx}
        groups={groups}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />

      <Toaster />
    </div>
  );
}
