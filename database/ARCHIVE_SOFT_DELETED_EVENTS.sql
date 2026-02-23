-- ============================================================================
-- ARCHIVE SOFT-DELETED EVENTS
-- ============================================================================
-- Run in Supabase SQL Editor to clean up soft-deleted events.
--
-- The events table has `date` as VARCHAR but events_archive has it as DATE,
-- so we must cast explicitly — SELECT * won't work across the type mismatch.
--
-- Created: February 23, 2026
-- ============================================================================

-- Step 1: Move soft-deleted events to archive (with date cast)
INSERT INTO events_archive
SELECT 
  id, gym_id, title, 
  date::date,
  time, price, type, event_url, day_of_week,
  start_date, end_date, description, age_min, age_max, 
  deleted_at, created_at, updated_at,
  availability_status, has_flyer, flyer_url,
  description_status, validation_errors, acknowledged_errors,
  verified_errors, has_openings, registration_start_date, registration_end_date
FROM events 
WHERE deleted_at IS NOT NULL;

-- Step 2: Remove them from the active table
DELETE FROM events WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- VERIFICATION: Should return 0
-- ============================================================================
-- SELECT count(*) AS remaining_soft_deleted
-- FROM events
-- WHERE deleted_at IS NOT NULL;
-- ============================================================================

-- ============================================================================
-- OPTIONAL: Update pg_cron job to handle soft-deletes every midnight
-- First find your job id:   SELECT * FROM cron.job;
-- Then uncomment and run with your actual job id:
-- ============================================================================
-- SELECT cron.alter_job(
--   YOUR_JOB_ID,
--   command := $$
--     INSERT INTO events_archive
--     SELECT id, gym_id, title, date::date, time, price, type, event_url,
--            day_of_week, start_date, end_date, description, age_min, age_max,
--            deleted_at, created_at, updated_at, availability_status, has_flyer,
--            flyer_url, description_status, validation_errors, acknowledged_errors,
--            verified_errors, has_openings, registration_start_date, registration_end_date
--     FROM events
--     WHERE date::date < CURRENT_DATE OR deleted_at IS NOT NULL;
--
--     DELETE FROM events
--     WHERE date::date < CURRENT_DATE OR deleted_at IS NOT NULL;
--   $$
-- );
