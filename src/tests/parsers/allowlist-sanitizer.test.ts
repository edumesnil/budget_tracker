import { describe, it, expect } from "vitest";
import { classifyItem, allowlistSanitize } from "@/lib/parsers/allowlist-sanitizer";
import type { TextItem } from "@/lib/parsers/schema-types";

function item(text: string, x: number, y: number): TextItem {
  return { text, x, y, width: 30, page: 1 };
}

describe("classifyItem (transaction row masking)", () => {
  it("keeps date-like items", () => {
    expect(classifyItem("2 MAR")).toBe("keep");
    expect(classifyItem("15 FÉV")).toBe("keep");
    expect(classifyItem("01/03/2026")).toBe("keep");
    expect(classifyItem("12-05")).toBe("keep");
  });

  it("keeps bare day/month digits", () => {
    expect(classifyItem("19")).toBe("keep");
    expect(classifyItem("02")).toBe("keep");
    expect(classifyItem("3")).toBe("keep");
  });

  it("keeps amount-like items", () => {
    expect(classifyItem("1 234,56")).toBe("keep");
    expect(classifyItem("13.71")).toBe("keep");
    expect(classifyItem("2 073.00")).toBe("keep");
  });

  it("keeps short codes and province codes", () => {
    expect(classifyItem("ACH")).toBe("keep");
    expect(classifyItem("VFF")).toBe("keep");
    expect(classifyItem("QC")).toBe("keep");
    expect(classifyItem("BC")).toBe("keep");
    expect(classifyItem("ON")).toBe("keep");
  });

  it("keeps percentage and operator signs", () => {
    expect(classifyItem("%")).toBe("keep");
    expect(classifyItem("+")).toBe("keep");
    expect(classifyItem("=")).toBe("keep");
  });

  it("masks merchant names and PII", () => {
    expect(classifyItem("METRO PLUS JOLIETTE")).toBe("mask");
    expect(classifyItem("Jean-Pierre Tremblay")).toBe("mask");
    expect(classifyItem("NETFLIX.COM")).toBe("mask");
    expect(classifyItem("VANCOUVER")).toBe("mask");
  });

  it("keeps page indicators", () => {
    expect(classifyItem("Page 1")).toBe("keep");
  });
});

describe("allowlistSanitize", () => {
  it("sends header lines verbatim and masks transaction PII", () => {
    const lines: TextItem[][] = [
      // Non-transaction lines (< 4 items, no date start)
      item("SOME BANK NAME", 50, 10),
      // Column headers (before first transaction)
      [
        item("Date", 56, 90),
        item("Code", 84, 90),
        item("Description", 196, 90),
        item("Retrait", 388, 90),
        item("Solde", 533, 90),
      ],
      // Transaction line 1 (first consecutive match)
      [
        item("2 MAR", 55, 100),
        item("ACH", 84, 100),
        item("METRO PLUS JOLIETTE", 108, 100),
        item("13.71", 412, 100),
        item("3 086.83", 543, 100),
      ],
      // Transaction line 2 (consecutive match confirms)
      [
        item("4 MAR", 55, 115),
        item("DI", 84, 115),
        item("PAIE EMPLOYEUR", 108, 115),
        item("969.60", 479, 115),
        item("2 558.42", 543, 115),
      ],
    ].map((l) => (Array.isArray(l) ? l : [l]));

    const result = allowlistSanitize(lines);

    // Banking column labels pass through allowlist (needed for AI schema detection)
    expect(result).toContain("Date");
    expect(result).toContain("Description");
    expect(result).toContain("Retrait");

    // Transaction data: dates/amounts kept, merchants masked
    expect(result).toContain("2 MAR");
    expect(result).toContain("ACH");
    expect(result).toContain("13.71");
    expect(result).toContain("[TEXT]");
    expect(result).not.toContain("METRO PLUS JOLIETTE");
  });

  it("falls back to PII-masked lines when no transactions found", () => {
    const lines: TextItem[][] = [
      [item("ERIC DUMESNIL", 50, 10), item("13.71", 200, 10)],
      [item("123 RUE MAIN", 50, 20)],
    ];

    const result = allowlistSanitize(lines);
    // PII masked even in fallback — names/addresses become [TEXT]
    expect(result).not.toContain("ERIC DUMESNIL");
    expect(result).not.toContain("123 RUE MAIN");
    expect(result).toContain("[TEXT]");
    // Amounts still visible
    expect(result).toContain("13.71");
  });
});
