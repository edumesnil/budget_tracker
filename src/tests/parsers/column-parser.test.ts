import { describe, it, expect } from "vitest";
import { parseWithSchema, itemInColumn } from "@/lib/parsers/column-parser";
import type { TextItem, StatementSchema } from "@/lib/parsers/schema-types";

function item(text: string, x: number, y: number, page = 1): TextItem {
  return { text, x, y, width: 30, page };
}

const CC_SCHEMA: StatementSchema = {
  id: "test-cc",
  user_id: "test-user",
  fingerprint: "test-cc-fp",
  bank_name: "Desjardins",
  statement_type: "credit-card",
  columns: {
    date: { x: [50, 80], format: "DD MM" },
    description: { x: [108, 380] },
    amount: { x: [400, 480] },
  },
  amount_format: "french",
  credit_marker: "CR",
  skip_patterns: ["TOTAL"],
  year_source: "header",
  year_pattern: "Ann[ée]e\\s+(20\\d{2})",
  confirmed: true,
  created_at: "",
};

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
    expect(result.rawLines).toHaveLength(2);

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

  it("parses credit card transactions with single amount column and credit marker", () => {
    const fullText = "Année 2026 RELEVÉ MASTERCARD";
    const lines: TextItem[][] = [
      // Expense (no CR)
      [item("05 03", 55, 100), item("NETFLIX.COM", 108, 100), item("22,99", 420, 100)],
      // Credit/refund (has CR)
      [item("10 03", 55, 115), item("REMBOURSEMENT AMAZON", 108, 115), item("45,00CR", 420, 115)],
    ];

    const result = parseWithSchema(lines, fullText, CC_SCHEMA);

    expect(result.transactions).toHaveLength(2);

    const expense = result.transactions[0];
    expect(expense.date).toBe("2026-03-05");
    expect(expense.description).toBe("NETFLIX.COM");
    expect(expense.amount).toBe(22.99);
    expect(expense.type).toBe("EXPENSE");

    const credit = result.transactions[1];
    expect(credit.date).toBe("2026-03-10");
    expect(credit.description).toBe("REMBOURSEMENT AMAZON");
    expect(credit.amount).toBe(45.0);
    expect(credit.type).toBe("INCOME");
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

  it("appends continuation lines when multiline_rule is indent", () => {
    const schema: StatementSchema = {
      ...CHEQUING_SCHEMA,
      multiline_rule: "indent",
    };
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = [
      // Transaction line with date
      [
        item("2 MAR", 55, 100),
        item("ACH", 84, 100),
        item("PAIEMENT HYDRO", 108, 100),
        item("156,43", 412, 100),
        item("2 000,00", 543, 100),
      ],
      // Continuation line — no date, just description
      [item("QUEBEC FACTURE 12345", 108, 112)],
      // Next transaction with date
      [
        item("3 MAR", 55, 130),
        item("ACH", 84, 130),
        item("METRO PLUS", 108, 130),
        item("45,00", 412, 130),
        item("1 955,00", 543, 130),
      ],
    ];

    const result = parseWithSchema(lines, fullText, schema);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe("PAIEMENT HYDRO QUEBEC FACTURE 12345");
    expect(result.transactions[1].description).toBe("METRO PLUS");
  });

  it("respects section rules — skips non-parseable sections", () => {
    const schema: StatementSchema = {
      ...CHEQUING_SCHEMA,
      sections: [
        { header_pattern: "OPÉRATIONS COURANTES", parse: true },
        { header_pattern: "LIGNE DE CRÉDIT", parse: false },
      ],
    };
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = [
      // Section header: parseable
      [item("OPÉRATIONS COURANTES", 50, 50, 120)],
      // Transaction in parseable section
      [
        item("2 MAR", 55, 100),
        item("ACH", 84, 100),
        item("METRO", 108, 100),
        item("10,00", 412, 100),
        item("990,00", 543, 100),
      ],
      // Section header: not parseable
      [item("LIGNE DE CRÉDIT", 50, 150, 100)],
      // Transaction in non-parseable section — should be skipped
      [
        item("3 MAR", 55, 170),
        item("ACH", 84, 170),
        item("INTEREST", 108, 170),
        item("5,00", 412, 170),
        item("500,00", 543, 170),
      ],
    ];

    const result = parseWithSchema(lines, fullText, schema);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("METRO");
  });

  it("uses format hint to disambiguate DD/MM vs MM/DD", () => {
    const ddmmSchema: StatementSchema = {
      ...CC_SCHEMA,
      columns: {
        ...CC_SCHEMA.columns,
        date: { x: [50, 80], format: "DD/MM" },
      },
    };
    const mmddSchema: StatementSchema = {
      ...CC_SCHEMA,
      columns: {
        ...CC_SCHEMA.columns,
        date: { x: [50, 80], format: "MM/DD" },
      },
    };
    const fullText = "Année 2026";
    // 03/04 is ambiguous — March 4 or April 3?
    const lines: TextItem[][] = [
      [item("03/04", 55, 100), item("SHOP", 108, 100), item("10,00", 420, 100)],
    ];

    const ddmm = parseWithSchema(lines, fullText, ddmmSchema);
    expect(ddmm.transactions[0].date).toBe("2026-04-03"); // day=03, month=04

    const mmdd = parseWithSchema(lines, fullText, mmddSchema);
    expect(mmdd.transactions[0].date).toBe("2026-03-04"); // month=03, day=04
  });

  it("rawLines align with transactions even when lines are skipped", () => {
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = [
      // Line 0: header — skipped (no date in date column)
      [
        item("Date", 56, 50),
        item("Code", 84, 50),
        item("Description", 196, 50),
        item("Retrait", 388, 50),
        item("Solde", 533, 50),
      ],
      // Line 1: skip pattern match
      [item("TOTAL DES RETRAITS", 108, 70), item("500,00", 412, 70)],
      // Line 2: actual transaction
      [
        item("5 MAR", 55, 100),
        item("ACH", 84, 100),
        item("METRO", 108, 100),
        item("25,00", 412, 100),
        item("975,00", 543, 100),
      ],
      // Line 3: another skip (no date)
      [item("Some footer text", 50, 130, 60)],
      // Line 4: actual transaction
      [
        item("7 MAR", 55, 150),
        item("DI", 84, 150),
        item("PAIE", 108, 150),
        item("500,00", 479, 150),
        item("1 475,00", 543, 150),
      ],
    ];

    const result = parseWithSchema(lines, fullText, CHEQUING_SCHEMA);

    expect(result.transactions).toHaveLength(2);
    expect(result.rawLines).toHaveLength(2);

    // rawLines[0] should be the text from line 2 (the METRO transaction), not line 0
    expect(result.rawLines[0]).toContain("METRO");
    expect(result.rawLines[0]).toContain("25,00");

    // rawLines[1] should be the text from line 4 (the PAIE transaction)
    expect(result.rawLines[1]).toContain("PAIE");
    expect(result.rawLines[1]).toContain("500,00");
  });

  it("extracts year from full text when no year_pattern matches", () => {
    const schema: StatementSchema = {
      ...CHEQUING_SCHEMA,
      year_pattern: undefined,
    };
    const fullText = "Statement for 2025 fiscal year";
    const lines: TextItem[][] = [
      [
        item("2 MAR", 55, 100),
        item("ACH", 84, 100),
        item("SHOP", 108, 100),
        item("10,00", 412, 100),
        item("990,00", 543, 100),
      ],
    ];

    const result = parseWithSchema(lines, fullText, schema);
    expect(result.transactions[0].date).toBe("2025-03-02");
  });

  it("falls back to current year when no year found in text", () => {
    const schema: StatementSchema = {
      ...CHEQUING_SCHEMA,
      year_pattern: undefined,
    };
    const fullText = "Some statement with no year";
    const lines: TextItem[][] = [
      [
        item("15 JUN", 55, 100),
        item("ACH", 84, 100),
        item("SHOP", 108, 100),
        item("10,00", 412, 100),
        item("990,00", 543, 100),
      ],
    ];

    const result = parseWithSchema(lines, fullText, schema);
    const currentYear = new Date().getFullYear();
    expect(result.transactions[0].date).toBe(`${currentYear}-06-15`);
  });

  it("parses condensed DDMMM dates and garbled accents (TD format)", () => {
    const schema: StatementSchema = {
      id: "test-td",
      user_id: "test-user",
      fingerprint: "test-td",
      bank_name: "TD",
      statement_type: "chequing",
      columns: {
        description: { x: [69, 200] },
        withdrawal: { x: [280, 310] },
        deposit: { x: [370, 400] },
        date: { x: [410, 440], format: "DDMMM" },
        balance: { x: [500, 530] },
      },
      amount_format: "french",
      skip_patterns: ["^SOLDE INITIAL"],
      year_source: "header",
      year_pattern: "\\d{1,2}\\s*MAR\\s*(\\d{2,4})",
      confirmed: true,
      created_at: "",
    };
    const fullText = "27F\u00AFV 26 - 31 MAR 26";
    const lines: TextItem[][] = [
      [item("SOLDE INITIAL", 69, 50), item("27F\u00AFV", 418, 50), item("12,71DC", 513, 50)],
      [
        item("Recept - VFC", 69, 100),
        item("50,00", 383, 100),
        item("13MAR", 416, 100),
        item("37,29", 513, 100),
      ],
      [
        item("INT.SUR DECOUVERT", 69, 115),
        item("0,09", 289, 115),
        item("31MAR", 416, 115),
      ],
      [
        item("FRAIS MENSUEL", 69, 130),
        item("3,95", 289, 130),
        item("31MAR", 416, 130),
        item("33,25", 513, 130),
      ],
    ];

    const result = parseWithSchema(lines, fullText, schema);

    expect(result.transactions).toHaveLength(3);
    // 13MAR with year from header (26 → 2026)
    expect(result.transactions[0].date).toBe("2026-03-13");
    expect(result.transactions[0].type).toBe("INCOME"); // deposit column
    expect(result.transactions[0].amount).toBe(50);
    // 31MAR withdrawal
    expect(result.transactions[1].date).toBe("2026-03-31");
    expect(result.transactions[1].type).toBe("EXPENSE");
  });
});
