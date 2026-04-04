# Plan 1B: Database & Data Layer

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan.

**Goal:** Local Supabase with 7 tables, RLS, seed data from Mensuel sheet, TypeScript types, and client libraries.

**Architecture:** Supabase CLI for local Postgres + Auth. Schema uses category groups for two-level hierarchy. Amounts always positive, category type determines direction. Recurring budgets use query fallback (no auto-created rows).

**Tech Stack:** Supabase CLI, PostgreSQL, TypeScript, TanStack React Query v5

**Depends on:** Plan 1A (project scaffold exists)
**Enables:** Plan 1C (auth), Plan 1D (categories CRUD)

---

## Step 1: Initialize Local Supabase

The `supabase/` directory already exists with a `config.toml` from a previous `supabase init`. We need to ensure the config is correct for v2 and add the migrations directory.

### 1.1 Verify/update `supabase/config.toml`

The existing config.toml is already well-configured. Confirm these settings are in place (they already are in the current file):

- `project_id = "budget_tracker"`
- `[db] port = 54322`, `major_version = 17`
- `[db.seed] enabled = true`, `sql_paths = ["./seed.sql"]`
- `[auth] site_url = "http://127.0.0.1:3000"` — change to `"http://127.0.0.1:5173"` for Vite dev server
- `[auth.email] enable_confirmations = false` — keeps dev login frictionless
- `[studio] port = 54323`

**One change required:** Update `site_url` from `http://127.0.0.1:3000` to `http://127.0.0.1:5173` and `additional_redirect_urls` to `["https://127.0.0.1:5173"]` since v2 uses Vite (port 5173) instead of Next.js (port 3000).

### 1.2 Create migrations directory

```bash
mkdir -p supabase/migrations
```

---

## Step 2: Write Migration SQL

Create file: `supabase/migrations/001_initial_schema.sql`

This file contains the COMPLETE schema: all 7 tables, all RLS policies, all indexes.

```sql
-- ============================================================================
-- Budget Tracker v2 — Initial Schema
-- 7 tables: users, category_groups, categories, transactions, budgets,
--           account_snapshots, merchant_mappings
-- ============================================================================

-- =========================
-- 1. USERS
-- =========================
CREATE TABLE users (
  id uuid PRIMARY KEY,                  -- matches auth.users.id
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_delete" ON users FOR DELETE USING (auth.uid() = id);

-- =========================
-- 2. CATEGORY GROUPS
-- =========================
CREATE TABLE category_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,                   -- "MAISON", "AUTO", "NOURRITURE", etc.
  icon text,
  color text,
  sort_order integer DEFAULT 0,         -- controls display order in budget view
  created_at timestamptz DEFAULT now()
);

ALTER TABLE category_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_groups_select" ON category_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "category_groups_insert" ON category_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "category_groups_update" ON category_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "category_groups_delete" ON category_groups FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- 3. CATEGORIES
-- =========================
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

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- 4. TRANSACTIONS
-- =========================
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

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- 5. BUDGETS
-- =========================
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

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_select" ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budgets_insert" ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budgets_update" ON budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "budgets_delete" ON budgets FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- 6. ACCOUNT SNAPSHOTS
-- =========================
CREATE TABLE account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_name text NOT NULL,           -- "CELI Desjardins", "REER Wealthsimple"
  account_type text NOT NULL CHECK (account_type IN ('CELI', 'REER', 'REEE', 'EMERGENCY', 'OTHER')),
  balance numeric NOT NULL,
  snapshot_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_snapshots_select" ON account_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "account_snapshots_insert" ON account_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "account_snapshots_update" ON account_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "account_snapshots_delete" ON account_snapshots FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- 7. MERCHANT MAPPINGS
-- =========================
CREATE TABLE merchant_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_pattern text NOT NULL,       -- "METRO PLUS", "SPOTIFY", "SHELL"
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence numeric DEFAULT 1.0,       -- 1.0 = user confirmed, <1.0 = AI suggested
  created_at timestamptz DEFAULT now()
);

ALTER TABLE merchant_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_mappings_select" ON merchant_mappings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "merchant_mappings_insert" ON merchant_mappings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "merchant_mappings_update" ON merchant_mappings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "merchant_mappings_delete" ON merchant_mappings FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX idx_budgets_user_year_month ON budgets(user_id, year, month);
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_categories_group ON categories(group_id);
CREATE INDEX idx_snapshots_user_date ON account_snapshots(user_id, snapshot_date);
CREATE INDEX idx_merchant_mappings_user ON merchant_mappings(user_id);
```

---

## Step 3: Write Seed Data

Create file: `supabase/seed.sql`

Seed data creates a dev user, 7 category groups from the Mensuel spreadsheet, all categories under each group, and budget entries for April 2026 marked as recurring. Uses deterministic UUIDs so seed data is reproducible.

```sql
-- ============================================================================
-- Budget Tracker v2 — Seed Data
-- Source: Mensuel spreadsheet (Budget.xlsx)
-- ============================================================================

-- =========================
-- DEV USER
-- =========================
-- Create the dev user in auth.users first (Supabase auth table)
-- Password: "password123" (local dev only)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a',
  '00000000-0000-0000-0000-000000000000',
  'dev@budgettracker.local',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  'authenticated',
  'authenticated'
);

-- Create matching public.users row
INSERT INTO users (id, email) VALUES
  ('d0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'dev@budgettracker.local');

-- =========================
-- CATEGORY GROUPS
-- =========================
-- sort_order follows the Mensuel sheet order: REVENU first, then expense groups
INSERT INTO category_groups (id, user_id, name, sort_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'REVENU',      0),
  ('a1000000-0000-0000-0000-000000000002', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'MAISON',      1),
  ('a1000000-0000-0000-0000-000000000003', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'AUTO',        2),
  ('a1000000-0000-0000-0000-000000000004', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'FINANCE',     3),
  ('a1000000-0000-0000-0000-000000000005', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'NOURRITURE',  4),
  ('a1000000-0000-0000-0000-000000000006', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'ABONNEMENTS', 5),
  ('a1000000-0000-0000-0000-000000000007', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'AUTRE',       6);

-- =========================
-- CATEGORIES
-- =========================
-- REVENU group (type = INCOME)
INSERT INTO categories (id, user_id, group_id, name, type) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000001', 'Eric',      'INCOME'),
  ('c1000000-0000-0000-0000-000000000002', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000001', 'Maryse',    'INCOME'),
  ('c1000000-0000-0000-0000-000000000003', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000001', 'Gouv Qc',   'INCOME'),
  ('c1000000-0000-0000-0000-000000000004', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000001', 'Gouv Can',  'INCOME');

-- MAISON group (type = EXPENSE)
INSERT INTO categories (id, user_id, group_id, name, type) VALUES
  ('c1000000-0000-0000-0000-000000000011', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000002', 'Hypothèque/Loyer', 'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000012', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000002', 'Hydro',             'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000013', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000002', 'Taxes',             'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000014', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000002', 'Ass. Maison',       'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000015', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000002', 'Ass. Vie',          'EXPENSE');

-- AUTO group (type = EXPENSE)
INSERT INTO categories (id, user_id, group_id, name, type) VALUES
  ('c1000000-0000-0000-0000-000000000021', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000003', 'Gas',             'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000022', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000003', 'Plaques/Permis',  'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000023', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000003', 'Ass. Auto',       'EXPENSE');

-- FINANCE group (type = EXPENSE)
INSERT INTO categories (id, user_id, group_id, name, type) VALUES
  ('c1000000-0000-0000-0000-000000000031', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000004', 'Frais comptes',     'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000032', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000004', 'Garderie',          'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000033', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000004', 'Service de garde',  'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000034', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000004', 'Kaleido',           'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000035', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000004', 'Orthodonthie',      'EXPENSE');

-- NOURRITURE group (type = EXPENSE)
INSERT INTO categories (id, user_id, group_id, name, type) VALUES
  ('c1000000-0000-0000-0000-000000000041', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000005', 'Épicerie',    'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000042', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000005', 'Restaurant',  'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000043', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000005', 'Pharmacie',   'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000044', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000005', 'Bébé',        'EXPENSE');

-- ABONNEMENTS group (type = EXPENSE)
INSERT INTO categories (id, user_id, group_id, name, type) VALUES
  ('c1000000-0000-0000-0000-000000000051', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000006', 'Spotify',  'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000052', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000006', 'Netflix',  'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000053', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000006', 'Amazon',   'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000054', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000006', 'Fizz',     'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000055', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000006', 'Google',   'EXPENSE');

-- AUTRE group (type = EXPENSE)
INSERT INTO categories (id, user_id, group_id, name, type) VALUES
  ('c1000000-0000-0000-0000-000000000061', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000007', 'Barbier',         'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000062', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000007', 'Dentiste',        'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000063', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000007', 'Animaux',         'EXPENSE'),
  ('c1000000-0000-0000-0000-000000000064', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'a1000000-0000-0000-0000-000000000007', 'Investissement',  'EXPENSE');

-- =========================
-- BUDGET TEMPLATE (April 2026, recurring)
-- =========================
-- All amounts are positive. Category type determines direction.
-- is_recurring = true means these carry forward to future months via query fallback.

-- REVENU budgets
INSERT INTO budgets (id, user_id, category_id, amount, month, year, is_recurring) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000001', 4123.25, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000002', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000002', 2545.83, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000003', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000003',  374.52, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000004', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000004',  691.48, 4, 2026, true);

-- MAISON budgets
INSERT INTO budgets (id, user_id, category_id, amount, month, year, is_recurring) VALUES
  ('b1000000-0000-0000-0000-000000000011', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000011', 1680.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000012', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000012',  170.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000013', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000013',  200.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000014', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000014',   80.38, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000015', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000015',  134.00, 4, 2026, true);

-- AUTO budgets
INSERT INTO budgets (id, user_id, category_id, amount, month, year, is_recurring) VALUES
  ('b1000000-0000-0000-0000-000000000021', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000021', 540.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000022', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000022',  45.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000023', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000023',  98.54, 4, 2026, true);

-- FINANCE budgets
INSERT INTO budgets (id, user_id, category_id, amount, month, year, is_recurring) VALUES
  ('b1000000-0000-0000-0000-000000000031', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000031',  40.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000032', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000032', 200.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000033', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000033', 180.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000034', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000034',  62.17, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000035', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000035', 175.00, 4, 2026, true);

-- NOURRITURE budgets
INSERT INTO budgets (id, user_id, category_id, amount, month, year, is_recurring) VALUES
  ('b1000000-0000-0000-0000-000000000041', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000041', 808.33, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000042', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000042', 100.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000043', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000043', 110.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000044', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000044',  50.00, 4, 2026, true);

-- ABONNEMENTS budgets
INSERT INTO budgets (id, user_id, category_id, amount, month, year, is_recurring) VALUES
  ('b1000000-0000-0000-0000-000000000051', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000051',  24.13, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000052', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000052',  31.02, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000053', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000053',  11.49, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000054', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000054',  85.07, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000055', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000055',   7.00, 4, 2026, true);

-- AUTRE budgets
INSERT INTO budgets (id, user_id, category_id, amount, month, year, is_recurring) VALUES
  ('b1000000-0000-0000-0000-000000000061', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000061',  43.33, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000062', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000062', 205.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000063', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000063',  80.00, 4, 2026, true),
  ('b1000000-0000-0000-0000-000000000064', 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a', 'c1000000-0000-0000-0000-000000000064', 250.00, 4, 2026, true);
```

### UUID scheme

Deterministic UUIDs make the seed reproducible and debuggable:

| Entity | UUID pattern | Example |
|--------|-------------|---------|
| Dev user | `d0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a` | Single dev user |
| Groups | `a1000000-...-00000000000N` | N = 1-7 for 7 groups |
| Categories | `c1000000-...-0000000000GC` | G = group (1-7), C = category within group (1-5) |
| Budgets | `b1000000-...-0000000000GC` | Mirrors category IDs |

---

## Step 4: Start Local Supabase and Run Migrations

```bash
# From project root
supabase start

# Migrations run automatically on start. If needed manually:
supabase db reset
```

`supabase start` will:
1. Pull Docker images (first time only)
2. Start Postgres, Auth, Studio, etc.
3. Apply all migrations from `supabase/migrations/`
4. Run `supabase/seed.sql`

After start, note the output values:
- **API URL:** `http://127.0.0.1:54321`
- **Anon key:** (printed by `supabase start`)
- **Studio URL:** `http://127.0.0.1:54323`

Create `.env.local` (or `.env` for Vite) with:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start output>
VITE_DEV_AUTOLOGIN=true
```

---

## Step 5: Create TypeScript Types

Create file: `src/types/database.ts`

Single source of truth for all database types. These are application-level interfaces, not the Supabase-generated types (those can be generated separately via `supabase gen types typescript` but these hand-written interfaces are what the app uses).

```typescript
// =============================================================================
// Database Types — Single source of truth
// =============================================================================

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

// =============================================================================
// Utility types for insert/update operations
// =============================================================================

/** Fields required when creating a new record (omit id, user_id, created_at) */
export type InsertCategoryGroup = Omit<CategoryGroup, 'id' | 'user_id' | 'created_at' | 'categories'>
export type InsertCategory = Omit<Category, 'id' | 'user_id' | 'created_at' | 'category_groups'>
export type InsertTransaction = Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'categories'>
export type InsertBudget = Omit<Budget, 'id' | 'user_id' | 'created_at' | 'categories'>
export type InsertAccountSnapshot = Omit<AccountSnapshot, 'id' | 'user_id' | 'created_at'>
export type InsertMerchantMapping = Omit<MerchantMapping, 'id' | 'user_id' | 'created_at' | 'categories'>

/** Fields allowed when updating a record (all optional except id) */
export type UpdateCategoryGroup = Partial<InsertCategoryGroup> & { id: string }
export type UpdateCategory = Partial<InsertCategory> & { id: string }
export type UpdateTransaction = Partial<InsertTransaction> & { id: string }
export type UpdateBudget = Partial<InsertBudget> & { id: string }
export type UpdateAccountSnapshot = Partial<InsertAccountSnapshot> & { id: string }
export type UpdateMerchantMapping = Partial<InsertMerchantMapping> & { id: string }

// =============================================================================
// Category type literal
// =============================================================================

export type CategoryType = 'INCOME' | 'EXPENSE'
export type AccountType = 'CELI' | 'REER' | 'REEE' | 'EMERGENCY' | 'OTHER'
```

---

## Step 6: Create Supabase Client Singleton

Create file: `src/lib/supabase.ts`

Browser-only Supabase client. No server-side client needed (v2 is a pure SPA).

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
    'Run `supabase start` and copy the values to .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'budget-tracker-auth-storage',
  },
})
```

### Key differences from v1

- Uses `import.meta.env` (Vite) instead of `process.env` (Next.js)
- Exported as a const singleton, not a getter function — simpler, same behavior
- No server client — v2 is a pure SPA, all queries go through the browser client with RLS
- Throws on missing env vars instead of silently using empty strings

---

## Step 7: Create React Query Client

Create file: `src/lib/query-client.ts`

Per-entity staleTime configuration from the design spec.

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,              // Default: always refetch on mount
      gcTime: 5 * 60 * 1000,     // 5 minutes garbage collection
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error)
      },
    },
  },
})

// =============================================================================
// Per-entity staleTime constants
// Used in individual hooks via useQuery({ staleTime: STALE_TIMES.categories })
// =============================================================================

export const STALE_TIMES = {
  /** Categories rarely change — cache aggressively */
  categories: 5 * 60 * 1000,   // 5 minutes

  /** Transactions: always refetch, but serve cache instantly while background fetch runs */
  transactions: 0,

  /** Budgets: moderate cache */
  budgets: 1 * 60 * 1000,      // 1 minute

  /** Dashboard is a composite view — always fresh */
  dashboard: 0,

  /** Account snapshots: rarely updated */
  snapshots: 5 * 60 * 1000,    // 5 minutes

  /** Merchant mappings: rarely change outside of imports */
  merchantMappings: 5 * 60 * 1000, // 5 minutes
} as const
```

### Key differences from v1

- Default `staleTime: 0` instead of 30s — serve cache instantly but always revalidate in background
- Exported `STALE_TIMES` constants for per-entity overrides used in hooks
- Same `gcTime` (5 min) and `retry: 1` as v1

---

## Step 8: Create Utility Helpers

Create file: `src/lib/utils.ts`

Minimal helpers. No `cn()` / `twMerge` — v2 uses Panda CSS, not Tailwind.

```typescript
/**
 * Format a number as currency (CAD).
 * Always displays positive values — sign logic is handled by category type.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(Math.abs(amount))
}

/**
 * Format a date string (ISO or yyyy-mm-dd) for display.
 */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

/**
 * Get the first and last day of a given month/year as ISO date strings.
 * Used for transaction date range queries.
 */
export function getMonthRange(month: number, year: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0) // last day of month
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

/**
 * Get current month and year.
 */
export function getCurrentPeriod() {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
}
```

---

## Step 9: Verify Everything Works

### 9.1 Check Supabase is running

```bash
supabase status
```

Expected: all services running, API URL and keys printed.

### 9.2 Check tables exist

Open Studio at `http://127.0.0.1:54323` or run:

```bash
supabase db reset  # re-runs migrations + seed if needed
```

Then verify via psql or Studio:
- 7 tables in public schema: `users`, `category_groups`, `categories`, `transactions`, `budgets`, `account_snapshots`, `merchant_mappings`
- RLS enabled on all 7 tables (check via Studio > Authentication > Policies)
- 7 indexes created

### 9.3 Check seed data loaded

```sql
-- Via supabase Studio SQL editor or psql
SELECT count(*) FROM users;              -- 1
SELECT count(*) FROM category_groups;    -- 7
SELECT count(*) FROM categories;         -- 30
SELECT count(*) FROM budgets;            -- 30
SELECT count(*) FROM transactions;       -- 0 (no seed transactions)
SELECT count(*) FROM account_snapshots;  -- 0 (no seed snapshots)
SELECT count(*) FROM merchant_mappings;  -- 0 (no seed mappings)

-- Verify group-category hierarchy
SELECT g.name AS group_name, c.name AS category_name, c.type
FROM categories c
JOIN category_groups g ON c.group_id = g.id
ORDER BY g.sort_order, c.name;
```

### 9.4 Check TypeScript compiles

```bash
npx tsc --noEmit src/types/database.ts src/lib/supabase.ts src/lib/query-client.ts src/lib/utils.ts
```

No errors expected.

---

## Files Created/Modified Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/config.toml` | **Modify** | Update `site_url` to port 5173, update `additional_redirect_urls` |
| `supabase/migrations/001_initial_schema.sql` | **Create** | 7 tables + RLS (28 policies) + 7 indexes |
| `supabase/seed.sql` | **Create** | Dev user + 7 groups + 30 categories + 30 budget entries |
| `src/types/database.ts` | **Create** | 7 interfaces + Insert/Update utility types |
| `src/lib/supabase.ts` | **Create** | Supabase client singleton for browser |
| `src/lib/query-client.ts` | **Create** | React Query client + per-entity staleTime constants |
| `src/lib/utils.ts` | **Create** | formatCurrency, formatDate, getMonthRange, getCurrentPeriod |
| `.env` | **Create** | VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_DEV_AUTOLOGIN |

## Potential Issues

1. **`supabase start` requires Docker.** Ensure Docker Desktop is running before starting.
2. **Auth seed user creation.** The `INSERT INTO auth.users` with `crypt()` requires the `pgcrypto` extension. Supabase enables this by default, but if it fails, add `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at the top of seed.sql.
3. **Port conflicts.** If ports 54321-54327 are in use from a previous Supabase instance, run `supabase stop` first.
4. **`src/` directory.** Plan 1A should have created the `src/` directory structure. If it does not exist, create `src/types/`, `src/lib/` before writing files.

## Seed Data Verification Checklist

- [ ] Dev user: `dev@budgettracker.local` / `password123`
- [ ] 7 groups in correct sort order: REVENU(0), MAISON(1), AUTO(2), FINANCE(3), NOURRITURE(4), ABONNEMENTS(5), AUTRE(6)
- [ ] 4 INCOME categories under REVENU
- [ ] 26 EXPENSE categories across 6 expense groups
- [ ] 30 budget rows, all for month=4, year=2026, is_recurring=true
- [ ] Budget amounts match Mensuel spreadsheet exactly
- [ ] All amounts are positive
