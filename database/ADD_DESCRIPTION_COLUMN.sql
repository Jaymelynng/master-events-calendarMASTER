-- Add description column to events table
-- This will store the full event description from iClassPro portal

ALTER TABLE events
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN events.description IS 'Full event description from iClassPro portal (HTML stripped, text only)';




