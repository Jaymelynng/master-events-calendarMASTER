-- ============================================================================
-- REQUIREMENT NOTES - Track status of missing requirements
-- ============================================================================
-- Stores notes on why a gym is missing a requirement and its current status.
-- Example: SGT missing CLINIC for March - "Looking for new date. Per Allie."
--
-- Created: February 23, 2026
-- ============================================================================

CREATE TABLE IF NOT EXISTS requirement_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id TEXT NOT NULL,
  program TEXT NOT NULL,
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gym_id, program, month)
);

ALTER TABLE requirement_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to requirement_notes" ON requirement_notes FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON requirement_notes TO anon, authenticated;
