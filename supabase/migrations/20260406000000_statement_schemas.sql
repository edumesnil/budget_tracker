create table statement_schemas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  fingerprint text not null,
  bank_name text not null,
  statement_type text not null,
  columns jsonb not null,
  amount_format text not null check (amount_format in ('french', 'english')),
  credit_marker text,
  sections jsonb,
  continuation_pattern text,
  skip_patterns jsonb not null default '[]',
  multiline_rule text,
  transfer_codes jsonb,
  internal_transfer_pattern text,
  external_income_pattern text,
  year_source text not null check (year_source in ('header', 'inline')),
  year_pattern text,
  confirmed boolean not null default false,
  created_at timestamptz default now()
);

alter table statement_schemas enable row level security;

create policy "Users can manage their own schemas"
  on statement_schemas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index statement_schemas_fingerprint_idx
  on statement_schemas (user_id, fingerprint);
