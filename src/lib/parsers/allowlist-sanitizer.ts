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

/** Date as first item: "DD", "DD MMM", "DD/MM", "YYYY-MM-DD" */
const DATE_START_RE =
  /^\d{1,2}$|^\d{1,2}\s+[A-ZÀ-Ü]{3}$|^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$|^\d{4}-\d{2}-\d{2}$/i;

/** Condensed date anywhere in line: "13MAR", "27FÉV", "31DÉC" (no space) */
const DATE_CONDENSED_RE = /^\d{1,2}[A-ZÀ-Ü\u00C0-\u00FF]{3,4}$/i;

function hasDateItem(line: TextItem[]): boolean {
  // Check first item (most common: date-first formats)
  if (DATE_START_RE.test(line[0].text.trim())) return true;
  // Check any item for condensed dates (date-in-middle formats like TD)
  return line.some((it) => DATE_CONDENSED_RE.test(it.text.trim()));
}

function looksLikeTransaction(line: TextItem[]): boolean {
  if (line.length < 4) return false;
  if (!hasDateItem(line)) return false;
  return line.some(
    (it) => AMOUNT_RE.test(it.text.trim()) && hasDigitAndDecimal(it.text.trim()),
  );
}

/** Minimum consecutive transaction-like lines to confirm a real table */
const MIN_CONSECUTIVE = 5;

/**
 * Find the first transaction line by requiring MIN_CONSECUTIVE matches
 * in a window of consecutive lines. This skips isolated summary rows
 * that happen to have dates + amounts.
 *
 * Also exported so the column parser can start from the right line.
 */
export function findFirstTransactionLine(lines: TextItem[][]): number {
  for (let i = 0; i < lines.length; i++) {
    if (!looksLikeTransaction(lines[i])) continue;

    // Count how many of the next MIN_CONSECUTIVE-1 lines also match
    let count = 1;
    for (let j = i + 1; j < Math.min(i + MIN_CONSECUTIVE + 2, lines.length); j++) {
      if (looksLikeTransaction(lines[j])) count++;
    }
    if (count >= MIN_CONSECUTIVE) return i;
  }

  // Relaxed fallback: accept 2+ consecutive if strict match failed
  for (let i = 0; i < lines.length - 1; i++) {
    if (!looksLikeTransaction(lines[i])) continue;
    if (looksLikeTransaction(lines[i + 1])) return i;
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

  if (DATE_RE.test(trimmed)) return "keep";
  if (DATE_CONDENSED_RE.test(trimmed)) return "keep"; // "13MAR", "27FÉV"
  if (/^\d{1,2}$/.test(trimmed)) return "keep";
  if (AMOUNT_RE.test(trimmed) && hasDigitAndDecimal(trimmed)) return "keep";
  if (SHORT_CODE_RE.test(trimmed)) return "keep";
  if (/^[A-Z]{2}$/.test(trimmed)) return "keep";
  if (PAGE_RE.test(trimmed) || PAGE_FR_RE.test(trimmed)) return "keep";
  if (/^[%+=-]$/.test(trimmed)) return "keep";

  return "mask";
}

// ---------------------------------------------------------------------------
// Garbled accent normalization (common pdfjs font encoding issues)
// ---------------------------------------------------------------------------

/**
 * Some PDFs use custom font encodings that map accented characters to wrong
 * Unicode codepoints. This normalizes the most common French accent garbling
 * so the AI can read column headers like "Dépôts" instead of "DÁp¦ts".
 */
function normalizeGarbledText(text: string): string {
  return text
    .replace(/\u00C1/g, "\u00E9") // Á → é
    .replace(/\u00AF/g, "\u00C9") // ¯ → É
    .replace(/\u00A6/g, "\u00F4") // ¦ → ô
    .replace(/\u00BE/g, "\u00E8") // ¾ → è
    .replace(/\u00C7(?![a-z])/g, "\u00E0"); // Ç → à (only when not followed by lowercase)
}

// ---------------------------------------------------------------------------
// Main sanitizer
// ---------------------------------------------------------------------------

function formatLineVerbatim(line: TextItem[]): string {
  return line.map((it) => `x:${Math.round(it.x)} ${normalizeGarbledText(it.text)}`).join(" | ");
}

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
 * 1. Find the first block of 5+ consecutive transaction-like lines
 * 2. Take up to 10 lines before it as column headers — sent VERBATIM
 * 3. Take 20 transaction lines — PII-masked
 * 4. Fallback: send first 50 lines verbatim if no transaction block found
 */
export function allowlistSanitize(lines: TextItem[][]): string {
  const txIdx = findFirstTransactionLine(lines);

  if (txIdx < 0) {
    // No transaction block found — send up to 50 lines verbatim
    return lines
      .slice(0, 50)
      .map((l) => formatLineVerbatim(l))
      .join("\n");
  }

  const result: string[] = [];

  // Header lines (up to 10 before first transaction) — verbatim, no masking
  const headerStart = Math.max(0, txIdx - 10);
  for (let i = headerStart; i < txIdx; i++) {
    result.push(formatLineVerbatim(lines[i]));
  }

  // Transaction lines (20 rows) — PII-masked
  const txEnd = Math.min(lines.length, txIdx + 20);
  for (let i = txIdx; i < txEnd; i++) {
    result.push(formatLineMasked(lines[i]));
  }

  return result.join("\n");
}
