-- Per-team scheduling mode: how the weekly schedule is produced.
--   self_service — agents register their own preferred shifts
--   top_down     — management assigns; agents are view-only
--   hybrid       — both (agents register, managers edit/fill gaps) [default]
alter table teams add column if not exists scheduling_mode text default 'hybrid'
  check (scheduling_mode in ('self_service','top_down','hybrid'));
