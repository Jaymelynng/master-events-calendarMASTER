-- See what camp link types each gym actually has
SELECT 
  gym_id,
  link_type_id,
  url,
  title
FROM gym_links
WHERE link_type_id IN ('camps', 'camps_half', 'camps_holiday', 'special_events')
ORDER BY gym_id, link_type_id;

