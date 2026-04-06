import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getMonthRange } from "@/lib/utils";
import type { Budget, Category } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BudgetInput = {
  category_id: string;
  amount: number;
  month: number;
  year: number;
  is_recurring: boolean;
};

/** A budget entry enriched with its category join */
export type BudgetWithCategory = Budget & {
  categories: Category & {
    category_groups: {
      id: string;
      name: string;
      sort_order: number;
      icon: string | null;
      color: string | null;
    } | null;
  };
};

/**
 * A merged budget entry for display — either from a specific month/year row or
 * from the most recent recurring fallback for that category.
 */
export type MergedBudget = {
  /** The underlying budget row (specific or recurring) */
  budget: BudgetWithCategory;
  /** True if this entry came from the recurring fallback, not a specific row */
  isRecurringFallback: boolean;
};

/** Grouped budgets for rendering by category group */
export type BudgetGroup = {
  groupId: string;
  groupName: string;
  groupIcon: string | null;
  groupColor: string | null;
  sortOrder: number;
  entries: MergedBudget[];
  totalExpense: number;
  totalIncome: number;
};

export interface BudgetTotals {
  totalBudgetedIncome: number;
  totalBudgetedExpense: number;
  projectedNet: number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const budgetKeys = {
  all: ["budgets"] as const,
  month: (month: number, year: number) => [...budgetKeys.all, { month, year }] as const,
  recurring: () => [...budgetKeys.all, "recurring"] as const,
};

// ---------------------------------------------------------------------------
// Supabase select string (joins category + category_groups)
// ---------------------------------------------------------------------------

const BUDGET_SELECT = "*, categories(*, category_groups(*))" as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBudgets(month: number, year: number) {
  const queryClient = useQueryClient();

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  // -------------------------------------------------------------------------
  // Query 1: specific budgets for this month/year
  // -------------------------------------------------------------------------

  const specificQuery = useQuery({
    queryKey: budgetKeys.month(month, year),
    queryFn: async (): Promise<BudgetWithCategory[]> => {
      const { data, error } = await supabase
        .from("budgets")
        .select(BUDGET_SELECT)
        .eq("month", month)
        .eq("year", year);

      if (error) throw error;
      return (data ?? []) as BudgetWithCategory[];
    },
    staleTime: 60 * 1000, // 1 min
  });

  // -------------------------------------------------------------------------
  // Query 2: all recurring budgets (fallback templates)
  // Order desc so most recent recurring is first per category
  // -------------------------------------------------------------------------

  const recurringQuery = useQuery({
    queryKey: budgetKeys.recurring(),
    queryFn: async (): Promise<BudgetWithCategory[]> => {
      const { data, error } = await supabase
        .from("budgets")
        .select(BUDGET_SELECT)
        .eq("is_recurring", true)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;
      return (data ?? []) as BudgetWithCategory[];
    },
    staleTime: 60 * 1000, // 1 min
  });

  // -------------------------------------------------------------------------
  // Query 3: previous month budgets
  // -------------------------------------------------------------------------

  const prevBudgetQuery = useQuery({
    queryKey: budgetKeys.month(prevMonth, prevYear),
    queryFn: async (): Promise<BudgetWithCategory[]> => {
      const { data, error } = await supabase
        .from("budgets")
        .select(BUDGET_SELECT)
        .eq("month", prevMonth)
        .eq("year", prevYear);

      if (error) throw error;
      return (data ?? []) as BudgetWithCategory[];
    },
    staleTime: 60 * 1000,
  });

  // -------------------------------------------------------------------------
  // Query 4: previous month transactions (amount + category_id + type)
  // -------------------------------------------------------------------------

  const prevTransactionsQuery = useQuery({
    queryKey: ["transactions", { month: prevMonth, year: prevYear, fields: "carryover" }],
    queryFn: async () => {
      const { startDate, endDate } = getMonthRange(prevMonth, prevYear);
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, category_id, categories(type)")
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) throw error;
      return (data ?? []) as Array<{
        amount: number;
        category_id: string | null;
        categories: { type: string } | null;
      }>;
    },
    staleTime: 60 * 1000,
  });

  // -------------------------------------------------------------------------
  // Derived: carryover map — for each EXPENSE category: budgeted - actual
  // Positive = surplus (under budget), negative = deficit (over budget)
  // -------------------------------------------------------------------------

  const carryoverMap = useMemo<Map<string, number>>(() => {
    const prevBudgets = prevBudgetQuery.data ?? [];
    const prevTxns = prevTransactionsQuery.data ?? [];

    // Sum actual spending per category (expenses only)
    const spentByCat = new Map<string, number>();
    for (const txn of prevTxns) {
      if (!txn.category_id || txn.categories?.type !== "EXPENSE") continue;
      const prev = spentByCat.get(txn.category_id) ?? 0;
      spentByCat.set(txn.category_id, prev + Math.abs(Number(txn.amount)));
    }

    const map = new Map<string, number>();
    for (const b of prevBudgets) {
      if (b.categories?.type !== "EXPENSE") continue;
      const spent = spentByCat.get(b.category_id) ?? 0;
      const carryover = Number(b.amount) - spent;
      map.set(b.category_id, carryover);
    }

    return map;
  }, [prevBudgetQuery.data, prevTransactionsQuery.data]);

  // -------------------------------------------------------------------------
  // Merge: specific entries + recurring fallback
  // For each category with a recurring budget:
  //   - Use the specific entry if one exists for this month/year
  //   - Otherwise fall back to the most recent recurring entry
  // -------------------------------------------------------------------------

  const mergedBudgets = useMemo<MergedBudget[]>(() => {
    const specific = specificQuery.data ?? [];
    const recurring = recurringQuery.data ?? [];

    // Build a set of category IDs that already have a specific entry
    const specificCategoryIds = new Set(specific.map((b) => b.category_id));

    // For recurring, keep only the most recent entry per category
    // (query is already ordered desc, so first occurrence = most recent)
    const latestRecurringByCat = new Map<string, BudgetWithCategory>();
    for (const b of recurring) {
      if (!latestRecurringByCat.has(b.category_id)) {
        latestRecurringByCat.set(b.category_id, b);
      }
    }

    const result: MergedBudget[] = [];

    // Add all specific entries
    for (const b of specific) {
      result.push({ budget: b, isRecurringFallback: false });
    }

    // Add recurring fallbacks for categories not covered by specific entries
    for (const [catId, b] of latestRecurringByCat.entries()) {
      if (!specificCategoryIds.has(catId)) {
        result.push({ budget: b, isRecurringFallback: true });
      }
    }

    return result;
  }, [specificQuery.data, recurringQuery.data]);

  // -------------------------------------------------------------------------
  // Derived: grouped by category group, sorted by group sort_order
  // -------------------------------------------------------------------------

  const budgetGroups = useMemo<BudgetGroup[]>(() => {
    const groupMap = new Map<string, BudgetGroup>();

    for (const entry of mergedBudgets) {
      const cat = entry.budget.categories;
      const grp = cat?.category_groups;
      const groupId = grp?.id ?? "__ungrouped__";
      const groupName = grp?.name ?? "Ungrouped";
      const sortOrder = grp?.sort_order ?? 999999;

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          groupId,
          groupName,
          groupIcon: grp?.icon ?? null,
          groupColor: grp?.color ?? null,
          sortOrder,
          entries: [],
          totalExpense: 0,
          totalIncome: 0,
        });
      }

      const g = groupMap.get(groupId)!;
      g.entries.push(entry);

      const amount = Number(entry.budget.amount);
      if (cat?.type === "INCOME") {
        g.totalIncome += amount;
      } else {
        g.totalExpense += amount;
      }
    }

    return Array.from(groupMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [mergedBudgets]);

  // -------------------------------------------------------------------------
  // Derived: totals
  // -------------------------------------------------------------------------

  const totals = useMemo<BudgetTotals>(() => {
    let totalBudgetedIncome = 0;
    let totalBudgetedExpense = 0;

    for (const entry of mergedBudgets) {
      const amount = Number(entry.budget.amount);
      if (entry.budget.categories?.type === "INCOME") {
        totalBudgetedIncome += amount;
      } else {
        totalBudgetedExpense += amount;
      }
    }

    return {
      totalBudgetedIncome,
      totalBudgetedExpense,
      projectedNet: totalBudgetedIncome - totalBudgetedExpense,
    };
  }, [mergedBudgets]);

  // -------------------------------------------------------------------------
  // Cross-entity invalidation helper
  // -------------------------------------------------------------------------

  const invalidateDependents = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  // -------------------------------------------------------------------------
  // Mutation: create
  // -------------------------------------------------------------------------

  const create = useMutation({
    mutationFn: async (input: BudgetInput) => {
      const { data, error } = await supabase
        .from("budgets")
        .insert({
          category_id: input.category_id,
          amount: input.amount,
          month: input.month,
          year: input.year,
          is_recurring: input.is_recurring,
        })
        .select(BUDGET_SELECT)
        .single();

      if (error) throw error;
      return data as BudgetWithCategory;
    },
    onSuccess: (newBudget) => {
      // Append to specific month cache
      queryClient.setQueryData<BudgetWithCategory[]>(budgetKeys.month(month, year), (old = []) => [
        ...old,
        newBudget,
      ]);
      // If recurring, invalidate recurring cache so the template list refreshes
      if (newBudget.is_recurring) {
        queryClient.invalidateQueries({ queryKey: budgetKeys.recurring() });
      }
      invalidateDependents();
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: update
  // -------------------------------------------------------------------------

  const update = useMutation({
    mutationFn: async ({ id, ...input }: BudgetInput & { id: string }) => {
      const { data, error } = await supabase
        .from("budgets")
        .update({
          category_id: input.category_id,
          amount: input.amount,
          month: input.month,
          year: input.year,
          is_recurring: input.is_recurring,
        })
        .eq("id", id)
        .select(BUDGET_SELECT)
        .single();

      if (error) throw error;
      return data as BudgetWithCategory;
    },
    onSuccess: (updatedBudget) => {
      // Update specific month cache
      queryClient.setQueryData<BudgetWithCategory[]>(budgetKeys.month(month, year), (old = []) =>
        old.map((b) => (b.id === updatedBudget.id ? updatedBudget : b)),
      );
      // Always refresh recurring cache since is_recurring may have changed
      queryClient.invalidateQueries({ queryKey: budgetKeys.recurring() });
      invalidateDependents();
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: remove (optimistic — Layer 2)
  // -------------------------------------------------------------------------

  const remove = useMutation({
    onMutate: async (id: string) => {
      const specificKey = budgetKeys.month(month, year);
      await queryClient.cancelQueries({ queryKey: specificKey });
      const previous = queryClient.getQueryData<BudgetWithCategory[]>(specificKey);
      queryClient.setQueryData<BudgetWithCategory[]>(specificKey, (old = []) =>
        old.filter((b) => b.id !== id),
      );
      return { previous };
    },
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(budgetKeys.month(month, year), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      invalidateDependents();
    },
  });

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    /** Raw specific-month budget rows */
    budgets: specificQuery.data ?? [],
    /** Merged: specific entries + recurring fallbacks */
    mergedBudgets,
    /** Merged entries grouped by category group, sorted */
    budgetGroups,
    totals,
    carryoverMap,
    isLoading: specificQuery.isLoading || recurringQuery.isLoading,
    error: specificQuery.error ?? recurringQuery.error,
    create,
    update,
    remove,
  };
}
