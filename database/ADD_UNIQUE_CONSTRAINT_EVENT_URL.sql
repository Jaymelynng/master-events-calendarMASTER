-- ============================================================================
-- ADD UNIQUE CONSTRAINT ON EVENT_URL TO PREVENT DUPLICATES
-- ============================================================================
-- This constraint prevents duplicate events with the same URL from being
-- inserted into the database, even if client-side checks fail.
-- 
-- IMPORTANT: This must be run AFTER cleaning up any existing duplicates!
-- ============================================================================

-- Step 1: Create a unique index on event_url (base URL without query params)
-- This uses a functional index to strip query parameters before checking uniqueness

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_unique_url 
ON events (SPLIT_PART(event_url, '?', 1))
WHERE event_url IS NOT NULL AND event_url != '';

-- Step 2: Verify the constraint was created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'events'
  AND indexname = 'idx_events_unique_url';

-- ============================================================================
-- WHAT THIS DOES:
-- ============================================================================
-- 1. Creates a unique index on the BASE URL (without query parameters)
-- 2. Prevents ANY duplicate event URLs from being inserted
-- 3. Works even if client-side duplicate detection fails
-- 4. Database will reject duplicates with error: "duplicate key value violates unique constraint"
--
-- EXAMPLE:
-- - First insert: https://portal.iclasspro.com/houstongymnastics/camp-details/841 ✅ SUCCESS
-- - Second insert: https://portal.iclasspro.com/houstongymnastics/camp-details/841 ❌ REJECTED
-- - Third insert: https://portal.iclasspro.com/houstongymnastics/camp-details/841?typeId=27 ❌ REJECTED (same base URL)
--
-- ============================================================================
-- TO REMOVE THIS CONSTRAINT (if needed):
-- ============================================================================
-- DROP INDEX IF EXISTS idx_events_unique_url;
-- ============================================================================



