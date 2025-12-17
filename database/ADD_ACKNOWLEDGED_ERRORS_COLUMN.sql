-- Add acknowledged_errors column to events table
-- This allows users to dismiss validation warnings they've verified as false positives

-- Add the column
ALTER TABLE events
ADD COLUMN IF NOT EXISTS acknowledged_errors JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN events.acknowledged_errors IS 'Array of validation error messages that user has verified and dismissed';

-- Update the events_with_gym view to include this column
CREATE OR REPLACE VIEW events_with_gym AS
SELECT 
  e.*,
  g.name AS gym_name,
  g.id AS gym_code
FROM events e
LEFT JOIN gyms g ON e.gym_id = g.id;

-- Grant access to the view
GRANT SELECT ON events_with_gym TO anon, authenticated;

