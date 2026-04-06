import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getMonthRange } from "@/lib/utils";
import type { Transaction } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TransactionInput = {
  amount: number;
  date: string;
  description?: string | null;
  notes?: string | null;
  category_id: string | null;
  is_recurring: boolean;
};

export interface TransactionTotals {
  totalIncome: number;
  totalExpenses: number;
  net: number;
}

// The join shape returned by queries
const TX_SELECT = "*, categories(*, category_groups(*))" as const;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const transactionKeys = {
  all: ["transactions"] as const,
  month: (month: number, year: number) => [...transactionKeys.all, { month, year }] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTransactions(month: number, year: number) {
  const queryClient = useQueryClient();
  const { startDate, endDate } = getMonthRange(month, year);
  const queryKey = transactionKeys.month(month, year);

  // -------------------------------------------------------------------------
  // Query: fetch transactions for the given month/year
  // -------------------------------------------------------------------------

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select(TX_SELECT)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    staleTime: 0, // always refetch on mount
  });

  // -------------------------------------------------------------------------
  // Derived: totals via useMemo
  // -------------------------------------------------------------------------

  const totals = useMemo<TransactionTotals>(() => {
    const txs = query.data ?? [];
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const tx of txs) {
      const type = tx.categories?.type;
      if (type === "INCOME") {
        totalIncome += Number(tx.amount);
      } else if (type === "EXPENSE") {
        totalExpenses += Number(tx.amount);
      }
    }

    return {
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
    };
  }, [query.data]);

  // -------------------------------------------------------------------------
  // Mutation: create
  // -------------------------------------------------------------------------

  const create = useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          amount: input.amount,
          date: input.date,
          description: input.description ?? null,
          notes: input.notes ?? null,
          category_id: input.category_id,
          is_recurring: input.is_recurring,
        })
        .select(TX_SELECT)
        .single();

      if (error) throw error;
      return data as Transaction;
    },
    // Layer 1: append to cache from mutation response
    onSuccess: (newTx) => {
      queryClient.setQueryData<Transaction[]>(queryKey, (old = []) => [newTx, ...old]);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: update
  // -------------------------------------------------------------------------

  const update = useMutation({
    mutationFn: async ({ id, ...input }: TransactionInput & { id: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update({
          amount: input.amount,
          date: input.date,
          description: input.description ?? null,
          notes: input.notes ?? null,
          category_id: input.category_id,
          is_recurring: input.is_recurring,
        })
        .eq("id", id)
        .select(TX_SELECT)
        .single();

      if (error) throw error;
      return data as Transaction;
    },
    // Layer 1: replace in cache from mutation response
    onSuccess: (updatedTx) => {
      queryClient.setQueryData<Transaction[]>(queryKey, (old = []) =>
        old.map((t) => (t.id === updatedTx.id ? updatedTx : t)),
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: remove (optimistic — Layer 2)
  // -------------------------------------------------------------------------

  const remove = useMutation({
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Transaction[]>(queryKey);
      queryClient.setQueryData<Transaction[]>(queryKey, (old = []) =>
        old.filter((t) => t.id !== id),
      );
      return { previous };
    },
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);

      if (error) throw error;
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // -------------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------------

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create,
    update,
    remove,
    totals,
  };
}
