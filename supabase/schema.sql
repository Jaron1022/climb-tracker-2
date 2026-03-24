create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.climbs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text,
  grade text not null check (grade in ('V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10')),
  style_tags text[] not null default '{}',
  wall_name text not null check (char_length(wall_name) between 1 and 80),
  notes text,
  status text not null check (status in ('attempted', 'completed')),
  climbed_on date not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.climbs
  alter column wall_name drop not null;

alter table public.climbs
  drop constraint if exists climbs_wall_name_check;

alter table public.climbs
  add constraint climbs_wall_name_check
  check (wall_name is null or char_length(wall_name) between 1 and 120);

create index if not exists climbs_profile_id_idx on public.climbs(profile_id);
create index if not exists climbs_grade_idx on public.climbs(grade);
create index if not exists climbs_climbed_on_idx on public.climbs(climbed_on desc);

alter table public.profiles enable row level security;
alter table public.climbs enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "profiles can be created" on public.profiles;
create policy "profiles can be created"
on public.profiles
for insert
to anon, authenticated
with check (true);

drop policy if exists "climbs are readable" on public.climbs;
create policy "climbs are readable"
on public.climbs
for select
to anon, authenticated
using (true);

drop policy if exists "climbs can be created" on public.climbs;
create policy "climbs can be created"
on public.climbs
for insert
to anon, authenticated
with check (true);

insert into storage.buckets (id, name, public)
values ('climb-photos', 'climb-photos', true)
on conflict (id) do nothing;

drop policy if exists "photos are readable" on storage.objects;
create policy "photos are readable"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'climb-photos');

drop policy if exists "photos can be uploaded" on storage.objects;
create policy "photos can be uploaded"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'climb-photos');
