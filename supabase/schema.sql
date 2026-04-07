create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  selected_emblems text[] not null default '{}',
  selected_avatar_border text,
  selected_theme text,
  device_id text not null default 'supabase-account',
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles
add column if not exists avatar_url text;

alter table public.profiles
add column if not exists selected_emblems text[] not null default '{}';

alter table public.profiles
add column if not exists selected_avatar_border text;

alter table public.profiles
add column if not exists selected_theme text;

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

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  photo_url text,
  grade text not null check (grade in ('VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10')),
  grade_modifier text check (grade_modifier in ('-', '+') or grade_modifier is null),
  style_tags text[] not null default '{}',
  wall_name text,
  notes text,
  first_logged_on date not null,
  last_worked_on date not null,
  session_count integer not null default 1 check (session_count >= 1),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

create table if not exists public.session_kudos (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  climbed_on date not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  check (sender_id <> recipient_id)
);

create table if not exists public.session_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  session_on date not null,
  note text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists climbs_profile_id_created_at_idx on public.climbs (profile_id, climbed_on desc, created_at desc);
create index if not exists projects_profile_id_last_worked_idx on public.projects (profile_id, last_worked_on desc, created_at desc);
create unique index if not exists friendships_unique_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id, status, created_at desc);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status, created_at desc);
create unique index if not exists session_kudos_unique_session_like_idx on public.session_kudos (sender_id, recipient_id, climbed_on);
create index if not exists session_kudos_recipient_idx on public.session_kudos (recipient_id, climbed_on desc, created_at desc);
create index if not exists session_kudos_sender_idx on public.session_kudos (sender_id, created_at desc);
create unique index if not exists session_notes_profile_date_idx on public.session_notes (profile_id, session_on);
create index if not exists session_notes_profile_idx on public.session_notes (profile_id, session_on desc, updated_at desc);

alter table public.profiles enable row level security;
alter table public.climbs enable row level security;
alter table public.projects enable row level security;
alter table public.friendships enable row level security;
alter table public.session_kudos enable row level security;
alter table public.session_notes enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
using (auth.uid() is not null);

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

drop policy if exists "climbs_select_friends" on public.climbs;
create policy "climbs_select_friends"
on public.climbs
for select
using (
  exists (
    select 1
    from public.friendships
    where friendships.status = 'accepted'
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = climbs.profile_id)
        or
        (friendships.addressee_id = auth.uid() and friendships.requester_id = climbs.profile_id)
      )
  )
);

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

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
on public.projects
for select
using (auth.uid() = profile_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
on public.projects
for insert
with check (auth.uid() = profile_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
on public.projects
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
on public.projects
for delete
using (auth.uid() = profile_id);

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own"
on public.friendships
for select
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friendships_insert_own" on public.friendships;
create policy "friendships_insert_own"
on public.friendships
for insert
with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "friendships_update_addressee" on public.friendships;
create policy "friendships_update_addressee"
on public.friendships
for update
using (auth.uid() = addressee_id)
with check (auth.uid() = addressee_id and status in ('accepted', 'declined'));

drop policy if exists "friendships_delete_own" on public.friendships;
create policy "friendships_delete_own"
on public.friendships
for delete
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "session_kudos_select_friends" on public.session_kudos;
create policy "session_kudos_select_friends"
on public.session_kudos
for select
using (
  auth.uid() = sender_id
  or auth.uid() = recipient_id
  or exists (
    select 1
    from public.friendships
    where friendships.status = 'accepted'
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = session_kudos.recipient_id)
        or
        (friendships.addressee_id = auth.uid() and friendships.requester_id = session_kudos.recipient_id)
      )
  )
);

drop policy if exists "session_kudos_insert_own" on public.session_kudos;
create policy "session_kudos_insert_own"
on public.session_kudos
for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.friendships
    where friendships.status = 'accepted'
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = session_kudos.recipient_id)
        or
        (friendships.addressee_id = auth.uid() and friendships.requester_id = session_kudos.recipient_id)
      )
  )
);

drop policy if exists "session_kudos_delete_own" on public.session_kudos;
create policy "session_kudos_delete_own"
on public.session_kudos
for delete
using (auth.uid() = sender_id);

drop policy if exists "session_notes_select_own" on public.session_notes;
create policy "session_notes_select_own"
on public.session_notes
for select
using (auth.uid() = profile_id);

drop policy if exists "session_notes_select_friends" on public.session_notes;
create policy "session_notes_select_friends"
on public.session_notes
for select
using (
  exists (
    select 1
    from public.friendships
    where friendships.status = 'accepted'
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = session_notes.profile_id)
        or
        (friendships.addressee_id = auth.uid() and friendships.requester_id = session_notes.profile_id)
      )
  )
);

drop policy if exists "session_notes_insert_own" on public.session_notes;
create policy "session_notes_insert_own"
on public.session_notes
for insert
with check (auth.uid() = profile_id);

drop policy if exists "session_notes_update_own" on public.session_notes;
create policy "session_notes_update_own"
on public.session_notes
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "session_notes_delete_own" on public.session_notes;
create policy "session_notes_delete_own"
on public.session_notes
for delete
using (auth.uid() = profile_id);
