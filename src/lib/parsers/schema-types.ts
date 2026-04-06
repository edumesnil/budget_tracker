// =============================================================================
// Schema Parser Types — in-memory types for the schema detection pipeline
// =============================================================================

/** A single positioned text item extracted from PDF */
export interface TextItem {
  text: string;
  x: number; // horizontal position
  y: number; // vertical position (page-adjusted)
  width: number; // item width for gap detection
  page: number; // source page (1-indexed)
}

/** Column x-position range */
export interface ColumnDef {
  x: [number, number]; // [min, max] x-position
  format?: string; // for date columns: "DD MMM", "DD/MM/YYYY", etc.
}

/** Section parsing rule */
export interface SectionRule {
  header_pattern: string; // regex string matching section headers
  parse: boolean; // true = extract transactions from this section
}

/** Full schema — produced by AI, confirmed by user, cached in Supabase */
export interface StatementSchema {
  id: string;
  user_id: string;
  fingerprint: string;
  bank_name: string;
  statement_type: string;

  columns: {
    date: ColumnDef;
    code?: ColumnDef;
    description: ColumnDef;
    withdrawal?: ColumnDef;
    deposit?: ColumnDef;
    amount?: ColumnDef;
    balance?: ColumnDef;
  };

  amount_format: "french" | "english";
  credit_marker?: string;

  sections?: SectionRule[];
  continuation_pattern?: string;
  skip_patterns: string[];

  multiline_rule?: "indent";

  transfer_codes?: string[];
  internal_transfer_pattern?: string;
  external_income_pattern?: string;

  year_source: "header" | "inline";
  year_pattern?: string;

  confirmed: boolean;
  created_at: string;
}
