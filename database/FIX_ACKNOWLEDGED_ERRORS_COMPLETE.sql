-- COMPLETE FIX for acknowledged_errors column
-- Run this in Supabase SQL Editor

-- Step 1: Add the column to events table (if not exists)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS acknowledged_errors JSONB DEFAULT '[]'::jsonb;

-- Step 2: Add the column to events_archive table too (for consistency)
ALTER TABLE events_archive
ADD COLUMN IF NOT EXISTS acknowledged_errors JSONB DEFAULT '[]'::jsonb;

-- Step 3: Drop the existing view
DROP VIEW IF EXISTS events_with_gym;

-- Step 4: Recreate the view with ALL columns from events table
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
  e.availability_status,
  e.has_flyer,
  e.flyer_url,
  e.description_status,
  e.validation_errors,
  e.acknowledged_errors,  -- THE NEW COLUMN!
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
  a.availability_status,
  a.has_flyer,
  a.flyer_url,
  a.description_status,
  a.validation_errors,
  a.acknowledged_errors,  -- THE NEW COLUMN!
  g.name AS gym_name,
  g.id AS gym_code
FROM events_archive a
LEFT JOIN gyms g ON a.gym_id = g.id;

-- Step 5: Grant permissions
GRANT SELECT ON events_with_gym TO anon, authenticated;

-- Step 6: Verify it worked
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'acknowledged_errors';

