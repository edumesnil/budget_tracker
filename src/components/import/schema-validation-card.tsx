import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";
import * as Table from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ParsedTransaction } from "@/lib/parsers/types";

interface SchemaValidationCardProps {
  bankName: string;
  statementType: string;
  preview: ParsedTransaction[];
  onConfirm: () => void;
  onReject: () => void;
  isConfirming: boolean;
}

export function SchemaValidationCard({
  bankName,
  statementType,
  preview,
  onConfirm,
  onReject,
  isConfirming,
}: SchemaValidationCardProps) {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>
          New format detected: {bankName} {statementType}
        </Card.Title>
        <Card.Description>
          Verify that these sample transactions look correct before proceeding.
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <Table.Root>
          <Table.Head>
            <Table.Row>
              <Table.Header>Date</Table.Header>
              <Table.Header>Description</Table.Header>
              <Table.Header className={css({ textAlign: "right" })}>Amount</Table.Header>
              <Table.Header>Type</Table.Header>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {preview.map((tx, i) => (
              <Table.Row key={i}>
                <Table.Cell className={css({ whiteSpace: "nowrap", fontSize: "sm" })}>
                  {formatDate(tx.date)}
                </Table.Cell>
                <Table.Cell className={css({ fontSize: "sm" })}>{tx.description}</Table.Cell>
                <Table.Cell
                  className={css({
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: tx.type === "INCOME" ? "income" : "expense",
                    fontSize: "sm",
                  })}
                >
                  {tx.type === "INCOME" ? "+" : "\u2212"}
                  {formatCurrency(tx.amount)}
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    size="sm"
                    variant="subtle"
                    className={css({
                      color: tx.type === "INCOME" ? "income" : "expense",
                      bg: tx.type === "INCOME" ? "income.muted" : "expense.muted",
                    })}
                  >
                    {tx.type === "INCOME" ? "Income" : "Expense"}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        <div className={css({ display: "flex", gap: "3", mt: "4" })}>
          <Button size="sm" onClick={onConfirm} loading={isConfirming}>
            These look correct
          </Button>
          <Button variant="outline" size="sm" onClick={onReject}>
            Something&apos;s wrong
          </Button>
        </div>
      </Card.Body>
    </Card.Root>
  );
}
