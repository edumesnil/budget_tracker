// =============================================================================
// CSV Statement Parser — generic CSV with column mapping
// =============================================================================

import type { CsvColumnMap, ParseResult, ParsedTransaction } from "./types";

// ---------------------------------------------------------------------------
// CSV text parsing
// ---------------------------------------------------------------------------

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === "," || ch === ";") {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Auto-detect column mapping from headers
// ---------------------------------------------------------------------------

const DATE_HEADERS = ["date", "transaction date", "posted date", "date de transaction"];
const DESC_HEADERS = [
  "description",
  "merchant",
  "payee",
  "name",
  "memo",
  "détail",
  "detail",
  "libellé",
];
const AMOUNT_HEADERS = ["amount", "montant", "total"];
const DEBIT_HEADERS = ["debit", "débit", "withdrawal", "retrait"];
const CREDIT_HEADERS = ["credit", "crédit", "deposit", "dépôt"];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\u00e0-\u00ff\s]/g, "")
    .trim();
}

export function detectColumns(headers: string[]): CsvColumnMap | null {
  const norm = headers.map(normalize);

  const date = norm.findIndex((h) => DATE_HEADERS.some((dh) => h.includes(dh)));
  const desc = norm.findIndex((h) => DESC_HEADERS.some((dh) => h.includes(dh)));
  const amount = norm.findIndex((h) => AMOUNT_HEADERS.some((ah) => h.includes(ah)));
  const debit = norm.findIndex((h) => DEBIT_HEADERS.some((dh) => h.includes(dh)));
  const credit = norm.findIndex((h) => CREDIT_HEADERS.some((ch) => h.includes(ch)));

  if (date === -1 || desc === -1) return null;
  if (amount === -1 && debit === -1) return null;

  const map: CsvColumnMap = { date, description: desc, amount: amount === -1 ? debit : amount };
  if (debit !== -1 && amount === -1) map.debit = debit;
  if (credit !== -1) map.credit = credit;

  return map;
}

// ---------------------------------------------------------------------------
// Parse amount from CSV cell
// ---------------------------------------------------------------------------

function parseCsvAmount(raw: string): number {
  let cleaned = raw.replace(/[$\s]/g, "").replace(/[()]/g, "");
  // French comma decimal
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  }
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(",", "");
  }
  return parseFloat(cleaned);
}

// ---------------------------------------------------------------------------
// Parse date from CSV cell
// ---------------------------------------------------------------------------

function parseCsvDate(raw: string): string | null {
  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD/MM/YYYY or MM/DD/YYYY — assume DD/MM for Canadian context
  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1], 10);
    const b = parseInt(slashMatch[2], 10);
    const yr = parseInt(slashMatch[3], 10);
    // If first number > 12, it must be day
    const day = a > 12 ? a : b;
    const month = a > 12 ? b : a;
    return `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // YYYY/MM/DD
  const isoSlash = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoSlash) {
    return `${isoSlash[1]}-${isoSlash[2].padStart(2, "0")}-${isoSlash[3].padStart(2, "0")}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function getHeaders(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = parseCsvText(text);
      resolve({ headers: rows[0] ?? [], rows });
    };
    reader.onerror = () => reject(new Error("Failed to read CSV file"));
    reader.readAsText(file);
  });
}

export function parseCsv(rows: string[][], columnMap: CsvColumnMap): ParseResult {
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const dateStr = row[columnMap.date];
    const desc = row[columnMap.description];

    if (!dateStr || !desc) continue;

    const date = parseCsvDate(dateStr);
    if (!date) {
      warnings.push(`Row ${i + 1}: could not parse date "${dateStr}"`);
      continue;
    }

    let amount: number;
    let type: "INCOME" | "EXPENSE";

    if (columnMap.debit !== undefined && columnMap.credit !== undefined) {
      // Separate debit/credit columns
      const debitRaw = row[columnMap.debit] ?? "";
      const creditRaw = row[columnMap.credit] ?? "";
      const debitAmt = debitRaw ? parseCsvAmount(debitRaw) : 0;
      const creditAmt = creditRaw ? parseCsvAmount(creditRaw) : 0;

      if (creditAmt > 0) {
        amount = creditAmt;
        type = "INCOME";
      } else {
        amount = Math.abs(debitAmt);
        type = "EXPENSE";
      }
    } else {
      // Single amount column — negative = expense, positive = income
      const raw = row[columnMap.amount] ?? "0";
      const parsed = parseCsvAmount(raw);
      if (isNaN(parsed)) {
        warnings.push(`Row ${i + 1}: could not parse amount "${raw}"`);
        continue;
      }
      amount = Math.abs(parsed);
      type = parsed < 0 ? "EXPENSE" : "INCOME";
    }

    if (amount === 0) continue;

    transactions.push({
      date,
      description: desc.trim(),
      amount,
      type,
    });
  }

  if (transactions.length === 0) {
    warnings.push("No transactions found. Check that the column mapping is correct.");
  }

  return {
    transactions,
    source: "csv",
    warnings,
  };
}
