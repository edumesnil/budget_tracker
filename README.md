# Budget Tracker

Household budget tracker built for tracking income, expenses, and savings across Desjardins, Wealthsimple, and TD accounts. The core feature is **automated bank statement import** with AI-assisted transaction categorization.

## Stack

- **Build:** Vite+ (Vite 8, Oxlint, Oxfmt, Vitest)
- **Framework:** React 19, TypeScript
- **Router:** React Router v7 (client-side SPA)
- **Styling:** Panda CSS + Park UI (Ark UI primitives)
- **Database/Auth:** Supabase (PostgreSQL + Auth, local via CLI)
- **State:** TanStack React Query v5
- **AI:** Groq / Gemini / Ollama (schema detection + merchant categorization)

## Setup

```bash
# Install dependencies
npm install

# Start local Supabase
supabase start

# Copy env vars (Supabase URL + anon key from `supabase status`)
cp .env.example .env

# Start dev server
vp dev
```

## AI Integration

The import pipeline uses AI for two tasks:

1. **Schema detection** — When you upload a new bank format for the first time, the AI analyzes the column layout (dates, amounts, descriptions) from allowlist-sanitized structural data. Zero PII reaches the AI. The detected schema is cached — subsequent imports of the same format are instant with no AI call.

2. **Merchant categorization** — Unknown merchants are sent to the AI for category assignment and name cleanup. Known merchants are auto-categorized from a local mapping table. The system learns from your corrections.

```bash
VITE_GROQ_API_KEY=gsk_...     # Groq (free tier, recommended)
VITE_GEMINI_API_KEY=AI...      # Google Gemini (free tier, alternative)
# If neither is set, falls back to Ollama on localhost:11434
```

Get a free Groq key at [console.groq.com/keys](https://console.groq.com/keys).

## Commands

```bash
vp dev                         # Dev server
vp build                       # Production build
vp check                       # Format + lint + type check
vp check --fix                 # Auto-fix formatting
vp lint .                      # Oxlint only
vp fmt                         # Oxfmt only
vp test                        # Vitest
supabase start                 # Local Supabase
npx panda codegen --clean      # Regenerate styled-system
```

## Features

- **Dashboard** — monthly spending overview, budget health, account snapshots, spending trends
- **Transactions** — filterable list, manual quick-add, month navigation
- **Budgets** — monthly budget amounts per category, recurring and one-time
- **Categories** — groups and categories with drag-and-drop ordering
- **Import** — PDF/CSV bank statement upload, AI-driven schema detection (any bank format), multi-step progress UI, inline editing, transfer detection, post-parse validation, keyboard-driven batch review, duplicate detection, merchant memory
