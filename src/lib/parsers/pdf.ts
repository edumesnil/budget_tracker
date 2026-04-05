// =============================================================================
// PDF Statement Parser — generic text extraction + pluggable bank parsers
//
// Architecture:
//   1. extractLines() — pdfjs text extraction, line reconstruction (reusable)
//   2. BankParser interface — each bank implements its own line→transaction logic
//   3. parsePdf() — auto-detects bank from content, delegates to the right parser
//   4. Fallback: tries all parsers, picks the one that finds the most transactions
// =============================================================================

import * as pdfjsLib from "pdfjs-dist";
import type { ParseResult, ParsedTransaction } from "./types";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// ---------------------------------------------------------------------------
// Generic text extraction — reusable across all bank formats
// ---------------------------------------------------------------------------

/**
 * Extract text from a PDF and reconstruct lines.
 * Groups text items by Y position, inserts spacing based on X gaps.
 */
export async function extractLines(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allItems: Array<{ text: string; x: number; y: number; width: number }> = [];
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
      });
    }

    pageOffset += viewport.height + 50;
  }

  // Cluster items into lines by Y position (tolerance of 3 units)
  allItems.sort((a, b) => a.y - b.y || a.x - b.x);

  const lineGroups: (typeof allItems)[] = [];
  let currentLine: typeof allItems = [];
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

  // Build line strings with gap-aware spacing
  const lines: string[] = [];
  for (const group of lineGroups) {
    group.sort((a, b) => a.x - b.x);

    let line = "";
    for (let j = 0; j < group.length; j++) {
      const item = group[j];
      if (j > 0) {
        const prev = group[j - 1];
        const gap = item.x - (prev.x + prev.width);
        if (gap > 15) {
          line += "  ";
        } else if (gap > 2) {
          line += " ";
        }
      }
      line += item.text;
    }
    lines.push(line.trim());
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Shared utilities for bank parsers
// ---------------------------------------------------------------------------

/** Parse a French/English formatted amount string into a number */
export function parseAmount(raw: string): number {
  let s = raw.replace(/\s/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }

  return Math.abs(parseFloat(s));
}

// ---------------------------------------------------------------------------
// Bank parser interface
// ---------------------------------------------------------------------------

export interface BankParser {
  /** Human-readable name */
  name: string;
  /** Check if this parser handles the given PDF content */
  detect(fullText: string): boolean;
  /** Parse extracted lines into transactions */
  parse(
    lines: string[],
    fullText: string,
  ): { transactions: ParsedTransaction[]; warnings: string[] };
}

// ---------------------------------------------------------------------------
// Desjardins Credit Card parser
// ---------------------------------------------------------------------------

const desjardinsCC: BankParser = {
  name: "Desjardins Credit Card",

  detect(fullText) {
    return /DESJARDINS/i.test(fullText) && /MASTERCARD|VISA/i.test(fullText);
  },

  parse(lines, fullText) {
    const warnings: string[] = [];
    const transactions: ParsedTransaction[] = [];

    // Extract year from statement header
    const yearMatch =
      fullText.match(/Ann[ée]e\s+(20\d{2})/i) ?? fullText.match(/RELEV[ÉE].*?(20\d{2})/i);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    // Extract statement month for year inference on month-boundary transactions
    const stmtMonthMatch = fullText.match(
      /RELEV[ÉE].*?(?:Jour\s+)?\d{1,2}\s+(?:Mois\s+)?(\d{2})\s+(?:Ann[ée]e\s+)?20\d{2}/i,
    );
    const stmtMonth = stmtMonthMatch ? parseInt(stmtMonthMatch[1], 10) : null;

    // Transaction line: DD MM DD MM DESCRIPTION [CITY PROV] [X,XX %] AMOUNT[CR]
    const TX_RE = /^\s*(\d{1,2})\s+(\d{2})\s+\d{1,2}\s+\d{2}\s+(.+)$/;
    const AMOUNT_RE = /([\d\s.,]+\d{2})\s*(CR)?\s*$/;
    const BONIDOLLARS_RE = /\s+\d,\d{2}\s*%\s*$/;
    const SKIP_RE =
      /TOTAL|DOLLAR\s+AMERICAIN|SOLDE\s+PR[ÉE]C|PAIEMENT\s+MINIMUM|FRAIS\s+DE\s+CR[ÉE]DIT|LIMITE\s+DE\s+CR[ÉE]DIT|TAUX\s+D/i;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 10) continue;
      if (SKIP_RE.test(trimmed)) continue;

      const m = trimmed.match(TX_RE);
      if (!m) continue;

      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;

      const rest = m[3];
      const amountMatch = rest.match(AMOUNT_RE);
      if (!amountMatch) continue;

      const amount = parseAmount(amountMatch[1]);
      if (isNaN(amount) || amount === 0) continue;

      const isCredit = amountMatch[2] === "CR";

      let desc = rest.slice(0, rest.length - amountMatch[0].length).trim();
      desc = desc.replace(BONIDOLLARS_RE, "").trim();
      if (!desc || desc.length < 2) continue;
      if (SKIP_RE.test(desc)) continue;

      let txYear = year;
      if (stmtMonth && month > stmtMonth) txYear--;

      transactions.push({
        date: `${txYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        description: desc,
        amount,
        type: isCredit ? "INCOME" : "EXPENSE",
      });
    }

    return { transactions, warnings };
  },
};

// ---------------------------------------------------------------------------
// Desjardins Chequing/Savings (Relevé de compte — no Mastercard/Visa)
// ---------------------------------------------------------------------------

const desjardinsChequing: BankParser = {
  name: "Desjardins Chequing",

  detect(fullText) {
    return (
      /DESJARDINS/i.test(fullText) &&
      !/MASTERCARD|VISA/i.test(fullText) &&
      /RELEV[ÉE]\s+DE\s+COMPTE/i.test(fullText)
    );
  },

  parse(lines, fullText) {
    // Desjardins chequing uses a similar DD MM DD MM format
    // Reuse the credit card parser logic — same line structure
    return desjardinsCC.parse(lines, fullText);
  },
};

// ---------------------------------------------------------------------------
// Generic / fallback parser — tries common date formats
// ---------------------------------------------------------------------------

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

const genericParser: BankParser = {
  name: "Generic",

  detect() {
    return true; // always matches as fallback
  },

  parse(lines, fullText) {
    const warnings: string[] = [];
    const transactions: ParsedTransaction[] = [];

    const yearMatch = fullText.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    const AMOUNT_RE = /([\d\s.,]+\d{2})\s*(CR)?\s*$/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 10) continue;
      if (/^TOTAL\b/i.test(trimmed)) continue;

      let day: number | null = null;
      let month: number | null = null;
      let txYear = year;
      let rest = "";

      // Try YYYY-MM-DD
      let m = trimmed.match(/^\s*(20\d{2})-(\d{2})-(\d{2})\s+(.+)$/);
      if (m) {
        txYear = parseInt(m[1], 10);
        month = parseInt(m[2], 10);
        day = parseInt(m[3], 10);
        rest = m[4];
      }

      // Try DD/MM/YYYY or DD-MM-YYYY
      if (!day) {
        m = trimmed.match(/^\s*(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\s+(.+)$/);
        if (m) {
          const a = parseInt(m[1], 10);
          const b = parseInt(m[2], 10);
          day = a > 12 ? a : a; // assume DD/MM for ambiguous
          month = a > 12 ? b : b;
          txYear = parseInt(m[3], 10);
          rest = m[4];
        }
      }

      // Try DD MMM [YYYY]
      if (!day) {
        m = trimmed.match(
          /^\s*(\d{1,2})\s+(JAN|F[ÉE]V|FEB|MAR|AVR|APR|MAI|MAY|JUN|JUL|AO[ÛU]|AUG|SEP|OCT|NOV|D[ÉE]C)\s+(?:(20\d{2})\s+)?(.+)$/i,
        );
        if (m) {
          day = parseInt(m[1], 10);
          month = MONTH_MAP[m[2].toUpperCase()] ?? null;
          if (m[3]) txYear = parseInt(m[3], 10);
          rest = m[4];
        }
      }

      // Try DD MM DD MM (4-number pattern without bank-specific context)
      if (!day) {
        m = trimmed.match(/^\s*(\d{1,2})\s+(\d{2})\s+\d{1,2}\s+\d{2}\s+(.+)$/);
        if (m) {
          day = parseInt(m[1], 10);
          month = parseInt(m[2], 10);
          rest = m[3];
        }
      }

      if (!day || !month || month < 1 || month > 12 || day < 1 || day > 31) continue;
      if (!rest) continue;

      const amountMatch = rest.match(AMOUNT_RE);
      if (!amountMatch) continue;

      const amount = parseAmount(amountMatch[1]);
      if (isNaN(amount) || amount === 0) continue;

      const isCredit = amountMatch[2] === "CR";
      const desc = rest.slice(0, rest.length - amountMatch[0].length).trim();
      if (!desc || desc.length < 2) continue;

      transactions.push({
        date: `${txYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        description: desc,
        amount,
        type: isCredit ? "INCOME" : "EXPENSE",
      });
    }

    return { transactions, warnings };
  },
};

// ---------------------------------------------------------------------------
// Parser registry — order matters (specific before generic)
// ---------------------------------------------------------------------------

const PARSERS: BankParser[] = [desjardinsCC, desjardinsChequing, genericParser];

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function parsePdf(file: File): Promise<ParseResult> {
  const lines = await extractLines(file);
  const fullText = lines.join("\n");

  console.group("[pdf-parser] Text extraction");
  console.log(`${lines.length} lines extracted`);
  for (const [i, line] of lines.entries()) {
    console.log(`${String(i).padStart(3)}: ${line}`);
  }
  console.groupEnd();

  // Try auto-detection first
  for (const parser of PARSERS) {
    if (parser === genericParser) continue; // skip generic in detection pass
    if (parser.detect(fullText)) {
      console.log(`[pdf-parser] Detected: ${parser.name}`);
      const result = parser.parse(lines, fullText);
      if (result.transactions.length > 0) {
        console.log(`[pdf-parser] ${parser.name}: ${result.transactions.length} transactions`);
        return { ...result, source: "desjardins-pdf" };
      }
      console.log(`[pdf-parser] ${parser.name} detected but found 0 transactions, trying others`);
    }
  }

  // Fallback: try all parsers, pick the best result
  console.log("[pdf-parser] No bank detected, trying all parsers");
  let best: { transactions: ParsedTransaction[]; warnings: string[] } = {
    transactions: [],
    warnings: [],
  };
  let bestParser = "none";

  for (const parser of PARSERS) {
    const result = parser.parse(lines, fullText);
    if (result.transactions.length > best.transactions.length) {
      best = result;
      bestParser = parser.name;
    }
  }

  console.log(`[pdf-parser] Best: ${bestParser} with ${best.transactions.length} transactions`);

  if (best.transactions.length === 0) {
    best.warnings.push("No transactions found. Check the browser console for parser debug output.");
  }

  return { ...best, source: "desjardins-pdf" };
}
