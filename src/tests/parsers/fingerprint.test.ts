import { describe, it, expect } from "vitest";
import {
  detectColumnHeaderLine,
  detectBankIdentifier,
  computeFingerprint,
} from "@/lib/parsers/fingerprint";
import type { TextItem } from "@/lib/parsers/schema-types";

function item(text: string, x: number, y: number, width = 30): TextItem {
  return { text, x, y, width, page: 1 };
}

describe("detectColumnHeaderLine", () => {
  it("finds line with 4+ short items spanning wide x-range", () => {
    const lines: TextItem[][] = [
      [item("DESJARDINS", 50, 10, 80)],
      [item("Page 1 de 3", 400, 20, 60)],
      [
        item("Date", 50, 50),
        item("Code", 84, 50),
        item("Description", 150, 50, 60),
        item("Retrait", 388, 50),
        item("Dépôt", 461, 50),
        item("Solde", 533, 50),
      ],
      [item("2 MAR", 50, 70), item("ACH", 84, 70), item("METRO", 150, 70)],
    ];

    const header = detectColumnHeaderLine(lines);
    expect(header).not.toBeNull();
    expect(header!.map((i) => i.text)).toContain("Date");
    expect(header!.map((i) => i.text)).toContain("Solde");
  });
});

describe("detectBankIdentifier", () => {
  it("detects DESJARDINS from first 20 lines", () => {
    const lines: TextItem[][] = [
      [item("Caisse Desjardins", 50, 10, 100)],
      [item("Some other text", 50, 20, 80)],
    ];
    expect(detectBankIdentifier(lines)).toBe("DESJARDINS");
  });

  it("returns UNKNOWN for unrecognized banks", () => {
    const lines: TextItem[][] = [[item("My local credit union", 50, 10, 100)]];
    expect(detectBankIdentifier(lines)).toBe("UNKNOWN");
  });
});

describe("computeFingerprint", () => {
  it("produces consistent hash for same structure", () => {
    const lines: TextItem[][] = [
      [item("DESJARDINS", 50, 10, 80)],
      [
        item("Date", 50, 50),
        item("Code", 84, 50),
        item("Description", 150, 50, 60),
        item("Retrait", 388, 50),
        item("Dépôt", 461, 50),
        item("Solde", 533, 50),
      ],
    ];

    const fp1 = computeFingerprint(lines);
    const fp2 = computeFingerprint(lines);
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(0);
  });

  it("produces different hash when column headers differ", () => {
    const lines1: TextItem[][] = [
      [item("DESJARDINS", 50, 10, 80)],
      [
        item("Date", 50, 50),
        item("Description", 150, 50, 60),
        item("Retrait", 388, 50),
        item("Solde", 533, 50),
      ],
    ];

    const lines2: TextItem[][] = [
      [item("DESJARDINS", 50, 10, 80)],
      [
        item("Date", 50, 50),
        item("Description", 150, 50, 60),
        item("Montant", 388, 50),
        item("Solde", 533, 50),
      ],
    ];

    expect(computeFingerprint(lines1)).not.toBe(computeFingerprint(lines2));
  });
});
