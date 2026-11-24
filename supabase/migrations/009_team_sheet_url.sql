-- ============================================================
-- SCHEDOO — GOOGLE SHEET SOURCE FOR THE FINAL SCHEDULE
-- The manager's final (director-edited) schedule lives in a Google
-- Sheet. Store its link per team so the tool can pull the final
-- version straight from it (no copy/paste) and overwrite the week.
-- The sheet must be shared "anyone with the link can view".
-- ============================================================

alter table teams
  add column if not exists sheet_url text;
