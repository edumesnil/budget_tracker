// =============================================================================
// Database Types — Single source of truth
// =============================================================================

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface CategoryGroup {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  categories?: Category[]; // joined
}

export interface Category {
  id: string;
  user_id: string;
  group_id: string | null;
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string | null;
  icon: string | null;
  created_at: string;
  category_groups?: CategoryGroup; // joined
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  date: string;
  description: string | null;
  notes: string | null;
  is_recurring: boolean;
  created_at: string;
  categories?: Category; // joined
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  month: number;
  year: number;
  is_recurring: boolean;
  created_at: string;
  categories?: Category; // joined
}

export interface AccountSnapshot {
  id: string;
  user_id: string;
  account_name: string;
  account_type: "CELI" | "REER" | "REEE" | "EMERGENCY" | "OTHER";
  balance: number;
  snapshot_date: string;
  created_at: string;
}

export interface MerchantMapping {
  id: string;
  user_id: string;
  merchant_pattern: string;
  category_id: string;
  confidence: number;
  created_at: string;
  categories?: Category; // joined
}

export interface StatementSchemaRow {
  id: string;
  user_id: string;
  fingerprint: string;
  bank_name: string;
  statement_type: string;
  columns: Record<string, unknown>;
  amount_format: "french" | "english";
  credit_marker: string | null;
  sections: Record<string, unknown>[] | null;
  continuation_pattern: string | null;
  skip_patterns: string[];
  multiline_rule: string | null;
  transfer_codes: string[] | null;
  internal_transfer_pattern: string | null;
  external_income_pattern: string | null;
  year_source: "header" | "inline";
  year_pattern: string | null;
  confirmed: boolean;
  created_at: string;
}

export type InsertStatementSchema = Omit<StatementSchemaRow, "id" | "user_id" | "created_at">;

// =============================================================================
// Utility types for insert/update operations
// =============================================================================

/** Fields required when creating a new record (omit id, user_id, created_at) */
export type InsertCategoryGroup = Omit<
  CategoryGroup,
  "id" | "user_id" | "created_at" | "categories"
>;
export type InsertCategory = Omit<Category, "id" | "user_id" | "created_at" | "category_groups">;
export type InsertTransaction = Omit<Transaction, "id" | "user_id" | "created_at" | "categories">;
export type InsertBudget = Omit<Budget, "id" | "user_id" | "created_at" | "categories">;
export type InsertAccountSnapshot = Omit<AccountSnapshot, "id" | "user_id" | "created_at">;
export type InsertMerchantMapping = Omit<
  MerchantMapping,
  "id" | "user_id" | "created_at" | "categories"
>;

/** Fields allowed when updating a record (all optional except id) */
export type UpdateCategoryGroup = Partial<InsertCategoryGroup> & { id: string };
export type UpdateCategory = Partial<InsertCategory> & { id: string };
export type UpdateTransaction = Partial<InsertTransaction> & { id: string };
export type UpdateBudget = Partial<InsertBudget> & { id: string };
export type UpdateAccountSnapshot = Partial<InsertAccountSnapshot> & { id: string };
export type UpdateMerchantMapping = Partial<InsertMerchantMapping> & { id: string };

// =============================================================================
// Category type literal
// =============================================================================

export type CategoryType = "INCOME" | "EXPENSE";
export type AccountType = "CELI" | "REER" | "REEE" | "EMERGENCY" | "OTHER";
