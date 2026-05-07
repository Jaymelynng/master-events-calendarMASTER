-- ============================================================================
-- CREATE MONTHLY_REQUIREMENTS TABLE — per-month event compliance thresholds
-- ============================================================================
-- One row per event_type. The number says "every gym should have at least
-- this many of this event type per month." The Monthly Requirements admin
-- bar lets a non-technical user add/edit/remove rows; the per-gym table on
-- the calendar uses the rows to compute "Complete vs Needs Events" status.
--
-- Backfilling this file: the table existed in production with only a
-- read-only policy, which broke the admin bar's add/edit/delete on
-- May 6, 2026. RLS pattern below mirrors `CREATE_RULES_TABLE.sql` exactly.
--
-- Created (file): May 6, 2026
-- ============================================================================

-- Step 1: Table
CREATE TABLE IF NOT EXISTS monthly_requirements (
  event_type     TEXT    NOT NULL PRIMARY KEY,  -- 'CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM', etc.
  required_count INTEGER NOT NULL                -- Minimum count per gym per month
);

-- Step 2: Enable RLS
ALTER TABLE monthly_requirements ENABLE ROW LEVEL SECURITY;

-- Step 3: Policy — same "open access" pattern used by `rules`, `gyms`,
-- `events`, etc. The admin UI uses the anon key to upsert/delete; without
-- this policy Supabase rejects every write with
-- "new row violates row-level security policy".
DROP POLICY IF EXISTS "Allow all access to monthly_requirements" ON monthly_requirements;
CREATE POLICY "Allow all access to monthly_requirements"
  ON monthly_requirements
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 4: Grants
GRANT ALL ON monthly_requirements TO anon, authenticated;

-- Step 5: Seed defaults — only inserted on a fresh DB; existing rows
-- preserved by ON CONFLICT DO NOTHING.
INSERT INTO monthly_requirements (event_type, required_count) VALUES
  ('CLINIC', 1),
  ('KIDS NIGHT OUT', 2),
  ('OPEN GYM', 1)
ON CONFLICT (event_type) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT * FROM monthly_requirements ORDER BY event_type;
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='monthly_requirements';
-- ============================================================================
