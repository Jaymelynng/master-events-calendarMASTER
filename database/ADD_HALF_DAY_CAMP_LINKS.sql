-- ============================================================
-- ADD MISSING HALF DAY CAMP LINK TO GYM_LINKS TABLE
-- ============================================================
-- Date: October 17, 2025
-- Purpose: Enable "Half Day Camps" bulk action button
-- Status: EST already has camps_half, only CPF is missing
-- ============================================================

-- Pflugerville Half Day Camps (MISSING - needs to be added)
INSERT INTO gym_links (gym_id, link_type_id, url, title, is_active, sort_order)
VALUES ('CPF', 'camps_half', 'https://portal.iclasspro.com/capgymhp/camps/73?sortBy=time', 'HALF DAY', true, 2);

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- Run this after INSERT to verify the links were added:

SELECT 
  gym_id,
  link_type_id,
  url,
  title,
  is_active,
  sort_order
FROM gym_links 
WHERE link_type_id = 'camps_half'
ORDER BY gym_id;

-- Expected result: 2 rows (CPF and EST)

-- ============================================================
-- NOTES
-- ============================================================
-- 1. These are the ONLY 2 gyms offering half day camps as of Oct 2025
-- 2. The type ID numbers (73, 33) are specific to each gym's iClassPro setup
-- 3. DO NOT add for other gyms unless they actually offer half day options
-- 4. If URLs stop working, visit gym portal to get updated URLs
-- 5. After running this, the "🕐 Half Day Camps" button should open 2 tabs

