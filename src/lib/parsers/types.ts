// =============================================================================
// Shared types for statement parsers
// =============================================================================

/** A single transaction row extracted from a bank statement */
export interface ParsedTransaction {
  date: string; // ISO date (yyyy-mm-dd)
  description: string; // raw merchant description from the statement
  amount: number; // always positive — category.type determines direction
  type: "INCOME" | "EXPENSE";
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
