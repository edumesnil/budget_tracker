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
Text has been extracted with x-positions. Each item shows x:<position> <text>.
Items marked [TEXT] are masked content — ignore their values, but note their x-positions.

Analyze the layout and return a JSON schema with:
- columns: what columns exist and their x-position ranges [min, max]
- date format used in the date column (e.g., "DD MMM", "DD/MM/YYYY")
- amount_format: "french" (space thousands, comma decimal: "1 234,56") or "english" (comma thousands, period decimal: "1,234.56")
- whether amounts use separate withdrawal/deposit columns or a single amount column
- credit_marker (e.g., "CR") if a single amount column uses a suffix for credits
- skip_patterns: regex patterns for lines to ignore (totals, subtotals, section headers)
- bank_name and statement_type (if identifiable)
- year_source: "header" if the year appears in the document header, "inline" if dates include the year
- year_pattern: regex to extract the year from the full text (if year_source is "header")
- transfer_codes: transaction codes that indicate transfers (if a code column exists)
- internal_transfer_pattern: regex for descriptions of internal transfers between accounts
- external_income_pattern: regex for descriptions of incoming external transfers

Return ONLY valid JSON. No explanation. Schema:
{
  "bank_name": string,
  "statement_type": string,
  "columns": {
    "date": { "x": [min, max], "format": string },
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
