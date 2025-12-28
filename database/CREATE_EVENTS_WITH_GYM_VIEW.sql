-- ============================================================================
-- CREATE EVENTS_WITH_GYM VIEW
-- ============================================================================
-- This view combines events and events_archive tables with gym information
-- Used by the dashboard to display all events (active and archived)
-- 
-- Last Updated: December 28, 2025
-- Note: For the most up-to-date version, see FIX_ACKNOWLEDGED_ERRORS_COMPLETE.sql
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS events_with_gym;

-- Create the complete view with ALL columns
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
  -- Availability columns
  e.has_openings,
  e.registration_start_date,
  e.registration_end_date,
  -- Gym info
  g.name AS gym_name,
  g.id AS gym_code
FROM events e
LEFT JOIN gyms g ON e.gym_id = g.id
WHERE e.deleted_at IS NULL  -- Exclude soft-deleted events

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
-- VERIFICATION QUERY
-- Run this to confirm the view was created with all columns:
-- ============================================================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'events_with_gym'
-- ORDER BY ordinal_position;
