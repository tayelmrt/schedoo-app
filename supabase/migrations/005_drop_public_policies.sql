-- SECURITY FIX: remove legacy pre-multitenant "Public = true" RLS policies that
-- let the public/authenticated role read (and for schedule_entries also write)
-- across ALL organizations. The v2 policies (can_manage_team / is_org_admin /
-- user_in_org) enforce proper per-org isolation; agent flows use the service
-- role, so removing these does not affect functionality.
-- Verified: owner still sees their org's data; an outsider sees zero rows.
drop policy if exists "Public read agents"        on agents;
drop policy if exists "Public read requirements"  on requirements;
drop policy if exists "Public read entries"       on schedule_entries;
drop policy if exists "Public insert entries"     on schedule_entries;
drop policy if exists "Public update entries"     on schedule_entries;
drop policy if exists "Public read shifts"        on shifts;
drop policy if exists "Public read team by token" on teams;
drop policy if exists "Public read weeks"         on weeks;
