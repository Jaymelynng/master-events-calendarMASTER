-- ============================================================
-- ADD CPF SUMMER CAMP LINKS
-- ============================================================
-- Date: December 23, 2025
-- Purpose: Add summer camp links for Capital Pflugerville
-- User confirmed these are the correct program pages
-- ============================================================

-- CPF Summer Camp - Full Day
INSERT INTO gym_links (gym_id, link_type_id, url, title, is_active, sort_order)
VALUES ('CPF', 'camps_summer_full', 'https://portal.iclasspro.com/capgymhp/camps/8?sortBy=time', 'Summer Full Day', true, 6)
ON CONFLICT (gym_id, link_type_id) 
DO UPDATE SET 
  url = EXCLUDED.url,
  title = EXCLUDED.title,
  updated_at = NOW();

-- CPF Summer Camp - Half Day
INSERT INTO gym_links (gym_id, link_type_id, url, title, is_active, sort_order)
VALUES ('CPF', 'camps_summer_half', 'https://portal.iclasspro.com/capgymhp/camps/84?sortBy=time', 'Summer Half Day', true, 7)
ON CONFLICT (gym_id, link_type_id) 
DO UPDATE SET 
  url = EXCLUDED.url,
  title = EXCLUDED.title,
  updated_at = NOW();

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- Run this after INSERT to verify all CPF links are correct:

SELECT 
  link_type_id,
  url,
  title,
  is_active,
  sort_order
FROM gym_links 
WHERE gym_id = 'CPF'
ORDER BY sort_order;

-- Expected result: 7 rows for CPF
-- Link Type          | Program ID | URL
-- skill_clinics      | 63         | .../camps/63
-- kids_night_out     | 2          | .../camps/2
-- open_gym           | 81         | .../camps/81
-- camps              | 91         | .../camps/91 (School Year Full Day)
-- camps_half         | 73         | .../camps/73 (School Year Half Day)
-- camps_summer_full  | 8          | .../camps/8  (Summer Full Day)
-- camps_summer_half  | 84         | .../camps/84 (Summer Half Day)

-- ============================================================
-- NOTES
-- ============================================================
-- 1. skill_clinics was already updated from /camps/31 to /camps/63
-- 2. This adds the missing summer camp links
-- 3. All other CPF links (KNO, open gym, school year camps) were already correct
-- 4. After running this, all CPF program pages will sync correctly
-- 5. Use ON CONFLICT to safely update if links already exist

