/** Raw response shape from the AI */
export interface RawSchemaResponse {
  bank_name: string;
  statement_type: string;
  columns: {
    date: { x: [number, number]; format?: string };
    code?: { x: [number, number] };
    description: { x: [number, number] };
    withdrawal?: { x: [number, number] };
    deposit?: { x: [number, number] };
    amount?: { x: [number, number] };
    balance?: { x: [number, number] };
  };
  amount_format: "french" | "english";
  credit_marker?: string;
  sections?: Array<{ header_pattern: string; parse: boolean }>;
  continuation_pattern?: string;
  skip_patterns: string[];
  multiline_rule?: "indent";
  transfer_codes?: string[];
  internal_transfer_pattern?: string;
  external_income_pattern?: string;
  year_source: "header" | "inline";
  year_pattern?: string;
}

export function buildSchemaPrompt(sanitizedSample: string): {
  system: string;
  user: string;
} {
  const system = `You are analyzing the column structure of a bank statement PDF.

The input has two sections:
1. HEADER LINES — column headers shown verbatim (no masking). These tell you the column names and their x-positions.
2. DATA LINES — transaction rows with PII masked as [TEXT]. Dates, amounts, and short codes are visible.

CRITICAL RULES:
- Match column names from the header lines to data positions. If a header says "Retrait" at x:388, the withdrawal column starts near x:388. If "Dépôt" is at x:461, deposits start near x:461.
- The LAST numeric column on each data line is usually the running balance — map it as "balance" so the parser SKIPs it.
- Small repeated identical values (like 1.00, 2.00, 3.00) in a column are percentages or fees, NOT transaction amounts. The actual amount column has varying values (12.82, 31.02, 300.00).
- For date columns: if dates are split into separate day/month items (x:91 "19" x:115 "02"), the date column range should cover both items.
- Use "withdrawal" + "deposit" when there are separate debit/credit columns. Use "amount" only when there is a single column for both.
- "amount_format": use "french" when decimals use comma (13,71) and thousands use space/period. Use "english" when decimals use period (13.71).

Return ONLY valid JSON:
{
  "bank_name": string,
  "statement_type": string,
  "columns": {
    "date": { "x": [min, max], "format": "DD MMM" | "DD MM" | "DD/MM/YYYY" | "YYYY-MM-DD" },
    "code?": { "x": [min, max] },
    "description": { "x": [min, max] },
    "withdrawal?": { "x": [min, max] },
    "deposit?": { "x": [min, max] },
    "amount?": { "x": [min, max] },
    "balance?": { "x": [min, max] }
  },
  "amount_format": "french" | "english",
  "credit_marker?": string,
  "skip_patterns": string[],
  "year_source": "header" | "inline",
  "year_pattern?": string,
  "transfer_codes?": string[],
  "internal_transfer_pattern?": string,
  "external_income_pattern?": string
}`;

  const user = `Here are the extracted lines:\n${sanitizedSample}`;

  return { system, user };
}

/**
 * Parse the AI response into a typed schema.
 * Handles raw JSON, markdown-fenced JSON, and common AI response quirks.
 */
export function parseSchemaResponse(raw: string): RawSchemaResponse | null {
  let cleaned = raw.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (!parsed.columns?.date || !parsed.columns?.description) return null;
    if (!parsed.amount_format) return null;
    // Must have at least one amount column
    if (
      !parsed.columns?.amount &&
      !(parsed.columns?.withdrawal && parsed.columns?.deposit)
    )
      return null;

    const cols = parsed.columns;
    for (const key of Object.keys(cols)) {
      const col = cols[key];
      if (col && Array.isArray(col.x) && col.x.length === 2) continue;
      if (col && !col.x) {
        delete cols[key];
      }
    }

    return {
      bank_name: parsed.bank_name ?? "Unknown",
      statement_type: parsed.statement_type ?? "unknown",
      columns: cols,
      amount_format: parsed.amount_format,
      credit_marker: parsed.credit_marker ?? undefined,
      sections: parsed.sections ?? undefined,
      continuation_pattern: parsed.continuation_pattern ?? undefined,
      skip_patterns: Array.isArray(parsed.skip_patterns) ? parsed.skip_patterns : [],
      multiline_rule: parsed.multiline_rule ?? undefined,
      transfer_codes: parsed.transfer_codes ?? undefined,
      internal_transfer_pattern: parsed.internal_transfer_pattern ?? undefined,
      external_income_pattern: parsed.external_income_pattern ?? undefined,
      year_source: parsed.year_source ?? "header",
      year_pattern: parsed.year_pattern ?? undefined,
    };
  } catch {
    return null;
  }
}
