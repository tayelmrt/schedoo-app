-- ============================================================
-- SCHEDOO — AUTO-CLOSE REGISTRATION + AUTO-EXPORT ON CLOSE
--
-- A week can be closed for registration (manually by the manager, or
-- automatically at `auto_close_at`). Closing a week locks employee
-- self-registration and triggers an export + email of the collected
-- requests to the team's managers (and an optional extra recipient).
-- `status` stays 'open' until the manager confirms the final schedule.
-- ============================================================

-- Per-week registration lock + auto-close schedule
alter table weeks
  add column if not exists registration_locked boolean not null default false,
  add column if not exists auto_close_at        timestamptz,
  add column if not exists auto_closed_at       timestamptz;

-- Optional extra recipient the schedule is auto-sent to on close
alter table teams
  add column if not exists auto_export_email text;
