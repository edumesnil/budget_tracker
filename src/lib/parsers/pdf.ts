// =============================================================================
// PDF Statement Parser — extracts transactions from bank statement PDFs
// Uses pdfjs-dist for client-side text extraction, no server needed.
//
// Primary format: Desjardins credit card statements
// Line format: DD MM DD MM DESCRIPTION [CITY PROV] [X,XX %] AMOUNT[CR]
// =============================================================================

import * as pdfjsLib from "pdfjs-dist";
import type { ParseResult, ParsedTransaction } from "./types";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// ---------------------------------------------------------------------------
// Text extraction — reconstruct lines from positioned text items
// ---------------------------------------------------------------------------

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Extract text items from the PDF grouped into lines.
 * Uses Y-position clustering with a tolerance to handle slight vertical misalignment.
 * Within each line, inserts spacing based on X gaps to preserve column structure.
 */
async function extractLines(file: File): Promise<{ lines: string[]; rawItems: TextItem[] }> {
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
        // Invert Y so it goes top-to-bottom, add page offset for multi-page
        y: pageOffset + (viewport.height - item.transform[5]),
        width: item.width,
      });
    }

    pageOffset += viewport.height + 50; // gap between pages
  }

  // Cluster items into lines by Y position (tolerance of 3 units)
  allItems.sort((a, b) => a.y - b.y || a.x - b.x);

  const lineGroups: TextItem[][] = [];
  let currentLine: TextItem[] = [];
  let currentY = -Infinity;

  for (const item of allItems) {
    if (Math.abs(item.y - currentY) > 3) {
      if (currentLine.length > 0) lineGroups.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    } else {
      currentLine.push(item);
    }
  }
  if (currentLine.length > 0) lineGroups.push(currentLine);

  // Build line strings — use X gaps to insert appropriate spacing
  const lines: string[] = [];
  for (const group of lineGroups) {
    group.sort((a, b) => a.x - b.x);

    let line = "";
    for (let j = 0; j < group.length; j++) {
      const item = group[j];
      if (j > 0) {
        const prev = group[j - 1];
        const gap = item.x - (prev.x + prev.width);
        // Insert spaces proportional to gap size
        if (gap > 15) {
          line += "  "; // large gap = column separator
        } else if (gap > 2) {
          line += " ";
        }
        // gap <= 2: items are adjacent, no extra space
      }
      line += item.text;
    }
    lines.push(line.trim());
  }

  return { lines, rawItems: allItems };
}

// ---------------------------------------------------------------------------
// Transaction patterns — designed for flexibility
// ---------------------------------------------------------------------------

// Pattern 1: DD MM DD MM ... amount (Desjardins credit card)
// The 4 numbers are: transaction day, transaction month, inscription day, inscription month
const DESJARDINS_CC_RE = /^\s*(\d{1,2})\s+(\d{2})\s+\d{1,2}\s+\d{2}\s+(.+)$/;

// Pattern 2: YYYY-MM-DD description amount
const ISO_DATE_RE = /^\s*(20\d{2}-\d{2}-\d{2})\s+(.+)$/;

// Pattern 3: DD/MM/YYYY or DD-MM-YYYY description amount
const SLASH_DATE_RE = /^\s*(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\s+(.+)$/;

// Pattern 4: DD MMM YYYY or DD MMM description amount (month abbreviations)
const MONTH_ABBR_RE =
  /^\s*(\d{1,2})\s+(JAN|F[ÉE]V|FEB|MAR|AVR|APR|MAI|MAY|JUN|JUL|AO[ÛU]|AUG|SEP|OCT|NOV|D[ÉE]C)\s+(?:(20\d{2})\s+)?(.+)$/i;

const MONTH_MAP: Record<string, number> = {
  JAN: 1,
  FÉV: 2,
  FEV: 2,
  FEB: 2,
  MAR: 3,
  AVR: 4,
  APR: 4,
  MAI: 5,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AOÛ: 8,
  AOU: 8,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DÉC: 12,
  DEC: 12,
};

// Amount at end of line — handles:
// "31,02"  "4 380,74"  "4 380,74CR"  "31.02"  "1,234.56"
const AMOUNT_END_RE = /([\d\s.,]+\d{2})\s*(CR)?\s*$/;

// Bonidollars percentage: "1,00 %" or "3,00%"
const BONIDOLLARS_RE = /\s+\d,\d{2}\s*%\s*$/;

// Lines to skip even if they look like transactions
const SKIP_RE =
  /TOTAL|DOLLAR\s+AMERICAIN|SOLDE\s+PR[ÉE]C|PAIEMENT\s+MINIMUM|FRAIS\s+DE\s+CR[ÉE]DIT|LIMITE\s+DE\s+CR[ÉE]DIT|TAUX\s+D/i;

// ---------------------------------------------------------------------------
// Amount parsing — handles French and English number formats
// ---------------------------------------------------------------------------

function parseAmount(raw: string): number {
  let s = raw.replace(/\s/g, ""); // strip spaces (thousands separator in French)

  // Determine decimal separator
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma > lastDot) {
    // Comma is decimal: "1.234,56" or "31,02"
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Dot is decimal: "1,234.56" or "31.02"
    s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // Only commas, treat last as decimal: "31,02"
    s = s.replace(",", ".");
  }

  return Math.abs(parseFloat(s));
}

// ---------------------------------------------------------------------------
// Year extraction
// ---------------------------------------------------------------------------

function extractYear(text: string): number {
  const m = text.match(/Ann[ée]e\s+(20\d{2})/i) ?? text.match(/RELEV[ÉE].*?(20\d{2})/i);
  if (m) return parseInt(m[1], 10);
  const fallback = text.match(/\b(20\d{2})\b/);
  return fallback ? parseInt(fallback[1], 10) : new Date().getFullYear();
}

function extractStatementMonth(text: string): number | null {
  // "DATE DU RELEVÉ Jour 18 Mois 03 Année 2026" or "18 03 2026"
  const m = text.match(
    /RELEV[ÉE].*?(?:Jour\s+)?\d{1,2}\s+(?:Mois\s+)?(\d{2})\s+(?:Ann[ée]e\s+)?20\d{2}/i,
  );
  if (m) return parseInt(m[1], 10);
  // Fallback: "DATE DU RELEVÉ 18 03 2026"
  const m2 = text.match(/RELEV[ÉE]\s+\d{1,2}\s+(\d{2})\s+20\d{2}/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

// ---------------------------------------------------------------------------
// Line → transaction parsing (tries all patterns)
// ---------------------------------------------------------------------------

interface ParsedLine {
  day: number;
  month: number;
  yearOverride?: number; // if the line itself contains a year
  rest: string; // everything after the date
}

function tryParseDateFromLine(line: string): ParsedLine | null {
  // Pattern 1: DD MM DD MM rest (Desjardins CC)
  let m = line.match(DESJARDINS_CC_RE);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, rest: m[3] };
    }
  }

  // Pattern 2: YYYY-MM-DD rest
  m = line.match(ISO_DATE_RE);
  if (m) {
    const parts = m[1].split("-");
    return {
      day: parseInt(parts[2], 10),
      month: parseInt(parts[1], 10),
      yearOverride: parseInt(parts[0], 10),
      rest: m[2],
    };
  }

  // Pattern 3: DD/MM/YYYY rest
  m = line.match(SLASH_DATE_RE);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const yr = parseInt(m[3], 10);
    // If first > 12, it's the day; otherwise assume DD/MM
    const day = a > 12 ? a : a;
    const month = a > 12 ? b : b;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, yearOverride: yr, rest: m[4] };
    }
  }

  // Pattern 4: DD MMM [YYYY] rest
  m = line.match(MONTH_ABBR_RE);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthStr = m[2].toUpperCase();
    const month = MONTH_MAP[monthStr];
    if (month && day >= 1 && day <= 31) {
      return {
        day,
        month,
        yearOverride: m[3] ? parseInt(m[3], 10) : undefined,
        rest: m[4],
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export async function parsePdf(file: File): Promise<ParseResult> {
  const { lines } = await extractLines(file);
  const fullText = lines.join("\n");

  const year = extractYear(fullText);
  const stmtMonth = extractStatementMonth(fullText);

  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

  console.group("[pdf-parser] Extraction results");
  console.log(`Pages text → ${lines.length} lines`);
  console.log(`Statement year: ${year}, month: ${stmtMonth}`);
  console.log("--- All lines ---");
  for (const [i, line] of lines.entries()) {
    console.log(`${String(i).padStart(3)}: ${line}`);
  }
  console.groupEnd();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 10) continue;

    // Skip header/summary lines
    if (SKIP_RE.test(trimmed)) continue;

    // Try to parse a date from the line
    const parsed = tryParseDateFromLine(trimmed);
    if (!parsed) continue;

    const { day, month, rest, yearOverride } = parsed;

    // Extract amount from end of the remaining text
    const amountMatch = rest.match(AMOUNT_END_RE);
    if (!amountMatch) {
      console.log(`[pdf-parser] Skipped (no amount): "${trimmed}"`);
      continue;
    }

    const amount = parseAmount(amountMatch[1]);
    if (isNaN(amount) || amount === 0) {
      console.log(`[pdf-parser] Skipped (bad amount "${amountMatch[1]}"): "${trimmed}"`);
      continue;
    }

    const isCredit = amountMatch[2] === "CR";

    // Extract description: strip amount from end, then strip bonidollars %
    let desc = rest.slice(0, rest.length - amountMatch[0].length).trim();
    desc = desc.replace(BONIDOLLARS_RE, "").trim();

    if (!desc || desc.length < 2) continue;

    // Skip known non-transaction descriptions
    if (SKIP_RE.test(desc)) continue;

    // Determine year
    let txYear = yearOverride ?? year;
    if (!yearOverride && stmtMonth && month > stmtMonth) txYear--;

    const date = `${txYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    transactions.push({
      date,
      description: desc,
      amount,
      type: isCredit ? "INCOME" : "EXPENSE",
    });
  }

  console.log(`[pdf-parser] Total transactions parsed: ${transactions.length}`);
  if (transactions.length > 0) {
    console.table(
      transactions.map((t) => ({
        date: t.date,
        desc: t.description.slice(0, 40),
        amount: t.amount,
        type: t.type,
      })),
    );
  }

  if (transactions.length === 0) {
    warnings.push("No transactions found. Check the browser console for parser debug output.");
  }

  return { transactions, source: "desjardins-pdf", warnings };
}
