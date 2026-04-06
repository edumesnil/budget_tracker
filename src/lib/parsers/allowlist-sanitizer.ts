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
 * Allowlist-sanitize extracted lines for AI schema detection.
 * Returns a formatted string with x-positions and masked PII.
 */
export function allowlistSanitize(lines: TextItem[][]): string {
  const result: string[] = [];
  const sample = lines.slice(0, 12);

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
