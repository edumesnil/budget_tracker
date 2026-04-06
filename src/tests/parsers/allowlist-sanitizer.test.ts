import { describe, it, expect } from "vitest";
import { classifyItem, allowlistSanitize } from "@/lib/parsers/allowlist-sanitizer";
import type { TextItem } from "@/lib/parsers/schema-types";

function item(text: string, x: number, y: number): TextItem {
  return { text, x, y, width: 30, page: 1 };
}

describe("classifyItem", () => {
  it("keeps date-like items", () => {
    expect(classifyItem("2 MAR")).toBe("keep");
    expect(classifyItem("15 FÉV")).toBe("keep");
    expect(classifyItem("01/03/2026")).toBe("keep");
    expect(classifyItem("12-05")).toBe("keep");
  });

  it("keeps amount-like items", () => {
    expect(classifyItem("1 234,56")).toBe("keep");
    expect(classifyItem("13.71")).toBe("keep");
    expect(classifyItem("2 073.00")).toBe("keep");
  });

  it("keeps short codes", () => {
    expect(classifyItem("ACH")).toBe("keep");
    expect(classifyItem("VFF")).toBe("keep");
    expect(classifyItem("DI")).toBe("keep");
    expect(classifyItem("RA")).toBe("keep");
  });

  it("keeps banking terms", () => {
    expect(classifyItem("Date")).toBe("keep");
    expect(classifyItem("Retrait")).toBe("keep");
    expect(classifyItem("Solde")).toBe("keep");
    expect(classifyItem("MASTERCARD")).toBe("keep");
  });

  it("masks everything else", () => {
    expect(classifyItem("METRO PLUS JOLIETTE")).toBe("mask");
    expect(classifyItem("Jean-Pierre Tremblay")).toBe("mask");
    expect(classifyItem("123 RUE PRINCIPALE")).toBe("mask");
  });

  it("keeps page indicators", () => {
    expect(classifyItem("Page 1")).toBe("keep");
    expect(classifyItem("2 de 3")).toBe("keep");
  });
});

describe("allowlistSanitize", () => {
  it("formats lines with x-positions and masks PII", () => {
    const lines: TextItem[][] = [
      [
        item("Date", 56, 100),
        item("Code", 84, 100),
        item("Description", 196, 100),
        item("Retrait", 388, 100),
        item("Solde", 533, 100),
      ],
      [
        item("2 MAR", 55, 115),
        item("ACH", 84, 115),
        item("METRO PLUS JOLIETTE", 108, 115),
        item("13.71", 412, 115),
        item("3 086.83", 543, 115),
      ],
    ];

    const result = allowlistSanitize(lines);

    expect(result).toContain("Date");
    expect(result).toContain("Code");
    expect(result).toContain("Retrait");
    expect(result).toContain("2 MAR");
    expect(result).toContain("ACH");
    expect(result).toContain("[TEXT]");
    expect(result).toContain("13.71");
    expect(result).not.toContain("METRO PLUS JOLIETTE");
  });
});
