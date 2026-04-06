import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { MerchantMapping } from "@/types/database";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const merchantMappingKeys = {
  all: ["merchant-mappings"] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMerchantMappings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: merchantMappingKeys.all,
    queryFn: async (): Promise<MerchantMapping[]> => {
      const { data, error } = await supabase
        .from("merchant_mappings")
        .select("*, categories(*)")
        .order("merchant_pattern", { ascending: true });

      if (error) throw error;
      return (data ?? []) as MerchantMapping[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsert = useMutation({
    mutationFn: async (input: {
      merchant_pattern: string;
      category_id: string;
      confidence?: number;
    }) => {
      // Check for existing mapping with same pattern
      const existing = query.data?.find(
        (m) => m.merchant_pattern.toLowerCase() === input.merchant_pattern.toLowerCase(),
      );

      if (existing) {
        const { data, error } = await supabase
          .from("merchant_mappings")
          .update({ category_id: input.category_id, confidence: input.confidence ?? 1.0 })
          .eq("id", existing.id)
          .select("*, categories(*)")
          .single();
        if (error) throw error;
        return data as MerchantMapping;
      }

      const { data, error } = await supabase
        .from("merchant_mappings")
        .insert({
          merchant_pattern: input.merchant_pattern,
          category_id: input.category_id,
          confidence: input.confidence ?? 1.0,
        })
        .select("*, categories(*)")
        .single();
      if (error) throw error;
      return data as MerchantMapping;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: merchantMappingKeys.all });
    },
  });

  const upsertBatch = useMutation({
    mutationFn: async (
      items: Array<{ merchant_pattern: string; category_id: string; confidence?: number }>,
    ) => {
      // For batch: insert all, use upsert-like logic via separate queries
      // Since Supabase doesn't support ON CONFLICT on non-unique columns easily,
      // we do a delete-then-insert for each pattern
      for (const item of items) {
        await supabase
          .from("merchant_mappings")
          .delete()
          .ilike("merchant_pattern", item.merchant_pattern);

        await supabase.from("merchant_mappings").insert({
          merchant_pattern: item.merchant_pattern,
          category_id: item.category_id,
          confidence: item.confidence ?? 1.0,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: merchantMappingKeys.all });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: merchantMappingKeys.all });
      const prev = queryClient.getQueryData<MerchantMapping[]>(merchantMappingKeys.all);
      queryClient.setQueryData<MerchantMapping[]>(merchantMappingKeys.all, (old = []) =>
        old.filter((m) => m.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(merchantMappingKeys.all, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: merchantMappingKeys.all });
    },
  });

  /**
   * Look up a merchant description against existing mappings.
   * Returns the mapping if found, null otherwise.
   * Uses case-insensitive substring matching.
   */
  function lookupMerchant(description: string): MerchantMapping | null {
    if (!query.data) return null;
    const desc = description.toUpperCase();
    return query.data.find((m) => desc.includes(m.merchant_pattern.toUpperCase())) ?? null;
  }

  return {
    mappings: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    upsert,
    upsertBatch,
    remove,
    lookupMerchant,
  };
}
