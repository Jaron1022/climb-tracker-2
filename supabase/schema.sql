create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  device_id text not null default 'supabase-account',
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.climbs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  photo_url text,
  grade text not null check (grade in ('VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10')),
  flashed boolean not null default false,
  grade_modifier text check (grade_modifier in ('-', '+') or grade_modifier is null),
  style_tags text[] not null default '{}',
  wall_name text,
  notes text,
  status text not null default 'completed' check (status = 'completed'),
  climbed_on date not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists climbs_profile_id_created_at_idx on public.climbs (profile_id, climbed_on desc, created_at desc);

alter table public.profiles enable row level security;
alter table public.climbs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "climbs_select_own" on public.climbs;
create policy "climbs_select_own"
on public.climbs
for select
using (auth.uid() = profile_id);

drop policy if exists "climbs_insert_own" on public.climbs;
create policy "climbs_insert_own"
on public.climbs
for insert
with check (auth.uid() = profile_id);

drop policy if exists "climbs_update_own" on public.climbs;
create policy "climbs_update_own"
on public.climbs
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "climbs_delete_own" on public.climbs;
create policy "climbs_delete_own"
on public.climbs
for delete
using (auth.uid() = profile_id);
