-- ============================================
-- FIX RBA OPEN GYM URL
-- ============================================
-- Problem: RBA's open_gym link has wrong typeId (76 instead of 6)
-- Run this in Supabase SQL Editor
-- ============================================

-- First, let's see what we're changing (preview)
SELECT id, gym_id, link_type_id, url 
FROM gym_links 
WHERE gym_id = 'RBA' AND link_type_id = 'open_gym';

-- Fix the URL
UPDATE gym_links 
SET url = 'https://portal.iclasspro.com/rbatascocita/camps/6?sortBy=time',
    updated_at = NOW()
WHERE gym_id = 'RBA' 
  AND link_type_id = 'open_gym';

-- Verify the fix
SELECT id, gym_id, link_type_id, url, updated_at
FROM gym_links 
WHERE gym_id = 'RBA' AND link_type_id = 'open_gym';

-- ============================================
-- DONE! RBA Open Gym now points to correct URL
-- ============================================





