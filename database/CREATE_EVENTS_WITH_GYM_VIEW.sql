-- Create view that joins events with gym names
-- This view is used by the dashboard to display events with their gym names
-- Run this SQL in your Supabase SQL Editor

CREATE OR REPLACE VIEW events_with_gym AS
SELECT 
  e.*,
  g.name AS gym_name,
  g.id AS gym_code
FROM events e
LEFT JOIN gyms g ON e.gym_id = g.id;

-- Grant access to the view
GRANT SELECT ON events_with_gym TO anon, authenticated;

