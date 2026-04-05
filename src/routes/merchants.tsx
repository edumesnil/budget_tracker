import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { css } from "../../styled-system/css";
import { useMerchantMappings, merchantMappingKeys } from "@/hooks/use-merchant-mappings";
import { useCategories } from "@/hooks/use-categories";
import { supabase } from "@/lib/supabase";
import { MerchantMappingTable } from "@/components/merchants/merchant-mapping-table";
import { MerchantFormDialog } from "@/components/merchants/merchant-form-dialog";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { toaster } from "@/lib/toaster";
import type { MerchantMapping } from "@/types/database";

export default function MerchantsPage() {
  const { mappings, isLoading, upsert } = useMerchantMappings();
  const { groups } = useCategories();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<MerchantMapping | null>(null);

  const handleAdd = () => {
    setEditingMapping(null);
    setDialogOpen(true);
  };

  const handleEdit = (mapping: MerchantMapping) => {
    setEditingMapping(mapping);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const cacheKey = merchantMappingKeys.all;
    const prev = queryClient.getQueryData<MerchantMapping[]>(cacheKey);
    const mapping = prev?.find((m) => m.id === id);
    let undone = false;

    queryClient.setQueryData<MerchantMapping[]>(cacheKey, (old = []) =>
      old.filter((m) => m.id !== id),
    );

    toaster.create({
      title: `"${mapping?.merchant_pattern}" deleted`,
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
          const { error } = await supabase.from("merchant_mappings").delete().eq("id", id);
          if (error) {
            queryClient.setQueryData(cacheKey, prev);
            toaster.error({ title: "Delete failed" });
          }
        }
      },
    });
  };

  const handleSubmit = async (data: {
    merchant_pattern: string;
    category_id: string;
    confidence: number;
  }) => {
    try {
      await upsert.mutateAsync(data);
      toaster.success({
        title: editingMapping ? "Mapping updated" : "Mapping created",
        description: editingMapping
          ? `"${data.merchant_pattern}" has been updated.`
          : `"${data.merchant_pattern}" has been added.`,
      });
      setDialogOpen(false);
    } catch {
      toaster.error({
        title: "Error",
        description: `Failed to ${editingMapping ? "update" : "create"} mapping.`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className={css({ py: "16", textAlign: "center", color: "fg.muted", fontSize: "sm" })}>
        Loading merchants...
      </div>
    );
  }

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
            Merchant Mappings
          </h1>
          <p className={css({ color: "fg.muted", mt: "0.5", fontSize: "sm" })}>
            Auto-categorization rules learned during import.
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          Add mapping
        </Button>
      </div>

      {/* Content */}
      {mappings.length === 0 ? (
        <div className={css({ textAlign: "center", py: "16", color: "fg.muted" })}>
          <p className={css({ fontWeight: "500", mb: "1" })}>No merchant mappings yet</p>
          <p className={css({ fontSize: "sm" })}>
            Import a statement to build mappings automatically, or add one manually.
          </p>
        </div>
      ) : (
        <MerchantMappingTable mappings={mappings} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <MerchantFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mapping={editingMapping}
        groups={groups}
        onSubmit={handleSubmit}
        isSubmitting={upsert.isPending}
      />

      <Toaster />
    </div>
  );
}
