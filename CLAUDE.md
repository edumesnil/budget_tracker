# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on localhost:3000
npm run build        # Production build
npm run start        # Serve production build
npm run lint         # ESLint
```

No test framework is configured.

## Architecture

Next.js 14 App Router with client-side Supabase — no API routes except `/app/auth/callback/route.ts`. All data access happens directly from the browser via Supabase RLS (Row Level Security). There is no dedicated backend layer.

### Stack

- **Framework:** Next.js 14, React 18, TypeScript
- **Database/Auth:** Supabase (PostgreSQL + Auth)
- **State:** TanStack React Query v5 for server state, React Context for UI state (auth, sidebar)
- **UI:** shadcn/ui (Radix primitives) + Tailwind CSS + Framer Motion
- **Forms:** react-hook-form + Zod validation
- **Charts:** Recharts

### Data Flow

`useSupabaseQuery` and `useSupabaseMutation` in `lib/query-utils.ts` wrap React Query + Supabase client. These enforce auth checks and consistent error handling. Each feature has dedicated hooks (`hooks/use-transaction-data.ts`, `hooks/use-budget.ts`, etc.) that encapsulate all CRUD operations and query logic.

React Query config in `lib/react-query.ts`: staleTime 30s, gcTime 5m.

### Supabase Client

`lib/supabase.ts` exports a singleton client. Browser and server environments get different configurations. Auth sessions persist in localStorage under key `"budget-tracker-auth-storage"`.

### Database Schema (4 tables)

- **users** — id, email
- **transactions** — id, user_id, category_id, amount, date, description, notes
- **categories** — id, user_id, name, type (INCOME/EXPENSE), color, icon
- **budgets** — id, user_id, category_id, amount, month, year, is_recurring

Types auto-generated in `lib/database.types.ts`.

### Auth Flow

Supabase email/password auth managed by `contexts/auth-context.tsx`. Protected routes in `/dashboard` redirect unauthenticated users to `/login`. Middleware in `middleware.ts` is lightweight — auth redirects are component-driven.

### Feature Organization

Each feature (transactions, budget, categories, comparison) follows the same pattern:
- Route in `app/dashboard/<feature>/`
- Components in `components/<feature>/`
- Data hook in `hooks/use-<feature>-data.ts`

### Theme

CSS variables in HSL format. Light/dark mode via `next-themes`. Sidebar colors are a separate token set from main UI colors. Financial semantic colors: income = teal, expense = red.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Build Notes

- TypeScript and ESLint errors are ignored during build (`next.config.mjs`)
- Images set to unoptimized
- Path alias: `@/*` maps to project root
