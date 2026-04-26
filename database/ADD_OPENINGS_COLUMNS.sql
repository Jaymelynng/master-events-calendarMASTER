-- Add openings count tracking to events table
-- These fields come from iClassPro's /api/open/v1/{slug}/camps/{id} detail endpoint
--
-- Background: We were already calling this endpoint and capturing hasOpenings (boolean),
-- but throwing away the actual integer count. iClassPro returns:
--   "openings": 23                              ← exact spots remaining
--   "openingsDisplay": "23 Openings Available"  ← pre-formatted string
--   "showOpenings": true                        ← gym setting (whether to show count publicly)
--
-- IMPORTANT: After running this, also re-run CREATE_EVENTS_WITH_GYM_VIEW.sql
-- to expose the new columns in the events_with_gym view.

ALTER TABLE events
ADD COLUMN IF NOT EXISTS openings INTEGER,
ADD COLUMN IF NOT EXISTS openings_display TEXT,
ADD COLUMN IF NOT EXISTS show_openings BOOLEAN DEFAULT true;

ALTER TABLE events_archive
ADD COLUMN IF NOT EXISTS openings INTEGER,
ADD COLUMN IF NOT EXISTS openings_display TEXT,
ADD COLUMN IF NOT EXISTS show_openings BOOLEAN DEFAULT true;

COMMENT ON COLUMN events.openings IS 'From iClassPro openings field - exact integer count of spots remaining';
COMMENT ON COLUMN events.openings_display IS 'From iClassPro openingsDisplay - pre-formatted string like "23 Openings Available"';
COMMENT ON COLUMN events.show_openings IS 'From iClassPro showOpenings - gym setting; if false, do not show count publicly';
