import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types/database";

/**
 * Fetches all transactions for the 6-month window ending at the given month/year.
 * Used exclusively by the spending trend chart.
 */
export function useTrendTransactions(endMonth: number, endYear: number) {
  // Compute the start of the window: 5 months before endMonth/endYear
  let startMonth = endMonth - 5;
  let startYear = endYear;
  if (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }

  const startDate = new Date(startYear, startMonth - 1, 1).toISOString().split("T")[0];
  const endDate = new Date(endYear, endMonth, 0).toISOString().split("T")[0];

  return useQuery({
    queryKey: ["trend-transactions", { endMonth, endYear }],
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
