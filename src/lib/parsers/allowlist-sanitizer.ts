import type { TextItem } from "./schema-types";

const MONTH_ABBREVS = "JAN|FÉV|FEV|FEB|MAR|AVR|APR|MAI|MAY|JUN|JUL|AOÛ|AOU|AUG|SEP|OCT|NOV|DÉC|DEC";

const DATE_RE = new RegExp(
  `^\\d{1,2}\\s+(${MONTH_ABBREVS})$|^\\d{1,2}[/\\-]\\d{1,2}([/\\-]\\d{2,4})?$`,
  "i",
);
const AMOUNT_RE = /^[\d\s.,]+$/;
const SHORT_CODE_RE = /^[A-Z]{2,5}$/;
const PAGE_RE = /^Page\s+\d+/i;
const PAGE_FR_RE = /^\d+\s+de\s+\d+$/;

const SAFE_BANKING_TERMS = new Set([
  "date",
  "code",
  "description",
  "frais",
  "retrait",
  "dépôt",
  "solde",
  "montant",
  "détail",
  "libellé",
  "crédit",
  "débit",
  "amount",
  "balance",
  "withdrawal",
  "deposit",
  "credit",
  "debit",
  "details",
  "memo",
  "payee",
  "merchant",
  "total",
  "sous-total",
  "sommaire",
  "suite",
  "reporté",
  "subtotal",
  "summary",
  "continued",
  "carried forward",
  "relevé",
  "compte",
  "opérations",
  "courantes",
  "épargne",
  "placement",
  "mastercard",
  "visa",
]);

function hasDigitAndDecimal(s: string): boolean {
  return /\d/.test(s) && (/[,.]/.test(s) || /\d\s+\d/.test(s));
}

/** Classify a single text item as "keep" or "mask" */
export function classifyItem(text: string): "keep" | "mask" {
  const trimmed = text.trim();
  if (!trimmed) return "mask";

  if (DATE_RE.test(trimmed)) return "keep";
  if (AMOUNT_RE.test(trimmed) && hasDigitAndDecimal(trimmed)) return "keep";
  if (SHORT_CODE_RE.test(trimmed)) return "keep";

  const lower = trimmed.toLowerCase();
  if (SAFE_BANKING_TERMS.has(lower)) return "keep";
  const words = lower.split(/\s+/);
  if (words.length > 1 && words.every((w) => SAFE_BANKING_TERMS.has(w))) return "keep";

  if (PAGE_RE.test(trimmed) || PAGE_FR_RE.test(trimmed)) return "keep";

  return "mask";
}

/**
 * Check if a line looks like a transaction row: 4+ items, starts with a
 * date-like value, and has an amount-like item (with decimal).
 */
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
 * A real transaction table has back-to-back rows that match.
 * Isolated summary lines that happen to have dates+amounts are skipped.
 */
function findFirstTransactionLine(lines: TextItem[][]): number {
  for (let i = 0; i < lines.length - 1; i++) {
    if (!looksLikeTransaction(lines[i])) continue;

    // Check that at least one of the next 3 lines also matches —
    // real transaction tables have consecutive matching rows
    const hasNeighbor = lines
      .slice(i + 1, i + 4)
      .some((l) => looksLikeTransaction(l));
    if (hasNeighbor) return i;
  }
  return -1;
}

/**
 * Allowlist-sanitize extracted lines for AI schema detection.
 * Finds the first transaction line, then samples column headers + data rows.
 * Returns a formatted string with x-positions and masked PII.
 */
export function allowlistSanitize(lines: TextItem[][]): string {
  // Find first transaction line, then back up 4 lines to capture column headers
  const txIdx = findFirstTransactionLine(lines);
  const startIdx = txIdx > 0 ? Math.max(0, txIdx - 4) : 0;

  // Take column headers + ~10 transaction lines
  const sample = lines.slice(startIdx, startIdx + 14);

  const result: string[] = [];
  for (const line of sample) {
    const parts = line.map((item) => {
      const classification = classifyItem(item.text);
      const displayText = classification === "keep" ? item.text : "[TEXT]";
      return `x:${Math.round(item.x)} ${displayText}`;
    });
    result.push(parts.join(" | "));
  }

  return result.join("\n");
}
