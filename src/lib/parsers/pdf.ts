// =============================================================================
// PDF Statement Parser — schema-based pipeline
//
// Architecture:
//   1. extractItems() (extract-items.ts) — pdfjs text extraction with positions
//   2. computeFingerprint() — structural hash for schema cache lookup
//   3. Schema pipeline: cached schema → column parser, or AI detect → confirm
//   4. validateTransactions() — post-parse sanity checks
// =============================================================================

import type { ParsedTransaction, ValidatedTransaction } from "./types";
import type { TextItem } from "./schema-types";
import { extractItems } from "./extract-items";
import { computeFingerprint } from "./fingerprint";
import { allowlistSanitize } from "./allowlist-sanitizer";
import { loadSchema } from "./schema-store";
import { parseWithSchema } from "./column-parser";
import { validateTransactions } from "./validate";

// Re-export for backward compat (used by other modules)
export { extractItems } from "./extract-items";
export { groupItemsIntoLines } from "./extract-items";

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

/** Backward-compatible line extraction (used by CSV path) */
export async function extractLines(file: File): Promise<string[]> {
  const lineGroups = await extractItems(file);

  const lines: string[] = [];
  for (const group of lineGroups) {
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

/**
 * Remove duplicate transactions within a single parse result, keeping rawLines aligned.
 */
function deduplicateTransactions(
  txs: ParsedTransaction[],
  lines: string[],
): { transactions: ParsedTransaction[]; rawLines: string[] } {
  const seen = new Set<string>();
  const resultTxs: ParsedTransaction[] = [];
  const resultLines: string[] = [];

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    const normDesc = tx.description
      .toUpperCase()
      .replace(/\s{2,}/g, " ")
      .trim();
    const key = `${tx.date}|${tx.amount}|${tx.type}|${normDesc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resultTxs.push(tx);
    resultLines.push(lines[i] ?? tx.description);
  }

  return { transactions: resultTxs, rawLines: resultLines };
}

// ---------------------------------------------------------------------------
// Schema-based pipeline result
// ---------------------------------------------------------------------------

export interface SchemaParsePipelineResult {
  /** Whether a cached schema was used or new detection is needed */
  status: "cached" | "needs_detection";
  /** Set when status=cached: validated transactions ready for review */
  transactions?: ParsedTransaction[];
  /** Set when status=cached: validation result */
  validation?: {
    clean: ValidatedTransaction[];
    flagged: ValidatedTransaction[];
    unparseable: ValidatedTransaction[];
  };
  warnings: string[];
  /** Set when status=needs_detection: extracted items for schema pipeline */
  items?: TextItem[][];
  fullText?: string;
  fingerprint?: string;
  sanitizedSample?: string;
}

/**
 * Main PDF entry point. Returns either fully parsed results (cached schema)
 * or signals that schema detection is needed.
 */
export async function parsePdf(file: File): Promise<SchemaParsePipelineResult> {
  const items = await extractItems(file);
  const fullText = items.map((line) => line.map((i) => i.text).join(" ")).join("\n");
  const fingerprint = computeFingerprint(items);

  console.group("[pdf-parser] Schema pipeline");
  console.log(`${items.length} lines extracted, fingerprint: ${fingerprint}`);

  // Check for cached schema
  const cached = await loadSchema(fingerprint);

  if (cached) {
    console.log(`[pdf-parser] Cache hit: ${cached.bank_name} ${cached.statement_type}`);
    const result = parseWithSchema(items, fullText, cached);
    const deduped = deduplicateTransactions(result.transactions, result.rawLines);
    const validation = validateTransactions(deduped.transactions, deduped.rawLines);
    console.log(
      `[pdf-parser] ${deduped.transactions.length} transactions (${validation.clean.length} clean, ${validation.flagged.length} flagged, ${validation.unparseable.length} unparseable)`,
    );
    console.groupEnd();

    return {
      status: "cached",
      transactions: deduped.transactions,
      validation,
      warnings: result.warnings,
    };
  }

  // No cached schema — prepare for detection
  console.log("[pdf-parser] Cache miss, preparing for schema detection");
  const sanitizedSample = allowlistSanitize(items);
  console.log("[pdf-parser] Sanitized sample:\n", sanitizedSample);
  console.groupEnd();

  return {
    status: "needs_detection",
    items,
    fullText,
    fingerprint,
    sanitizedSample,
    warnings: [],
  };
}
