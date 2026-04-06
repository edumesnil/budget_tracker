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
  _format?: string,
): { day: number; month: number; year?: number } | null {
  const ddmmm = parseDateDDMMM(text);
  if (ddmmm) return ddmmm;

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : undefined;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year: year && year < 100 ? 2000 + year : year };
    }
  }

  const ddmm = text.match(/^(\d{1,2})\s+(\d{2})$/);
  if (ddmm) {
    const day = parseInt(ddmm[1], 10);
    const month = parseInt(ddmm[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month };
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

  for (const line of lines) {
    if (options.limit && transactions.length >= options.limit) break;

    const lineText = line.map((i) => i.text).join(" ");
    if (skipRes.some((re) => re.test(lineText))) continue;

    const dateText = getColumnText(line, schema.columns.date);
    if (!dateText) continue;

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
