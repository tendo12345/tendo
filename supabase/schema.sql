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

-- Basis: blog comments
--
-- Adds a role/display-name profile, comments, and reports, plus the moderation and realtime
-- machinery around them. Blog posts themselves are NOT stored here — they are Markdown files
-- in the repo (see src/content/blog). That means comments.post_slug cannot be a foreign key:
-- there is no table row for it to reference. A typo'd or since-removed slug produces an
-- orphaned comment with no referential-integrity error to catch it — accepted as the cost of
-- keeping posts file-based rather than adding a posts table just to backstop this constraint.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  -- Public-safe stand-in for identity. auth.users.email is never readable by other users
  -- through the anon-key path, so comments need something else to show as "who wrote this."
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Full profile (including role) is readable only by its owner: another user's admin status
-- should not be public.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- display_name alone is public to any signed-in visitor, so a comment can show its author.
-- Postgres RLS cannot restrict a policy to specific columns, so this policy technically
-- grants read of the whole row to any authenticated user; application code must select only
-- display_name (never role) when rendering another user's identity. A comments_with_author
-- view scoped to (id, display_name) is a stronger option if this ever needs hardening.
drop policy if exists "read display name" on public.profiles;
create policy "read display name" on public.profiles
  for select using (auth.uid() is not null);

-- No insert/update/delete policy for ordinary users at all: profiles are populated only by
-- the trigger below (running as the function owner, bypassing RLS) and role changes are a
-- manual operator action in the SQL editor — see DEPLOY.md. Deny-by-default means there is no
-- policy here to accidentally widen later.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'user-' || substr(new.id::text, 1, 8))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Security-definer helper so a comments policy can check the caller's role without itself
-- being subject to profiles' RLS (an ordinary user has no read policy on someone else's
-- profile row, which would make a direct lookup silently return nothing).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_slug text not null check (char_length(post_slug) between 1 and 200),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  -- visible: shown to everyone. pending_review: report threshold hit, hidden from everyone
  -- but the author and admins. removed: admin action, kept (not deleted) for the moderation
  -- audit trail.
  status text not null default 'visible' check (status in ('visible', 'pending_review', 'removed')),
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every list query is "this post's comments, newest first".
create index if not exists comments_post_created_idx
  on public.comments (post_slug, created_at desc);

alter table public.comments enable row level security;

drop policy if exists "read visible or own or admin" on public.comments;
create policy "read visible or own or admin" on public.comments
  for select using (
    status = 'visible'
    or user_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "insert own comment" on public.comments;
create policy "insert own comment" on public.comments
  for insert with check (auth.uid() = user_id and status = 'visible');

-- Split by actor, not just by operation: an ordinary author may only touch their own row's
-- body (status/report_count are force-reset by the trigger below), while an admin may only
-- flip status via the moderate policy. Two update policies for the same reason the original
-- comment on saved_systems gives for one-policy-per-operation — so a future edit to one
-- cannot silently widen the other.
drop policy if exists "update own comment body" on public.comments;
create policy "update own comment body" on public.comments
  for update using (auth.uid() = user_id and status <> 'removed')
  with check (auth.uid() = user_id);

drop policy if exists "admin moderate comment" on public.comments;
create policy "admin moderate comment" on public.comments
  for update using (public.is_admin())
  with check (public.is_admin());

-- Author-only hard delete (e.g. "delete my typo'd comment"). There is deliberately no
-- admin-delete policy: admin removal is a status change to 'removed' via the moderate policy
-- above, not a row delete, so the queue keeps an audit trail instead of losing evidence.
drop policy if exists "delete own comment" on public.comments;
create policy "delete own comment" on public.comments
  for delete using (auth.uid() = user_id);

-- A self-edit (the "update own comment body" policy) can otherwise still smuggle a changed
-- status or report_count through the same UPDATE — RLS's WITH CHECK cannot compare against
-- the pre-update row. This trigger closes that gap: any update NOT made by an admin has
-- status/report_count forced back to their prior values, so only body/updated_at can move.
create or replace function public.guard_comment_self_edit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status := old.status;
    new.report_count := old.report_count;
  end if;
  return new;
end;
$$;

drop trigger if exists comments_guard_self_edit on public.comments;
create trigger comments_guard_self_edit
  before update on public.comments
  for each row execute function public.guard_comment_self_edit();

drop trigger if exists comments_touch on public.comments;
create trigger comments_touch
  before update on public.comments
  for each row execute function public.touch_updated_at();

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  -- One report per user per comment: filing again fails here rather than inflating the count.
  unique (comment_id, reporter_id)
);

create index if not exists comment_reports_comment_idx
  on public.comment_reports (comment_id);

alter table public.comment_reports enable row level security;

drop policy if exists "insert own report" on public.comment_reports;
create policy "insert own report" on public.comment_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "read own reports or admin" on public.comment_reports;
create policy "read own reports or admin" on public.comment_reports
  for select using (auth.uid() = reporter_id or public.is_admin());

-- No update/delete policy: a filed report is immutable evidence, not something a reporter can
-- retract to dodge the auto-hide threshold.

-- Auto-hide: once report_count crosses the threshold, flip status to pending_review so it
-- stops showing to ordinary readers pending admin review. security definer because the
-- reporting user has no update policy on comments themselves.
create or replace function public.handle_comment_report()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  threshold constant integer := 3;
begin
  update public.comments
  set report_count = report_count + 1,
      status = case when report_count + 1 >= threshold and status = 'visible'
                    then 'pending_review' else status end
  where id = new.comment_id;
  return new;
end;
$$;

drop trigger if exists on_comment_report on public.comment_reports;
create trigger on_comment_report
  after insert on public.comment_reports
  for each row execute function public.handle_comment_report();

-- Realtime: lets the client subscribe to postgres_changes on comments so a post/edit/delete/
-- moderation action appears live for everyone viewing the same post. RLS still applies to
-- what each subscriber receives. This line is the one exception to the rest of this file
-- being safely re-runnable: re-adding a table already in the publication raises "already a
-- member of publication" rather than silently succeeding — expected on a second run.
alter publication supabase_realtime add table public.comments;
