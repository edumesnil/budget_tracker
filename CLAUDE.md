# CLAUDE.md

## Commands

```bash
vp dev                 # Dev server (Vite+)
vp build               # Production build (runs tsc -b first via script)
vp check               # Format + lint + type checks
vp lint .              # Oxlint only
vp fmt                 # Oxfmt only
vp test                # Vitest (no test files yet)
supabase start         # Local Supabase (must be running)
npx panda codegen --clean  # Regenerate styled-system after config changes
```

No test files configured yet. Node version managed via `.node-version` (22).

## Architecture

Vite+ SPA with React Router v7 and client-side Supabase. No SSR, no API routes. All data access via Supabase RLS from the browser.

### Stack

- **Build:** Vite+ — unified toolchain (Vite 8, Oxlint, Oxfmt, Vitest)
- **Framework:** React 19, TypeScript
- **Router:** React Router v7 (flat SPA routing)
- **Styling:** Panda CSS (zero-runtime, build-time static CSS)
- **Components:** Park UI (Ark UI primitives + Panda CSS recipes)
- **Database/Auth:** Supabase (PostgreSQL + Auth, local via CLI)
- **State:** TanStack React Query v5
- **Forms:** react-hook-form + Zod
- **Charts:** Recharts

### Project Structure

```
src/
  routes/          # Page components (_layout.tsx, dashboard.tsx, etc.)
  components/
    ui/            # Park UI components (installed via CLI, DO NOT manually edit)
    dashboard/     # Dashboard feature components
    transactions/  # Transaction feature components
    budgets/       # Budget feature components
    categories/    # Category feature components
    import/        # Import pipeline components (file-upload, review-table, column-mapper)
  hooks/           # One hook per entity (use-transactions.ts, etc.)
  lib/
    parsers/       # PDF and CSV statement parsers (bank-specific + generic)
    ai.ts          # LLM adapter (Groq, Gemini, Ollama providers)
    sanitizer.ts   # PII stripping before LLM calls
    supabase.ts    # Supabase client
    query-client.ts
    utils.ts
  types/           # database.ts (single source of truth)
  theme/           # Panda CSS theme (recipes, tokens, conditions, globalCss)
styled-system/     # Panda CSS generated output (gitignored, regenerate with codegen)
panda.config.ts    # Design tokens, recipes, presets
```

### Database Schema (7 tables)

users, category_groups, categories, transactions, budgets, account_snapshots, merchant_mappings. All with RLS. Types in `types/database.ts`.

### Feature Organization

Each feature follows: route in `routes/<feature>.tsx`, components in `components/<feature>/`, data hook in `hooks/use-<feature>.ts`.

### Import Pipeline

PDF/CSV bank statement import with AI-assisted categorization. Architecture:

```
File upload → Parser (bank-specific) → PII sanitizer → Merchant lookup →
  Known merchants: auto-categorized from merchant_mappings table
  Unknown merchants: sent to LLM (sanitized descriptions only) →
    LLM returns: category ID + clean display name →
      Keyboard-driven batch review → Commit to DB + save new mappings
```

Key files:

- `lib/parsers/pdf.ts` — pdfjs text extraction + pluggable `BankParser` interface (Desjardins CC, generic fallback)
- `lib/parsers/csv.ts` — generic CSV parser with auto-detect + manual column mapping
- `lib/sanitizer.ts` — strips PII before LLM sees data
- `lib/ai.ts` — `AIProvider` interface with Groq, Gemini, Ollama providers. Auto-selects from env vars
- `hooks/use-import.ts` — orchestrates the full import flow
- `hooks/use-merchant-mappings.ts` — CRUD for merchant→category mappings

AI provider priority: `VITE_GROQ_API_KEY` → `VITE_GEMINI_API_KEY` → Ollama (localhost). The prompt uses numeric category IDs (not names) to avoid accent/spelling mismatches.

## Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GROQ_API_KEY          # Groq (free tier, recommended)
VITE_GEMINI_API_KEY         # Google Gemini (free tier, alternative)
# If neither is set, falls back to Ollama on localhost:11434
```

## Park UI Component Rules

These rules are non-negotiable. Every UI element must use Park UI components correctly.

### Before using ANY Park UI component

Read the component source in `src/components/ui/<component>.tsx` AND its recipe in `src/theme/recipes/<component>.ts` to understand what parts exist and what styling the recipe already provides. Do not guess APIs.

### Form fields — always use Field component

```tsx
import * as Field from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Correct
<Field.Root invalid={!!errors.name}>
  <Field.Label>Name</Field.Label>
  <Input {...register('name')} />
  <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
</Field.Root>

// WRONG — never do this
<div>
  <label className={css(...)}>Name</label>
  <Input />
  <p className={css(...)}>error</p>
</div>
```

- Input is `styled(Field.Input)` — it must be inside `Field.Root` for focus ring to work
- `Field.Label` auto-connects to Field.Input (no htmlFor/id needed)
- `Field.ErrorText` shows only when `Field.Root` has `invalid={true}`
- For Controller-based fields (Select, Checkbox, RadioGroup): wrap in `Field.Root` + `Field.Label`, keep Controller inside

### Cards — padding rules

Card.Body recipe: `pb: '6', px: '6'` (NO top padding). Card.Header: `p: '6'` (all sides).

- If Card.Body follows Card.Header → no extra padding needed
- If Card.Body has NO Card.Header above it → add `className={css({ pt: '6' })}`

### Tables — let the recipe work

The table recipe provides: cell padding, font size, color, border separators (via box-shadow), header styling.

```tsx
// Correct — recipe handles everything
<Table.Root interactive>  {/* interactive = hover rows */}
  <Table.Head>
    <Table.Row>
      <Table.Header>Date</Table.Header>
      <Table.Header className={css({ textAlign: 'right' })}>Amount</Table.Header>
    </Table.Row>
  </Table.Head>
  <Table.Body>
    <Table.Row>
      <Table.Cell>{date}</Table.Cell>
      <Table.Cell className={css({ textAlign: 'right' })}>{amount}</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table.Root>

// WRONG — duplicating recipe styling
<Table.Header className={css({ fontSize: 'xs', fontWeight: '600', px: '4', py: '2.5' })}>
<Table.Row className={css({ _hover: { bg: 'bg.subtle' } })}>
```

### Select compound component

```tsx
<Select.Root collection={collection} value={value} onValueChange={onChange}>
  <Select.Control>
    <Select.Trigger>
      <Select.ValueText placeholder="..." />
      <Select.Indicator /> {/* MUST be inside Trigger */}
    </Select.Trigger>
  </Select.Control>
  <Select.Positioner>
    <Select.Content>
      <Select.Item item={item}>
        <Select.ItemText>{label}</Select.ItemText>
        <Select.ItemIndicator />
      </Select.Item>
    </Select.Content>
  </Select.Positioner>
</Select.Root>
```

`Select.ItemGroupLabel` — recipe handles its styling. Do not add custom className.

### Forbidden patterns

| Never do this                                                                   | Do this instead                                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `border: '1px solid'` / `borderBottom` / `borderWidth` / `borderColor` in css() | Use Card.Root for containers. Table recipe handles cell borders. |
| `fontFamily: 'mono'`                                                            | Not a Park UI default. Remove.                                   |
| Raw `<label>` with custom CSS                                                   | `Field.Label` inside `Field.Root`                                |
| Raw `<p>` for field errors                                                      | `Field.ErrorText` inside `Field.Root`                            |
| Manual div with borderWidth for containers                                      | `Card.Root`                                                      |
| Custom className on Table.Header/Cell duplicating recipe                        | Let recipe handle it, only add truly custom props                |
| `border: 'none'` is OK on native buttons (removing browser default)             |                                                                  |

### Panda CSS globalCss token references

In `src/theme/global-css.ts`, token references MUST use curly braces:

```ts
// Correct
'--global-color-border': '{colors.border.subtle}'

// WRONG — outputs literal string
'--global-color-border': 'colors.border.subtle'
```

### Semantic colors for financial data

- Income: `color: 'income'`, bg: `'income.muted'`
- Expense: `color: 'expense'`, bg: `'expense.muted'`
- Use these for badges, amounts, status indicators

### Dark mode

Panda CSS `_dark` condition on semantic tokens. `dark` class on `<html>`. Managed by `hooks/use-theme.ts`. Default: light mode.
