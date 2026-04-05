# Budget Tracker

Household budget tracker built for tracking income, expenses, and savings across Desjardins, Wealthsimple, and TD accounts. The core feature is **automated bank statement import** with AI-assisted transaction categorization.

## Stack

- **Build:** Vite+ (Vite 8, Oxlint, Oxfmt, Vitest)
- **Framework:** React 19, TypeScript
- **Router:** React Router v7 (client-side SPA)
- **Styling:** Panda CSS + Park UI (Ark UI primitives)
- **Database/Auth:** Supabase (PostgreSQL + Auth, local via CLI)
- **State:** TanStack React Query v5
- **AI:** Groq / Gemini / Ollama (for merchant categorization)

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

## AI Categorization

The import pipeline uses an LLM to categorize unknown merchants and clean up cryptic bank descriptions. Set one of these in `.env`:

```bash
VITE_GROQ_API_KEY=gsk_...     # Groq (free tier, recommended)
VITE_GEMINI_API_KEY=AI...      # Google Gemini (free tier, alternative)
# If neither is set, falls back to Ollama on localhost:11434
```

Get a free Groq key at [console.groq.com/keys](https://console.groq.com/keys).

Known merchants are auto-categorized from a local mapping table — the AI is only called for new merchants. The system learns from your corrections.

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
- **Import** — PDF/CSV bank statement upload, AI categorization, keyboard-driven batch review, duplicate detection, merchant memory
