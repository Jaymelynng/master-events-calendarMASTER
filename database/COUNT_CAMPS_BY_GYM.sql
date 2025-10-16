-- Count all CAMP events by gym
SELECT 
  gym_id,
  COUNT(*) as camp_count
FROM events
WHERE type = 'CAMP'
GROUP BY gym_id
ORDER BY gym_id;

