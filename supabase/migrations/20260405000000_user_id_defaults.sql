-- Add DEFAULT auth.uid() to all user_id columns so client inserts
-- don't need to explicitly pass the user ID.

ALTER TABLE category_groups ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE categories      ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE transactions    ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE budgets         ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE account_snapshots ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE merchant_mappings ALTER COLUMN user_id SET DEFAULT auth.uid();
