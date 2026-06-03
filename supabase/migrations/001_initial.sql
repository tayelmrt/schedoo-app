-- ============================================================
-- SHIFT SCHEDULER — Initial Schema
-- ============================================================

-- Profiles (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT NOT NULL,
  manager_emails TEXT[]       DEFAULT '{}',
  admin_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name        TEXT    NOT NULL,
  start_time  TIME,
  end_time    TIME,
  color_code  TEXT    DEFAULT '#94a3b8',
  is_off      BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Requirements (min agents per shift per day)
CREATE TABLE IF NOT EXISTS requirements (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id             UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  day_of_week         SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon…7=Sun
  shift_id            UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  min_agents_required INTEGER NOT NULL DEFAULT 0,
  UNIQUE (team_id, day_of_week, shift_id)
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Weeks
CREATE TABLE IF NOT EXISTS weeks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id          UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  week_start_date  DATE NOT NULL,          -- always a Monday
  status           TEXT DEFAULT 'open' CHECK (status IN ('open','confirmed')),
  confirmed_at     TIMESTAMPTZ,
  export_url_excel TEXT,
  export_url_pdf   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, week_start_date)
);

-- Schedule entries
CREATE TABLE IF NOT EXISTS schedule_entries (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id      UUID REFERENCES weeks(id) ON DELETE CASCADE NOT NULL,
  agent_id     UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  shift_id     UUID REFERENCES shifts(id) ON DELETE SET NULL,
  status       TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  submitted_at TIMESTAMPTZ,
  UNIQUE (week_id, agent_id, day_of_week)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- Teams
CREATE POLICY "Admin owns teams" ON teams FOR ALL USING (auth.uid() = admin_id);

-- Shifts
CREATE POLICY "Admin manages shifts" ON shifts FOR ALL
  USING (EXISTS (SELECT 1 FROM teams WHERE teams.id = shifts.team_id AND teams.admin_id = auth.uid()));

-- Requirements
CREATE POLICY "Admin manages requirements" ON requirements FOR ALL
  USING (EXISTS (SELECT 1 FROM teams WHERE teams.id = requirements.team_id AND teams.admin_id = auth.uid()));

-- Agents
CREATE POLICY "Admin manages agents" ON agents FOR ALL
  USING (EXISTS (SELECT 1 FROM teams WHERE teams.id = agents.team_id AND teams.admin_id = auth.uid()));

-- Public read for share token (agents access via API/service role)
CREATE POLICY "Public read agents by token" ON agents FOR SELECT USING (TRUE);

-- Weeks
CREATE POLICY "Admin manages weeks" ON weeks FOR ALL
  USING (EXISTS (SELECT 1 FROM teams WHERE teams.id = weeks.team_id AND teams.admin_id = auth.uid()));

-- Schedule entries
CREATE POLICY "Admin manages entries" ON schedule_entries FOR ALL
  USING (EXISTS (
    SELECT 1 FROM weeks w
    JOIN   teams  t ON t.id = w.team_id
    WHERE  w.id = schedule_entries.week_id AND t.admin_id = auth.uid()
  ));

CREATE POLICY "Public insert/update entries" ON schedule_entries
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Public update entries" ON schedule_entries
  FOR UPDATE USING (TRUE);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
