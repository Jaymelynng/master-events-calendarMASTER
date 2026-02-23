-- ============================================================================
-- CREATE archive_single_event() FUNCTION
-- ============================================================================
-- Called by the app when sync detects a deleted event.
-- Copies the event from events → events_archive immediately,
-- handling the date type cast (events.date is VARCHAR, archive.date is DATE).
--
-- Run this ONCE in Supabase SQL Editor to create the function.
-- After this, deleted events are automatically archived on detection.
--
-- Created: February 23, 2026
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_single_event(event_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
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
  WHERE id = event_id
  AND id NOT IN (SELECT id FROM events_archive);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION archive_single_event(UUID) TO anon, authenticated;
