-- DELETE HGA DUPLICATE KNO EVENTS
-- Created: October 7, 2025
-- Reason: Import system bug allowed 3x imports creating 12 duplicates
-- Bug fixed in: src/components/EventsDashboard.js line 1120-1137

-- BEFORE RUNNING: Verify you have 19 total HGA KNO events in database
-- AFTER RUNNING: Will have 7 unique HGA KNO events (keeping oldest timestamp for each)

-- Keep these 7 UNIQUE events (oldest timestamp for each):
-- ✅ be6e8fae... - Sept 20 - Neon Night (2025-09-17)
-- ✅ 1403f52c... - Oct 4 - In My Gymnast Era (2025-09-17)
-- ✅ 571acb92... - Oct 18 - Flip into Fall (2025-09-17)
-- ✅ a4422fec... - Nov 1 - Boo Bash (2025-09-17)
-- ✅ 1f612e7a... - Nov 15 - Turkey Tumble (2025-09-17)
-- ✅ 6851aa94... - Dec 6 - Wild & Wacky (2025-09-17)
-- ✅ c8ec9684... - Dec 20 - Holly Jolly Handstand (2025-09-17)

-- Delete these 12 DUPLICATES (newer timestamps):
DELETE FROM events WHERE id IN (
  -- Nov 1 - Boo Bash duplicates (keeping oldest: a4422fec...)
  '99a672e1-433c-4aff-82e3-cec1dcafc5c0',  -- 2025-10-07 15:36:45
  '9a27d563-0cfa-41b6-9518-f44d17f57d7d',  -- 2025-10-07 15:36:28
  'ab1ecabb-12cd-4b6e-bf40-2cea3b400455',  -- 2025-10-07 16:11:53
  
  -- Nov 15 - Turkey Tumble duplicates (keeping oldest: 1f612e7a...)
  '8b2290c7-4aed-46a4-acb3-e11919ce3db3',  -- 2025-10-07 15:36:28
  'c499beff-ad20-4f8f-b18a-e564c2011446',  -- 2025-10-07 15:36:45
  '2a9edd7c-88c9-4367-bc5e-c2465f01316a',  -- 2025-10-07 16:11:53
  
  -- Dec 6 - Wild & Wacky duplicates (keeping oldest: 6851aa94...)
  '0b39727d-00a9-4bea-af42-e463aae7963c',  -- 2025-10-07 15:36:45
  '5b478912-ccb0-479d-9710-960435ad9589',  -- 2025-10-07 15:36:28
  'e81b195f-31d5-45ed-b517-20a5e195a575',  -- 2025-10-07 16:11:53
  
  -- Dec 20 - Holly Jolly Handstand duplicates (keeping oldest: c8ec9684...)
  '0158a795-800e-4f9b-b8a7-a85366f99277',  -- 2025-10-07 15:36:28
  '6669f7bd-6c03-4200-80b5-cff647ee8023',  -- 2025-10-07 15:36:45
  '0d63bf6e-9d12-440f-8342-4e4bcda15be6'   -- 2025-10-07 16:11:53
);

-- VERIFICATION QUERY (run after DELETE to confirm):
-- Should return exactly 7 rows
SELECT 
  id,
  title,
  date,
  event_url,
  created_at
FROM events 
WHERE gym_id = 'HGA' 
  AND type = 'KIDS NIGHT OUT'
ORDER BY date;

-- Expected result:
-- 7 total events (one for each unique date)
-- Sept 20, Oct 4, Oct 18, Nov 1, Nov 15, Dec 6, Dec 20


