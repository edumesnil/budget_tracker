// =============================================================================
// Shared types for statement parsers
// =============================================================================

/** A single transaction row extracted from a bank statement */
export interface ParsedTransaction {
  date: string; // ISO date (yyyy-mm-dd)
  description: string; // raw merchant description from the statement
  amount: number; // always positive — category.type determines direction
  type: "INCOME" | "EXPENSE";
  transferType?: "internal" | "external-income" | null;
  transferParty?: string; // extracted name from transfer description
}

/** Transaction after post-parse validation pass */
export interface ValidatedTransaction extends ParsedTransaction {
  warnings: string[]; // validation warnings
  rawLine: string; // original PDF line text for debugging
  parseError?: string; // if row couldn't be fully parsed
}

/** Result from any statement parser */
export interface ParseResult {
  transactions: ParsedTransaction[];
  /** Source format for display */
  source: string;
  /** Any warnings (e.g., skipped rows, ambiguous amounts) */
  warnings: string[];
}

/** Column mapping for CSV import */
export interface CsvColumnMap {
  date: number;
  description: number;
  amount: number;
  /** If the CSV has separate debit/credit columns instead of signed amount */
  debit?: number;
  credit?: number;
}
