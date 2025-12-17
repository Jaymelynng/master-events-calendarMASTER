-- Add data quality audit columns to events table
-- These columns track description quality and validation issues

-- Add has_flyer column (boolean indicating if event has a flyer/image)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS has_flyer BOOLEAN DEFAULT FALSE;

-- Add flyer_url column (URL to the flyer image if exists)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS flyer_url TEXT;

-- Add description_status column (none, flyer_only, full, unknown)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS description_status TEXT DEFAULT 'unknown';

-- Add validation_errors column (JSONB array of validation issues)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN events.has_flyer IS 'Whether the event has a flyer/promotional image';
COMMENT ON COLUMN events.flyer_url IS 'URL to the event flyer image';
COMMENT ON COLUMN events.description_status IS 'Status of description: none, flyer_only, full, or unknown';
COMMENT ON COLUMN events.validation_errors IS 'Array of validation issues found (date mismatch, program mismatch, etc.)';

-- Update the events_with_gym view to include these columns
-- (The view should automatically include them since it selects e.*)
-- But let's recreate it to be safe:

CREATE OR REPLACE VIEW events_with_gym AS
SELECT 
  e.*,
  g.name AS gym_name,
  g.id AS gym_code
FROM events e
LEFT JOIN gyms g ON e.gym_id = g.id;

-- Grant access to the view
GRANT SELECT ON events_with_gym TO anon, authenticated;

-- Create index for filtering events by description status
CREATE INDEX IF NOT EXISTS idx_events_description_status 
ON events(description_status) 
WHERE description_status IN ('none', 'flyer_only');

-- Create index for filtering events with validation errors
CREATE INDEX IF NOT EXISTS idx_events_has_validation_errors 
ON events((validation_errors != '[]'::jsonb)) 
WHERE validation_errors != '[]'::jsonb;


