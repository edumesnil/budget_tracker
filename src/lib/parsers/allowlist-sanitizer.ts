import type { TextItem } from "./schema-types";

// ---------------------------------------------------------------------------
// Amount detection (reused in both classification and transaction detection)
// ---------------------------------------------------------------------------

const AMOUNT_RE = /^[\d\s.,]+$/;

function hasDigitAndDecimal(s: string): boolean {
  return /\d/.test(s) && (/[,.]/.test(s) || /\d\s+\d/.test(s));
}

// ---------------------------------------------------------------------------
// Transaction line detection
// ---------------------------------------------------------------------------

const DATE_START_RE =
  /^\d{1,2}$|^\d{1,2}\s+[A-ZÀ-Ü]{3}$|^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$|^\d{4}-\d{2}-\d{2}$/i;

function looksLikeTransaction(line: TextItem[]): boolean {
  if (line.length < 4) return false;
  if (!DATE_START_RE.test(line[0].text.trim())) return false;
  return line.some(
    (it) => AMOUNT_RE.test(it.text.trim()) && hasDigitAndDecimal(it.text.trim()),
  );
}

/**
 * Find the first transaction line by looking for consecutive matches.
 * A real transaction table has back-to-back rows — isolated summary
 * lines that happen to have dates + amounts are skipped.
 */
function findFirstTransactionLine(lines: TextItem[][]): number {
  for (let i = 0; i < lines.length - 1; i++) {
    if (!looksLikeTransaction(lines[i])) continue;

    const hasNeighbor = lines
      .slice(i + 1, i + 4)
      .some((l) => looksLikeTransaction(l));
    if (hasNeighbor) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// PII classification for transaction data rows
// ---------------------------------------------------------------------------

const MONTH_ABBREVS =
  "JAN|FÉV|FEV|FEB|MAR|AVR|APR|MAI|MAY|JUN|JUL|AOÛ|AOU|AUG|SEP|OCT|NOV|DÉC|DEC";

const DATE_RE = new RegExp(
  `^\\d{1,2}\\s+(${MONTH_ABBREVS})$|^\\d{1,2}[/\\-]\\d{1,2}([/\\-]\\d{2,4})?$`,
  "i",
);
const SHORT_CODE_RE = /^[A-Z]{2,5}$/;
const PAGE_RE = /^Page\s+\d+/i;
const PAGE_FR_RE = /^\d+\s+de\s+\d+$/;

/** Classify a single text item in a TRANSACTION ROW as "keep" or "mask" */
export function classifyItem(text: string): "keep" | "mask" {
  const trimmed = text.trim();
  if (!trimmed) return "mask";

  // Dates, amounts, short codes — always safe
  if (DATE_RE.test(trimmed)) return "keep";
  if (/^\d{1,2}$/.test(trimmed)) return "keep"; // bare day/month digits
  if (AMOUNT_RE.test(trimmed) && hasDigitAndDecimal(trimmed)) return "keep";
  if (SHORT_CODE_RE.test(trimmed)) return "keep";

  // Province codes (2 uppercase letters)
  if (/^[A-Z]{2}$/.test(trimmed)) return "keep";

  // Page indicators
  if (PAGE_RE.test(trimmed) || PAGE_FR_RE.test(trimmed)) return "keep";

  // Percentage signs and operators
  if (/^[%+=-]$/.test(trimmed)) return "keep";

  return "mask";
}

// ---------------------------------------------------------------------------
// Main sanitizer
// ---------------------------------------------------------------------------

/**
 * Format a line with x-positions, keeping ALL text (for header lines).
 */
function formatLineVerbatim(line: TextItem[]): string {
  return line.map((it) => `x:${Math.round(it.x)} ${it.text}`).join(" | ");
}

/**
 * Format a line with x-positions, masking PII (for transaction data lines).
 */
function formatLineMasked(line: TextItem[]): string {
  return line
    .map((it) => {
      const display = classifyItem(it.text) === "keep" ? it.text : "[TEXT]";
      return `x:${Math.round(it.x)} ${display}`;
    })
    .join(" | ");
}

/**
 * Allowlist-sanitize extracted lines for AI schema detection.
 *
 * Strategy:
 * 1. Find the first block of consecutive transaction-like lines
 * 2. Take 4 lines before it as column headers — sent VERBATIM
 *    (column headers are structural, not PII)
 * 3. Take ~10 transaction lines — PII-masked (merchant names → [TEXT])
 *
 * Returns -1 for txIdx if no transaction block is found (garbled PDF).
 */
export function allowlistSanitize(lines: TextItem[][]): string {
  const txIdx = findFirstTransactionLine(lines);

  if (txIdx < 0) {
    // No transaction block found — send first 12 lines verbatim as fallback.
    // The AI will get limited context but at least sees the structure.
    return lines
      .slice(0, 12)
      .map((l) => formatLineVerbatim(l))
      .join("\n");
  }

  const result: string[] = [];

  // Header lines (up to 4 before first transaction) — verbatim, no masking
  const headerStart = Math.max(0, txIdx - 4);
  for (let i = headerStart; i < txIdx; i++) {
    result.push(formatLineVerbatim(lines[i]));
  }

  // Transaction lines (10 rows) — PII-masked
  const txEnd = Math.min(lines.length, txIdx + 10);
  for (let i = txIdx; i < txEnd; i++) {
    result.push(formatLineMasked(lines[i]));
  }

  return result.join("\n");
}
