-- NDT Attenuation Rating — Supabase schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

create table if not exists plants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  threshold_a numeric not null default 50,
  threshold_b1 numeric not null default 25,
  threshold_b2 numeric not null default 12.5,
  threshold_justify numeric not null default 20,
  created_at timestamptz not null default now()
);

create table if not exists rows_ (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references plants(id) on delete cascade,
  label text not null,             -- e.g. "A", "B", "C"
  total_tubes integer not null default 0,
  created_at timestamptz not null default now(),
  unique (plant_id, label)
);

create table if not exists tubes (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references rows_(id) on delete cascade,
  tube_no integer not null,
  file_name text,
  total_points integer not null default 0,
  pct_a numeric,
  pct_b1 numeric,
  pct_b2 numeric,
  pct_c numeric,
  rating text not null default 'NT',   -- A / B1 / B2 / C / NT
  created_at timestamptz not null default now(),
  unique (row_id, tube_no)
);

create index if not exists idx_rows_plant on rows_(plant_id);
create index if not exists idx_tubes_row on tubes(row_id);

-- Row Level Security: open for now (single-user internal tool via Railway).
-- Tighten this later if the app grows multi-user auth.
alter table plants enable row level security;
alter table rows_ enable row level security;
alter table tubes enable row level security;

create policy "allow all - plants" on plants for all using (true) with check (true);
create policy "allow all - rows_" on rows_ for all using (true) with check (true);
create policy "allow all - tubes" on tubes for all using (true) with check (true);
