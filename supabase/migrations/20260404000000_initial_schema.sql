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
