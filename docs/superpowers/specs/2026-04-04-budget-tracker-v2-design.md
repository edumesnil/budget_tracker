# Budget Tracker v2 — Design Spec

## Context

Budget Tracker v1 was built ~1 year ago with v0 + early Claude. It accumulated significant technical debt:

- ~50+ components where 25 would suffice (3 duplicate form implementations, 2 duplicate tables, 2 incompatible category dialogs)
- Incomplete React Query migration (~80% done, dual legacy/query hooks running in parallel)
- 23 unused npm packages, 25 deps pinned to `"latest"`, bogus `"18": "^0.0.0"` dependency
- Build config silently ignores TypeScript and ESLint errors
- Dead test routes, comparison pages, debug utilities left in production code
- Next.js App Router used for what is a pure client-side SPA with no SSR needs

This spec defines a clean rewrite on a new branch, porting only what's worth keeping.

## Philosophy

**Prototype-first personal tool.** Optimize for iteration speed, not scale. Every file earns its place. No abstractions ahead of need. The app will evolve through exploration — the architecture must make adding/removing features cheap.

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Build | Vite+ (alpha) | Unified toolchain: Vite + Vitest + Oxlint + Oxfmt |
| UI Framework | React 19 | Latest stable |
| Router | React Router v7 | Simple flat SPA routing, mature ecosystem |
| Styling | Panda CSS | Zero-runtime CSS-in-JS, type-safe tokens, build-time static output |
| Components | Park UI (Ark UI primitives) | Styled component library on Ark UI/Zag.js state machines |
| Server State | TanStack React Query v5 | One hook per entity, clean implementation |
| Forms | react-hook-form + Zod | Proven combo, keep from v1 |
| Auth + DB | Supabase (local via CLI) | Postgres + Auth, local-only for now |
| Charts | Recharts | Adequate for financial visualization |
| PDF Parsing | pdf.js (future) | Client-side, no backend needed |
| AI | Ollama (local, future) behind adapter | Swappable to any provider later |

### Why Panda CSS over Tailwind

Park UI's Tailwind plugin (`@park-ui/tailwind-plugin@0.20.1`) is stale (2 years without update, incompatible with Tailwind v4). Park UI + Panda CSS is the first-class, actively maintained path. Panda CSS is zero-runtime (static CSS at build), utility-first (similar mental model to Tailwind), and type-safe (tokens, recipes, patterns all typed). The entire stack — Ark UI, Park UI, Panda CSS — is from the same team (Chakra UI), designed together.

## Project Structure

```
budget-tracker/
├── src/
│   ├── main.tsx                        # Entry point, renders App
│   ├── app.tsx                         # Router + providers (QueryClient, Auth)
│   ├── routes/
│   │   ├── _layout.tsx                 # Dashboard shell (sidebar, topbar, auth guard)
│   │   ├── index.tsx                   # Landing → redirect to login or dashboard
│   │   ├── login.tsx                   # Email/password login
│   │   ├── register.tsx                # Registration
│   │   ├── dashboard.tsx               # Financial overview
│   │   ├── transactions.tsx            # Transaction CRUD + table
│   │   ├── budgets.tsx                 # Budget management (monthly/annual)
│   │   └── categories.tsx              # Category CRUD
│   ├── components/
│   │   ├── ui/                         # Park UI components (installed via CLI, only what's used)
│   │   ├── dashboard/                  # 3-4 files: overview cards, spending chart, category performance
│   │   ├── transactions/               # 2-3 files: form dialog, table
│   │   ├── budgets/                    # 3-4 files: form dialog, table, chart
│   │   ├── categories/                 # 2-3 files: form dialog, list
│   │   └── import/                     # Placeholder for future statement upload + review UI
│   ├── hooks/
│   │   ├── use-auth.ts                 # Auth state, login/logout/register
│   │   ├── use-transactions.ts         # Queries + mutations for transactions
│   │   ├── use-budgets.ts              # Queries + mutations for budgets
│   │   ├── use-categories.ts           # Queries + mutations for categories + groups
│   │   ├── use-snapshots.ts            # Queries + mutations for account snapshots
│   │   └── use-import.ts              # Placeholder for PDF parse + AI categorize
│   ├── lib/
│   │   ├── supabase.ts                 # Client singleton
│   │   ├── query-client.ts             # React Query config (staleTime 30s, gcTime 5m)
│   │   ├── ai.ts                       # LLM adapter interface (Ollama default, swappable)
│   │   └── utils.ts                    # Minimal helpers
│   ├── types/
│   │   └── database.ts                 # Single source of truth for all DB types
│   └── styles/
│       └── globals.css                 # Panda CSS layers + any global overrides
├── supabase/
│   ├── config.toml                     # Local Supabase config
│   ├── migrations/
│   │   └── 001_initial_schema.sql      # Tables + RLS + indexes
│   └── seed.sql                        # Clean sample data
├── panda.config.ts                     # Design tokens, recipes, patterns, presets
├── index.html                          # SPA entry
├── vite.config.ts                      # Vite+ config
├── tsconfig.json
└── package.json                        # Pinned versions only
```

### Target: ~20-25 component files total

Down from 50+. One component per concern. Zero duplicates.

## Database Schema

Informed by the user's actual Google Sheets workflow (Budget.xlsx). The spreadsheet uses a two-level hierarchy: groups (MAISON, AUTO, NOURRITURE...) containing categories (Hypothèque, Gas, Épicerie...). The core view is Budget vs Réel (actual) per month, per category, aggregated by group. "Mensuel" sheet is the canonical budget template.

### Tables (7)

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,                  -- matches auth.users.id
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE category_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,                   -- "MAISON", "AUTO", "NOURRITURE", etc.
  icon text,
  color text,
  sort_order integer DEFAULT 0,         -- controls display order in budget view
  created_at timestamptz DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES category_groups(id) ON DELETE SET NULL,
  name text NOT NULL,                   -- "Hypothèque", "Gas", "Spotify"
  type text NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  color text,
  icon text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  description text,
  notes text,
  is_recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  is_recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_name text NOT NULL,           -- "CELI Desjardins", "REER Wealthsimple"
  account_type text NOT NULL CHECK (account_type IN ('CELI', 'REER', 'REEE', 'EMERGENCY', 'OTHER')),
  balance numeric NOT NULL,
  snapshot_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### Design Decisions

- **category_groups** — Matches the spreadsheet section headers (MAISON, AUTO, etc.). Groups don't receive transactions; they organize categories for display and subtotalling in the budget view.
- **categories.group_id** — Each category belongs to a group. Transactions and budgets reference categories, not groups. Views aggregate up to group level.
- **account_snapshots** — Simple manual entry for investment/emergency fund balances across banks. No automation — just punch in numbers when you check accounts. Dashboard shows latest balance per account + totals per type.
- **merchant_mappings** — Maps merchant names from bank statements to categories. Populated by AI categorization + user corrections. Grows over time so future imports need less AI assistance. See "Import Pipeline Design" section for details.
- Dropped `family_member` column (unused in v1 data)
- `month` constrained to `1-12` (v1 used `0` as a hack for recurring)
- `is_recurring` on budgets means "carry this amount forward to future months until changed" — matches how the spreadsheet template works
- Income sources (Eric, Maryse, Gouv Qc, Gouv Can) are modeled as categories in an income-type group, not special fields

### Row Level Security

All 6 tables get the same pattern:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_select" ON <table> FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "<table>_insert" ON <table> FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "<table>_update" ON <table> FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "<table>_delete" ON <table> FOR DELETE USING (auth.uid() = user_id);
```

### Indexes

```sql
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX idx_budgets_user_year_month ON budgets(user_id, year, month);
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_categories_group ON categories(group_id);
CREATE INDEX idx_snapshots_user_date ON account_snapshots(user_id, snapshot_date);
CREATE INDEX idx_merchant_mappings_user ON merchant_mappings(user_id);
```

## Data Layer

### One hook per entity

Each hook returns queries and mutations. No duplicates. No legacy/query split.

```typescript
// hooks/use-transactions.ts
export function useTransactions(month: number, year: number) {
  const query = useQuery({
    queryKey: ['transactions', { month, year }],
    queryFn: () => supabase
      .from('transactions')
      .select('*, categories(*)')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .order('date', { ascending: false }),
  })

  const create = useMutation({ ... })
  const update = useMutation({ ... })
  const remove = useMutation({ ... })

  // Derived data via useMemo
  const totals = useMemo(() => ..., [query.data])

  return { transactions: query.data, isLoading: query.isLoading, create, update, remove, totals }
}
```

### Mutation → UI Sync Strategy

v1 suffered from stale data on navigation, full table reloads, and cross-view desync. v2 fixes this with three layers:

**Layer 1 — Cache update from mutation response (default for create/update):**
Mutations return the updated row via `.select()`. The `onSuccess` handler uses `setQueryData` to surgically update the cached list — no refetch, no loading flash:

```typescript
onSuccess: (data) => {
  queryClient.setQueryData(['transactions', { month, year }], (old) =>
    old.map(t => t.id === data.id ? data : t)
  )
}
```

**Layer 2 — Optimistic updates (for delete and toggles):**
Remove/toggle actions update the cache *before* the server responds, with rollback on error:

```typescript
onMutate: async (id) => {
  await queryClient.cancelQueries({ queryKey: ['transactions', { month, year }] })
  const previous = queryClient.getQueryData(['transactions', { month, year }])
  queryClient.setQueryData(['transactions', { month, year }], (old) =>
    old.filter(t => t.id !== id)
  )
  return { previous }
},
onError: (err, id, ctx) => {
  queryClient.setQueryData(['transactions', { month, year }], ctx.previous)
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['transactions'] })
},
```

**Layer 3 — Cross-entity invalidation map:**
When one entity mutates, sibling queries that depend on it must refresh:

```
Category/Group mutated  → invalidate: categories, transactions, budgets, dashboard
Transaction mutated     → invalidate: transactions, dashboard
Budget mutated          → invalidate: budgets, dashboard
Snapshot mutated        → invalidate: snapshots, dashboard
Import batch confirmed  → invalidate: transactions, merchant_mappings, dashboard
```

**staleTime per entity:**

| Entity | staleTime | Behavior |
|---|---|---|
| Categories | 5 min | Rarely change, cached aggressively |
| Transactions | 0 | Always refetch on mount, but serve cache instantly while background fetch runs |
| Budgets | 1 min | Moderate cache |
| Dashboard | 0 | Composite view, always fresh |

With `staleTime: 0`, navigating to a page shows cached data immediately, then silently updates in the background if anything changed. No loading spinner, no blank screen.

### Other Patterns

- Queries fetch with joins where needed (`transactions` joins `categories`)
- Derived state (totals, grouped data) computed via `useMemo` in the hook
- No shared query-utils wrapper — each hook talks to Supabase directly

### Types

Single source of truth in `types/database.ts`:

```typescript
export interface User {
  id: string
  email: string
  created_at: string
}

export interface CategoryGroup {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  created_at: string
  categories?: Category[] // joined
}

export interface Category {
  id: string
  user_id: string
  group_id: string | null
  name: string
  type: 'INCOME' | 'EXPENSE'
  color: string | null
  icon: string | null
  created_at: string
  category_groups?: CategoryGroup // joined
}

export interface Transaction {
  id: string
  user_id: string
  category_id: string | null
  amount: number
  date: string
  description: string | null
  notes: string | null
  is_recurring: boolean
  created_at: string
  categories?: Category // joined
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  month: number
  year: number
  is_recurring: boolean
  created_at: string
  categories?: Category // joined
}

export interface AccountSnapshot {
  id: string
  user_id: string
  account_name: string
  account_type: 'CELI' | 'REER' | 'REEE' | 'EMERGENCY' | 'OTHER'
  balance: number
  snapshot_date: string
  created_at: string
}

export interface MerchantMapping {
  id: string
  user_id: string
  merchant_pattern: string
  category_id: string
  confidence: number
  created_at: string
  categories?: Category // joined
}
```

## Design Tokens (Panda CSS)

Port the existing HSL color system into Panda's token system:

```typescript
// panda.config.ts (simplified)
export default defineConfig({
  theme: {
    extend: {
      tokens: {
        colors: {
          income: { value: 'hsl(174, 60%, 35%)' },      // teal
          expense: { value: 'hsl(355, 70%, 55%)' },      // red
          // ... rest of financial semantic colors
        },
      },
      semanticTokens: {
        colors: {
          bg: {
            DEFAULT: { value: { base: '{colors.white}', _dark: 'hsl(196, 30%, 10%)' } },
          },
          fg: {
            DEFAULT: { value: { base: 'hsl(196, 30%, 10%)', _dark: 'hsl(90, 30%, 90%)' } },
          },
          // ... light/dark mode mappings
        },
      },
    },
  },
})
```

## Dark Mode

v1 used `next-themes` (Next.js-specific). In v2:

- Panda CSS handles dark mode via `_dark` condition on semantic tokens
- A `dark` class on the `<html>` element toggles the mode
- A small `use-theme.ts` hook (or inline in the topbar) manages the toggle and persists preference in `localStorage`
- No external library needed — it's just a class toggle + storage read on mount

## Auth Flow

- Supabase email/password auth
- `use-auth.ts` hook manages session state via `onAuthStateChange`
- `_layout.tsx` (dashboard shell) checks auth and redirects to `/login` if unauthenticated
- Auth callback handled client-side (no server route needed for email/password)
- Session persists in localStorage

## Primary View: Dashboard

The dashboard has two honest states based on data freshness. It never shows stale actuals as if they were current.

### Pre-import state (most of the month)

The user typically imports bank statements once a month. Between imports, the dashboard shows what it actually knows:

- **Budget plan** — fixed/recurring expenses (mortgage, insurance, subscriptions) shown as committed. Variable budgets (Épicerie, Restaurants, Autre) shown as "available to spend."
- **Last import date** — visible, not hidden. "Last import: March 2"
- **Import prompt** — "Upload April statement when ready." Not buried in a menu.
- **Net worth snapshot** — investment/emergency fund totals, last updated date, "update" button
- **Quick-add** — button to log notable expenses immediately (dentist visit, big purchase). Not required, but useful for users who want mid-month budget awareness. These manually-added transactions reduce the "available to spend" in their category.

### Post-import state (after statement upload)

After importing a statement, the dashboard switches to review mode:

- **Monthly surplus/deficit** — the one number that matters, big and clear
- **Group-level budget health** — visual cards for each group (MAISON, AUTO, NOURRITURE...), each with a progress bar showing budgeted vs actual, color-coded (within/approaching/over budget). Click to drill into individual categories.
- **Month-over-month trend** — 6-month spending trend line, income vs expenses
- **AUTRE breakdown** — irregular expenses get special attention since they're the hardest to predict
- **Net worth snapshot** — same as pre-import state

### Other views

- **Budget** — set monthly budget amounts per category, organized by group. Supports recurring (carry forward to future months) and one-time overrides per month.
- **Transactions** — filterable list, manual quick-add form, and the import review UI
- **Categories** — manage groups and categories
- **Import** — upload bank statements (PDF/CSV), AI-categorized review, batch confirm
- **Year overview** — secondary analytical view showing the full year of budget vs actual data. Not a raw spreadsheet table — designed as a digestible summary. Could be a heatmap of over/under budget by category/month, sparklines per category showing monthly progression, or collapsible group sections with yearly totals. Exact presentation to be explored during prototyping. The data is there (budgets + transactions by month); this is a visualization challenge, not a data challenge.

## Import Pipeline Design

The import pipeline is the core workflow that eliminates manual transaction entry. Architecture designed around three concepts:

### 1. Merchant memory (gets smarter with use)

When the AI categorizes a transaction, save the merchant→category mapping. Next import, known merchants are auto-categorized without calling the LLM. Over time, 80%+ of transactions are handled by the mapping table; the AI becomes a fallback for new merchants only.

```sql
CREATE TABLE merchant_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_pattern text NOT NULL,     -- "METRO PLUS", "SPOTIFY", "SHELL"
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence numeric DEFAULT 1.0,     -- 1.0 = user confirmed, <1.0 = AI suggested
  created_at timestamptz DEFAULT now()
);
```

### 2. Batch review UX

The import review screen is optimized for speed, not for forms. Keyboard-driven:
- List of transactions, each with a suggested category
- Arrow keys to navigate, Enter to accept, Tab to change category, D to skip
- Process 50 transactions in 2 minutes
- Duplicates with quick-added transactions flagged for resolution

### 3. Reconciliation

If the user quick-added transactions during the month, the import should detect potential duplicates (same amount + similar date + same category) and let the user confirm or dismiss matches.

## AI Usage Policy

**Principle: deterministic where possible, AI where necessary.** Financial data needs predictability. Use computed logic and templates for alerts, trends, summaries, and recurring detection. AI is used only for categorizing unknown merchants during import.

### What the AI sees (and doesn't see)

The AI never sees the bank statement document, account numbers, balances, names, or amounts. It receives only:
- A list of merchant description strings, PII-stripped (e.g., `["METRO PLUS #1234", "SHELL STN 4521"]`)
- The user's current category list (the ONLY valid classification targets)

### AI guardrails

The categorization is a **constrained classification task**, not open-ended generation:
- The LLM receives the user's exact category list as the only valid options
- It must pick from that list or return `UNCATEGORIZED` — never invent new categories
- Each suggestion includes a confidence score (high/medium/low)
- High-confidence matches are pre-accepted in the review UI (user can override)
- Low-confidence and `UNCATEGORIZED` items are highlighted for manual review
- The user resolves unknowns during batch review — they'll recognize the transaction from the amount, date, and partial description

No web search in the initial implementation. If the AI can't categorize, it says so honestly and the user handles it. Web search can be added later as an optional tool if there's a pattern of unrecognizable merchants.

### PII sanitization pipeline

```
Raw bank data (CSV/PDF) → local parse → structured rows →
  Sanitizer strips: account numbers, cardholder names, balances,
  addresses, any pattern matching PII (SIN, phone, email) →
    Clean merchant descriptions only → LLM categorization →
      Results + user corrections → merchant_mappings table
```

The sanitizer runs locally before any data reaches the LLM adapter, regardless of whether the LLM is local (Ollama) or cloud (Claude/OpenAI). This makes the privacy guarantee architecture-level, not configuration-level.

### AI touchpoints summary

| Use case | Method | Data exposure |
|---|---|---|
| PDF text extraction | pdf.js (local) | Nothing |
| CSV parsing | Local parser | Nothing |
| Known merchant lookup | Mapping table | Nothing |
| Unknown merchant categorization | LLM via adapter | Merchant names only, PII-stripped |
| Budget alerts | Computed logic + templates | Nothing |
| Trends / summaries | Computed logic | Nothing |
| Recurring detection | Pattern matching | Nothing |
| Duplicate detection | Amount + date scoring | Nothing |

### LLM Adapter

```typescript
// lib/ai.ts
export interface AIProvider {
  categorize(
    descriptions: string[],
    categories: { id: string; name: string; group: string }[]
  ): Promise<Array<{
    description: string
    category_id: string | null    // null = UNCATEGORIZED
    confidence: 'high' | 'medium' | 'low'
  }>>
}

// Default: Ollama on localhost:11434
// Swappable to Claude, OpenAI, or any provider implementing this interface
```

Implementation will use the `ai-engineer` skill to ensure proper prompt engineering, structured output handling, and guardrail enforcement.

## Park UI Components to Install

Only what's needed (installed via `npx @park-ui/cli add`):

- button, card, dialog, input, label, select, tabs, toast, tooltip
- popover, progress, checkbox, radio-group, switch
- table (for transactions/budgets)
- file-upload (for future import feature)

~15 components. Each installed into `src/components/ui/` and fully customizable.

## What Gets Ported from v1

| Port | Details |
|---|---|
| Design tokens | HSL color system, light/dark themes, income/expense semantic colors — into Panda tokens |
| Component logic | Form field structures, table layouts, chart configs — rewritten to fit Park UI + Panda |
| Zod schemas | Validation rules for transaction/budget/category forms |
| Recharts configs | Chart data transformations, color mappings |
| React Query patterns | Query key structure, invalidation strategies from the completed migration hooks |

## What Gets Dropped

- All Next.js specifics (App Router, middleware, next.config, next-themes)
- All duplicate components (3 budget forms, 2 budget tables, 2 category dialogs)
- All test/comparison pages and components
- 23 unused npm packages + bogus `"18"` dependency
- Legacy non-React-Query hooks
- `styles/globals.css` duplicate
- `icon-finder.tsx` debug utility
- Hardcoded `upcomingExpenses` data
- `docs/` migration plan artifacts
- `setup` page
- Dead `/dashboard/reports` sidebar link

## Git Strategy

1. Stash current uncommitted changes
2. Create new branch `v2-rewrite` from `main`
3. Clean slate — remove v1 source files, scaffold Vite+ project
4. Build incrementally on the new branch

## Explicitly Out of Scope (for now, but designed for)

- Statement import / PDF parsing / AI categorization — the project structure, LLM adapter interface, and category system are designed to support this. Implementation comes after the core CRUD is stable.
- Recurring transaction automation (flag exists, no engine)
- Multi-user / sharing / household features
- Mobile / PWA
- Deployment to cloud

## Implementation Order (High Level)

These are phases, not detailed steps. The implementation plan (separate document) will break each into specific tasks with agent assignments.

1. **Foundation** — Vite+ scaffold, Panda CSS + Park UI setup, local Supabase with clean schema (6 tables + RLS + indexes + seed data from the Mensuel sheet)
2. **Auth** — Supabase auth, login/register routes, auth guard layout
3. **Categories** — Groups + categories CRUD hook + UI (validates the full stack end-to-end)
4. **Transactions** — CRUD hook + UI with category assignment, month filtering
5. **Budgets** — Budget management per category, organized by group, recurring support
6. **Dashboard** — Primary view: financial overview, budget vs actual summary, spending trends, account snapshot widget
7. **Import Pipeline** — PDF parsing + LLM categorization + review UI. The main feature that eliminates manual transaction entry.
8. **Polish** — Theme refinement, error states, loading states, responsive layout
