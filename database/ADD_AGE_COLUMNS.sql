-- Add age_min and age_max columns to events table
-- Run this in Supabase SQL Editor

ALTER TABLE events
ADD COLUMN IF NOT EXISTS age_min INTEGER,
ADD COLUMN IF NOT EXISTS age_max INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN events.age_min IS 'Minimum age for event participants';
COMMENT ON COLUMN events.age_max IS 'Maximum age for event participants';








