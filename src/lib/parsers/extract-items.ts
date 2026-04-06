import type { TextItem } from "./schema-types";

let pdfjsMod: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (!pdfjsMod) {
    pdfjsMod = await import("pdfjs-dist");
    pdfjsMod.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjsMod;
}

const Y_TOLERANCE = 3;

/**
 * Merge adjacent items in a line that are touching or nearly touching.
 * Some PDFs split words into individual character/glyph clusters due to
 * font encoding. This reconstructs whole words from fragments.
 */
const MERGE_GAP = 2; // pixels — items closer than this are merged

function mergeAdjacentItems(line: TextItem[]): TextItem[] {
  if (line.length <= 1) return line;

  const merged: TextItem[] = [{ ...line[0] }];

  for (let i = 1; i < line.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = line[i];
    const gap = curr.x - (prev.x + prev.width);

    if (gap < MERGE_GAP) {
      // Touching/overlapping — merge into previous item
      prev.text += curr.text;
      prev.width = curr.x + curr.width - prev.x;
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

/** Group flat TextItem[] into lines by Y proximity, sorted by x within each line */
export function groupItemsIntoLines(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) > Y_TOLERANCE) {
      lines.push(mergeAdjacentItems(currentLine.sort((a, b) => a.x - b.x)));
      currentLine = [item];
      currentY = item.y;
    } else {
      currentLine.push(item);
    }
  }
  lines.push(mergeAdjacentItems(currentLine.sort((a, b) => a.x - b.x)));

  return lines;
}

/** Extract raw positioned text items from a PDF, grouped into lines */
export async function extractItems(file: File): Promise<TextItem[][]> {
  const pdfjsLib = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allItems: TextItem[] = [];
  let pageOffset = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      allItems.push({
        text: item.str,
        x: item.transform[4],
        y: pageOffset + (viewport.height - item.transform[5]),
        width: item.width,
        page: i,
      });
    }

    pageOffset += viewport.height + 50;
  }

  return groupItemsIntoLines(allItems);
}
