-- CLEANUP CAMP LINKS
-- Remove placeholder/duplicate camp links

-- 1. Delete CRR's camps_holiday (placeholder URL)
DELETE FROM gym_links 
WHERE gym_id = 'CRR' AND link_type_id = 'camps_holiday';

-- 2. Delete RBA's special_events (placeholder URL)
DELETE FROM gym_links 
WHERE gym_id = 'RBA' AND link_type_id = 'special_events';

-- 3. Delete CPF's camps_half (duplicate - same URL as camps)
DELETE FROM gym_links 
WHERE gym_id = 'CPF' AND link_type_id = 'camps_half';

-- Verify cleanup
SELECT 
  gym_id,
  link_type_id,
  url,
  title
FROM gym_links
WHERE link_type_id IN ('camps', 'camps_half', 'camps_holiday', 'special_events')
ORDER BY gym_id, link_type_id;

