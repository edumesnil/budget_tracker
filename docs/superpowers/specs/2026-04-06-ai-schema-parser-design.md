# AI-Driven Schema Parser — Design Spec

> Replaces hardcoded bank-specific parsers with an AI-detected, user-confirmed, cached column schema system. The AI identifies the statement structure once; a deterministic engine parses every subsequent import.

## Problem

The current parser architecture has a hardcoded `BankParser` per bank format. This causes:

- **Issue #6** — Desjardins chequing reuses the credit card parser, which grabs the balance column instead of the transaction amount (wrong x-positions)
- **Issue #7** — No transfer detection because the `code` column (ACH, RA, VFF, VMW) is discarded
- **Brittleness** — Every new bank or format change requires manual parser code
- **No self-learning** — The system can't adapt to new formats without developer intervention

## Solution

A two-phase approach:

1. **Schema detection** — AI analyzes the structural layout of a sanitized statement sample and outputs a declarative column schema (JSON). This happens once per new bank format.
2. **Deterministic parsing** — A generic column parser uses the cached schema to extract transactions by x-position. No AI involved in actual data extraction.

## Architecture Overview

See `docs/ai-parser-flow.mmd` for the full Mermaid flow diagram.

```
First import of new format:
  Upload → Extract text items → Compute fingerprint → Cache miss →
  Allowlist sanitize → AI schema detection → User confirms sample rows →
  Save schema → Deterministic parse → Categorize → Review

Subsequent imports of same format:
  Upload → Extract text items → Compute fingerprint → Cache hit →
  Load schema → Deterministic parse → Categorize → Review
```

## 1. Text Extraction Changes

### Current

`extractLines(file: File): Promise<string[]>` — extracts text, reconstructs lines as strings, **discards x-positions**.

### New

Split into two functions:

```ts
interface TextItem {
  text: string
  x: number      // horizontal position
  y: number      // vertical position (page-adjusted)
  width: number  // item width for gap detection
  page: number   // source page (1-indexed)
}

/** Returns raw positioned text items grouped into lines by Y proximity */
async function extractItems(file: File): Promise<TextItem[][]>

/** Backward-compatible string extraction (calls extractItems internally) */
async function extractLines(file: File): Promise<string[]>
```

`extractItems` is the existing extraction logic from `extractLines` but returning structured data instead of flattening to strings. The `page` field is added to support per-page header stripping.

`extractLines` becomes a thin wrapper that joins items into strings with gap-aware spacing (existing logic preserved).

### Changes to existing code

- `extractLines` internals refactored into `extractItems` + a flatten step
- No change to `extractLines` return type or callers
- `parsePdf` updated to call `extractItems` and pass items to the schema-based pipeline

## 2. Statement Schema

The declarative structure the AI produces and the column parser consumes.

```ts
interface ColumnDef {
  x: [number, number]    // min and max x-position for this column
  format?: string         // for date columns: "DD MMM", "DD MM", "DD/MM/YYYY", etc.
}

interface SectionRule {
  header_pattern: string  // regex string matching section headers
  parse: boolean          // true = extract transactions from this section
}

interface StatementSchema {
  // Identity
  id: string              // UUID, auto-generated
  user_id: string         // RLS
  fingerprint: string     // structural hash for cache lookup
  bank_name: string       // "Desjardins", "TD", etc.
  statement_type: string  // "chequing", "credit-card", "savings"

  // Column layout
  columns: {
    date: ColumnDef                // required
    code?: ColumnDef               // transaction code (ACH, RA, DI, VFF...)
    description: ColumnDef         // required
    withdrawal?: ColumnDef         // chequing: separate debit column
    deposit?: ColumnDef            // chequing: separate credit column
    amount?: ColumnDef             // credit card: single amount column
    balance?: ColumnDef            // identified so the parser can SKIP it
  }

  // Amount parsing
  amount_format: "french" | "english"
  // french: space thousands, comma decimal ("1 234,56")
  // english: comma thousands, period decimal ("1,234.56")
  credit_marker?: string           // e.g., "CR" for credit card statements

  // Document structure
  sections?: SectionRule[]
  continuation_pattern?: string    // e.g., "(SUITE)" for multi-page sections
  skip_patterns: string[]          // lines to ignore: totals, headers, footers

  // Line handling
  multiline_rule?: "indent"        // continuation lines: same description x, no date

  // Transfer detection
  transfer_codes?: string[]        // codes indicating transfers: ["VFF", "VMW", "VWW"]
  internal_transfer_pattern?: string  // regex: "Virement entre folios|Virement - AccèsD"
  external_income_pattern?: string    // regex: "Virement (Interac )?de|reçu de"

  // Year extraction
  year_source: "header" | "inline"
  year_pattern?: string            // regex to extract year (applied to full text)

  // State
  confirmed: boolean               // user validated sample rows
  created_at: string
}
```

### Supabase migration

New table `statement_schemas`:

```sql
create table statement_schemas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  fingerprint text not null,
  bank_name text not null,
  statement_type text not null,
  columns jsonb not null,
  amount_format text not null check (amount_format in ('french', 'english')),
  credit_marker text,
  sections jsonb,
  continuation_pattern text,
  skip_patterns jsonb not null default '[]',
  multiline_rule text,
  transfer_codes jsonb,
  internal_transfer_pattern text,
  external_income_pattern text,
  year_source text not null check (year_source in ('header', 'inline')),
  year_pattern text,
  confirmed boolean not null default false,
  created_at timestamptz default now()
);

alter table statement_schemas enable row level security;

create policy "Users can manage their own schemas"
  on statement_schemas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index statement_schemas_fingerprint_idx
  on statement_schemas (user_id, fingerprint);
```

## 3. Fingerprinting

Deterministic hash of structural features that identify a statement format. Computed locally from extracted text items — no AI involved.

### What goes into the fingerprint

1. **Column header detection** — find the first line where 4+ short text items span a total x-range > 300px. Extract the header labels and their x-positions.
2. **Bank identifier** — scan first 20 lines for known bank name patterns (DESJARDINS, TD, BMO, RBC, etc.). If none found, use "UNKNOWN".
3. **Format indicators** — presence of "MASTERCARD"/"VISA" (credit card) vs "RELEVÉ DE COMPTE" (chequing) vs other keywords.

### Hash construction

```ts
function computeFingerprint(items: TextItem[][]): string {
  const headerLine = detectColumnHeaderLine(items)
  const headerText = headerLine
    .map(item => `${Math.round(item.x / 10) * 10}:${item.text}`)
    .sort((a, b) => /* by x */)
    .join("|")

  const bankId = detectBankIdentifier(items)
  const formatId = detectFormatType(items)

  const raw = `${bankId}::${formatId}::${headerText}`
  return sha256(raw)  // or simple string hash
}
```

The fingerprint is stable across statements of the same type because:
- Column headers don't change between months
- Bank identifier is constant
- x-positions are consistent within a bank's PDF template

It changes when a bank redesigns their statement layout, which is exactly when we want a new schema.

## 4. PII Sanitization for Schema Detection

### Principle: allowlist, not blocklist

The schema detection AI receives only provably-safe content. Everything else is masked. This guarantees zero PII leakage regardless of bank format.

### Classification rules

Each text item is classified independently:

| Type | Pattern | Action |
|------|---------|--------|
| Date-like | `/^\d{1,2}\s+(JAN\|FÉV\|MAR\|AVR\|MAI\|JUN\|JUL\|AOÛ\|SEP\|OCT\|NOV\|DÉC\|FEB\|APR\|MAY\|AUG\|DEC)$/i` or `/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/` | Keep |
| Amount-like | `/^[\d\s.,]+$/` where string contains at least one digit and a decimal separator (comma or period) | Keep |
| Short code | `/^[A-Z]{1,5}$/` (2-5 uppercase letters, e.g., ACH, RA, DI, VFF, IRGA) | Keep |
| Banking term | Matches a dictionary of ~60 known financial terms (EN + FR) | Keep |
| Page indicator | `/^Page\s+\d+/i` or `/^\d+\s+de\s+\d+$/` | Keep |
| Everything else | Any text not matching above | Replace with `[TEXT]` |

### Banking terms dictionary

```ts
const SAFE_BANKING_TERMS = new Set([
  // Column headers (FR)
  "date", "code", "description", "frais", "retrait", "dépôt", "solde",
  "montant", "détail", "libellé", "crédit", "débit",
  // Column headers (EN)
  "amount", "balance", "withdrawal", "deposit", "credit", "debit",
  "details", "memo", "payee", "merchant",
  // Section / structural (FR)
  "total", "sous-total", "sommaire", "suite", "reporté",
  // Section / structural (EN)
  "subtotal", "summary", "continued", "carried forward",
  // Statement types
  "relevé", "compte", "opérations", "courantes", "épargne",
  "placement", "mastercard", "visa",
])
```

This dictionary is additive — new terms can be added without security risk (they're all generic financial vocabulary, never PII).

### What the AI receives

For schema detection, send 8-12 representative lines (first data rows after column headers, sampled across pages for multi-page statements):

```
x:56 Date | x:84 Code | x:196 Description | x:388 Retrait | x:461 Dépôt | x:533 Solde
x:55 2 MAR | x:84 ACH | x:108 [TEXT] | x:412 13.71 | x:543 3 086.83
x:55 2 MAR | x:84 RA | x:108 [TEXT] | x:412 2 073.00 | x:543 6 872.26
x:55 4 MAR | x:84 DI | x:108 [TEXT] | x:479 969.60 | x:543 2 558.42
x:55 6 MAR | x:84 ACH | x:108 [TEXT] | x:412 68.79 | x:543 2 983.79
x:51 10 MAR | x:84 ACH | x:108 [TEXT] | x:412 19.05 | x:543 2 804.74
x:51 12 MAR | x:84 DI | x:108 [TEXT] | x:479 969.60 | x:543 3 548.40
x:51 13 MAR | x:84 ACH | x:108 [TEXT] | x:412 58.86 | x:543 4 166.73
```

### Failure mode

If the allowlist is too aggressive (masks a column header the AI needs), the AI may produce an incomplete or incorrect schema. This is caught by the user confirmation step — the sample rows will look wrong and the user rejects. No data corruption, no PII leak. The dictionary gets expanded for that term.

### Categorization sanitization (unchanged)

The existing `sanitize()` function continues to handle merchant descriptions before the categorization AI call. It strips PII patterns (card numbers, long digit sequences, account refs) but keeps merchant names, cities, and transaction descriptions intact. No changes needed.

## 5. Schema Detection Prompt

The AI call for new formats. Uses the existing `AIProvider` infrastructure with a new method.

### Input

8-12 allowlist-sanitized lines with x-positions (as shown above).

### Prompt structure

```
System:
You are analyzing the column structure of a bank statement PDF.
Text has been extracted with x-positions. Each item shows x:text.
Items marked [TEXT] are masked content — ignore their values,
but note their x-positions.

Analyze the layout and return a JSON schema with:
- columns: what columns exist and their x-position ranges [min, max]
- date format used in the date column
- amount format: "french" (space thousands, comma decimal: "1 234,56")
  or "english" (comma thousands, period decimal: "1,234.56")
- whether amounts use separate withdrawal/deposit columns or a single column
- credit marker (e.g., "CR") if applicable
- patterns to skip (totals, subtotals, section headers)
- bank name and statement type (if identifiable from column headers)
- transfer codes (if a "code" column exists with codes like VFF, VMW)

Return ONLY valid JSON matching this structure:
{schema example with field descriptions}

User:
Here are the extracted lines:
{sanitized lines}
```

### Token budget

- Input: ~800 tokens (system prompt + 8-12 lines)
- Output: ~300 tokens (schema JSON)
- Total: ~1,100 tokens per new bank format
- Cost: effectively zero (Groq free tier: 14,400 requests/day)

### Provider

Uses the same `AIProvider` infrastructure. Add a `detectSchema` method to the interface:

```ts
interface AIProvider {
  categorize(...): Promise<CategorizationResult[]>  // existing
  detectSchema(sanitizedSample: string): Promise<RawSchemaResponse>  // new
}
```

`detectSchema` is optional — providers that don't implement it fall back to a default implementation using the chat/completion endpoint with the schema prompt.

## 6. Generic Column Parser

The deterministic engine that uses a schema to extract transactions from positioned text items.

### Algorithm

```
Input: TextItem[][], StatementSchema
Output: ParsedTransaction[]

1. Extract year from full text using schema.year_pattern

2. For each line (group of TextItem[]):
   a. Join items to string, check against skip_patterns → skip if match
   b. Check against section headers → track active section
      - If active section has parse=false → skip
      - If continuation_pattern matches → continue previous section

   c. Find items in date column x-range
      - If no date items AND multiline_rule="indent":
        → Append description items to previous transaction
        → Continue to next line
      - If no date items: skip line

   d. Parse date using column format + year

   e. Find items in description column x-range → join as description

   f. Find items in code column x-range (if exists) → transaction code

   g. Extract amount:
      - If schema has withdrawal + deposit columns:
        → Check deposit column first: items present → INCOME
        → Else check withdrawal column → EXPENSE
        → Parse amount using schema.amount_format
      - If schema has single amount column:
        → Parse amount, check for credit_marker → INCOME/EXPENSE

   h. Transfer detection (if schema has transfer_codes):
      - If code matches transfer_codes:
        → Check description against internal_transfer_pattern → flag "internal"
        → Check against external_income_pattern → flag "external-income"
        → Default → flag "internal"

   i. Emit ParsedTransaction (+ transfer flag)

3. Deduplicate (existing deduplicateTransactions function)

4. Return transactions
```

### Column matching

An item belongs to a column if its x-position falls within the column's `[min, max]` range, with a tolerance of ±5px to handle minor PDF rendering variations:

```ts
function itemInColumn(item: TextItem, col: ColumnDef): boolean {
  return item.x >= col.x[0] - 5 && item.x <= col.x[1] + 5
}
```

When multiple items fall in the same column for a single line, they're joined with a space (handles split text within a column).

### Amount parsing

Reuse the existing `parseAmount()` function, which already handles French and English formats. The schema's `amount_format` field serves as documentation and validation — if the parsed amount seems unreasonable (> $100,000 for a single transaction), flag a warning.

### Size

Estimated ~100-120 lines of TypeScript.

## 7. Transfer Detection

Transfer detection is a natural byproduct of the schema system. The `code` column (previously discarded by the CC parser) provides transaction type codes.

### Desjardins codes (detected by schema)

| Code | Meaning | Handling |
|------|---------|----------|
| VFF | Virement entre folios | Internal transfer → skip |
| VMW | Virement Interac (outgoing or incoming) | Check description pattern |
| VWW | Virement AccèsD Internet | Check description pattern |
| PWW | Paiement facture AccèsD | Bill payment → expense |
| DI | Dépôt direct | Income |
| RA | Retrait/paiement autorisé | Expense |
| ACH | Achat | Expense |
| RGA | Retrait au GA | ATM withdrawal → expense |

### Transfer classification in review

Add to `ParsedTransaction` and `ReviewItem`:

```ts
interface ParsedTransaction {
  // ... existing fields
  transferType?: "internal" | "external-income" | null
  transferParty?: string  // extracted name: "MICHEL DUMESNIL", "315535 EOP"
}
```

Internal transfers default to `status: "skipped"` in the review table. External income transfers are kept as income. Users can override either.

## 8. Import Flow Changes

### New statuses

```ts
type ImportStatus =
  | "idle"
  | "parsing"
  | "schema_detecting"   // NEW: AI analyzing format
  | "schema_validating"  // NEW: user confirming sample rows
  | "mapping"            // CSV column mapping (existing)
  | "reviewing"
  | "importing"
  | "done"
```

### New state in useImport

```ts
// Schema detection state
const [schemaPreview, setSchemaPreview] = useState<ParsedTransaction[] | null>(null)
const [detectedSchema, setDetectedSchema] = useState<StatementSchema | null>(null)

// User actions
const confirmSchema = useCallback(async () => {
  // Save schema to Supabase with confirmed=true
  // Re-parse full statement with confirmed schema
  // Proceed to reviewing status
}, [detectedSchema])

const rejectSchema = useCallback(() => {
  // Discard schema, reset to idle
  // User can retry or upload different file
}, [])
```

### Updated PDF flow in handleFile

```ts
if (ext === "pdf") {
  setStatus("parsing")
  const items = await extractItems(file)
  const fullText = items.map(line => line.map(i => i.text).join(" ")).join("\n")
  const fingerprint = computeFingerprint(items)

  // Check for cached schema
  const cached = await loadSchema(fingerprint)

  if (cached) {
    // Fast path: parse directly
    const result = parseWithSchema(items, fullText, cached)
    await processTransactions(result.transactions)
  } else {
    // Slow path: detect schema
    setStatus("schema_detecting")
    const sanitized = allowlistSanitize(items)
    const rawSchema = await ai.detectSchema(sanitized)
    const schema = buildSchema(rawSchema, fingerprint)

    // Preview: parse 3-5 rows for validation
    const preview = parseWithSchema(items, fullText, schema, { limit: 5 })
    setDetectedSchema(schema)
    setSchemaPreview(preview.transactions)
    setStatus("schema_validating")
    // Wait for user to call confirmSchema() or rejectSchema()
  }
}
```

### Schema validation UI

A simple intermediate step shown during `schema_validating`:

- Card showing: "New statement format detected: {bank_name} {statement_type}"
- Table with 3-5 sample transactions: date, description, amount, type
- "These look correct" button → `confirmSchema()`
- "Something's wrong" button → `rejectSchema()`

Minimal UI — this only appears once per bank format.

## 9. What Gets Replaced

### Removed

- `BankParser` interface
- `desjardinsCC` parser
- `desjardinsChequing` parser
- `genericParser`
- `PARSERS` registry array
- Bank detection logic in `parsePdf()`

### Kept

- `extractLines()` — backward compat wrapper, used by CSV path
- `parseAmount()` — reused by column parser
- `deduplicateTransactions()` — called after column parsing
- `cleanFallback()` — display name cleanup
- All of `csv.ts` — unchanged
- All of `ai.ts` categorization — unchanged (new `detectSchema` method added)
- All of `use-import.ts` pipeline logic — extended with schema detection states
- `sanitize()` / `sanitizeBatch()` — unchanged, still used for categorization

### New files

- `src/lib/parsers/schema.ts` — `StatementSchema` type, `parseWithSchema()`, `computeFingerprint()`, `allowlistSanitize()`, `loadSchema()`, `saveSchema()`
- `src/lib/parsers/schema-prompt.ts` — schema detection prompt builder and response parser
- Supabase migration for `statement_schemas` table

### Modified files

- `src/lib/parsers/pdf.ts` — `extractItems()` extracted from `extractLines()`, `parsePdf()` rewritten to use schema pipeline
- `src/lib/ai.ts` — `detectSchema` method added to `AIProvider` interface and providers
- `src/hooks/use-import.ts` — new statuses, schema detection flow, `confirmSchema`/`rejectSchema` actions
- `src/routes/import.tsx` — schema validation UI step
- `src/lib/parsers/types.ts` — `transferType`/`transferParty` fields on `ParsedTransaction`

## 10. What This Resolves

- **Issue #6** (wrong amounts) — column parser reads the correct column by x-position, ignores balance column
- **Issue #7** (transfers) — schema detects transfer codes from the code column, flags internal vs external
- **Future banks** — no code changes needed, AI detects the format, user confirms, schema cached
- **Format changes** — fingerprint mismatch triggers re-detection automatically

## 11. Token Cost Analysis

| Event | AI calls | Tokens | Frequency |
|-------|----------|--------|-----------|
| First import of new bank format | 1 schema detection | ~1,100 | Once per format (ever) |
| Subsequent imports (same format) | 0 for parsing | 0 | Every import |
| Categorization (unknown merchants) | 1 per 10 merchants | ~800/batch | Same as today |

Schema detection adds ~1,100 tokens total, once. After that, parsing is free. The overall token usage may actually decrease because the schema system reduces categorization errors (correct income/expense detection means fewer mismatches to re-categorize).
