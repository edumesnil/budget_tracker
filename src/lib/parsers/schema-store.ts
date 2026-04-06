import { supabase } from "@/lib/supabase";
import type { StatementSchema } from "./schema-types";
import type { RawSchemaResponse } from "./schema-prompt";

/** Load a cached schema by fingerprint */
export async function loadSchema(fingerprint: string): Promise<StatementSchema | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("statement_schemas")
    .select("*")
    .eq("fingerprint", fingerprint)
    .eq("user_id", user.id)
    .eq("confirmed", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    fingerprint: data.fingerprint,
    bank_name: data.bank_name,
    statement_type: data.statement_type,
    columns: data.columns as StatementSchema["columns"],
    amount_format: data.amount_format as "french" | "english",
    credit_marker: data.credit_marker ?? undefined,
    sections: data.sections as StatementSchema["sections"],
    continuation_pattern: data.continuation_pattern ?? undefined,
    skip_patterns: (data.skip_patterns as string[]) ?? [],
    multiline_rule: data.multiline_rule as StatementSchema["multiline_rule"],
    transfer_codes: (data.transfer_codes as string[]) ?? undefined,
    internal_transfer_pattern: data.internal_transfer_pattern ?? undefined,
    external_income_pattern: data.external_income_pattern ?? undefined,
    year_source: data.year_source as "header" | "inline",
    year_pattern: data.year_pattern ?? undefined,
    confirmed: data.confirmed,
    created_at: data.created_at,
  };
}

/**
 * Build a StatementSchema from the AI's raw response + computed fingerprint.
 * Does NOT save to DB — returns the in-memory schema for preview.
 */
export function buildSchema(
  raw: RawSchemaResponse,
  fingerprint: string,
  bankId?: string,
): Omit<StatementSchema, "id" | "user_id" | "created_at"> {
  return {
    fingerprint,
    bank_name: raw.bank_name !== "Unknown" ? raw.bank_name : (bankId ?? "Unknown"),
    statement_type: raw.statement_type,
    columns: raw.columns as StatementSchema["columns"],
    amount_format: raw.amount_format,
    credit_marker: raw.credit_marker,
    sections: raw.sections?.map((s) => ({
      header_pattern: s.header_pattern,
      parse: s.parse,
    })),
    continuation_pattern: raw.continuation_pattern,
    skip_patterns: raw.skip_patterns,
    multiline_rule: raw.multiline_rule,
    transfer_codes: raw.transfer_codes,
    internal_transfer_pattern: raw.internal_transfer_pattern,
    external_income_pattern: raw.external_income_pattern,
    year_source: raw.year_source,
    year_pattern: raw.year_pattern,
    confirmed: false,
  };
}

/** Save a confirmed schema to Supabase */
export async function saveSchema(
  schema: Omit<StatementSchema, "id" | "user_id" | "created_at">,
): Promise<StatementSchema> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("statement_schemas")
    .upsert(
      {
        user_id: user.id,
        fingerprint: schema.fingerprint,
        bank_name: schema.bank_name,
        statement_type: schema.statement_type,
        columns: schema.columns,
        amount_format: schema.amount_format,
        credit_marker: schema.credit_marker ?? null,
        sections: schema.sections ?? null,
        continuation_pattern: schema.continuation_pattern ?? null,
        skip_patterns: schema.skip_patterns,
        multiline_rule: schema.multiline_rule ?? null,
        transfer_codes: schema.transfer_codes ?? null,
        internal_transfer_pattern: schema.internal_transfer_pattern ?? null,
        external_income_pattern: schema.external_income_pattern ?? null,
        year_source: schema.year_source,
        year_pattern: schema.year_pattern ?? null,
        confirmed: true,
      },
      { onConflict: "user_id,fingerprint" },
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as StatementSchema;
}
