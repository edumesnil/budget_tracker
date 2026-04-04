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
│   │   ├── use-categories.ts           # Queries + mutations for categories
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

### Tables

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,                  -- matches auth.users.id
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
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
```

### Changes from v1

- Proper foreign keys with `ON DELETE CASCADE/SET NULL` (missing before)
- Dropped `family_member` column (unused)
- `month` constrained to `1-12` (v1 used `0` as a hack for recurring)
- `is_recurring` kept as simple boolean flag — no engine, just a marker
- `users` table stays minimal; Supabase Auth handles sessions

### Row Level Security

Each table gets the same pattern:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_select" ON <table> FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "<table>_insert" ON <table> FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "<table>_update" ON <table> FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "<table>_delete" ON <table> FOR DELETE USING (auth.uid() = user_id);
```

Standard per-user row isolation. No shared data between users.

### Indexes

```sql
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX idx_budgets_user_year_month ON budgets(user_id, year, month);
CREATE INDEX idx_categories_user ON categories(user_id);
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

### Patterns

- Queries fetch with joins where needed (`transactions` joins `categories`)
- Mutations invalidate relevant query keys on success
- Derived state (totals, grouped data) computed via `useMemo` in the hook
- No optimistic updates initially — add only where UX demands it
- No shared query-utils wrapper — each hook talks to Supabase directly

### Types

Single source of truth in `types/database.ts`:

```typescript
export interface User {
  id: string
  email: string
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: 'INCOME' | 'EXPENSE'
  color: string | null
  icon: string | null
  created_at: string
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

## LLM Adapter (Future)

Placeholder interface only — not built until the import feature is built:

```typescript
// lib/ai.ts
export interface AIProvider {
  categorize(
    descriptions: string[],
    existingCategories: string[]
  ): Promise<Map<string, string>>  // description → category name
}

// Default implementation will use Ollama on localhost:11434
// Swappable to Claude, OpenAI, or any provider with the same interface
```

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

## Explicitly Out of Scope

- Statement import / PDF parsing / AI categorization (structure prepared, not built)
- Reports page
- Recurring transaction automation (flag exists, no engine)
- Multi-user / sharing / household features
- Mobile / PWA
- Deployment to cloud
- Testing (Vitest is available via Vite+, tests added incrementally as features stabilize)

## Git Strategy

1. Stash current uncommitted changes
2. Create new branch `v2-rewrite` from `main`
3. Clean slate — remove v1 source files, scaffold Vite+ project
4. Build incrementally on the new branch

## Implementation Order (High Level)

These are phases, not detailed steps. The implementation plan (separate document) will break each into specific tasks with agent assignments.

1. **Foundation** — Vite+ scaffold, Panda CSS + Park UI setup, local Supabase with clean schema
2. **Auth** — Supabase auth, login/register routes, auth guard layout
3. **Categories** — CRUD hook + UI (simplest entity, validates the full stack)
4. **Transactions** — CRUD hook + UI with category joins, month filtering
5. **Budgets** — CRUD hook + UI with budget vs actual calculations
6. **Dashboard** — Overview page composing data from all hooks, charts
7. **Polish** — Theme refinement, error states, loading states, responsive layout
