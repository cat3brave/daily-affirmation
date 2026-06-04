-- Daily Affirmation / 心のお守りアプリ
-- Supabase schema setup
-- 実行用SQLファイル
--
-- 注意：
-- このファイルでは、既存データを消さないために
-- drop table は使いません。

-- =========================================================
-- todos
-- =========================================================

create table if not exists public.todos (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  completed boolean default false,
  user_id uuid references auth.users not null default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.todos enable row level security;

drop policy if exists "Users can see own todos" on public.todos;
drop policy if exists "Users can insert own todos" on public.todos;
drop policy if exists "Users can update own todos" on public.todos;
drop policy if exists "Users can delete own todos" on public.todos;

create policy "Users can see own todos"
on public.todos
for select
using (auth.uid() = user_id);

create policy "Users can insert own todos"
on public.todos
for insert
with check (auth.uid() = user_id);

create policy "Users can update own todos"
on public.todos
for update
using (auth.uid() = user_id);

create policy "Users can delete own todos"
on public.todos
for delete
using (auth.uid() = user_id);

-- =========================================================
-- bloom_logs
-- =========================================================

create table if not exists public.bloom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flower_type text not null,
  created_at timestamptz not null default now()
);

alter table public.bloom_logs enable row level security;

drop policy if exists "Users can read own bloom logs" on public.bloom_logs;
drop policy if exists "Users can insert own bloom logs" on public.bloom_logs;

create policy "Users can read own bloom logs"
on public.bloom_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own bloom logs"
on public.bloom_logs
for insert
to authenticated
with check (auth.uid() = user_id);

-- =========================================================
-- three_good_things
-- =========================================================

create table if not exists public.three_good_things (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  things1 text,
  things2 text,
  things3 text,
  created_at timestamptz not null default now()
);

create unique index if not exists three_good_things_user_date_unique
on public.three_good_things (user_id, date);

alter table public.three_good_things enable row level security;

drop policy if exists "Users can read own three good things" on public.three_good_things;
drop policy if exists "Users can insert own three good things" on public.three_good_things;
drop policy if exists "Users can update own three good things" on public.three_good_things;
drop policy if exists "Users can delete own three good things" on public.three_good_things;

create policy "Users can read own three good things"
on public.three_good_things
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own three good things"
on public.three_good_things
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own three good things"
on public.three_good_things
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own three good things"
on public.three_good_things
for delete
to authenticated
using (auth.uid() = user_id);

-- =========================================================
-- favorite_affirmations
-- =========================================================

create table if not exists public.favorite_affirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists favorite_affirmations_user_text_unique
on public.favorite_affirmations (user_id, text);

alter table public.favorite_affirmations enable row level security;

drop policy if exists "Users can read own favorite affirmations" on public.favorite_affirmations;
drop policy if exists "Users can insert own favorite affirmations" on public.favorite_affirmations;
drop policy if exists "Users can delete own favorite affirmations" on public.favorite_affirmations;

create policy "Users can read own favorite affirmations"
on public.favorite_affirmations
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own favorite affirmations"
on public.favorite_affirmations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own favorite affirmations"
on public.favorite_affirmations
for delete
to authenticated
using (auth.uid() = user_id);