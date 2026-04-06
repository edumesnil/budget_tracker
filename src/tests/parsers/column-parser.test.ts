import { describe, it, expect } from "vitest";
import { parseWithSchema, itemInColumn } from "@/lib/parsers/column-parser";
import type { TextItem, StatementSchema } from "@/lib/parsers/schema-types";

function item(text: string, x: number, y: number, page = 1): TextItem {
  return { text, x, y, width: 30, page };
}

const CHEQUING_SCHEMA: StatementSchema = {
  id: "test-id",
  user_id: "test-user",
  fingerprint: "test-fp",
  bank_name: "Desjardins",
  statement_type: "chequing",
  columns: {
    date: { x: [50, 80], format: "DD MMM" },
    code: { x: [84, 100] },
    description: { x: [108, 380] },
    withdrawal: { x: [388, 450] },
    deposit: { x: [461, 520] },
    balance: { x: [533, 600] },
  },
  amount_format: "french",
  skip_patterns: ["TOTAL", "SOLDE PR"],
  year_source: "header",
  year_pattern: "RELEV.*?(20\\d{2})",
  transfer_codes: ["VFF", "VMW"],
  internal_transfer_pattern: "Virement entre folios",
  external_income_pattern: "Virement.*de",
  confirmed: true,
  created_at: "",
};

describe("itemInColumn", () => {
  it("matches item within column range with tolerance", () => {
    expect(itemInColumn(item("test", 52, 0), { x: [50, 80] })).toBe(true);
    expect(itemInColumn(item("test", 46, 0), { x: [50, 80] })).toBe(true);
    expect(itemInColumn(item("test", 40, 0), { x: [50, 80] })).toBe(false);
  });
});

describe("parseWithSchema", () => {
  it("parses chequing transactions with withdrawal/deposit columns", () => {
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = [
      [
        item("Date", 56, 50),
        item("Code", 84, 50),
        item("Description", 196, 50),
        item("Retrait", 388, 50),
        item("Dépôt", 461, 50),
        item("Solde", 533, 50),
      ],
      [
        item("2 MAR", 55, 100),
        item("ACH", 84, 100),
        item("METRO PLUS JOLIETTE", 108, 100),
        item("13,71", 412, 100),
        item("3 086,83", 543, 100),
      ],
      [
        item("4 MAR", 55, 115),
        item("DI", 84, 115),
        item("PAIE EMPLOYEUR", 108, 115),
        item("969,60", 479, 115),
        item("2 558,42", 543, 115),
      ],
      [item("TOTAL", 108, 200), item("5 000,00", 412, 200)],
    ];

    const result = parseWithSchema(lines, fullText, CHEQUING_SCHEMA);

    expect(result.transactions).toHaveLength(2);

    const expense = result.transactions[0];
    expect(expense.date).toBe("2026-03-02");
    expect(expense.description).toBe("METRO PLUS JOLIETTE");
    expect(expense.amount).toBe(13.71);
    expect(expense.type).toBe("EXPENSE");

    const income = result.transactions[1];
    expect(income.date).toBe("2026-03-04");
    expect(income.amount).toBe(969.6);
    expect(income.type).toBe("INCOME");
  });

  it("detects internal transfers via transfer codes", () => {
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = [
      [
        item("6 MAR", 55, 100),
        item("VFF", 84, 100),
        item("Virement entre folios", 108, 100),
        item("500,00", 412, 100),
        item("1 500,00", 543, 100),
      ],
    ];

    const result = parseWithSchema(lines, fullText, CHEQUING_SCHEMA);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].transferType).toBe("internal");
  });

  it("skips lines matching skip_patterns", () => {
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = [
      [item("SOLDE PRÉCÉDENT", 108, 50), item("2 000,00", 543, 50)],
      [
        item("2 MAR", 55, 100),
        item("ACH", 84, 100),
        item("SHOP", 108, 100),
        item("10,00", 412, 100),
        item("1 990,00", 543, 100),
      ],
    ];

    const result = parseWithSchema(lines, fullText, CHEQUING_SCHEMA);
    expect(result.transactions).toHaveLength(1);
  });

  it("respects limit option for preview parsing", () => {
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = Array.from({ length: 10 }, (_, i) => [
      item(`${i + 1} MAR`, 55, 100 + i * 15),
      item("ACH", 84, 100 + i * 15),
      item("SHOP", 108, 100 + i * 15),
      item("10,00", 412, 100 + i * 15),
      item("900,00", 543, 100 + i * 15),
    ]);

    const result = parseWithSchema(lines, fullText, CHEQUING_SCHEMA, { limit: 3 });
    expect(result.transactions).toHaveLength(3);
  });
});
