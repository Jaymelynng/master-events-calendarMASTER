-- ============================================================================
-- VERIFY ALL HGA KIDS NIGHT OUT EVENTS (INCLUDING TODAY'S IMPORTS)
-- ============================================================================

-- Count total
SELECT 
  '📊 TOTAL COUNT' as check_type,
  COUNT(*) as count
FROM events
WHERE gym_id = 'HGA'
  AND type = 'KIDS NIGHT OUT';

-- Show ALL events with creation timestamps
SELECT 
  '📅 ALL EVENTS' as check_type,
  id,
  title,
  date,
  event_url,
  created_at,
  DATE(created_at) as created_date
FROM events
WHERE gym_id = 'HGA'
  AND type = 'KIDS NIGHT OUT'
ORDER BY date, created_at;

-- Find duplicates by URL
WITH url_groups AS (
  SELECT 
    SPLIT_PART(event_url, '?', 1) as base_url,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as all_ids,
    MIN(title) as title,
    MIN(date) as date
  FROM events
  WHERE gym_id = 'HGA'
    AND type = 'KIDS NIGHT OUT'
  GROUP BY SPLIT_PART(event_url, '?', 1)
)
SELECT 
  '🔍 DUPLICATE CHECK' as check_type,
  base_url,
  title,
  date,
  count as duplicate_count,
  all_ids
FROM url_groups
WHERE count > 1
ORDER BY date;

-- Show events grouped by creation date
SELECT 
  '📆 BY IMPORT DATE' as check_type,
  DATE(created_at) as import_date,
  COUNT(*) as events_imported
FROM events
WHERE gym_id = 'HGA'
  AND type = 'KIDS NIGHT OUT'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at);



