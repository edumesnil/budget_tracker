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
import * as Checkbox from "@/components/ui/checkbox";
import type { Transaction } from "@/types/database";
import type { GroupWithCategories } from "@/hooks/use-categories";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
  category_id: z.string().uuid().nullable(),
  is_recurring: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  groups: GroupWithCategories[];
  onSubmit: (data: FormValues) => Promise<void>;
  isSubmitting: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  groups,
  onSubmit,
  isSubmitting,
}: TransactionFormDialogProps) {
  const isEditing = transaction !== null;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: 0,
      date: "",
      description: "",
      notes: "",
      category_id: null,
      is_recurring: false,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        amount: transaction ? Number(transaction.amount) : undefined,
        date: transaction?.date ?? new Date().toISOString().split("T")[0],
        description: transaction?.description ?? "",
        notes: transaction?.notes ?? "",
        category_id: transaction?.category_id ?? null,
        is_recurring: transaction?.is_recurring ?? false,
      });
    }
  }, [open, transaction, reset]);

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data);
  });

  // Build a flat list with a "none" option plus grouped items
  // We keep it flat for createListCollection but render groups visually
  const categoryItems = useMemo(() => {
    const items: { label: string; value: string; group: string }[] = [
      { label: "No category", value: "__none__", group: "" },
    ];
    for (const g of groups) {
      if (g.id === "__ungrouped__") continue;
      for (const cat of g.categories) {
        items.push({ label: cat.name, value: cat.id, group: g.name });
      }
    }
    // Ungrouped categories
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

  // Group the items by their group name for rendering ItemGroup sections
  const groupedItems = useMemo(() => {
    const map = new Map<string, typeof categoryItems>();
    map.set("", [{ label: "No category", value: "__none__", group: "" }]);
    for (const item of categoryItems) {
      if (item.value === "__none__") continue;
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
                <Dialog.Title>{isEditing ? "Edit transaction" : "New transaction"}</Dialog.Title>
                <Dialog.Description>
                  {isEditing
                    ? "Update the transaction details."
                    : "Add a new transaction manually."}
                </Dialog.Description>
              </Dialog.Header>

              <Dialog.Body className={css({ display: "flex", flexDir: "column", gap: "4" })}>
                <Field.Root invalid={!!errors.amount}>
                  <Field.Label>Amount *</Field.Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register("amount", { valueAsNumber: true })}
                  />
                  <Field.ErrorText>{errors.amount?.message}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={!!errors.date}>
                  <Field.Label>Date *</Field.Label>
                  <Input type="date" {...register("date")} />
                  <Field.ErrorText>{errors.date?.message}</Field.ErrorText>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Input placeholder="e.g., Grocery run, Netflix" {...register("description")} />
                </Field.Root>

                <Field.Root invalid={!!errors.category_id}>
                  <Field.Label>Category</Field.Label>
                  <Controller
                    name="category_id"
                    control={control}
                    render={({ field }) => (
                      <Select.Root
                        collection={categoryCollection}
                        value={field.value ? [field.value] : ["__none__"]}
                        onValueChange={(d: { value: string[] }) => {
                          const sel = d.value[0];
                          field.onChange(sel === "__none__" ? null : sel);
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
                            <Select.Item
                              item={{ label: "No category", value: "__none__", group: "" }}
                            >
                              <Select.ItemText>No category</Select.ItemText>
                              <Select.ItemIndicator />
                            </Select.Item>

                            {Array.from(groupedItems.entries())
                              .filter(([group]) => group !== "")
                              .map(([group, items]) => (
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

                <Field.Root>
                  <Field.Label>Notes</Field.Label>
                  <Input placeholder="Optional note" {...register("notes")} />
                </Field.Root>

                {/* Recurring */}
                <div className={css({ display: "flex", alignItems: "center", gap: "2.5" })}>
                  <Controller
                    name="is_recurring"
                    control={control}
                    render={({ field }) => (
                      <Checkbox.Root
                        id="tx-recurring"
                        checked={field.value}
                        onCheckedChange={(d) => field.onChange(d.checked === true)}
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Label
                          className={css({
                            fontSize: "sm",
                            color: "fg.default",
                            cursor: "pointer",
                          })}
                        >
                          Recurring transaction
                        </Checkbox.Label>
                        <Checkbox.HiddenInput />
                      </Checkbox.Root>
                    )}
                  />
                </div>
              </Dialog.Body>

              <Dialog.Footer>
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline" type="button" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </Dialog.CloseTrigger>
                <Button type="submit" loading={isSubmitting}>
                  {isEditing ? "Save changes" : "Add transaction"}
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
