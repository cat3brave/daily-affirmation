# Supabase Schema / テーブル構成メモ

このファイルは、Daily Affirmation / 心のお守りアプリで使用している Supabase のテーブル構成と RLS 方針をまとめたメモです。

## 基本方針

このアプリでは、ユーザーごとの個人データを扱うため、各テーブルに `user_id` を持たせます。

Supabase Auth のログインユーザーIDと `user_id` を照合し、自分のデータだけを読み書きできるようにします。

基本ルール：

- `user_id` は `auth.users(id)` を参照する
- RLS を有効化する
- select / insert / update / delete は自分の `user_id` のみ許可する
- 他ユーザーの記録は読めない・変更できない

---

## todos

Todoリスト用のテーブルです。

### 目的

ユーザーごとのTodoを保存します。

### カラム

| カラム名   | 型                       | 説明         |
| ---------- | ------------------------ | ------------ |
| id         | uuid                     | TodoのID     |
| text       | text                     | Todoの内容   |
| completed  | boolean                  | 完了状態     |
| user_id    | uuid                     | Todoの持ち主 |
| created_at | timestamp with time zone | 作成日時     |

### SQL

```sql
drop table if exists todos;

create table todos (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  completed boolean default false,
  user_id uuid references auth.users not null default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table todos enable row level security;

create policy "Users can see own todos"
on todos
for select
using (auth.uid() = user_id);

create policy "Users can insert own todos"
on todos
for insert
with check (auth.uid() = user_id);

create policy "Users can update own todos"
on todos
for update
using (auth.uid() = user_id);

create policy "Users can delete own todos"
on todos
for delete
using (auth.uid() = user_id);
```

---

## bloom_logs

お花が満開になった記録を保存するテーブルです。

### 目的

お散歩ボタンでお花が満開になったときに、咲いた花の種類と日時を記録します。

### カラム

| カラム名    | 型          | 説明           |
| ----------- | ----------- | -------------- |
| id          | uuid        | 記録ID         |
| user_id     | uuid        | 記録の持ち主   |
| flower_type | text        | 咲いた花の種類 |
| created_at  | timestamptz | 作成日時       |

### SQL

```sql
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
```

---

## three_good_things

3つのよかったことを保存するテーブルです。

### 目的

ユーザーがその日にあった「よかったこと」を3つ記録します。

同じユーザーが同じ日に複数件作らないように、`user_id` と `date` の組み合わせをユニークにします。

### カラム

| カラム名   | 型          | 説明          |
| ---------- | ----------- | ------------- |
| id         | uuid        | 記録ID        |
| user_id    | uuid        | 記録の持ち主  |
| date       | date        | 記録日        |
| things1    | text        | よかったこと1 |
| things2    | text        | よかったこと2 |
| things3    | text        | よかったこと3 |
| created_at | timestamptz | 作成日時      |

### SQL

```sql
drop table if exists public.three_good_things;

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

```
