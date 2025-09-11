-- FootTour Schema (Sprint 1)
-- Run in Supabase SQL editor

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  plan text default 'free', -- free | pro | club
  created_at timestamp with time zone default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  sport text not null check (sport in ('football','basketball','handball','volley','futsal')),
  location text,
  dates text,
  format text not null default 'groups_knockout' check (format in ('groups_knockout','knockout')),
  points_win int not null default 3,
  points_draw int not null default 1,
  points_loss int not null default 0,
  slug text unique,
  created_at timestamp with time zone default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  position int,
  created_at timestamp with time zone default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  name text not null,
  logo_url text,
  created_at timestamp with time zone default now()
);

-- Indexes
create index if not exists idx_tournaments_owner on public.tournaments(owner);
create index if not exists idx_groups_tournament on public.groups(tournament_id);
create index if not exists idx_teams_tournament on public.teams(tournament_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.groups enable row level security;
alter table public.teams enable row level security;

-- Profiles policies
drop policy if exists "read_own_profile" on public.profiles;
create policy "read_own_profile" on public.profiles
for select using ( auth.uid() = id );
drop policy if exists "insert_own_profile" on public.profiles;
create policy "insert_own_profile" on public.profiles
for insert with check ( auth.uid() = id );
drop policy if exists "update_own_profile" on public.profiles;
create policy "update_own_profile" on public.profiles
for update using ( auth.uid() = id );

-- Tournaments policies
drop policy if exists "owner_select" on public.tournaments;
create policy "owner_select" on public.tournaments
for select using ( owner = auth.uid() );
drop policy if exists "owner_insert" on public.tournaments;
create policy "owner_insert" on public.tournaments
for insert with check ( owner = auth.uid() );
drop policy if exists "owner_update" on public.tournaments;
create policy "owner_update" on public.tournaments
for update using ( owner = auth.uid() );
drop policy if exists "owner_delete" on public.tournaments;
create policy "owner_delete" on public.tournaments
for delete using ( owner = auth.uid() );

-- Groups policies (inherit from tournament owner)
drop policy if exists "groups_owner_select" on public.groups;
create policy "groups_owner_select" on public.groups
for select using (
  exists (select 1 from public.tournaments t where t.id = groups.tournament_id and t.owner = auth.uid())
);
drop policy if exists "groups_owner_mutation" on public.groups;
create policy "groups_owner_mutation" on public.groups
for all using (
  exists (select 1 from public.tournaments t where t.id = groups.tournament_id and t.owner = auth.uid())
) with check (
  exists (select 1 from public.tournaments t where t.id = groups.tournament_id and t.owner = auth.uid())
);

-- Teams policies (inherit from tournament owner)
drop policy if exists "teams_owner_select" on public.teams;
create policy "teams_owner_select" on public.teams
for select using (
  exists (select 1 from public.tournaments t where t.id = teams.tournament_id and t.owner = auth.uid())
);
drop policy if exists "teams_owner_mutation" on public.teams;
create policy "teams_owner_mutation" on public.teams
for all using (
  exists (select 1 from public.tournaments t where t.id = teams.tournament_id and t.owner = auth.uid())
) with check (
  exists (select 1 from public.tournaments t where t.id = teams.tournament_id and t.owner = auth.uid())
);

-- Trigger to ensure owner on insert default
create or replace function public.set_tournament_owner()
returns trigger language plpgsql as $$
begin
  if new.owner is null then
    new.owner := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_tournament_owner on public.tournaments;
create trigger set_tournament_owner
before insert on public.tournaments
for each row execute function public.set_tournament_owner();

-- Create profile on user signup, using plan from user metadata (free/pro/club)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, plan)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    case when (new.raw_user_meta_data->>'plan') in ('free','pro','club') then new.raw_user_meta_data->>'plan' else 'free' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
