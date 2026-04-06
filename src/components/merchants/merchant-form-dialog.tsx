import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createListCollection } from "@ark-ui/react/collection";
import { Portal } from "@ark-ui/react/portal";
import { css } from "../../../styled-system/css";
import * as Dialog from "@/components/ui/dialog";
import * as Field from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as Select from "@/components/ui/select";
import type { MerchantMapping } from "@/types/database";
import type { GroupWithCategories } from "@/hooks/use-categories";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  merchant_pattern: z.string().min(1, "Pattern is required"),
  category_id: z.string().uuid("Category is required"),
  confidence: z.coerce.number().min(0).max(1),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MerchantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapping: MerchantMapping | null;
  groups: GroupWithCategories[];
  onSubmit: (data: FormValues) => Promise<void>;
  isSubmitting: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MerchantFormDialog({
  open,
  onOpenChange,
  mapping,
  groups,
  onSubmit,
  isSubmitting,
}: MerchantFormDialogProps) {
  const isEditing = mapping !== null;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      merchant_pattern: "",
      category_id: "",
      confidence: 1,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        merchant_pattern: mapping?.merchant_pattern ?? "",
        category_id: mapping?.category_id ?? "",
        confidence: mapping?.confidence ?? 1,
      });
    }
  }, [open, mapping, reset]);

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data);
  });

  const categoryItems = useMemo(() => {
    const items: { label: string; value: string; group: string }[] = [];
    for (const g of groups) {
      if (g.id === "__ungrouped__") continue;
      for (const cat of g.categories) {
        items.push({ label: cat.name, value: cat.id, group: g.name });
      }
    }
    const ungrouped = groups.find((g) => g.id === "__ungrouped__");
    if (ungrouped) {
      for (const cat of ungrouped.categories) {
        items.push({ label: cat.name, value: cat.id, group: "Ungrouped" });
      }
    }
    return items;
  }, [groups]);

  const categoryCollection = useMemo(
    () => createListCollection({ items: categoryItems }),
    [categoryItems],
  );

  const groupedItems = useMemo(() => {
    const map = new Map<string, typeof categoryItems>();
    for (const item of categoryItems) {
      const existing = map.get(item.group) ?? [];
      existing.push(item);
      map.set(item.group, existing);
    }
    return map;
  }, [categoryItems]);

  return (
    <Dialog.Root open={open} onOpenChange={(d: { open: boolean }) => onOpenChange(d.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content className={css({ maxW: "md", w: "full" })}>
            <form onSubmit={handleFormSubmit}>
              <Dialog.Header>
                <Dialog.Title>{isEditing ? "Edit mapping" : "New mapping"}</Dialog.Title>
                <Dialog.Description>
                  {isEditing
                    ? "Update the merchant mapping."
                    : "Create a new merchant-to-category rule."}
                </Dialog.Description>
              </Dialog.Header>

              <Dialog.Body className={css({ display: "flex", flexDir: "column", gap: "4" })}>
                <Field.Root invalid={!!errors.merchant_pattern}>
                  <Field.Label>Pattern *</Field.Label>
                  <Input
                    placeholder="e.g., NETFLIX, IGA, STARBUCKS"
                    {...register("merchant_pattern")}
                  />
                  <Field.ErrorText>{errors.merchant_pattern?.message}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={!!errors.category_id}>
                  <Field.Label>Category *</Field.Label>
                  <Controller
                    name="category_id"
                    control={control}
                    render={({ field }) => (
                      <Select.Root
                        collection={categoryCollection}
                        value={field.value ? [field.value] : []}
                        onValueChange={(d: { value: string[] }) => {
                          field.onChange(d.value[0] ?? "");
                        }}
                      >
                        <Select.Control>
                          <Select.Trigger>
                            <Select.ValueText placeholder="Select a category" />
                            <Select.Indicator />
                          </Select.Trigger>
                        </Select.Control>
                        <Select.Positioner>
                          <Select.Content className={css({ maxH: "64", overflowY: "auto" })}>
                            {Array.from(groupedItems.entries()).map(([group, items]) => (
                              <Select.ItemGroup key={group}>
                                <Select.ItemGroupLabel>{group}</Select.ItemGroupLabel>
                                {items.map((item) => (
                                  <Select.Item key={item.value} item={item}>
                                    <Select.ItemText>{item.label}</Select.ItemText>
                                    <Select.ItemIndicator />
                                  </Select.Item>
                                ))}
                              </Select.ItemGroup>
                            ))}
                          </Select.Content>
                        </Select.Positioner>
                      </Select.Root>
                    )}
                  />
                  <Field.ErrorText>{errors.category_id?.message}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={!!errors.confidence}>
                  <Field.Label>Confidence</Field.Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    placeholder="1.00"
                    {...register("confidence", { valueAsNumber: true })}
                  />
                  <Field.ErrorText>{errors.confidence?.message}</Field.ErrorText>
                </Field.Root>
              </Dialog.Body>

              <Dialog.Footer>
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline" type="button" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </Dialog.CloseTrigger>
                <Button type="submit" loading={isSubmitting}>
                  {isEditing ? "Save changes" : "Add mapping"}
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
