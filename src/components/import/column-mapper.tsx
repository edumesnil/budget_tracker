import { useState, useMemo } from "react";
import { createListCollection } from "@ark-ui/react/collection";
import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";
import * as Field from "@/components/ui/field";
import * as Select from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { CsvColumnMap } from "@/lib/parsers/types";

interface ColumnMapperProps {
  headers: string[];
  onSubmit: (map: CsvColumnMap) => void;
  onCancel: () => void;
}

type FieldKey = "date" | "description" | "amount" | "debit" | "credit";

const FIELDS: Array<{ key: FieldKey; label: string; required: boolean }> = [
  { key: "date", label: "Date", required: true },
  { key: "description", label: "Description", required: true },
  { key: "amount", label: "Amount (single column)", required: false },
  { key: "debit", label: "Debit column", required: false },
  { key: "credit", label: "Credit column", required: false },
];

export function ColumnMapper({ headers, onSubmit, onCancel }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<FieldKey, number | undefined>>({
    date: undefined,
    description: undefined,
    amount: undefined,
    debit: undefined,
    credit: undefined,
  });

  const collection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: "-- Skip --", value: "__skip__" },
          ...headers.map((h, i) => ({ label: `${i + 1}: ${h}`, value: String(i) })),
        ],
      }),
    [headers],
  );

  const canSubmit =
    mapping.date !== undefined &&
    mapping.description !== undefined &&
    (mapping.amount !== undefined || mapping.debit !== undefined);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const map: CsvColumnMap = {
      date: mapping.date!,
      description: mapping.description!,
      amount: mapping.amount ?? mapping.debit!,
    };
    if (mapping.debit !== undefined && mapping.amount === undefined) {
      map.debit = mapping.debit;
    }
    if (mapping.credit !== undefined) {
      map.credit = mapping.credit;
    }
    onSubmit(map);
  };

  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Map CSV columns</Card.Title>
        <Card.Description>We couldn't auto-detect the columns. Map them manually.</Card.Description>
      </Card.Header>
      <Card.Body className={css({ display: "flex", flexDir: "column", gap: "4" })}>
        {FIELDS.map(({ key, label, required }) => (
          <Field.Root key={key}>
            <Field.Label>
              {label}
              {required && " *"}
            </Field.Label>
            <Select.Root
              collection={collection}
              value={mapping[key] !== undefined ? [String(mapping[key])] : []}
              onValueChange={(d: { value: string[] }) => {
                const val = d.value[0];
                setMapping((prev) => ({
                  ...prev,
                  [key]: val === "__skip__" ? undefined : parseInt(val, 10),
                }));
              }}
            >
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText placeholder={`Select ${label.toLowerCase()} column`} />
                  <Select.Indicator />
                </Select.Trigger>
              </Select.Control>
              <Select.Positioner>
                <Select.Content className={css({ maxH: "48", overflowY: "auto" })}>
                  {collection.items.map((item) => (
                    <Select.Item key={item.value} item={item}>
                      <Select.ItemText>{item.label}</Select.ItemText>
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Select.Root>
          </Field.Root>
        ))}

        <p className={css({ fontSize: "xs", color: "fg.muted" })}>
          Map either a single "Amount" column (negative = expense) or separate Debit/Credit columns.
        </p>
      </Card.Body>
      <Card.Footer className={css({ display: "flex", justifyContent: "flex-end", gap: "2" })}>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          Continue
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
