-- Basis: saved systems
--
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- The security model is row-level security, not application code. The browser holds the
-- anon key and talks to Postgres directly, so RLS is the only thing standing between one
-- user's rows and another's. Every policy below is scoped to auth.uid(); there is no path
-- that returns rows for a different user, and no server to forget a WHERE clause.

create table if not exists public.saved_systems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),

  -- The input, not the output. ~61 bytes; the engine rebuilds the system from it.
  -- Stored output would go stale on every engine change; an input never does.
  input jsonb not null,

  -- Fingerprint at save time, so drift is detectable on reload.
  engine_version text not null,
  output_hash text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every list query is "my rows, newest first".
create index if not exists saved_systems_user_created_idx
  on public.saved_systems (user_id, created_at desc);

-- Guard against a malformed client writing junk that the engine cannot regenerate from.
alter table public.saved_systems
  drop constraint if exists saved_systems_input_shape;
alter table public.saved_systems
  add constraint saved_systems_input_shape check (
    jsonb_typeof(input) = 'object'
    and jsonb_typeof(input -> 'productType') = 'string'
    and char_length(input ->> 'productType') between 1 and 200
    -- Caps the row so a client cannot use the column as free storage.
    and pg_column_size(input) < 4096
  );

alter table public.saved_systems enable row level security;

-- Deny by default, then allow only the owner. Split per operation rather than one FOR ALL
-- policy so an accidental future edit to one verb cannot silently widen the others.
drop policy if exists "read own systems" on public.saved_systems;
create policy "read own systems" on public.saved_systems
  for select using (auth.uid() = user_id);

drop policy if exists "insert own systems" on public.saved_systems;
create policy "insert own systems" on public.saved_systems
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own systems" on public.saved_systems;
create policy "update own systems" on public.saved_systems
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own systems" on public.saved_systems;
create policy "delete own systems" on public.saved_systems
  for delete using (auth.uid() = user_id);

-- Keep updated_at honest without trusting the client to send it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_systems_touch on public.saved_systems;
create trigger saved_systems_touch
  before update on public.saved_systems
  for each row execute function public.touch_updated_at();
