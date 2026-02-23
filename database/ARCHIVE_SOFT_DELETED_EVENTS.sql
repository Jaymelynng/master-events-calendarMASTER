-- ============================================================================
-- ARCHIVE SOFT-DELETED EVENTS
-- ============================================================================
-- Run this in Supabase SQL Editor to update your pg_cron archive job.
-- Currently the midnight job only archives past events (date < today).
-- This adds: also archive soft-deleted events regardless of date.
--
-- Created: February 23, 2026
-- ============================================================================

-- Option A: Run this ONE TIME to clean up existing soft-deleted events right now
INSERT INTO events_archive
SELECT * FROM events WHERE deleted_at IS NOT NULL;

DELETE FROM events WHERE deleted_at IS NOT NULL;

-- Option B: Update the pg_cron job to also handle soft-deletes every midnight
-- Find your existing cron job first:
--   SELECT * FROM cron.job;
-- Then update it. Replace YOUR_JOB_ID with the actual job id:
--
-- SELECT cron.alter_job(
--   YOUR_JOB_ID,
--   command := $$
--     -- Archive past events (original behavior)
--     INSERT INTO events_archive
--     SELECT * FROM events WHERE date < CURRENT_DATE AND deleted_at IS NULL;
--     DELETE FROM events WHERE date < CURRENT_DATE AND deleted_at IS NULL;
--
--     -- Archive soft-deleted events (new behavior)
--     INSERT INTO events_archive
--     SELECT * FROM events WHERE deleted_at IS NOT NULL;
--     DELETE FROM events WHERE deleted_at IS NOT NULL;
--   $$
-- );

-- ============================================================================
-- VERIFICATION: Run after to confirm no soft-deleted events remain
-- ============================================================================
-- SELECT count(*) AS remaining_soft_deleted
-- FROM events
-- WHERE deleted_at IS NOT NULL;
-- (Should return 0)
-- ============================================================================
