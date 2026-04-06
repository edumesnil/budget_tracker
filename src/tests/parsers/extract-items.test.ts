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
});
