# AI-Driven Schema Parser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded bank-specific parsers with an AI-detected, user-confirmed, cached column schema system that parses any PDF bank statement by x-position.

**Architecture:** Two-phase approach — (1) AI detects column layout from allowlist-sanitized structural data, user confirms sample rows, schema cached in Supabase; (2) deterministic column parser uses cached schema x-positions for all future imports. Post-parse validation flags suspicious amounts. Full inline editing in review table. Multi-step progress UI.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + RLS), pdfjs-dist, Panda CSS, Park UI, existing AIProvider infrastructure (Groq/Gemini/Ollama)

**Spec:** `docs/superpowers/specs/2026-04-06-ai-schema-parser-design.md`
**Resolves:** GitHub issues #6 (wrong amounts) and #7 (transfer detection)

---

## File Inventory

### New files

| File                                                       | Responsibility                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `supabase/migrations/20260406000000_statement_schemas.sql` | New `statement_schemas` table with RLS                                     |
| `src/lib/parsers/schema-types.ts`                          | `TextItem`, `ColumnDef`, `SectionRule`, `StatementSchema` types            |
| `src/lib/parsers/extract-items.ts`                         | `extractItems()` — structured text extraction from PDF                     |
| `src/lib/parsers/fingerprint.ts`                           | `computeFingerprint()` — structural hash for cache lookup                  |
| `src/lib/parsers/allowlist-sanitizer.ts`                   | `allowlistSanitize()` — aggressive PII masking for schema detection        |
| `src/lib/parsers/schema-prompt.ts`                         | Schema detection prompt builder + response parser                          |
| `src/lib/parsers/column-parser.ts`                         | `parseWithSchema()` — deterministic column parser using schema x-positions |
| `src/lib/parsers/validate.ts`                              | Post-parse validation rules (amount sanity checks, outlier detection)      |
| `src/lib/parsers/schema-store.ts`                          | `loadSchema()`, `saveSchema()` — Supabase CRUD for statement_schemas       |
| `src/components/import/import-stepper.tsx`                 | Horizontal step indicator with contextual steps                            |
| `src/components/import/schema-detecting-card.tsx`          | Spinner during AI schema analysis                                          |
| `src/components/import/schema-validation-card.tsx`         | Sample rows table + confirm/reject buttons                                 |
| `src/components/import/validation-summary-card.tsx`        | Post-parse stats with flagged/error counts                                 |
| `src/components/import/unparseable-section.tsx`            | Collapsible section for failed rows                                        |
| `src/tests/parsers/extract-items.test.ts`                  | Tests for extractItems                                                     |
| `src/tests/parsers/fingerprint.test.ts`                    | Tests for computeFingerprint                                               |
| `src/tests/parsers/allowlist-sanitizer.test.ts`            | Tests for allowlistSanitize                                                |
| `src/tests/parsers/schema-prompt.test.ts`                  | Tests for prompt builder + response parser                                 |
| `src/tests/parsers/column-parser.test.ts`                  | Tests for parseWithSchema                                                  |
| `src/tests/parsers/validate.test.ts`                       | Tests for post-parse validation                                            |

### Modified files

| File                                     | Changes                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/parsers/types.ts`               | Add `transferType`, `transferParty` to `ParsedTransaction`; add `warnings`, `rawLine`, `parseError` to a new `ValidatedTransaction` type                     |
| `src/lib/parsers/pdf.ts`                 | Refactor `extractLines` to use `extractItems` internally; rewrite `parsePdf` to use schema pipeline; remove `BankParser` interface and all hardcoded parsers |
| `src/lib/ai.ts`                          | Add `detectSchema` method to `AIProvider` interface + implement in all 3 providers                                                                           |
| `src/types/database.ts`                  | Add `StatementSchema` DB type + insert/update utility types                                                                                                  |
| `src/hooks/use-import.ts`                | Add `schema_detecting`/`schema_validating` statuses; schema detection flow; validation pass; `confirmSchema`/`rejectSchema` actions; inline edit support     |
| `src/routes/import.tsx`                  | Render step-appropriate components; wire up stepper                                                                                                          |
| `src/components/import/review-table.tsx` | Inline editing for all fields; flagged row styling; unparseable section; stats bar update                                                                    |

---

## Task 1: Supabase Migration — `statement_schemas` Table

**Files:**

- Create: `supabase/migrations/20260406000000_statement_schemas.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260406000000_statement_schemas.sql

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

- [ ] **Step 2: Add TypeScript types for statement_schemas**

In `src/types/database.ts`, add after the `MerchantMapping` interface:

```ts
export interface StatementSchemaRow {
  id: string;
  user_id: string;
  fingerprint: string;
  bank_name: string;
  statement_type: string;
  columns: Record<string, unknown>;
  amount_format: "french" | "english";
  credit_marker: string | null;
  sections: Record<string, unknown>[] | null;
  continuation_pattern: string | null;
  skip_patterns: string[];
  multiline_rule: string | null;
  transfer_codes: string[] | null;
  internal_transfer_pattern: string | null;
  external_income_pattern: string | null;
  year_source: "header" | "inline";
  year_pattern: string | null;
  confirmed: boolean;
  created_at: string;
}

export type InsertStatementSchema = Omit<StatementSchemaRow, "id" | "user_id" | "created_at">;
```

- [ ] **Step 3: Apply migration to local Supabase**

Run: `supabase db reset`

Expected: Migration applies successfully, `statement_schemas` table exists.

- [ ] **Step 4: Commit**

```
feat: add statement_schemas table migration and types
```

---

## Task 2: Schema Types — `schema-types.ts`

**Files:**

- Create: `src/lib/parsers/schema-types.ts`

- [ ] **Step 1: Create the schema types file**

This file defines the in-memory types used throughout the schema parser pipeline. These are distinct from the DB row type — they have parsed/typed `columns` instead of raw JSONB.

```ts
// src/lib/parsers/schema-types.ts

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
```

- [ ] **Step 2: Run type check**

Run: `vp check`

Expected: No errors related to the new file.

- [ ] **Step 3: Commit**

```
feat: add schema parser type definitions
```

---

## Task 3: Extend `ParsedTransaction` Types

**Files:**

- Modify: `src/lib/parsers/types.ts`

- [ ] **Step 1: Add transfer and validation fields to types**

In `src/lib/parsers/types.ts`, extend `ParsedTransaction`:

```ts
/** A single transaction row extracted from a bank statement */
export interface ParsedTransaction {
  date: string; // ISO date (yyyy-mm-dd)
  description: string; // raw merchant description from the statement
  amount: number; // always positive — category.type determines direction
  type: "INCOME" | "EXPENSE";
  transferType?: "internal" | "external-income" | null;
  transferParty?: string; // extracted name from transfer description
}
```

Add a new interface for validated transactions (used between column parser and review table):

```ts
/** Transaction after post-parse validation pass */
export interface ValidatedTransaction extends ParsedTransaction {
  warnings: string[]; // validation warnings
  rawLine: string; // original PDF line text for debugging
  parseError?: string; // if row couldn't be fully parsed
}
```

- [ ] **Step 2: Run type check**

Run: `vp check`

Expected: No errors. Existing code doesn't use the new optional fields, so no breakage.

- [ ] **Step 3: Commit**

```
feat: add transfer and validation fields to parser types
```

---

## Task 4: Text Extraction — `extractItems()`

**Files:**

- Create: `src/lib/parsers/extract-items.ts`
- Create: `src/tests/parsers/extract-items.test.ts`
- Modify: `src/lib/parsers/pdf.ts` (refactor `extractLines` to use `extractItems`)

- [ ] **Step 1: Write the test for extractItems**

Since `extractItems` depends on pdfjs-dist which needs a real PDF file, we test the line-grouping logic separately. Create a helper that takes raw items and groups them:

```ts
// src/tests/parsers/extract-items.test.ts
import { describe, it, expect } from "vitest";
import { groupItemsIntoLines } from "@/lib/parsers/extract-items";
import type { TextItem } from "@/lib/parsers/schema-types";

describe("groupItemsIntoLines", () => {
  it("groups items by Y proximity (tolerance of 3)", () => {
    const items: TextItem[] = [
      { text: "Date", x: 50, y: 100, width: 30, page: 1 },
      { text: "Code", x: 90, y: 100.5, width: 30, page: 1 },
      { text: "Description", x: 150, y: 100, width: 60, page: 1 },
      { text: "2 MAR", x: 50, y: 115, width: 35, page: 1 },
      { text: "ACH", x: 90, y: 115.2, width: 25, page: 1 },
      { text: "METRO PLUS", x: 150, y: 115, width: 80, page: 1 },
    ];

    const lines = groupItemsIntoLines(items);

    expect(lines).toHaveLength(2);
    expect(lines[0].map((i) => i.text)).toEqual(["Date", "Code", "Description"]);
    expect(lines[1].map((i) => i.text)).toEqual(["2 MAR", "ACH", "METRO PLUS"]);
  });

  it("sorts items within a line by x-position", () => {
    const items: TextItem[] = [
      { text: "B", x: 200, y: 100, width: 10, page: 1 },
      { text: "A", x: 50, y: 100, width: 10, page: 1 },
      { text: "C", x: 300, y: 100, width: 10, page: 1 },
    ];

    const lines = groupItemsIntoLines(items);

    expect(lines).toHaveLength(1);
    expect(lines[0].map((i) => i.text)).toEqual(["A", "B", "C"]);
  });

  it("puts items far apart in Y into separate lines", () => {
    const items: TextItem[] = [
      { text: "Line1", x: 50, y: 100, width: 30, page: 1 },
      { text: "Line2", x: 50, y: 200, width: 30, page: 1 },
    ];

    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test src/tests/parsers/extract-items.test.ts`

Expected: FAIL — `groupItemsIntoLines` doesn't exist yet.

- [ ] **Step 3: Create `extract-items.ts` with `groupItemsIntoLines` and `extractItems`**

```ts
// src/lib/parsers/extract-items.ts

import type { TextItem } from "./schema-types";

// Lazy-load pdfjs-dist — ~300KB deferred until first PDF upload
let pdfjsMod: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (!pdfjsMod) {
    pdfjsMod = await import("pdfjs-dist");
    pdfjsMod.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjsMod;
}

const Y_TOLERANCE = 3;

/** Group flat TextItem[] into lines by Y proximity, sorted by x within each line */
export function groupItemsIntoLines(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) > Y_TOLERANCE) {
      lines.push(currentLine.sort((a, b) => a.x - b.x));
      currentLine = [item];
      currentY = item.y;
    } else {
      currentLine.push(item);
    }
  }
  lines.push(currentLine.sort((a, b) => a.x - b.x));

  return lines;
}

/** Extract raw positioned text items from a PDF, grouped into lines */
export async function extractItems(file: File): Promise<TextItem[][]> {
  const pdfjsLib = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allItems: TextItem[] = [];
  let pageOffset = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      allItems.push({
        text: item.str,
        x: item.transform[4],
        y: pageOffset + (viewport.height - item.transform[5]),
        width: item.width,
        page: i,
      });
    }

    pageOffset += viewport.height + 50;
  }

  return groupItemsIntoLines(allItems);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test src/tests/parsers/extract-items.test.ts`

Expected: PASS

- [ ] **Step 5: Refactor `extractLines` in `pdf.ts` to use `extractItems`**

Replace the body of `extractLines` in `src/lib/parsers/pdf.ts` with:

```ts
import { extractItems } from "./extract-items";

/**
 * Extract text from a PDF and reconstruct lines.
 * Groups text items by Y position, inserts spacing based on X gaps.
 */
export async function extractLines(file: File): Promise<string[]> {
  const lineGroups = await extractItems(file);

  const lines: string[] = [];
  for (const group of lineGroups) {
    let line = "";
    for (let j = 0; j < group.length; j++) {
      const item = group[j];
      if (j > 0) {
        const prev = group[j - 1];
        const gap = item.x - (prev.x + prev.width);
        if (gap > 15) {
          line += "  ";
        } else if (gap > 2) {
          line += " ";
        }
      }
      line += item.text;
    }
    lines.push(line.trim());
  }

  return lines;
}
```

Remove the `getPdfjs` function and the old extraction logic from `pdf.ts` (it now lives in `extract-items.ts`). Keep the pdfjs lazy-load only in `extract-items.ts`.

- [ ] **Step 6: Run type check**

Run: `vp check`

Expected: No errors.

- [ ] **Step 7: Commit**

```
feat: extract TextItem-based PDF text extraction

Refactors extractLines to use new extractItems() which preserves
x/y positions per text item. extractLines becomes a thin wrapper.
```

---

## Task 5: Fingerprinting

**Files:**

- Create: `src/lib/parsers/fingerprint.ts`
- Create: `src/tests/parsers/fingerprint.test.ts`

- [ ] **Step 1: Write tests for fingerprinting**

```ts
// src/tests/parsers/fingerprint.test.ts
import { describe, it, expect } from "vitest";
import {
  detectColumnHeaderLine,
  detectBankIdentifier,
  computeFingerprint,
} from "@/lib/parsers/fingerprint";
import type { TextItem } from "@/lib/parsers/schema-types";

function item(text: string, x: number, y: number, width = 30): TextItem {
  return { text, x, y, width, page: 1 };
}

describe("detectColumnHeaderLine", () => {
  it("finds line with 4+ short items spanning wide x-range", () => {
    const lines: TextItem[][] = [
      [item("DESJARDINS", 50, 10, 80)],
      [item("Page 1 de 3", 400, 20, 60)],
      [
        item("Date", 50, 50),
        item("Code", 84, 50),
        item("Description", 150, 50, 60),
        item("Retrait", 388, 50),
        item("Dépôt", 461, 50),
        item("Solde", 533, 50),
      ],
      [item("2 MAR", 50, 70), item("ACH", 84, 70), item("METRO", 150, 70)],
    ];

    const header = detectColumnHeaderLine(lines);
    expect(header).not.toBeNull();
    expect(header!.map((i) => i.text)).toContain("Date");
    expect(header!.map((i) => i.text)).toContain("Solde");
  });
});

describe("detectBankIdentifier", () => {
  it("detects DESJARDINS from first 20 lines", () => {
    const lines: TextItem[][] = [
      [item("Caisse Desjardins", 50, 10, 100)],
      [item("Some other text", 50, 20, 80)],
    ];

    expect(detectBankIdentifier(lines)).toBe("DESJARDINS");
  });

  it("returns UNKNOWN for unrecognized banks", () => {
    const lines: TextItem[][] = [[item("My local credit union", 50, 10, 100)]];

    expect(detectBankIdentifier(lines)).toBe("UNKNOWN");
  });
});

describe("computeFingerprint", () => {
  it("produces consistent hash for same structure", () => {
    const lines: TextItem[][] = [
      [item("DESJARDINS", 50, 10, 80)],
      [
        item("Date", 50, 50),
        item("Code", 84, 50),
        item("Description", 150, 50, 60),
        item("Retrait", 388, 50),
        item("Dépôt", 461, 50),
        item("Solde", 533, 50),
      ],
    ];

    const fp1 = computeFingerprint(lines);
    const fp2 = computeFingerprint(lines);
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(0);
  });

  it("produces different hash when column headers differ", () => {
    const lines1: TextItem[][] = [
      [item("DESJARDINS", 50, 10, 80)],
      [
        item("Date", 50, 50),
        item("Description", 150, 50, 60),
        item("Retrait", 388, 50),
        item("Solde", 533, 50),
      ],
    ];

    const lines2: TextItem[][] = [
      [item("DESJARDINS", 50, 10, 80)],
      [
        item("Date", 50, 50),
        item("Description", 150, 50, 60),
        item("Montant", 388, 50),
        item("Solde", 533, 50),
      ],
    ];

    expect(computeFingerprint(lines1)).not.toBe(computeFingerprint(lines2));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test src/tests/parsers/fingerprint.test.ts`

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement fingerprinting**

```ts
// src/lib/parsers/fingerprint.ts

import type { TextItem } from "./schema-types";

// Known bank name patterns
const BANK_PATTERNS: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /DESJARDINS/i, id: "DESJARDINS" },
  { pattern: /\bTD\b|TORONTO.DOMINION/i, id: "TD" },
  { pattern: /\bBMO\b|BANQUE\s+DE\s+MONTR[ÉE]AL/i, id: "BMO" },
  { pattern: /\bRBC\b|ROYAL\s+BANK/i, id: "RBC" },
  { pattern: /\bSCOTIA/i, id: "SCOTIA" },
  { pattern: /\bCIBC\b/i, id: "CIBC" },
  { pattern: /NATIONAL\s+BANK|BANQUE\s+NATIONALE/i, id: "BNC" },
  { pattern: /TANGERINE/i, id: "TANGERINE" },
  { pattern: /WEALTHSIMPLE/i, id: "WEALTHSIMPLE" },
];

const FORMAT_PATTERNS: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /MASTERCARD|VISA/i, id: "CC" },
  { pattern: /RELEV[ÉE]\s+DE\s+COMPTE/i, id: "CHEQUING" },
  { pattern: /[ÉE]PARGNE|SAVINGS/i, id: "SAVINGS" },
];

/**
 * Find the column header line: first line where 4+ short items
 * span a total x-range > 300px.
 */
export function detectColumnHeaderLine(lines: TextItem[][]): TextItem[] | null {
  for (const line of lines) {
    if (line.length < 4) continue;

    // Each item should be short (likely a header word, not a long sentence)
    const shortItems = line.filter((item) => item.text.length <= 20);
    if (shortItems.length < 4) continue;

    const xs = shortItems.map((item) => item.x);
    const xRange = Math.max(...xs) - Math.min(...xs);
    if (xRange > 300) return shortItems;
  }
  return null;
}

/** Scan first 20 lines for known bank name patterns */
export function detectBankIdentifier(lines: TextItem[][]): string {
  const searchLines = lines.slice(0, 20);
  const text = searchLines.map((line) => line.map((i) => i.text).join(" ")).join(" ");

  for (const { pattern, id } of BANK_PATTERNS) {
    if (pattern.test(text)) return id;
  }
  return "UNKNOWN";
}

/** Detect statement format type from content */
function detectFormatType(lines: TextItem[][]): string {
  const searchLines = lines.slice(0, 20);
  const text = searchLines.map((line) => line.map((i) => i.text).join(" ")).join(" ");

  for (const { pattern, id } of FORMAT_PATTERNS) {
    if (pattern.test(text)) return id;
  }
  return "UNKNOWN";
}

/** Simple string hash (djb2) — deterministic, fast, no crypto needed */
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * Compute a deterministic fingerprint from PDF structure.
 * Stable across statements of the same type, changes when layout changes.
 */
export function computeFingerprint(lines: TextItem[][]): string {
  const headerLine = detectColumnHeaderLine(lines);
  const headerText = headerLine
    ? headerLine
        .map((item) => `${Math.round(item.x / 10) * 10}:${item.text}`)
        .sort((a, b) => {
          const xa = parseInt(a.split(":")[0]);
          const xb = parseInt(b.split(":")[0]);
          return xa - xb;
        })
        .join("|")
    : "NO_HEADER";

  const bankId = detectBankIdentifier(lines);
  const formatId = detectFormatType(lines);

  const raw = `${bankId}::${formatId}::${headerText}`;
  return hash(raw);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test src/tests/parsers/fingerprint.test.ts`

Expected: PASS

- [ ] **Step 5: Run type check**

Run: `vp check`

Expected: No errors.

- [ ] **Step 6: Commit**

```
feat: add PDF statement fingerprinting for schema cache lookup
```

---

## Task 6: Allowlist Sanitizer

**Files:**

- Create: `src/lib/parsers/allowlist-sanitizer.ts`
- Create: `src/tests/parsers/allowlist-sanitizer.test.ts`

- [ ] **Step 1: Write tests**

```ts
// src/tests/parsers/allowlist-sanitizer.test.ts
import { describe, it, expect } from "vitest";
import { classifyItem, allowlistSanitize } from "@/lib/parsers/allowlist-sanitizer";
import type { TextItem } from "@/lib/parsers/schema-types";

function item(text: string, x: number, y: number): TextItem {
  return { text, x, y, width: 30, page: 1 };
}

describe("classifyItem", () => {
  it("keeps date-like items", () => {
    expect(classifyItem("2 MAR")).toBe("keep");
    expect(classifyItem("15 FÉV")).toBe("keep");
    expect(classifyItem("01/03/2026")).toBe("keep");
    expect(classifyItem("12-05")).toBe("keep");
  });

  it("keeps amount-like items", () => {
    expect(classifyItem("1 234,56")).toBe("keep");
    expect(classifyItem("13.71")).toBe("keep");
    expect(classifyItem("2 073.00")).toBe("keep");
  });

  it("keeps short codes", () => {
    expect(classifyItem("ACH")).toBe("keep");
    expect(classifyItem("VFF")).toBe("keep");
    expect(classifyItem("DI")).toBe("keep");
    expect(classifyItem("RA")).toBe("keep");
  });

  it("keeps banking terms", () => {
    expect(classifyItem("Date")).toBe("keep");
    expect(classifyItem("Retrait")).toBe("keep");
    expect(classifyItem("Solde")).toBe("keep");
    expect(classifyItem("MASTERCARD")).toBe("keep");
  });

  it("masks everything else", () => {
    expect(classifyItem("METRO PLUS JOLIETTE")).toBe("mask");
    expect(classifyItem("Jean-Pierre Tremblay")).toBe("mask");
    expect(classifyItem("123 RUE PRINCIPALE")).toBe("mask");
  });

  it("keeps page indicators", () => {
    expect(classifyItem("Page 1")).toBe("keep");
    expect(classifyItem("2 de 3")).toBe("keep");
  });
});

describe("allowlistSanitize", () => {
  it("formats lines with x-positions and masks PII", () => {
    const lines: TextItem[][] = [
      [
        item("Date", 56, 100),
        item("Code", 84, 100),
        item("Description", 196, 100),
        item("Retrait", 388, 100),
        item("Solde", 533, 100),
      ],
      [
        item("2 MAR", 55, 115),
        item("ACH", 84, 115),
        item("METRO PLUS JOLIETTE", 108, 115),
        item("13.71", 412, 115),
        item("3 086.83", 543, 115),
      ],
    ];

    const result = allowlistSanitize(lines);

    // Header line keeps all banking terms
    expect(result).toContain("Date");
    expect(result).toContain("Code");
    expect(result).toContain("Retrait");

    // Data line: date and amount kept, description masked
    expect(result).toContain("2 MAR");
    expect(result).toContain("ACH");
    expect(result).toContain("[TEXT]");
    expect(result).toContain("13.71");

    // PII should NOT be present
    expect(result).not.toContain("METRO PLUS JOLIETTE");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test src/tests/parsers/allowlist-sanitizer.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement allowlist sanitizer**

```ts
// src/lib/parsers/allowlist-sanitizer.ts

import type { TextItem } from "./schema-types";

// FR + EN month abbreviations for date detection
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
  // Column headers (FR)
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
  // Column headers (EN)
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
  // Section / structural (FR)
  "total",
  "sous-total",
  "sommaire",
  "suite",
  "reporté",
  // Section / structural (EN)
  "subtotal",
  "summary",
  "continued",
  "carried forward",
  // Statement types
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

  // Date-like
  if (DATE_RE.test(trimmed)) return "keep";

  // Amount-like (has digits + decimal separator)
  if (AMOUNT_RE.test(trimmed) && hasDigitAndDecimal(trimmed)) return "keep";

  // Short code (2-5 uppercase letters)
  if (SHORT_CODE_RE.test(trimmed)) return "keep";

  // Banking term (check each word)
  const lower = trimmed.toLowerCase();
  if (SAFE_BANKING_TERMS.has(lower)) return "keep";
  // Multi-word: check if all words are banking terms
  const words = lower.split(/\s+/);
  if (words.length > 1 && words.every((w) => SAFE_BANKING_TERMS.has(w))) return "keep";

  // Page indicator
  if (PAGE_RE.test(trimmed) || PAGE_FR_RE.test(trimmed)) return "keep";

  return "mask";
}

/**
 * Allowlist-sanitize extracted lines for AI schema detection.
 * Returns a formatted string with x-positions and masked PII.
 * Selects 8-12 representative lines (header + first data rows).
 */
export function allowlistSanitize(lines: TextItem[][]): string {
  const result: string[] = [];

  // Take up to 12 lines (first few are likely headers, rest are data)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test src/tests/parsers/allowlist-sanitizer.test.ts`

Expected: PASS

- [ ] **Step 5: Run type check**

Run: `vp check`

Expected: No errors.

- [ ] **Step 6: Commit**

```
feat: add allowlist sanitizer for zero-PII schema detection
```

---

## Task 7: Schema Detection Prompt

**Files:**

- Create: `src/lib/parsers/schema-prompt.ts`
- Create: `src/tests/parsers/schema-prompt.test.ts`

- [ ] **Step 1: Write tests for prompt builder and response parser**

````ts
// src/tests/parsers/schema-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildSchemaPrompt, parseSchemaResponse } from "@/lib/parsers/schema-prompt";

describe("buildSchemaPrompt", () => {
  it("produces system + user messages with sanitized sample", () => {
    const sample = [
      "x:56 Date | x:84 Code | x:196 Description | x:388 Retrait | x:461 Dépôt | x:533 Solde",
      "x:55 2 MAR | x:84 ACH | x:108 [TEXT] | x:412 13.71 | x:543 3 086.83",
    ].join("\n");

    const { system, user } = buildSchemaPrompt(sample);

    expect(system).toContain("column structure");
    expect(system).toContain("JSON");
    expect(user).toContain("x:56 Date");
    expect(user).toContain("[TEXT]");
  });
});

describe("parseSchemaResponse", () => {
  it("parses a valid schema JSON response", () => {
    const raw = JSON.stringify({
      bank_name: "Desjardins",
      statement_type: "chequing",
      columns: {
        date: { x: [50, 80], format: "DD MMM" },
        code: { x: [84, 100] },
        description: { x: [108, 380] },
        withdrawal: { x: [388, 450] },
        deposit: { x: [461, 520] },
        balance: { x: [533, 600] },
      },
      amount_format: "french",
      skip_patterns: ["TOTAL", "SOLDE PRÉCÉDENT"],
      year_source: "header",
      year_pattern: "RELEV.*?(20\\d{2})",
      transfer_codes: ["VFF", "VMW", "VWW"],
      internal_transfer_pattern: "Virement entre folios|Virement - AccèsD",
      external_income_pattern: "Virement (Interac )?de|reçu de",
    });

    const schema = parseSchemaResponse(raw);

    expect(schema).not.toBeNull();
    expect(schema!.bank_name).toBe("Desjardins");
    expect(schema!.columns.date.x).toEqual([50, 80]);
    expect(schema!.columns.withdrawal).toBeDefined();
    expect(schema!.amount_format).toBe("french");
    expect(schema!.transfer_codes).toEqual(["VFF", "VMW", "VWW"]);
  });

  it("parses response wrapped in markdown fences", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        bank_name: "TD",
        statement_type: "chequing",
        columns: {
          date: { x: [10, 60] },
          description: { x: [70, 300] },
          amount: { x: [310, 400] },
        },
        amount_format: "english",
        skip_patterns: [],
        year_source: "header",
      }) +
      "\n```";

    const schema = parseSchemaResponse(raw);
    expect(schema).not.toBeNull();
    expect(schema!.bank_name).toBe("TD");
  });

  it("returns null for garbage input", () => {
    expect(parseSchemaResponse("not json at all")).toBeNull();
  });
});
````

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test src/tests/parsers/schema-prompt.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement schema prompt builder and response parser**

````ts
// src/lib/parsers/schema-prompt.ts

import type { ColumnDef, SectionRule } from "./schema-types";

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

  // Strip markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.columns?.date || !parsed.columns?.description) return null;
    if (!parsed.amount_format) return null;

    // Normalize columns: ensure x is a tuple
    const cols = parsed.columns;
    for (const key of Object.keys(cols)) {
      const col = cols[key];
      if (col && Array.isArray(col.x) && col.x.length === 2) continue;
      if (col && !col.x) {
        delete cols[key]; // remove columns without x ranges
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
````

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test src/tests/parsers/schema-prompt.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
feat: add schema detection prompt builder and response parser
```

---

## Task 8: Add `detectSchema` to AI Providers

**Files:**

- Modify: `src/lib/ai.ts`

- [ ] **Step 1: Add `detectSchema` to the `AIProvider` interface**

In `src/lib/ai.ts`, add the import and extend the interface:

```ts
import type { RawSchemaResponse } from "@/lib/parsers/schema-prompt";
```

Add to `AIProvider`:

```ts
export interface AIProvider {
  categorize(
    descriptions: string[],
    categories: CategoryOption[],
    existingMappings?: MerchantMapping[],
    types?: Array<"INCOME" | "EXPENSE">,
  ): Promise<CategorizationResult[]>;
  detectSchema(sanitizedSample: string): Promise<RawSchemaResponse | null>;
}
```

- [ ] **Step 2: Add default `detectSchema` implementation for GroqProvider**

Add this method to the `GroqProvider` class:

```ts
async detectSchema(sanitizedSample: string): Promise<RawSchemaResponse | null> {
  const { buildSchemaPrompt, parseSchemaResponse } = await import("@/lib/parsers/schema-prompt")
  const { system, user } = buildSchemaPrompt(sanitizedSample)

  const res = await fetchWithRetry(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    },
    { maxRetries: 2, baseDelay: 1000 },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq schema detection failed: ${res.status} ${err}`)
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  const text = data.choices?.[0]?.message?.content ?? ""
  console.log("[ai] Schema detection response:", text.slice(0, 500))
  return parseSchemaResponse(text)
}
```

- [ ] **Step 3: Add `detectSchema` to `GeminiProvider`**

```ts
async detectSchema(sanitizedSample: string): Promise<RawSchemaResponse | null> {
  const { buildSchemaPrompt, parseSchemaResponse } = await import("@/lib/parsers/schema-prompt")
  const { system, user } = buildSchemaPrompt(sanitizedSample)

  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini schema detection failed: ${res.status} ${err}`)
  }

  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  console.log("[ai] Schema detection response:", text.slice(0, 500))
  return parseSchemaResponse(text)
}
```

- [ ] **Step 4: Add `detectSchema` to `OllamaProvider`**

```ts
async detectSchema(sanitizedSample: string): Promise<RawSchemaResponse | null> {
  const { buildSchemaPrompt, parseSchemaResponse } = await import("@/lib/parsers/schema-prompt")
  const { system, user } = buildSchemaPrompt(sanitizedSample)

  const res = await fetchWithRetry(`${this.baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: this.model,
      prompt: `${system}\n\n${user}`,
      format: "json",
      stream: false,
      options: { temperature: 0.1 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ollama schema detection failed: ${res.status} ${err}`)
  }

  const data = (await res.json()) as { response: string }
  console.log("[ai] Schema detection response:", data.response.slice(0, 500))
  return parseSchemaResponse(data.response)
}
```

- [ ] **Step 5: Run type check**

Run: `vp check`

Expected: No errors.

- [ ] **Step 6: Commit**

```
feat: add detectSchema method to all AI providers
```

---

## Task 9: Generic Column Parser

**Files:**

- Create: `src/lib/parsers/column-parser.ts`
- Create: `src/tests/parsers/column-parser.test.ts`

- [ ] **Step 1: Write tests for column parser**

```ts
// src/tests/parsers/column-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseWithSchema, itemInColumn } from "@/lib/parsers/column-parser";
import type { TextItem } from "@/lib/parsers/schema-types";
import type { StatementSchema } from "@/lib/parsers/schema-types";

function item(text: string, x: number, y: number, page = 1): TextItem {
  return { text, x, y, width: 30, page };
}

const CHEQUING_SCHEMA: StatementSchema = {
  id: "test-id",
  user_id: "test-user",
  fingerprint: "test-fp",
  bank_name: "Desjardins",
  statement_type: "chequing",
  columns: {
    date: { x: [50, 80], format: "DD MMM" },
    code: { x: [84, 100] },
    description: { x: [108, 380] },
    withdrawal: { x: [388, 450] },
    deposit: { x: [461, 520] },
    balance: { x: [533, 600] },
  },
  amount_format: "french",
  skip_patterns: ["TOTAL", "SOLDE PR"],
  year_source: "header",
  year_pattern: "RELEV.*?(20\\d{2})",
  transfer_codes: ["VFF", "VMW"],
  internal_transfer_pattern: "Virement entre folios",
  external_income_pattern: "Virement.*de",
  confirmed: true,
  created_at: "",
};

describe("itemInColumn", () => {
  it("matches item within column range with tolerance", () => {
    expect(itemInColumn(item("test", 52, 0), { x: [50, 80] })).toBe(true);
    expect(itemInColumn(item("test", 46, 0), { x: [50, 80] })).toBe(true); // within -5 tolerance
    expect(itemInColumn(item("test", 40, 0), { x: [50, 80] })).toBe(false);
  });
});

describe("parseWithSchema", () => {
  it("parses chequing transactions with withdrawal/deposit columns", () => {
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = [
      // Header line (skipped — no date)
      [
        item("Date", 56, 50),
        item("Code", 84, 50),
        item("Description", 196, 50),
        item("Retrait", 388, 50),
        item("Dépôt", 461, 50),
        item("Solde", 533, 50),
      ],
      // Expense: withdrawal column
      [
        item("2 MAR", 55, 100),
        item("ACH", 84, 100),
        item("METRO PLUS JOLIETTE", 108, 100),
        item("13,71", 412, 100),
        item("3 086,83", 543, 100),
      ],
      // Income: deposit column
      [
        item("4 MAR", 55, 115),
        item("DI", 84, 115),
        item("PAIE EMPLOYEUR", 108, 115),
        item("969,60", 479, 115),
        item("2 558,42", 543, 115),
      ],
      // Skip line: TOTAL
      [item("TOTAL", 108, 200), item("5 000,00", 412, 200)],
    ];

    const result = parseWithSchema(lines, fullText, CHEQUING_SCHEMA);

    expect(result.transactions).toHaveLength(2);

    const expense = result.transactions[0];
    expect(expense.date).toBe("2026-03-02");
    expect(expense.description).toBe("METRO PLUS JOLIETTE");
    expect(expense.amount).toBe(13.71);
    expect(expense.type).toBe("EXPENSE");

    const income = result.transactions[1];
    expect(income.date).toBe("2026-03-04");
    expect(income.amount).toBe(969.6);
    expect(income.type).toBe("INCOME");
  });

  it("detects internal transfers via transfer codes", () => {
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = [
      [
        item("6 MAR", 55, 100),
        item("VFF", 84, 100),
        item("Virement entre folios", 108, 100),
        item("500,00", 412, 100),
        item("1 500,00", 543, 100),
      ],
    ];

    const result = parseWithSchema(lines, fullText, CHEQUING_SCHEMA);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].transferType).toBe("internal");
  });

  it("skips lines matching skip_patterns", () => {
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = [
      [item("SOLDE PRÉCÉDENT", 108, 50), item("2 000,00", 543, 50)],
      [
        item("2 MAR", 55, 100),
        item("ACH", 84, 100),
        item("SHOP", 108, 100),
        item("10,00", 412, 100),
        item("1 990,00", 543, 100),
      ],
    ];

    const result = parseWithSchema(lines, fullText, CHEQUING_SCHEMA);
    expect(result.transactions).toHaveLength(1);
  });

  it("respects limit option for preview parsing", () => {
    const fullText = "RELEVÉ DE COMPTE Mars 2026";
    const lines: TextItem[][] = Array.from({ length: 10 }, (_, i) => [
      item(`${i + 1} MAR`, 55, 100 + i * 15),
      item("ACH", 84, 100 + i * 15),
      item("SHOP", 108, 100 + i * 15),
      item("10,00", 412, 100 + i * 15),
      item("900,00", 543, 100 + i * 15),
    ]);

    const result = parseWithSchema(lines, fullText, CHEQUING_SCHEMA, { limit: 3 });
    expect(result.transactions).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test src/tests/parsers/column-parser.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement the column parser**

```ts
// src/lib/parsers/column-parser.ts

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

/** Get all items in a line that fall in a column, joined with space */
function getColumnText(line: TextItem[], col: ColumnDef | undefined): string {
  if (!col) return "";
  return line
    .filter((item) => itemInColumn(item, col))
    .map((item) => item.text)
    .join(" ")
    .trim();
}

/** Parse "DD MMM" format into { day, month } */
function parseDateDDMMM(text: string): { day: number; month: number } | null {
  const m = text.match(/^(\d{1,2})\s+([A-ZÀ-Ü]{3})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTH_MAP[m[2].toUpperCase()];
  if (!month || day < 1 || day > 31) return null;
  return { day, month };
}

/** Parse various date formats from column text */
function parseDate(
  text: string,
  format?: string,
): { day: number; month: number; year?: number } | null {
  // DD MMM (most common for Desjardins)
  const ddmmm = parseDateDDMMM(text);
  if (ddmmm) return ddmmm;

  // DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : undefined;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year: year && year < 100 ? 2000 + year : year };
    }
  }

  // DD MM (two numbers)
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

/** Extract year from full text using schema pattern */
function extractYear(fullText: string, schema: StatementSchema): number {
  if (schema.year_pattern) {
    const re = new RegExp(schema.year_pattern, "i");
    const m = fullText.match(re);
    if (m?.[1]) return parseInt(m[1], 10);
  }

  // Fallback: find any 4-digit year
  const yearMatch = fullText.match(/\b(20\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
}

interface ParseOptions {
  limit?: number; // max transactions to return (for preview)
}

export function parseWithSchema(
  lines: TextItem[][],
  fullText: string,
  schema: StatementSchema,
  options: ParseOptions = {},
): { transactions: ParsedTransaction[]; warnings: string[] } {
  const year = extractYear(fullText, schema);
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

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

    // Check skip patterns
    if (skipRes.some((re) => re.test(lineText))) continue;

    // Get date column text
    const dateText = getColumnText(line, schema.columns.date);
    if (!dateText) continue; // no date = not a transaction line

    const parsed = parseDate(dateText, schema.columns.date.format);
    if (!parsed) continue;

    const txYear = parsed.year ?? year;
    const dateStr = `${txYear}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;

    // Description
    const desc = getColumnText(line, schema.columns.description);
    if (!desc) continue;

    // Code (optional)
    const code = getColumnText(line, schema.columns.code);

    // Amount
    let amount: number;
    let type: "INCOME" | "EXPENSE";

    if (schema.columns.withdrawal && schema.columns.deposit) {
      // Separate columns
      const depositText = getColumnText(line, schema.columns.deposit);
      const withdrawalText = getColumnText(line, schema.columns.withdrawal);

      if (depositText) {
        amount = parseAmount(depositText);
        type = "INCOME";
      } else if (withdrawalText) {
        amount = parseAmount(withdrawalText);
        type = "EXPENSE";
      } else {
        continue; // no amount found
      }
    } else if (schema.columns.amount) {
      const amountText = getColumnText(line, schema.columns.amount);
      if (!amountText) continue;

      const hasCredit = schema.credit_marker && amountText.includes(schema.credit_marker);
      const cleaned = schema.credit_marker
        ? amountText.replace(schema.credit_marker, "").trim()
        : amountText;
      amount = parseAmount(cleaned);
      type = hasCredit ? "INCOME" : "EXPENSE";
    } else {
      continue;
    }

    if (isNaN(amount) || amount === 0) continue;

    // Transfer detection
    let transferType: ParsedTransaction["transferType"] = null;
    let transferParty: string | undefined;

    if (code && transferCodes.has(code.toUpperCase())) {
      if (internalRe?.test(desc)) {
        transferType = "internal";
      } else if (externalRe?.test(desc)) {
        transferType = "external-income";
      } else {
        transferType = "internal"; // default for transfer codes
      }
    }

    transactions.push({
      date: dateStr,
      description: desc,
      amount,
      type,
      transferType,
      transferParty,
    });
  }

  return { transactions, warnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test src/tests/parsers/column-parser.test.ts`

Expected: PASS

- [ ] **Step 5: Run type check**

Run: `vp check`

Expected: No errors.

- [ ] **Step 6: Commit**

```
feat: add generic column parser using schema x-positions
```

---

## Task 10: Post-Parse Validation

**Files:**

- Create: `src/lib/parsers/validate.ts`
- Create: `src/tests/parsers/validate.test.ts`

- [ ] **Step 1: Write tests**

```ts
// src/tests/parsers/validate.test.ts
import { describe, it, expect } from "vitest";
import { validateTransactions } from "@/lib/parsers/validate";
import type { ParsedTransaction } from "@/lib/parsers/types";

function tx(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    date: "2026-03-02",
    description: "METRO PLUS",
    amount: 45.5,
    type: "EXPENSE",
    ...overrides,
  };
}

describe("validateTransactions", () => {
  it("passes clean transactions with no warnings", () => {
    const result = validateTransactions([tx(), tx({ amount: 30 })]);

    expect(result.clean).toHaveLength(2);
    expect(result.flagged).toHaveLength(0);
    expect(result.unparseable).toHaveLength(0);
  });

  it("flags amount > $10,000", () => {
    const result = validateTransactions([tx({ amount: 15000 })]);

    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].warnings[0]).toContain("unusually high");
  });

  it("flags statistical outliers (> 10x median)", () => {
    const txs = [
      tx({ amount: 20 }),
      tx({ amount: 25 }),
      tx({ amount: 30 }),
      tx({ amount: 22 }),
      tx({ amount: 5000 }), // > 10x median of ~24
    ];

    const result = validateTransactions(txs);

    // The 5000 should be flagged as outlier
    expect(result.flagged.some((f) => f.warnings.some((w) => w.includes("outlier")))).toBe(true);
  });

  it("flags suspiciously round large amounts (likely balance)", () => {
    const result = validateTransactions([tx({ amount: 75000 })]);

    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].warnings.some((w) => w.includes("balance"))).toBe(true);
  });

  it("marks zero amount as unparseable", () => {
    const result = validateTransactions([tx({ amount: 0 })]);

    expect(result.unparseable).toHaveLength(1);
    expect(result.unparseable[0].parseError).toContain("amount");
  });

  it("marks empty description as unparseable", () => {
    const result = validateTransactions([tx({ description: "AB" })]);

    expect(result.unparseable).toHaveLength(1);
    expect(result.unparseable[0].parseError).toContain("description");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test src/tests/parsers/validate.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement validation**

```ts
// src/lib/parsers/validate.ts

import type { ParsedTransaction, ValidatedTransaction } from "./types";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface ValidationResult {
  clean: ValidatedTransaction[];
  flagged: ValidatedTransaction[];
  unparseable: ValidatedTransaction[];
}

export function validateTransactions(
  transactions: ParsedTransaction[],
  rawLines?: string[],
): ValidationResult {
  const clean: ValidatedTransaction[] = [];
  const flagged: ValidatedTransaction[] = [];
  const unparseable: ValidatedTransaction[] = [];

  const amounts = transactions.filter((t) => t.amount > 0).map((t) => t.amount);
  const med = median(amounts);

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const rawLine = rawLines?.[i] ?? tx.description;
    const warnings: string[] = [];

    // Unparseable checks
    if (tx.amount === 0 || isNaN(tx.amount)) {
      unparseable.push({
        ...tx,
        warnings: [],
        rawLine,
        parseError: "No valid amount found",
      });
      continue;
    }

    if (tx.description.length < 3) {
      unparseable.push({
        ...tx,
        warnings: [],
        rawLine,
        parseError: "Description too short or empty",
      });
      continue;
    }

    // Warning checks
    if (tx.amount > 10000) {
      warnings.push(`Amount unusually high ($${tx.amount.toLocaleString()})`);
    }

    if (med > 0 && tx.amount > med * 10 && transactions.length >= 5) {
      warnings.push(`Statistical outlier — ${Math.round(tx.amount / med)}x the batch median`);
    }

    if (tx.amount > 50000 && tx.amount % 1000 === 0) {
      warnings.push("Suspiciously round large amount — may have grabbed balance column");
    }

    const validated: ValidatedTransaction = { ...tx, warnings, rawLine };

    if (warnings.length > 0) {
      flagged.push(validated);
    } else {
      clean.push(validated);
    }
  }

  return { clean, flagged, unparseable };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test src/tests/parsers/validate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
feat: add post-parse validation for flagging suspicious amounts
```

---

## Task 11: Schema Store (Supabase CRUD)

**Files:**

- Create: `src/lib/parsers/schema-store.ts`

- [ ] **Step 1: Implement schema store**

```ts
// src/lib/parsers/schema-store.ts

import { supabase } from "@/lib/supabase";
import type { StatementSchema, ColumnDef } from "./schema-types";
import type { RawSchemaResponse } from "./schema-prompt";

/** Load a cached schema by fingerprint */
export async function loadSchema(fingerprint: string): Promise<StatementSchema | null> {
  const { data, error } = await supabase
    .from("statement_schemas")
    .select("*")
    .eq("fingerprint", fingerprint)
    .eq("confirmed", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    fingerprint: data.fingerprint,
    bank_name: data.bank_name,
    statement_type: data.statement_type,
    columns: data.columns as StatementSchema["columns"],
    amount_format: data.amount_format as "french" | "english",
    credit_marker: data.credit_marker ?? undefined,
    sections: data.sections as StatementSchema["sections"],
    continuation_pattern: data.continuation_pattern ?? undefined,
    skip_patterns: (data.skip_patterns as string[]) ?? [],
    multiline_rule: data.multiline_rule as StatementSchema["multiline_rule"],
    transfer_codes: (data.transfer_codes as string[]) ?? undefined,
    internal_transfer_pattern: data.internal_transfer_pattern ?? undefined,
    external_income_pattern: data.external_income_pattern ?? undefined,
    year_source: data.year_source as "header" | "inline",
    year_pattern: data.year_pattern ?? undefined,
    confirmed: data.confirmed,
    created_at: data.created_at,
  };
}

/**
 * Build a StatementSchema from the AI's raw response + computed fingerprint.
 * Does NOT save to DB — returns the in-memory schema for preview.
 */
export function buildSchema(
  raw: RawSchemaResponse,
  fingerprint: string,
): Omit<StatementSchema, "id" | "user_id" | "created_at"> {
  return {
    fingerprint,
    bank_name: raw.bank_name,
    statement_type: raw.statement_type,
    columns: raw.columns as StatementSchema["columns"],
    amount_format: raw.amount_format,
    credit_marker: raw.credit_marker,
    sections: raw.sections?.map((s) => ({
      header_pattern: s.header_pattern,
      parse: s.parse,
    })),
    continuation_pattern: raw.continuation_pattern,
    skip_patterns: raw.skip_patterns,
    multiline_rule: raw.multiline_rule,
    transfer_codes: raw.transfer_codes,
    internal_transfer_pattern: raw.internal_transfer_pattern,
    external_income_pattern: raw.external_income_pattern,
    year_source: raw.year_source,
    year_pattern: raw.year_pattern,
    confirmed: false,
  };
}

/** Save a confirmed schema to Supabase */
export async function saveSchema(
  schema: Omit<StatementSchema, "id" | "user_id" | "created_at">,
): Promise<StatementSchema> {
  const { data, error } = await supabase
    .from("statement_schemas")
    .upsert(
      {
        fingerprint: schema.fingerprint,
        bank_name: schema.bank_name,
        statement_type: schema.statement_type,
        columns: schema.columns,
        amount_format: schema.amount_format,
        credit_marker: schema.credit_marker ?? null,
        sections: schema.sections ?? null,
        continuation_pattern: schema.continuation_pattern ?? null,
        skip_patterns: schema.skip_patterns,
        multiline_rule: schema.multiline_rule ?? null,
        transfer_codes: schema.transfer_codes ?? null,
        internal_transfer_pattern: schema.internal_transfer_pattern ?? null,
        external_income_pattern: schema.external_income_pattern ?? null,
        year_source: schema.year_source,
        year_pattern: schema.year_pattern ?? null,
        confirmed: true,
      },
      { onConflict: "user_id,fingerprint" },
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as StatementSchema;
}
```

- [ ] **Step 2: Run type check**

Run: `vp check`

Expected: No errors.

- [ ] **Step 3: Commit**

```
feat: add schema store for Supabase CRUD operations
```

---

## Task 12: Rewrite `parsePdf` to Use Schema Pipeline

**Files:**

- Modify: `src/lib/parsers/pdf.ts`

- [ ] **Step 1: Remove hardcoded parsers and rewrite `parsePdf`**

Replace the entire `src/lib/parsers/pdf.ts` with:

```ts
// =============================================================================
// PDF Statement Parser — schema-based pipeline
//
// Architecture:
//   1. extractItems() (extract-items.ts) — pdfjs text extraction with positions
//   2. computeFingerprint() — structural hash for schema cache lookup
//   3. Schema pipeline: cached schema → column parser, or AI detect → confirm
//   4. validateTransactions() — post-parse sanity checks
// =============================================================================

import type { ParseResult, ParsedTransaction, ValidatedTransaction } from "./types";
import type { TextItem, StatementSchema } from "./schema-types";
import { extractItems, groupItemsIntoLines } from "./extract-items";
import { computeFingerprint } from "./fingerprint";
import { allowlistSanitize } from "./allowlist-sanitizer";
import { loadSchema, buildSchema, saveSchema } from "./schema-store";
import { parseWithSchema } from "./column-parser";
import { validateTransactions } from "./validate";
import { getAIProvider } from "@/lib/ai";

// Re-export for backward compat (used by csv.ts path)
export { extractItems, groupItemsIntoLines };

/** Parse a French/English formatted amount string into a number */
export function parseAmount(raw: string): number {
  let s = raw.replace(/\s/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }

  return Math.abs(parseFloat(s));
}

/** Backward-compatible line extraction (used by CSV path) */
export async function extractLines(file: File): Promise<string[]> {
  const lineGroups = await extractItems(file);

  const lines: string[] = [];
  for (const group of lineGroups) {
    let line = "";
    for (let j = 0; j < group.length; j++) {
      const item = group[j];
      if (j > 0) {
        const prev = group[j - 1];
        const gap = item.x - (prev.x + prev.width);
        if (gap > 15) {
          line += "  ";
        } else if (gap > 2) {
          line += " ";
        }
      }
      line += item.text;
    }
    lines.push(line.trim());
  }

  return lines;
}

/**
 * Remove duplicate transactions within a single parse result.
 */
function deduplicateTransactions(txs: ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Set<string>();
  const result: ParsedTransaction[] = [];

  for (const tx of txs) {
    const normDesc = tx.description
      .toUpperCase()
      .replace(/\s{2,}/g, " ")
      .trim();
    const key = `${tx.date}|${tx.amount}|${tx.type}|${normDesc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tx);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Schema-based pipeline result (extends ParseResult with validation)
// ---------------------------------------------------------------------------

export interface SchemaParsePipelineResult {
  /** Whether a cached schema was used or new detection is needed */
  status: "cached" | "needs_detection";
  /** Set when status=cached: validated transactions ready for review */
  transactions?: ParsedTransaction[];
  /** Set when status=cached: validation result */
  validation?: {
    clean: ValidatedTransaction[];
    flagged: ValidatedTransaction[];
    unparseable: ValidatedTransaction[];
  };
  warnings: string[];
  /** Set when status=needs_detection: extracted items for schema pipeline */
  items?: TextItem[][];
  fullText?: string;
  fingerprint?: string;
  sanitizedSample?: string;
}

/**
 * Main PDF entry point. Returns either fully parsed results (cached schema)
 * or signals that schema detection is needed.
 */
export async function parsePdf(file: File): Promise<SchemaParsePipelineResult> {
  const items = await extractItems(file);
  const fullText = items.map((line) => line.map((i) => i.text).join(" ")).join("\n");
  const fingerprint = computeFingerprint(items);

  console.group("[pdf-parser] Schema pipeline");
  console.log(`${items.length} lines extracted, fingerprint: ${fingerprint}`);

  // Check for cached schema
  const cached = await loadSchema(fingerprint);

  if (cached) {
    console.log(`[pdf-parser] Cache hit: ${cached.bank_name} ${cached.statement_type}`);
    const result = parseWithSchema(items, fullText, cached);
    const deduped = deduplicateTransactions(result.transactions);
    const rawLines = items.map((line) => line.map((i) => i.text).join(" "));
    const validation = validateTransactions(deduped, rawLines);
    console.log(
      `[pdf-parser] ${deduped.length} transactions (${validation.clean.length} clean, ${validation.flagged.length} flagged, ${validation.unparseable.length} unparseable)`,
    );
    console.groupEnd();

    return {
      status: "cached",
      transactions: deduped,
      validation,
      warnings: result.warnings,
    };
  }

  // No cached schema — prepare for detection
  console.log("[pdf-parser] Cache miss, preparing for schema detection");
  const sanitizedSample = allowlistSanitize(items);
  console.log("[pdf-parser] Sanitized sample:\n", sanitizedSample);
  console.groupEnd();

  return {
    status: "needs_detection",
    items,
    fullText,
    fingerprint,
    sanitizedSample,
    warnings: [],
  };
}
```

- [ ] **Step 2: Run type check**

Run: `vp check`

Expected: May have errors in `use-import.ts` since `parsePdf` return type changed. Those will be fixed in Task 14. For now, verify no errors in the parser files themselves.

- [ ] **Step 3: Commit**

```
feat: rewrite parsePdf to use schema-based pipeline

Removes BankParser interface and all hardcoded parsers (desjardinsCC,
desjardinsChequing, genericParser). parsePdf now returns either
cached schema results or signals that AI detection is needed.
```

---

## Task 13: Multi-Step UI Components

**Files:**

- Create: `src/components/import/import-stepper.tsx`
- Create: `src/components/import/schema-detecting-card.tsx`
- Create: `src/components/import/schema-validation-card.tsx`
- Create: `src/components/import/validation-summary-card.tsx`
- Create: `src/components/import/unparseable-section.tsx`

- [ ] **Step 1: Create ImportStepper**

```tsx
// src/components/import/import-stepper.tsx
import { css } from "../../../styled-system/css";

export interface Step {
  label: string;
  status: "completed" | "active" | "pending";
}

interface ImportStepperProps {
  steps: Step[];
}

export function ImportStepper({ steps }: ImportStepperProps) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: "0",
        px: "2",
      })}
    >
      {steps.map((step, i) => (
        <div
          key={step.label}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0",
          })}
        >
          {/* Step circle + label */}
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "2",
            })}
          >
            <div
              className={css({
                w: "6",
                h: "6",
                rounded: "full",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "xs",
                fontWeight: "600",
                flexShrink: 0,
                transition: "all 200ms",
                ...(step.status === "completed" && {
                  bg: "teal.9",
                  color: "white",
                }),
                ...(step.status === "active" && {
                  bg: "teal.3",
                  color: "teal.11",
                  animation: "pulse 2s infinite",
                }),
                ...(step.status === "pending" && {
                  bg: "bg.subtle",
                  color: "fg.muted",
                }),
              })}
            >
              {step.status === "completed" ? "✓" : i + 1}
            </div>
            <span
              className={css({
                fontSize: "sm",
                fontWeight: step.status === "active" ? "600" : "400",
                color: step.status === "pending" ? "fg.muted" : "fg.default",
                whiteSpace: "nowrap",
              })}
            >
              {step.label}
            </span>
          </div>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              className={css({
                w: "8",
                h: "px",
                mx: "2",
                bg: step.status === "completed" ? "teal.9" : "border.subtle",
                transition: "background 200ms",
              })}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create SchemaDetectingCard**

```tsx
// src/components/import/schema-detecting-card.tsx
import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function SchemaDetectingCard() {
  return (
    <Card.Root>
      <Card.Body
        className={css({
          pt: "6",
          display: "flex",
          flexDir: "column",
          gap: "3",
          alignItems: "center",
          py: "12",
        })}
      >
        <Spinner size="lg" />
        <p className={css({ fontSize: "sm", color: "fg.muted" })}>
          Analyzing statement structure...
        </p>
        <p className={css({ fontSize: "xs", color: "fg.disabled" })}>
          This only happens once per bank format.
        </p>
      </Card.Body>
    </Card.Root>
  );
}
```

- [ ] **Step 3: Create SchemaValidationCard**

```tsx
// src/components/import/schema-validation-card.tsx
import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";
import * as Table from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ParsedTransaction } from "@/lib/parsers/types";

interface SchemaValidationCardProps {
  bankName: string;
  statementType: string;
  preview: ParsedTransaction[];
  onConfirm: () => void;
  onReject: () => void;
  isConfirming: boolean;
}

export function SchemaValidationCard({
  bankName,
  statementType,
  preview,
  onConfirm,
  onReject,
  isConfirming,
}: SchemaValidationCardProps) {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>
          New format detected: {bankName} {statementType}
        </Card.Title>
        <Card.Description>
          Verify that these sample transactions look correct before proceeding.
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <Table.Root>
          <Table.Head>
            <Table.Row>
              <Table.Header>Date</Table.Header>
              <Table.Header>Description</Table.Header>
              <Table.Header className={css({ textAlign: "right" })}>Amount</Table.Header>
              <Table.Header>Type</Table.Header>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {preview.map((tx, i) => (
              <Table.Row key={i}>
                <Table.Cell className={css({ whiteSpace: "nowrap", fontSize: "sm" })}>
                  {formatDate(tx.date)}
                </Table.Cell>
                <Table.Cell className={css({ fontSize: "sm" })}>{tx.description}</Table.Cell>
                <Table.Cell
                  className={css({
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: tx.type === "INCOME" ? "income" : "expense",
                    fontSize: "sm",
                  })}
                >
                  {tx.type === "INCOME" ? "+" : "−"}
                  {formatCurrency(tx.amount)}
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    size="sm"
                    variant="subtle"
                    className={css({
                      color: tx.type === "INCOME" ? "income" : "expense",
                      bg: tx.type === "INCOME" ? "income.muted" : "expense.muted",
                    })}
                  >
                    {tx.type === "INCOME" ? "Income" : "Expense"}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        <div className={css({ display: "flex", gap: "3", mt: "4" })}>
          <Button size="sm" onClick={onConfirm} loading={isConfirming}>
            These look correct
          </Button>
          <Button variant="outline" size="sm" onClick={onReject}>
            Something's wrong
          </Button>
        </div>
      </Card.Body>
    </Card.Root>
  );
}
```

- [ ] **Step 4: Create ValidationSummaryCard**

```tsx
// src/components/import/validation-summary-card.tsx
import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ValidationSummaryCardProps {
  bankName: string;
  statementType: string;
  totalCount: number;
  cleanCount: number;
  flaggedCount: number;
  unparseableCount: number;
  knownCount: number;
  pendingAiCount: number;
  onReviewAll: () => void;
  onShowFlaggedFirst: () => void;
}

export function ValidationSummaryCard({
  bankName,
  statementType,
  totalCount,
  cleanCount,
  flaggedCount,
  unparseableCount,
  knownCount,
  pendingAiCount,
  onReviewAll,
  onShowFlaggedFirst,
}: ValidationSummaryCardProps) {
  return (
    <Card.Root>
      <Card.Body className={css({ pt: "6" })}>
        <p className={css({ fontSize: "sm", fontWeight: "600", color: "fg.default", mb: "3" })}>
          Parsed {totalCount} transactions from {bankName} {statementType}
        </p>

        <div className={css({ display: "flex", flexDir: "column", gap: "1.5", mb: "4" })}>
          {knownCount > 0 && (
            <SummaryLine icon="●" color="teal.11">
              {knownCount} auto-categorized (known merchants)
            </SummaryLine>
          )}
          {pendingAiCount > 0 && (
            <SummaryLine icon="●" color="fg.muted">
              {pendingAiCount} pending AI categorization
            </SummaryLine>
          )}
          {flaggedCount > 0 && (
            <SummaryLine icon="⚠" color="expense">
              {flaggedCount} flagged — amounts need verification
            </SummaryLine>
          )}
          {unparseableCount > 0 && (
            <SummaryLine icon="✕" color="fg.disabled">
              {unparseableCount} row{unparseableCount > 1 ? "s" : ""} could not be parsed
            </SummaryLine>
          )}
        </div>

        <div className={css({ display: "flex", gap: "3" })}>
          <Button size="sm" onClick={onReviewAll}>
            Review all
          </Button>
          {flaggedCount > 0 && (
            <Button variant="outline" size="sm" onClick={onShowFlaggedFirst}>
              Show flagged first
            </Button>
          )}
        </div>
      </Card.Body>
    </Card.Root>
  );
}

function SummaryLine({
  icon,
  color,
  children,
}: {
  icon: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className={css({ display: "flex", alignItems: "center", gap: "2", fontSize: "sm" })}>
      <span className={css({ color, flexShrink: 0 })}>{icon}</span>
      <span className={css({ color: "fg.default" })}>{children}</span>
    </div>
  );
}
```

- [ ] **Step 5: Create UnparseableSection**

```tsx
// src/components/import/unparseable-section.tsx
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ValidatedTransaction } from "@/lib/parsers/types";

interface UnparseableSectionProps {
  rows: ValidatedTransaction[];
}

export function UnparseableSection({ rows }: UnparseableSectionProps) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  return (
    <div className={css({ mt: "2" })}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "2",
          fontSize: "sm",
          color: "fg.muted",
          cursor: "pointer",
          bg: "transparent",
          border: "none",
          p: "0",
          _hover: { color: "fg.default" },
        })}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {rows.length} row{rows.length > 1 ? "s" : ""} could not be parsed
      </button>

      {open && (
        <div
          className={css({
            mt: "2",
            display: "flex",
            flexDir: "column",
            gap: "1",
          })}
        >
          {rows.map((row, i) => (
            <div
              key={i}
              className={css({
                px: "3",
                py: "2",
                bg: "bg.subtle",
                rounded: "md",
                fontSize: "xs",
                fontFamily: "mono",
                color: "fg.muted",
              })}
            >
              <span className={css({ color: "fg.disabled", mr: "2" })}>{row.parseError}:</span>
              {row.rawLine}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run type check**

Run: `vp check`

Expected: No errors in the new component files.

- [ ] **Step 7: Commit**

```
feat: add multi-step import UI components

ImportStepper, SchemaDetectingCard, SchemaValidationCard,
ValidationSummaryCard, UnparseableSection
```

---

## Task 14: Update `useImport` Hook for Schema Pipeline

**Files:**

- Modify: `src/hooks/use-import.ts`

This is the core wiring task. The hook needs new statuses, schema detection flow, validation pass, and confirmation/rejection actions.

- [ ] **Step 1: Update ImportStatus and add schema state**

Replace the `ImportStatus` type and add new state variables. The full updated hook is large, so here are the key changes:

Update the type:

```ts
export type ImportStatus =
  | "idle"
  | "parsing"
  | "schema_detecting" // AI analyzing format
  | "schema_validating" // user confirming sample rows
  | "mapping" // CSV column mapping (existing)
  | "reviewing"
  | "importing"
  | "done";
```

Add new fields to `ReviewItem`:

```ts
export interface ReviewItem {
  id: string;
  date: string;
  description: string;
  displayName: string;
  sanitizedDescription: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category_id: string | null;
  confidence: "high" | "medium" | "low" | "known";
  status: "pending" | "accepted" | "skipped";
  aiStatus: "waiting" | "analyzing" | "done" | "skipped";
  duplicate: DuplicateMatch | null;
  suggestedCategory?: string;
  warnings: string[]; // NEW: validation warnings
  rawLine?: string; // NEW: original PDF line
  parseError?: string; // NEW: unparseable reason
  transferType?: "internal" | "external-income" | null; // NEW
}
```

- [ ] **Step 2: Add schema state and detection flow**

Inside the `useImport` hook function, add:

```ts
// Schema detection state
const [schemaPreview, setSchemaPreview] = useState<ParsedTransaction[] | null>(null);
const [detectedSchema, setDetectedSchema] = useState<Omit<
  StatementSchema,
  "id" | "user_id" | "created_at"
> | null>(null);
const [schemaItems, setSchemaItems] = useState<TextItem[][] | null>(null);
const [schemaFullText, setSchemaFullText] = useState<string | null>(null);
const [validationResult, setValidationResult] = useState<{
  clean: ValidatedTransaction[];
  flagged: ValidatedTransaction[];
  unparseable: ValidatedTransaction[];
} | null>(null);
const [flaggedFirst, setFlaggedFirst] = useState(false);
```

Add the imports at the top:

```ts
import { parsePdf, type SchemaParsePipelineResult } from "@/lib/parsers/pdf";
import { parseWithSchema } from "@/lib/parsers/column-parser";
import { validateTransactions } from "@/lib/parsers/validate";
import { buildSchema, saveSchema } from "@/lib/parsers/schema-store";
import { getAIProvider } from "@/lib/ai";
import type { TextItem, StatementSchema } from "@/lib/parsers/schema-types";
import type { ValidatedTransaction } from "@/lib/parsers/types";
```

- [ ] **Step 3: Rewrite the PDF branch of `handleFile`**

```ts
if (ext === "pdf") {
  setStatus("parsing");
  try {
    const result = await parsePdf(file);
    setWarnings(result.warnings);

    if (result.status === "cached") {
      // Fast path: schema already cached and confirmed
      if (!result.transactions || result.transactions.length === 0) {
        setError("No transactions found in the PDF.");
        setStatus("idle");
        return;
      }
      setValidationResult(result.validation ?? null);
      await processTransactions(result.transactions);
    } else {
      // Slow path: need schema detection
      setSchemaItems(result.items ?? null);
      setSchemaFullText(result.fullText ?? null);

      setStatus("schema_detecting");
      const ai = getAIProvider();
      const rawSchema = await ai.detectSchema(result.sanitizedSample!);

      if (!rawSchema) {
        setError("Failed to detect statement format. Try a different file.");
        setStatus("idle");
        return;
      }

      const schema = buildSchema(rawSchema, result.fingerprint!);
      setDetectedSchema(schema);

      // Preview: parse first 5 rows for validation
      const preview = parseWithSchema(
        result.items!,
        result.fullText!,
        { ...schema, id: "", user_id: "", created_at: "" } as StatementSchema,
        { limit: 5 },
      );
      setSchemaPreview(preview.transactions);
      setStatus("schema_validating");
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to parse PDF");
    setStatus("idle");
  }
}
```

- [ ] **Step 4: Add confirmSchema and rejectSchema actions**

```ts
const confirmSchema = useCallback(async () => {
  if (!detectedSchema || !schemaItems || !schemaFullText) return;

  try {
    // Save schema to Supabase
    const saved = await saveSchema(detectedSchema);

    // Re-parse full statement with confirmed schema
    setStatus("parsing");
    const fullSchema = {
      ...detectedSchema,
      id: saved.id,
      user_id: saved.user_id,
      created_at: saved.created_at,
    } as StatementSchema;
    const result = parseWithSchema(schemaItems, schemaFullText, fullSchema);
    const rawLines = schemaItems.map((line) => line.map((i) => i.text).join(" "));
    const validation = validateTransactions(result.transactions, rawLines);
    setValidationResult(validation);

    const allTx = [...validation.clean, ...validation.flagged];
    if (allTx.length === 0) {
      setError("No transactions found after parsing with detected schema.");
      setStatus("idle");
      return;
    }

    setWarnings(result.warnings);
    await processTransactions(allTx);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to save schema");
    setStatus("idle");
  }
}, [detectedSchema, schemaItems, schemaFullText]);

const rejectSchema = useCallback(() => {
  setDetectedSchema(null);
  setSchemaPreview(null);
  setSchemaItems(null);
  setSchemaFullText(null);
  setStatus("idle");
}, []);
```

- [ ] **Step 5: Update the `processTransactions` function to handle warnings/flags on ReviewItem**

In the `processTransactions` function, when building `ReviewItem` from each `ParsedTransaction`, add the new fields:

```ts
const item: ReviewItem = {
  // ... existing fields ...
  warnings: (tx as ValidatedTransaction).warnings ?? [],
  rawLine: (tx as ValidatedTransaction).rawLine,
  parseError: (tx as ValidatedTransaction).parseError,
  transferType: tx.transferType ?? null,
};
```

For items with `transferType === "internal"`, default status to `"skipped"`:

```ts
if (tx.transferType === "internal") {
  item.status = "skipped";
  item.aiStatus = "skipped";
}
```

- [ ] **Step 6: Update the return value to include new state and actions**

```ts
return {
  status,
  items,
  warnings,
  error,
  progress,
  csvHeaders,
  handleFile,
  handleCsvMapping,
  updateItem,
  acceptAll,
  commit,
  reset,
  // New schema pipeline returns
  schemaPreview,
  detectedSchema,
  validationResult,
  confirmSchema,
  rejectSchema,
  flaggedFirst,
  setFlaggedFirst,
};
```

Also update `reset` to clear schema state:

```ts
const reset = useCallback(() => {
  abortRef.current = true;
  setStatus("idle");
  setItems([]);
  setWarnings([]);
  setError(null);
  setProgress(0);
  setCsvHeaders([]);
  setCsvRows([]);
  setDetectedSchema(null);
  setSchemaPreview(null);
  setSchemaItems(null);
  setSchemaFullText(null);
  setValidationResult(null);
  setFlaggedFirst(false);
}, []);
```

- [ ] **Step 7: Run type check**

Run: `vp check`

Expected: No errors (may surface errors in `import.tsx` which gets updated in Task 15).

- [ ] **Step 8: Commit**

```
feat: update useImport hook with schema detection pipeline

Adds schema_detecting / schema_validating statuses, AI schema
detection flow, post-parse validation, confirmSchema/rejectSchema
actions, and transfer detection support.
```

---

## Task 15: Wire Up Import Page with New Components

**Files:**

- Modify: `src/routes/import.tsx`

- [ ] **Step 1: Import new components and update hook destructuring**

Add imports:

```tsx
import { ImportStepper, type Step } from "@/components/import/import-stepper";
import { SchemaDetectingCard } from "@/components/import/schema-detecting-card";
import { SchemaValidationCard } from "@/components/import/schema-validation-card";
import { ValidationSummaryCard } from "@/components/import/validation-summary-card";
```

Update the `useImport` destructuring:

```tsx
const {
  status,
  items,
  warnings,
  error,
  progress,
  csvHeaders,
  handleFile,
  handleCsvMapping,
  updateItem,
  acceptAll,
  commit,
  reset,
  schemaPreview,
  detectedSchema,
  validationResult,
  confirmSchema,
  rejectSchema,
  flaggedFirst,
  setFlaggedFirst,
} = useImport(allCategories, groups, mappings);
```

- [ ] **Step 2: Add stepper computation and render**

Add a stepper steps computation above the JSX return:

```tsx
// Compute stepper steps based on current status
const needsSchemaDetection =
  status === "schema_detecting" || status === "schema_validating" || detectedSchema !== null;

const stepperSteps: Step[] = (() => {
  const isFirstTime =
    needsSchemaDetection || status === "schema_detecting" || status === "schema_validating";

  if (isFirstTime) {
    const s = status;
    return [
      {
        label: "Extract",
        status: s === "parsing" ? "active" : s === "idle" ? "pending" : "completed",
      },
      {
        label: "Detect format",
        status:
          s === "schema_detecting"
            ? "active"
            : s === "schema_validating" || s === "reviewing" || s === "importing" || s === "done"
              ? "completed"
              : "pending",
      },
      {
        label: "Confirm format",
        status:
          s === "schema_validating"
            ? "active"
            : s === "reviewing" || s === "importing" || s === "done"
              ? "completed"
              : "pending",
      },
      {
        label: "Review",
        status:
          s === "reviewing"
            ? "active"
            : s === "importing" || s === "done"
              ? "completed"
              : "pending",
      },
      {
        label: "Import",
        status: s === "importing" ? "active" : s === "done" ? "completed" : "pending",
      },
    ];
  }

  return [
    {
      label: "Extract",
      status: status === "parsing" ? "active" : status === "idle" ? "pending" : "completed",
    },
    {
      label: "Review",
      status:
        status === "reviewing"
          ? "active"
          : status === "importing" || status === "done"
            ? "completed"
            : "pending",
    },
    {
      label: "Import",
      status: status === "importing" ? "active" : status === "done" ? "completed" : "pending",
    },
  ];
})();
```

- [ ] **Step 3: Add stepper and new status rendering to the JSX**

After the page header and before the idle status block, render the stepper when not idle:

```tsx
{
  /* Stepper — shown during active import */
}
{
  status !== "idle" && <ImportStepper steps={stepperSteps} />;
}
```

Add new status blocks after the parsing block:

```tsx
{
  /* Schema detecting: AI analyzing format */
}
{
  status === "schema_detecting" && <SchemaDetectingCard />;
}

{
  /* Schema validating: user confirms sample rows */
}
{
  status === "schema_validating" && schemaPreview && detectedSchema && (
    <SchemaValidationCard
      bankName={detectedSchema.bank_name}
      statementType={detectedSchema.statement_type}
      preview={schemaPreview}
      onConfirm={confirmSchema}
      onReject={rejectSchema}
      isConfirming={false}
    />
  );
}
```

- [ ] **Step 4: Run type check**

Run: `vp check`

Expected: No errors.

- [ ] **Step 5: Commit**

```
feat: wire import page to schema detection pipeline

Adds ImportStepper, SchemaDetectingCard, SchemaValidationCard
to the import route. Stepper adapts to first-time vs cached flow.
```

---

## Task 16: Review Table — Flagged Row Styling + Inline Editing

**Files:**

- Modify: `src/components/import/review-table.tsx`

This task adds flagged row visual treatment and inline editing for all fields. This is the most complex UI change.

- [ ] **Step 1: Add warnings to ReviewItem imports and update the AnimatedRow for flagged styling**

In the `AnimatedRow` component, add amber left border for flagged rows. After the `rowBg` declaration:

```tsx
const isFlagged = item.warnings && item.warnings.length > 0;
```

Update the `<tr>` style to include flagged styling:

```tsx
...(isFlagged && {
  boxShadow: "inset 3px 0 0 0 var(--colors-orange-8)",
}),
```

- [ ] **Step 2: Add warning badge display in the description cell**

After the duplicate warning in the description `<Table.Cell>`, add:

```tsx
{
  isFlagged &&
    item.warnings.map((w, wi) => (
      <div
        key={wi}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "1",
          mt: "0.5",
        })}
      >
        <AlertTriangle size={12} className={css({ color: "orange.9" })} />
        <span className={css({ fontSize: "xs", color: "orange.11" })}>{w}</span>
      </div>
    ));
}
```

- [ ] **Step 3: Add inline editing state to AnimatedRow**

Add state for which field is being edited:

```tsx
const [editingField, setEditingField] = useState<"name" | "amount" | "date" | null>(null);
const [editValue, setEditValue] = useState("");
```

Add a save handler:

```tsx
const handleSaveEdit = () => {
  if (!editingField) return;

  if (editingField === "name" && editValue.trim()) {
    onUpdateItem(item.id, { displayName: editValue.trim() });
  } else if (editingField === "amount") {
    const num = parseFloat(editValue);
    if (!isNaN(num) && num > 0) {
      onUpdateItem(item.id, { amount: num, warnings: [] });
    }
  } else if (editingField === "date" && editValue) {
    onUpdateItem(item.id, { date: editValue });
  }

  setEditingField(null);
};

const handleCancelEdit = () => {
  setEditingField(null);
};

const handleEditKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleSaveEdit();
  } else if (e.key === "Escape") {
    e.preventDefault();
    handleCancelEdit();
  } else if (e.key === "Tab") {
    e.preventDefault();
    handleSaveEdit();
  }
  e.stopPropagation();
};
```

- [ ] **Step 4: Make display name cell editable**

Replace the display name `<span>` in the description cell with:

```tsx
{
  editingField === "name" ? (
    <input
      autoFocus
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleEditKeyDown}
      onBlur={handleSaveEdit}
      className={css({
        fontSize: "sm",
        fontWeight: "500",
        bg: "transparent",
        border: "none",
        outline: "none",
        w: "full",
        p: "0",
        color: "fg.default",
      })}
    />
  ) : (
    <span
      key={`dn-${item.id}-${displayNameAnimKey}`}
      onClick={(e) => {
        e.stopPropagation();
        setEditingField("name");
        setEditValue(item.displayName);
      }}
      className={css({
        display: "block",
        fontSize: "sm",
        fontWeight: "500",
        cursor: "text",
        ...(displayNameAnimKey > 0 && {
          animation: "slide-fade-in-y 200ms ease-out",
        }),
      })}
    >
      {item.displayName}
    </span>
  );
}
```

- [ ] **Step 5: Make amount cell editable**

Replace the amount `<Table.Cell>` content with:

```tsx
<Table.Cell
  className={css({
    textAlign: "right",
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    color: item.type === "INCOME" ? "income" : "expense",
    cursor: "text",
  })}
  onClick={(e) => {
    e.stopPropagation();
    setEditingField("amount");
    setEditValue(String(item.amount));
  }}
>
  {editingField === "amount" ? (
    <input
      autoFocus
      type="number"
      step="0.01"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleEditKeyDown}
      onBlur={handleSaveEdit}
      className={css({
        fontSize: "sm",
        bg: "transparent",
        border: "none",
        outline: "none",
        w: "20",
        p: "0",
        textAlign: "right",
        color: item.type === "INCOME" ? "income" : "expense",
      })}
    />
  ) : (
    <>
      {item.type === "INCOME" ? "+" : "−"}
      {formatCurrency(item.amount)}
    </>
  )}
</Table.Cell>
```

- [ ] **Step 6: Add type toggle on the badge (Income/Expense)**

This doesn't need a full edit field — just a click handler on the amount prefix or a badge. Add a type toggle badge in the amount or a new column. Simplest: clicking the type prefix toggles it.

In the amount cell, when not editing, wrap the type prefix in a clickable span:

```tsx
<span
  onClick={(e) => {
    e.stopPropagation();
    onUpdateItem(item.id, {
      type: item.type === "INCOME" ? "EXPENSE" : "INCOME",
    });
  }}
  className={css({ cursor: "pointer", _hover: { opacity: 0.7 } })}
>
  {item.type === "INCOME" ? "+" : "−"}
</span>
```

- [ ] **Step 7: Update stats bar to include flagged count**

In the `ReviewTable` component stats section, add after `pending`:

```tsx
{
  (() => {
    const flaggedCount = items.filter((i) => i.warnings && i.warnings.length > 0).length;
    return flaggedCount > 0 ? (
      <span className={css({ fontSize: "sm", color: "orange.11" })}>{flaggedCount} flagged</span>
    ) : null;
  })();
}
```

- [ ] **Step 8: Add AnimatedRow props for warnings**

Update the `AnimatedRowProps` interface to ensure `item` already has `warnings` through the `ReviewItem` type. No interface change needed — `ReviewItem` already has `warnings` from Task 14.

- [ ] **Step 9: Run type check**

Run: `vp check`

Expected: No errors.

- [ ] **Step 10: Commit**

```
feat: add flagged row styling and inline editing to review table

Flagged rows get amber left border + warning badges.
All fields (name, amount, type) are click-to-edit inline.
Type toggles on click. Stats bar shows flagged count.
```

---

## Task 17: Integration — Smoke Test the Full Flow

**Files:** None created — this is a manual verification task.

- [ ] **Step 1: Run type check on entire project**

Run: `vp check`

Fix any remaining type errors across the codebase.

- [ ] **Step 2: Run all tests**

Run: `vp test`

Expected: All parser tests pass.

- [ ] **Step 3: Start dev server**

Run: `vp dev`

Expected: App compiles and loads without errors. Navigate to the import page — it should show the file upload component.

- [ ] **Step 4: Verify no lint errors**

Run: `vp lint .`

Fix any lint errors.

- [ ] **Step 5: Commit any fixes**

```
fix: resolve type and lint issues from schema parser integration
```

---

## Appendix: Task Dependency Graph

```
Task 1 (Migration) ─────────────────────────────────────┐
Task 2 (Schema Types) ──┬──────────────────────────────┐ │
Task 3 (Parser Types) ──┤                              │ │
                         ├─ Task 4 (extractItems)       │ │
                         ├─ Task 5 (fingerprint)        │ │
                         ├─ Task 6 (allowlist sanitizer) │ │
                         ├─ Task 7 (schema prompt) ──┐  │ │
                         │                           ├── Task 8 (AI providers)
                         ├─ Task 9 (column parser)   │  │ │
                         └─ Task 10 (validation)     │  │ │
                                                     │  │ │
Task 11 (schema store) ─────────────────────────────┘  │ │
                                                        │ │
Task 12 (rewrite parsePdf) ◄────── Tasks 4-11 ─────────┘ │
                                                           │
Task 13 (UI components) ◄─────────────────────────────────┤
                                                           │
Task 14 (useImport hook) ◄──── Tasks 12, 13 ──────────────┤
                                                           │
Task 15 (import page) ◄──── Task 14 ──────────────────────┘
Task 16 (review table) ◄──── Task 14
Task 17 (integration) ◄──── Tasks 15, 16
```

Tasks 1-3 can run in parallel. Tasks 4-11 can mostly run in parallel (4-6 are independent; 7→8 is sequential; 9-10 are independent). Tasks 12-17 are sequential.
