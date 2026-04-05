import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { AccountSnapshot, AccountType, InsertAccountSnapshot } from "@/types/database";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const snapshotKeys = {
  all: ["snapshots"] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSnapshots() {
  const queryClient = useQueryClient();

  // -------------------------------------------------------------------------
  // Query: all snapshots, newest first
  // -------------------------------------------------------------------------

  const query = useQuery({
    queryKey: snapshotKeys.all,
    queryFn: async (): Promise<AccountSnapshot[]> => {
      const { data, error } = await supabase
        .from("account_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AccountSnapshot[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // -------------------------------------------------------------------------
  // Derived: latest snapshot per account_name, totals by type, grand total
  // -------------------------------------------------------------------------

  const { latestByAccount, totalsByType, grandTotal } = useMemo(() => {
    const rows = query.data ?? [];

    // latestByAccount: since query is sorted desc by date, first occurrence
    // of each account_name is the latest
    const latestMap = new Map<string, AccountSnapshot>();
    for (const s of rows) {
      if (!latestMap.has(s.account_name)) {
        latestMap.set(s.account_name, s);
      }
    }

    const totals: Record<AccountType, number> = {
      CELI: 0,
      REER: 0,
      REEE: 0,
      EMERGENCY: 0,
      OTHER: 0,
    };

    let grand = 0;
    for (const s of latestMap.values()) {
      totals[s.account_type] += Number(s.balance);
      grand += Number(s.balance);
    }

    return {
      latestByAccount: latestMap,
      totalsByType: totals,
      grandTotal: grand,
    };
  }, [query.data]);

  // -------------------------------------------------------------------------
  // Mutation: create snapshot
  // -------------------------------------------------------------------------

  const create = useMutation({
    mutationFn: async (input: InsertAccountSnapshot) => {
      const { data, error } = await supabase
        .from("account_snapshots")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as AccountSnapshot;
    },
    onSuccess: (newSnapshot) => {
      // Layer 1: prepend to cache, re-sort desc by date
      queryClient.setQueryData<AccountSnapshot[]>(snapshotKeys.all, (old = []) => {
        const updated = [newSnapshot, ...old];
        updated.sort(
          (a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime(),
        );
        return updated;
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: remove snapshot (optimistic)
  // -------------------------------------------------------------------------

  const remove = useMutation({
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: snapshotKeys.all });
      const previous = queryClient.getQueryData<AccountSnapshot[]>(snapshotKeys.all);
      queryClient.setQueryData<AccountSnapshot[]>(snapshotKeys.all, (old = []) =>
        old.filter((s) => s.id !== id),
      );
      return { previous };
    },
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_snapshots").delete().eq("id", id);

      if (error) throw error;
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(snapshotKeys.all, ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: snapshotKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // -------------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------------

  return {
    snapshots: query.data ?? [],
    latestByAccount,
    totalsByType,
    grandTotal,
    isLoading: query.isLoading,
    error: query.error,
    create,
    remove,
  };
}
