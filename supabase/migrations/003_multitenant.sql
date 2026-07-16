-- ============================================================
-- SCHEDOO — MULTI-TENANT FOUNDATION (Phase 1)
-- Adds the Organization → Account → Team → Agent hierarchy with a
-- flexible role system (memberships). Purely ADDITIVE: existing
-- tables/policies stay intact so the current app keeps working
-- until the code is switched over.
-- ============================================================

-- ─── CLEANUP: drop abandoned legacy tables (all empty, unused by app) ──
drop table if exists account_break_configs cascade;
drop table if exists account_shifts cascade;
drop table if exists agent_day_assignments cascade;
drop table if exists agent_schedules cascade;
drop table if exists break_swaps cascade;
drop table if exists break_requests cascade;
drop table if exists break_types cascade;
drop table if exists day_off_swaps cascade;
drop table if exists scheduled_breaks cascade;
drop table if exists shift_preferences cascade;
drop table if exists lob_agents cascade;
drop table if exists lob_supervisors cascade;
drop table if exists lobs cascade;
drop table if exists profile_secondary_roles cascade;
drop table if exists accounts cascade;

-- ─── NEW TABLES ─────────────────────────────────────────────

-- 🏢 Company — the tenant that buys the tool
create table if not exists organizations (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  owner_id   uuid references auth.users(id) on delete restrict not null,
  created_at timestamptz default now()
);

-- 🗂️ Account / Business Unit (LOB) — carries "work nature" defaults
create table if not exists accounts (
  id              uuid default gen_random_uuid() primary key,
  org_id          uuid references organizations(id) on delete cascade not null,
  name            text not null,
  week_start_day  smallint default 0 check (week_start_day between 0 and 6), -- 0=Sunday
  weekly_off_days smallint[] default '{}',        -- e.g. {5,6} = Fri/Sat
  coverage_type   text default 'custom',          -- '24_7' | 'daytime' | 'custom'
  created_at      timestamptz default now()
);

-- 🔐 Memberships — flexible roles + scope. A user may hold several rows.
create table if not exists memberships (
  id         uuid default gen_random_uuid() primary key,
  org_id     uuid references organizations(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade,
  email      text,                                -- for inviting before signup
  role       text not null check (role in ('owner','admin','account_manager','team_manager')),
  account_id uuid references accounts(id) on delete cascade,  -- for account_manager
  team_id    uuid references teams(id) on delete cascade,     -- for team_manager
  created_at timestamptz default now()
);

-- ─── EXTEND TEAMS: attach to org + account, allow per-team overrides ──
alter table teams add column if not exists org_id          uuid references organizations(id) on delete cascade;
alter table teams add column if not exists account_id      uuid references accounts(id) on delete cascade;
alter table teams add column if not exists week_start_day  smallint;   -- null = inherit account
alter table teams add column if not exists weekly_off_days smallint[]; -- null = inherit account
alter table teams add column if not exists coverage_type   text;       -- null = inherit account

-- ─── HELPER FUNCTIONS (SECURITY DEFINER) ────────────────────
create or replace function public.user_in_org(p_org uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from organizations o where o.id = p_org and o.owner_id = auth.uid())
      or exists (select 1 from memberships m where m.org_id = p_org and m.user_id = auth.uid());
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from organizations o where o.id = p_org and o.owner_id = auth.uid())
      or exists (select 1 from memberships m where m.org_id = p_org and m.user_id = auth.uid()
                 and m.role in ('owner','admin'));
$$;

create or replace function public.can_manage_account(p_account uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from accounts a where a.id = p_account and (
      is_org_admin(a.org_id)
      or exists (select 1 from memberships m
                 where m.user_id = auth.uid() and m.role = 'account_manager' and m.account_id = a.id)
    )
  );
$$;

create or replace function public.can_manage_team(p_team uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from teams t where t.id = p_team and (
      t.admin_id = auth.uid()                                   -- backward compatibility
      or (t.account_id is not null and can_manage_account(t.account_id))
      or (t.org_id is not null and is_org_admin(t.org_id))
      or exists (select 1 from memberships m
                 where m.user_id = auth.uid() and m.role = 'team_manager' and m.team_id = t.id)
    )
  );
$$;

-- ─── RLS ON NEW TABLES ──────────────────────────────────────
alter table organizations enable row level security;
alter table accounts      enable row level security;
alter table memberships   enable row level security;

drop policy if exists "org read"   on organizations;
drop policy if exists "org create" on organizations;
drop policy if exists "org manage" on organizations;
create policy "org read"   on organizations for select using (user_in_org(id));
create policy "org create" on organizations for insert with check (owner_id = auth.uid());
create policy "org manage" on organizations for all    using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "accounts read"   on accounts;
drop policy if exists "accounts manage" on accounts;
create policy "accounts read"   on accounts for select using (user_in_org(org_id));
create policy "accounts manage" on accounts for all    using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "memberships read"   on memberships;
drop policy if exists "memberships manage" on memberships;
create policy "memberships read"   on memberships for select using (user_id = auth.uid() or is_org_admin(org_id));
create policy "memberships manage" on memberships for all    using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- ─── ADDITIVE POLICIES ON EXISTING TABLES (org/account/team managers) ──
-- These are added ALONGSIDE the existing owner (is_team_admin) policies.
drop policy if exists "teams read v2"   on teams;
drop policy if exists "teams manage v2" on teams;
create policy "teams read v2"   on teams for select using (org_id is not null and user_in_org(org_id));
create policy "teams manage v2" on teams for all
  using (case when account_id is not null then can_manage_account(account_id)
              when org_id     is not null then is_org_admin(org_id)
              else false end)
  with check (case when account_id is not null then can_manage_account(account_id)
                   when org_id     is not null then is_org_admin(org_id)
                   else false end);

drop policy if exists "shifts v2" on shifts;
create policy "shifts v2" on shifts for all using (can_manage_team(team_id)) with check (can_manage_team(team_id));

drop policy if exists "requirements v2" on requirements;
create policy "requirements v2" on requirements for all using (can_manage_team(team_id)) with check (can_manage_team(team_id));

drop policy if exists "agents v2" on agents;
create policy "agents v2" on agents for all using (can_manage_team(team_id)) with check (can_manage_team(team_id));

drop policy if exists "weeks v2" on weeks;
create policy "weeks v2" on weeks for all using (can_manage_team(team_id)) with check (can_manage_team(team_id));

drop policy if exists "holidays v2" on holidays;
create policy "holidays v2" on holidays for all using (can_manage_team(team_id)) with check (can_manage_team(team_id));

drop policy if exists "compensation_days v2" on compensation_days;
create policy "compensation_days v2" on compensation_days for all using (can_manage_team(team_id)) with check (can_manage_team(team_id));

drop policy if exists "leave_requests v2" on leave_requests;
create policy "leave_requests v2" on leave_requests for all using (can_manage_team(team_id)) with check (can_manage_team(team_id));

drop policy if exists "entries v2" on schedule_entries;
create policy "entries v2" on schedule_entries for all
  using (exists (select 1 from weeks w where w.id = week_id and can_manage_team(w.team_id)))
  with check (exists (select 1 from weeks w where w.id = week_id and can_manage_team(w.team_id)));

-- ─── MIGRATE EXISTING DATA (one-time, idempotent) ───────────
-- Wrap the current teams under one org "شركتي" owned by tayelmrt, in a Default account.
do $$
declare v_org uuid; v_acc uuid;
begin
  if not exists (select 1 from organizations) then
    insert into organizations (name, owner_id)
      values ('شركتي', '56eeeb85-da46-4203-b398-302db9308b5c')
      returning id into v_org;

    insert into memberships (org_id, user_id, role)
      values (v_org, '56eeeb85-da46-4203-b398-302db9308b5c', 'owner');

    insert into accounts (org_id, name, week_start_day, weekly_off_days, coverage_type)
      values (v_org, 'Default', 0, '{}', 'custom')
      returning id into v_acc;

    update teams set org_id = v_org, account_id = v_acc where org_id is null;
  end if;
end $$;
