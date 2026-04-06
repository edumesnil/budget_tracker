import { describe, it, expect } from "vitest";
import { validateTransactions } from "@/lib/parsers/validate";
import type { ParsedTransaction } from "@/lib/parsers/types";

function tx(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    date: "2026-03-02",
    description: "METRO PLUS",
    amount: 45.5,
    type: "EXPENSE",
    ...overrides,
  };
}

describe("validateTransactions", () => {
  it("passes clean transactions with no warnings", () => {
    const result = validateTransactions([tx(), tx({ amount: 30 })]);
    expect(result.clean).toHaveLength(2);
    expect(result.flagged).toHaveLength(0);
    expect(result.unparseable).toHaveLength(0);
  });

  it("flags amount > $10,000", () => {
    const result = validateTransactions([tx({ amount: 15000 })]);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].warnings[0]).toContain("unusually high");
  });

  it("flags statistical outliers (> 10x median)", () => {
    const txs = [
      tx({ amount: 20 }),
      tx({ amount: 25 }),
      tx({ amount: 30 }),
      tx({ amount: 22 }),
      tx({ amount: 5000 }),
    ];
    const result = validateTransactions(txs);
    expect(result.flagged.some((f) => f.warnings.some((w) => w.includes("outlier")))).toBe(true);
  });

  it("flags suspiciously round large amounts (likely balance)", () => {
    const result = validateTransactions([tx({ amount: 75000 })]);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].warnings.some((w) => w.includes("balance"))).toBe(true);
  });

  it("marks zero amount as unparseable", () => {
    const result = validateTransactions([tx({ amount: 0 })]);
    expect(result.unparseable).toHaveLength(1);
    expect(result.unparseable[0].parseError).toContain("amount");
  });

  it("marks empty description as unparseable", () => {
    const result = validateTransactions([tx({ description: "AB" })]);
    expect(result.unparseable).toHaveLength(1);
    expect(result.unparseable[0].parseError).toContain("description");
  });
});
