-- ============================================================================
-- ADD VERIFIED_ERRORS COLUMN TO EVENTS TABLE
-- ============================================================================
-- This column stores verification status for validation errors (correct/incorrect)
-- Used in Admin Panel > Audit & Review for tracking accuracy of validation rules
--
-- Created: February 3, 2026
-- ============================================================================

-- Step 1: Add the verified_errors column to the events table
-- (This stores an array of verification records with verdicts and notes)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS verified_errors JSONB DEFAULT '[]'::jsonb;

-- Step 2: Add the same column to events_archive table (for consistency)
ALTER TABLE events_archive
ADD COLUMN IF NOT EXISTS verified_errors JSONB DEFAULT '[]'::jsonb;

-- Step 3: Recreate the events_with_gym view to include verified_errors
DROP VIEW IF EXISTS events_with_gym;

CREATE VIEW events_with_gym AS
SELECT
  e.id,
  e.gym_id,
  e.title,
  e.date,
  e.time,
  e.price,
  e.type,
  e.event_url,
  e.day_of_week,
  e.start_date,
  e.end_date,
  e.description,
  e.age_min,
  e.age_max,
  e.deleted_at,
  e.created_at,
  e.updated_at,
  -- Data quality columns
  e.availability_status,
  e.has_flyer,
  e.flyer_url,
  e.description_status,
  e.validation_errors,
  e.acknowledged_errors,
  e.verified_errors,          -- NEW: Verification status for audit accuracy tracking
  -- Availability columns
  e.has_openings,
  e.registration_start_date,
  e.registration_end_date,
  -- Gym info
  g.name AS gym_name,
  g.id AS gym_code
FROM events e
LEFT JOIN gyms g ON e.gym_id = g.id
WHERE e.deleted_at IS NULL

UNION ALL

SELECT
  a.id,
  a.gym_id,
  a.title,
  a.date,
  a.time,
  a.price,
  a.type,
  a.event_url,
  a.day_of_week,
  a.start_date,
  a.end_date,
  a.description,
  a.age_min,
  a.age_max,
  a.deleted_at,
  a.created_at,
  a.updated_at,
  -- Data quality columns
  a.availability_status,
  a.has_flyer,
  a.flyer_url,
  a.description_status,
  a.validation_errors,
  a.acknowledged_errors,
  a.verified_errors,          -- NEW: Verification status for audit accuracy tracking
  -- Availability columns
  a.has_openings,
  a.registration_start_date,
  a.registration_end_date,
  -- Gym info
  g.name AS gym_name,
  g.id AS gym_code
FROM events_archive a
LEFT JOIN gyms g ON a.gym_id = g.id;

-- Grant access to the view
GRANT SELECT ON events_with_gym TO anon, authenticated;

-- ============================================================================
-- VERIFICATION: Run this to confirm the column and view were updated:
-- ============================================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'events' AND column_name = 'verified_errors';
--
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'events_with_gym' AND column_name = 'verified_errors';
-- ============================================================================
