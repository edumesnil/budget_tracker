import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types/database";

/**
 * Fetches all transactions for the 6-month window ending at the given month/year.
 * Used exclusively by the spending trend chart.
 */
export function useTrendTransactions(endMonth: number, endYear: number, monthCount = 6) {
  // Compute the start of the window
  let startMonth = endMonth - (monthCount - 1);
  let startYear = endYear;
  while (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }

  const startDate = new Date(startYear, startMonth - 1, 1).toISOString().split("T")[0];
  const endDate = new Date(endYear, endMonth, 0).toISOString().split("T")[0];

  return useQuery({
    queryKey: ["trend-transactions", { endMonth, endYear, monthCount }],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(*)")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    staleTime: 0,
  });
}
