-- ============================================================
-- UPDATE CAPITAL PFLUGERVILLE SKILL CLINICS LINK
-- ============================================================
-- Date: December 23, 2025
-- Purpose: Update CPF skill clinics link to use program ID 63 instead of 31
-- Issue: Bulk opener and auto-sync need to use the correct program page
-- ============================================================

-- Update the existing skill_clinics link for CPF
UPDATE gym_links
SET 
  url = 'https://portal.iclasspro.com/capgymhp/camps/63?sortBy=time',
  updated_at = NOW()
WHERE 
  gym_id = 'CPF' 
  AND link_type_id = 'skill_clinics';

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- Run this after UPDATE to verify the link was changed:

SELECT 
  gym_id,
  link_type_id,
  url,
  title,
  is_active,
  updated_at
FROM gym_links 
WHERE gym_id = 'CPF' AND link_type_id = 'skill_clinics';

-- Expected result: 
-- gym_id | link_type_id   | url
-- CPF    | skill_clinics  | https://portal.iclasspro.com/capgymhp/camps/63?sortBy=time

-- ============================================================
-- NOTES
-- ============================================================
-- 1. This updates the link that both bulk opener buttons and auto-sync use
-- 2. After running this, the "All Clinics" bulk button will open the correct page for CPF
-- 3. The auto-sync feature should also use this same URL for collecting CPF clinic events
-- 4. If the URL needs to change again in the future, use the Link Factory in the Admin Portal
-- 5. To verify it works: Click "All Clinics" bulk button and check CPF tab opens /camps/63

