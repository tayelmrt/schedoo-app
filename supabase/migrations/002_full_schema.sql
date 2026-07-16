-- ============================================================
-- SCHEDOO — FULL CURRENT SCHEMA (authoritative rebuild)
-- Recreates every table, column, RLS policy and trigger the app
-- expects. Safe to run on an empty database.
-- Week convention: 1=Sunday … 7=Saturday (Egypt).
-- ============================================================

create extension if not exists pgcrypto;

-- ─── TABLES ─────────────────────────────────────────────────

create table if not exists profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text not null,
  created_at timestamptz default now()
);

create table if not exists teams (
  id             uuid default gen_random_uuid() primary key,
  name           text not null,
  admin_id       uuid references profiles(id) on delete cascade not null,
  admin_emails   text[] default '{}',
  manager_emails text[] default '{}',
  created_at     timestamptz default now()
);

create table if not exists shifts (
  id         uuid default gen_random_uuid() primary key,
  team_id    uuid references teams(id) on delete cascade not null,
  name       text not null,
  start_time time,
  end_time   time,
  color_code text default '#94a3b8',
  is_off     boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists requirements (
  id                  uuid default gen_random_uuid() primary key,
  team_id             uuid references teams(id) on delete cascade not null,
  day_of_week         smallint not null check (day_of_week between 1 and 7),
  shift_id            uuid references shifts(id) on delete cascade not null,
  min_agents_required integer not null default 0,
  max_agents          integer,
  unique (team_id, day_of_week, shift_id)
);

create table if not exists agents (
  id                 uuid default gen_random_uuid() primary key,
  team_id            uuid references teams(id) on delete cascade not null,
  name               text not null,
  email              text,
  auth_user_id       uuid references auth.users(id) on delete set null,
  status             text not null default 'pending' check (status in ('pending','approved')),
  share_token        text unique default encode(gen_random_bytes(16),'hex'),
  is_active          boolean default true,
  annual_entitlement integer default 21,
  sick_entitlement   integer default 6,
  created_at         timestamptz default now()
);

create table if not exists weeks (
  id               uuid default gen_random_uuid() primary key,
  team_id          uuid references teams(id) on delete cascade not null,
  week_start_date  date not null,               -- always a Sunday
  status           text default 'open' check (status in ('open','confirmed')),
  confirmed_at     timestamptz,
  export_url_excel text,
  export_url_pdf   text,
  created_at       timestamptz default now(),
  unique (team_id, week_start_date)
);

create table if not exists schedule_entries (
  id           uuid default gen_random_uuid() primary key,
  week_id      uuid references weeks(id) on delete cascade not null,
  agent_id     uuid references agents(id) on delete cascade not null,
  day_of_week  smallint not null check (day_of_week between 1 and 7),
  shift_id     uuid references shifts(id) on delete set null,
  status       text default 'draft' check (status in ('draft','submitted')),
  submitted_at timestamptz,
  unique (week_id, agent_id, day_of_week)
);

create table if not exists leave_requests (
  id          uuid default gen_random_uuid() primary key,
  team_id     uuid references teams(id) on delete cascade not null,
  agent_id    uuid references agents(id) on delete cascade not null,
  type        text not null check (type in ('annual','sick','unpaid')),
  start_date  date not null,
  end_date    date not null,
  days        integer not null default 1,
  reason      text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at  timestamptz default now()
);

create table if not exists holidays (
  id         uuid default gen_random_uuid() primary key,
  team_id    uuid references teams(id) on delete cascade not null,
  date       date not null,
  name       text not null,
  created_at timestamptz default now()
);

create table if not exists compensation_days (
  id           uuid default gen_random_uuid() primary key,
  team_id      uuid references teams(id) on delete cascade not null,
  agent_id     uuid references agents(id) on delete cascade not null,
  holiday_id   uuid references holidays(id) on delete cascade not null,
  holiday_date date,
  holiday_name text,
  granted      boolean default false,
  granted_at   timestamptz,
  used         boolean default false,
  used_date    date,
  notes        text,
  created_at   timestamptz default now(),
  unique (agent_id, holiday_id)
);

-- ─── HELPER: is the caller an admin/co-admin of a team? ─────
-- SECURITY DEFINER so it can read teams without recursive RLS.
create or replace function public.is_team_admin(p_team uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team
      and (
        t.admin_id = auth.uid()
        or lower(auth.jwt() ->> 'email') = any (
             select lower(e) from unnest(coalesce(t.admin_emails, '{}')) e )
      )
  );
$$;

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
alter table profiles          enable row level security;
alter table teams             enable row level security;
alter table shifts            enable row level security;
alter table requirements      enable row level security;
alter table agents            enable row level security;
alter table weeks             enable row level security;
alter table schedule_entries  enable row level security;
alter table leave_requests    enable row level security;
alter table holidays          enable row level security;
alter table compensation_days enable row level security;

-- Profiles: own row only
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Teams: owner or co-admin (by email)
drop policy if exists "teams select" on teams;
create policy "teams select" on teams for select using (
  admin_id = auth.uid()
  or lower(auth.jwt() ->> 'email') = any (select lower(e) from unnest(coalesce(admin_emails,'{}')) e)
);
drop policy if exists "teams insert" on teams;
create policy "teams insert" on teams for insert with check (admin_id = auth.uid());
drop policy if exists "teams update" on teams;
create policy "teams update" on teams for update using (
  admin_id = auth.uid()
  or lower(auth.jwt() ->> 'email') = any (select lower(e) from unnest(coalesce(admin_emails,'{}')) e)
);
drop policy if exists "teams delete" on teams;
create policy "teams delete" on teams for delete using (admin_id = auth.uid());

-- Child tables scoped by team_id
drop policy if exists "shifts admin" on shifts;
create policy "shifts admin" on shifts for all
  using (is_team_admin(team_id)) with check (is_team_admin(team_id));

drop policy if exists "requirements admin" on requirements;
create policy "requirements admin" on requirements for all
  using (is_team_admin(team_id)) with check (is_team_admin(team_id));

drop policy if exists "agents admin" on agents;
create policy "agents admin" on agents for all
  using (is_team_admin(team_id)) with check (is_team_admin(team_id));

drop policy if exists "weeks admin" on weeks;
create policy "weeks admin" on weeks for all
  using (is_team_admin(team_id)) with check (is_team_admin(team_id));

drop policy if exists "leave_requests admin" on leave_requests;
create policy "leave_requests admin" on leave_requests for all
  using (is_team_admin(team_id)) with check (is_team_admin(team_id));

drop policy if exists "holidays admin" on holidays;
create policy "holidays admin" on holidays for all
  using (is_team_admin(team_id)) with check (is_team_admin(team_id));

drop policy if exists "compensation_days admin" on compensation_days;
create policy "compensation_days admin" on compensation_days for all
  using (is_team_admin(team_id)) with check (is_team_admin(team_id));

-- Schedule entries: scoped by the week's team
drop policy if exists "entries admin" on schedule_entries;
create policy "entries admin" on schedule_entries for all
  using (exists (select 1 from weeks w where w.id = week_id and is_team_admin(w.team_id)))
  with check (exists (select 1 from weeks w where w.id = week_id and is_team_admin(w.team_id)));

-- NOTE: Agent-facing reads/writes go through server API routes using the
-- service_role key, which bypasses RLS. No public/anon policies are needed.

-- ─── AUTO-CREATE PROFILE ON SIGNUP ──────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
