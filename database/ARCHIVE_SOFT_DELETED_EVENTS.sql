-- ============================================================================
-- ARCHIVE SOFT-DELETED EVENTS (paste entire block into Supabase SQL Editor)
-- ============================================================================

-- Step 1: Make sure events_archive has all the columns events has
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS age_min INTEGER;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS age_max INTEGER;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS availability_status TEXT;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS has_flyer BOOLEAN DEFAULT false;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS flyer_url TEXT;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS description_status TEXT DEFAULT 'unknown';
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]';
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS acknowledged_errors JSONB DEFAULT '[]';
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS verified_errors JSONB DEFAULT '[]';
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS has_openings BOOLEAN DEFAULT true;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS registration_start_date DATE;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS registration_end_date DATE;

-- Step 2: Move soft-deleted events to archive
INSERT INTO events_archive (
  id, gym_id, title, date, time, price, type, event_url, day_of_week,
  start_date, end_date, description, age_min, age_max,
  deleted_at, created_at, updated_at,
  availability_status, has_flyer, flyer_url,
  description_status, validation_errors, acknowledged_errors,
  verified_errors, has_openings, registration_start_date, registration_end_date
)
SELECT
  id, gym_id, title, date::date, time, price, type, event_url, day_of_week,
  start_date, end_date, description, age_min, age_max,
  deleted_at, created_at, updated_at,
  availability_status, has_flyer, flyer_url,
  description_status, validation_errors, acknowledged_errors,
  verified_errors, has_openings, registration_start_date, registration_end_date
FROM events
WHERE deleted_at IS NOT NULL;

-- Step 3: Remove them from active table
DELETE FROM events WHERE deleted_at IS NOT NULL;
