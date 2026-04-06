import type { TextItem, ColumnDef, StatementSchema } from "./schema-types";
import type { ParsedTransaction } from "./types";
import { parseAmount } from "./pdf";

const COLUMN_TOLERANCE = 5;

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

/** Check if a text item falls within a column's x-range (with tolerance) */
export function itemInColumn(item: TextItem, col: ColumnDef): boolean {
  return item.x >= col.x[0] - COLUMN_TOLERANCE && item.x <= col.x[1] + COLUMN_TOLERANCE;
}

function getColumnText(line: TextItem[], col: ColumnDef | undefined): string {
  if (!col) return "";
  return line
    .filter((i) => itemInColumn(i, col))
    .map((i) => i.text)
    .join(" ")
    .trim();
}

function parseDateDDMMM(text: string): { day: number; month: number } | null {
  const m = text.match(/^(\d{1,2})\s+([A-ZÀ-Ü]{3})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTH_MAP[m[2].toUpperCase()];
  if (!month || day < 1 || day > 31) return null;
  return { day, month };
}

function parseDate(
  text: string,
  format?: string,
): { day: number; month: number; year?: number } | null {
  // DD MMM always unambiguous — try first regardless of format
  const ddmmm = parseDateDDMMM(text);
  if (ddmmm) return ddmmm;

  // DD MM — take first pair even if more numbers follow
  // (handles "DD MM DD MM" from CC statements with transaction + inscription dates)
  const ddmm = text.match(/^(\d{1,2})\s+(\d{2})/);
  if (ddmm) {
    const a = parseInt(ddmm[1], 10);
    const b = parseInt(ddmm[2], 10);
    if (b >= 1 && b <= 12 && a >= 1 && a <= 31) {
      return { day: a, month: b };
    }
  }

  // Slash/dash dates — use format hint for DD/MM vs MM/DD
  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1], 10);
    const b = parseInt(slashMatch[2], 10);
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : undefined;

    let day: number, month: number;
    if (format?.startsWith("MM")) {
      // MM/DD format
      month = a;
      day = b;
    } else {
      // DD/MM format (default for Canadian context)
      day = a;
      month = b;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year: year && year < 100 ? 2000 + year : year };
    }
  }

  return null;
}

function extractYear(fullText: string, schema: StatementSchema): number {
  if (schema.year_pattern) {
    const re = new RegExp(schema.year_pattern, "i");
    const m = fullText.match(re);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  const yearMatch = fullText.match(/\b(20\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
}

interface ParseOptions {
  limit?: number;
  /** Start parsing from this line index (skip header/summary lines before it) */
  startLine?: number;
}

export function parseWithSchema(
  lines: TextItem[][],
  fullText: string,
  schema: StatementSchema,
  options: ParseOptions = {},
): { transactions: ParsedTransaction[]; warnings: string[]; rawLines: string[] } {
  const year = extractYear(fullText, schema);
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];
  const rawLines: string[] = [];

  const skipRes = schema.skip_patterns.map((p) => new RegExp(p, "i"));
  const transferCodes = new Set(schema.transfer_codes?.map((c) => c.toUpperCase()) ?? []);
  const internalRe = schema.internal_transfer_pattern
    ? new RegExp(schema.internal_transfer_pattern, "i")
    : null;
  const externalRe = schema.external_income_pattern
    ? new RegExp(schema.external_income_pattern, "i")
    : null;

  // Section tracking
  const sectionRules = schema.sections?.map((s) => ({
    re: new RegExp(s.header_pattern, "i"),
    parse: s.parse,
  }));
  const continuationRe = schema.continuation_pattern
    ? new RegExp(schema.continuation_pattern, "i")
    : null;
  let activeSection: { parse: boolean } | null = null;

  // Start from the transaction section, not the PDF header
  const startIdx = options.startLine ?? 0;

  for (let li = startIdx; li < lines.length; li++) {
    const line = lines[li];
    if (options.limit && transactions.length >= options.limit) break;

    const lineText = line.map((i) => i.text).join(" ");
    if (skipRes.some((re) => re.test(lineText))) continue;

    // Section header detection
    if (sectionRules) {
      let isSectionHeader = false;
      for (const rule of sectionRules) {
        if (rule.re.test(lineText)) {
          activeSection = { parse: rule.parse };
          isSectionHeader = true;
          break;
        }
      }
      if (isSectionHeader) continue;
      if (continuationRe?.test(lineText)) continue;
      if (activeSection && !activeSection.parse) continue;
    }

    const dateText = getColumnText(line, schema.columns.date);
    if (!dateText) {
      // Multiline continuation: append description to previous transaction
      if (schema.multiline_rule === "indent" && transactions.length > 0) {
        const contDesc = getColumnText(line, schema.columns.description);
        if (contDesc) {
          const prev = transactions[transactions.length - 1];
          transactions[transactions.length - 1] = {
            ...prev,
            description: `${prev.description} ${contDesc}`,
          };
          // Update rawLine too
          rawLines[rawLines.length - 1] += ` ${lineText}`;
        }
      }
      continue;
    }

    const parsed = parseDate(dateText, schema.columns.date.format);
    if (!parsed) continue;

    const txYear = parsed.year ?? year;
    const dateStr = `${txYear}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;

    const desc = getColumnText(line, schema.columns.description);
    if (!desc) continue;

    const code = getColumnText(line, schema.columns.code);

    let amount: number;
    let type: "INCOME" | "EXPENSE";

    if (schema.columns.withdrawal && schema.columns.deposit) {
      const depositText = getColumnText(line, schema.columns.deposit);
      const withdrawalText = getColumnText(line, schema.columns.withdrawal);

      if (depositText) {
        amount = parseAmount(depositText);
        type = "INCOME";
      } else if (withdrawalText) {
        amount = parseAmount(withdrawalText);
        type = "EXPENSE";
      } else {
        continue;
      }
    } else if (schema.columns.amount) {
      const amountText = getColumnText(line, schema.columns.amount);
      if (!amountText) continue;

      const hasCredit = schema.credit_marker ? amountText.includes(schema.credit_marker) : false;
      const cleaned = schema.credit_marker
        ? amountText.replace(schema.credit_marker, "").trim()
        : amountText;
      amount = parseAmount(cleaned);
      type = hasCredit ? "INCOME" : "EXPENSE";
    } else {
      continue;
    }

    if (isNaN(amount) || amount === 0) continue;

    let transferType: ParsedTransaction["transferType"] = null;

    if (code && transferCodes.has(code.toUpperCase())) {
      if (internalRe?.test(desc)) {
        transferType = "internal";
      } else if (externalRe?.test(desc)) {
        transferType = "external-income";
      } else {
        transferType = "internal";
      }
    }

    transactions.push({
      date: dateStr,
      description: desc,
      amount,
      type,
      transferType,
    });
    rawLines.push(line.map((i) => i.text).join(" "));
  }

  return { transactions, warnings, rawLines };
}
