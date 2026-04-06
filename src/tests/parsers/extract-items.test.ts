import { describe, it, expect } from "vitest";
import { groupItemsIntoLines } from "@/lib/parsers/extract-items";
import type { TextItem } from "@/lib/parsers/schema-types";

describe("groupItemsIntoLines", () => {
  it("groups items by Y proximity (tolerance of 3)", () => {
    const items: TextItem[] = [
      { text: "Date", x: 50, y: 100, width: 30, page: 1 },
      { text: "Code", x: 90, y: 100.5, width: 30, page: 1 },
      { text: "Description", x: 150, y: 100, width: 60, page: 1 },
      { text: "2 MAR", x: 50, y: 115, width: 35, page: 1 },
      { text: "ACH", x: 90, y: 115.2, width: 25, page: 1 },
      { text: "METRO PLUS", x: 150, y: 115, width: 80, page: 1 },
    ];

    const lines = groupItemsIntoLines(items);

    expect(lines).toHaveLength(2);
    expect(lines[0].map((i) => i.text)).toEqual(["Date", "Code", "Description"]);
    expect(lines[1].map((i) => i.text)).toEqual(["2 MAR", "ACH", "METRO PLUS"]);
  });

  it("sorts items within a line by x-position", () => {
    const items: TextItem[] = [
      { text: "B", x: 200, y: 100, width: 10, page: 1 },
      { text: "A", x: 50, y: 100, width: 10, page: 1 },
      { text: "C", x: 300, y: 100, width: 10, page: 1 },
    ];

    const lines = groupItemsIntoLines(items);

    expect(lines).toHaveLength(1);
    expect(lines[0].map((i) => i.text)).toEqual(["A", "B", "C"]);
  });

  it("puts items far apart in Y into separate lines", () => {
    const items: TextItem[] = [
      { text: "Line1", x: 50, y: 100, width: 30, page: 1 },
      { text: "Line2", x: 50, y: 200, width: 30, page: 1 },
    ];

    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(groupItemsIntoLines([])).toEqual([]);
  });

  it("merges adjacent touching items into whole words", () => {
    // Simulates fragmented text from PDFs with custom font encoding
    const items: TextItem[] = [
      { text: "ASSO", x: 228, y: 100, width: 23, page: 1 },
      { text: "CI", x: 251, y: 100, width: 6, page: 1 },
      { text: "AT", x: 257, y: 100, width: 11, page: 1 },
      { text: "IO", x: 268, y: 100, width: 8, page: 1 },
      { text: "N", x: 276, y: 100, width: 5, page: 1 },
      // Separate column — big gap
      { text: "500.00", x: 450, y: 100, width: 40, page: 1 },
    ];

    const lines = groupItemsIntoLines(items);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(2); // "ASSOCIATION" + "500.00"
    expect(lines[0][0].text).toBe("ASSOCIATION");
    expect(lines[0][1].text).toBe("500.00");
  });
});
