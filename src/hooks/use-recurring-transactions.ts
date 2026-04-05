import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getMonthRange } from "@/lib/utils";
import { transactionKeys } from "@/hooks/use-transactions";
import type { Transaction } from "@/types/database";

/**
 * Detects recurring transactions from the previous month that haven't been
 * copied to the current month yet. Provides an `apply` mutation to copy them.
 */
export function useRecurringTransactions(month: number, year: number) {
  const queryClient = useQueryClient();

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { startDate: prevStart, endDate: prevEnd } = getMonthRange(prevMonth, prevYear);
  const { startDate: curStart, endDate: curEnd } = getMonthRange(month, year);

  // Recurring transactions from previous month
  const prevQuery = useQuery({
    queryKey: ["recurring-templates", { month: prevMonth, year: prevYear }],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(*)")
        .eq("is_recurring", true)
        .gte("date", prevStart)
        .lte("date", prevEnd);

      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    staleTime: 60 * 1000,
  });

  // Current month transactions (shares cache with useTransactions)
  const curQuery = useQuery({
    queryKey: transactionKeys.month(month, year),
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(*, category_groups(*))")
        .gte("date", curStart)
        .lte("date", curEnd)
        .order("date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    staleTime: 0,
  });

  // Pending: recurring templates not yet in current month
  const pending = useMemo(() => {
    if (!prevQuery.data || !curQuery.data) return [];

    const existing = new Set(
      curQuery.data.map((tx) => `${tx.description}|${tx.amount}|${tx.category_id}`),
    );

    return prevQuery.data.filter(
      (tx) => !existing.has(`${tx.description}|${tx.amount}|${tx.category_id}`),
    );
  }, [prevQuery.data, curQuery.data]);

  // Apply: copy recurring transactions to current month
  const apply = useMutation({
    mutationFn: async (templates: Transaction[]) => {
      const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
      const inserts = templates.map((tx) => ({
        amount: tx.amount,
        date: firstOfMonth,
        description: tx.description,
        notes: tx.notes,
        category_id: tx.category_id,
        is_recurring: true,
      }));

      const { error } = await supabase.from("transactions").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.month(month, year) });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({
        queryKey: ["recurring-templates", { month: prevMonth, year: prevYear }],
      });
    },
  });

  return {
    pending,
    apply,
    isLoading: prevQuery.isLoading || curQuery.isLoading,
    prevMonth,
    prevYear,
  };
}
