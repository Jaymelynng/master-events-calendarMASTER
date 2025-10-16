-- FIX RBA SPECIAL EVENTS LINK
-- Replace placeholder with real URL

-- Update the special_events link with the real URL
UPDATE gym_links 
SET url = 'https://portal.iclasspro.com/rbatascocita/camps/76?sortBy=time'
WHERE gym_id = 'RBA' AND link_type_id = 'special_events';

-- Verify it worked
SELECT gym_id, link_type_id, url 
FROM gym_links 
WHERE gym_id = 'RBA' AND link_type_id = 'special_events';

