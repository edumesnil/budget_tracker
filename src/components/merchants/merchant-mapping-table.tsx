import { css } from "../../../styled-system/css";
import * as Table from "@/components/ui/table";
import * as Card from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MerchantMapping } from "@/types/database";

interface MerchantMappingTableProps {
  mappings: MerchantMapping[];
  onEdit: (mapping: MerchantMapping) => void;
  onDelete: (id: string) => void;
}

function CategoryCell({ mapping }: { mapping: MerchantMapping }) {
  const cat = mapping.categories;
  if (!cat) {
    return <span className={css({ fontStyle: "italic", color: "fg.subtle" })}>Unknown</span>;
  }

  const isIncome = cat.type === "INCOME";

  return (
    <div className={css({ display: "flex", alignItems: "center", gap: "2" })}>
      {cat.icon && <span>{cat.icon}</span>}
      <span>{cat.name}</span>
      <span
        className={css({
          display: "inline-flex",
          alignItems: "center",
          px: "1.5",
          py: "0.5",
          rounded: "sm",
          fontSize: "xs",
          fontWeight: "500",
          letterSpacing: "wide",
          color: isIncome ? "income" : "expense",
          bg: isIncome ? "income.muted" : "expense.muted",
        })}
      >
        {cat.type}
      </span>
    </div>
  );
}

export function MerchantMappingTable({ mappings, onEdit, onDelete }: MerchantMappingTableProps) {
  return (
    <Card.Root>
      <Table.Root interactive>
        <Table.Head>
          <Table.Row>
            <Table.Header>Pattern</Table.Header>
            <Table.Header>Category</Table.Header>
            <Table.Header className={css({ textAlign: "right" })}>Confidence</Table.Header>
            <Table.Header />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {mappings.map((mapping) => (
            <Table.Row key={mapping.id}>
              <Table.Cell className={css({ fontWeight: "500" })}>
                {mapping.merchant_pattern}
              </Table.Cell>

              <Table.Cell>
                <CategoryCell mapping={mapping} />
              </Table.Cell>

              <Table.Cell className={css({ textAlign: "right", color: "fg.muted" })}>
                {Math.round(mapping.confidence * 100)}%
              </Table.Cell>

              <Table.Cell>
                <div className={css({ display: "flex", gap: "1", justifyContent: "flex-end" })}>
                  <Button variant="plain" size="xs" onClick={() => onEdit(mapping)}>
                    Edit
                  </Button>
                  <Button variant="plain" size="xs" onClick={() => onDelete(mapping.id)}>
                    Delete
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Card.Root>
  );
}
