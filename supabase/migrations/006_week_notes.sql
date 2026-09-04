-- ============================================================
-- SCHEDOO — WEEK NOTES
-- One optional free-text note per agent per week, written by the
-- employee when registering their week and shown to managers next
-- to that employee's preferences on the schedule page.
-- ============================================================

create table if not exists week_notes (
  id         uuid default gen_random_uuid() primary key,
  week_id    uuid references weeks(id)  on delete cascade not null,
  agent_id   uuid references agents(id) on delete cascade not null,
  note       text not null default '',
  updated_at timestamptz default now(),
  unique (week_id, agent_id)
);

create index if not exists week_notes_week_idx on week_notes(week_id);

alter table week_notes enable row level security;

-- Managers of the team can read/manage. Employees read/write their own note
-- through the API (service role), so no separate agent policy is required.
drop policy if exists "week_notes v2" on week_notes;
create policy "week_notes v2" on week_notes for all
  using      (exists (select 1 from weeks w where w.id = week_id and can_manage_team(w.team_id)))
  with check (exists (select 1 from weeks w where w.id = week_id and can_manage_team(w.team_id)));
