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
