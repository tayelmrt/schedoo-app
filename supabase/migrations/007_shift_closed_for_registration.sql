-- ============================================================
-- SCHEDOO — CLOSE A SHIFT FOR SELF-REGISTRATION
-- When true, employees cannot pick this shift on /me (it is hidden
-- from the registration picker). Managers can still assign it in the
-- schedule. Use it to fully close a shift, e.g. a 9pm night shift.
-- ============================================================

alter table shifts
  add column if not exists closed_for_registration boolean not null default false;
