-- Future Plans table: tracks planned features, improvements, and ideas
-- Accessible from Admin Dashboard > Future Plans tab
-- Both Jayme and AI sessions can add/edit entries

CREATE TABLE IF NOT EXISTS future_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'feature',  -- feature, bug_fix, improvement, idea, expansion
  priority TEXT NOT NULL DEFAULT 'medium',    -- low, medium, high, critical
  status TEXT NOT NULL DEFAULT 'planning',    -- planning, ready, in_progress, completed, on_hold
  target_area TEXT,                           -- frontend, backend, database, validation, admin, sync, docs
  added_by TEXT DEFAULT 'manual',             -- manual, ai_session, jayme
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_future_plans_status ON future_plans(status);
CREATE INDEX IF NOT EXISTS idx_future_plans_category ON future_plans(category);
CREATE INDEX IF NOT EXISTS idx_future_plans_priority ON future_plans(priority);

-- Enable RLS
ALTER TABLE future_plans ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon (same pattern as other tables in this project)
CREATE POLICY "Allow all for anon" ON future_plans FOR ALL USING (true) WITH CHECK (true);

-- Seed with known future plans from current documentation
INSERT INTO future_plans (title, description, category, priority, status, target_area, added_by) VALUES
  ('Move hardcoded keywords to database', 'KNO, CLINIC, OPEN GYM title/description keywords are hardcoded in Python. Move to gym_valid_values with gym_id=ALL so they can be managed from Admin Dashboard.', 'improvement', 'high', 'ready', 'validation', 'ai_session'),
  ('Fix year-in-description validation', 'Year mismatch only checks title, not description. A gym could copy 2025 event to 2026, change title year but leave description saying 2025.', 'bug_fix', 'high', 'ready', 'validation', 'ai_session'),
  ('Build program_ignore rule type', 'Cannot ignore "open gym" when it appears as a station/activity name inside a KNO event description. Need a rule type that suppresses specific program_mismatch errors.', 'feature', 'medium', 'planning', 'validation', 'ai_session'),
  ('Make event types database-driven', 'Currently 5 hardcoded types (CAMP, CLINIC, KNO, OPEN GYM, SPECIAL EVENT). For expansion to non-gymnastics businesses, these should come from a database table with configurable validation rules per type.', 'expansion', 'low', 'planning', 'database', 'ai_session'),
  ('Migrate EventsDashboard.js to refactored version', 'Refactored version exists at EventsDashboard_REFACTORED.js (519 lines vs 4000+) but App.js still imports the monolithic file. Needs testing before switch.', 'improvement', 'medium', 'on_hold', 'frontend', 'ai_session'),
  ('Add max age validation', 'Only minimum age is validated currently. Should also check maximum age in title/description matches iClass data.', 'feature', 'low', 'planning', 'validation', 'ai_session'),
  ('Move skills list to database', 'Clinic skill keywords (cartwheel, back handspring, etc.) are hardcoded twice in Python. Should be a database-driven list so new skills can be added from admin.', 'improvement', 'medium', 'planning', 'validation', 'ai_session'),
  ('Restrict CORS to Vercel domain', 'Flask API currently allows all origins. Should restrict to teamcalendar.mygymtools.com for security.', 'bug_fix', 'medium', 'planning', 'backend', 'ai_session')
ON CONFLICT DO NOTHING;
